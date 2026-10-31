import pg from 'pg';
import {createHash} from 'node:crypto';
import { readFileSync } from 'node:fs';
export function poolFor(url, schema = 'oa_control') {
  if (!url || !/^oa_[a-z0-9_]{1,48}$/.test(schema)) throw new Error('Database URL and valid OA schema are required.');
  const pool = new pg.Pool({ connectionString: url, max: 10, connectionTimeoutMillis: 5000,
    options: `-c search_path=${schema},pg_catalog`, statement_timeout: 5000, idle_in_transaction_session_timeout: 5000 });
  pool.oaSchema = schema;
  return pool;
}
export async function transaction(pool, body) {
  const db = await pool.connect();
  try { await db.query('BEGIN'); const value = await body(db); await db.query('COMMIT'); return value; }
  catch (error) { await db.query('ROLLBACK'); throw error; } finally { db.release(); }
}
export async function migrate(pool, schema = 'oa_control') {
  if (!/^oa_[a-z0-9_]{1,48}$/.test(schema)) throw new Error('Invalid schema.');
  await transaction(pool, async (db) => {
    await db.query("SELECT pg_advisory_xact_lock(hashtext('nuochong-oa-migration-' || $1))", [schema]);
    await db.query(`CREATE SCHEMA IF NOT EXISTS ${schema}`);
    const source=readFileSync(new URL('./schema.sql', import.meta.url),'utf8');
    const digest=createHash('sha256').update(source).digest('hex');
    await db.query('CREATE TABLE IF NOT EXISTS schema_versions(version integer PRIMARY KEY,sha256 text NOT NULL)');
    const old=(await db.query('SELECT sha256 FROM schema_versions WHERE version=1')).rows[0];
    if(old && old.sha256!==digest)throw new Error('Migration checksum changed; add an explicit versioned migration.');
    if(!old){await db.query(source);await db.query('INSERT INTO schema_versions(version,sha256) VALUES(1,$1)',[digest]);}
  });
}
