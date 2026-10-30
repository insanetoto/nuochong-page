import { DeepSeekHarness } from '@deepseek-ai/dsh-sdk-client';
import { mkdirSync,writeFileSync } from 'node:fs';
import { dirname,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
export class HarnessExecution {
  constructor(run,{stateRoot,apiKey,onDelta=()=>{},onTool=()=>{}}){
    this.toolCalls=[];this.run=run;this.onDelta=onDelta;this.onTool=onTool;
    const home=resolve(stateRoot,run.owner_id,run.session_id);
    for(const directory of ['workspace','tmp','native-cache'])mkdirSync(resolve(home,directory),{recursive:true,mode:0o700});
    const patch=resolve(home,'restricted.patch.yml');
    const disabled=['tool-fs','tool-working-directory','persistent-bash','persistent-pwsh','sdk-jsonrpc-server'];
    writeFileSync(patch,disabled.map(id=>`- id: ${id}\n  disabled: true\n`).join('')+
      '- id: llm-deepseek\n  config:\n    apiKeyEnv: DEEPSEEK_API_KEY\n    retryPolicy:\n      mode: normal\n      maxRetries: 0\n'+
      `- insert:\n    - id: oa-stream-bridge\n      name: ${JSON.stringify(resolve(root,'src/stream-bridge.mjs'))}\n`+
      (run.config.clockTool?`    - id: oa-readonly-clock\n      name: ${JSON.stringify(resolve(root,'src/clock-tool.mjs'))}\n`:''),{mode:0o600});
    this.harness=new DeepSeekHarness({profile:'sdk-minimal',patches:[patch],provider:'deepseek-official',model:run.config.model,maxTokens:512,
      dshHome:resolve(home,'dsh'),cwd:resolve(home,'workspace'),processCwd:root,
      env:{PATH:dirname(process.execPath)+':'+(process.env.PATH??''),HOME:home,TMPDIR:resolve(home,'native-cache'),LANG:'en_US.UTF-8',TERM:'dumb',
        DEEPSEEK_API_KEY:apiKey??'',DSH_SYSTEM_PROMPT:'You are the company OA assistant. Only the explicitly registered read-only tools are permitted.'},
      initializeTimeoutMs:20000,shutdownTimeoutMs:1000,disposeEofGraceMs:1000,disposeGraceMs:1000});
  }
  async close(){return this.closing??=this.harness.close();}
  async execute(){
    try{
      if(this.run.native_started)await this.harness.resumeSession(this.run.session_id);
      const result=await this.harness.run(this.run.prompt,{sessionId:this.run.session_id,onNotification:(n)=>{
        if(n.params?.sessionId!==this.run.session_id)return;
        const frame=n.params?.frame;
        if(n.method==='nuochong.assistant.stream'&&frame?.type==='chunk'&&frame.chunk?.type==='text-delta')this.onDelta(frame.chunk.text??frame.chunk.delta??'');
        if(n.method==='session.event'&&n.params.event?.type==='tool/call'){
          const name=n.params.event.data?.name;this.toolCalls.push(name==='current_time'?'current_time':'unknown');this.onTool(name);
        }
      }});
      const reason=result.notifications?.filter(n=>n.method==='session.event'&&n.params.sessionId===result.sessionId&&n.params.event?.type==='turn/end').at(-1)?.params.event.data.reason;
      return reason?.kind==='completed'?{status:'succeeded',text:result.finalResponse,toolCalls:this.toolCalls}:{status:'failed',errorCode:'provider_error'};
    }catch(error){this.failureCategory=error.constructor.name;return {status:'failed',errorCode:'unavailable'};}
    finally{await this.close();}
  }
}
