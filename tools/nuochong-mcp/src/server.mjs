#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { commands, CONTRACT_VERSION } from '../../nuochong-cli/src/registry.mjs';
import { configuration, plan, request, jsonResult, CliError } from '../../nuochong-cli/src/client.mjs';
// The local operator chooses exposure; the API remains the authorization authority.
export const permitted=commands.filter(c=>!c.streaming && !c.admin && c.scope!=='auth:manage' && (c.sideEffect==='none'||['runs.create','runs.cancel','sessions.create'].includes(c.id)));
export function createMcp(env=process.env){
 const config=configuration({},env);
 const ids=env.NUOCHONG_MCP_COMMANDS?.split(',');
 if(ids?.some(id=>!permitted.some(c=>c.id===id)))throw new Error('Invalid MCP allowlist.');
 const exposed=permitted.filter(c=>ids?ids.includes(c.id):c.sideEffect==='none');
 if(!exposed.length)throw new Error('Empty MCP allowlist.');
 const server=new Server({name:'nuochong',version:'0.1.0'},{capabilities:{tools:{}}});
 server.setRequestHandler(ListToolsRequestSchema,async()=>({tools:exposed.map(c=>({name:c.id,title:c.argv.join(' '),
  description:`OA contract ${CONTRACT_VERSION}. ${c.sideEffect}. Calls the authorized company API; no automatic retry.`,
  inputSchema:c.inputSchema,outputSchema:c.outputSchema,
  annotations:{readOnlyHint:c.sideEffect==='none',destructiveHint:c.id==='runs.cancel',idempotentHint:c.idempotency==='read'||c.idempotency==='server-idempotent'||c.id==='runs.create',openWorldHint:true},
  _meta:{commandId:c.id,contractVersion:CONTRACT_VERSION}}))}));
 server.setRequestHandler(CallToolRequestSchema,async(req,extra)=>{
  const command=exposed.find(c=>c.id===req.params.name);
  const fail=(code)=>({isError:true,content:[{type:'text',text:JSON.stringify({ok:false,code})}]});
  if(!command)return fail('FEATURE_NOT_AVAILABLE');
  const controller=new AbortController();const cancel=()=>controller.abort(new CliError('INTERRUPTED',130,'MCP request cancelled; remote operation was not automatically cancelled.'));
  const timer=setTimeout(()=>controller.abort(new CliError('TIMEOUT',11,'MCP deadline elapsed.')),30000);
  extra.signal.addEventListener('abort',cancel,{once:true});if(extra.signal.aborted)cancel();
  try{
   const input=req.params.arguments??{};plan(command,input);
   const {response}=await request(command,input,config,controller.signal);
   const data=await jsonResult(command,response);
   return {content:[{type:'text',text:JSON.stringify(data)}],structuredContent:data};
  }catch(e){return fail(e instanceof CliError?e.code:'UNAVAILABLE');}
  finally{clearTimeout(timer);extra.signal.removeEventListener('abort',cancel);}
 });
 return server;
}
if(import.meta.url===new URL(process.argv[1],'file:').href){
 try{const server=createMcp();await server.connect(new StdioServerTransport());}
 catch{process.stderr.write('nuochong-mcp: configuration/startup failed.\n');process.exitCode=1;}
}
