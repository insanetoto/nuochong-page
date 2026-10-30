import Fastify from 'fastify';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { commands,valid } from '../../../tools/nuochong-cli/src/registry.mjs';
import { Identity,principalDTO,credentialDTO } from './identity.mjs';
import { Store,sessionDTO,runDTO } from './store.mjs';
import { ApiError,requireThat } from './errors.mjs';
export function createApp(pool){
  const app=Fastify({logger:false,bodyLimit:128*1024,genReqId:()=>randomUUID()});
  const identity=new Identity(pool);const store=new Store(pool);const connections=new Set();
  app.addHook('onRequest',async(req,reply)=>{reply.header('cache-control','no-store');reply.header('x-request-id',req.id);});
  app.setErrorHandler((error,req,reply)=>{
    const status=error instanceof ApiError?error.status:error.statusCode>=400&&error.statusCode<500?error.statusCode:500;
    reply.code(status).send({code:error instanceof ApiError?error.code:[400,413,415].includes(status)?'INVALID_INPUT':'REQUEST_FAILED',requestId:req.id});
  });
  app.setNotFoundHandler((req,reply)=>reply.code(404).send({code:'NOT_FOUND',requestId:req.id}));
  const deltaSubscribers=new Map();let listener;
  app.addHook('onReady',async()=>{
    listener=await pool.connect();
    listener.on('error',()=>{for(const response of connections)response.destroy();});
    listener.on('notification',message=>{try{const data=JSON.parse(message.payload);if(typeof data.runId==='string'&&typeof data.text==='string')for(const accept of deltaSubscribers.get(data.runId)??[])accept(data);}catch{ /* Ignore malformed transient notices; durable state remains authoritative. */ }});
    await listener.query('LISTEN oa_delta_'+pool.oaSchema);
  });
  app.addHook('preClose',async()=>{for(const response of connections)response.destroy();if(listener){await listener.query('UNLISTEN *').catch(()=>{});listener.release(true);listener=null;}});
  const config=async()=>{const c=(await pool.query('SELECT * FROM runtime_config WHERE id=1')).rows[0];return {provider:'deepseek-official',model:c.model,clockTool:c.clock_tool,version:c.version};};
  const handlers={
    'auth.me':async(a)=>({...principalDTO(a),scopes:a.scopes}),
    'auth.logout':(a)=>identity.logout(a),
    'auth.principals.list':async(a,i)=>{
      if(i.after)requireThat((await pool.query('SELECT 1 FROM principals WHERE id=$1',[i.after])).rowCount,404,'NOT_FOUND');
      const rows=(await pool.query('SELECT * FROM principals WHERE ($1::text IS NULL OR (created_at,id)<(SELECT created_at,id FROM principals WHERE id=$1)) ORDER BY created_at DESC,id DESC LIMIT 101',[i.after??null])).rows;
      return {items:rows.slice(0,100).map(principalDTO),...(rows.length>100&&{nextCursor:rows[99].id})};
    },
    'auth.principals.create':(a,i)=>identity.createPrincipal(a,i),
    'auth.principals.set-active':(a,i)=>identity.changePrincipal(a,i),
    'auth.principals.set-role':(a,i)=>identity.setRole(a,i),
    'auth.credentials.create':(a,i)=>identity.createCredential(a,i),
    'auth.credentials.list':async(a,i)=>{
      if(i.after)requireThat((await pool.query('SELECT 1 FROM credentials WHERE id=$1',[i.after])).rowCount,404,'NOT_FOUND');
      const rows=(await pool.query('SELECT * FROM credentials WHERE ($1::text IS NULL OR (created_at,id)<(SELECT created_at,id FROM credentials WHERE id=$1)) ORDER BY created_at DESC,id DESC LIMIT 101',[i.after??null])).rows;
      return {items:rows.slice(0,100).map(credentialDTO),...(rows.length>100&&{nextCursor:rows[99].id})};
    },
    'auth.credentials.revoke':(a,i)=>identity.revoke(a,i),
    'sessions.create':(a,i)=>store.createSession(a,i),
    'sessions.list':(a,i)=>store.listSessions(a,i),
    'sessions.get':async(a,i)=>sessionDTO(await store.ownedSession(a,i.sessionId)),
    'sessions.history':(a,i)=>store.history(a,i),
    'runs.create':(a,i)=>store.createRun(a,i),
    'runs.get':async(a,i)=>runDTO(await store.ownedRun(a,i.runId)),
    'runs.cancel':(a,i)=>store.cancel(a,i.runId),
    'models.list':async()=>({items:[{provider:'deepseek-official',model:'deepseek-v4-flash'}]}),
    'models.config.get':config,
    'models.config.update':async(a,i)=>{const result=await pool.query('UPDATE runtime_config SET model=$1,clock_tool=$2,version=version+1 WHERE id=1 AND version=$3 RETURNING model,clock_tool,version',[i.model,i.clockTool,i.expectedVersion]);requireThat(result.rowCount,409,'CONFLICT');const c=result.rows[0];return {provider:'deepseek-official',model:c.model,clockTool:c.clock_tool,version:c.version};},
    'tools.list':async()=>({items:[{name:'current_time',readonly:true,enabled:(await config()).clockTool}]}),
    'runtime.status':async()=>({provider:'deepseek-official',model:(await config()).model,profile:'sdk-minimal',tools:'readonly',apiVersion:'1.1'}),
  };
  for(const command of commands){
    const path=command.path.replace(/\{([^}]+)\}/g,':$1');
    app.route({method:command.method,url:path,handler:async(req,reply)=>{
      const token=/^Bearer (.+)$/.exec(req.headers.authorization??'')?.[1];
      const actor=await identity.authenticate(token);
      if(command.scope!=='authenticated')identity.require(actor,command.scope,command.admin);
      requireThat(req.body===undefined || (req.body!==null && typeof req.body==='object' && !Array.isArray(req.body)),400,'INVALID_INPUT');
      const input={...(req.body??{}),...req.query,...req.params};
      // Path/query/body duplicates and all identity overrides are rejected, never silently merged.
      const fields=[...Object.keys(req.body??{}),...Object.keys(req.query),...Object.keys(req.params)];
      requireThat(new Set(fields).size===fields.length,400,'INVALID_INPUT');
      if(command.streaming&&req.headers['last-event-id']){requireThat(!input.after,400,'INVALID_INPUT');input.after=req.headers['last-event-id'];}
      requireThat(valid(command.inputSchema,input),400,'INVALID_INPUT');
      requireThat(Object.values(input).flat().every(value=>typeof value!=='string'||!value.includes('\0')),400,'INVALID_INPUT');
      if(command.streaming){
        const initial = await store.replay(actor,input.runId,input.after);
        if (!initial.length && input.after) {
          const current = await store.ownedRun(actor,input.runId);
          requireThat(!['succeeded','failed','cancelled'].includes(current.status),409,'STREAM_COMPLETE');
        }
        reply.hijack();const raw=reply.raw;connections.add(raw);
        raw.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-store','x-request-id':req.id,'x-accel-buffering':'no'});
        const pending=[];let pendingBytes=0;
        const accept=data=>{if(raw.destroyed||raw.writableEnded)return;pendingBytes+=Buffer.byteLength(data.text);if(pendingBytes>65536){raw.destroy();return;}pending.push(data);};
        if(!deltaSubscribers.has(input.runId))deltaSubscribers.set(input.runId,new Set());
        deltaSubscribers.get(input.runId).add(accept);
        let after=input.after;let terminal=false;const deadline=Date.now()+180000;
        try{while(!raw.destroyed&&!raw.writableEnded&&!terminal&&Date.now()<deadline){
          await identity.authenticate(token);
          for(const data of pending.splice(0)){pendingBytes-=Buffer.byteLength(data.text);if(!raw.write(`event: run.delta\ndata: ${JSON.stringify(data)}\n\n`)){raw.destroy();break;}}
          if(raw.destroyed)break;
          for(const event of await store.replay(actor,input.runId,after)){
            if(raw.destroyed)break;
            if(!raw.write(`id: ${event.eventId}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)){
              // Disconnect slow clients instead of buffering unbounded data; durable cursor can replay.
              raw.destroy();break;
            }
            after=event.eventId;if(['run.completed','run.failed','run.cancelled'].includes(event.type))terminal=true;
          }
          if(!terminal)await delay(100);
        }}catch{ /* End the stream on revocation or transport failure without exposing diagnostics. */ }finally{connections.delete(raw);deltaSubscribers.get(input.runId)?.delete(accept);if(!deltaSubscribers.get(input.runId)?.size)deltaSubscribers.delete(input.runId);if(!raw.destroyed)raw.end();}
        return;
      }
      const data=await handlers[command.id](actor,input);
      requireThat(valid(command.outputSchema,data),500,'INVALID_RESPONSE');
      await pool.query('INSERT INTO audit(actor_id,action,resource_id,result) VALUES($1,$2,$3,$4)',[actor.id,command.id,input.runId??input.sessionId??input.principalId??null,'allow']);
      return reply.code(command.success[0]).send(data);
    }});
  }
  return {app,store,identity};
}
