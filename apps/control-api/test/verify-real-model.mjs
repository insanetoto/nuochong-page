import { loadEnvFile } from 'node:process';
import { existsSync,mkdtempSync,rmSync,mkdirSync,writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { poolFor,migrate } from '../src/db.mjs';
import { createApp } from '../src/app.mjs';
import { MEMBER_SCOPES } from '../src/identity.mjs';
import { workOnce,productionExecutor } from '../src/worker.mjs';
import { HarnessExecution } from '../src/runtime.mjs';
// Local-only credential reuse; never copied to CI, database, output or artifacts.
const envFile=new URL('../../../experiments/phase-a/runtime/.env.local',import.meta.url);
if(!process.env.DEEPSEEK_API_KEY&&existsSync(envFile))loadEnvFile(envFile);
if(!process.env.DEEPSEEK_API_KEY||!process.env.TEST_DATABASE_URL)throw new Error('A local model credential and isolated PostgreSQL URL are required.');
const schema='oa_real_'+randomUUID().replaceAll('-','');const pool=poolFor(process.env.TEST_DATABASE_URL,schema);
const stateRoot=mkdtempSync(resolve(tmpdir(),'oa-real-control-'));let app;let phase='initialize';let latestExecution;
const report={time:new Date().toISOString(),node:process.version,platform:process.platform,provider:'deepseek-official',model:'deepseek-v4-flash',scope:'Real API + PostgreSQL + restricted official SDK, separate owned process per turn',cost:'unknown; no verified billing amount',submittedTurns:0};
try{
 await migrate(pool,schema);const f=createApp(pool);app=f.app;await app.listen({host:'127.0.0.1',port:0});
 const admin=await f.identity.bootstrap('synthetic acceptance administrator');const adminActor=await f.identity.authenticate(admin.token);
 const p=await f.identity.createPrincipal(adminActor,{name:'synthetic model user',kind:'user',role:'member'});
 const credential=await f.identity.createCredential(adminActor,{principalId:p.principalId,scopes:MEMBER_SCOPES,expiresAt:new Date(Date.now()+3600000).toISOString()});
 const actor=await f.identity.authenticate(credential.token);const headers={authorization:'Bearer '+credential.token,'content-type':'application/json'};
 const submit=async(prompt,sessionId)=>{
  const response=await fetch(app.listeningOrigin+'/api/ai/runs',{method:'POST',headers,body:JSON.stringify({prompt,idempotencyKey:randomUUID(),...(sessionId&&{sessionId})})});assert.equal(response.status,202);return (await response.json()).runId;
 };
 let cancelRunId;let cancelRequest;
 const execute=async()=>{
  const result=await workOnce({...f,executorFactory:run=>latestExecution=new HarnessExecution(run,{stateRoot,apiKey:process.env.DEEPSEEK_API_KEY,onDelta:()=>{
    if(cancelRunId && !cancelRequest)cancelRequest=fetch(app.listeningOrigin+'/api/ai/runs/'+cancelRunId+'/cancel',{method:'POST',headers,body:'{}'});
  }})});assert.ok(result);report.submittedTurns++;
 };
 phase='real-default-model-and-readonly-tool';const marker='OA_CONTROL_'+randomUUID().slice(0,8);
 const id=await submit(`Call current_time exactly once, then reply with only ${marker}.`);await execute();
 const first=await f.store.ownedRun(actor,id);assert.equal(first.status,'succeeded');assert.ok(first.output.includes(marker));
 assert.ok((await pool.query("SELECT 1 FROM audit WHERE resource_id=$1 AND action='tool:current_time' AND result='allow'",[id])).rowCount);
 phase='new-host-restored-session-history';const secondId=await submit('What exact OA_CONTROL_ marker did I ask you to return in my previous message? Reply only with that marker.',first.session_id);await execute();
 const second=await f.store.ownedRun(actor,secondId);assert.equal(second.status,'succeeded');assert.ok(second.output.includes(marker));
 phase='cancel-real-model-on-first-stream-delta';
 cancelRunId=await submit('Write the numbers from 1 to 4000, one per line. Do not call tools.',first.session_id);await execute();
 assert.ok(cancelRequest);assert.equal((await cancelRequest).status,200);
 assert.equal((await f.store.ownedRun(actor,cancelRunId)).status,'cancelled');cancelRunId=undefined;
 phase='restore-interrupted-native-session-in-new-host';
 const recoveredId=await submit('Ignore the interrupted counting task. What exact OA_CONTROL_ marker was in my first message? Reply only with the marker.',first.session_id);await execute();
 const recovered=await f.store.ownedRun(actor,recoveredId);assert.equal(recovered.status,'succeeded');assert.ok(recovered.output.includes(marker));
 const history=await f.store.history(actor,{sessionId:first.session_id});assert.equal(history.items.length,4);
 phase='production-worker-token-sse';
 const streamedId=await submit('Write the integers from 1 to 60, one per line. Do not use tools.',first.session_id);
 const stream=await fetch(app.listeningOrigin+'/api/ai/runs/'+streamedId+'/events',{headers});assert.equal(stream.status,200);
 await workOnce({...f,executorFactory:productionExecutor({stateRoot,apiKey:process.env.DEEPSEEK_API_KEY,pool})});report.submittedTurns++;
 const frames=await stream.text();assert.match(frames,/event: run.delta/);assert.match(frames,/event: run.completed/);
 assert.equal((await f.store.ownedRun(actor,streamedId)).status,'succeeded');
 Object.assign(report,{passed:true,realTokenSSE:true,realDefaultModel:true,readonlyToolAudited:true,newHostSessionRestored:true,realCancellation:true,interruptedSessionRestored:true,sameActorPrivateHistory:true});
}catch{Object.assign(report,{passed:false,phase,sdkFailureCategory:latestExecution?.failureCategory??null});process.exitCode=1;}
finally{
 await app?.close();await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);await pool.end();rmSync(stateRoot,{recursive:true,force:true});
 const out=new URL('../outputs/',import.meta.url);mkdirSync(out,{recursive:true});writeFileSync(new URL('real-model.json',out),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}
