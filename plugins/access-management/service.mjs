import {randomUUID,randomBytes,scryptSync,timingSafeEqual,createHash} from 'node:crypto';
import {transaction} from '../../apps/control-api/src/db.mjs';
import {requireThat,ApiError} from '../../apps/control-api/src/errors.mjs';
import {PluginRegistry,foundationManifests} from '../../packages/platform/plugin-registry.mjs';
import {commands,valid} from '../../tools/nuochong-cli/src/registry.mjs';
export const canonical=value=>JSON.stringify(value===null||typeof value!=='object'?value:Array.isArray(value)?value.map(v=>JSON.parse(canonical(v))):Object.fromEntries(Object.keys(value).sort().map(k=>[k,JSON.parse(canonical(value[k]))])));
export const digest=value=>createHash('sha256').update(typeof value==='string'?value:canonical(value)).digest('hex');
// Credential-bearing idempotency/approval inputs must not create a fast password oracle.
const secretInput=value=>value&&typeof value==='object'&&Object.entries(value).some(([k,v])=>k==='password'||secretInput(v));
const privateDigest=value=>secretInput(value)?scryptSync(canonical(value),'product-private-input-v1',32).toString('hex'):digest(value);
export const targetOf=input=>Object.fromEntries(Object.entries(input).filter(([k])=>!['idempotencyKey','approvalId'].includes(k)));
export const bindingDTO=r=>({id:r.id,principalId:r.principal_id,roleId:r.role_id,scopeId:r.scope_id,revision:r.revision});
export class AccessKernel {
 constructor(pool,identity){this.pool=pool;this.identity=identity;}
 async registry(db){const rows=(await db.query('SELECT * FROM product_plugins')).rows;return new PluginRegistry(foundationManifests.map(m=>{const row=rows.find(r=>r.id===m.id);if(row&&row.version!==m.version)throw new Error('INCOMPATIBLE_PLUGIN');const namespace=m.id==='identity-company'?'identity':m.id==='access-management'?'access':m.id;return {...m,state:row?.state??'disabled',commands:commands.filter(c=>c.product&&c.id.startsWith(namespace+'.')).map(c=>c.id)};}));}
 async context(db,actor){
  const live=(await db.query(`SELECT p.id,p.kind FROM credentials c JOIN principals p ON p.id=c.principal_id JOIN product_members m ON m.principal_id=p.id
    WHERE c.id=$1 AND c.principal_id=$2 AND NOT c.revoked AND c.expires_at>clock_timestamp() AND p.active AND c.principal_epoch=p.epoch FOR SHARE OF c,p`,[actor.credential_id,actor.id])).rows[0];
  requireThat(live,401,'UNAUTHORIZED');
  const bindings=(await db.query("SELECT b.*,r.permissions FROM product_bindings b JOIN product_roles r ON r.id=b.role_id JOIN product_plugins pp ON pp.id=r.product_id AND pp.state IN ('enabled','draining') WHERE principal_id=$1",[actor.id])).rows;
  const departments=(await db.query('SELECT m.department_id FROM product_memberships m JOIN product_departments d ON d.id=m.department_id WHERE m.principal_id=$1 AND d.active',[actor.id])).rows.map(r=>r.department_id);
  const trustedGovernor=(await db.query('SELECT 1 FROM product_platform_governors WHERE principal_id=$1 AND active',[actor.id])).rowCount>0;
  return {actor,bindings,departments,trustedGovernor,has:(permission,scope='*')=>bindings.some(b=>b.permissions.includes(permission)&&(b.scope_id==='*'||b.scope_id===scope))};
 }
 async event(db,type,id){const row=(await db.query('UPDATE product_settings SET epoch=epoch+1 WHERE id=1 RETURNING epoch')).rows[0];await db.query('INSERT INTO product_outbox(event_id,type,resource_id,revision) VALUES($1,$2,$3,$4)',[randomUUID(),type,id,row.epoch]);}
 async perform(actor,command,input,body,authorize=async()=>{}){
  return transaction(this.pool,async db=>{
   await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[this.pool.oaSchema+':product-domain-state']);
   try {
    const registry=await this.registry(db);registry.assertEnabled('identity-company',command.sideEffect!=='none');registry.assertEnabled('access-management',command.sideEffect!=='none');
    if(command.id.startsWith('organization.'))registry.assertEnabled('organization',command.sideEffect!=='none');
    if(command.id.startsWith('knowledge.'))registry.assertEnabled('knowledge',command.sideEffect!=='none');
   } catch { throw new ApiError(503,'DEPENDENCY_UNAVAILABLE'); }
   const ctx=await this.context(db,actor);
   requireThat(actor.scopes.includes(command.scope));
   if(command.permission)requireThat(ctx.has(command.permission,command.scopeField?input[command.scopeField]:'*'));
   await authorize(db,ctx);
   const mutating=command.sideEffect!=='none';
   if(mutating){
    const old=(await db.query('SELECT * FROM product_writes WHERE actor_id=$1 AND command_id=$2 AND key=$3',[actor.id,command.id,input.idempotencyKey])).rows[0];
    if(old){requireThat(old.input_hash===privateDigest(input),409,'IDEMPOTENCY_CONFLICT');return old.result;}
    if(command.approval)await this.consumeApproval(db,ctx,command,input);
   }
   const result=await body(db,ctx);
   if(mutating)await db.query('INSERT INTO product_writes(actor_id,command_id,key,input_hash,result) VALUES($1,$2,$3,$4,$5)',[actor.id,command.id,input.idempotencyKey,privateDigest(input),result]);
   await db.query('INSERT INTO audit(actor_id,action,resource_id,result) VALUES($1,$2,$3,$4)',[actor.id,command.id,input.spaceId??input.principalId??input.departmentId??null,'allow']);
   return result;
  });
 }
 async consumeApproval(db,ctx,command,input){
  const approval=(await db.query('SELECT * FROM product_approvals WHERE id=$1 AND NOT used AND expires_at>clock_timestamp() FOR UPDATE',[input.approvalId])).rows[0];
  requireThat(approval&&approval.command_id===command.id&&approval.target_hash===privateDigest(targetOf(input)),409,'APPROVAL_REQUIRED');
  const credential=(await db.query('SELECT * FROM credentials WHERE id=$1',[approval.credential_id])).rows[0];
  requireThat(credential,409,'APPROVAL_REQUIRED');
  const approver=await this.context(db,{id:approval.approver_id,credential_id:approval.credential_id,scopes:credential.scopes});
  requireThat(approver.actor.scopes.includes('product:approve')&&approver.actor.id===ctx.actor.id&&approver.has(command.permission,approval.scope_id),409,'APPROVAL_REQUIRED');
  await db.query('UPDATE product_approvals SET used=true WHERE id=$1',[approval.id]);
 }
 async approval(db,ctx,input){
  requireThat(ctx.actor.kind==='user'&&ctx.actor.scopes.includes('product:approve'));
  const command=commands.find(c=>c.id===input.commandId&&c.product&&c.approval);
  requireThat(command,400,'INVALID_INPUT');
  const schema={...command.inputSchema,required:command.inputSchema.required.filter(k=>!['approvalId','idempotencyKey'].includes(k))};
  requireThat(valid(schema,input.target)&&!Object.hasOwn(input.target,'approvalId')&&!Object.hasOwn(input.target,'idempotencyKey'),400,'INVALID_INPUT');
  const scope=command.scopeField?input.target[command.scopeField]:'*';requireThat(ctx.has(command.permission,scope));
  if(command.id==='access.bindings.grant.v1')requireThat(input.target.principalId!==ctx.actor.id);
  const id=randomUUID(),expiresAt=new Date(Date.now()+15*60000).toISOString();
  await db.query('INSERT INTO product_approvals(id,command_id,target_hash,scope_id,approver_id,credential_id,expires_at,reason) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[id,command.id,privateDigest(input.target),scope,ctx.actor.id,ctx.actor.credential_id,expiresAt,input.reason]);
  return {approvalId:id,targetHash:privateDigest(input.target),expiresAt};
 }
 async login(input){
  return transaction(this.pool,async db=>{
   await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[this.pool.oaSchema+':product-login']);
   await db.query("UPDATE product_login_limit SET failures=0,window_start=clock_timestamp() WHERE id=1 AND window_start<clock_timestamp()-interval '15 minutes'");
   const limits=(await db.query('SELECT * FROM product_login_limit WHERE id=1')).rows[0];requireThat(limits.failures<20,429,'RATE_LIMITED');
   const row=(await db.query('SELECT a.*,p.active,p.kind,p.name FROM product_accounts a JOIN principals p ON p.id=a.principal_id WHERE username=$1',[input.username])).rows[0];
   const actual=scryptSync(input.password,row?.salt??'constant-dummy-salt',64);const expected=Buffer.from(row?.password_hash??'00'.repeat(64),'hex');
   if(!row?.active||!timingSafeEqual(actual,expected)){await db.query('UPDATE product_login_limit SET failures=failures+1 WHERE id=1');return null;}
   await db.query('UPDATE product_login_limit SET failures=0 WHERE id=1');
   const principal=(await db.query('SELECT * FROM principals WHERE id=$1',[row.principal_id])).rows[0];
   const approval=(await db.query("SELECT 1 FROM product_bindings b JOIN product_roles r ON r.id=b.role_id WHERE principal_id=$1 AND (r.permissions && ARRAY['access:manage','organization:manage','knowledge:review','knowledge:publish'])",[row.principal_id])).rowCount;
   const credential=await this.identity.issue(db,principal,['product:read','product:write',...(row.kind==='user'&&approval?['product:approve']:[])],new Date(Date.now()+4*3600000));
   return {principalId:row.principal_id,name:row.name,token:credential.token,expiresAt:credential.expiresAt};
  });
 }
 async dispatch(db,ctx,id,input){
  if(id==='identity.accounts.create.v1'){
   const principal=(await db.query("SELECT p.* FROM principals p JOIN product_members m ON m.principal_id=p.id WHERE p.id=$1 AND p.kind='user' AND p.active",[input.principalId])).rows[0];requireThat(principal,404,'NOT_FOUND');
   requireThat(!(await db.query('SELECT 1 FROM product_accounts WHERE username=$1 OR principal_id=$2',[input.username,input.principalId])).rowCount,409,'ACCOUNT_EXISTS');
   const salt=randomBytes(16).toString('hex');await db.query('INSERT INTO product_accounts(username,principal_id,salt,password_hash) VALUES($1,$2,$3,$4)',[input.username,input.principalId,salt,scryptSync(input.password,salt,64).toString('hex')]);
   return {principalId:input.principalId,username:input.username};
  }
  if(id==='identity.me.v1')return {principalId:ctx.actor.id,name:ctx.actor.name,kind:ctx.actor.kind,bindings:ctx.bindings.map(bindingDTO),permissions:[...new Set(ctx.bindings.flatMap(b=>b.permissions))]};
  if(id==='identity.logout.v1'){await db.query('UPDATE credentials SET revoked=true WHERE id=$1',[ctx.actor.credential_id]);return {revoked:true};}
  if(id==='platform.plugins.list.v1')return {items:(await this.registry(db)).list()};
  if(id==='access.permissions.check.v1')return {allowed:ctx.has(input.permission,input.scopeId),principalId:ctx.actor.id};
  if(id==='access.approvals.create.v1')return this.approval(db,ctx,input);
  if(id==='access.approval-requests.create.v1'){
   requireThat(ctx.trustedGovernor&&ctx.has('access:manage','*'),403,'FORBIDDEN');
   const target=input.target;
   requireThat(input.commandId==='knowledge.spaces.publication-policy.set.v1'&&target&&typeof target==='object',400,'INVALID_INPUT');
   requireThat(Object.keys(target).sort().join(',')==='allowSelfPublish,expectedPolicyRevision,reason,spaceId',400,'INVALID_INPUT');
   requireThat(typeof target.allowSelfPublish==='boolean'&&typeof target.reason==='string'&&target.reason.length>=3&&target.reason.length<=1000&&Number.isInteger(target.expectedPolicyRevision)&&target.expectedPolicyRevision>=1,400,'INVALID_INPUT');
   const space=(await db.query('SELECT id,status FROM knowledge_spaces WHERE id=$1',[target.spaceId])).rows[0];requireThat(space&&space.status!=='archived',404,'NOT_FOUND');
   if(target.allowSelfPublish)requireThat((await db.query('SELECT 1 FROM knowledge_space_eligibility WHERE space_id=$1 AND active',[target.spaceId])).rowCount,409,'SELF_PUBLISH_NOT_ELIGIBLE');
   const targetHash=digest(target),id=randomUUID(),expiresAt=new Date(Date.now()+15*60000);
   await db.query(`INSERT INTO access_governance_proposals(id,command_id,target,target_hash,space_id,requested_by,credential_id,expires_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[id,input.commandId,target,targetHash,target.spaceId,ctx.actor.id,ctx.actor.credential_id,expiresAt]);
   return {proposalId:id,targetHash,expiresAt:expiresAt.toISOString(),requestId:randomUUID()};
  }
  if(id==='access.approvals.create.v2'){
   requireThat(ctx.trustedGovernor&&ctx.has('access:manage','*'),403,'FORBIDDEN');
   const proposal=(await db.query('SELECT * FROM access_governance_proposals WHERE id=$1 AND NOT used AND expires_at>clock_timestamp() FOR UPDATE',[input.proposalId])).rows[0];
   requireThat(proposal,409,'APPROVAL_REQUIRED');
   requireThat(proposal.requested_by!==ctx.actor.id,409,'APPROVAL_REQUIRED');
   const approvalId=randomUUID(),expiresAt=new Date(Date.now()+15*60000);
   await db.query(`INSERT INTO access_governance_approvals(id,proposal_id,approver_id,credential_id,target_hash,expires_at)
    VALUES($1,$2,$3,$4,$5,$6)`,[approvalId,proposal.id,ctx.actor.id,ctx.actor.credential_id,proposal.target_hash,expiresAt]);
   return {approvalId,targetHash:proposal.target_hash,expiresAt:expiresAt.toISOString(),requestId:randomUUID()};
  }
  if(id==='access.roles.list.v1')return {items:(await db.query('SELECT * FROM product_roles ORDER BY id')).rows.map(r=>({id:r.id,productId:r.product_id,permissions:r.permissions}))};
  if(id==='access.bindings.list.v1'){const rows=(await db.query('SELECT * FROM product_bindings WHERE id>$1 ORDER BY id LIMIT 101',[input.after??''])).rows;return {items:rows.slice(0,100).map(bindingDTO),...(rows.length>100&&{nextCursor:rows[99].id})};}
  if(id==='access.bindings.grant.v1'){
   requireThat(input.principalId!==ctx.actor.id);
   requireThat((await db.query('SELECT 1 FROM product_members m JOIN principals p ON p.id=m.principal_id WHERE p.id=$1 AND p.active',[input.principalId])).rowCount,404,'NOT_FOUND');
   const principal=(await db.query('SELECT kind FROM principals WHERE id=$1',[input.principalId])).rows[0];
   requireThat(principal.kind!=='service'||['knowledge-reader','knowledge-editor','tool-user','learner'].includes(input.roleId));
   const role=(await db.query('SELECT * FROM product_roles WHERE id=$1',[input.roleId])).rows[0];requireThat(role,400,'INVALID_ROLE');
   requireThat(ctx.bindings.some(b=>b.role_id===input.roleId&&(b.scope_id==='*'||b.scope_id===input.scopeId)));
   requireThat((await db.query('SELECT count(*)::int AS n FROM product_bindings WHERE principal_id=$1',[input.principalId])).rows[0].n<100,409,'BINDING_LIMIT');
   requireThat(input.expectedRevision===0,409,'VERSION_CONFLICT');
   requireThat(!(await db.query('SELECT 1 FROM product_bindings WHERE principal_id=$1 AND role_id=$2 AND scope_id=$3',[input.principalId,input.roleId,input.scopeId])).rowCount,409,'VERSION_CONFLICT');
   const row=(await db.query('INSERT INTO product_bindings(id,principal_id,role_id,scope_id) VALUES($1,$2,$3,$4) RETURNING *',[randomUUID(),input.principalId,input.roleId,input.scopeId])).rows[0];await this.event(db,'access.binding.changed.v1',row.id);return bindingDTO(row);
  }
  if(id==='access.bindings.revoke.v1'){
   const row=(await db.query('SELECT * FROM product_bindings WHERE id=$1',[input.bindingId])).rows[0];requireThat(row,404,'NOT_FOUND');
   requireThat(row.principal_id!==ctx.actor.id&&ctx.bindings.some(b=>b.role_id===row.role_id&&(b.scope_id==='*'||b.scope_id===row.scope_id)));
   requireThat(row.revision===input.expectedRevision,409,'VERSION_CONFLICT');await db.query('DELETE FROM product_bindings WHERE id=$1',[row.id]);await this.event(db,'access.binding.changed.v1',row.id);return {revoked:true};
  }
  requireThat(false,404,'NOT_FOUND');
 }
}
export async function bootstrapProduct(pool,identity,{username,password}){
 requireThat(typeof username==='string'&&username.length>0&&username.length<=128&&typeof password==='string'&&password.length>=8&&password.length<=512,400,'INVALID_INPUT');
 return transaction(pool,async db=>{
  await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[pool.oaSchema+':product-domain-state']);
  requireThat(!(await db.query('SELECT initialized FROM product_settings WHERE id=1')).rows[0].initialized,409,'ALREADY_INITIALIZED');
  const id=randomUUID();const salt=randomBytes(16).toString('hex');
  const principal=(await db.query("INSERT INTO principals(id,name,kind,role) VALUES($1,$2,'user','member') RETURNING *",[id,username])).rows[0];
  await db.query('INSERT INTO product_members(principal_id) VALUES($1)',[id]);
  await db.query('INSERT INTO product_accounts(username,principal_id,salt,password_hash) VALUES($1,$2,$3,$4)',[username,id,salt,scryptSync(password,salt,64).toString('hex')]);
  for(const role of ['org-admin','access-admin','knowledge-reader','knowledge-editor','knowledge-reviewer','knowledge-publisher'])await db.query("INSERT INTO product_bindings(id,principal_id,role_id,scope_id) VALUES($1,$2,$3,'*')",[randomUUID(),id,role]);
  await db.query('UPDATE product_settings SET initialized=true WHERE id=1');
 await db.query('INSERT INTO product_platform_governors(principal_id) VALUES($1) ON CONFLICT(principal_id) DO UPDATE SET active=true',[principal.id]);
  await db.query("INSERT INTO audit(actor_id,action,resource_id,result) VALUES($1,'product.bootstrap',$1,'allow')",[id]);
  const credential=await identity.issue(db,principal,['product:read','product:write','product:approve'],new Date(Date.now()+4*3600000));
  return {principalId:id,token:credential.token,expiresAt:credential.expiresAt};
 });
}
