import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {poolFor,migrate} from '../../../apps/control-api/src/db.mjs';
import {createApp} from '../../../apps/control-api/src/app.mjs';
import {MEMBER_SCOPES} from '../../../apps/control-api/src/identity.mjs';
import {commands} from '../../nuochong-cli/src/registry.mjs';
import {fileURLToPath} from 'node:url';
const source=fileURLToPath(new URL('../src/server.mjs',import.meta.url));
export async function fixture(t){
 assert.ok(process.env.TEST_DATABASE_URL,'Real isolated PostgreSQL is required.');
 const schema='oa_mcp_'+randomUUID().replaceAll('-','');const pool=poolFor(process.env.TEST_DATABASE_URL,schema);await migrate(pool,schema);
 const {app,identity}=createApp(pool);await app.listen({host:'127.0.0.1',port:0});
 const secret=await identity.bootstrap('synthetic admin');const admin=await identity.authenticate(secret.token);
 const p=await identity.createPrincipal(admin,{name:'synthetic service',kind:'service',role:'member'});
 const credential=await identity.createCredential(admin,{principalId:p.principalId,scopes:MEMBER_SCOPES,expiresAt:new Date(Date.now()+3600000).toISOString()});
 const connect=async({token=credential.token,allow}={})=>{
  const transport=new StdioClientTransport({command:process.execPath,args:[source],env:{PATH:process.env.PATH,NUOCHONG_API_URL:app.listeningOrigin,NUOCHONG_ACCESS_TOKEN:token,...(allow&&{NUOCHONG_MCP_COMMANDS:allow})},stderr:'pipe'});
  const client=new Client({name:'nuochong-independent-client',version:'1.0.0'});await client.connect(transport);t.after(()=>client.close());return client;
 };
 t.after(async()=>{await app.close();await pool.query(`DROP SCHEMA ${schema} CASCADE`);await pool.end();});
 return {pool,identity,admin,credential,connect,origin:app.listeningOrigin};
}
test('real stdio MCP discovers unchanged schemas and read-only defaults, no admin/owner backdoor',async t=>{
 const f=await fixture(t);const client=await f.connect();const {tools}=await client.listTools();
 assert.ok(tools.length>5);for(const tool of tools){const c=commands.find(c=>c.id===tool.name);assert.equal(c.sideEffect,'none');assert.deepEqual(tool.inputSchema,c.inputSchema);assert.deepEqual(tool.outputSchema,c.outputSchema);}
 assert.ok(!tools.some(t=>t.name.includes('credentials')||t.name==='models.config.update'));
 assert.equal((await client.callTool({name:'auth.me',arguments:{}})).structuredContent.role,'member');
 assert.equal((await client.callTool({name:'runs.create',arguments:{prompt:'x',idempotencyKey:'x'}})).isError,true);
 assert.equal((await f.pool.query('SELECT count(*)::int AS n FROM runs')).rows[0].n,0);
});
test('explicit writes reuse real API idempotency, ownership, validation and revocation',async t=>{
 const f=await fixture(t);const client=await f.connect({allow:'runs.create,runs.get,runs.cancel,sessions.history,auth.me'});
 const args={prompt:'synthetic MCP task',idempotencyKey:randomUUID()};
 const a=await client.callTool({name:'runs.create',arguments:args});assert.ok(!a.isError);
 const b=await client.callTool({name:'runs.create',arguments:args});assert.equal(a.structuredContent.runId,b.structuredContent.runId);
 assert.equal((await client.callTool({name:'runs.create',arguments:{...args,actorId:'forged'}})).isError,true);
 const other=await f.connect({token:(await f.identity.issue(f.pool,f.admin,MEMBER_SCOPES,new Date(Date.now()+3600000))).token,allow:'runs.get'});
 assert.equal((await other.callTool({name:'runs.get',arguments:{runId:a.structuredContent.runId}})).isError,true);
 await f.identity.revoke(f.admin,{credentialId:f.credential.credentialId});
 const denied=await client.callTool({name:'auth.me',arguments:{}});assert.equal(denied.isError,true);assert.ok(JSON.stringify(denied).includes('UNAUTHORIZED'));assert.ok(!JSON.stringify(denied).includes(f.credential.token));
 assert.equal((await f.pool.query('SELECT count(*)::int AS n FROM runs')).rows[0].n,1);
});
