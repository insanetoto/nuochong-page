import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { transaction } from './db.mjs';
import { ApiError, requireThat } from './errors.mjs';
export const SCOPES = ['runs:write', 'runs:read', 'sessions:write', 'sessions:read', 'config:read', 'config:write', 'auth:manage'];
export const MEMBER_SCOPES = SCOPES.filter((scope) => !['config:write','auth:manage'].includes(scope));
const hash = (value) => createHash('sha256').update(value).digest('hex');
export const principalDTO = (row) => ({ principalId: row.id, name: row.name, kind: row.kind, role: row.role, active: row.active });
export const credentialDTO = (row) => ({ credentialId: row.id, principalId: row.principal_id, scopes: row.scopes, expiresAt: row.expires_at.toISOString(), revoked: row.revoked });
export class Identity {
  constructor(pool) { this.pool = pool; }
  async authenticate(token) {
    requireThat(typeof token === 'string' && /^oa_[A-Za-z0-9_-]{43}$/.test(token), 401, 'UNAUTHORIZED');
    const { rows } = await this.pool.query(`SELECT c.id AS credential_id,c.scopes,c.expires_at,p.* FROM credentials c JOIN principals p ON p.id=c.principal_id
      WHERE c.token_hash=$1 AND NOT c.revoked AND c.expires_at>clock_timestamp() AND p.active AND c.principal_epoch=p.epoch`, [hash(token)]);
    requireThat(rows[0], 401, 'UNAUTHORIZED'); return Object.freeze(rows[0]);
  }
  async stillValid(credentialId) {
    return !!(await this.pool.query(`SELECT 1 FROM credentials c JOIN principals p ON p.id=c.principal_id WHERE c.id=$1
      AND NOT c.revoked AND c.expires_at>clock_timestamp() AND p.active AND c.principal_epoch=p.epoch`, [credentialId])).rowCount;
  }
  require(actor, scope, admin = false) {
    requireThat(actor.scopes.includes(scope) && (!admin || (actor.kind === 'user' && actor.role === 'admin')));
  }
  async issue(db, principal, scopes, expiresAt) {
    const token = 'oa_' + randomBytes(32).toString('base64url');
    const { rows } = await db.query(`INSERT INTO credentials(id,principal_id,token_hash,principal_epoch,scopes,expires_at)
      VALUES($1,$2,$3,$4,$5,$6) RETURNING *`, [randomUUID(), principal.id, hash(token), principal.epoch, scopes, expiresAt]);
    return { ...credentialDTO(rows[0]), token };
  }
  async bootstrap(name) {
    return transaction(this.pool, async (db) => {
      await db.query("SELECT pg_advisory_xact_lock(hashtext('oa-bootstrap'))");
      requireThat(!(await db.query('SELECT 1 FROM principals LIMIT 1')).rowCount, 409, 'ALREADY_INITIALIZED');
      const principal = (await db.query("INSERT INTO principals(id,name,kind,role) VALUES($1,$2,'user','admin') RETURNING *", [randomUUID(),name])).rows[0];
      return this.issue(db, principal, SCOPES, new Date(Date.now()+86400000));
    });
  }
  async createPrincipal(actor, input) {
    this.require(actor,'auth:manage',true);
    requireThat(input.kind !== 'service' || input.role === 'member',400,'INVALID_INPUT');
    const { rows } = await this.pool.query('INSERT INTO principals(id,name,kind,role) VALUES($1,$2,$3,$4) RETURNING *', [randomUUID(), input.name, input.kind,input.role]);
    return principalDTO(rows[0]);
  }
  async changePrincipal(actor, input) {
    this.require(actor,'auth:manage',true);
    return transaction(this.pool, async (db) => {
      await db.query("SELECT pg_advisory_xact_lock(hashtext('oa-admin-change'))");
      const principal = (await db.query('SELECT * FROM principals WHERE id=$1 FOR UPDATE',[input.principalId])).rows[0];
      requireThat(principal,404,'NOT_FOUND');
      if (principal.role==='admin' && !input.active) requireThat((await db.query("SELECT 1 FROM principals WHERE active AND role='admin' AND id<>$1",[principal.id])).rowCount,409,'LAST_ADMIN');
      const row=(await db.query('UPDATE principals SET active=$2,epoch=epoch+1 WHERE id=$1 RETURNING *',[principal.id,input.active])).rows[0];
      return principalDTO(row);
    });
  }
  async createCredential(actor,input) {
    this.require(actor,'auth:manage',true);
    return transaction(this.pool,async(db)=>{
      const p=(await db.query('SELECT * FROM principals WHERE id=$1 FOR UPDATE',[input.principalId])).rows[0];
      requireThat(p?.active,404,'NOT_FOUND');
      requireThat(input.scopes.every((s)=>SCOPES.includes(s)) && (p.role==='admin' || input.scopes.every((s)=>MEMBER_SCOPES.includes(s))),400,'INVALID_INPUT');
      const expiry=Date.parse(input.expiresAt); requireThat(Number.isFinite(expiry)&&expiry>Date.now()&&expiry<=Date.now()+30*86400000,400,'INVALID_INPUT');
      return this.issue(db,p,[...new Set(input.scopes)],new Date(expiry));
    });
  }
  async revoke(actor,input) {
    this.require(actor,'auth:manage',true);
    const row=(await this.pool.query('UPDATE credentials SET revoked=true WHERE id=$1 RETURNING *',[input.credentialId])).rows[0];
    requireThat(row,404,'NOT_FOUND');return credentialDTO(row);
  }
}
