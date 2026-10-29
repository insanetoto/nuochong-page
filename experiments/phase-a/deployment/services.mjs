import Fastify from 'fastify';
import { createPublicKey, timingSafeEqual } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { once } from 'node:events';
import { resolve } from 'node:path';
import { createPool, JobStore } from '../jobs/store.mjs';
import { Boundary } from '../isolation/security.mjs';
import { bootHarness } from '../runtime/host-bootstrap.mjs';

const role = process.argv[2];
const manifest = new URL('../release.json', import.meta.url);
const release = existsSync(manifest) ? JSON.parse(readFileSync(manifest)).release : 'local-probe';
const pool = createPool(process.env.DATABASE_URL, process.env.JOB_SCHEMA ?? 'a07_deployment');
const store = new JobStore(pool);
const hostURL = process.env.HOST_URL ?? 'http://127.0.0.1:3002';
const secret = process.env.PROBE_SERVICE_SECRET;
if (!secret) throw new Error('isolated service credential required');
const serviceHeaders = { authorization: `Bearer ${secret}`, 'content-type': 'application/json' };
const log = (event, data = {}) => console.log(JSON.stringify({ role, release, event, ...data }));
let stopping = false;
let currentExecution;
async function hostReady() {
  try { return (await fetch(`${hostURL}/health`, { signal: AbortSignal.timeout(1000) })).ok; }
  catch { return false; }
}
function requireService(request, reply) {
  const candidate = Buffer.from(request.headers.authorization ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  if (candidate.length !== expected.length || !timingSafeEqual(candidate, expected)) return reply.code(403).send({ code: 'FORBIDDEN' });
}
async function runWorker() {
  log('ready');
  while (!stopping) {
    if (!await hostReady()) { await delay(250); continue; }
    await store.recoverExpired();
    const job = await store.claim();
    if (!job) { await delay(100); continue; }
    const controller = new AbortController();
    currentExecution = controller;
    const timer = setTimeout(() => controller.abort(), 180_000);
    const heartbeat = setInterval(() => {
      store.heartbeat(job).then((ok) => { if (!ok) controller.abort(); }, () => controller.abort());
    }, 1000);
    try {
      const response = await fetch(`${hostURL}/execute`, { method: 'POST', headers: serviceHeaders,
        body: JSON.stringify({ jobId: job.id, leaseToken: job.lease_token }), signal: controller.signal });
      if (!response.ok) throw new Error('HOST_UNAVAILABLE');
      const result = await response.json();
      if (result.code !== 'SYNTHETIC_COMPLETED') throw new Error('HOST_FAILED');
      const outcome = await store.settle(job); log('settled', { jobId: job.id, requestId: job.payload.requestId, status: outcome.status ?? 'stale' });
    } catch {
      await store.settle(job, { code: 'HOST_UNAVAILABLE', retryable: true });
      log('host-fault', { jobId: job.id });
    } finally { clearTimeout(timer); clearInterval(heartbeat); currentExecution = undefined; }
  }
}

let app;
let harness;
let workerDone;
process.on('SIGTERM', () => { stop().catch(() => process.exit(1)); });
if (role === 'worker') { workerDone = runWorker(); await workerDone; }
else {
  app = Fastify({ logger: false, genReqId: () => crypto.randomUUID(), bodyLimit: 10 * 1024 * 1024 + 1024 });
  app.setErrorHandler((error, request, reply) => {
    log('request-error', { requestId: request.id });
    reply.code(error.statusCode && error.statusCode < 500 ? error.statusCode : 500)
      .send({ code: error.validation ? 'INVALID_INPUT' : 'REQUEST_FAILED', requestId: request.id });
  });
  if (role === 'host') {
    harness = await bootHarness(process.env.STATE_ROOT ?? resolve('/tmp', `nuochong-a09-${process.pid}`));
    let active = 0;
    let streamConnections = 0;
    app.get('/health', async () => ({ role, release, node: process.version, fastify: app.version,
      harnessInitialized: true, active, streamConnections }));
    app.addHook('preHandler', async (request, reply) => {
      if (request.url !== '/health') return requireService(request, reply);
    });
    async function withSlot(reply, body) {
      if (active >= 2) return reply.code(429).send({ code: 'HOST_CONCURRENCY_LIMIT' });
      active++;
      try { return await body(); } finally { active--; }
    }
    app.post('/execute', async (request, reply) => withSlot(reply, async () => {
      const { jobId, leaseToken } = request.body ?? {};
      const job = (await pool.query(`SELECT * FROM jobs WHERE id=$1 AND lease_token=$2
        AND status='running' AND lease_until>clock_timestamp()`, [jobId, leaseToken])).rows[0];
      if (!job) return reply.code(409).send({ code: 'STALE_LEASE' });
      log('execute', { jobId, requestId: job.payload.requestId });
      await delay(job.payload.prompt === 'slow-fixture' ? 3000 : 100);
      return { code: 'SYNTHETIC_COMPLETED' };
    }));
    app.post('/probe/call', async (request, reply) => withSlot(reply, async () => {
      if (request.body?.quota) {
        const quota = await pool.query(`INSERT INTO a09_quota(scope,calls) VALUES('fixture',1)
          ON CONFLICT(scope) DO UPDATE SET calls=a09_quota.calls+1 WHERE a09_quota.calls<2 RETURNING calls`);
        if (!quota.rowCount) return reply.code(429).send({ code: 'SYNTHETIC_CALL_QUOTA' });
      }
      await delay(500); return { code: 'SYNTHETIC_COMPLETED' };
    }));
    app.get('/probe/stream', async (request, reply) => {
      streamConnections++;
      reply.hijack(); reply.raw.writeHead(200, { 'content-type': 'text/event-stream', 'x-accel-buffering': 'no' });
      try {
        for (let i = 0; i < 3 && !reply.raw.destroyed; i++) {
          reply.raw.write(`event: run.delta\ndata: ${JSON.stringify({ text: `synthetic-${i}` })}\n\n`);
          await delay(200);
        }
      } finally { streamConnections--; reply.raw.end(); }
    });
  } else if (role === 'api') {
    const boundary = new Boundary(createPublicKey(Buffer.from(process.env.JWT_PUBLIC_KEY, 'base64').toString()));
    app.decorateRequest('actor', null);
    app.addHook('preHandler', async (request, reply) => {
      if (request.url === '/health') return;
      try { request.actor = boundary.authenticate((request.headers.authorization ?? '').replace(/^Bearer /, '')); }
      catch { return reply.code(401).send({ code: 'UNAUTHORIZED', requestId: request.id }); }
    });
    app.get('/health', async () => ({ role, release, node: process.version, fastify: app.version }));
    app.post('/api/ai/runs', { schema: { body: { type: 'object', additionalProperties: false,
      required: ['prompt', 'idempotencyKey'], properties: { prompt: { type: 'string', maxLength: 1000 },
        idempotencyKey: { type: 'string', minLength: 1, maxLength: 100 } } } } }, async (request, reply) => {
      if (!await hostReady()) return reply.code(503).send({ code: 'AI_UNAVAILABLE', requestId: request.id });
      const actor = request.actor;
      // Cross-process admission must use a DB lock, not an in-memory counter.
      const job = await store.transaction(async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(9009)');
        const existing = await client.query('SELECT * FROM jobs WHERE tenant_id=$1 AND idempotency_key=$2',
          [actor.tenantId, request.body.idempotencyKey]);
        if (existing.rows.length) return existing.rows[0];
        const count = (await client.query(`SELECT count(*)::int AS n FROM jobs
          WHERE status IN ('queued','running','retry_wait')`)).rows[0].n;
        if (count >= 5) return null;
        const created = await client.query(`INSERT INTO jobs(id,tenant_id,idempotency_key,payload)
          VALUES($1,$2,$3,$4) RETURNING *`, [crypto.randomUUID(), actor.tenantId, request.body.idempotencyKey,
          { prompt: request.body.prompt, userId: actor.userId, requestId: request.id }]);
        return created.rows[0];
      });
      if (!job) return reply.code(429).send({ code: 'ADMISSION_LIMIT', requestId: request.id });
      if (job.payload.userId !== actor.userId) return reply.code(404).send({ code: 'NOT_FOUND' });
      if (job.payload.prompt !== request.body.prompt) return reply.code(409).send({ code: 'IDEMPOTENCY_CONFLICT' });
      log('accepted', { jobId: job.id, requestId: job.payload.requestId });
      return reply.code(202).send({ runId: job.id, requestId: job.payload.requestId });
    });
    app.get('/api/ai/runs/:id', async (request, reply) => {
      const job = (await pool.query('SELECT * FROM jobs WHERE id=$1 AND tenant_id=$2',
        [request.params.id, request.actor.tenantId])).rows[0];
      if (!job || job.payload.userId !== request.actor.userId) return reply.code(404).send({ code: 'NOT_FOUND' });
      return { runId: job.id, status: job.status, attempt: job.attempt, requestId: request.id };
    });
    app.get('/api/probe/stream', async (request, reply) => {
      const controller = new AbortController();
      let upstream;
      try { upstream = await fetch(`${hostURL}/probe/stream`, { headers: serviceHeaders,
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]) }); }
      catch { return reply.code(503).send({ code: 'AI_UNAVAILABLE', requestId: request.id }); }
      if (!upstream.ok) return reply.code(503).send({ code: 'AI_UNAVAILABLE' });
      reply.hijack(); reply.raw.writeHead(200, { 'content-type': 'text/event-stream', 'x-accel-buffering': 'no' });
      reply.raw.on('close', () => controller.abort());
      try {
        for await (const bytes of upstream.body) {
          if (!reply.raw.write(bytes)) await once(reply.raw, 'drain', { signal: controller.signal });
        }
      } catch {
        if (!reply.raw.destroyed) reply.raw.write('event: error\ndata: {"code":"AI_UNAVAILABLE"}\n\n');
      } finally { reply.raw.end(); }
    });
  } else throw new Error('unknown role');
  await app.listen({ port: Number(process.env.PORT ?? (role === 'api' ? 3001 : 3002)), host: '0.0.0.0' });
  log('ready');
}
async function stop() {
  stopping = true; currentExecution?.abort(); await workerDone;
  await app?.close(); await harness?.close(); await pool.end(); process.exit(0);
}
