import { setTimeout as delay } from 'node:timers/promises';
import { HarnessExecution } from './runtime.mjs';
export async function workOnce({store,identity,executorFactory,leaseMs=5000,timeoutMs=120000,signal}){
  await store.recoverExpired();
  const run=await store.claim(leaseMs); if(!run)return false;
  let executor;let revoked=false;let stale=false;let timedOut=false;let cancelled=false;let busy=false;
  const abort=async()=>{await executor?.close();};
  const heartbeat=setInterval(async()=>{
    if(busy)return;busy=true;
    try{
      const live=await store.heartbeat(run,leaseMs);
      if(!live){stale=true;await abort();}
      else if(live.cancel_requested){cancelled=true;await abort();}
      else if(!await identity.stillValid(run.credential_id)){revoked=true;await abort();}
    }catch{stale=true;await abort();}finally{busy=false;}
  },Math.max(50,Math.floor(leaseMs/4)));
  const stop=()=>{stale=true;abort().catch(()=>{});};
  signal?.addEventListener('abort',stop,{once:true});
  const timer=setTimeout(()=>{timedOut=true;abort().catch(()=>{});},timeoutMs);
  try{
    if(!await identity.stillValid(run.credential_id)){await store.settle(run,{status:'cancelled',errorCode:'unauthorized'});return true;}
    if(!await store.markDispatch(run)){await store.settle(run,{status:'cancelled'});return true;}
    executor=executorFactory(run);
    const result=await executor.execute();
    await executor.close();
    for(const name of result.toolCalls??[])await store.pool.query(`INSERT INTO audit(actor_id,action,resource_id,result)
      SELECT owner_id,$3,id,$4 FROM runs WHERE id=$1 AND lease_token=$2 AND status='running' AND lease_until>clock_timestamp()`,
      [run.id,run.lease_token,name==='current_time'?'tool:current_time':'tool:unknown',name==='current_time'?'allow':'deny']);
    if(!stale)await store.settle(run,revoked?{status:'cancelled',errorCode:'unauthorized'}:
      timedOut?{status:'failed',errorCode:'timeout'}:cancelled?{status:'cancelled'}:result);
  }catch{if(!stale)await store.settle(run,{status:'failed',errorCode:'unavailable'});}
  finally{clearInterval(heartbeat);clearTimeout(timer);signal?.removeEventListener('abort',stop);await executor?.close().catch(()=>{});}
  return true;
}
export function productionExecutor({stateRoot,apiKey,pool}){return run=>{
  let pending='';let timer;let delivery=Promise.resolve();
  const flush=()=>{
    clearTimeout(timer);timer=undefined;const chars=[...pending];pending='';
    for(let index=0;index<chars.length;index+=400){const data=JSON.stringify({runId:run.id,text:chars.slice(index,index+400).join('')});
      delivery=delivery.then(()=>pool.query('SELECT pg_notify($1,$2)',['oa_delta_'+pool.oaSchema,data])).catch(()=>{});
    }
  };
  const inner=new HarnessExecution(run,{stateRoot,apiKey,onDelta:text=>{if(typeof text==='string'&&pending.length+text.length<=20000){pending+=text;timer??=setTimeout(flush,50);}}});
  return {execute:async()=>{const result=await inner.execute();flush();await delivery;return result;},close:async()=>{clearTimeout(timer);pending='';await inner.close();await delivery;}};
};}
export async function workLoop(options,signal){while(!signal.aborted){try{if(!await workOnce({...options,signal}))await delay(100,undefined,{signal});}catch{if(signal.aborted)break;await delay(250,undefined,{signal}).catch(()=>{});}}}
