const text={type:'string',minLength:1,maxLength:256};
const object=(properties,required=Object.keys(properties))=>({type:'object',additionalProperties:false,properties,required});
const array=(items,maxItems=100)=>({type:'array',items,maxItems});
const principal=object({principalId:text,name:text,kind:{enum:['user','service']},role:{enum:['admin','member']},active:{type:'boolean'}});
const credential=object({credentialId:text,principalId:text,scopes:array(text,7),expiresAt:{type:'string',format:'date-time'},revoked:{type:'boolean'}});
const session=object({sessionId:text,name:text,createdAt:{type:'string',format:'date-time'}});
const config=object({provider:{const:'deepseek-official'},model:{const:'deepseek-v4-flash'},clockTool:{type:'boolean'},version:{type:'integer',minimum:1}});
const command=(id,method,path,inputSchema,outputSchema,scope,admin=false)=>({id,argv:id.split('.'),description:id,method,path,inputSchema,outputSchema,scope,admin,
  sideEffect:method==='GET'?'none':'server-controlled-write',idempotency:method==='GET'?'read':'explicit-operation',success:[200],clientStatus:'implemented',serverStatus:'oa-control-api',authorization:'server-identity-and-resource-policy',automaticRetry:false});
export const coreCommands=[
 command('auth.me','GET','/api/auth/me',object({}),object({...principal.properties,scopes:array(text,7)}),'authenticated'),
 command('auth.principals.list','GET','/api/auth/principals',object({after:text},[]),object({items:array(principal),nextCursor:text},['items']),'auth:manage',true),
 command('auth.principals.create','POST','/api/auth/principals',object({name:text,kind:{enum:['user','service']},role:{enum:['admin','member']}}),principal,'auth:manage',true),
 command('auth.principals.set-active','POST','/api/auth/principals/{principalId}/active',object({principalId:text,active:{type:'boolean'}}),principal,'auth:manage',true),
 command('auth.credentials.create','POST','/api/auth/credentials',object({principalId:text,scopes:{...array(text,7),minItems:1},expiresAt:{type:'string',format:'date-time'}}),object({...credential.properties,token:{type:'string',minLength:46,maxLength:46}}),'auth:manage',true),
 command('auth.credentials.list','GET','/api/auth/credentials',object({after:text},[]),object({items:array(credential),nextCursor:text},['items']),'auth:manage',true),
 command('auth.credentials.revoke','POST','/api/auth/credentials/{credentialId}/revoke',object({credentialId:text}),credential,'auth:manage',true),
 command('sessions.create','POST','/api/ai/sessions',object({name:text}),session,'sessions:write'),
 command('sessions.list','GET','/api/ai/sessions',object({after:text},[]),object({items:array(session),nextCursor:text},['items']),'sessions:read'),
 command('sessions.get','GET','/api/ai/sessions/{sessionId}',object({sessionId:text}),session,'sessions:read'),
 command('sessions.history','GET','/api/ai/sessions/{sessionId}/history',object({sessionId:text,after:text},['sessionId']),object({items:array(object({runId:text,status:{enum:['queued','running','retry_wait','succeeded','failed','cancelled']},prompt:{type:'string',maxLength:20000},response:{type:'string',maxLength:20000}},['runId','status','prompt']),5),nextCursor:text},['items']),'sessions:read'),
 command('models.list','GET','/api/ai/models',object({}),object({items:array(object({provider:{const:'deepseek-official'},model:{const:'deepseek-v4-flash'}}),1)}),'config:read'),
 command('models.config.get','GET','/api/ai/config',object({}),config,'config:read'),
 command('models.config.update','POST','/api/ai/config',object({model:{const:'deepseek-v4-flash'},clockTool:{type:'boolean'},expectedVersion:{type:'integer',minimum:1}}),config,'config:write',true),
 command('tools.list','GET','/api/ai/tools',object({}),object({items:array(object({name:{const:'current_time'},readonly:{const:true},enabled:{type:'boolean'}}),1)}),'config:read'),
 command('runtime.status','GET','/api/ai/runtime',object({}),object({provider:{const:'deepseek-official'},model:{const:'deepseek-v4-flash'},profile:{const:'sdk-minimal'},tools:{const:'readonly'},apiVersion:{const:'1.1'}}),'config:read'),
];
