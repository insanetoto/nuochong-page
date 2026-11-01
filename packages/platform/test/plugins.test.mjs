import test from 'node:test';import assert from 'node:assert/strict';
import {PluginRegistry,foundationManifests} from '../plugin-registry.mjs';
test('composition fails closed for missing dependencies, unsupported versions and unknown code',()=>{
 assert.throws(()=>new PluginRegistry([{...foundationManifests[0],requires:['organization']},foundationManifests[1]]),/CYCLE/);
 assert.throws(()=>new PluginRegistry(foundationManifests.filter(m=>m.id!=='organization')),/DEPENDENCY/);
 assert.throws(()=>new PluginRegistry([{id:'knowledge',version:'2.0.0',apiMajor:2}]),/INCOMPATIBLE/);
 assert.throws(()=>new PluginRegistry([{id:'untrusted',version:'1.0.0',apiMajor:1}]),/INCOMPATIBLE/);
});
test('command namespace conflicts are rejected, not silently overridden',()=>{
 assert.throws(()=>new PluginRegistry([{...foundationManifests[0],commands:['access.roles.list.v1']}]),/NAMESPACE/);
 assert.throws(()=>new PluginRegistry([{...foundationManifests[0],commands:['identity.me.v1','identity.me.v1']}]),/NAMESPACE/);
});
test('draining allows historical reads but blocks new writes; dependent disable is refused',()=>{
 const registry=new PluginRegistry(foundationManifests);
 const draining=registry.transition('knowledge','draining');assert.ok(draining.assertEnabled('knowledge'));
 assert.throws(()=>draining.assertEnabled('knowledge',true),/DEPENDENCY/);
 assert.throws(()=>registry.transition('organization','disabled'),/DEPENDENCY/);
 const disabled=draining.transition('knowledge','disabled');assert.throws(()=>disabled.assertEnabled('knowledge'),/DEPENDENCY/);
 assert.equal(registry.list().find(e=>e.id==='learning').state,'registered');
});
