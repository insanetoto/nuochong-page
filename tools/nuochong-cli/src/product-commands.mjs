// Executable v1 contracts, kept separate from design-only planned capability catalogs.
export const str=(max=256,min=1)=>({type:'string',minLength:min,maxLength:max});
export const obj=(properties,required=Object.keys(properties))=>({type:'object',additionalProperties:false,properties,required});
export const arr=(items,max=100)=>({type:'array',items,maxItems:max});
export const bool={type:'boolean'};export const revision={type:'integer',minimum:1};
const write={idempotencyKey:str(128,16)};
const approved={...write,approvalId:str(128)};
export const departmentSchema=obj({id:str(),name:str(),parentId:str(128,0),active:bool,revision});
export const memberSchema=obj({principalId:str(),name:str(),active:bool,departmentIds:arr(str()),revision});
export const bindingSchema=obj({id:str(),principalId:str(),roleId:str(),scopeId:str(),revision});
export const roleSchema=obj({id:str(),productId:str(),permissions:arr(str())});
export const pageOf=schema=>obj({items:arr(schema),nextCursor:str()},['items']);
export const command=(id,argv,input,output,{write=false,approval=false,permission,scopeField,...extra}={})=>({
 id,argv:argv.split(' '),description:id,method:'POST',path:'/product/api/commands/'+id,sideEffect:write?'product-write':'none',
 idempotency:write?'required-client-key':'read',success:[200],inputSchema:input,outputSchema:output,product:true,
 scope:write?'product:write':'product:read',permission,scopeField,approval,admin:!!permission&&(permission.startsWith('organization:')||permission.startsWith('access:')),clientStatus:'implemented',serverStatus:'oa-control-api',
 authorization:'server-identity-and-resource-policy',automaticRetry:false,...extra,
});
const cursor={after:str()};
export const productCommands=[
 command('identity.login.v1','identity login',obj({username:str(128),password:str(512,8),delivery:{enum:['cookie','bearer']}}),obj({principalId:str(),name:str(),token:str(128,0),expiresAt:str()}),{public:true,scope:'authenticated',sideEffect:'issue-credential',idempotency:'no-automatic-retry'}),
 command('identity.accounts.create.v1','identity accounts create',obj({...approved,principalId:str(),username:str(128),password:str(512,8)}),obj({principalId:str(),username:str()}),{write:true,approval:true,permission:'organization:manage'}),
 command('identity.me.v1','identity me',obj({}),obj({principalId:str(),name:str(),kind:{enum:['user','service']},bindings:arr(bindingSchema),permissions:arr(str())})),
 command('identity.logout.v1','identity logout',obj({...write}),obj({revoked:{const:true}}),{write:true}),
 command('organization.departments.list.v1','org departments list',obj(cursor,[]),pageOf(departmentSchema),{permission:'organization:read'}),
 command('organization.departments.create.v1','org departments create',obj({...approved,name:str(),parentId:str(128,0)}),departmentSchema,{write:true,approval:true,permission:'organization:manage'}),
 command('organization.departments.update.v1','org departments update',obj({...approved,departmentId:str(),name:str(),parentId:str(128,0),active:bool,expectedRevision:revision}),departmentSchema,{write:true,approval:true,permission:'organization:manage'}),
 command('organization.members.list.v1','org members list',obj(cursor,[]),pageOf(memberSchema),{permission:'organization:read'}),
 command('organization.members.create.v1','org members create',obj({...approved,name:str(),departmentIds:arr(str()),kind:{enum:['user','service']}}),memberSchema,{write:true,approval:true,permission:'organization:manage'}),
 command('organization.members.update.v1','org members update',obj({...approved,principalId:str(),departmentIds:arr(str()),active:bool,expectedRevision:revision}),memberSchema,{write:true,approval:true,permission:'organization:manage'}),
 command('access.roles.list.v1','access roles list',obj({}),obj({items:arr(roleSchema)}),{permission:'access:manage'}),
 command('access.bindings.list.v1','access bindings list',obj(cursor,[]),pageOf(bindingSchema),{permission:'access:manage'}),
 command('access.bindings.grant.v1','access bindings grant',obj({...approved,principalId:str(),roleId:str(),scopeId:str(),expectedRevision:{type:'integer',minimum:0}}),bindingSchema,{write:true,approval:true,permission:'access:manage'}),
 command('access.bindings.revoke.v1','access bindings revoke',obj({...approved,bindingId:str(),expectedRevision:revision}),obj({revoked:{const:true}}),{write:true,approval:true,permission:'access:manage'}),
 command('access.permissions.check.v1','access permissions check',obj({permission:str(),scopeId:str()}),obj({allowed:bool,principalId:str()})),
 command('access.approvals.create.v1','access approvals create',obj({...write,commandId:str(),target:{type:'object',additionalProperties:true,properties:{},required:[]},reason:str(1000,3)}),obj({approvalId:str(),targetHash:str(),expiresAt:str()}),{write:true}),
 command('platform.plugins.list.v1','plugins list',obj({}),obj({items:arr(obj({id:str(),version:str(),state:{enum:['registered','enabled','draining','disabled']},requires:arr(str())}))})),
];
