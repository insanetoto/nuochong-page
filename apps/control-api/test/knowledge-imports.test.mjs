import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {deflateRawSync} from 'node:zlib';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {knowledgeFixture} from './knowledge-fixture.mjs';
import {aggregate,claimImportFile,drainImports,expireImportFiles,importLoop} from '../../../plugins/knowledge/import-worker.mjs';

function pdfBuffer(pages){
 const objects=[];const pagesId=2,fontId=3+pages.length*2;objects[1]='<< /Type /Catalog /Pages 2 0 R >>';objects[2]='<< /Type /Pages /Kids ['+pages.map((_,i)=>`${3+i*2} 0 R`).join(' ')+'] /Count ${pages.length} >>';objects[fontId]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
 pages.forEach((page,i)=>{const pageId=3+i*2,contentId=pageId+1;objects[pageId]=`<< /Type /Page /Parent ${pagesId} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`;const body=Buffer.from(`BT /F1 12 Tf 72 700 Td (${page.replace(/[()\\]/g,c=>'\\'+c)}) Tj ET`,'latin1');objects[contentId]=`<< /Length ${body.length} >>\nstream\n${body.toString('latin1')}\nendstream`;});
 let out='%PDF-1.4\n';objects.forEach((body,index)=>{if(index)out+=`${index} 0 obj\n${body}\nendobj\n`;});return Buffer.from(out,'latin1');
}
function zipBuffer(files){
 const locals=[],centrals=[];let offset=0;for(const [name,data] of Object.entries(files)){const buffer=Buffer.isBuffer(data)?data:Buffer.from(data);const compressed=deflateRawSync(buffer),nameBytes=Buffer.from(name);const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt16LE(8,8);local.writeUInt32LE(compressed.length,18);local.writeUInt32LE(buffer.length,22);local.writeUInt16LE(nameBytes.length,26);const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50,0);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(8,10);central.writeUInt32LE(compressed.length,20);central.writeUInt32LE(buffer.length,24);central.writeUInt16LE(nameBytes.length,28);central.writeUInt32LE(offset,42);locals.push(local,nameBytes,compressed);centrals.push(central,nameBytes);offset+=local.length+nameBytes.length+compressed.length;}const localBlock=Buffer.concat(locals),centralBlock=Buffer.concat(centrals),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(Object.keys(files).length,8);end.writeUInt16LE(Object.keys(files).length,10);end.writeUInt32LE(centralBlock.length,12);end.writeUInt32LE(localBlock.length,16);return Buffer.concat([localBlock,centralBlock,end]);
}
function docxBuffer(paragraphs){const body=paragraphs.map(p=>`<w:p><w:r><w:t>${p}</w:t></w:r></w:p>`).join('');return zipBuffer({'[Content_Types].xml':'<Types/>','word/document.xml':`<w:document><w:body>${body}</w:body></w:document>`});}
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
async function upload(f,{bytes,filename='policy.md',mediaType='text/markdown',token=f.admin.token}){
 const metadata={spaceId:f.spaceId,idempotencyKey:randomUUID(),filename,mediaType,byteLength:bytes.length,sha256:sha(bytes)};
 const form=new FormData();form.append('metadata',new Blob([JSON.stringify(metadata)],{type:'application/json'}));form.append('file',new Blob([bytes],{type:mediaType}),filename);
 const response=await fetch(f.app.listeningOrigin+'/product/api/commands/knowledge.objects.upload.v1',{method:'POST',headers:{authorization:'Bearer '+token},body:form});return {status:response.status,data:await response.json()};
}
async function drain(f){return drainImports({pool:f.pool,kernel:f.product.kernel,knowledge:f.product.knowledge});}
test('upload/multipart is bounded, batch is persistent and worker creates extracted source/fragments',async(t)=>{
 const f=await knowledgeFixture(t);const bytes=Buffer.from('# Imported\n\nTravel requires approval.\n');const uploaded=await upload(f,{bytes});assert.equal(uploaded.status,200,JSON.stringify(uploaded.data));
 const created=await f.call('knowledge.imports.create.v1',{spaceId:f.spaceId,idempotencyKey:randomUUID(),files:[{objectRef:uploaded.data.objectRef,title:'Imported policy',policyCode:'IMP-1',version:'1',validFrom:'2020-01-01T00:00:00Z'}]},f.admin.token);assert.equal(created.status,200,JSON.stringify(created.data));assert.equal(created.data.batch.status,'parsing');assert.equal(created.data.batch.files[0].status,'uploaded');
 const results=await drain(f);assert.equal(results.length,1);assert.equal(results[0].status,'parsed');
 const got=await f.call('knowledge.imports.get.v1',{spaceId:f.spaceId,batchId:created.data.batch.batchId},f.admin.token);assert.equal(got.data.batch.status,'completed');assert.equal(got.data.batch.files[0].status,'parsed');
 const source=(await f.pool.query('SELECT * FROM knowledge_sources WHERE space_id=$1 AND object_hash IS NOT NULL ORDER BY ordinal DESC LIMIT 1',[f.spaceId])).rows[0];assert.equal(source.object_hash,(await f.pool.query('SELECT extracted_object_hash FROM knowledge_import_files WHERE id=$1',[got.data.batch.files[0].fileId])).rows[0].extracted_object_hash);assert.equal((await f.pool.query('SELECT count(*)::int n FROM knowledge_fragments WHERE source_id=$1',[source.id])).rows[0].n,2);
 const read=await f.call('knowledge.sources.get.v1',{spaceId:f.spaceId,sourceId:source.id},f.admin.token);assert.equal(read.status,200);assert.match(read.data.content,/Imported/);
});
test('import worker loop consumes a created batch without manual drain',async(t)=>{
 const f=await knowledgeFixture(t);const bytes=Buffer.from('Loop input\n\nSecond paragraph.\n');const uploaded=await upload(f,{bytes});const created=await f.call('knowledge.imports.create.v1',{spaceId:f.spaceId,idempotencyKey:randomUUID(),files:[{objectRef:uploaded.data.objectRef,title:'Loop',policyCode:'LOOP-1',version:'1',validFrom:'2020-01-01T00:00:00Z'}]},f.admin.token);assert.equal(created.status,200);
 const controller=new AbortController();const loop=importLoop({pool:f.pool,kernel:f.product.kernel,knowledge:f.product.knowledge},controller.signal,{idleMs:20});
 try{for(let i=0;i<100;i++){const got=await f.call('knowledge.imports.get.v1',{spaceId:f.spaceId,batchId:created.data.batch.batchId},f.admin.token);if(got.data.batch.status==='completed')break;await new Promise(r=>setTimeout(r,50));}const final=await f.call('knowledge.imports.get.v1',{spaceId:f.spaceId,batchId:created.data.batch.batchId},f.admin.token);assert.equal(final.data.batch.status,'completed');assert.equal(final.data.batch.files[0].status,'parsed');}finally{controller.abort();await loop;}
});
test('two users may upload identical bytes without losing ownership',async(t)=>{
 const f=await knowledgeFixture(t);const bytes=Buffer.from('Shared synthetic bytes\n');const a=await upload(f,{bytes});assert.equal(a.status,200);const member=await f.member();await f.write('access.bindings.grant.v1',{principalId:member.principalId,roleId:'knowledge-editor',scopeId:f.spaceId,expectedRevision:0});const b=await upload(f,{bytes,filename:'policy.md',token:member.token});assert.equal(b.status,200,JSON.stringify(b.data));const created=await f.call('knowledge.imports.create.v1',{spaceId:f.spaceId,idempotencyKey:randomUUID(),files:[{objectRef:b.data.objectRef,title:'Member import',policyCode:'SHARED-1',version:'1',validFrom:'2020-01-01T00:00:00Z'}]},member.token);assert.equal(created.status,200,JSON.stringify(created.data));
});
test('cancel uses fileId and retry uses DTO identity/version',async(t)=>{
 const f=await knowledgeFixture(t);const bytes=Buffer.from('Travel requires approval.\n');const uploaded=await upload(f,{bytes});const created=await f.call('knowledge.imports.create.v1',{spaceId:f.spaceId,idempotencyKey:randomUUID(),files:[{objectRef:uploaded.data.objectRef,title:'Cancel me',policyCode:'CAN-1',version:'1',validFrom:'2020-01-01T00:00:00Z'}]},f.admin.token);const fileId=created.data.batch.files[0].fileId;
 const cancelled=await f.call('knowledge.imports.cancel.v1',{spaceId:f.spaceId,idempotencyKey:randomUUID(),batchId:created.data.batch.batchId,fileIds:[fileId]},f.admin.token);assert.equal(cancelled.status,200);assert.equal((await f.call('knowledge.imports.get.v1',{spaceId:f.spaceId,batchId:created.data.batch.batchId},f.admin.token)).data.batch.files[0].status,'cancelled');
 const retried=await f.call('knowledge.imports.retry.v1',{spaceId:f.spaceId,idempotencyKey:randomUUID(),batchId:created.data.batch.batchId,fileIds:[fileId],expectedRevision:created.data.batch.revision+1},f.admin.token);assert.equal(retried.status,200,JSON.stringify(retried.data));assert.equal(retried.data.batch.files[0].status,'uploaded');assert.equal((await drain(f))[0].status,'parsed');
});
test('archived space or revoked creator blocks final import write',async(t)=>{
 const f=await knowledgeFixture(t);const bytes=Buffer.from('Archive input\n');const uploaded=await upload(f,{bytes});await f.call('knowledge.imports.create.v1',{spaceId:f.spaceId,idempotencyKey:randomUUID(),files:[{objectRef:uploaded.data.objectRef,title:'Archive',policyCode:'ARC-1',version:'1',validFrom:'2020-01-01T00:00:00Z'}]},f.admin.token);const archived=await f.write('knowledge.spaces.archive.v1',{spaceId:f.spaceId,expectedRevision:1,reason:'synthetic archive before worker'});assert.equal(archived.status,200,JSON.stringify(archived.data));const results=await drain(f);assert.equal(results[0].status,'failed');assert.equal(results[0].errorCode,'SPACE_ARCHIVED');assert.equal((await f.pool.query('SELECT count(*)::int n FROM knowledge_sources WHERE space_id=$1 AND title=$2',[f.spaceId,'Archive'])).rows[0].n,0);
});
test('revoked creator credential cannot finalize a parsed import',async(t)=>{
 const f=await knowledgeFixture(t);const bytes=Buffer.from('Revocation input\n');const uploaded=await upload(f,{bytes});const created=await f.call('knowledge.imports.create.v1',{spaceId:f.spaceId,idempotencyKey:randomUUID(),files:[{objectRef:uploaded.data.objectRef,title:'Revoked',policyCode:'REV-1',version:'1',validFrom:'2020-01-01T00:00:00Z'}]},f.admin.token);await f.pool.query('UPDATE credentials SET revoked=true WHERE id=(SELECT created_credential_id FROM knowledge_import_batches WHERE id=$1)',[created.data.batch.batchId]);const results=await drain(f);assert.equal(results[0].status,'failed');assert.equal(results[0].errorCode,'UNAUTHORIZED');assert.equal((await f.pool.query('SELECT count(*)::int n FROM knowledge_sources WHERE space_id=$1 AND title=$2',[f.spaceId,'Revoked'])).rows[0].n,0);
});
test('PDF and DOCX imports map extracted text and locators to sources',async(t)=>{
 const f=await knowledgeFixture(t);
 for(const [bytes,mediaType,filename,title,code,expected] of [
  [pdfBuffer(['','PDF page two']),'application/pdf','policy.pdf','PDF source','PDF-1','PDF page two'],
  [docxBuffer(['DOCX first','DOCX second']),'application/vnd.openxmlformats-officedocument.wordprocessingml.document','policy.docx','DOCX source','DOCX-1','DOCX first\nDOCX second'],
 ]){
  const uploaded=await upload(f,{bytes,filename,mediaType});assert.equal(uploaded.status,200,JSON.stringify(uploaded.data));const created=await f.call('knowledge.imports.create.v1',{spaceId:f.spaceId,idempotencyKey:randomUUID(),files:[{objectRef:uploaded.data.objectRef,title,policyCode:code,version:'1',validFrom:'2020-01-01T00:00:00Z'}]},f.admin.token);assert.equal(created.status,200);const result=(await drain(f))[0];assert.equal(result.status,'parsed');const source=(await f.pool.query('SELECT * FROM knowledge_sources WHERE space_id=$1 AND title=$2',[f.spaceId,title])).rows[0];assert.equal((await f.call('knowledge.sources.get.v1',{spaceId:f.spaceId,sourceId:source.id},f.admin.token)).data.content,expected);assert.ok((await f.pool.query('SELECT count(*)::int n FROM knowledge_fragments WHERE source_id=$1',[source.id])).rows[0].n>=1);
 }
});
test('upload rejects fake magic and missing object is not found',async(t)=>{
 const f=await knowledgeFixture(t);const fake=await upload(f,{bytes:Buffer.from('not a pdf'),filename:'fake.pdf',mediaType:'application/pdf'});assert.equal(fake.status,422);const missing=await f.call('knowledge.imports.create.v1',{spaceId:f.spaceId,idempotencyKey:randomUUID(),files:[{objectRef:'0'.repeat(64),title:'Missing',policyCode:'MISS',version:'1',validFrom:'2020-01-01T00:00:00Z'}]},f.admin.token);assert.equal(missing.status,404);
});


test('terminal aggregation is consistent for parsed/failed/cancelled mixes',()=>{
 assert.equal(aggregate(['parsed','parsed']),'completed');
 assert.equal(aggregate(['failed','failed']),'failed');
 assert.equal(aggregate(['cancelled','cancelled']),'cancelled');
 assert.equal(aggregate(['parsed','failed']),'partial');
 assert.equal(aggregate(['parsed','cancelled']),'partial');
 assert.equal(aggregate(['uploaded','parsed']),'parsing');
});
test('expired parsing settles the batch without a later request',async(t)=>{
 const f=await knowledgeFixture(t);const bytes=Buffer.from('Expire input\n');const uploaded=await upload(f,{bytes});const created=await f.call('knowledge.imports.create.v1',{spaceId:f.spaceId,idempotencyKey:randomUUID(),files:[{objectRef:uploaded.data.objectRef,title:'Expire',policyCode:'EXP-1',version:'1',validFrom:'2020-01-01T00:00:00Z'}]},f.admin.token);const claimed=await claimImportFile(f.pool);assert.equal(claimed.batch_id,created.data.batch.batchId);await f.pool.query("UPDATE knowledge_import_files SET lease_until=clock_timestamp()-interval '1 second' WHERE id=$1",[claimed.id]);assert.equal(await expireImportFiles(f.pool),1);const got=await f.call('knowledge.imports.get.v1',{spaceId:f.spaceId,batchId:created.data.batch.batchId},f.admin.token);assert.equal(got.data.batch.status,'failed');assert.equal(got.data.batch.files[0].errorCode,'LEASE_EXPIRED');
});


test('in-flight product worker kill/restart retries the same file with one terminal side effect',async(t)=>{
 const f=await knowledgeFixture(t);const env={...process.env,NODE_ENV:'test',IMPORT_TEST_PARSE_DELAY_MS:'1500',DATABASE_URL:process.env.TEST_DATABASE_URL,OA_DATABASE_SCHEMA:f.pool.oaSchema,PRODUCT_OBJECT_ROOT:f.root,OA_RUNTIME_HOME:f.root+'-runtime'};
 let childLog='';const start=()=>{const child=spawn(process.execPath,[fileURLToPath(new URL('../src/product-worker-main.mjs',import.meta.url))],{env,stdio:['ignore','ignore','pipe']});child.stderr.on('data',chunk=>{childLog+=chunk.toString();});t.after(()=>{try{child.kill('SIGKILL');}catch{/* already exited */}});return child;};
 const get=async batchId=>{const got=await f.call('knowledge.imports.get.v1',{spaceId:f.spaceId,batchId},f.admin.token);return got.data.batch;};
 const wait=async(batchId,predicate)=>{for(let i=0;i<300;i++){const batch=await get(batchId);if(predicate(batch))return batch;await new Promise(r=>setTimeout(r,50));}throw new Error('worker did not reach state: '+childLog);};
 let child=start();const bytes=Buffer.from('In-flight kill input\n');const uploaded=await upload(f,{bytes});const created=await f.call('knowledge.imports.create.v1',{spaceId:f.spaceId,idempotencyKey:randomUUID(),files:[{objectRef:uploaded.data.objectRef,title:'In flight',policyCode:'FLIGHT-1',version:'1',validFrom:'2020-01-01T00:00:00Z'}]},f.admin.token);const batchId=created.data.batch.batchId;const fileId=created.data.batch.files[0].fileId;await wait(batchId,b=>b.files[0].status==='parsing');child.kill('SIGKILL');await new Promise(resolve=>child.once('exit',resolve));child=start();
 const failed=await wait(batchId,b=>b.status==='failed');assert.equal(failed.files[0].errorCode,'LEASE_EXPIRED');const retried=await f.call('knowledge.imports.retry.v1',{spaceId:f.spaceId,idempotencyKey:randomUUID(),batchId,fileIds:[fileId],expectedRevision:failed.revision},f.admin.token);assert.equal(retried.status,200,JSON.stringify(retried.data));const done=await wait(batchId,b=>b.status==='completed');assert.equal(done.files[0].status,'parsed');
 const source=(await f.pool.query('SELECT * FROM knowledge_sources WHERE space_id=$1 AND title=$2',[f.spaceId,'In flight'])).rows;assert.equal(source.length,1);assert.equal((await f.pool.query('SELECT count(*)::int n FROM knowledge_fragments WHERE source_id=$1',[source[0].id])).rows[0].n,1);
});
