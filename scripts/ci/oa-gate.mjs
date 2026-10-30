const required=['Build (worker)','Build (static)','Playwright E2E','control-api','CLI contract and package (Node 22.13.0)','CLI contract and package (Node 24.21.0)','OA container and recovery'];
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
 const checks=required.map(name=>runs.filter(run=>run.name===name&&run.app?.slug==='github-actions').sort((a,b)=>b.id-a.id)[0]);
 const failed=checks.find(run=>run&&run.status==='completed'&&run.conclusion!=='success');
 if(failed)throw new Error(`Required check failed or skipped: ${failed.name} (${failed.conclusion})`);
 if(checks.every(run=>run?.status==='completed'&&run.conclusion==='success')){console.log('All seven OA checks passed on '+OA_HEAD_SHA);process.exit(0);}
 await new Promise(resolve=>setTimeout(resolve,5000));
}
throw new Error('Timed out waiting for all required OA checks.');
