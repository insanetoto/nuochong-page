import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { Context } from '@deepseek-ai/cordis';
import { SystemPrompt } from '@deepseek-ai/dsh-system-prompt';
import { ToolRuntime, defineTool } from '@deepseek-ai/dsh-tools';
import { Boundary, FIXTURE_ISSUER, FIXTURE_AUDIENCE } from '../isolation/security.mjs';

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
function token(user, overrides = {}, headerOverrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'fixture-key', ...headerOverrides })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ iss: FIXTURE_ISSUER, aud: FIXTURE_AUDIENCE,
    sub: user, iat: now, exp: now + 300, ...overrides })).toString('base64url');
  return `${header}.${body}.${sign('RSA-SHA256', Buffer.from(`${header}.${body}`), privateKey).toString('base64url')}`;
}
let clockOffset = 0;
const boundary = new Boundary(publicKey, () => Date.now() + clockOffset);
const ctx = new Context(); await ctx.plugin(SystemPrompt); await ctx.plugin(ToolRuntime);
const callContexts = new Map();
let beforeCommit = async () => {};
let unsafeExecutions = 0;
ctx.tools.guard((exec) => {
  const binding = callContexts.get(exec.callId);
  try {
    if (!binding) throw new Error('no server context');
    boundary.validateCall(binding.actor, binding.runId, exec.name, exec.arguments);
  } catch { boundary.log(binding?.actor, 'tool-dispatch', 'deny'); return 'Forbidden'; }
});
for (const name of ['read_document', 'write_fixture', 'unsafe_owner_tool']) {
  ctx.tools.register(defineTool({ name, description: 'Synthetic A-08 boundary fixture',
    parameters: {}, output: { schema: { type: 'string' }, render: (_, value) => [{ type: 'text', text: value }] },
    async execute(args, exec) {
      if (name === 'unsafe_owner_tool') { unsafeExecutions++; return 'unsafe'; }
      const { actor, runId } = callContexts.get(exec.callId);
      await beforeCommit(); exec.signal.throwIfAborted();
      boundary.validateCall(actor, runId, name, args);
      return name === 'read_document' ? boundary.read(actor, 'document', args.documentId).text
        : boundary.commitWrite(actor, runId, args);
    },
  }));
}
async function dispatch(actor, runId, name, args) {
  const callId = crypto.randomUUID(); callContexts.set(callId, { actor, runId });
  try { return await ctx.tools.execute({ callId, name, arguments: args, signal: new AbortController().signal }); }
  finally { callContexts.delete(callId); }
}
const results = [];
async function check(name, body) {
  try { await body(); results.push({ name, passed: true }); }
  catch (error) { results.push({ name, passed: false, error: error.message }); }
}
try {
  const actors = Object.fromEntries(['a1', 'a2', 'b1', 'b2'].map((id) => [id, boundary.authenticate(token(id))]));
  for (const id of Object.keys(actors)) {
    await check(`${id}: own tenant documents and own session/run only`, async () => {
      const actor = actors[id]; const other = id[0] === 'a' ? 'b' : 'a';
      const peer = `${id[0]}${id[1] === '1' ? '2' : '1'}`;
      for (const index of [1, 2]) {
        assert.match(boundary.read(actor, 'document', `${id[0]}-doc-${index}`).text, new RegExp(`TENANT_${id[0].toUpperCase()}`));
        assert.throws(() => boundary.read(actor, 'document', `${other}-doc-${index}`), /NotFound/);
        assert.match(boundary.download(actor, `${id[0]}-doc-${index}`).toString('utf8'), new RegExp(`TENANT_${id[0].toUpperCase()}`));
        assert.throws(() => boundary.download(actor, `${other}-doc-${index}`), /NotFound/);
      }
      assert.ok(boundary.read(actor, 'session', `${id}-session`)); assert.ok(boundary.read(actor, 'run', `${id}-run`));
      assert.throws(() => boundary.read(actor, 'session', `${peer}-session`), /NotFound/);
      assert.throws(() => boundary.read(actor, 'run', `${other}1-run`), /NotFound/);
    });
  }
  for (const [label, overrides, header] of [
    ['wrong issuer', { iss: 'https://attacker.invalid' }], ['wrong audience', { aud: 'other-api' }],
    ['expired', { exp: 1 }], ['future not-before', { nbf: Math.floor(Date.now()/1000)+100 }],
    ['unknown subject', { sub: 'unknown' }], ['algorithm substitution', {}, { alg: 'HS256' }],
    ['unknown signing key', {}, { kid: 'attacker-key' }], ['untrusted key URL', {}, { jku: 'https://attacker.invalid/jwks' }],
  ]) await check(`signed issuer boundary rejects ${label}`, async () => {
    assert.throws(() => boundary.authenticate(token('a1', overrides, header)), /Unauthorized/);
  });
  await check('signature tampering and unsigned token rejected', async () => {
    const valid = token('a1'); const parts = valid.split('.');
    parts[1] = Buffer.from(JSON.stringify({ sub: 'b1' })).toString('base64url');
    assert.throws(() => boundary.authenticate(parts.join('.')), /Unauthorized/);
    assert.throws(() => boundary.authenticate('e30.e30.'), /Unauthorized/);
  });
  await check('signed token tenant/owner roles cannot override server membership', async () => {
    const actor = boundary.authenticate(token('a1', { tenantId: 'tenant-b', roles: ['owner', 'admin'] }));
    assert.equal(actor.tenantId, 'tenant-a');
    assert.throws(() => boundary.issueApproval(actor, 'a1', 'a1-run', 'a-doc-1'), /Forbidden/);
    assert.throws(() => boundary.read(actor, 'document', 'b-doc-1'), /NotFound/);
  });
  await check('forged ActorContext and client identity fields rejected', async () => {
    assert.throws(() => boundary.read({ ...actors.b1 }, 'document', 'b-doc-1'), /Forbidden/);
    const before = boundary.runs.size;
    for (const field of ['tenantId', 'userId', 'roles']) assert.throws(() => boundary.createRun(actors.a1,
      { prompt: 'synthetic', idempotencyKey: 'fixture', [field]: 'attacker' }), /InvalidInput/);
    assert.equal(boundary.runs.size, before);
    const run = boundary.createRun(actors.a1, { prompt: 'synthetic', idempotencyKey: 'fixture' });
    assert.equal(boundary.read(actors.a1, 'run', run).tenantId, 'tenant-a');
  });
  await check('real ToolRuntime allows scoped read, rejects other tenant and path traversal', async () => {
    assert.equal((await dispatch(actors.a1, 'a1-run', 'read_document', { documentId: 'a-doc-1' })).isError, false);
    for (const documentId of ['b-doc-1', '../tenant-b/same-name.txt', 'missing']) {
      assert.equal((await dispatch(actors.a1, 'a1-run', 'read_document', { documentId })).isError, true);
    }
    assert.equal((await dispatch(actors.a1, 'b1-run', 'read_document', { documentId: 'a-doc-1' })).isError, true);
    assert.equal((await dispatch(actors.a1, 'a1-run', 'read_document', { documentId: 'a-doc-1', tenantId: 'tenant-b' })).isError, true);
  });
  await check('host owner tool and missing server context cannot bypass policy', async () => {
    assert.equal((await dispatch(actors.a1, 'a1-run', 'unsafe_owner_tool', {})).isError, true);
    assert.equal((await ctx.tools.execute({ callId: crypto.randomUUID(), name: 'unsafe_owner_tool', arguments: {},
      signal: new AbortController().signal })).isError, true);
    assert.equal(unsafeExecutions, 0);
  });
  await check('no approval: write rejected, no side effect', async () => {
    assert.equal((await dispatch(actors.a1, 'a1-run', 'write_fixture', { documentId: 'a-doc-1' })).isError, true);
    assert.equal(boundary.effects.length, 0);
  });
  await check('approval bound to tenant/user/run/document; one accepted write and replay denied', async () => {
    const approvalId = boundary.issueApproval(actors.a2, 'a1', 'a1-run', 'a-doc-1');
    const otherRun = boundary.createRun(actors.a1, { prompt: 'fixture', idempotencyKey: 'other-run' });
    assert.equal((await dispatch(actors.a1, otherRun, 'write_fixture', { documentId: 'a-doc-1', approvalId })).isError, true);
    for (const [actor, run, documentId] of [[actors.b1,'b1-run','b-doc-1'],[actors.a2,'a2-run','a-doc-1'],[actors.a1,'a1-run','a-doc-2']]) {
      assert.equal((await dispatch(actor, run, 'write_fixture', { documentId, approvalId })).isError, true);
    }
    assert.equal(boundary.effects.length, 0);
    assert.equal((await dispatch(actors.a1, 'a1-run', 'write_fixture', { documentId: 'a-doc-1', approvalId })).isError, false);
    assert.equal((await dispatch(actors.a1, 'a1-run', 'write_fixture', { documentId: 'a-doc-1', approvalId })).isError, true);
    assert.equal(boundary.effects.length, 1);
  });
  await check('expired approval cannot execute and cross-tenant approval cannot be created', async () => {
    const approvalId = boundary.issueApproval(actors.a2, 'a1', 'a1-run', 'a-doc-2');
    const before = boundary.effects.length;
    clockOffset = 31_000;
    try { assert.equal((await dispatch(actors.a1, 'a1-run', 'write_fixture', { documentId: 'a-doc-2', approvalId })).isError, true); }
    finally { clockOffset = 0; }
    assert.equal(boundary.effects.length, before);
    assert.throws(() => boundary.issueApproval(actors.a2, 'b1', 'b1-run', 'b-doc-1'), /Forbidden/);
  });
  await check('concurrent approval replay accepts only one write', async () => {
    const approvalId = boundary.issueApproval(actors.a2, 'a1', 'a1-run', 'a-doc-2');
    const before = boundary.effects.length;
    const outcomes = await Promise.all(Array.from({ length: 5 }, () => dispatch(actors.a1, 'a1-run', 'write_fixture',
      { documentId: 'a-doc-2', approvalId })));
    assert.equal(outcomes.filter((r) => !r.isError).length, 1);
    assert.equal(boundary.effects.length, before + 1);
  });
  await check('revocation between guard and tool body prevents write', async () => {
    const approvalId = boundary.issueApproval(actors.a2, 'a1', 'a1-run', 'a-doc-2');
    const before = boundary.effects.length;
    beforeCommit = async () => { boundary.members.delete('a1'); };
    assert.equal((await dispatch(actors.a1, 'a1-run', 'write_fixture', { documentId: 'a-doc-2', approvalId })).isError, true);
    assert.equal(boundary.effects.length, before);
    beforeCommit = async () => {}; boundary.members.set('a1', { tenantId: 'tenant-a', role: 'member' });
  });
  await check('approver role revocation invalidates unused approval', async () => {
    const approvalId = boundary.issueApproval(actors.a2, 'a1', 'a1-run', 'a-doc-2');
    boundary.members.set('a2', { tenantId: 'tenant-a', role: 'member' });
    assert.equal((await dispatch(actors.a1, 'a1-run', 'write_fixture', { documentId: 'a-doc-2', approvalId })).isError, true);
    assert.throws(() => boundary.issueApproval(actors.a2, 'a1', 'a1-run', 'a-doc-2'), /Forbidden/);
  });
  await check('valid token remains denied after membership revoked', async () => {
    const valid = token('b2'); boundary.members.delete('b2');
    assert.throws(() => boundary.authenticate(valid), /Unauthorized/);
    assert.throws(() => boundary.read(actors.b2, 'document', 'b-doc-1'), /Forbidden/);
  });
  await check('UTF8/text-only/10MiB upload bounds', async () => {
    assert.equal(boundary.validateUpload(Buffer.from('合成文档'), 'text/plain'), '合成文档');
    assert.equal(boundary.validateUpload(Buffer.alloc(10*1024*1024, 65), 'text/plain').length, 10*1024*1024);
    assert.throws(() => boundary.validateUpload(Buffer.alloc(10*1024*1024+1), 'text/plain'), /InvalidUpload/);
    assert.throws(() => boundary.validateUpload(Buffer.from([0xff]), 'text/plain'), /InvalidUpload/);
    assert.throws(() => boundary.validateUpload(Buffer.from('fake pdf'), 'application/pdf'), /InvalidUpload/);
  });
  await check('audit correlates requestId without raw token, prompt or document contents', async () => {
    assert.ok(boundary.audit.every((r) => /^[0-9a-f-]{36}$/.test(r.requestId)));
    const audit = JSON.stringify(boundary.audit);
    assert.equal(audit.includes('TENANT_'), false); assert.equal(audit.includes('eyJ'), false);
    assert.ok(boundary.audit.some((r) => r.result === 'deny'));
    assert.equal(boundary.effects.length, 2);
  });
} finally { await ctx.fiber.dispose(); }
const report = { time: new Date().toISOString(), node: process.version, platform: `${process.platform}-${process.arch}`,
  scope: 'Real RSA signatures and real ToolRuntime guards; synthetic issuer, in-memory memberships/resources/approvals; no external OIDC or production identity',
  fixtures: { tenants: 2, usersPerTenant: 2, sameNameDocumentsPerTenant: 2 },
  results, acceptedSyntheticWrites: boundary.effects.length, unsafeHostToolExecutions: unsafeExecutions,
  auditEntries: boundary.audit.length, limitations: ['No external IdP login/code flow, JWKS rotation, database RLS or cross-process revocation',
    'No production object store, persistent approval transactions or quota service'] };
mkdirSync(new URL('../isolation/outputs/', import.meta.url), { recursive: true });
writeFileSync(new URL('../isolation/outputs/isolation-probe.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (results.some((r) => !r.passed)) process.exitCode = 1;
