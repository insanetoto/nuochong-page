import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { poolFor,migrate } from '../src/db.mjs';
import { createApp } from '../src/app.mjs';
import { Identity,MEMBER_SCOPES } from '../src/identity.mjs';
import { workOnce } from '../src/worker.mjs';
const exec=promisify(execFile);
const databaseURL=process.env.TEST_DATABASE_URL;
assert.ok(databaseURL,'TEST_DATABASE_URL must point to an isolated real PostgreSQL database.');
async function fixture(t){
 const schema='oa_test_'+randomUUID().replaceAll('-','');const pool=poolFor(databaseURL,schema);await migrate(pool,schema);
 const {app,store,identity}=createApp(pool);const admin=await identity.bootstrap('test administrator');
 await app.listen({host:'127.0.0.1',port:0});const origin=app.listeningOrigin;
 t.after(async()=>{await app.close();await pool.query(`DROP SCHEMA ${schema} CASCADE`);await pool.end();});
 const call=async(path,{token=admin.token,method='GET',body,headers={}}={})=>{
  const response=await fetch(origin+path,{method,headers:{...(token&&{authorization:'Bearer '+token}),...(body&&{'content-type':'application/json'}),...headers},...(body&&{body:JSON.stringify(body)})});
  const data=await response.json();return {status:response.status,data};
 };
 const member=async(name='member',kind='user')=>{
  const p=await call('/api/auth/principals',{method:'POST',body:{name,kind,role:'member'}});assert.equal(p.status,200);
  const c=await call('/api/auth/credentials',{method:'POST',body:{principalId:p.data.principalId,scopes:MEMBER_SCOPES,expiresAt:new Date(Date.now()+3600000).toISOString()}});assert.equal(c.status,200);
  return {...c.data,...p.data};
 };
 const create=async(token,prompt='synthetic task',extra={})=>{const r=await call('/api/ai/runs',{token,method:'POST',body:{prompt,idempotencyKey:randomUUID(),...extra}});assert.equal(r.status,202);return r.data.runId;};
 return {pool,app,store,identity,admin,origin,call,member,create};
}
const immediate=()=>({execute:async()=>({status:'succeeded',text:'synthetic executor result'}),close:async()=>{}});
function delayed(ms=1000){let finish,timer;return {execute:()=>new Promise(resolve=>{finish=resolve;timer=setTimeout(()=>resolve({status:'succeeded',text:'delayed synthetic result'}),ms);}),close:async()=>{clearTimeout(timer);finish?.({status:'failed',errorCode:'unavailable'});}};}
async function until(check){for(let i=0;i<100;i++){if(await check())return;await delay(10);}throw new Error('Condition not met.');}

test('real bootstrap is single-use; no fake credential/identity fallback and no stored plaintext token',async(t)=>{
 const f=await fixture(t);await assert.rejects(f.identity.bootstrap('duplicate'));
 assert.equal((await f.call('/api/auth/me',{token:null})).status,401);
 assert.equal((await f.call('/api/auth/me',{token:'mock-token'})).status,401);
 const me=await f.call('/api/auth/me');assert.equal(me.data.role,'admin');
 const hashes=(await f.pool.query('SELECT token_hash FROM credentials')).rows;assert.ok(hashes.every(r=>!r.token_hash.includes(f.admin.token)&&r.token_hash.length===64));
});
test('member and service cannot escalate principal, credential, model or tool permissions',async(t)=>{
 const f=await fixture(t);const a=await f.member();const b=await f.member('service','service');
 for(const actor of [a,b]){
  assert.equal((await f.call('/api/auth/principals',{token:actor.token})).status,403);
  assert.equal((await f.call('/api/auth/credentials',{token:actor.token,method:'POST',body:{principalId:actor.principalId,scopes:['auth:manage'],expiresAt:new Date(Date.now()+3600000).toISOString()}})).status,403);
  assert.equal((await f.call('/api/ai/config',{token:actor.token,method:'POST',body:{model:'deepseek-v4-flash',clockTool:false,expectedVersion:1}})).status,403);
 }
 assert.equal((await f.call('/api/auth/principals',{method:'POST',body:{name:'service admin',kind:'service',role:'admin'}})).status,400);
 assert.equal((await f.call('/api/auth/credentials',{method:'POST',body:{principalId:a.principalId,scopes:['auth:manage'],expiresAt:new Date(Date.now()+3600000).toISOString()}})).status,400);
 assert.equal((await f.call('/api/ai/config')).data.version,1);
});
test('server actor owns runs/sessions; cross-owner and forged fields/headers cannot grant access',async(t)=>{
 const f=await fixture(t);const a=await f.member('a');const b=await f.member('b');const id=await f.create(a.token);
 const run=await f.call('/api/ai/runs/'+id,{token:a.token});const sessionId=run.data.sessionId;
 for(const token of [b.token,f.admin.token]){
  for(const path of ['/api/ai/runs/'+id,'/api/ai/sessions/'+sessionId,'/api/ai/sessions/'+sessionId+'/history'])assert.equal((await f.call(path,{token,headers:{'x-user-id':a.principalId,'x-role':'admin'}})).status,404);
 }
 for(const override of [{actorId:a.principalId},{tenantId:'x'},{role:'admin'},{sessionId}]){
  const r=await f.call('/api/ai/runs',{token:b.token,method:'POST',body:{prompt:'x',idempotencyKey:randomUUID(),...override}});assert.equal(r.status,override.sessionId?404:400);
 }
 assert.equal((await f.pool.query('SELECT count(*)::int AS n FROM runs')).rows[0].n,1);
});
test('scoped/expired/revoked credentials and principal withdrawal are effective without cached identity',async(t)=>{
 const f=await fixture(t);const a=await f.member();
 const c=await f.call('/api/auth/credentials',{method:'POST',body:{principalId:a.principalId,scopes:['sessions:read'],expiresAt:new Date(Date.now()+3600000).toISOString()}});
 assert.equal((await f.call('/api/ai/sessions',{token:c.data.token})).status,200);
 assert.equal((await f.call('/api/ai/runs',{token:c.data.token,method:'POST',body:{prompt:'x',idempotencyKey:'k'}})).status,403);
 await f.pool.query('UPDATE credentials SET expires_at=clock_timestamp()-interval \'1 second\' WHERE id=$1',[c.data.credentialId]);
 assert.equal((await f.call('/api/auth/me',{token:c.data.token})).status,401);
 await f.call('/api/auth/credentials/'+a.credentialId+'/revoke',{method:'POST',body:{}});
 assert.equal((await f.call('/api/auth/me',{token:a.token})).status,401);
 const b=await f.member('b');await f.call('/api/auth/principals/'+b.principalId+'/active',{method:'POST',body:{active:false}});
 await f.call('/api/auth/principals/'+b.principalId+'/active',{method:'POST',body:{active:true}});
 assert.equal((await f.call('/api/auth/me',{token:b.token})).status,401);
 assert.equal((await f.call('/api/auth/principals/'+f.admin.principalId+'/active',{method:'POST',body:{active:false}})).status,409);
});
test('concurrent stable-key submits create one private context; conflicting request is rejected',async(t)=>{
 const f=await fixture(t);const a=await f.member();const request={token:a.token,method:'POST',body:{prompt:'same',idempotencyKey:'stable'}};
 const results=await Promise.all(Array.from({length:10},()=>f.call('/api/ai/runs',request)));
 assert.equal(new Set(results.map(r=>r.data.runId)).size,1);assert.ok(results.every(r=>r.status===202));
 assert.equal((await f.pool.query('SELECT count(*)::int AS n FROM sessions')).rows[0].n,1);
 assert.equal((await f.call('/api/ai/runs',{...request,body:{...request.body,prompt:'different'}})).status,409);
});
test('API and real CLI share a live PostgreSQL-backed contract, config and credential policy',async(t)=>{
 const f=await fixture(t);const a=await f.member();const bin=new URL('../../../tools/nuochong-cli/bin/nuochong.mjs',import.meta.url).pathname;
 const env={PATH:process.env.PATH,NUOCHONG_API_URL:f.origin,NUOCHONG_ACCESS_TOKEN:a.token};
 const me=JSON.parse((await exec(process.execPath,[bin,'auth','me','--json'],{env})).stdout);assert.equal(me.data.principalId,a.principalId);
 const created=JSON.parse((await exec(process.execPath,[bin,'sessions','create','--input',JSON.stringify({name:'CLI session'})],{env})).stdout);
 assert.equal(created.data.name,'CLI session');
 await assert.rejects(exec(process.execPath,[bin,'models','config','update','--input',JSON.stringify({model:'deepseek-v4-flash',clockTool:false,expectedVersion:1})],{env}),error=>error.code===5);
 assert.equal((await f.call('/api/ai/tools',{token:a.token})).data.items[0].readonly,true);
 assert.equal((await f.call('/api/ai/config',{method:'POST',body:{model:'deepseek-v4-flash',clockTool:false,expectedVersion:1}})).status,200);
 assert.equal((await f.call('/api/ai/config',{method:'POST',body:{model:'deepseek-v4-flash',clockTool:true,expectedVersion:1}})).status,409);
 assert.equal((await f.call('/api/ai/tools',{token:a.token})).data.items[0].enabled,false);
});
test('two worker claims serialize one session; durable history/events persist across API instances',async(t)=>{
 const f=await fixture(t);const a=await f.member();const id=await f.create(a.token);
 const run=(await f.call('/api/ai/runs/'+id,{token:a.token})).data;
 const second=await f.create(a.token,'follow-up',{sessionId:run.sessionId});
 const claims=await Promise.all([f.store.claim(),f.store.claim()]);assert.equal(claims.filter(Boolean).length,1);
 const job=claims.find(Boolean);await f.store.settle(job,{status:'succeeded',text:'one'});
 await workOnce({...f,executorFactory:immediate});
 const another=createApp(f.pool);await another.app.listen({host:'127.0.0.1',port:0});
 const response=await fetch(another.app.listeningOrigin+'/api/ai/sessions/'+run.sessionId+'/history',{headers:{authorization:'Bearer '+a.token}});
 assert.equal((await response.json()).items.length,2);await another.app.close();
 assert.equal((await f.store.ownedRun({id:a.principalId},second)).status,'succeeded');
});
test('durable SSE replays after cursor and terminates, invalid/terminal cursors are explicit',async(t)=>{
 const f=await fixture(t);const a=await f.member();const id=await f.create(a.token);
 await workOnce({...f,executorFactory:immediate});
 const events=await f.store.replay({id:a.principalId},id);assert.equal(events.at(-1).type,'run.completed');
 const response=await fetch(f.origin+'/api/ai/runs/'+id+'/events',{headers:{authorization:'Bearer '+a.token,'last-event-id':events[0].eventId}});
 const text=await response.text();assert.ok(!text.includes('event: run.created'));assert.match(text,/event: run.completed/);
 assert.equal((await f.call('/api/ai/runs/'+id+'/events',{token:a.token,headers:{'last-event-id':'wrong:1'}})).status,400);
 assert.equal((await f.call('/api/ai/runs/'+id+'/events',{token:a.token,headers:{'last-event-id':events.at(-1).eventId}})).status,409);
});
test('queued/running cancellation, result races and timeout never overwrite a terminal result',async(t)=>{
 const f=await fixture(t);const a=await f.member();const id=await f.create(a.token);
 await f.call('/api/ai/runs/'+id+'/cancel',{token:a.token,method:'POST',body:{}});
 assert.equal((await f.store.ownedRun({id:a.principalId},id)).status,'cancelled');
 const running=await f.create(a.token);const task=workOnce({...f,executorFactory:()=>delayed(),leaseMs:400});
 await until(async()=>(await f.store.ownedRun({id:a.principalId},running)).status==='running');
 await f.call('/api/ai/runs/'+running+'/cancel',{token:a.token,method:'POST',body:{}});await task;
 assert.equal((await f.store.ownedRun({id:a.principalId},running)).status,'cancelled');
 const timeout=await f.create(a.token);await workOnce({...f,executorFactory:()=>delayed(),timeoutMs:30,leaseMs:400});
 assert.equal((await f.store.ownedRun({id:a.principalId},timeout)).error_code,'timeout');
 const success=await f.create(a.token);await workOnce({...f,executorFactory:immediate});
 assert.equal((await f.call('/api/ai/runs/'+success+'/cancel',{token:a.token,method:'POST',body:{}})).status,409);
});
test('credential revocation terminates an in-flight run and stream without continued disclosure',async(t)=>{
 const f=await fixture(t);const a=await f.member();const id=await f.create(a.token);
 const task=workOnce({...f,executorFactory:()=>delayed(),leaseMs:300});
 await until(async()=>(await f.store.ownedRun({id:a.principalId},id)).status==='running');
 const stream=await fetch(f.origin+'/api/ai/runs/'+id+'/events',{headers:{authorization:'Bearer '+a.token}});
 await f.call('/api/auth/credentials/'+a.credentialId+'/revoke',{method:'POST',body:{}});
 await task;const text=await stream.text();assert.doesNotMatch(text,/run.completed/);
 assert.equal((await f.store.ownedRun({id:a.principalId},id)).status,'cancelled');
 assert.equal((await f.call('/api/ai/runs/'+id,{token:a.token})).status,401);
});
test('expired lease fencing rejects stale completion; pre-dispatch failure can retry',async(t)=>{
 const f=await fixture(t);const a=await f.member();const id=await f.create(a.token);
 const old=await f.store.claim(30);await delay(50);assert.equal(await f.store.recoverExpired(),1);
 const current=await f.store.claim();assert.notEqual(old.lease_token,current.lease_token);
 assert.equal(await f.store.settle(old,{status:'succeeded',text:'stale'}),false);
 assert.equal(await f.store.settle(current,{status:'succeeded',text:'current'}),true);
 assert.equal((await f.store.replay({id:a.principalId},id)).filter(e=>e.type==='run.completed').length,1);
});
test('dispatched uncertain work and exhausted attempts stop automatic retries',async(t)=>{
 const f=await fixture(t);const a=await f.member();const id=await f.create(a.token);
 const run=await f.store.claim(30);await f.store.markDispatch(run);await delay(50);await f.store.recoverExpired();
 assert.equal((await f.store.ownedRun({id:a.principalId},id)).status,'failed');assert.equal(await f.store.claim(),null);
 const exhausted=await f.create(a.token);await f.pool.query('UPDATE runs SET attempt=3 WHERE id=$1',[exhausted]);
 await f.store.claim(30);await delay(50);await f.store.recoverExpired();
 assert.equal((await f.store.ownedRun({id:a.principalId},exhausted)).status,'failed');
});
test('actual killed worker process recovers authority without replaying dispatched work',async(t)=>{
 const {spawn}=await import('node:child_process');const {once}=await import('node:events');
 const f=await fixture(t);const a=await f.member();const id=await f.create(a.token);
 const schema=(await f.pool.query('SELECT current_schema() AS schema')).rows[0].schema;
 const child=spawn(process.execPath,[new URL('./worker-process.mjs',import.meta.url).pathname],{env:{PATH:process.env.PATH,TEST_DATABASE_URL:databaseURL,TEST_SCHEMA:schema},stdio:'ignore'});
 t.after(()=>{if(child.exitCode===null)child.kill('SIGKILL');});
 await until(async()=>(await f.store.ownedRun({id:a.principalId},id)).dispatched);
 const exit=once(child,'exit');child.kill('SIGKILL');await exit;await delay(400);
 await f.store.recoverExpired();assert.equal((await f.store.ownedRun({id:a.principalId},id)).status,'failed');
 assert.equal(await f.store.claim(),null);
});
test('teardown failure cannot be recorded as completed and terminal state is unique',async(t)=>{
 const f=await fixture(t);const a=await f.member();const id=await f.create(a.token);
 await workOnce({...f,executorFactory:()=>({execute:async()=>({status:'succeeded',text:'not safe to commit'}),close:async()=>{throw new Error('synthetic teardown failed');}})});
 assert.equal((await f.store.ownedRun({id:a.principalId},id)).status,'failed');
 assert.ok(!(await f.store.replay({id:a.principalId},id)).some(e=>e.type==='run.completed'));
});
test('history cursor uses exact database timestamps and never repeats or leaks rows',async(t)=>{
 const f=await fixture(t);const a=await f.member();const id=await f.create(a.token);const run=await f.store.ownedRun({id:a.principalId},id);
 for(let i=0;i<12;i++)await f.create(a.token,'page '+i,{sessionId:run.session_id});
 const first=await f.store.history({id:a.principalId},{sessionId:run.session_id});assert.equal(first.items.length,10);assert.ok(first.nextCursor);
 const second=await f.store.history({id:a.principalId},{sessionId:run.session_id,after:first.nextCursor});assert.equal(second.items.length,3);
 assert.equal(new Set([...first.items,...second.items].map(r=>r.runId)).size,13);assert.ok(!second.nextCursor);
 const b=await f.member('other');assert.equal((await f.call('/api/ai/sessions?after='+run.session_id,{token:b.token})).status,404);
});
