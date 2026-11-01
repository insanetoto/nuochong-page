import {commands,valid} from './contracts.mjs';
const base=new URL('.',location.href);
export const idempotencyKey=()=>crypto.randomUUID();
export async function api(id,input={}){
 const command=commands.find(c=>c.id===id);if(!command||!valid(command.inputSchema,input))throw new Error('CLIENT_SCHEMA');
 let response;try{response=await fetch(new URL(command.path.replace(/^\/product\//,''),base),{method:command.method,credentials:'same-origin',redirect:'error',headers:{'content-type':'application/json'},body:JSON.stringify(input)});}catch{const error=new Error('NETWORK_UNKNOWN');error.code='NETWORK_UNKNOWN';throw error;}
 let data;try{data=await response.json();}catch{throw new Error('INVALID_RESPONSE');}
 if(!response.ok){const error=new Error(data.code??'REQUEST_FAILED');error.code=data.code;error.status=response.status;error.requestId=data.requestId;throw error;}
 if(!valid(command.outputSchema,data))throw new Error('INVALID_RESPONSE');return data;
}
export const friendly=error=>({UNAUTHORIZED:'登录已失效，请重新登录。',FORBIDDEN:'当前公司身份没有这项操作权限；新获审批角色时请重新登录。',NOT_FOUND:'内容不可访问或已失效。',APPROVAL_REQUIRED:'审批已失效，请重新确认操作。',VERSION_CONFLICT:'版本已变化，请刷新内容后重新确认。',IDEMPOTENCY_CONFLICT:'请求内容与原操作不同，请核对后重试。',SOURCE_VERSION_EXISTS:'同一制度版本已存在，请查看已有来源或使用新版本。',EVIDENCE_CHANGED:'依据已变更、未生效或已失效，请核对现行原文。',FORMAT_NOT_IMPLEMENTED:'初版仅支持 UTF-8 Markdown/TXT，其他格式尚未实现。',MODEL_UNAVAILABLE:'公司模型暂不可用，请联系管理员。',INVALID_MODEL_RESPONSE:'模型未返回可核验的结构化内容，本次未生成发布内容。',UNCERTAIN_DISPATCH:'模型请求结果未知，系统未自动重试；请先核对任务。',MODEL_TIMEOUT:'模型处理超时，请先查看任务后决定是否重试。',NETWORK_UNKNOWN:'连接中断，操作结果尚不确定。请先查看任务或列表，再重试原请求。',DEPARTMENT_CYCLE:'部门关系不能构成循环。',DEPARTMENT_IN_USE:'请先迁移成员和子部门，再停用该部门。',ACCOUNT_EXISTS:'该账号或成员已绑定登录账号。',RATE_LIMITED:'登录尝试过多，请稍后再试。',DEPENDENCY_UNAVAILABLE:'所需插件不可用，请联系管理员。',OBJECT_CORRUPT:'原文对象校验失败，请联系管理员恢复。'}[error.code??error.message]??'操作未完成，请核对输入、权限及服务状态。')+(error.requestId?'（请求 '+error.requestId+'）':'');
