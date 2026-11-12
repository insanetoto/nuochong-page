// KBV2-04 107-B: uploads, batches, synchronous parser execution and recovery.
import {randomUUID,createHash} from 'node:crypto';
import {requireThat} from '../../apps/control-api/src/errors.mjs';
import {parseImportBytes} from './import-parsers.mjs';

const MAX_FILE=20*1024*1024;
const MEDIA={'text/plain':/\.txt$/i,'text/markdown':/\.md$/i,'application/pdf':/\.pdf$/i,'application/vnd.openxmlformats-officedocument.wordprocessingml.document':/\.docx$/i};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export class ImportService {
 constructor(kernel,knowledge){this.kernel=kernel;this.knowledge=knowledge;this.pool=kernel.pool;}
 async batch(db,spaceId,id){const b=(await db.query('SELECT * FROM knowledge_import_batches WHERE id=$1 AND space_id=$2',[id,spaceId])).rows[0];requireThat(b,404,'NOT_FOUND');const files=(await db.query('SELECT * FROM knowledge_import_files WHERE batch_id=$1 ORDER BY created_at,id',[id])).rows;return {...b,files};}
 async upload(db,ctx,input,bytes){
  requireThat(Buffer.isBuffer(bytes)&&bytes.length>0&&bytes.length<=MAX_FILE,422,'INVALID_INPUT');
  requireThat(input.byteLength===bytes.length&&input.sha256===sha(bytes),400,'INVALID_INPUT');
  const media=input.mediaType;requireThat(MEDIA[media]?.test(input.filename),422,'INVALID_INPUT');
  parseImportBytes(bytes,media); // reject format/magic/empty/encrypted/scan before accepting
  const hash=await this.knowledge.objects.putBytes(db,bytes);
  requireThat(hash===input.sha256,400,'INVALID_INPUT');
  await db.query(`INSERT INTO knowledge_object_bindings(hash,space_id,filename,media_type,sha256,byte_length,created_by)
   VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(hash,space_id) DO NOTHING`,[hash,input.spaceId,input.filename,media,input.sha256,bytes.length,ctx.actor.id]);
  return {objectRef:hash,sha256:hash,byteLength:bytes.length,status:'ready',expiresAt:new Date(Date.now()+86400000).toISOString()};
 }
 async parseFile(db,ctx,batch,file){
  const binding=(await db.query('SELECT * FROM knowledge_object_bindings WHERE hash=$1 AND space_id=$2 AND created_by=$3',[file.object_ref,batch.space_id,ctx.actor.id])).rows[0];
  requireThat(binding,404,'NOT_FOUND');
  const bytes=await this.knowledge.objects.readBytes(db,file.object_ref);requireThat(sha(bytes)===binding.sha256,409,'EVIDENCE_CHANGED');
  const parsed=parseImportBytes(bytes,file.media_type);
  let document=(await db.query('SELECT * FROM knowledge_documents WHERE space_id=$1 AND policy_code=$2',[batch.space_id,file.policy_code])).rows[0];
  if(!document)document=(await db.query('INSERT INTO knowledge_documents(id,space_id,policy_code) VALUES($1,$2,$3) RETURNING *',[randomUUID(),batch.space_id,file.policy_code])).rows[0];
  requireThat(!(await db.query('SELECT 1 FROM knowledge_sources WHERE document_id=$1 AND version=$2',[document.id,file.version])).rowCount,409,'SOURCE_VERSION_EXISTS');
  const ordinal=(await db.query('UPDATE knowledge_documents SET latest_counter=latest_counter+1 WHERE id=$1 RETURNING latest_counter',[document.id])).rows[0].latest_counter;
  const source=(await db.query(`INSERT INTO knowledge_sources(id,document_id,space_id,title,ordinal,version,filename,object_hash,status,valid_from,valid_until,media_type)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,'active',$9,$10,$11) RETURNING *`,[randomUUID(),document.id,batch.space_id,file.title,ordinal,file.version,file.filename,file.object_ref,file.valid_from,file.valid_until,file.media_type])).rows[0];
  let count=0;
  for(const fragment of parsed.fragments){
   await db.query(`INSERT INTO knowledge_fragments(id,space_id,source_id,source_revision,locator,locator_key,excerpt,text_hash,status,revision)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,'pending',1) ON CONFLICT(source_id,locator_key,text_hash) DO NOTHING`,[randomUUID(),batch.space_id,source.id,source.ordinal,JSON.stringify(fragment.locator),fragment.locatorKey,fragment.excerpt,fragment.textHash]);
   count+=1;
  }
  await db.query('UPDATE knowledge_documents SET current_source_id=$2 WHERE id=$1',[document.id,source.id]);
  await db.query(`UPDATE knowledge_import_files SET status='parsed',fragment_count=$2,error_code=NULL,attempt=attempt+1,updated_at=clock_timestamp() WHERE id=$1`,[file.id,count]);
  await this.kernel.event(db,'knowledge.import.file.parsed.v1',file.id);
 }
 async create(db,ctx,input){
  requireThat(input.files.length>=1&&input.files.length<=20,400,'INVALID_INPUT');
  const refs=input.files.map(f=>f.objectRef);requireThat(new Set(refs).size===refs.length,400,'INVALID_INPUT');
  for(const f of input.files)requireThat((await db.query('SELECT 1 FROM knowledge_object_bindings WHERE hash=$1 AND space_id=$2 AND created_by=$3',[f.objectRef,input.spaceId,ctx.actor.id])).rowCount,404,'NOT_FOUND');
  const batch=(await db.query('INSERT INTO knowledge_import_batches(id,space_id,status,revision,created_by) VALUES($1,$2,$3,1,$4) RETURNING *',[randomUUID(),input.spaceId,'parsing',ctx.actor.id])).rows[0];
  for(const f of input.files){const binding=(await db.query('SELECT * FROM knowledge_object_bindings WHERE hash=$1 AND space_id=$2',[f.objectRef,input.spaceId])).rows[0];await db.query(`INSERT INTO knowledge_import_files(id,batch_id,space_id,object_ref,filename,status,title,policy_code,version,media_type,sha256,byte_length,valid_from,valid_until)
   VALUES($1,$2,$3,$4,$5,'validated',$6,$7,$8,$9,$10,$11,$12,$13)`,[randomUUID(),batch.id,input.spaceId,f.objectRef,binding.filename,f.title,f.policyCode,f.version,binding.media_type,binding.sha256,binding.byte_length,new Date(f.validFrom),f.validUntil?new Date(f.validUntil):null]);}
  const files=(await db.query('SELECT * FROM knowledge_import_files WHERE batch_id=$1 ORDER BY created_at,id',[batch.id])).rows;
  for(const file of files){
   const savepoint=`file_${file.id.replaceAll('-','')}`;
   try{
    await db.query(`SAVEPOINT ${savepoint}`);await this.parseFile(db,ctx,{...batch,space_id:input.spaceId},file);await db.query(`RELEASE SAVEPOINT ${savepoint}`);
   }catch(error){await db.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);const code=['SOURCE_VERSION_EXISTS','QUOTA_EXCEEDED','INVALID_INPUT','REQUEST_FAILED','PARSER_UNAVAILABLE','EVIDENCE_CHANGED'].includes(error.code)?error.code:'REQUEST_FAILED';await db.query(`UPDATE knowledge_import_files SET status='failed',error_code=$2,attempt=attempt+1,updated_at=clock_timestamp() WHERE id=$1`,[file.id,code]);}
  }
  const after=(await this.batch(db,input.spaceId,batch.id)).files;const failed=after.filter(f=>f.status==='failed').length;const parsed=after.filter(f=>f.status==='parsed').length;const status=parsed===0?'failed':failed>0?'partial':'completed';await db.query('UPDATE knowledge_import_batches SET status=$2,revision=revision+1,updated_at=clock_timestamp() WHERE id=$1',[batch.id,status]);await this.kernel.event(db,'knowledge.import.batch.changed.v1',batch.id);return this.batch(db,input.spaceId,batch.id);
 }
 async retry(db,ctx,input){
  const batch=await this.batch(db,input.spaceId,input.batchId);requireThat(batch.revision===input.expectedRevision,409,'VERSION_CONFLICT');
  for(const id of input.fileIds){const file=batch.files.find(f=>f.id===id);requireThat(file,404,'NOT_FOUND');requireThat(['failed','cancelled'].includes(file.status),409,'VERSION_CONFLICT');await db.query("UPDATE knowledge_import_files SET status='validated',error_code=NULL,updated_at=clock_timestamp() WHERE id=$1",[id]);}
  const files=(await db.query("SELECT * FROM knowledge_import_files WHERE batch_id=$1 AND status='validated'",[batch.id])).rows;
  for(const file of files){try{await db.query('SAVEPOINT retry');await this.parseFile(db,ctx,batch,file);await db.query('RELEASE SAVEPOINT retry');}catch(error){await db.query('ROLLBACK TO SAVEPOINT retry');await db.query("UPDATE knowledge_import_files SET status='failed',error_code=$2,attempt=attempt+1,updated_at=clock_timestamp() WHERE id=$1",[file.id,['SOURCE_VERSION_EXISTS','QUOTA_EXCEEDED','INVALID_INPUT','REQUEST_FAILED','PARSER_UNAVAILABLE'].includes(error.code)?error.code:'REQUEST_FAILED']);}}
  const after=(await this.batch(db,input.spaceId,batch.id)).files;const failed=after.filter(f=>f.status==='failed').length;const parsed=after.filter(f=>f.status==='parsed').length;await db.query('UPDATE knowledge_import_batches SET status=$2,revision=revision+1,updated_at=clock_timestamp() WHERE id=$1',[batch.id,parsed===0?'failed':failed?'partial':'completed']);return this.batch(db,input.spaceId,batch.id);
 }
 async cancel(db,ctx,input){
  const batch=await this.batch(db,input.spaceId,input.batchId);
  for(const id of input.fileIds){const f=batch.files.find(x=>x.id===id);requireThat(f,404,'NOT_FOUND');if(['uploaded','validated','parsing'].includes(f.status))await db.query("UPDATE knowledge_import_files SET status='cancelled',updated_at=clock_timestamp() WHERE id=$1",[id]);}
  const files=(await this.batch(db,input.spaceId,batch.id)).files;await db.query('UPDATE knowledge_import_batches SET status=$2,revision=revision+1,updated_at=clock_timestamp() WHERE id=$1',[batch.id,files.every(f=>['cancelled','failed','parsed'].includes(f.status))&&files.some(f=>f.status==='cancelled')?'cancelled':batch.status]);return {batchId:batch.id,cancelRequested:true};
 }
 async dispatch(db,ctx,id,i){
  if(id==='knowledge.objects.upload.v1')return this.upload(db,ctx,i,i.__bytes);
  if(id==='knowledge.imports.create.v1')return {batch:await this.create(db,ctx,i)};
  if(id==='knowledge.imports.list.v1'){const rows=(await db.query('SELECT id FROM knowledge_import_batches WHERE space_id=$1 AND id>$2 ORDER BY id LIMIT 101',[i.spaceId,i.after??''])).rows;const items=[];for(const r of rows.slice(0,100))items.push(await this.batch(db,i.spaceId,r.id));return {items,...(rows.length>100&&{nextCursor:rows[99].id})};}
  if(id==='knowledge.imports.get.v1')return {batch:await this.batch(db,i.spaceId,i.batchId)};
  if(id==='knowledge.imports.cancel.v1')return this.cancel(db,ctx,i);
  if(id==='knowledge.imports.retry.v1')return {batch:await this.retry(db,ctx,i)};
  requireThat(false,404,'NOT_FOUND');
 }
}
