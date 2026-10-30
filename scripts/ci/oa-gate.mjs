import {evaluate} from './oa-gate-policy.mjs';
const {GITHUB_REPOSITORY,OA_HEAD_SHA,GH_TOKEN}=process.env;
if(!GITHUB_REPOSITORY||!OA_HEAD_SHA||!GH_TOKEN)throw new Error('GitHub context is required');
const until=Date.now()+12*60*1000;
while(Date.now()<until){
 const runs=[];
 for(let page=1;page<=10;page++){
  const response=await fetch(`https://api.github.com/repos/${GITHUB_REPOSITORY}/commits/${OA_HEAD_SHA}/check-runs?per_page=100&page=${page}`,{headers:{authorization:`Bearer ${GH_TOKEN}`,accept:'application/vnd.github+json','x-github-api-version':'2022-11-28'}});
  if(!response.ok)throw new Error(`Unable to read checks: HTTP ${response.status}`);
  const data=await response.json();runs.push(...data.check_runs);if(data.check_runs.length<100)break;
 }
 const result=evaluate(runs);
 if(result.status==='failed')throw new Error(`Required check failed or skipped: ${result.name} (${result.conclusion})`);
 if(result.status==='passed'){console.log('All seven OA checks passed on '+OA_HEAD_SHA);process.exit(0);}
 await new Promise(resolve=>setTimeout(resolve,5000));
}
throw new Error('Timed out waiting for all required OA checks.');
