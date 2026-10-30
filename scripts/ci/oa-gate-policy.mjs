export const required=['Build (worker)','Build (static)','Playwright E2E','control-api','CLI contract and package (Node 22.13.0)','CLI contract and package (Node 24.21.0)','OA container and recovery'];
export function evaluate(runs){
 const checks=required.map(name=>runs.filter(run=>run.name===name&&run.app?.slug==='github-actions').sort((a,b)=>b.id-a.id)[0]);
 const failed=checks.find(run=>run&&run.status==='completed'&&run.conclusion!=='success');
 if(failed)return {status:'failed',name:failed.name,conclusion:failed.conclusion};
 return {status:checks.every(run=>run?.status==='completed'&&run.conclusion==='success')?'passed':'waiting'};
}
