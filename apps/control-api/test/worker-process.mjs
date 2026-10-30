// Only the integration test imports this synthetic executor; production has no fixture env switch.
import { poolFor } from '../src/db.mjs';
import { Identity } from '../src/identity.mjs';
import { Store } from '../src/store.mjs';
import { workOnce } from '../src/worker.mjs';
const pool=poolFor(process.env.TEST_DATABASE_URL,process.env.TEST_SCHEMA);
try{await workOnce({store:new Store(pool),identity:new Identity(pool),leaseMs:300,
 executorFactory:()=>({execute:async()=>new Promise(()=>{}),close:async()=>{}})});}finally{await pool.end();}
