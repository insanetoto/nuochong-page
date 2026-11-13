// KBV2-04 107-B: fenced persistent import worker.
import {randomUUID,createHash} from 'node:crypto';
import {Worker} from 'node:worker_threads';
import {transaction} from '../../apps/control-api/src/db.mjs';
import {requireThat} from '../../apps/control-api/src/errors.mjs';

const LEASE_MS=5000,DEADLINE_MS=60000,SPACE_SLOTS=2,PROCESS_SLOTS=4;
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const terminal=new Set(['parsed','failed','cancelled']);
export function aggregate(statuses){
 if(statuses.some(s=>!terminal.has(s)))return 'parsing';
 if(statuses.every(s=>s==='parsed'))return 'completed';
 if(statuses.every(s=>s==='failed'))return 'failed';
 if(statuses.every(s=>s==='cancelled'))return 'cancelled';
 return 'partial';
}
async function batchStatus(db,batchId){
 const statuses=(await db.query('SELECT status FROM knowledge_import_files WHERE batch_id=$1',[batchId])).rows.map(f=>f.status);
 await db.query('UPDATE knowledge_import_batches SET status=$2,revision=revision+1,updated_at=clock_timestamp() WHERE id=$1',[batchId,aggregate(statuses)]);
}
async function settleExpired(db){
 const rows=(await db.query("UPDATE knowledge_import_files SET status='failed',error_code='LEASE_EXPIRED',lease_token=NULL,lease_until=NULL,updated_at=clock_timestamp() WHERE status='parsing' AND lease_until<clock_timestamp() RETURNING batch_id")).rows;
 for(const id of new Set(rows.map(r=>r.batch_id)))await batchStatus(db,id);return rows.length;
}
export async function expireImportFiles(pool){return transaction(pool,db=>settleExpired(db));}
export async function claimImportFile(pool,{leaseMs=LEASE_MS,processLimit=PROCESS_SLOTS,spaceLimit=SPACE_SLOTS}={}){
 return transaction(pool,async db=>{
  await db.query("SELECT pg_advisory_xact_lock(hashtext($1))",[pool.oaSchema+':import-claim']);await settleExpired(db);
  const running=(await db.query("SELECT id,space_id FROM knowledge_import_files WHERE status='parsing' FOR UPDATE")).rows;
  if(running.length>=processLimit)return null;
  const spaces={};for(const row of running)spaces[row.space_id]=(spaces[row.space_id]??0)+1;
  const blocked=Object.entries(spaces).filter(([,n])=>n>=spaceLimit).map(([id])=>id);
  const row=(await db.query(`SELECT f.* FROM knowledge_import_files f JOIN knowledge_import_batches b ON b.id=f.batch_id
   WHERE f.status='uploaded' AND b.status='parsing' AND ($1::text[] IS NULL OR NOT(f.space_id=ANY($1)))
   ORDER BY f.created_at,f.id LIMIT 1 FOR UPDATE OF f SKIP LOCKED`,[blocked.length?blocked:null])).rows[0];
  if(!row)return null;
  return (await db.query(`UPDATE knowledge_import_files SET status='parsing',lease_token=$2,lease_until=clock_timestamp()+$3*interval '1 millisecond',deadline_at=clock_timestamp()+$4*interval '1 millisecond',attempt=attempt+1,updated_at=clock_timestamp() WHERE id=$1 RETURNING *`,[row.id,randomUUID(),leaseMs,DEADLINE_MS])).rows[0];
 });
}
function parseInWorker(bytes,mediaType,deadline){
 return new Promise((resolve,reject)=>{
  const worker=new Worker(new URL('./import-parse-thread.mjs',import.meta.url),{workerData:{bytes,mediaType}});
  let finished=false;const finish=(fn,value)=>{if(finished)return;finished=true;clearTimeout(timer);worker.terminate().catch(()=>{});fn(value);};
  const timer=setTimeout(()=>finish(reject,Object.assign(new Error('REQUEST_FAILED'),{code:'REQUEST_FAILED'})),Math.max(1,deadline-Date.now()));
  worker.on('message',message=>message.ok?finish(resolve,message.value):finish(reject,Object.assign(new Error(message.message),{code:message.code})));
  worker.on('error',error=>finish(reject,Object.assign(new Error('REQUEST_FAILED'),{code:'REQUEST_FAILED',cause:error})));
  worker.on('exit',()=>{if(!finished)finish(reject,Object.assign(new Error('REQUEST_FAILED'),{code:'REQUEST_FAILED'}));});
 });
}
export async function runImportWorkerOnce({pool,kernel,knowledge,leaseMs=LEASE_MS}){
 const file=await claimImportFile(pool,{leaseMs});if(!file)return null;
 const batch=(await pool.query('SELECT * FROM knowledge_import_batches WHERE id=$1',[file.batch_id])).rows[0];
 let lost=false,cancel=false;
 const heartbeat=setInterval(async()=>{
  try{
   const row=(await pool.query("UPDATE knowledge_import_files SET lease_until=clock_timestamp()+$3*interval '1 millisecond' WHERE id=$1 AND lease_token=$2 AND status='parsing' AND lease_until>clock_timestamp() RETURNING cancel_requested",[file.id,file.lease_token,leaseMs])).rows[0];
   if(!row)lost=true;else if(row.cancel_requested)cancel=true;
  }catch{lost=true;}
 },Math.max(250,Math.floor(leaseMs/2)));
 try{
  const binding=(await pool.query('SELECT * FROM knowledge_object_bindings WHERE hash=$1 AND space_id=$2 AND created_by=$3',[file.object_ref,batch.space_id,batch.created_by])).rows[0];requireThat(binding,404,'NOT_FOUND');
  const bytes=await knowledge.objects.readBytes(pool,file.object_ref);requireThat(sha(bytes)===binding.sha256,409,'EVIDENCE_CHANGED');
  const parsed=await parseInWorker(bytes,file.media_type,file.deadline_at.getTime());
  if(lost)return {fileId:file.id,status:'lost'};
  if(cancel)return await finishCancelled(pool,file);
  const textHash=await knowledge.objects.put(pool,parsed.text);
  const committed=await transaction(pool,async db=>{
   await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[pool.oaSchema+':product-domain-state']);
   const current=(await db.query("SELECT * FROM knowledge_import_files WHERE id=$1 AND lease_token=$2 AND status='parsing' AND lease_until>clock_timestamp() FOR UPDATE",[file.id,file.lease_token])).rows[0];
   if(!current)throw Object.assign(new Error('STALE_WORKER'),{code:'STALE_WORKER'});
   if(current.cancel_requested)return finishCancelledTx(db,file);
   await db.query('SELECT id FROM knowledge_spaces WHERE id=$1 FOR UPDATE',[batch.space_id]);
   const space=(await db.query('SELECT status FROM knowledge_spaces WHERE id=$1',[batch.space_id])).rows[0];requireThat(space?.status!=='archived',409,'SPACE_ARCHIVED');
   const ctx=await kernel.context(db,{id:batch.created_by,credential_id:batch.created_credential_id,scopes:['product:read','product:write']});
   requireThat(ctx.has('knowledge:edit',batch.space_id),403,'FORBIDDEN');
   await knowledge.authorize(db,ctx,{id:'knowledge.imports.create.v1'},{spaceId:batch.space_id});
   requireThat(Date.now()<=current.deadline_at.getTime(),408,'REQUEST_FAILED');
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
   return {fileId:file.id,status:'parsed'};
  });
  return committed??{fileId:file.id,status:'lost'};
 }catch(error){
  if(lost)return {fileId:file.id,status:'lost'};
  if(cancel)return finishCancelled(pool,file);
  const code=['SOURCE_VERSION_EXISTS','QUOTA_EXCEEDED','INVALID_INPUT','REQUEST_FAILED','PARSER_UNAVAILABLE','EVIDENCE_CHANGED','SPACE_ARCHIVED','UNAUTHORIZED','FORBIDDEN','STALE_WORKER'].includes(error.code)?error.code:'REQUEST_FAILED';
  await transaction(pool,async db=>{const changed=await db.query("UPDATE knowledge_import_files SET status='failed',error_code=$3,lease_token=NULL,lease_until=NULL,updated_at=clock_timestamp() WHERE id=$1 AND lease_token=$2 AND status='parsing' RETURNING id",[file.id,file.lease_token,code]);if(changed.rowCount)await batchStatus(db,file.batch_id);});
  return {fileId:file.id,status:'failed',errorCode:code};
 }finally{clearInterval(heartbeat);}
}
async function finishCancelled(pool,file){return transaction(pool,async db=>{const changed=await db.query("UPDATE knowledge_import_files SET status='cancelled',lease_token=NULL,lease_until=NULL,updated_at=clock_timestamp() WHERE id=$1 AND lease_token=$2 AND status='parsing' RETURNING id",[file.id,file.lease_token]);if(changed.rowCount)await batchStatus(db,file.batch_id);return {fileId:file.id,status:'cancelled'};});}
async function finishCancelledTx(db,file){await db.query("UPDATE knowledge_import_files SET status='cancelled',lease_token=NULL,lease_until=NULL,updated_at=clock_timestamp() WHERE id=$1 AND lease_token=$2 AND status='parsing'",[file.id,file.lease_token]);await batchStatus(db,file.batch_id);return {fileId:file.id,status:'cancelled'};}
export async function drainImports({pool,kernel,knowledge,limit=20}){const results=[];for(let i=0;i<limit;i+=1){const result=await runImportWorkerOnce({pool,kernel,knowledge});if(!result)break;results.push(result);}return results;}
export async function importLoop({pool,kernel,knowledge},signal,{idleMs=250}={}){
 while(!signal.aborted){const result=await runImportWorkerOnce({pool,kernel,knowledge});if(!result)await new Promise(resolve=>{const timer=setTimeout(resolve,idleMs);signal.addEventListener('abort',()=>{clearTimeout(timer);resolve();},{once:true});});}
}
