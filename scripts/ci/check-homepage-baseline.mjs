import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const baseline=JSON.parse(readFileSync('docs/refactor/evidence/A-02-baseline.json','utf8'));
const change=JSON.parse(readFileSync('tests/visual/homepage-navigation-change.json','utf8'));
const allowed=new Set(['app/HomePage.tsx','app/globals.css']);
for(const path of Object.keys(change.sha256))if(!allowed.has(path)||!Object.hasOwn(baseline.sha256,path))throw new Error(`Unapproved homepage baseline override: ${path}`);
for(const [path,original] of Object.entries(baseline.sha256)){
 const expected=change.sha256[path]??original;
 const actual=createHash('sha256').update(readFileSync(path)).digest('hex');
 if(actual!==expected)throw new Error(`Approved homepage baseline differs: ${path}`);
}
console.log(`Homepage source/asset hashes match A-02 plus documented navigation change: ${Object.keys(baseline.sha256).length} files`);
