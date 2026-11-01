import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';import {resolve} from 'node:path';
import {environment} from './config.mjs';import {poolFor,migrate} from './db.mjs';import {Identity} from './identity.mjs';import {bootstrapProduct} from '../../../plugins/access-management/service.mjs';
const config=environment(),pool=poolFor(config.databaseURL,config.schema);
try{
 await migrate(pool,config.schema);const input=JSON.parse(readFileSync(0,'utf8'));
 const result=await bootstrapProduct(pool,new Identity(pool),input);mkdirSync(config.stateRoot,{recursive:true,mode:0o700});
 const path=resolve(config.stateRoot,'product-bootstrap-access.json');writeFileSync(path,JSON.stringify(result),{mode:0o600,flag:'wx'});
 console.log(JSON.stringify({initialized:true,principalId:result.principalId,credentialFile:path}));
}catch{console.error('Product initialization failed; credential and database diagnostics omitted.');process.exitCode=1;}finally{await pool.end();}
