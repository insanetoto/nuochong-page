import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID,createHash} from 'node:crypto';
import {readFileSync,writeFileSync,statSync} from 'node:fs';import {join} from 'node:path';
import {knowledgeFixture as fixture} from './knowledge-fixture.mjs';

test('raw documents are private immutable objects; explicit format limits, stable identity and same-key import are enforced',async t=>{
 const f=await fixture(t);const source=await f.ingest();assert.equal(source.hash,createHash('sha256').update(f.content).digest('hex'));assert.equal(statSync(join(f.root,source.hash)).mode&0o777,0o600);
 assert.equal(readFileSync(join(f.root,source.hash),'utf8'),f.content);
 const duplicate=await f.call('knowledge.sources.import.v1',{idempotencyKey:randomUUID(),spaceId:f.spaceId,title:'x',policyCode:'DEMO-001',version:'1',filename:'a.md',content:'different',validFrom:'2020-01-01',validUntil:''});assert.equal(duplicate.data.code,'SOURCE_VERSION_EXISTS');
 const unsupported=await f.call('knowledge.sources.import.v1',{idempotencyKey:randomUUID(),spaceId:f.spaceId,title:'x',policyCode:'DEMO-002',version:'1',filename:'a.pdf',content:'not a parser',validFrom:'2020-01-01',validUntil:''});assert.equal(unsupported.status,422);assert.equal(unsupported.data.code,'FORMAT_NOT_IMPLEMENTED');
 assert.equal((await f.pool.query('SELECT count(*)::int n FROM knowledge_sources')).rows[0].n,1);
});
test('published sources and compiled pages follow one authorization policy, while drafts never reach ordinary readers',async t=>{
 const f=await fixture(t),source=await f.ingest(),reader=await f.reader(),page=await f.draft(source);
 assert.equal((await f.call('knowledge.sources.get.v1',{spaceId:f.spaceId,sourceId:source.id},reader.token)).status,404);
 assert.equal((await f.call('knowledge.sources.list.v1',{spaceId:f.spaceId},reader.token)).status,403);
 assert.equal((await f.call('knowledge.pages.list.v1',{spaceId:f.spaceId,view:'published'},reader.token)).data.items.length,0);
 assert.equal((await f.call('knowledge.pages.get.v1',{spaceId:f.spaceId,pageId:page.pageId,view:'manage'},reader.token)).status,403);
 await f.review(page);await f.publish(page);
 assert.equal((await f.call('knowledge.pages.get.v1',{spaceId:f.spaceId,pageId:page.pageId,view:'published'},reader.token)).data.body,'出差应先审批。[1]');
 assert.equal((await f.call('knowledge.sources.get.v1',{spaceId:f.spaceId,sourceId:source.id},reader.token)).data.content,f.content);
 assert.equal((await f.call('knowledge.search.v1',{spaceId:f.spaceId,query:'出差审批'},reader.token)).data.items[0].pageId,page.pageId);
});
test('source locations and citation IDs are checked against raw text, not trusted model output',async t=>{
 const f=await fixture(t),source=await f.ingest();const r=await f.call('knowledge.changes.create.v1',{idempotencyKey:randomUUID(),spaceId:f.spaceId,pageId:'',expectedRevision:0,title:'bad draft',body:'unsupported claim [1]',citations:[{sourceId:source.id,lineStart:2,lineEnd:2,quote:'invented quote'}]});assert.equal(r.data.code,'INVALID_CITATION');
 assert.equal((await f.pool.query('SELECT count(*)::int n FROM knowledge_pages')).rows[0].n,0);
});
test('publishing requires actual review, exact content and matching human approval, with unique history under retry',async t=>{
 const f=await fixture(t),source=await f.ingest(),page=await f.draft(source);
 const premature=await f.write('knowledge.publications.publish.v1',{spaceId:f.spaceId,revisionId:page.revisionId,expectedRevision:page.revision});assert.equal(premature.data.code,'REVIEW_REQUIRED');
 await f.review(page);const target={spaceId:f.spaceId,revisionId:page.revisionId,expectedRevision:page.revision};const input={...target,idempotencyKey:randomUUID(),approvalId:await f.approve('knowledge.publications.publish.v1',target)};
 assert.equal((await f.call('knowledge.publications.publish.v1',input)).status,200);assert.equal((await f.call('knowledge.publications.publish.v1',input)).status,200);
 assert.equal((await f.pool.query('SELECT count(*)::int n FROM knowledge_publications')).rows[0].n,1);
 assert.equal((await f.pool.query('SELECT reason FROM knowledge_reviews')).rows[0].reason,'Synthetic human checks source citation');
});
test('a new draft makes previous approval stale without leaking draft title or version into published browsing',async t=>{
 const f=await fixture(t),source=await f.ingest(),page=await f.draft(source);await f.review(page);await f.publish(page);const reader=await f.reader();
 const newer=await f.draft(source,{pageId:page.pageId,expectedRevision:page.revision,title:'PRIVATE DRAFT TITLE',body:'新草稿，出差审批。[1]'});
 const visible=await f.call('knowledge.pages.get.v1',{spaceId:f.spaceId,pageId:page.pageId,view:'published'},reader.token);assert.equal(visible.data.title,page.title);assert.equal(visible.data.revision,1);assert.ok(!JSON.stringify(visible.data).includes('PRIVATE DRAFT'));
 const stale=await f.write('knowledge.publications.publish.v1',{spaceId:f.spaceId,revisionId:page.revisionId,expectedRevision:page.revision});assert.equal(stale.data.code,'VERSION_CONFLICT');assert.equal(newer.revision,2);
});
test('new source publication invalidates old dependent knowledge immediately; withdrawn evidence cannot be read or searched',async t=>{
 const f=await fixture(t),s1=await f.ingest(),p1=await f.draft(s1);await f.review(p1);await f.publish(p1);const reader=await f.reader();
 const s2=await f.ingest({version:'2',content:'# 新版本\n新版本出差需先审批。'}),p2=await f.draft(s2);await f.review(p2);await f.publish(p2);
 assert.equal((await f.call('knowledge.pages.get.v1',{spaceId:f.spaceId,pageId:p1.pageId,view:'published'},reader.token)).status,404);
 assert.equal((await f.call('knowledge.sources.get.v1',{spaceId:f.spaceId,sourceId:s1.id},reader.token)).status,404);
 const withdrawn=await f.write('knowledge.sources.withdraw.v1',{spaceId:f.spaceId,sourceId:s2.id});assert.equal(withdrawn.status,200);
 assert.equal((await f.call('knowledge.search.v1',{spaceId:f.spaceId,query:'出差'},reader.token)).data.items.length,0);
 assert.equal((await f.call('knowledge.pages.get.v1',{spaceId:f.spaceId,pageId:p2.pageId,view:'published'},reader.token)).status,404);
});
test('future or expired sources do not become current company policy and raw corruption fails closed',async t=>{
 const f=await fixture(t),source=await f.ingest({validFrom:'2099-01-01T00:00:00Z'}),page=await f.draft(source);await f.review(page);
 const future=await f.write('knowledge.publications.publish.v1',{spaceId:f.spaceId,revisionId:page.revisionId,expectedRevision:page.revision});assert.equal(future.data.code,'EVIDENCE_CHANGED');
 writeFileSync(join(f.root,source.hash),'corrupted bytes');const corrupt=await f.call('knowledge.sources.get.v1',{spaceId:f.spaceId,sourceId:source.id});assert.equal(corrupt.data.code,'OBJECT_CORRUPT');
});
test('department scope and role withdrawal affect sources, knowledge, search and retries on the next request',async t=>{
 const f=await fixture(t),source=await f.ingest(),page=await f.draft(source);await f.review(page);await f.publish(page);const reader=await f.reader();
 await f.write('access.bindings.revoke.v1',{bindingId:reader.binding.id,expectedRevision:1});
 for(const [command,input] of [['knowledge.sources.get.v1',{sourceId:source.id}],['knowledge.pages.get.v1',{pageId:page.pageId,view:'published'}],['knowledge.search.v1',{query:'出差'}]])assert.ok((await f.call(command,{spaceId:f.spaceId,...input},reader.token)).status>=400);
});

test('publication withdrawal is explicit in management and removes both browsing and raw evidence from readers',async t=>{
 const f=await fixture(t),source=await f.ingest(),page=await f.draft(source);await f.review(page);await f.publish(page);const reader=await f.reader();
 assert.equal((await f.write('knowledge.publications.withdraw.v1',{spaceId:f.spaceId,pageId:page.pageId,expectedRevision:1})).status,200);
 assert.equal((await f.call('knowledge.pages.get.v1',{spaceId:f.spaceId,pageId:page.pageId,view:'manage'})).data.pageState,'withdrawn');
 assert.equal((await f.call('knowledge.pages.get.v1',{spaceId:f.spaceId,pageId:page.pageId,view:'published'},reader.token)).status,404);
 assert.equal((await f.call('knowledge.sources.get.v1',{spaceId:f.spaceId,sourceId:source.id},reader.token)).status,404);
 assert.equal((await f.call('knowledge.sources.list.v1',{spaceId:f.spaceId},reader.token)).status,403);
});
test('knowledge CLI reads the same authorized publication and denies unpublished raw management',async t=>{
 const {execFile}=await import('node:child_process');const {promisify}=await import('node:util');const {fileURLToPath}=await import('node:url');const f=await fixture(t),source=await f.ingest(),p=await f.draft(source);await f.review(p);await f.publish(p);const reader=await f.reader();
 const cli=async(args,input)=>promisify(execFile)(process.execPath,[fileURLToPath(new URL('../../../tools/nuochong-cli/bin/nuochong.mjs',import.meta.url)),...args,'--json','--input',JSON.stringify(input)],{env:{PATH:process.env.PATH,NUOCHONG_API_URL:f.app.listeningOrigin,NUOCHONG_ACCESS_TOKEN:reader.token}});
 const result=JSON.parse((await cli(['knowledge','search'],{spaceId:f.spaceId,query:'出差'})).stdout);assert.equal(result.data.items[0].pageId,p.pageId);
 await assert.rejects(cli(['knowledge','sources','list'],{spaceId:f.spaceId}),e=>{assert.ok(e.stderr.includes('FORBIDDEN'));assert.ok(!e.stderr.includes(reader.token));return true;});
});
