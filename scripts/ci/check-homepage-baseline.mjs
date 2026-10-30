import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const baseline=JSON.parse(readFileSync('docs/refactor/evidence/A-02-baseline.json','utf8'));
for(const [path,expected] of Object.entries(baseline.sha256)){
 const actual=createHash('sha256').update(readFileSync(path)).digest('hex');
 if(actual!==expected)throw new Error(`Approved homepage baseline differs: ${path}`);
}
console.log(`Approved homepage source/asset hashes match: ${Object.keys(baseline.sha256).length} files`);
