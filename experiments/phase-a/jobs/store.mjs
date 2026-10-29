import { randomUUID } from 'node:crypto';
import pg from 'pg';

export function createPool(connectionString, schema) {
  if (!/^a07_[a-z0-9_]+$/.test(schema)) throw new Error('invalid isolated schema');
  return new pg.Pool({ connectionString, max: 10, options: `-c search_path=${schema},public`,
    connectionTimeoutMillis: 5000, statement_timeout: 5000, idle_in_transaction_session_timeout: 5000 });
}

export class JobStore {
  constructor(pool) { this.pool = pool; }
  async transaction(body) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await body(client);
      await client.query('COMMIT');
      return result;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }

  async create(tenant, key, payload) {
    return this.transaction(async (client) => {
      const inserted = await client.query(`INSERT INTO jobs(id,tenant_id,idempotency_key,payload)
        VALUES($1,$2,$3,$4::jsonb) ON CONFLICT(tenant_id,idempotency_key) DO NOTHING RETURNING *`,
      [randomUUID(), tenant, key, JSON.stringify(payload)]);
      if (inserted.rows.length) return inserted.rows[0];
      const existing = await client.query(`SELECT *, payload=$3::jsonb AS same_payload FROM jobs
        WHERE tenant_id=$1 AND idempotency_key=$2`, [tenant, key, JSON.stringify(payload)]);
      if (!existing.rows[0]?.same_payload) throw new Error('IdempotencyConflict');
      return existing.rows[0];
    });
  }

  async recoverExpired() {
    return this.transaction(async (client) => {
      const expired = await client.query(`SELECT id FROM jobs WHERE status='running'
        AND lease_until<=clock_timestamp() FOR UPDATE SKIP LOCKED`);
      for (const { id } of expired.rows) {
        await client.query(`UPDATE jobs SET status=CASE WHEN cancel_requested THEN 'cancelled'
          WHEN external_pending OR attempt>=3 THEN 'failed' ELSE 'retry_wait' END,
          compensation_required=external_pending,
          lease_token=NULL,lease_until=NULL,error_code=CASE WHEN external_pending
          THEN 'UNCERTAIN_EXTERNAL_WRITE' ELSE 'LEASE_EXPIRED' END,version=version+1 WHERE id=$1`, [id]);
      }
      return expired.rows.length;
    });
  }

  async claim() {
    return this.transaction(async (client) => {
      await client.query(`UPDATE jobs SET status='queued',version=version+1 WHERE status='retry_wait'`);
      const { rows } = await client.query(`SELECT * FROM jobs WHERE status='queued'
        ORDER BY created_at,id LIMIT 1 FOR UPDATE SKIP LOCKED`);
      if (!rows.length) return null;
      const { rows: claimed } = await client.query(`UPDATE jobs SET status='running',attempt=attempt+1,
        lease_token=$2,lease_until=clock_timestamp()+interval '5 seconds',version=version+1
        WHERE id=$1 RETURNING *`, [rows[0].id, randomUUID()]);
      return claimed[0];
    });
  }

  async heartbeat(job) {
    const result = await this.pool.query(`UPDATE jobs SET lease_until=clock_timestamp()+interval '5 seconds',
      version=version+1 WHERE id=$1 AND status='running' AND lease_token=$2
      AND lease_until>clock_timestamp() RETURNING id`, [job.id, job.lease_token]);
    return result.rowCount === 1;
  }

  async beginExternalWrite(job) {
    const result = await this.pool.query(`UPDATE jobs SET external_pending=true,version=version+1
      WHERE id=$1 AND status='running' AND lease_token=$2 AND lease_until>clock_timestamp()
      AND NOT cancel_requested RETURNING id`, [job.id, job.lease_token]);
    return result.rowCount === 1;
  }

  async cancel(id) {
    return this.transaction(async (client) => {
      const job = (await client.query('SELECT * FROM jobs WHERE id=$1 FOR UPDATE', [id])).rows[0];
      if (!job) throw new Error('NotFound');
      if (['succeeded', 'failed'].includes(job.status)) return { conflict: true, status: job.status };
      if (job.status === 'cancelled') return { status: 'cancelled' };
      const status = job.status === 'running' ? 'running' : 'cancelled';
      await client.query(`UPDATE jobs SET cancel_requested=true,status=$2,version=version+1 WHERE id=$1`, [id, status]);
      return { status };
    });
  }

  // Success, effect, fencing and cancellation arbitration share one DB tx.
  // For an uncertain remote write, fail with compensation; never auto-retry it.
  async settle(job, failure = null) {
    return this.transaction(async (client) => {
      const current = (await client.query(`SELECT *,lease_until>clock_timestamp() AS lease_valid
        FROM jobs WHERE id=$1 FOR UPDATE`, [job.id])).rows[0];
      if (!current || current.status !== 'running' || current.lease_token !== job.lease_token || !current.lease_valid) {
        return { stale: true };
      }
      let status = 'succeeded';
      const uncertain = !!failure?.uncertainWrite || (current.external_pending && failure !== null);
      if (current.cancel_requested) status = 'cancelled';
      else if (failure) status = failure.retryable && !uncertain && current.attempt < 3 ? 'retry_wait' : 'failed';
      if (status === 'succeeded') {
        await client.query(`INSERT INTO effects(tenant_id,idempotency_key,job_id,payload)
          VALUES($1,$2,$3,$4) ON CONFLICT(tenant_id,idempotency_key) DO NOTHING`,
        [current.tenant_id, current.idempotency_key, current.id, current.payload]);
      }
      await client.query(`UPDATE jobs SET status=$2,lease_token=NULL,lease_until=NULL,
        error_code=$3,compensation_required=$4,version=version+1 WHERE id=$1`,
      [job.id, status, failure?.code ?? null, uncertain || (current.external_pending && status === 'cancelled')]);
      return { status };
    });
  }
}
