// KBV2-04 107-B: bounded uploads, persistent per-file parsing leases and retry/cancel.
import {randomUUID,createHash} from 'node:crypto';
import {requireThat} from '../../apps/control-api/src/errors.mjs';

const MAX_FILE=20*1024*1024,MAX_BATCH=100*1024*1024,MAX_SPACE=500*1024*1024;
const MEDIA={'text/plain':/\.txt$/i,'text/markdown':/\.md$/i,'application/pdf':/\.pdf$/i,'application/vnd.openxmlformats-officedocument.wordprocessingml.document':/\.docx$/i};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const fileDTO=f=>({fileId:f.id,objectRef:f.object_ref,filename:f.filename,status:f.status,...(f.job_id&&{jobId:f.job_id}),...(f.error_code&&{errorCode:f.error_code})});
const batchDTO=b=>({batchId:b.id,spaceId:b.space_id,status:b.status,files:(b.files??[]).map(fileDTO),revision:b.revision});

export class ImportService {
 constructor(kernel,knowledge){this.kernel=kernel;this.knowledge=knowledge;this.pool=kernel.pool;}
 async batch(db,spaceId,id){const b=(await db.query('SELECT * FROM knowledge_import_batches WHERE id=$1 AND space_id=$2',[id,spaceId])).rows[0];requireThat(b,404,'NOT_FOUND');const files=(await db.query('SELECT * FROM knowledge_import_files WHERE batch_id=$1 ORDER BY created_at,id',[id])).rows;return batchDTO({...b,files});}
 async upload(db,ctx,input,bytes){
  requireThat(Buffer.isBuffer(bytes)&&bytes.length>0&&bytes.length<=MAX_FILE,422,'INVALID_INPUT');
  requireThat(input.byteLength===bytes.length&&input.sha256===sha(bytes),400,'INVALID_INPUT');
  requireThat(MEDIA[input.mediaType]?.test(input.filename),422,'INVALID_INPUT');
  const header=bytes.subarray(0,8).toString('latin1');
  if(input.mediaType==='application/pdf')requireThat(header.startsWith('%PDF-')&&!/\/Encrypt\b/.test(bytes.subarray(0,2048).toString('latin1')),422,'INVALID_INPUT');
  else if(input.mediaType==='application/vnd.openxmlformats-officedocument.wordprocessingml.document')requireThat(bytes[0]===0x50&&bytes[1]===0x4b,422,'INVALID_INPUT');
  else {try{new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{requireThat(false,422,'INVALID_INPUT');}requireThat(bytes.length>0,422,'INVALID_INPUT');}
  const usage=(await db.query('SELECT COALESCE(SUM(byte_length),0)::bigint AS n FROM knowledge_object_bindings WHERE space_id=$1',[input.spaceId])).rows[0].n;requireThat(Number(usage)+bytes.length<=MAX_SPACE,409,'QUOTA_EXCEEDED');
  const hash=await this.knowledge.objects.putBytes(db,bytes);requireThat(hash===input.sha256,400,'INVALID_INPUT');
  const existing=(await db.query('SELECT * FROM knowledge_object_bindings WHERE hash=$1 AND space_id=$2 AND created_by=$3',[hash,input.spaceId,ctx.actor.id])).rows[0];
  if(existing){requireThat(existing.filename===input.filename&&existing.media_type===input.mediaType,409,'VERSION_CONFLICT');}
  else await db.query(`INSERT INTO knowledge_object_bindings(hash,space_id,filename,media_type,sha256,byte_length,created_by) VALUES($1,$2,$3,$4,$5,$6,$7)`,[hash,input.spaceId,input.filename,input.mediaType,input.sha256,bytes.length,ctx.actor.id]);
  return {objectRef:hash,sha256:hash,byteLength:bytes.length,status:'ready',expiresAt:new Date(Date.now()+86400000).toISOString(),requestId:randomUUID()};
 }
 async create(db,ctx,input){
  requireThat(input.files.length>=1&&input.files.length<=20,400,'INVALID_INPUT');
  const refs=input.files.map(f=>f.objectRef);requireThat(new Set(refs).size===refs.length,400,'INVALID_INPUT');
  const bindings=[];let total=0;
  for(const f of input.files){const b=(await db.query('SELECT * FROM knowledge_object_bindings WHERE hash=$1 AND space_id=$2 AND created_by=$3',[f.objectRef,input.spaceId,ctx.actor.id])).rows[0];requireThat(b,404,'NOT_FOUND');bindings.push(b);total+=b.byte_length;}
  requireThat(total<=MAX_BATCH,409,'QUOTA_EXCEEDED');
  const batch=(await db.query("INSERT INTO knowledge_import_batches(id,space_id,status,revision,created_by,created_credential_id) VALUES($1,$2,'parsing',1,$3,$4) RETURNING *",[randomUUID(),input.spaceId,ctx.actor.id,ctx.actor.credential_id])).rows[0];
  for(let i=0;i<input.files.length;i+=1){const f=input.files[i],b=bindings[i];await db.query(`INSERT INTO knowledge_import_files(id,batch_id,space_id,object_ref,filename,status,title,policy_code,version,media_type,sha256,byte_length,valid_from,valid_until)
   VALUES($1,$2,$3,$4,$5,'uploaded',$6,$7,$8,$9,$10,$11,$12,$13)`,[randomUUID(),batch.id,input.spaceId,f.objectRef,b.filename,f.title,f.policyCode,f.version,b.media_type,b.sha256,b.byte_length,new Date(f.validFrom),f.validUntil?new Date(f.validUntil):null]);}
  await this.kernel.event(db,'knowledge.import.batch.created.v1',batch.id);
  return {batch:await this.batch(db,input.spaceId,batch.id),requestId:randomUUID()};
 }
 async get(db,spaceId,id){return {batch:await this.batch(db,spaceId,id),requestId:randomUUID()};}
 async list(db,spaceId,after){const rows=(await db.query('SELECT id FROM knowledge_import_batches WHERE space_id=$1 AND id>$2 ORDER BY id LIMIT 101',[spaceId,after??''])).rows;const items=[];for(const r of rows.slice(0,100))items.push(await this.batch(db,spaceId,r.id));return {items,...(rows.length>100&&{nextCursor:rows[99].id})};}
 async cancel(db,ctx,input){
  const batch=await this.batch(db,input.spaceId,input.batchId);
  for(const id of input.fileIds){const f=batch.files.find(x=>x.fileId===id);requireThat(f,404,'NOT_FOUND');if(f.status==='uploaded')await db.query("UPDATE knowledge_import_files SET status='cancelled',cancel_requested=true,updated_at=clock_timestamp() WHERE id=$1",[id]);else if(f.status==='parsing')await db.query('UPDATE knowledge_import_files SET cancel_requested=true,updated_at=clock_timestamp() WHERE id=$1',[id]);}
  const files=(await db.query('SELECT status FROM knowledge_import_files WHERE batch_id=$1',[batch.batchId])).rows;const terminal=files.every(f=>['parsed','failed','cancelled'].includes(f.status));const status=terminal?(files.every(f=>f.status==='cancelled')?'cancelled':files.some(f=>f.status==='parsed')?'partial':'failed'):'parsing';await db.query('UPDATE knowledge_import_batches SET status=$2,revision=revision+1,updated_at=clock_timestamp() WHERE id=$1',[batch.batchId,status]);return {batchId:batch.batchId,cancelRequested:true,requestId:randomUUID()};
 }
 async retry(db,ctx,input){
  const batch=await this.batch(db,input.spaceId,input.batchId);requireThat(batch.revision===input.expectedRevision,409,'VERSION_CONFLICT');
  for(const id of input.fileIds){const f=batch.files.find(x=>x.fileId===id);requireThat(f,404,'NOT_FOUND');requireThat(['failed','cancelled'].includes(f.status),409,'VERSION_CONFLICT');await db.query("UPDATE knowledge_import_files SET status='uploaded',error_code=NULL,cancel_requested=false,lease_token=NULL,lease_until=NULL,deadline_at=NULL,updated_at=clock_timestamp() WHERE id=$1",[id]);}
  await db.query("UPDATE knowledge_import_batches SET status='parsing',revision=revision+1,updated_at=clock_timestamp() WHERE id=$1",[batch.batchId]);return {batch:await this.batch(db,input.spaceId,batch.batchId),requestId:randomUUID()};
 }
 async dispatch(db,ctx,id,i){
  if(id==='knowledge.objects.upload.v1')return this.upload(db,ctx,i,i.__bytes);
  if(id==='knowledge.imports.create.v1')return this.create(db,ctx,i);
  if(id==='knowledge.imports.list.v1')return this.list(db,i.spaceId,i.after);
  if(id==='knowledge.imports.get.v1')return this.get(db,i.spaceId,i.batchId);
  if(id==='knowledge.imports.cancel.v1')return this.cancel(db,ctx,i);
  if(id==='knowledge.imports.retry.v1')return this.retry(db,ctx,i);
  requireThat(false,404,'NOT_FOUND');
 }
}
