// Explicit local-only real model verification; never imported by default CI tests.
import assert from 'node:assert/strict';import {existsSync,mkdirSync,writeFileSync} from 'node:fs';import {loadEnvFile} from 'node:process';import {randomUUID} from 'node:crypto';import {join} from 'node:path';
import {knowledgeFixture} from './knowledge-fixture.mjs';import {workKnowledgeOnce} from '../../../plugins/knowledge/worker.mjs';
const keyFile=new URL('../../../experiments/phase-a/runtime/.env.local',import.meta.url);if(!process.env.DEEPSEEK_API_KEY&&existsSync(keyFile))loadEnvFile(keyFile);
if(!process.env.DEEPSEEK_API_KEY||!process.env.TEST_DATABASE_URL)throw new Error('Local model key and isolated PostgreSQL required.');
const cleanups=[],report={time:new Date().toISOString(),platform:process.platform,node:process.version,provider:'deepseek-official',model:'deepseek-v4-flash',scope:'Real restricted Harness + PostgreSQL + private objects + company API',submittedTasks:0,providerRequests:'not-measured',cost:'unknown'};let phase='initialize',f;
try{
 f=await knowledgeFixture({after:fn=>cleanups.push(fn)});
 phase='compile';let response=await f.call('knowledge.compilations.create.v1',{idempotencyKey:randomUUID(),spaceId:f.spaceId,sourceIds:[(await f.ingest()).id],pageId:'',expectedRevision:0});assert.equal(response.status,200);
 await workKnowledgeOnce({jobs:f.product.jobs,stateRoot:join(f.root,'runtime'),apiKey:process.env.DEEPSEEK_API_KEY});report.submittedTasks++;
 let result=await f.call('knowledge.jobs.get.v1',{spaceId:f.spaceId,jobId:response.data.jobId});assert.equal(result.data.status,'succeeded',result.data.errorCode);const page=result.data.result.page;assert.ok(page.citations.length);assert.equal(page.pageState,'draft');
 phase='review-and-publish';await f.review(page);await f.publish(page);
 phase='question';response=await f.call('knowledge.answers.ask.v1',{idempotencyKey:randomUUID(),spaceId:f.spaceId,query:'出差之前需要先做什么？'});assert.equal(response.status,200);
 await workKnowledgeOnce({jobs:f.product.jobs,stateRoot:join(f.root,'runtime'),apiKey:process.env.DEEPSEEK_API_KEY});report.submittedTasks++;
 result=await f.call('knowledge.jobs.get.v1',{spaceId:f.spaceId,jobId:response.data.jobId});assert.equal(result.data.status,'succeeded',result.data.errorCode);assert.equal(result.data.result.answer.status,'answered');assert.ok(result.data.result.answer.citations.length);assert.equal(result.data.result.answer.modelUsed,true);
 Object.assign(report,{passed:true,compiledDraft:true,reviewedPublication:true,answerHasCurrentRawRevision:true,noOwnerOrClientKey:true});
}catch(error){Object.assign(report,{passed:false,phase,errorType:error.name});process.exitCode=1;}
finally{
 for(const fn of cleanups)await fn();const root=new URL('../outputs/',import.meta.url);mkdirSync(root,{recursive:true});writeFileSync(new URL('knowledge-real-model.json',root),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}
