import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {knowledgeFixture} from './knowledge-fixture.mjs';

async function secondGovernor(f){
 const member=await f.member();await f.write('access.bindings.grant.v1',{principalId:member.principalId,roleId:'access-admin',scopeId:'*',expectedRevision:0});
 await f.pool.query('INSERT INTO product_platform_governors(principal_id) VALUES($1) ON CONFLICT(principal_id) DO UPDATE SET active=true',[member.principalId]);
 const principal=(await f.pool.query('SELECT * FROM principals WHERE id=$1',[member.principalId])).rows[0];
 const credential=await f.identity.issue(f.pool,principal,['product:read','product:write','product:approve'],new Date(Date.now()+3600000));
 return {...member,token:credential.token};
}

test('space management uses frozen DTOs, immutable code and approval/governance boundaries',async(t)=>{
 const f=await knowledgeFixture(t);const governor=await secondGovernor(f);
 const created=await f.write('knowledge.spaces.create.v2',{code:'POLICY-'+randomUUID().slice(0,8),title:'Synthetic policy space',domainType:'policy',departmentIds:[]});
 assert.equal(created.status,200,JSON.stringify(created.data));assert.match(created.data.space.code,/^POLICY-/);assert.equal(created.data.space.allowSelfPublish,false);assert.equal(created.data.space.publicationPolicyRevision,1);
 const space=created.data.space;
 assert.equal((await f.write('knowledge.spaces.create.v2',{code:space.code,title:'Duplicate code',domainType:'policy',departmentIds:[]})).status,409);
 const got=await f.call('knowledge.spaces.get.v1',{spaceId:space.spaceId});assert.equal(got.status,200);assert.equal(got.data.space.code,space.code);assert.equal(got.data.space.status,'active');
 const updated=await f.write('knowledge.spaces.update.v1',{spaceId:space.spaceId,expectedRevision:space.revision,title:'Renamed policy space',departmentIds:[]});assert.equal(updated.status,200);assert.equal(updated.data.space.title,'Renamed policy space');assert.equal(updated.data.space.code,space.code);
 assert.equal((await f.write('knowledge.spaces.update.v1',{spaceId:space.spaceId,expectedRevision:space.revision,title:'Stale',departmentIds:[]})).status,409);
 const reader=await f.reader();
 assert.equal((await f.call('knowledge.spaces.update.v1',{idempotencyKey:randomUUID(),spaceId:space.spaceId,expectedRevision:space.revision,title:'Reader cannot rename',departmentIds:[]},reader.token)).status,403);
 assert.equal((await f.call('knowledge.spaces.update.v1',{idempotencyKey:randomUUID(),approvalId:'missing',spaceId:space.spaceId,expectedRevision:space.revision,title:'No bypass',departmentIds:[],allowSelfPublish:true},f.admin.token)).status,400);
 assert.equal((await f.call('knowledge.spaces.publication-policy.set.v1',{idempotencyKey:randomUUID(),spaceId:space.spaceId,allowSelfPublish:true,reason:'no governance proposal',expectedPolicyRevision:1,proposalId:'missing',approvalId:'missing'},f.admin.token)).status,409);

 const staleApproval=randomUUID(),adminCredential=(await f.pool.query('SELECT id FROM credentials WHERE principal_id=$1 ORDER BY created_at LIMIT 1',[f.admin.principalId])).rows[0].id;
 await f.pool.query("INSERT INTO product_approvals(id,command_id,target_hash,scope_id,approver_id,credential_id,expires_at,reason) VALUES($1,'knowledge.publications.publish.v1',repeat('a',64),$2,$3,$4,clock_timestamp()+interval '15 minutes','stale synthetic approval')",[staleApproval,space.spaceId,f.admin.principalId,adminCredential]);
  const proposalTarget={spaceId:space.spaceId,allowSelfPublish:true,reason:'single synthetic policy exception',expectedPolicyRevision:1};
 const proposal=await f.call('access.approval-requests.create.v1',{idempotencyKey:randomUUID(),commandId:'knowledge.spaces.publication-policy.set.v1',target:proposalTarget},f.admin.token);assert.equal(proposal.status,200,JSON.stringify(proposal.data));
 assert.equal((await f.call('access.approvals.create.v2',{idempotencyKey:randomUUID(),proposalId:proposal.data.proposalId,reason:'requester cannot approve own proposal'},f.admin.token)).status,409);
 const approval=await f.call('access.approvals.create.v2',{idempotencyKey:randomUUID(),proposalId:proposal.data.proposalId,reason:'independent synthetic governance approval'},governor.token);assert.equal(approval.status,200,JSON.stringify(approval.data));
 const policy=await f.call('knowledge.spaces.publication-policy.set.v1',{idempotencyKey:randomUUID(),spaceId:space.spaceId,allowSelfPublish:true,reason:proposalTarget.reason,expectedPolicyRevision:1,proposalId:proposal.data.proposalId,approvalId:approval.data.approvalId},f.admin.token);assert.equal(policy.status,200,JSON.stringify(policy.data));assert.equal(policy.data.allowSelfPublish,true);assert.equal(policy.data.policyRevision,2);assert.equal((await f.pool.query('SELECT used FROM product_approvals WHERE id=$1',[staleApproval])).rows[0].used,true);
 const after=await f.call('knowledge.spaces.get.v1',{spaceId:space.spaceId});assert.equal(after.data.space.allowSelfPublish,true);assert.equal(after.data.space.publicationPolicyRevision,2);
 assert.equal((await f.call('access.approval-requests.create.v1',{idempotencyKey:randomUUID(),commandId:'knowledge.spaces.publication-policy.set.v1',target:{...proposalTarget,expectedPolicyRevision:2}},await (async()=>{const r=await f.reader();return r.token;})())).status,403);

 const archived=await f.write('knowledge.spaces.archive.v1',{spaceId:space.spaceId,expectedRevision:after.data.space.revision,reason:'synthetic archive exercise'});assert.equal(archived.status,200,JSON.stringify(archived.data));assert.equal(archived.data.space.status,'archived');assert.equal((await f.call('knowledge.spaces.get.v1',{spaceId:space.spaceId})).data.space.spaceId,space.spaceId);
});

test('space update rejects a disabled department and preserves old v0 list compatibility',async(t)=>{
 const f=await knowledgeFixture(t);const department=await f.write('organization.departments.create.v1',{name:'Synthetic temporary department',parentId:''});assert.equal(department.status,200,JSON.stringify(department.data));
 const created=await f.write('knowledge.spaces.create.v2',{code:'DEPT-'+randomUUID().slice(0,8),title:'Department-scoped space',domainType:'procedure',departmentIds:[department.data.id]});assert.equal(created.status,200,JSON.stringify(created.data));
 const disabled=await f.write('organization.departments.update.v1',{departmentId:department.data.id,name:department.data.name,parentId:'',active:false,expectedRevision:department.data.revision});assert.equal(disabled.status,200,JSON.stringify(disabled.data));
 const update=await f.write('knowledge.spaces.update.v1',{spaceId:created.data.space.spaceId,expectedRevision:created.data.space.revision,title:'Should fail',departmentIds:[department.data.id]});assert.equal(update.status,404);
 const list=await f.call('knowledge.spaces.list.v1',{});assert.equal(list.status,200);assert.ok(list.data.items.some(item=>item.id===created.data.space.spaceId));
});
