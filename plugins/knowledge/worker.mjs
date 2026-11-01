import {setTimeout as delay} from 'node:timers/promises';import {rmSync} from 'node:fs';import {resolve} from 'node:path';
import {HarnessExecution} from '../../apps/control-api/src/runtime.mjs';
const safeErrors=new Set(['EVIDENCE_CHANGED','SOURCE_SUPERSEDED','UNAUTHORIZED','FORBIDDEN','CANCELLED','STALE_WORKER','VERSION_CONFLICT','INVALID_CITATION','CITATION_MARKER_REQUIRED','OBJECT_CORRUPT','OBJECT_MISSING','DEPENDENCY_UNAVAILABLE','MODEL_UNAVAILABLE','INVALID_MODEL_RESPONSE','MODEL_TIMEOUT','TOOL_NOT_ALLOWED']);
const codeOf=error=>safeErrors.has(error?.code)?error.code:safeErrors.has(error?.message)?error.message:'UNAVAILABLE';
export async function workKnowledgeOnce({jobs,stateRoot,apiKey,executorFactory,signal,leaseMs=5000,timeoutMs=120000}){
 const job=await jobs.claim(leaseMs);if(!job)return false;
 let executor,prepared,failure,busy=false;const stop=async code=>{failure??=code;await executor?.close().catch(()=>{});};
 const heartbeat=setInterval(async()=>{if(busy)return;busy=true;try{await jobs.heartbeat(job,leaseMs);}catch(error){await stop(codeOf(error));}finally{busy=false;}},Math.max(50,Math.floor(leaseMs/4)));
 const cancel=()=>{stop('CANCELLED').catch(()=>{});};signal?.addEventListener('abort',cancel,{once:true});
 const timer=setTimeout(()=>{stop('MODEL_TIMEOUT').catch(()=>{});},timeoutMs);
 try{
  prepared=await jobs.prepare(job);if(signal?.aborted)failure='CANCELLED';
  if(failure)await jobs.fail(job,failure);
  else if(prepared.immediate)await jobs.complete(job,prepared.immediate,{modelUsed:false});
  else{
   if(!apiKey&&!executorFactory){const error=new Error('MODEL_UNAVAILABLE');throw error;}
   executor=executorFactory?executorFactory(prepared.run,prepared.maxTokens):new HarnessExecution(prepared.run,{stateRoot,apiKey,maxTokens:prepared.maxTokens});
   if(!await jobs.markDispatched(job)){await stop('CANCELLED');await jobs.fail(job,'CANCELLED');return true;}
   const result=await executor.execute();
   if(failure)await jobs.fail(job,failure);
   else if(result.status!=='succeeded')await jobs.fail(job,'MODEL_UNAVAILABLE');
   else if(result.toolCalls?.length)await jobs.fail(job,'TOOL_NOT_ALLOWED');
   else await jobs.complete(job,result.text);
  }
 }catch(error){await jobs.fail(job,failure??codeOf(error));}
 finally{
  clearInterval(heartbeat);clearTimeout(timer);signal?.removeEventListener('abort',cancel);await executor?.close().catch(()=>{});
  if(stateRoot&&prepared?.run)rmSync(resolve(stateRoot,prepared.run.owner_id,prepared.run.session_id),{recursive:true,force:true});
 }
 return true;
}
export async function knowledgeLoop(options,signal){while(!signal.aborted){try{if(!await workKnowledgeOnce({...options,signal}))await delay(200,undefined,{signal});}catch{if(!signal.aborted)await delay(500,undefined,{signal}).catch(()=>{});}}}
