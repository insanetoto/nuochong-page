import { environment } from './config.mjs';
import { poolFor } from './db.mjs';
import { Identity } from './identity.mjs';
const config=environment();const pool=poolFor(config.databaseURL,config.schema);
try{
  if(process.argv[2]!=='bootstrap'||!process.argv[3]||process.argv[3].length>256)throw new Error('Use bootstrap <administrator-name> in a private operator terminal.');
  const credential=await new Identity(pool).bootstrap(process.argv[3]);
  console.log(JSON.stringify({ok:true,data:credential}));
}catch{console.error(JSON.stringify({ok:false,error:'Bootstrap rejected; database must be migrated and empty.'}));process.exitCode=1;}
finally{await pool.end();}
