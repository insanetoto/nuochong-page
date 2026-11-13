// KBV2-04 107-B: persistent import worker with lease, per-space/process slots and 60s deadline.
import {randomUUID,createHash} from 'node:crypto';
import {transaction} from '../../apps/control-api/src/db.mjs';
import {requireThat} from '../../apps/control-api/src/errors.mjs';
import {parseImportBytes} from './import-parsers.mjs';

const LEASE_MS=5000,DEADLINE_MS=60000,SPACE_SLOTS=2,PROCESS_SLOTS=4;
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

async function batchStatus(db,batchId){
 const files=(await db.query('SELECT status FROM knowledge_import_files WHERE batch_id=$1',[batchId])).rows;
 const parsed=files.filter(f=>f.status==='parsed').length,failed=files.filter(f=>f.status==='failed').length,cancelled=files.filter(f=>f.status==='cancelled').length;
 const status=parsed===files.length?'completed':failed===files.length?'failed':cancelled===files.length?'cancelled':parsed+failed+cancelled===files.length?(failed?'partial':'completed'):'parsing';
 await db.query('UPDATE knowledge_import_batches SET status=$2,revision=revision+1,updated_at=clock_timestamp() WHERE id=$1',[batchId,status]);
}
export async function claimImportFile(pool,{leaseMs=LEASE_MS,processLimit=PROCESS_SLOTS,spaceLimit=SPACE_SLOTS}={}){
 return transaction(pool,async db=>{
  await db.query("SELECT pg_advisory_xact_lock(hashtext($1))",[pool.oaSchema+':import-claim']);
  await db.query(`UPDATE knowledge_import_files SET status='failed',error_code='LEASE_EXPIRED',lease_token=NULL,lease_until=NULL,updated_at=clock_timestamp()
   WHERE status='parsing' AND lease_until<clock_timestamp()`);
  const running=await db.query("SELECT id,space_id FROM knowledge_import_files WHERE status='parsing' FOR UPDATE");
  if(running.rowCount>=processLimit)return null;
  const spaces={};for(const row of running.rows)spaces[row.space_id]=(spaces[row.space_id]??0)+1;
  const blocked=Object.entries(spaces).filter(([,n])=>n>=spaceLimit).map(([id])=>id);
  const row=(await db.query(`SELECT f.* FROM knowledge_import_files f JOIN knowledge_import_batches b ON b.id=f.batch_id
   WHERE f.status='uploaded' AND b.status='parsing' AND ($1::text[] IS NULL OR NOT(f.space_id=ANY($1)))
   ORDER BY f.created_at,f.id LIMIT 1 FOR UPDATE OF f SKIP LOCKED`,[blocked.length?blocked:null])).rows[0];
  if(!row)return null;
  const updated=(await db.query(`UPDATE knowledge_import_files SET status='parsing',lease_token=$2,lease_until=clock_timestamp()+$3*interval '1 millisecond',deadline_at=clock_timestamp()+$4*interval '1 millisecond',attempt=attempt+1,updated_at=clock_timestamp()
   WHERE id=$1 RETURNING *`,[row.id,randomUUID(),leaseMs,DEADLINE_MS])).rows[0];
  return updated;
 });
}
export async function expireImportFiles(pool){return transaction(pool,async db=>{
 const rows=(await db.query("UPDATE knowledge_import_files SET status='failed',error_code='LEASE_EXPIRED',lease_token=NULL,lease_until=NULL,updated_at=clock_timestamp() WHERE status='parsing' AND lease_until<clock_timestamp() RETURNING batch_id")).rows;
 for(const id of new Set(rows.map(r=>r.batch_id)))await batchStatus(db,id);
 return rows.length;
});}
export async function runImportWorkerOnce({pool,kernel,knowledge,leaseMs=LEASE_MS}){
 const file=await claimImportFile(pool,{leaseMs});if(!file)return null;
 const batch=(await pool.query('SELECT * FROM knowledge_import_batches WHERE id=$1',[file.batch_id])).rows[0];
 try{
  const ctx=await kernel.context({query:(...args)=>pool.query(...args),pool}, {id:batch.created_by,credential_id:batch.created_credential_id,scopes:['product:read','product:write']});
  requireThat(ctx.has('knowledge:edit',batch.space_id),403,'FORBIDDEN');
  const space=(await pool.query('SELECT status FROM knowledge_spaces WHERE id=$1',[batch.space_id])).rows[0];requireThat(space?.status!=='archived',409,'SPACE_ARCHIVED');
  const binding=(await pool.query('SELECT * FROM knowledge_object_bindings WHERE hash=$1 AND space_id=$2',[file.object_ref,batch.space_id])).rows[0];requireThat(binding,404,'NOT_FOUND');
  const bytes=await knowledge.objects.readBytes(pool,file.object_ref);requireThat(sha(bytes)===binding.sha256,409,'EVIDENCE_CHANGED');
  const parsed=parseImportBytes(bytes,file.media_type);requireThat(Date.now()<=file.deadline_at.getTime(),408,'REQUEST_FAILED');
  const textHash=await knowledge.objects.put(pool,parsed.text);
  await transaction(pool,async db=>{
   const current=(await db.query("SELECT * FROM knowledge_import_files WHERE id=$1 AND lease_token=$2 AND status='parsing' FOR UPDATE",[file.id,file.lease_token])).rows[0];requireThat(current,409,'STALE_WORKER');
   if(current.cancel_requested||Date.now()>current.deadline_at.getTime()){await db.query("UPDATE knowledge_import_files SET status=$2,error_code=$3,lease_token=NULL,lease_until=NULL,updated_at=clock_timestamp() WHERE id=$1",[file.id,current.cancel_requested?'cancelled':'failed',current.cancel_requested?'CANCELLED':'REQUEST_FAILED']);await batchStatus(db,file.batch_id);return;}
   let document=(await db.query('SELECT * FROM knowledge_documents WHERE space_id=$1 AND policy_code=$2',[batch.space_id,file.policy_code])).rows[0];
   if(!document)document=(await db.query('INSERT INTO knowledge_documents(id,space_id,policy_code) VALUES($1,$2,$3) RETURNING *',[randomUUID(),batch.space_id,file.policy_code])).rows[0];
   requireThat(!(await db.query('SELECT 1 FROM knowledge_sources WHERE document_id=$1 AND version=$2',[document.id,file.version])).rowCount,409,'SOURCE_VERSION_EXISTS');
   const ordinal=(await db.query('UPDATE knowledge_documents SET latest_counter=latest_counter+1 WHERE id=$1 RETURNING latest_counter',[document.id])).rows[0].latest_counter;
   const source=(await db.query(`INSERT INTO knowledge_sources(id,document_id,space_id,title,ordinal,version,filename,object_hash,status,valid_from,valid_until,media_type)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,'active',$9,$10,$11) RETURNING *`,[randomUUID(),document.id,batch.space_id,file.title,ordinal,file.version,file.filename,textHash,file.valid_from,file.valid_until,file.media_type])).rows[0];
   for(const fragment of parsed.fragments)await db.query(`INSERT INTO knowledge_fragments(id,space_id,source_id,source_revision,locator,locator_key,excerpt,text_hash,status,revision)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,'pending',1) ON CONFLICT(source_id,locator_key,text_hash) DO NOTHING`,[randomUUID(),batch.space_id,source.id,source.ordinal,JSON.stringify(fragment.locator),fragment.locatorKey,fragment.excerpt,fragment.textHash]);
   await db.query('UPDATE knowledge_documents SET current_source_id=$2 WHERE id=$1',[document.id,source.id]);
   await db.query("UPDATE knowledge_import_files SET status='parsed',fragment_count=$2,extracted_object_hash=$3,error_code=NULL,lease_token=NULL,lease_until=NULL,updated_at=clock_timestamp() WHERE id=$1",[file.id,parsed.fragments.length,textHash]);
   await batchStatus(db,file.batch_id);await kernel.event(db,'knowledge.import.file.parsed.v1',file.id);
  });
  return {fileId:file.id,status:'parsed'};
 }catch(error){
  const code=['SOURCE_VERSION_EXISTS','QUOTA_EXCEEDED','INVALID_INPUT','REQUEST_FAILED','PARSER_UNAVAILABLE','EVIDENCE_CHANGED','SPACE_ARCHIVED','FORBIDDEN'].includes(error.code)?error.code:'REQUEST_FAILED';
  await transaction(pool,async db=>{await db.query("UPDATE knowledge_import_files SET status='failed',error_code=$2,lease_token=NULL,lease_until=NULL,updated_at=clock_timestamp() WHERE id=$1",[file.id,code]);await batchStatus(db,file.batch_id);});
  return {fileId:file.id,status:'failed',errorCode:code};
 }
}
export async function drainImports({pool,kernel,knowledge,limit=20}){
 const results=[];for(let i=0;i<limit;i+=1){const result=await runImportWorkerOnce({pool,kernel,knowledge});if(!result)break;results.push(result);}return results;
}
