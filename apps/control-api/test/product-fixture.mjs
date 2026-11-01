import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {poolFor,migrate} from '../src/db.mjs';import {createApp} from '../src/app.mjs';
import {bootstrapProduct} from '../../../plugins/access-management/service.mjs';
const url=process.env.TEST_DATABASE_URL;assert.ok(url,'Isolated PostgreSQL required');
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
