import { environment } from './config.mjs';
import { poolFor,migrate } from './db.mjs';
const config=environment();const pool=poolFor(config.databaseURL,config.schema);
try{await migrate(pool,config.schema);console.log(JSON.stringify({migrated:true,schema:config.schema}));}finally{await pool.end();}
