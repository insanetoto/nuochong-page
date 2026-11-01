import {environment} from './config.mjs';import {poolFor} from './db.mjs';import {Identity} from './identity.mjs';
import {AccessKernel} from '../../../plugins/access-management/service.mjs';import {KnowledgeService} from '../../../plugins/knowledge/service.mjs';import {KnowledgeJobs} from '../../../plugins/knowledge/jobs.mjs';import {knowledgeLoop} from '../../../plugins/knowledge/worker.mjs';
const config=environment(),pool=poolFor(config.databaseURL,config.schema),identity=new Identity(pool),kernel=new AccessKernel(pool,identity),knowledge=new KnowledgeService(kernel,config.objectRoot),jobs=new KnowledgeJobs(kernel,knowledge),controller=new AbortController();
process.on('SIGTERM',()=>controller.abort());process.on('SIGINT',()=>controller.abort());
try{await knowledgeLoop({jobs,stateRoot:config.stateRoot,apiKey:config.apiKey},controller.signal);}finally{await pool.end();}
