import { environment } from './config.mjs';
import { poolFor } from './db.mjs';
import { Identity } from './identity.mjs';
import { Store } from './store.mjs';
import { workLoop,productionExecutor } from './worker.mjs';
const config=environment();const pool=poolFor(config.databaseURL,config.schema);const controller=new AbortController();
process.on('SIGTERM',()=>controller.abort());process.on('SIGINT',()=>controller.abort());
try{await workLoop({store:new Store(pool),identity:new Identity(pool),executorFactory:productionExecutor(config)},controller.signal);}
finally{await pool.end();}
