import { environment } from './config.mjs';
import { poolFor } from './db.mjs';
import { createApp } from './app.mjs';
const config=environment();const pool=poolFor(config.databaseURL,config.schema);const {app}=createApp(pool);
await app.listen({host:'127.0.0.1',port:config.port});
console.log(JSON.stringify({service:'oa-control-api',port:config.port}));
let closing;const close=()=>closing??=(async()=>{await app.close();await pool.end();})();
process.on('SIGTERM',()=>close().catch(()=>{process.exitCode=1;}));process.on('SIGINT',()=>close().catch(()=>{process.exitCode=1;}));
