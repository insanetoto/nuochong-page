import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
const baseline=JSON.parse(readFileSync('docs/refactor/evidence/A-02-baseline.json','utf8'));
const change=JSON.parse(readFileSync('tests/visual/homepage-navigation-change.json','utf8'));
const allowed=new Set(['app/HomePage.tsx','app/globals.css']);
for(const path of Object.keys(change.sha256))if(!allowed.has(path)||!Object.hasOwn(baseline.sha256,path))throw new Error(`Unapproved homepage baseline override: ${path}`);
// A separate, narrowly scoped user-request record; historical pixel baselines are not replaced.
const redesignPath='tests/visual/homepage-redesign-change.json';
const redesign=existsSync(redesignPath)?JSON.parse(readFileSync(redesignPath,'utf8')):null;
const redesignAllowed=new Set(['app/HomePage.tsx','app/layout.tsx','app/page.tsx','static-src/index.html','app/marketing.css']);
if(redesign&&(redesign.authorization?.issue!==90||Object.keys(redesign.sha256).some(path=>!redesignAllowed.has(path))))throw new Error('Unapproved homepage redesign scope');
const expected={...baseline.sha256,...change.sha256,...redesign?.sha256};
for(const [path,digest] of Object.entries(expected)){
 const actual=createHash('sha256').update(readFileSync(path)).digest('hex');
 if(actual!==digest)throw new Error(`Authorized homepage source differs: ${path}`);
}
console.log(`Homepage source/assets match the documented user-authorized scope: ${Object.keys(expected).length} files; pixel acceptance is separate`);
