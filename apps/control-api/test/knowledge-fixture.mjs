import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {productFixture} from './product-fixture.mjs';
export async function knowledgeFixture(t){
 const root=mkdtempSync(join(tmpdir(),'knowledge-objects-'));const f=await productFixture(t,{product:{objectRoot:root}});t.after(()=>rmSync(root,{recursive:true,force:true}));
 const space=await f.write('knowledge.spaces.create.v1',{title:'Synthetic company policy',departmentIds:[]});assert.equal(space.status,200,JSON.stringify(space.data));const spaceId=space.data.id;
 const content='# 合成制度\n出差需先审批。\n报销应提交发票。';
 const ingest=async(extra={})=>{const r=await f.call('knowledge.sources.import.v1',{idempotencyKey:randomUUID(),spaceId,title:'Synthetic travel policy',policyCode:'DEMO-001',version:'1',filename:'policy.md',content,validFrom:'2020-01-01T00:00:00Z',validUntil:'',...extra});assert.equal(r.status,200,JSON.stringify(r.data));return r.data;};
 const draft=async(source,extra={})=>{const r=await f.call('knowledge.changes.create.v1',{idempotencyKey:randomUUID(),spaceId,pageId:'',expectedRevision:0,title:'出差审批指南',body:'出差应先审批。[1]',citations:[{sourceId:source.id,lineStart:2,lineEnd:2,quote:source.version==='1'?'出差需先审批。':'新版本出差需先审批。'}],...extra});assert.equal(r.status,200,JSON.stringify(r.data));return r.data;};
 const review=async(page)=>{const r=await f.call('knowledge.changes.review.v1',{idempotencyKey:randomUUID(),spaceId,revisionId:page.revisionId,expectedRevision:page.revision,decision:'approve',reason:'Synthetic human checks source citation'});assert.equal(r.status,200,JSON.stringify(r.data));return r.data;};
 const publish=async(page)=>{const r=await f.write('knowledge.publications.publish.v1',{spaceId,revisionId:page.revisionId,expectedRevision:page.revision});assert.equal(r.status,200,JSON.stringify(r.data));return r.data;};
 const reader=async()=>{const m=await f.member();const grant=await f.write('access.bindings.grant.v1',{principalId:m.principalId,roleId:'knowledge-reader',scopeId:spaceId,expectedRevision:0});assert.equal(grant.status,200);return {...m,binding:grant.data};};
 return {...f,root,spaceId,content,ingest,draft,review,publish,reader};
}
