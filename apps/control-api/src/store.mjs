import { randomUUID } from 'node:crypto';
import { transaction } from './db.mjs';
import { requireThat } from './errors.mjs';
import { HISTORY_PAGE_SIZE } from '../../../tools/nuochong-cli/src/core-commands.mjs';
export const runDTO = (row) => ({ runId:row.id, actorId:row.owner_id, sessionId:row.session_id, status:row.status,
  idempotencyKey:row.idempotency_key, version:row.version, cancelRequested:row.cancel_requested, ...(row.error_code && {errorCode:row.error_code}) });
export const sessionDTO = (row) => ({sessionId:row.id,name:row.name,createdAt:row.created_at.toISOString()});
export const eventDTO = (row) => ({eventId:`${row.run_id}:${row.sequence}`,runId:row.run_id,sequence:row.sequence,type:row.type,time:row.time.toISOString(),...(row.text!==null&&{text:row.text})});
export class Store {
  constructor(pool) {this.pool=pool;}
  async event(db,id,type,text=null) {
    const run=(await db.query('UPDATE runs SET event_seq=event_seq+1,version=version+1 WHERE id=$1 RETURNING event_seq',[id])).rows[0];
    await db.query('INSERT INTO events(run_id,sequence,type,text) VALUES($1,$2,$3,$4)',[id,run.event_seq,type,text]);
  }
  async ownedSession(actor,id,db=this.pool) {
    const row=(await db.query('SELECT * FROM sessions WHERE id=$1 AND owner_id=$2',[id,actor.id])).rows[0];
    requireThat(row,404,'NOT_FOUND'); return row;
  }
  async ownedRun(actor,id,db=this.pool) {
    const row=(await db.query('SELECT * FROM runs WHERE id=$1 AND owner_id=$2',[id,actor.id])).rows[0];
    requireThat(row,404,'NOT_FOUND');return row;
  }
  async createSession(actor,input) {
    return sessionDTO((await this.pool.query('INSERT INTO sessions(id,owner_id,name) VALUES($1,$2,$3) RETURNING *',[randomUUID(),actor.id,input.name])).rows[0]);
  }
  async listSessions(actor,input={}) {
    if(input.after)await this.ownedSession(actor,input.after);
    const rows=(await this.pool.query('SELECT * FROM sessions WHERE owner_id=$1 AND ($2::text IS NULL OR (created_at,id)<(SELECT created_at,id FROM sessions WHERE id=$2)) ORDER BY created_at DESC,id DESC LIMIT 101',[actor.id,input.after??null])).rows;
    return {items:rows.slice(0,100).map(sessionDTO),...(rows.length>100&&{nextCursor:rows[99].id})};
  }
  async history(actor,input) {
    await this.ownedSession(actor,input.sessionId);
    let cursor;
    if(input.after){cursor=await this.ownedRun(actor,input.after);requireThat(cursor.session_id===input.sessionId,400,'INVALID_CURSOR');}
    const rows=(await this.pool.query(`SELECT * FROM runs WHERE owner_id=$1 AND session_id=$2
      AND ($3::text IS NULL OR (created_at,id)>(SELECT created_at,id FROM runs WHERE id=$3)) ORDER BY created_at,id LIMIT $4`,[actor.id,input.sessionId,input.after??null,HISTORY_PAGE_SIZE+1])).rows;
    const page=rows.slice(0,HISTORY_PAGE_SIZE);
    return {items:page.map(r=>({runId:r.id,status:r.status,prompt:r.prompt,...(r.output!==null&&{response:r.output})})),...(rows.length>HISTORY_PAGE_SIZE&&{nextCursor:page.at(-1).id})};
  }
  async createRun(actor,input) {
    return transaction(this.pool,async(db)=>{
      await db.query('SELECT id FROM principals WHERE id=$1 FOR UPDATE',[actor.id]);
      const old=(await db.query('SELECT * FROM runs WHERE owner_id=$1 AND idempotency_key=$2',[actor.id,input.idempotencyKey])).rows[0];
      if(old){requireThat(old.prompt===input.prompt&&(!input.sessionId||old.session_id===input.sessionId),409,'CONFLICT');return {runId:old.id};}
      let sessionId=input.sessionId;
      if(sessionId) await this.ownedSession(actor,sessionId,db);
      else {sessionId=randomUUID();await db.query('INSERT INTO sessions(id,owner_id,name) VALUES($1,$2,$3)',[sessionId,actor.id,'New session']);}
      const config=(await db.query('SELECT model,clock_tool AS "clockTool",version FROM runtime_config WHERE id=1')).rows[0];
      const id=randomUUID();await db.query(`INSERT INTO runs(id,owner_id,credential_id,session_id,idempotency_key,prompt,config)
        VALUES($1,$2,$3,$4,$5,$6,$7)`,[id,actor.id,actor.credential_id,sessionId,input.idempotencyKey,input.prompt,config]);
      await this.event(db,id,'run.created');return {runId:id};
    });
  }
  async cancel(actor,id) {
    return transaction(this.pool,async(db)=>{
      const run=(await db.query('SELECT * FROM runs WHERE id=$1 AND owner_id=$2 FOR UPDATE',[id,actor.id])).rows[0];requireThat(run,404,'NOT_FOUND');
      requireThat(!['succeeded','failed'].includes(run.status),409,'CONFLICT');
      if(run.status==='cancelled'&&!run.cancel_requested)await db.query('UPDATE runs SET cancel_requested=true,version=version+1 WHERE id=$1',[id]);
      if(run.status!=='cancelled'){
        const immediate=run.status!=='running';
        await db.query('UPDATE runs SET cancel_requested=true,status=$2,version=version+1 WHERE id=$1',[id,immediate?'cancelled':'running']);
        if(immediate)await this.event(db,id,'run.cancelled');
      }
      return {runId:id,cancelRequested:true};
    });
  }
  async replay(actor,id,after) {
    await this.ownedRun(actor,id);
    let sequence=0;
    if(after){requireThat(after.startsWith(id+':')&&/^\d+$/.test(after.slice(id.length+1)),400,'INVALID_CURSOR');sequence=Number(after.slice(id.length+1));
      requireThat(Number.isSafeInteger(sequence)&&(await this.pool.query('SELECT 1 FROM events WHERE run_id=$1 AND sequence=$2',[id,sequence])).rowCount,400,'INVALID_CURSOR');}
    return (await this.pool.query('SELECT * FROM events WHERE run_id=$1 AND sequence>$2 ORDER BY sequence LIMIT 100',[id,sequence])).rows.map(eventDTO);
  }
  async recoverExpired() {
    return transaction(this.pool,async(db)=>{
      const {rows}=await db.query("SELECT * FROM runs WHERE status='running' AND lease_until<=clock_timestamp() FOR UPDATE SKIP LOCKED");
      for(const run of rows){
        const status=run.cancel_requested?'cancelled':run.dispatched||run.attempt>=3?'failed':'retry_wait';
        await db.query('UPDATE runs SET status=$2,lease_token=NULL,lease_until=NULL,error_code=$3,version=version+1 WHERE id=$1',[run.id,status,status==='failed'?'unavailable':null]);
        if(status!=='retry_wait')await this.event(db,run.id,status==='cancelled'?'run.cancelled':'run.failed');
      }return rows.length;
    });
  }
  async claim(leaseMs=5000) {
    return transaction(this.pool,async(db)=>{
      await db.query("UPDATE runs SET status='queued',version=version+1 WHERE status='retry_wait'");
      const run=(await db.query(`SELECT r.*,s.native_started FROM runs r JOIN sessions s ON s.id=r.session_id
        WHERE r.status='queued' AND NOT EXISTS(SELECT 1 FROM runs other WHERE other.session_id=r.session_id AND other.status='running')
        ORDER BY r.created_at,r.id LIMIT 1 FOR UPDATE OF r,s SKIP LOCKED`)).rows[0];
      if(!run)return null;
      const token=randomUUID();const row=(await db.query(`UPDATE runs SET status='running',attempt=attempt+1,lease_token=$2,
        lease_until=clock_timestamp()+$3*interval '1 millisecond',version=version+1 WHERE id=$1 RETURNING *`,[run.id,token,leaseMs])).rows[0];
      await this.event(db,run.id,'run.started'); return {...row,native_started:run.native_started};
    });
  }
  async heartbeat(run,leaseMs=5000) {
    return (await this.pool.query(`UPDATE runs SET lease_until=clock_timestamp()+$3*interval '1 millisecond'
      WHERE id=$1 AND status='running' AND lease_token=$2 AND lease_until>clock_timestamp() RETURNING cancel_requested`,[run.id,run.lease_token,leaseMs])).rows[0];
  }
  async markDispatch(run) {
    return transaction(this.pool,async(db)=>{
      const changed=await db.query(`UPDATE runs SET dispatched=true WHERE id=$1 AND lease_token=$2 AND status='running'
        AND lease_until>clock_timestamp() AND NOT cancel_requested RETURNING session_id`,[run.id,run.lease_token]);
      if(!changed.rowCount)return false;
      await db.query('UPDATE sessions SET native_started=true WHERE id=$1',[run.session_id]);return true;
    });
  }
  async settle(run,result) {
    return transaction(this.pool,async(db)=>{
      const current=(await db.query("SELECT *,lease_until>clock_timestamp() AS valid FROM runs WHERE id=$1 FOR UPDATE",[run.id])).rows[0];
      if(!current||current.lease_token!==run.lease_token||current.status!=='running'||!current.valid)return false;
      const status=current.cancel_requested?'cancelled':result.status;
      requireThat(['succeeded','failed','cancelled'].includes(status),500,'INVALID_TERMINAL');
      const text=status==='succeeded'?result.text:null;
      requireThat(text===null||(typeof text==='string'&&[...text].length<=20000),500,'INVALID_OUTPUT');
      await db.query(`UPDATE runs SET status=$2,output=$3,error_code=$4,lease_token=NULL,lease_until=NULL,version=version+1 WHERE id=$1`,
        [run.id,status,text,result.errorCode??null]);
      await this.event(db,run.id,status==='succeeded'?'run.completed':status==='cancelled'?'run.cancelled':'run.failed',text);return true;
    });
  }
}
