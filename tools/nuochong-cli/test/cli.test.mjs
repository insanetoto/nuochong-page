import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { commands, valid } from '../src/registry.mjs';

const bin = fileURLToPath(new URL('../bin/nuochong.mjs', import.meta.url));
const credential = 'synthetic-user-access-credential';
const runState = { runId: 'run-1', actorId: 'operator-a', status: 'running', idempotencyKey: 'stable-key', version: 1 };
function launch(args, env = {}, input = '') {
  const child = spawn(process.execPath, [bin, ...args], { env: { PATH: process.env.PATH, ...env }, stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = ''; let stderr = '';
  child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => { stdout += chunk; }); child.stderr.on('data', (chunk) => { stderr += chunk; });
  child.stdin.on('error', () => {});
  if (input !== null) child.stdin.end(input);
  const done = once(child, 'close').then(([code]) => ({ code, stdout, stderr }));
  return { child, done };
}
async function cli(args, env = {}, input = '') { return launch(args, env, input).done; }
async function server(body) {
  const seen = [];
  const http = createServer(async (req, res) => {
    let text = ''; for await (const bytes of req) text += bytes.toString();
    seen.push({ method: req.method, url: req.url, headers: req.headers, body: text && JSON.parse(text) });
    try { await body(req, res, seen); } catch { if (!res.destroyed) res.end(); }
  });
  await new Promise((resolve) => http.listen(0, '127.0.0.1', resolve));
  const env = { NUOCHONG_API_URL: `http://127.0.0.1:${http.address().port}`, NUOCHONG_ACCESS_TOKEN: credential };
  return { env, seen, close: async () => { http.closeAllConnections(); await new Promise((resolve) => http.close(resolve)); } };
}
const json = (res, data, status = 200) => { res.writeHead(status, { 'content-type': 'application/json', 'x-request-id': 'request-fixture' }); res.end(JSON.stringify(data)); };
const event = (sequence, type) => ({ eventId: `e-${sequence}`, runId: 'run-1', sequence, type, time: '2026-10-29T00:00:00Z' });
const frame = (data) => `id: ${data.eventId}\nevent: ${data.type}\ndata: ${JSON.stringify(data)}\n\n`;

test('AI discovery exposes side effects, schemas and honest availability without credentials', async () => {
  const result = await cli(['capabilities', '--json']); assert.equal(result.code, 0); assert.equal(result.stderr, '');
  const data = JSON.parse(result.stdout).data; assert.equal(data.commands.length, 20);
  assert.ok(data.commands.every((c) => c.inputSchema.additionalProperties === false && c.authorization && !c.automaticRetry));
  assert.ok(data.commands.every((c) => c.serverStatus === 'oa-control-api'));
  assert.equal(data.transportAdapters.mcp, 'planned-adapter-of-same-contracts');
  assert.equal((await cli(['permissions', 'list'])).code, 14);
  assert.ok(!data.plannedDomains.some((d) => ['knowledge', 'training', 'workorders'].includes(d)));
  assert.equal((await cli(['knowledge', 'search'])).code, 2);
});
test('create/event DTOs preserve A-05 transport semantics; new Harness state has no enterprise dependency', () => {
  for (const [id, field, file] of [['runs.create', 'inputSchema', 'create-run'], ['runs.events', 'outputSchema', 'event']]) {
    const expected = JSON.parse(readFileSync(new URL(`../../../experiments/phase-a/contracts/${file}.schema.json`, import.meta.url)));
    const actual = structuredClone(commands.find((c) => c.id === id)[field]);
    if (id === 'runs.create') delete actual.properties.sessionId;
    assert.deepEqual(actual, expected);
  }
  assert.ok(!Object.hasOwn(commands.find((c) => c.id === 'runs.get').outputSchema.properties, 'tenantId'));
});
test('schema/help/version and JSON stdin dry-run are offline and executable', async () => {
  assert.match((await cli(['--help'])).stdout, /nuochong/);
  assert.equal(JSON.parse((await cli(['version'])).stdout).data.clientVersion, '0.2.0');
  assert.equal(JSON.parse((await cli(['schema', 'runs.create', '--json'])).stdout).data.method, 'POST');
  const result = await cli(['runs', 'create', '--input', '-', '--dry-run'], {}, JSON.stringify({ prompt: '合成输入', idempotencyKey: 'stable' }));
  assert.equal(result.code, 0); assert.equal(JSON.parse(result.stdout).data.executed, false);
});
test('stdin decoder preserves split UTF-8 characters', async () => {
  const { child, done } = launch(['runs', 'create', '--input', '-', '--dry-run'], {}, null);
  const bytes = Buffer.from(JSON.stringify({ prompt: '合成输入', idempotencyKey: 'stable' }));
  const split = bytes.indexOf(Buffer.from('合')) + 1;
  child.stdin.write(bytes.subarray(0, split)); await delay(30); child.stdin.end(bytes.subarray(split));
  const result = await done; assert.equal(result.code, 0); assert.equal(JSON.parse(result.stdout).data.body.prompt, '合成输入');
});
test('invalid identities, unknown/duplicate options, ambiguous inputs and malformed JSON fail before network', async () => {
  for (const extra of [{ tenantId: 'other' }, { userId: 'other' }, { roles: ['owner'] }]) {
    assert.equal((await cli(['runs', 'create', '--input', JSON.stringify({ prompt: 'x', idempotencyKey: 'k', ...extra }), '--dry-run'])).code, 2);
  }
  for (const args of [['runs', 'create', '--input', '{}', '--yes'], ['runs', 'get', '--run-id', 'a', '--run-id', 'b'],
    ['runs', 'get', '--run-id', '../tenant-b'], ['runs', 'get', '--input', '{}', '--run-id', 'x'],
    ['runs', 'create', '--input', 'bad-json'], ['runs', 'get', '--timeout-ms', '0']]) {
    const result = await cli(args); assert.equal(result.code, 2); assert.equal(result.stdout, ''); assert.equal(JSON.parse(result.stderr).error.code, 'INVALID_INPUT');
  }
});
test('configuration missing or remote cleartext fails locally without credential disclosure', async () => {
  assert.equal((await cli(['runs', 'get', '--run-id', 'run-1'])).code, 3);
  assert.equal((await cli(['runs', 'get', '--run-id', 'run-1'], { NUOCHONG_API_URL: 'http://127.0.0.1:1' })).code, 4);
  const result = await cli(['runs', 'get', '--run-id', 'run-1'], { NUOCHONG_API_URL: 'http://example.invalid', NUOCHONG_ACCESS_TOKEN: credential });
  assert.equal(result.code, 3); assert.equal(result.stderr.includes(credential), false);
});
test('create/get/cancel use business API, preserve idempotency and do not imply business completion', async () => {
  const fixture = await server((req, res) => {
    if (req.url.endsWith('/cancel')) json(res, { runId: 'run-1', cancelRequested: true }, 202);
    else if (req.method === 'POST') json(res, { runId: 'run-1' }, 202);
    else json(res, { ...runState, status: 'failed', errorCode: 'provider_error' });
  });
  try {
    for (const args of [['runs', 'create', '--input', JSON.stringify({ prompt: 'synthetic', idempotencyKey: 'stable-key' })],
      ['runs', 'get', '--run-id', 'run-1'], ['runs', 'cancel', '--input', '{"runId":"run-1"}']]) {
      const result = await cli(args, fixture.env); assert.equal(result.code, 0); assert.equal(result.stderr, '');
    }
    assert.equal(fixture.seen.length, 3); assert.equal(fixture.seen[0].body.idempotencyKey, 'stable-key');
    assert.deepEqual(fixture.seen[2].body, {});
    assert.ok(fixture.seen.every((r) => r.headers.authorization === `Bearer ${credential}`));
  } finally { await fixture.close(); }
});
test('HTTP errors are stable, raw upstream body and credentials never reach output, writes are not retried', async () => {
  const mapping = [[401,4],[403,5],[404,6],[409,7],[429,8],[503,9],[504,11],[422,2]];
  for (const [status, code] of mapping) {
    const fixture = await server((req, res) => json(res, { message: credential, secret: 'private-provider-diagnostic' }, status));
    try {
      const result = await cli(['runs', 'create', '--input', '{"prompt":"x","idempotencyKey":"stable"}'], fixture.env);
      assert.equal(result.code, code); assert.equal(fixture.seen.length, 1); assert.equal(result.stdout, '');
      assert.equal(result.stderr.includes(credential), false); assert.equal(result.stderr.includes('private-provider'), false);
    } finally { await fixture.close(); }
  }
});
test('redirect does not forward authentication or replay a write', async () => {
  const target = await server((req, res) => json(res, { runId: 'run-1' }, 202));
  const origin = await server((req, res) => { res.writeHead(307, { location: target.env.NUOCHONG_API_URL + '/capture' }); res.end(); });
  try {
    const result = await cli(['runs', 'create', '--input', '{"prompt":"x","idempotencyKey":"stable"}'], origin.env);
    assert.equal(result.code, 9); assert.equal(origin.seen.length, 1); assert.equal(target.seen.length, 0);
  } finally { await origin.close(); await target.close(); }
});
test('response schema mismatch, unexpected run, non-JSON and oversized body fail closed', async () => {
  for (const mode of ['shape', 'other-run', 'html', 'oversized']) {
    const fixture = await server((req, res) => {
      if (mode === 'shape') json(res, { runId: 'run-1' });
      else if (mode === 'other-run') json(res, { ...runState, runId: 'run-other' });
      else if (mode === 'oversized') json(res, { ...runState, text: 'x'.repeat(1024*1024+1) });
      else { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<h1>private</h1>'); }
    });
    try { assert.equal((await cli(['runs', 'get', '--run-id', 'run-1'], fixture.env)).code, 12); }
    finally { await fixture.close(); }
  }
});
test('network deadline bounds a real stalled request and does not retry/cancel the remote run', async () => {
  const fixture = await server(async () => { await delay(300); });
  try {
    const result = await cli(['runs', 'get', '--run-id', 'run-1', '--timeout-ms', '100'], fixture.env);
    assert.equal(result.code, 11); assert.ok(fixture.seen.length <= 1); assert.ok(!fixture.seen.some((r) => r.url.endsWith('/cancel')));
  } finally { await fixture.close(); }
});
test('deadline also bounds a stdin pipe with no EOF', async () => {
  const { done } = launch(['runs', 'create', '--input', '-', '--dry-run', '--timeout-ms', '30'], {}, null);
  assert.equal((await done).code, 11);
});
test('SSE handles UTF8/CRLF fragmentation, transient deltas, durable dedup and terminal cleanup', async () => {
  const fixture = await server(async (req, res) => {
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    const first = event(1, 'run.started'); const last = event(2, 'run.completed');
    const payload = (': heartbeat\n\n' + frame(first) + frame(first) + 'event: run.delta\ndata: {"text":"合成片段"}\n\n' + frame(last)).replaceAll('\n', '\r\n');
    for (const byte of Buffer.from(payload)) { if (res.destroyed) break; res.write(Buffer.from([byte])); }
    res.end();
  });
  try {
    const result = await cli(['runs', 'events', '--run-id', 'run-1'], fixture.env);
    assert.equal(result.code, 0, result.stderr); const lines = result.stdout.trim().split('\n').map(JSON.parse);
    assert.deepEqual(lines.map((r) => r.kind), ['event', 'delta', 'event', 'end']);
    assert.equal(lines[1].data.text, '合成片段'); assert.equal(lines.at(-1).data.lastEventId, 'e-2');
  } finally { await fixture.close(); }
});
test('Last-Event-ID resume suppresses checkpoint replay and does not persist delta cursor', async () => {
  const fixture = await server((req, res) => { res.writeHead(200, { 'content-type': 'text/event-stream' }); res.end(frame(event(1,'run.started')) + frame(event(2,'run.completed'))); });
  try {
    const result = await cli(['runs','events','--input','{"runId":"run-1","after":"e-1"}'],fixture.env);
    assert.equal(result.code,0); assert.equal(fixture.seen[0].headers['last-event-id'],'e-1');
    assert.equal(result.stdout.trim().split('\n').map(JSON.parse).filter((r)=>r.kind==='event').length,1);
  } finally { await fixture.close(); }
});
test('SSE rejects contradictory duplicates, backwards sequence, wrong run and persistent delta IDs', async () => {
  const cases = [frame(event(2,'run.started'))+frame(event(1,'run.completed')),
    frame(event(1,'run.started'))+frame({...event(1,'run.started'),text:'changed'}),
    frame({...event(1,'run.completed'),runId:'other'}),
    'id: illegal\nevent: run.delta\ndata: {"text":"x"}\n\n'];
  for(const payload of cases){
    const fixture=await server((req,res)=>{res.writeHead(200,{'content-type':'text/event-stream'});res.end(payload);});
    try{const result=await cli(['runs','events','--run-id','run-1'],fixture.env);assert.equal(result.code,12);assert.equal(JSON.parse(result.stderr).error.code,'PROTOCOL_ERROR');}
    finally{await fixture.close();}
  }
});
test('nonterminal EOF returns resumable error rather than pretending a run completed', async()=>{
  const fixture=await server((req,res)=>{res.writeHead(200,{'content-type':'text/event-stream'});res.end(frame(event(1,'run.started')));});
  try{const result=await cli(['runs','events','--run-id','run-1'],fixture.env);assert.equal(result.code,12);assert.equal(JSON.parse(result.stderr).error.lastEventId,'e-1');}
  finally{await fixture.close();}
});
test('SIGINT stops following without a remote cancellation and preserves the durable cursor', async()=>{
  const fixture=await server((req,res)=>{res.writeHead(200,{'content-type':'text/event-stream'});res.write(frame(event(1,'run.started')));});
  try{
    const {child,done}=launch(['runs','events','--run-id','run-1'],fixture.env);
    await once(child.stdout,'data');child.kill('SIGINT');const result=await done;
    assert.equal(result.code,130);assert.equal(JSON.parse(result.stderr).error.lastEventId,'e-1');assert.equal(fixture.seen.length,1);
  }finally{await fixture.close();}
});
test('unsupported schema features do not silently pass a partial validator',()=>{
  assert.throws(()=>valid({type:'string',pattern:'.*'},'x'),/unsupported/);
});
