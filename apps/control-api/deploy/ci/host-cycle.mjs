import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {poolFor,migrate} from '../../src/db.mjs';
import {Identity} from '../../src/identity.mjs';
import {Store} from '../../src/store.mjs';
import {workOnce} from '../../src/worker.mjs';
import {HarnessExecution} from '../../src/runtime.mjs';
const schema=process.env.OA_TEST_SCHEMA;
const pool=poolFor(process.env.TEST_DATABASE_URL,schema);
const identity=new Identity(pool);const store=new Store(pool);const mode=process.argv[2];
if(mode==='setup'){
 await migrate(pool,schema);
 const token=await identity.bootstrap('synthetic host test');const actor=await identity.authenticate(token.token);
 await store.createRun(actor,{prompt:'synthetic isolated task',idempotencyKey:randomUUID()});
 await pool.end();
}else if(mode==='hold'){
 const stateRoot=mkdtempSync(join(tmpdir(),'oa-host-test-'));
 const execution=new HarnessExecution({owner_id:randomUUID(),session_id:randomUUID(),native_started:false,config:{clockTool:true,model:'deepseek-v4-flash'}},{stateRoot});
 await execution.harness.start();
 await workOnce({store,identity,leaseMs:500,executorFactory:()=>({execute:async()=>{process.stdout.write('OA_HOST_READY\n');return new Promise(()=>{});},close:async()=>{await execution.close();}})});
}else if(mode==='verify'){
 await new Promise(resolve=>setTimeout(resolve,700));
 assert.equal(await store.recoverExpired(),1);assert.equal(await store.recoverExpired(),0);
 const runs=(await pool.query('SELECT id,status,dispatched FROM runs')).rows;assert.equal(runs.length,1);assert.equal(runs[0].status,'failed');assert.equal(runs[0].dispatched,true);
 const terminal=(await pool.query("SELECT type FROM events WHERE run_id=$1 AND type IN ('run.completed','run.failed','run.cancelled')",[runs[0].id])).rows;
 assert.deepEqual(terminal.map(e=>e.type),['run.failed']);assert.equal(await store.claim(),null);
 await pool.query(`DROP SCHEMA ${schema} CASCADE`);await pool.end();console.log('Host/worker recovery: one failed terminal, no replay');
}else throw new Error('Invalid mode');
