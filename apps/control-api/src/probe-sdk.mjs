import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { HarnessExecution } from './runtime.mjs';
const stateRoot=mkdtempSync(resolve(tmpdir(),'oa-sdk-probe-'));
const execution=new HarnessExecution({owner_id:randomUUID(),session_id:randomUUID(),native_started:false,config:{clockTool:true,model:'deepseek-v4-flash'}},{stateRoot});
try {await execution.harness.start();console.log(JSON.stringify({passed:true,realSDKBoot:true,profile:'sdk-minimal',modelCalls:0}));}
finally {await execution.close();rmSync(stateRoot,{recursive:true,force:true});}
