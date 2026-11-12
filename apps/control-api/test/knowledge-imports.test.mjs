import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {knowledgeFixture} from './knowledge-fixture.mjs';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
async function upload(f,{bytes,filename='policy.md',mediaType='text/markdown'}){
 const metadata={spaceId:f.spaceId,idempotencyKey:randomUUID(),filename,mediaType,byteLength:bytes.length,sha256:sha(bytes)};
 const form=new FormData();form.append('metadata',new Blob([JSON.stringify(metadata)],{type:'application/json'}));form.append('file',new Blob([bytes],{type:mediaType}),filename);
 const response=await fetch(f.app.listeningOrigin+'/product/api/commands/knowledge.objects.upload.v1',{method:'POST',headers:{authorization:'Bearer '+f.admin.token},body:form});
 return {status:response.status,data:await response.json()};
}
test('multipart upload creates owned object and imports MD into source/fragments idempotently',async(t)=>{
 const f=await knowledgeFixture(t);const bytes=Buffer.from('# Synthetic policy\n\nTravel requires approval.\nKeep receipts.\n');
 const uploaded=await upload(f,{bytes});assert.equal(uploaded.status,200,JSON.stringify(uploaded.data));assert.equal(uploaded.data.sha256,sha(bytes));assert.equal(uploaded.data.byteLength,bytes.length);
 const input={spaceId:f.spaceId,idempotencyKey:randomUUID(),files:[{objectRef:uploaded.data.objectRef,title:'Imported policy',policyCode:'IMPORT-1',version:'1',validFrom:'2020-01-01T00:00:00Z'}]};
 const created=await f.call('knowledge.imports.create.v1',input,f.admin.token);assert.equal(created.status,200,JSON.stringify(created.data));assert.equal(created.data.batch.status,'completed');assert.equal(created.data.batch.files[0].status,'parsed');
 const source=(await f.pool.query('SELECT * FROM knowledge_sources WHERE space_id=$1 AND object_hash=$2',[f.spaceId,uploaded.data.objectRef])).rows[0];assert.ok(source);assert.equal((await f.pool.query('SELECT count(*)::int n FROM knowledge_fragments WHERE source_id=$1',[source.id])).rows[0].n,2);
 const got=await f.call('knowledge.imports.get.v1',{spaceId:f.spaceId,batchId:created.data.batch.batchId},f.admin.token);assert.equal(got.data.batch.files[0].status,'parsed');const list=await f.call('knowledge.imports.list.v1',{spaceId:f.spaceId},f.admin.token);assert.ok(list.data.items.some(b=>b.batchId===created.data.batch.batchId));
 const again=await f.call('knowledge.imports.create.v1',{...input,idempotencyKey:randomUUID()},f.admin.token);assert.equal(again.data.batch.status,'failed');assert.equal(again.data.batch.files[0].errorCode,'SOURCE_VERSION_EXISTS');
});
test('upload rejects fake extension/magic and import rejects missing object',async(t)=>{
 const f=await knowledgeFixture(t);const fake=await upload(f,{bytes:Buffer.from('not a pdf'),filename:'fake.pdf',mediaType:'application/pdf'});assert.equal(fake.status,422);
 const missing=await f.call('knowledge.imports.create.v1',{spaceId:f.spaceId,idempotencyKey:randomUUID(),files:[{objectRef:'0'.repeat(64),title:'Missing',policyCode:'MISS',version:'1',validFrom:'2020-01-01T00:00:00Z'}]},f.admin.token);assert.equal(missing.status,404);
});
