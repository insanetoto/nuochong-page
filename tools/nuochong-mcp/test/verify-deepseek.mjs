import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {poolFor,migrate} from '../../../apps/control-api/src/db.mjs';
import {createApp} from '../../../apps/control-api/src/app.mjs';
import {MEMBER_SCOPES} from '../../../apps/control-api/src/identity.mjs';
import {fileURLToPath} from 'node:url';
assert.ok(process.env.TEST_DATABASE_URL && process.env.DEEPSEEK_API_KEY);
const schema='oa_ai_'+randomUUID().replaceAll('-','');const pool=poolFor(process.env.TEST_DATABASE_URL,schema);let app,client;
try{
 await migrate(pool,schema);const ctx=createApp(pool);app=ctx.app;await app.listen({host:'127.0.0.1',port:0});
 const bootstrap=await ctx.identity.bootstrap('synthetic administrator');const admin=await ctx.identity.authenticate(bootstrap.token);
 const member=await ctx.identity.createPrincipal(admin,{name:'synthetic external client',kind:'service',role:'member'});
 const credential=await ctx.identity.createCredential(admin,{principalId:member.principalId,scopes:MEMBER_SCOPES,expiresAt:new Date(Date.now()+3600000).toISOString()});
 const transport=new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('../src/server.mjs',import.meta.url))],env:{PATH:process.env.PATH,NUOCHONG_API_URL:app.listeningOrigin,NUOCHONG_ACCESS_TOKEN:credential.token,NUOCHONG_MCP_COMMANDS:'auth.me,models.list'}});
 client=new Client({name:'deepseek-mcp-host',version:'1.0.0'});await client.connect(transport);const {tools}=await client.listTools();
 const defs=tools.map(t=>({type:'function',function:{name:t.name.replaceAll('.','_'),description:t.description,parameters:t.inputSchema}}));
 const messages=[{role:'user',content:'Use the available tools to check my identity and list the available models. Return only the identity role and model name.'}];let called=[];let requests=0;
 for(let i=0;i<4;i++){
  requests++;const response=await fetch('https://api.deepseek.com/chat/completions',{method:'POST',headers:{authorization:'Bearer '+process.env.DEEPSEEK_API_KEY,'content-type':'application/json'},body:JSON.stringify({model:'deepseek-flash',thinking:{type:'disabled'},messages,tools:defs,max_tokens:512}),signal:AbortSignal.timeout(60000)});
  if(!response.ok)throw new Error('DeepSeek returned HTTP '+response.status);
  const data=await response.json();const message=data.choices[0].message;messages.push(message);
  if(!message.tool_calls?.length)break;
  for(const call of message.tool_calls){const tool=tools.find(t=>t.name.replaceAll('.','_')===call.function.name);assert.ok(tool);const result=await client.callTool({name:tool.name,arguments:JSON.parse(call.function.arguments)});assert.ok(!result.isError);called.push(tool.name);messages.push({role:'tool',tool_call_id:call.id,content:JSON.stringify(result.structuredContent)});}
 }
 assert.ok(called.includes('auth.me')&&called.includes('models.list'));assert.equal(messages.at(-1).role,'assistant');
 console.log(JSON.stringify({passed:true,provider:'deepseek',model:'deepseek-flash',scope:'real model tool calls through MCP stdio to real control API and PostgreSQL',called:[...new Set(called)],cost:'unknown',modelRequests:requests}));
}finally{await client?.close();await app?.close();await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);await pool.end();}
