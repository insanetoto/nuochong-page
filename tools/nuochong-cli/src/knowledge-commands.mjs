import {str,obj,arr,bool,revision,command,pageOf} from './product-commands.mjs';
const key={idempotencyKey:str(128,16)},approved={...key,approvalId:str(128)},scope={spaceId:str()};
export const citationSchema=obj({sourceId:str(),lineStart:{type:'integer',minimum:1},lineEnd:{type:'integer',minimum:1},quote:str(1000)});
export const spaceSchema=obj({id:str(),title:str(),departmentIds:arr(str()),revision});
export const spaceDetailSchema=obj({spaceId:str(128),code:str(64),title:str(256),domainType:{enum:['policy','procedure','reference']},departmentIds:arr(str()),status:{enum:['active','read-only','archived']},revision,publicationPolicyRevision:revision,allowSelfPublish:bool});
export const spaceManagementResult=obj({space:spaceDetailSchema,requestId:str(128)});
const policyResult=obj({spaceId:str(128),allowSelfPublish:bool,policyRevision:revision,requestId:str(128)});
const governanceTarget=obj({spaceId:str(128),allowSelfPublish:bool,reason:str(1000,3),expectedPolicyRevision:revision});
const governanceRequest=obj({proposalId:str(128),targetHash:str(64),expiresAt:str(),requestId:str(128)});
const governanceApproval=obj({approvalId:str(128),targetHash:str(64),expiresAt:str(),requestId:str(128)});
export const sourceSchema=obj({id:str(),documentId:str(),spaceId:str(),title:str(),revision,policyCode:str(),version:str(),filename:str(),hash:str(),status:{enum:['active','withdrawn']},validFrom:str(),validUntil:str(64,0),createdAt:str()});
export const knowledgePageSchema=obj({pageId:str(),spaceId:str(),revisionId:str(),title:str(),revision,pageState:{enum:['draft','reviewed','published','withdrawn','stale']},sourceIds:arr(str()),citations:arr(citationSchema)});
export const detailSchema=obj({...knowledgePageSchema.properties,body:str(20000)});
const read={permission:'knowledge:read',scopeField:'spaceId'},edit={write:true,permission:'knowledge:edit',scopeField:'spaceId'},publish={write:true,approval:true,permission:'knowledge:publish',scopeField:'spaceId'};
export const knowledgeCommands=[
 command('knowledge.spaces.list.v1','knowledge spaces list',obj({after:str()},[]),pageOf(spaceSchema)),
 command('knowledge.spaces.get.v1','knowledge spaces get',obj({spaceId:str(128)}),spaceManagementResult,{permission:'knowledge:read',scopeField:'spaceId'}),
 command('knowledge.spaces.create.v2','knowledge spaces create',obj({...approved,code:str(64),title:str(256),domainType:{enum:['policy','procedure','reference']},departmentIds:arr(str())}),spaceManagementResult,{write:true,approval:true,permission:'knowledge:publish'}),
 command('knowledge.spaces.update.v1','knowledge spaces update',obj({...approved,spaceId:str(128),expectedRevision:revision,title:str(256),departmentIds:arr(str())}),spaceManagementResult,{write:true,approval:true,permission:'knowledge:publish',scopeField:'spaceId'}),
 command('knowledge.spaces.archive.v1','knowledge spaces archive',obj({...approved,spaceId:str(128),expectedRevision:revision,reason:str(1000,3)}),spaceManagementResult,{write:true,approval:true,permission:'knowledge:publish',scopeField:'spaceId'}),
 command('knowledge.spaces.publication-policy.set.v1','knowledge spaces publication-policy set',obj({...key,spaceId:str(128),allowSelfPublish:bool,reason:str(1000,3),expectedPolicyRevision:revision,approvalId:str(128),proposalId:str(128)}),policyResult,{write:true,permission:'access:manage',scopeField:'spaceId'}),
 command('access.approval-requests.create.v1','access approval-requests create',obj({...key,commandId:{const:'knowledge.spaces.publication-policy.set.v1'},target:governanceTarget}),governanceRequest,{write:true,permission:'access:manage'}),
 command('access.approvals.create.v2','access approvals create',obj({...key,proposalId:str(128),reason:str(1000,3)}),governanceApproval,{write:true,permission:'access:manage'}),
 command('knowledge.spaces.create.v1','knowledge spaces create',obj({...approved,title:str(),departmentIds:arr(str())}),spaceSchema,{write:true,approval:true,permission:'knowledge:publish'}),
 command('knowledge.sources.import.v1','knowledge sources import',obj({...key,...scope,title:str(),policyCode:str(),version:str(),filename:str(),content:str(20000),validFrom:str(64),validUntil:str(64,0)}),sourceSchema,edit),
 command('knowledge.sources.list.v1','knowledge sources list',obj({...scope,after:str()},['spaceId']),pageOf(sourceSchema),{permission:'knowledge:read',scopeField:'spaceId'}),
 command('knowledge.sources.get.v1','knowledge sources get',obj({...scope,sourceId:str()}),obj({source:sourceSchema,content:str(20000)}),read),
 command('knowledge.sources.withdraw.v1','knowledge sources withdraw',obj({...approved,...scope,sourceId:str()}),obj({withdrawn:{const:true}}),publish),
 command('knowledge.changes.create.v1','knowledge changes create',obj({...key,...scope,pageId:str(128,0),expectedRevision:{type:'integer',minimum:0},title:str(),body:str(12000),citations:arr(citationSchema)}),detailSchema,edit),
 command('knowledge.changes.review.v1','knowledge changes review',obj({...key,...scope,revisionId:str(),expectedRevision:revision,decision:{enum:['approve','reject']},reason:str(1000,3)}),knowledgePageSchema,{write:true,permission:'knowledge:review',scopeField:'spaceId'}),
 command('knowledge.publications.publish.v1','knowledge publications publish',obj({...approved,...scope,revisionId:str(),expectedRevision:revision}),knowledgePageSchema,publish),
 command('knowledge.publications.withdraw.v1','knowledge publications withdraw',obj({...approved,...scope,pageId:str(),expectedRevision:revision}),obj({withdrawn:{const:true}}),publish),
 command('knowledge.pages.list.v1','knowledge pages list',obj({...scope,after:str(),view:{enum:['published','manage']}},['spaceId','view']),pageOf(knowledgePageSchema),read),
 command('knowledge.pages.get.v1','knowledge pages get',obj({...scope,pageId:str(),view:{enum:['published','manage']}}),detailSchema,read),
 command('knowledge.search.v1','knowledge search',obj({...scope,query:str(500)}),obj({items:arr(obj({...knowledgePageSchema.properties,excerpt:str(600)})),query:str(500)}),read),
 command('knowledge.quality.get.v1','knowledge quality',obj({...scope,after:str()},['spaceId']),pageOf(obj({pageId:str(),title:str(),code:str()})),{permission:'knowledge:edit',scopeField:'spaceId'}),
];
