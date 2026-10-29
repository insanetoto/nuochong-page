import { verify, randomUUID } from 'node:crypto';

export class PolicyError extends Error {
  constructor(code) { super(code); this.code = code; }
}
const deny = (code = 'Forbidden') => { throw new PolicyError(code); };
export const FIXTURE_ISSUER = 'https://synthetic-issuer.invalid';
export const FIXTURE_AUDIENCE = 'nuochong-prototype';

// Synthetic signed-issuer verifier, NOT a complete OIDC login/client library.
// Pinned key/alg/issuer/audience; no client-controlled jku/jwks URL lookup.
export class Boundary {
  #issued = new WeakSet();
  #approvals = new Map();
  constructor(publicKey, now = () => Date.now()) {
    this.publicKey = publicKey;
    this.now = now;
    this.members = new Map([
      ['a1', { tenantId: 'tenant-a', role: 'member' }], ['a2', { tenantId: 'tenant-a', role: 'admin' }],
      ['b1', { tenantId: 'tenant-b', role: 'member' }], ['b2', { tenantId: 'tenant-b', role: 'admin' }],
    ]);
    this.documents = new Map(); this.sessions = new Map(); this.runs = new Map();
    for (const tenant of ['a', 'b']) {
      for (const index of [1, 2]) this.documents.set(`${tenant}-doc-${index}`, {
        tenantId: `tenant-${tenant}`, name: 'same-name.txt', text: `TENANT_${tenant.toUpperCase()}_PRIVATE_${index}`,
      });
      for (const user of [`${tenant}1`, `${tenant}2`]) {
        this.sessions.set(`${user}-session`, { tenantId: `tenant-${tenant}`, userId: user });
        this.runs.set(`${user}-run`, { tenantId: `tenant-${tenant}`, userId: user });
      }
    }
    this.audit = []; this.effects = [];
  }
  log(actor, action, result) {
    this.audit.push({ requestId: actor?.requestId ?? randomUUID(), action, result });
  }
  authenticate(token) {
    try {
      if (typeof token !== 'string' || token.length > 8192) deny('Unauthorized');
      const parts = token.split('.');
      if (parts.length !== 3 || parts.some((p) => !/^[A-Za-z0-9_-]+$/.test(p))) deny('Unauthorized');
      const [header, claims] = parts.slice(0, 2).map((p) => JSON.parse(Buffer.from(p, 'base64url').toString('utf8')));
      if (header.alg !== 'RS256' || header.typ !== 'JWT' || header.kid !== 'fixture-key'
        || Object.keys(header).some((k) => !['alg', 'typ', 'kid'].includes(k))) deny('Unauthorized');
      if (!verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), this.publicKey, Buffer.from(parts[2], 'base64url'))) deny('Unauthorized');
      const now = Math.floor(this.now() / 1000);
      if (claims.iss !== FIXTURE_ISSUER || claims.aud !== FIXTURE_AUDIENCE || typeof claims.sub !== 'string'
        || !Number.isSafeInteger(claims.exp) || claims.exp <= now
        || !Number.isSafeInteger(claims.iat) || claims.iat > now
        || (claims.nbf !== undefined && (!Number.isSafeInteger(claims.nbf) || claims.nbf > now))) deny('Unauthorized');
      const member = this.members.get(claims.sub);
      if (!member) deny('Unauthorized');
      // Ignore model/client/token tenant/role overrides. Membership is server-owned.
      const actor = Object.freeze({ userId: claims.sub, tenantId: member.tenantId, requestId: randomUUID() });
      this.#issued.add(actor); this.log(actor, 'authenticate', 'allow'); return actor;
    } catch { this.log(null, 'authenticate', 'deny'); deny('Unauthorized'); }
  }
  current(actor) {
    if (!actor || !this.#issued.has(actor)) deny();
    const member = this.members.get(actor.userId);
    if (!member || member.tenantId !== actor.tenantId) deny();
    return member;
  }
  read(actor, kind, id) {
    try {
      this.current(actor);
      const map = { document: this.documents, session: this.sessions, run: this.runs }[kind];
      const resource = map?.get(id);
      if (!resource || resource.tenantId !== actor.tenantId || (kind !== 'document' && resource.userId !== actor.userId)) deny('NotFound');
      this.log(actor, `read-${kind}`, 'allow'); return resource;
    } catch (error) { this.log(actor, 'read-resource', 'deny'); throw error; }
  }
  createRun(actor, input) {
    this.current(actor);
    if (!input || typeof input !== 'object' || Object.keys(input).some((k) => !['prompt', 'idempotencyKey'].includes(k))
      || typeof input.prompt !== 'string' || typeof input.idempotencyKey !== 'string') deny('InvalidInput');
    const id = randomUUID(); this.runs.set(id, { tenantId: actor.tenantId, userId: actor.userId }); return id;
  }
  download(actor, documentId) {
    return Buffer.from(this.read(actor, 'document', documentId).text, 'utf8');
  }
  issueApproval(admin, requesterId, runId, documentId) {
    try {
      if (this.current(admin).role !== 'admin') deny();
      const requester = this.members.get(requesterId); const run = this.runs.get(runId);
      const doc = this.documents.get(documentId);
      if (!requester || requester.tenantId !== admin.tenantId || !run || run.userId !== requesterId
        || run.tenantId !== admin.tenantId || doc?.tenantId !== admin.tenantId) deny();
      const id = randomUUID();
      this.#approvals.set(id, { tenantId: admin.tenantId, userId: requesterId, runId, documentId,
        approverId: admin.userId, expires: this.now() + 30_000, used: false });
      this.log(admin, 'approve-write', 'allow'); return id;
    } catch (error) { this.log(admin, 'approve-write', 'deny'); throw error; }
  }
  validateCall(actor, runId, name, args) {
    this.current(actor); this.read(actor, 'run', runId);
    if (!['read_document', 'write_fixture'].includes(name)) deny();
    const allowed = name === 'read_document' ? ['documentId'] : ['documentId', 'approvalId'];
    if (!args || typeof args !== 'object' || Array.isArray(args)
      || Object.keys(args).some((k) => !allowed.includes(k)) || typeof args.documentId !== 'string') deny('InvalidInput');
    this.read(actor, 'document', args.documentId);
    if (name === 'write_fixture') {
      const approval = this.#approvals.get(args.approvalId);
      if (!approval || approval.used || approval.expires <= this.now() || approval.tenantId !== actor.tenantId
        || approval.userId !== actor.userId || approval.runId !== runId || approval.documentId !== args.documentId
        || this.members.get(approval.approverId)?.tenantId !== actor.tenantId
        || this.members.get(approval.approverId)?.role !== 'admin') deny();
    }
  }
  commitWrite(actor, runId, args) {
    this.validateCall(actor, runId, 'write_fixture', args);
    // Synchronous check+consume+synthetic write in this fixture. Production needs
    // transactional persistent approval consumption and business idempotency.
    this.#approvals.get(args.approvalId).used = true;
    this.effects.push({ tenantId: actor.tenantId, userId: actor.userId, documentId: args.documentId });
    this.log(actor, 'write-fixture', 'allow'); return 'synthetic write accepted';
  }
  validateUpload(bytes, mime) {
    if (!(bytes instanceof Uint8Array) || bytes.byteLength > 10 * 1024 * 1024 || mime !== 'text/plain') deny('InvalidUpload');
    try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
    catch { deny('InvalidUpload'); }
  }
}
