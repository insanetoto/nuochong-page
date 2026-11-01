import {commands,valid} from '../../../tools/nuochong-cli/src/registry.mjs';
import {AccessKernel} from '../../../plugins/access-management/service.mjs';
import {OrganizationService} from '../../../plugins/organization/service.mjs';
import {requireThat} from './errors.mjs';
export function registerProduct(app,{pool,identity,publicOrigin}){
 const kernel=new AccessKernel(pool,identity),organization=new OrganizationService(kernel);
 const trustedOrigin=()=>publicOrigin?new URL(publicOrigin).origin:app.listeningOrigin;
 for(const command of commands.filter(c=>c.product))app.post(command.path,async(req,reply)=>{
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
    const path=publicOrigin?new URL(publicOrigin).pathname.replace(/\/$/,'')+'/':'/product/';
    // The public gateway prefix is part of publicOrigin; cookies do not authorize Native owner routes.
    reply.header('set-cookie',`product_session=${data.token}; Path=${path}; HttpOnly; SameSite=Strict; Max-Age=14400${trustedOrigin().startsWith('https:')?'; Secure':''}`);
    data.token='';
   }
   return data;
  }
  if(!bearer&&cookie&&command.sideEffect!=='none')requireThat(origin===trustedOrigin(),403,'INVALID_ORIGIN');
  const actor=await identity.authenticate(bearer??cookie);req.oaAudit={actorId:actor.id,action:command.id};
  const data=await kernel.perform(actor,command,req.body,(db,ctx)=>command.id.startsWith('organization.')?organization.dispatch(db,ctx,command.id,req.body):kernel.dispatch(db,ctx,command.id,req.body));
  requireThat(valid(command.outputSchema,data),500,'INVALID_RESPONSE');
  if(command.id==='identity.logout.v1')reply.header('set-cookie',`product_session=; Path=${publicOrigin?new URL(publicOrigin).pathname.replace(/\/$/,'')+'/':'/product/'}; HttpOnly; SameSite=Strict; Max-Age=0${trustedOrigin().startsWith('https:')?'; Secure':''}`);
  return data;
 });
 return {kernel,organization};
}
