import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';import {join} from 'node:path';
import {knowledgeFixture} from './knowledge-fixture.mjs';import {workKnowledgeOnce} from '../../../plugins/knowledge/worker.mjs';
const fake=value=>()=>({execute:async()=>({status:'succeeded',text:JSON.stringify(value),toolCalls:[]}),close:async()=>{}});
async function fixture(t){const f=await knowledgeFixture(t);const source=await f.ingest();const jobs=f.product.jobs;
 const compilation={title:'出差审批知识页',body:'出差需先审批。[1]',citations:[{sourceId:source.id,lineStart:2,lineEnd:2,quote:'出差需先审批。'}]};
 const enqueue=async(extra={})=>{const r=await f.call('knowledge.compilations.create.v1',{idempotencyKey:randomUUID(),spaceId:f.spaceId,sourceIds:[source.id],pageId:'',expectedRevision:0,...extra});assert.equal(r.status,200,JSON.stringify(r.data));return r.data;};
 const get=async id=>{const r=await f.call('knowledge.jobs.get.v1',{spaceId:f.spaceId,jobId:id});assert.equal(r.status,200,JSON.stringify(r.data));return r.data;};
 const work=async(factory=fake(compilation),extra={})=>workKnowledgeOnce({jobs,stateRoot:join(f.root,'runtime'),executorFactory:factory,leaseMs:500,...extra});
 const published=async()=>{const page=await f.draft(source);await f.review(page);await f.publish(page);return page;};
 return {...f,source,jobs,compilation,enqueue,get,work,published};}
test('durable compilation produces a private reviewable wiki draft once, never an auto-publication',async t=>{
 const f=await fixture(t),key=randomUUID(),a=await f.enqueue({idempotencyKey:key}),b=await f.enqueue({idempotencyKey:key});assert.equal(a.jobId,b.jobId);
 assert.equal(await f.work(),true);const job=await f.get(a.jobId);assert.equal(job.status,'succeeded');assert.equal(job.result.page.pageState,'draft');
 assert.equal((await f.pool.query('SELECT count(*)::int n FROM knowledge_pages')).rows[0].n,1);assert.equal((await f.pool.query('SELECT count(*)::int n FROM knowledge_publications')).rows[0].n,0);
 const events=await f.call('knowledge.jobs.events.v1',{spaceId:f.spaceId,jobId:a.jobId});assert.deepEqual(events.data.items.map(e=>e.type),['job.created','job.started','job.completed']);
});
test('no evidence returns an explicit insufficient outcome without any model call',async t=>{
 const f=await fixture(t),r=await f.call('knowledge.answers.ask.v1',{idempotencyKey:randomUUID(),spaceId:f.spaceId,query:'未知制度问题'});assert.equal(r.status,200);
 let called=false;await f.work(()=>{called=true;throw new Error('Must not invoke model without evidence');});assert.equal(called,false);const job=await f.get(r.data.jobId);assert.equal(job.result.answer.status,'insufficient_evidence');assert.equal(job.result.answer.modelUsed,false);
});
test('answer citations point to authorized current raw revisions and become invalid after source withdrawal',async t=>{
 const f=await fixture(t);await f.published();const r=await f.call('knowledge.answers.ask.v1',{idempotencyKey:randomUUID(),spaceId:f.spaceId,query:'出差审批'});assert.equal(r.status,200);
 await f.work(fake({status:'answered',text:'出差需先审批。[1]',citations:f.compilation.citations}));const answer=await f.get(r.data.jobId);assert.equal(answer.status,'succeeded');assert.equal(answer.result.answer.citations[0].sourceVersion,'1');assert.equal(answer.result.answer.citations[0].hash,f.source.hash);
 await f.write('knowledge.sources.withdraw.v1',{spaceId:f.spaceId,sourceId:f.source.id});const invalid=await f.get(r.data.jobId);assert.equal(invalid.status,'succeeded');assert.equal(invalid.resultValid,false);assert.ok(!invalid.result);assert.equal(invalid.invalidReason,'EVIDENCE_CHANGED');
});
test('invented source IDs or extra model authority fields never create knowledge or change roles',async t=>{
 const f=await fixture(t),job=await f.enqueue();await f.work(fake({...f.compilation,grantRole:'knowledge-publisher'}));assert.equal((await f.get(job.jobId)).status,'failed');assert.equal((await f.get(job.jobId)).errorCode,'INVALID_MODEL_RESPONSE');
 assert.equal((await f.pool.query('SELECT count(*)::int n FROM knowledge_pages')).rows[0].n,0);assert.equal((await f.pool.query('SELECT count(*)::int n FROM product_bindings')).rows[0].n,6);
 const another=await f.enqueue();await f.work(fake({...f.compilation,citations:[{...f.compilation.citations[0],sourceId:randomUUID()}]}));assert.equal((await f.get(another.jobId)).errorCode,'INVALID_MODEL_RESPONSE');
});
test('queued cancellation never dispatches and running cancellation closes the executor with no draft side effect',async t=>{
 const f=await fixture(t),queued=await f.enqueue();const cancelled=await f.call('knowledge.jobs.cancel.v1',{idempotencyKey:randomUUID(),spaceId:f.spaceId,jobId:queued.jobId});assert.equal(cancelled.data.status,'cancelled');assert.equal(await f.work(),false);
 const active=await f.enqueue();let entered,finish;const started=new Promise(r=>entered=r);let closes=0;
 const working=f.work(()=>({execute:()=>{entered();return new Promise(r=>finish=r);},close:async()=>{closes++;finish?.({status:'failed'});}}));await started;
 await f.call('knowledge.jobs.cancel.v1',{idempotencyKey:randomUUID(),spaceId:f.spaceId,jobId:active.jobId});await working;assert.ok(closes>0);assert.equal((await f.get(active.jobId)).status,'cancelled');assert.equal((await f.pool.query('SELECT count(*)::int n FROM knowledge_pages')).rows[0].n,0);
});
test('evidence withdrawal during a model task aborts the task instead of committing stale knowledge',async t=>{
 const f=await fixture(t),job=await f.enqueue();let entered,finish;const started=new Promise(r=>entered=r);
 const working=f.work(()=>({execute:()=>{entered();return new Promise(r=>finish=r);},close:async()=>{finish?.({status:'failed'});}}));await started;
 await f.write('knowledge.sources.withdraw.v1',{spaceId:f.spaceId,sourceId:f.source.id});await working;const row=(await f.pool.query('SELECT * FROM product_jobs WHERE id=$1',[job.jobId])).rows[0];assert.equal(row.status,'failed');assert.equal(row.error_code,'EVIDENCE_CHANGED');assert.equal(row.result,null);
});
test('fencing rejects an expired worker and dispatched uncertain work is not automatically replayed',async t=>{
 const f=await fixture(t),job=await f.enqueue(),first=await f.jobs.claim(500);assert.equal(first.id,job.jobId);
 await f.pool.query("UPDATE product_jobs SET lease_until=clock_timestamp()-interval '1 second' WHERE id=$1",[job.jobId]);const second=await f.jobs.claim(500);assert.equal(second.id,job.jobId);assert.notEqual(first.lease_token,second.lease_token);
 assert.equal(await f.jobs.complete(first,JSON.stringify(f.compilation)),false);
 assert.equal(await f.jobs.markDispatched(second),true);await f.pool.query("UPDATE product_jobs SET lease_until=clock_timestamp()-interval '1 second' WHERE id=$1",[job.jobId]);assert.equal(await f.jobs.claim(),null);
 const state=await f.get(job.jobId);assert.equal(state.status,'failed');assert.equal(state.errorCode,'UNCERTAIN_DISPATCH');assert.equal((await f.pool.query('SELECT count(*)::int n FROM knowledge_pages')).rows[0].n,0);
});
test('private jobs cannot be read by another principal, even with the same knowledge space role',async t=>{
 const f=await fixture(t),job=await f.enqueue(),reader=await f.reader();assert.equal((await f.call('knowledge.jobs.get.v1',{spaceId:f.spaceId,jobId:job.jobId},reader.token)).status,404);
 assert.equal((await f.call('knowledge.jobs.events.v1',{spaceId:f.spaceId,jobId:job.jobId},reader.token)).status,404);
 const list=await f.call('knowledge.jobs.list.v1',{spaceId:f.spaceId},reader.token);assert.equal(list.status,200);assert.equal(list.data.items.length,0);
});
test('model timeout settles one failed terminal state and does not overwrite it on a late response',async t=>{
 const f=await fixture(t),job=await f.enqueue();let finish;
 await f.work(()=>({execute:()=>new Promise(r=>finish=r),close:async()=>finish?.({status:'succeeded',text:JSON.stringify(f.compilation)})}),{timeoutMs:80});
 const state=await f.get(job.jobId);assert.equal(state.status,'failed');assert.equal(state.errorCode,'MODEL_TIMEOUT');await delay(20);assert.equal((await f.get(job.jobId)).status,'failed');
});
