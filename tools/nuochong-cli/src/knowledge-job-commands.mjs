import {str,obj,arr,bool,revision,command,pageOf} from './product-commands.mjs';
import {citationSchema,detailSchema} from './knowledge-commands.mjs';
const scope={spaceId:str()},key={idempotencyKey:str(128,16)};
export const answerSchema=obj({status:{enum:['answered','insufficient_evidence','conflict']},text:str(12000),citations:arr(obj({...citationSchema.properties,policyCode:str(),sourceVersion:str(),sourceRevision:revision,hash:str()}),20),modelUsed:bool});
export const jobSchema=obj({jobId:str(),spaceId:str(),kind:{enum:['compile','answer']},status:{enum:['queued','running','succeeded','failed','cancelled']},version:revision,cancelRequested:bool,resultValid:bool,errorCode:str(),invalidReason:str(),question:str(2000),result:obj({page:detailSchema,answer:answerSchema},[]),createdAt:str()},['jobId','spaceId','kind','status','version','cancelRequested','resultValid','createdAt']);
const base={permission:'knowledge:read',scopeField:'spaceId'};
export const knowledgeJobCommands=[
 command('knowledge.compilations.create.v1','knowledge compile',obj({...key,...scope,sourceIds:arr(str(),3),pageId:str(128,0),expectedRevision:{type:'integer',minimum:0}}),jobSchema,{write:true,permission:'knowledge:edit',scopeField:'spaceId'}),
 command('knowledge.answers.ask.v1','knowledge ask',obj({...key,...scope,query:str(2000)}),jobSchema,{write:true,permission:'knowledge:ask',scopeField:'spaceId'}),
 command('knowledge.jobs.get.v1','knowledge jobs get',obj({...scope,jobId:str()}),jobSchema,base),
 command('knowledge.jobs.list.v1','knowledge jobs list',obj({...scope,after:str()},['spaceId']),pageOf(jobSchema),base),
 command('knowledge.jobs.cancel.v1','knowledge jobs cancel',obj({...key,...scope,jobId:str()}),jobSchema,{...base,write:true}),
 command('knowledge.jobs.events.v1','knowledge jobs events',obj({...scope,jobId:str(),afterSequence:{type:'integer',minimum:0}},['spaceId','jobId']),obj({items:arr(obj({eventId:str(),sequence:revision,type:{enum:['job.created','job.started','job.requeued','job.completed','job.failed','job.cancelled']},time:str()})),nextSequence:{type:'integer',minimum:0}}),base),
];
