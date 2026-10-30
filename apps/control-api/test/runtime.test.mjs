import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {HarnessExecution} from '../src/runtime.mjs';
test('SDK idle/child completion/token exhaustion/error never become root success',async()=>{
 const root=mkdtempSync(resolve(tmpdir(),'oa-terminal-'));const sessionId=randomUUID();
 try{for(const notifications of [
  [{method:'session.status',params:{sessionId,status:'idle'}}],
  [{method:'session.event',params:{sessionId:'child',event:{type:'turn/end',data:{reason:{kind:'completed'}}}}}],
  [{method:'session.event',params:{sessionId,event:{type:'turn/end',data:{reason:{kind:'maxTokens'}}}}}],
  [{method:'session.event',params:{sessionId,event:{type:'turn/end',data:{reason:{kind:'error'}}}}}],
 ]){
  const execution=new HarnessExecution({owner_id:randomUUID(),session_id:sessionId,config:{model:'deepseek-v4-flash',clockTool:false}},{stateRoot:root});
  execution.harness={run:async()=>({sessionId,finalResponse:'not success',notifications}),close:async()=>{}};
  assert.equal((await execution.execute()).status,'failed');
 }}finally{rmSync(root,{recursive:true,force:true});}
});
