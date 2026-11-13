import {KnowledgeJobs} from '../../../plugins/knowledge/jobs.mjs';
import {ImportService} from '../../../plugins/knowledge/imports.mjs';
import {KnowledgeService} from '../../../plugins/knowledge/service.mjs';
import {resolve} from 'node:path';
import {commands,valid} from '../../../tools/nuochong-cli/src/registry.mjs';
import {AccessKernel} from '../../../plugins/access-management/service.mjs';
import {OrganizationService} from '../../../plugins/organization/service.mjs';
import {requireThat} from './errors.mjs';
export function registerProduct(app,{pool,identity,publicOrigin,cookiePath,objectRoot=resolve('apps/control-api/.state/product-objects')}){
 const kernel=new AccessKernel(pool,identity),organization=new OrganizationService(kernel);
 const knowledge=new KnowledgeService(kernel,objectRoot);
 const jobs=new KnowledgeJobs(kernel,knowledge);
 const imports=new ImportService(kernel,knowledge);
 const sessionPath=cookiePath??(publicOrigin?new URL(publicOrigin).pathname.replace(/\/$/,'')+'/':'/product/');
 if(!/^\/(?:[A-Za-z0-9_-]+\/)*product\/$/.test(sessionPath))throw new Error('Invalid product cookie path');
 const trustedOrigin=()=>publicOrigin?new URL(publicOrigin).origin:app.listeningOrigin;
 app.addContentTypeParser('multipart/form-data',{parseAs:'buffer',bodyLimit:21*1024*1024},(_req,body,done)=>done(null,body));
 for(const command of commands.filter(c=>c.product))app.post(command.path,async(req,reply)=>{
  if(command.id==='knowledge.objects.upload.v1'){
   const contentType=req.headers['content-type']??'';const boundary=/boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType)?.[1]??/boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType)?.[2];
   requireThat(boundary&&Buffer.isBuffer(req.body),400,'INVALID_INPUT');
   const parts=[];const delimiter=Buffer.from('--'+boundary);let start=req.body.indexOf(delimiter);requireThat(start>=0,400,'INVALID_INPUT');
   while(start>=0){start+=delimiter.length;if(req.body.subarray(start,start+2).toString()==='--')break;if(req.body.subarray(start,start+2).toString()==='\r\n')start+=2;const next=req.body.indexOf(delimiter,start);requireThat(next>start,400,'INVALID_INPUT');parts.push(req.body.subarray(start,next));start=next;}
   let metadata,bytes;
   for(const part of parts){const headerEnd=part.indexOf(Buffer.from('\r\n\r\n'));if(headerEnd<0)continue;const headers=part.subarray(0,headerEnd).toString('utf8');const body=part.subarray(headerEnd+4,-2);if(/name="metadata"/.test(headers))metadata=JSON.parse(body.toString('utf8'));else if(/name="file"/.test(headers))bytes=body;}
   requireThat(metadata&&bytes,400,'INVALID_INPUT');req.body=metadata;req.uploadBytes=bytes;
  }
  const pending=[{value:req.body,depth:0}];let nodes=0;
  while(pending.length){const {value,depth}=pending.pop();requireThat(depth<=16&&++nodes<=10000,400,'INVALID_INPUT');
   if(typeof value==='string')requireThat(!value.includes('\0'),400,'INVALID_INPUT');
   else if(value&&typeof value==='object')for(const child of Object.values(value))pending.push({value:child,depth:depth+1});
  }
  requireThat(valid(command.inputSchema,req.body),400,'INVALID_INPUT');
  requireThat(Object.keys(req.query).length===0,400,'INVALID_INPUT');
  const origin=req.headers.origin;const bearer=/^Bearer (.+)$/.exec(req.headers.authorization??'')?.[1];
  const cookie=/(?:^|;\s*)product_session=([^;]+)/.exec(req.headers.cookie??'')?.[1];
  if(origin)requireThat(origin===trustedOrigin(),403,'INVALID_ORIGIN');
  if(command.id==='identity.login.v1'){
   if(req.body.delivery==='cookie')requireThat(origin===trustedOrigin(),403,'INVALID_ORIGIN');
   const data=await kernel.login(req.body);requireThat(data,401,'UNAUTHORIZED');
   if(req.body.delivery==='cookie'){
    const path=sessionPath;
    // The public gateway prefix is part of publicOrigin; cookies do not authorize Native owner routes.
    reply.header('set-cookie',`product_session=${data.token}; Path=${path}; HttpOnly; SameSite=Strict; Max-Age=14400${trustedOrigin().startsWith('https:')?'; Secure':''}`);
    data.token='';
   }
   return data;
  }
  if(!bearer&&cookie&&command.sideEffect!=='none')requireThat(origin===trustedOrigin(),403,'INVALID_ORIGIN');
  const actor=await identity.authenticate(bearer??cookie);req.oaAudit={actorId:actor.id,action:command.id};
  const data=await kernel.perform(actor,command,req.body,(db,ctx)=>['knowledge.compilations.create.v1','knowledge.answers.ask.v1'].includes(command.id)||command.id.startsWith('knowledge.jobs.')?jobs.dispatch(db,ctx,command.id,req.body):command.id.startsWith('knowledge.')?(command.id==='knowledge.objects.upload.v1'||command.id.startsWith('knowledge.imports.')?imports.dispatch(db,ctx,command.id,command.id==='knowledge.objects.upload.v1'?{...req.body,__bytes:req.uploadBytes}:req.body):knowledge.dispatch(db,ctx,command.id,req.body)):command.id.startsWith('organization.')?organization.dispatch(db,ctx,command.id,req.body):kernel.dispatch(db,ctx,command.id,req.body),(db,ctx)=>command.id.startsWith('knowledge.')?knowledge.authorize(db,ctx,command,req.body):undefined);
  requireThat(valid(command.outputSchema,data),500,'INVALID_RESPONSE');
  if(command.id==='identity.logout.v1')reply.header('set-cookie',`product_session=; Path=${sessionPath}; HttpOnly; SameSite=Strict; Max-Age=0${trustedOrigin().startsWith('https:')?'; Secure':''}`);
  return data;
 });
 return {kernel,organization,knowledge,jobs,imports};
}
