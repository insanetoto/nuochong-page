// Design QA only. Does not implement or invoke product services.
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {commands as runtime} from '../../../../../tools/nuochong-cli/src/registry.mjs';
const require=createRequire(new URL('../../../../../package.json',import.meta.url));
const Ajv=require('ajv');
const ajv=new Ajv({allErrors:true});
const json=name=>JSON.parse(readFileSync(new URL(name,import.meta.url),'utf8'));
const catalogue=json('p1-command-contracts.json'),fixtures=json('p1-schema-fixtures.json');
assert.equal(catalogue.runtimeRegistration,false);assert.equal(catalogue.commands.length,35);
assert.equal(new Set(catalogue.commands.map(c=>c.commandId)).size,35);
let checked=0,negative=0;
for(const c of catalogue.commands){
 assert.equal(c.status,'planned');assert.equal(c.automaticRetry,false);
 for(const key of ['inputSchema','outputSchema'])assert(ajv.validateSchema(c[key]),`${c.commandId}/${key}: schema invalid`);
 const input=ajv.compile(c.inputSchema),output=ajv.compile(c.outputSchema),f=fixtures.cases.find(x=>x.commandId===c.commandId);
 assert(input(f.input),`${c.commandId}: ${ajv.errorsText(input.errors)}`);assert(output(f.output),`${c.commandId}: ${ajv.errorsText(output.errors)}`);checked+=2;
 assert.equal(input({...f.input,roles:['owner']}),false);negative++;
 const missing={...f.input};delete missing[c.inputSchema.required[0]];assert.equal(input(missing),false);negative++;
 assert.equal(output({...f.output,secret:'must-not-appear'}),false);negative++;
 if(c.commandId.endsWith('.v2'))assert(c.cli.includes('--command-version 2'));
}
const ontology=ajv.compile(json('ontology-fragment.schema.json')),example=json('ontology-fragment.example.json');
assert(ontology(example));
for(const bad of [{...example,script:'exec'}, {...example,namespace:'nc.ext:'}, {...example,apiMajor:2}, {...example,relations:[{...example.relations[0],authorizationPropagation:true}]}]){assert.equal(ontology(bad),false);negative++;}
const baseline=json('v0-command-baseline.json');assert.equal(runtime.length,59);
for(const old of baseline.commands)assert.deepEqual(JSON.parse(JSON.stringify(runtime.find(c=>c.id===old.id))),old,old.id+' wire baseline changed');
function canonical(v){
 if(v===null||typeof v==='number'&&(!Number.isSafeInteger(v)||Object.is(v,-0)))throw new Error('invalid canonical value');
 if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';
 if(typeof v==='object')return '{'+Object.keys(v).sort().map(k=>{if(!/^[\x20-\x7e]+$/.test(k))throw new Error('non-ASCII key');return JSON.stringify(k)+':'+canonical(v[k]);}).join(',')+'}';
 if(!['string','boolean','number'].includes(typeof v))throw new Error('invalid canonical value');
 return JSON.stringify(v);
}
for(const v of json('canonical-vectors.json').cases){assert.equal(canonical(v.value),v.canonical);assert.equal(createHash('sha256').update(v.canonical).digest('hex'),v.sha256);}
for(const bad of [NaN,Infinity,-0,1.5,null,undefined])assert.throws(()=>canonical(bad));
const graph=catalogue.commands.find(c=>c.commandId==='knowledge.graph.query.v1'),g=fixtures.cases.find(x=>x.commandId===graph.commandId).input;
assert.equal(ajv.validate(graph.inputSchema,{...g,limit:2001}),false);negative++;
console.log(JSON.stringify({result:'PASS',plannedCommands:35,schemaPositiveChecks:checked,negativeChecks:negative,ontologySchema:'valid; semantic registry tests remain implementation work',legacySnapshots:baseline.commands.length,runtimeCommands:runtime.length,canonicalVectors:3},null,2));
