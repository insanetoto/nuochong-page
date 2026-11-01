import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,statSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {configureDemo,disabledDemoEntries} from '../deploy/configure-demo.mjs';
import {parse} from 'yaml';
test('managed demo uses official private credential and disables BYOK surfaces without deleting unrelated settings',t=>{
 const home=mkdtempSync(join(tmpdir(),'oa-demo-'));t.after(()=>rmSync(home,{recursive:true,force:true}));
 mkdirSync(join(home,'profiles/web'),{recursive:true});
 writeFileSync(join(home,'profiles/web/cordis.patch.yml'),'- id: retained-example\n  disabled: true\n');
 const key='sk-synthetic-demo-key-not-real';configureDemo(home,key);configureDemo(home,key);
 const text=readFileSync(join(home,'profiles/web/cordis.patch.yml'),'utf8');const entries=parse(text);
 assert.equal(entries.filter(e=>e.id==='retained-example').length,1);
 for(const id of disabledDemoEntries)assert.equal(entries.filter(e=>e.id===id&&e.disabled===true).length,1);
 assert.ok(!text.includes(key));assert.equal(parse(readFileSync(join(home,'.credentials.yaml'),'utf8')).refs.DEEPSEEK_API_KEY,key);
 assert.equal(statSync(join(home,'.credentials.yaml')).mode&0o777,0o600);
 assert.throws(()=>configureDemo(home,'bad\nvalue'));
});
