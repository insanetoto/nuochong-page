import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import pg from 'pg';
import { createPool, JobStore } from './store.mjs';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL required: this suite needs a real isolated PostgreSQL');
const schema = `a07_${crypto.randomUUID().replaceAll('-', '')}`;
const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
await admin.query(`CREATE SCHEMA ${schema}`);
const pool = createPool(process.env.DATABASE_URL, schema);
const store = new JobStore(pool);
const results = [];
const job = (key) => store.create('tenant-a', key, { synthetic: key });
const get = async (id) => (await pool.query('SELECT * FROM jobs WHERE id=$1', [id])).rows[0];
async function check(name, body) {
  const start = performance.now();
  try { const details = await body(); results.push({ name, passed: true, ms: performance.now() - start, ...details }); }
  catch (error) { results.push({ name, passed: false, error: error.message }); throw error; }
}
let database;
try {
  await pool.query(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
  database = (await pool.query('SELECT version() AS version')).rows[0].version;
  assert.match(database, /PostgreSQL 17\.11\b/, 'must test the frozen exact PostgreSQL version');

  await check('concurrent duplicate requests and conflicting payload', async () => {
    const duplicates = await Promise.all(Array.from({ length: 10 }, () => job('duplicate')));
    assert.equal(new Set(duplicates.map((r) => r.id)).size, 1);
    await assert.rejects(store.create('tenant-a', 'duplicate', { different: true }), /IdempotencyConflict/);
    const claimed = await store.claim();
    assert.equal((await store.settle(claimed)).status, 'succeeded');
    assert.equal((await store.settle(claimed)).stale, true);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM effects WHERE job_id=$1', [claimed.id])).rows[0].n, 1);
  });

  for (let round = 1; round <= 3; round++) {
    await check(`two independent worker connections compete, round ${round}`, async () => {
      const expected = await job(`competition-${round}`);
      const otherPool = createPool(process.env.DATABASE_URL, schema);
      try {
        const claims = await Promise.all([store.claim(), new JobStore(otherPool).claim()]);
        const winners = claims.filter(Boolean);
        assert.equal(winners.length, 1); assert.equal(winners[0].id, expected.id);
        assert.equal((await store.settle(winners[0])).status, 'succeeded');
      } finally { await otherPool.end(); }
    });
  }

  for (let round = 1; round <= 3; round++) {
    await check(`real worker SIGKILL, lease expiry and fenced recovery, round ${round}`, async () => {
      const expected = await job(`crash-${round}`);
      const child = fork(new URL('./worker.mjs', import.meta.url), [], {
        env: { PATH: process.env.PATH, DATABASE_URL: process.env.DATABASE_URL, JOB_SCHEMA: schema },
        stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
      });
      let claimed;
      try {
        const message = once(child, 'message');
        const exitedEarly = once(child, 'exit').then(() => { throw new Error('worker exited before claim'); });
        let timer;
        try {
          [claimed] = await Promise.race([message, exitedEarly,
            new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('worker claim timeout')), 5000); })]);
        } finally { clearTimeout(timer); }
        assert.equal(claimed.job.id, expected.id);
        const exited = once(child, 'exit'); child.kill('SIGKILL'); await exited;
        const crashAt = performance.now();
        let recovered;
        while (performance.now() - crashAt < 10_000) {
          await store.recoverExpired();
          recovered = await store.claim();
          if (recovered) break;
          await delay(1000); // Frozen one-second recovery checks; real five-second DB lease.
        }
        assert.ok(recovered, 'not recovered within 10 seconds');
        const recoverMs = performance.now() - crashAt;
        assert.equal(recovered.id, expected.id); assert.equal(recovered.attempt, 2);
        assert.notEqual(recovered.lease_token, claimed.job.lease_token);
        assert.equal(await store.heartbeat(claimed.job), false);
        assert.equal((await store.settle(claimed.job)).stale, true);
        assert.equal((await store.settle(recovered)).status, 'succeeded');
        assert.equal((await get(expected.id)).status, 'succeeded');
        return { recoverMs, leaseMs: 5000, checkMs: 1000 };
      } finally { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); }
    });
  }

  await check('heartbeat renews only live fenced lease; expired owner cannot settle', async () => {
    await job('heartbeat'); const current = await store.claim();
    const before = new Date(current.lease_until).getTime();
    await delay(30); assert.equal(await store.heartbeat(current), true);
    assert.ok(new Date((await get(current.id)).lease_until).getTime() > before);
    // Explicit DB fault injection; this is not one of the measured crash rounds.
    await pool.query("UPDATE jobs SET lease_until=clock_timestamp()-interval '1 second' WHERE id=$1", [current.id]);
    assert.equal(await store.heartbeat(current), false);
    assert.equal((await store.settle(current)).stale, true);
    await store.recoverExpired(); const recovered = await store.claim(); await store.settle(recovered);
  });

  await check('transient failures retry at most twice; auth failure never retries', async () => {
    const expected = await job('retry');
    for (let attempt = 1; attempt <= 3; attempt++) {
      const current = await store.claim(); assert.equal(current.id, expected.id); assert.equal(current.attempt, attempt);
      assert.equal((await store.settle(current, { code: 'TRANSIENT', retryable: true })).status,
        attempt < 3 ? 'retry_wait' : 'failed');
    }
    assert.equal(await store.claim(), null);
    await job('auth'); const current = await store.claim();
    assert.equal((await store.settle(current, { code: 'AUTH', retryable: false })).status, 'failed');
    assert.equal((await get(current.id)).attempt, 1); assert.equal(await store.claim(), null);
  });

  await check('uncertain external intent survives lost lease and requires compensation', async () => {
    await job('external-intent'); const current = await store.claim();
    assert.equal(await store.beginExternalWrite(current), true);
    await pool.query("UPDATE jobs SET lease_until=clock_timestamp()-interval '1 second' WHERE id=$1", [current.id]);
    await store.recoverExpired();
    const record = await get(current.id);
    assert.equal(record.status, 'failed'); assert.equal(record.compensation_required, true);
    assert.equal(record.error_code, 'UNCERTAIN_EXTERNAL_WRITE'); assert.equal(await store.claim(), null);
    await job('external-error'); const second = await store.claim();
    assert.equal((await store.settle(second, { code: 'UNCERTAIN_EXTERNAL_WRITE', retryable: true, uncertainWrite: true })).status, 'failed');
    assert.equal((await get(second.id)).compensation_required, true); assert.equal(await store.claim(), null);
    await job('external-pending-error'); const third = await store.claim();
    assert.equal(await store.beginExternalWrite(third), true);
    assert.equal((await store.settle(third, { code: 'CONNECTION_LOST', retryable: true })).status, 'failed');
    assert.equal((await get(third.id)).compensation_required, true); assert.equal(await store.claim(), null);
  });

  await check('queued cancellation is idempotent and has no effect', async () => {
    const record = await job('cancel-queued');
    assert.equal((await store.cancel(record.id)).status, 'cancelled');
    assert.equal((await store.cancel(record.id)).status, 'cancelled'); assert.equal(await store.claim(), null);
  });
  for (let round = 1; round <= 3; round++) {
    await check(`cancel/complete transaction arbitration, round ${round}`, async () => {
      await job(`cancel-race-${round}`); const current = await store.claim();
      const start = performance.now();
      await Promise.all([store.cancel(current.id), store.settle(current)]);
      assert.ok(performance.now() - start < 1000);
      const final = await get(current.id);
      assert.ok(['succeeded', 'cancelled'].includes(final.status));
      assert.equal((await store.settle(current)).stale, true);
      const effectCount = (await pool.query('SELECT count(*)::int AS n FROM effects WHERE job_id=$1', [current.id])).rows[0].n;
      assert.equal(effectCount, final.status === 'succeeded' ? 1 : 0);
      return { terminal: final.status, effectCount };
    });
  }
  await check('all tasks terminal, exactly one terminal history per task, no duplicate business effects', async () => {
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM jobs WHERE status NOT IN ('succeeded','failed','cancelled')")).rows[0].n, 0);
    const invalid = await pool.query(`SELECT j.id FROM jobs j LEFT JOIN status_history h ON j.id=h.job_id
      AND h.status IN ('succeeded','failed','cancelled') GROUP BY j.id HAVING count(h.job_id)<>1`);
    assert.equal(invalid.rows.length, 0);
    const records = (await pool.query('SELECT count(*)::int AS n FROM jobs')).rows[0].n;
    return { terminalTasks: records };
  });
} finally {
  mkdirSync(new URL('./outputs/', import.meta.url), { recursive: true });
  const report = { time: new Date().toISOString(), node: process.version, platform: `${process.platform}-${process.arch}`,
    database, resources: { cpus: os.cpus().length, totalMemoryBytes: os.totalmem(), os: os.release() },
    scope: 'Real isolated PostgreSQL, two independent pools and three SIGKILL worker processes; synthetic executor and same-DB receiver', results };
  writeFileSync(new URL('./outputs/jobs-probe.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  await pool.end();
  await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end();
}
