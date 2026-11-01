import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {poolFor,migrate} from '../src/db.mjs';import {createApp} from '../src/app.mjs';
import {bootstrapProduct} from '../../../plugins/access-management/service.mjs';
const exec=promisify(execFile);const url=process.env.TEST_DATABASE_URL;assert.ok(url,'Isolated PostgreSQL required');
export async function productFixture(t,options={}){
 const schema='oa_prod_'+randomUUID().replaceAll('-',''),pool=poolFor(url,schema);await migrate(pool,schema);
 const f=createApp(pool,options);await f.app.listen({host:'127.0.0.1',port:0});
 t.after(async()=>{await f.app.close();await pool.query(`DROP SCHEMA ${schema} CASCADE`);await pool.end();});
 const admin=await bootstrapProduct(pool,f.identity,{username:'synthetic-admin',password:'synthetic-test-pass'});
 const call=async(id,input={},token=admin.token,headers={})=>{
  const r=await fetch(f.app.listeningOrigin+'/product/api/commands/'+id,{method:'POST',headers:{'content-type':'application/json',...(token&&{authorization:'Bearer '+token}),...headers},body:JSON.stringify(input)});return {status:r.status,data:await r.json(),headers:r.headers};
 };
 const approve=async(id,target,token=admin.token)=>{const r=await call('access.approvals.create.v1',{idempotencyKey:randomUUID(),commandId:id,target,reason:'Synthetic test explicit approval'},token);assert.equal(r.status,200,JSON.stringify(r.data));return r.data.approvalId;};
 const write=async(id,input,token=admin.token)=>call(id,{...input,idempotencyKey:randomUUID(),approvalId:await approve(id,input,token)},token);
 const member=async(kind='user')=>{
  const m=await write('organization.members.create.v1',{name:'synthetic member',kind,departmentIds:[]});assert.equal(m.status,200,JSON.stringify(m.data));
  const p=(await pool.query('SELECT * FROM principals WHERE id=$1',[m.data.principalId])).rows[0];const c=await f.identity.issue(pool,p,['product:read','product:write'],new Date(Date.now()+3600000));return {...m.data,token:c.token};
 };
 return {...f,pool,schema,admin,call,approve,write,member};
}
test('product bootstrap is single-use and separate from native/core administrator; no plaintext password/token storage',async t=>{
 const f=await productFixture(t);await assert.rejects(bootstrapProduct(f.pool,f.identity,{username:'another',password:'synthetic-password'}));
 assert.equal((await f.call('identity.me.v1',{},null)).status,401);
 assert.equal((await f.call('identity.me.v1',{role:'admin'})).status,400);
 const core=await fetch(f.app.listeningOrigin+'/api/auth/principals',{headers:{authorization:'Bearer '+f.admin.token}});assert.equal(core.status,403);
 const a=(await f.pool.query('SELECT * FROM product_accounts')).rows[0];assert.ok(!a.password_hash.includes('synthetic-test-pass'));assert.equal(a.password_hash.length,128);
 assert.ok((await f.pool.query('SELECT token_hash FROM credentials')).rows.every(r=>!r.token_hash.includes(f.admin.token)));
});
test('explicit approval hash and request idempotency cannot be bypassed or replayed for different input',async t=>{
 const f=await productFixture(t),target={name:'synthetic department',parentId:''};const approvalId=await f.approve('organization.departments.create.v1',target);
 const i={...target,idempotencyKey:randomUUID(),approvalId};const a=await f.call('organization.departments.create.v1',i);assert.equal(a.status,200);
 assert.deepEqual((await f.call('organization.departments.create.v1',i)).data,a.data);
 assert.equal((await f.call('organization.departments.create.v1',{...i,name:'tampered'})).status,409);
 assert.equal((await f.call('organization.departments.create.v1',{...i,idempotencyKey:randomUUID()})).status,409);
 assert.equal((await f.pool.query('SELECT count(*)::int n FROM product_departments')).rows[0].n,1);
});
test('department cycles, stale revisions and active children prevent unsafe organization edits',async t=>{
 const f=await productFixture(t),a=await f.write('organization.departments.create.v1',{name:'A',parentId:''}),b=await f.write('organization.departments.create.v1',{name:'B',parentId:a.data.id});
 const cycle=await f.write('organization.departments.update.v1',{departmentId:a.data.id,name:'A',parentId:b.data.id,active:true,expectedRevision:1});assert.equal(cycle.data.code,'DEPARTMENT_CYCLE');
 const archive=await f.write('organization.departments.update.v1',{departmentId:a.data.id,name:'A',parentId:'',active:false,expectedRevision:1});assert.equal(archive.data.code,'DEPARTMENT_IN_USE');
 const stale=await f.write('organization.departments.update.v1',{departmentId:b.data.id,name:'B',parentId:'',active:true,expectedRevision:2});assert.equal(stale.data.code,'VERSION_CONFLICT');
});
test('shared roles do not turn department admins, learners or services into cross-product approvers',async t=>{
 const f=await productFixture(t),m=await f.member();
 assert.equal((await f.call('organization.members.list.v1',{},m.token)).status,403);
 const self=await f.call('access.approvals.create.v1',{idempotencyKey:randomUUID(),commandId:'access.bindings.grant.v1',target:{principalId:f.admin.principalId,roleId:'knowledge-publisher',scopeId:'x',expectedRevision:0},reason:'self grant'});assert.equal(self.status,403);
 const grant=await f.write('access.bindings.grant.v1',{principalId:m.principalId,roleId:'knowledge-reader',scopeId:'space-a',expectedRevision:0});assert.equal(grant.status,200);
 assert.equal((await f.call('access.permissions.check.v1',{permission:'knowledge:read',scopeId:'space-a'},m.token)).data.allowed,true);
 assert.equal((await f.call('access.permissions.check.v1',{permission:'knowledge:read',scopeId:'space-b'},m.token)).data.allowed,false);
 assert.equal((await f.call('access.permissions.check.v1',{permission:'learning:grade',scopeId:'space-a'},m.token)).data.allowed,false);
 const revoked=await f.write('access.bindings.revoke.v1',{bindingId:grant.data.id,expectedRevision:1});assert.equal(revoked.status,200);
 assert.equal((await f.call('access.permissions.check.v1',{permission:'knowledge:read',scopeId:'space-a'},m.token)).data.allowed,false);
 const service=await f.member('service');const p=(await f.pool.query('SELECT * FROM principals WHERE id=$1',[service.principalId])).rows[0];const forged=await f.identity.issue(f.pool,p,['product:read','product:write','product:approve'],new Date(Date.now()+3600000));
 assert.equal((await f.call('access.approvals.create.v1',{idempotencyKey:randomUUID(),commandId:'organization.departments.create.v1',target:{name:'x',parentId:''},reason:'service approval'},forged.token)).status,403);
});
test('membership changes are versioned and deactivation invalidates every existing credential',async t=>{
 const f=await productFixture(t),m=await f.member(),d=await f.write('organization.departments.create.v1',{name:'Test department',parentId:''});
 const moved=await f.write('organization.members.update.v1',{principalId:m.principalId,departmentIds:[d.data.id],active:true,expectedRevision:1});assert.equal(moved.status,200);assert.deepEqual(moved.data.departmentIds,[d.data.id]);
 const disabled=await f.write('organization.members.update.v1',{principalId:m.principalId,departmentIds:[],active:false,expectedRevision:2});assert.equal(disabled.status,200);
 assert.equal((await f.call('identity.me.v1',{},m.token)).status,401);
 const enabled=await f.write('organization.members.update.v1',{principalId:m.principalId,departmentIds:[],active:true,expectedRevision:3});assert.equal(enabled.status,200);
 assert.equal((await f.call('identity.me.v1',{},m.token)).status,401);
});
test('cookie login is company authentication with CSRF protection, not a model key or native owner cookie',async t=>{
 const f=await productFixture(t),origin=f.app.listeningOrigin;
 assert.equal((await f.call('identity.login.v1',{username:'synthetic-admin',password:'incorrect-pass',delivery:'bearer'},null)).status,401);
 const login=await f.call('identity.login.v1',{username:'synthetic-admin',password:'synthetic-test-pass',delivery:'cookie'},null,{origin});assert.equal(login.status,200);assert.equal(login.data.token,'');
 const cookie=login.headers.get('set-cookie');assert.match(cookie,/HttpOnly/);assert.match(cookie,/Path=\/product\//);
 assert.equal((await f.call('identity.me.v1',{},null,{cookie:cookie.split(';')[0]})).status,200);
 assert.equal((await f.call('identity.logout.v1',{idempotencyKey:randomUUID()},null,{cookie:cookie.split(';')[0]})).status,403);
 assert.equal((await f.call('identity.logout.v1',{idempotencyKey:randomUUID()},null,{cookie:cookie.split(';')[0],origin:'https://untrusted.invalid'})).status,403);
 assert.equal((await f.call('identity.logout.v1',{idempotencyKey:randomUUID()},null,{cookie:cookie.split(';')[0],origin})).status,200);
 assert.equal((await f.call('identity.me.v1',{},null,{cookie:cookie.split(';')[0]})).status,401);
});
test('new member accounts and CLI use the exact same versioned server authorization',async t=>{
 const f=await productFixture(t),m=await f.member();const a=await f.write('identity.accounts.create.v1',{principalId:m.principalId,username:'synthetic-reader',password:'synthetic-reader-pass'});assert.equal(a.status,200);
 const login=await f.call('identity.login.v1',{username:'synthetic-reader',password:'synthetic-reader-pass',delivery:'bearer'},null);assert.equal(login.status,200);
 const result=await exec(process.execPath,['tools/nuochong-cli/bin/nuochong.mjs','identity','me','--input','{}','--json'],{cwd:new URL('../../..',import.meta.url),env:{PATH:process.env.PATH,NUOCHONG_API_URL:f.app.listeningOrigin,NUOCHONG_ACCESS_TOKEN:login.data.token}});
 assert.equal(JSON.parse(result.stdout).data.principalId,m.principalId);
 await assert.rejects(exec(process.execPath,['tools/nuochong-cli/bin/nuochong.mjs','org','members','list','--input','{}','--json'],{cwd:new URL('../../..',import.meta.url),env:{PATH:process.env.PATH,NUOCHONG_API_URL:f.app.listeningOrigin,NUOCHONG_ACCESS_TOKEN:login.data.token}}),e=>e.code===5);
});
