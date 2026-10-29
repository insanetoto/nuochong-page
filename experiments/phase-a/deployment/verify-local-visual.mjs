import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { once } from 'node:events';
import { promisify } from 'node:util';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';

const root=fileURLToPath(new URL('.',import.meta.url));const repo=resolve(root,'../../..');
const exec=promisify(execFile);const children=[];
const state=mkdtempSync(resolve(tmpdir(),'nuochong-a09-'));
async function freePort(){const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;await new Promise(r=>server.close(r));return port;}
function launch(script,args,env){
  const child=spawn(process.execPath,[script,...args],{cwd:repo,detached:true,stdio:['ignore','pipe','pipe'],
    env:{PATH:process.env.PATH,LANG:'en_US.UTF-8',...env}});
  children.push(child);child.stdout.resume();child.stderr.resume();return child;
}
async function ready(url){for(let i=0;i<200;i++){try{if((await fetch(url)).ok)return;}catch{}await delay(100);}throw new Error('local exercise startup timeout');}
async function kill(child){if(child.exitCode!==null||child.signalCode!==null)return;const closed=once(child,'close');process.kill(-child.pid,'SIGKILL');await closed;}
const report={time:new Date().toISOString(),node:process.version,platform:`${process.platform}-${process.arch}`,results:[]};
try{
  const sitePort=await freePort();const hostPort=await freePort();
  launch(resolve(root,'static-server.mjs'),[],{SITE_ROOT:resolve(repo,'dist-static'),PORT:String(sitePort)});
  const host=launch(resolve(root,'services.mjs'),['host'],{PORT:String(hostPort),STATE_ROOT:state,
    PROBE_SERVICE_SECRET:'local-synthetic-canary',JOB_SCHEMA:'a07_local_visual'});
  await ready(`http://127.0.0.1:${sitePort}`);await ready(`http://127.0.0.1:${hostPort}/health`);
  const health=await(await fetch(`http://127.0.0.1:${hostPort}/health`)).json();assert.equal(health.harnessInitialized,true);
  await kill(host);
  await assert.rejects(fetch(`http://127.0.0.1:${hostPort}/health`));
  const chrome='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  report.browser=(await exec(chrome,['--version'])).stdout.trim();
  const result=await exec(process.execPath,[resolve(repo,'node_modules/@playwright/test/cli.js'),'test','--config','tests/visual/playwright.config.ts'],
    {cwd:repo,maxBuffer:2*1024*1024,env:{PATH:process.env.PATH,HOME:process.env.HOME,TMPDIR:process.env.TMPDIR,
      PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH:chrome,VISUAL_EXTERNAL_URL:`http://127.0.0.1:${sitePort}`}});
  assert.match(result.stdout,/5 passed/);
  report.results.push({name:'real Harness Host process group killed; full approved macOS website suite',passed:true,
    tests:5,baselineUpdated:false,scope:'2 viewports × 2 languages, pixel/content/SEO/links/interactions and language preference'});
}catch(error){report.results.push({name:'local Host-down visual regression',passed:false,error:String(error.message).slice(-2000)});process.exitCode=1;}
finally{
  for(const child of children.reverse())await kill(child);rmSync(state,{recursive:true,force:true});
  mkdirSync(resolve(root,'outputs'),{recursive:true});writeFileSync(resolve(root,'outputs/local-visual-probe.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
}
