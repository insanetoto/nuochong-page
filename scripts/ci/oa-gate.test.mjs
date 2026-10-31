import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluate,required} from './oa-gate-policy.mjs';
const all=()=>required.map((name,id)=>({name,id,status:'completed',conclusion:'success',app:{slug:'github-actions'}}));
test('gate fails closed for missing, skipped, failed, foreign and pending checks',()=>{
 assert.equal(evaluate(all()).status,'passed');
 assert.equal(evaluate(all().slice(1)).status,'waiting');
 for(const conclusion of ['failure','skipped','cancelled']){const checks=all();checks[0].conclusion=conclusion;assert.equal(evaluate(checks).status,'failed');}
 const foreign=all();foreign[0].app.slug='untrusted';assert.equal(evaluate(foreign).status,'waiting');
 const pending=all();pending[0].status='in_progress';assert.equal(evaluate(pending).status,'waiting');
 const stale=all();stale.push({...stale[0],id:999,conclusion:'failure'});assert.equal(evaluate(stale).status,'failed');
});
