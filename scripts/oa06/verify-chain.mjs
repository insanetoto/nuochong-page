import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import assert from 'node:assert/strict';
import {Client} from '../../tools/nuochong-mcp/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js';
import {StdioClientTransport} from '../../tools/nuochong-mcp/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js';
import {poolFor,migrate} from '../../apps/control-api/src/db.mjs';
import {createApp} from '../../apps/control-api/src/app.mjs';
import {MEMBER_SCOPES} from '../../apps/control-api/src/identity.mjs';
import {workOnce,productionExecutor} from '../../apps/control-api/src/worker.mjs';
const exec=promisify(execFile);assert.ok(process.env.TEST_DATABASE_URL&&process.env.DEEPSEEK_API_KEY);
const schema='oa_e2e_'+randomUUID().replaceAll('-','');const pool=poolFor(process.env.TEST_DATABASE_URL,schema);const root=mkdtempSync(join(tmpdir(),'oa06-real-'));let app,client;
const report={scope:'Synthetic user; real CLI -> API -> PostgreSQL -> official SDK and DeepSeek -> MCP -> same API and database',realModelTurns:0,cost:'unknown'};
try{
 await migrate(pool,schema);const ctx=createApp(pool);app=ctx.app;await app.listen({host:'127.0.0.1',port:0});
 const bootstrap=await ctx.identity.bootstrap('synthetic administrator');const admin=await ctx.identity.authenticate(bootstrap.token);
 const member=await ctx.identity.createPrincipal(admin,{name:'synthetic end-to-end user',kind:'user',role:'member'});
 const credential=await ctx.identity.createCredential(admin,{principalId:member.principalId,scopes:MEMBER_SCOPES,expiresAt:new Date(Date.now()+3600000).toISOString()});
 const env={PATH:process.env.PATH,NUOCHONG_API_URL:app.listeningOrigin,NUOCHONG_ACCESS_TOKEN:credential.token};
 const marker='OA06_'+randomUUID().slice(0,8);
 const args=['tools/nuochong-cli/bin/nuochong.mjs','runs','create','--input',JSON.stringify({prompt:`Reply with exactly ${marker}. Do not use tools.`,idempotencyKey:randomUUID()})];
 const submitted=JSON.parse((await exec(process.execPath,args,{env,timeout:30000})).stdout);assert.equal(submitted.ok,true);const id=submitted.data.runId;
 assert.ok(await workOnce({...ctx,executorFactory:productionExecutor({stateRoot:root,apiKey:process.env.DEEPSEEK_API_KEY,pool})}));report.realModelTurns++;
 const result=JSON.parse((await exec(process.execPath,['tools/nuochong-cli/bin/nuochong.mjs','runs','get','--run-id',id],{env,timeout:30000})).stdout);assert.equal(result.data.status,'succeeded');
 const actor=await ctx.identity.authenticate(credential.token);const run=await ctx.store.ownedRun(actor,id);assert.ok(run.output.includes(marker));
 const transport=new StdioClientTransport({command:process.execPath,args:['tools/nuochong-mcp/src/server.mjs'],env:{...env,NUOCHONG_MCP_COMMANDS:'runs.get,sessions.history'},stderr:'pipe'});
 client=new Client({name:'oa06-check',version:'1.0'});await client.connect(transport);
 const fetched=await client.callTool({name:'runs.get',arguments:{runId:id}});assert.equal(fetched.structuredContent.status,'succeeded');assert.equal(fetched.structuredContent.runId,id);
 const history=await client.callTool({name:'sessions.history',arguments:{sessionId:run.session_id}});assert.ok(history.structuredContent.items.some(item=>item.runId===id&&item.response.includes(marker)));
 const other=await ctx.identity.createPrincipal(admin,{name:'synthetic other',kind:'user',role:'member'});const otherCred=await ctx.identity.createCredential(admin,{principalId:other.principalId,scopes:MEMBER_SCOPES,expiresAt:new Date(Date.now()+3600000).toISOString()});
 const denied=await fetch(app.listeningOrigin+'/api/ai/runs/'+id,{headers:{authorization:'Bearer '+otherCred.token}});assert.equal(denied.status,404);
 Object.assign(report,{passed:true,cliSubmit:true,realModelSucceeded:true,mcpRunAndHistory:true,crossOwnerDenied:true});
}catch(e){report.passed=false;report.errorType=e.constructor.name;process.exitCode=1;}
finally{await client?.close();await app?.close();await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);await pool.end();rmSync(root,{recursive:true,force:true});console.log(JSON.stringify(report));}
