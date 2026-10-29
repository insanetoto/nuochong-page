import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash, generateKeyPairSync, sign, randomBytes } from 'node:crypto';
import { cpSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import os from 'node:os';
import { chromium } from '@playwright/test';
import { createPool } from '../jobs/store.mjs';
import { FIXTURE_ISSUER, FIXTURE_AUDIENCE } from '../isolation/security.mjs';

const run = promisify(execFile);
const root = fileURLToPath(new URL('.', import.meta.url));
const repo = resolve(root, '../../..');
const outputs = resolve(root, 'outputs'); mkdirSync(outputs, { recursive: true });
const id = `a09-${crypto.randomUUID().slice(0, 8)}`;
const network = `${id}-network`;
const schema = 'a07_deployment';
const secret = `A09_SERVER_CANARY_${randomBytes(24).toString('hex')}`;
const dbPassword = randomBytes(16).toString('hex');
const containers = new Set(); const logs = [];
const results = []; const images = {};
let pool, browser, monitor, networkCreated = false;
let siteURL, apiURL, hostURL, nodeDigest, pgDigest, database;
let lastJob;
const siteSamples = [];
const hash = (data) => createHash('sha256').update(data).digest('hex');
const sanitize = (value) => String(value).replaceAll(secret, '<server-secret>').replaceAll(dbPassword, '<db-password>');
async function docker(...args) {
  try {
    const output = await run('docker', args, { maxBuffer: 10 * 1024 * 1024 });
    return args[0] === 'logs' ? `${output.stdout}\n${output.stderr}`.trim() : output.stdout.trim();
  }
  catch (error) { throw new Error(sanitize(`docker ${args[0]} failed: ${error.stderr ?? error.message}`).slice(-3000)); }
}
const name = (role) => `${id}-${role}`;
async function inspect(role) { return JSON.parse(await docker('inspect', name(role)))[0]; }
async function stop(role) {
  if (!containers.has(role)) return;
  await docker('stop', '--time', '3', name(role));
  logs.push(await docker('logs', name(role)));
  await docker('rm', '--volumes', name(role)); containers.delete(role);
}
async function launch(role, image, command, env = {}, options = []) {
  const args = ['run', '--detach', '--name', name(role), '--network', network,
    '--network-alias', role, '--read-only', '--cap-drop=ALL', '--security-opt=no-new-privileges',
    '--tmpfs', '/tmp:rw,noexec,nosuid,nodev,size=64m,mode=1777', '--tmpfs', '/state:rw,noexec,nosuid,nodev,size=128m,mode=1777',
    '--memory=512m', '--memory-swap=512m', '--cpus=1', '--pids-limit=128', ...options];
  const launchEnv = { ...env };
  if (role === 'host') {
    // The locked native loader materializes .node files in os.tmpdir before
    // dlopen. General /tmp stays noexec; only this bounded private cache allows mappings.
    args.push('--tmpfs', '/native-cache:rw,exec,nosuid,nodev,size=32m,uid=1000,gid=1000,mode=700');
    launchEnv.NATIVE_CACHE_ROOT = '/native-cache'; launchEnv.TMPDIR = '/native-cache';
  }
  for (const [key, value] of Object.entries(launchEnv)) args.push('--env', `${key}=${value}`);
  args.push(image, ...command);
  await docker(...args); containers.add(role);
}
async function url(role, port) {
  const bindings = (await inspect(role)).NetworkSettings.Ports[`${port}/tcp`];
  return `http://127.0.0.1:${bindings[0].HostPort}`;
}
async function waitFor(body, timeoutMs = 30_000) {
  const start = performance.now();
  while (performance.now() - start < timeoutMs) {
    const result = await body(); if (result) return result; await delay(100);
  }
  throw new Error('exercise deadline exceeded');
}
async function health(base) {
  try { const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(1000) }); return res.ok && await res.json(); }
  catch { return false; }
}
async function check(label, body) {
  const start = performance.now();
  try { const details = await body(); results.push({ name: label, passed: true, ms: performance.now() - start, ...details }); }
  catch (error) { results.push({ name: label, passed: false, error: sanitize(error.message) }); throw error; }
}
const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
function token(user = 'a1') {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'fixture-key' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const body = Buffer.from(JSON.stringify({ iss: FIXTURE_ISSUER, aud: FIXTURE_AUDIENCE,
    sub: user, iat: now, exp: now + 3600 })).toString('base64url');
  return `${header}.${body}.${sign('RSA-SHA256', Buffer.from(`${header}.${body}`), privateKey).toString('base64url')}`;
}
const auth = { authorization: `Bearer ${token()}`, 'content-type': 'application/json' };
const internal = { authorization: `Bearer ${secret}`, 'content-type': 'application/json' };
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory()
    ? files(join(dir, entry.name)) : [join(dir, entry.name)]);
}
async function buildArtifacts() {
  const bundle = resolve(outputs, 'bundle'); mkdirSync(bundle, { recursive: true });
  for (const dir of ['runtime', 'jobs', 'deployment']) {
    mkdirSync(resolve(bundle, dir), { recursive: true });
    // Explicit allowlist: never copy .env, .dsh-home, outputs, Git or user data.
    for (const file of readdirSync(resolve(root, '..', dir))) {
      if (file.endsWith('.mjs') || file === 'package.json' || file === 'package-lock.json' || file === 'schema.sql') {
        cpSync(resolve(root, '..', dir, file), resolve(bundle, dir, file));
      }
    }
    cpSync(resolve(root, '..', dir, 'node_modules'), resolve(bundle, dir, 'node_modules'), { recursive: true, verbatimSymlinks: true });
  }
  mkdirSync(resolve(bundle, 'isolation'), { recursive: true });
  cpSync(resolve(root, '../isolation/security.mjs'), resolve(bundle, 'isolation/security.mjs'));
  cpSync(resolve(repo, 'dist-static'), resolve(bundle, 'website'), { recursive: true });
  const source = Object.fromEntries(files(bundle).filter((p) => !p.includes('/node_modules/')).sort()
    .map((p) => [p.slice(bundle.length + 1), hash(readFileSync(p))]));
  const sourceDigest = hash(JSON.stringify(source));
  writeFileSync(resolve(bundle, 'Dockerfile'), `FROM ${nodeDigest}\nWORKDIR /app\nCOPY runtime runtime\nCOPY jobs jobs\nCOPY isolation isolation\nCOPY deployment deployment\nCOPY website website\nCOPY release.json release.json\nUSER node\n`);
  const sourceSha = (await run('git', ['rev-parse', 'HEAD'], { cwd: repo })).stdout.trim();
  for (const release of ['v1', 'v2']) {
    writeFileSync(resolve(bundle, 'release.json'), JSON.stringify({ release, sourceSha, sourceDigest }));
    const tag = `${id}:${release}`;
    await docker('build', '--quiet', '--tag', tag, bundle);
    images[release] = { id: (await docker('image', 'inspect', '--format', '{{.Id}}', tag)), sourceSha, sourceDigest };
  }
  assert.notEqual(images.v1.id, images.v2.id);
}
function backendEnv() { return { DATABASE_URL: `postgresql://prototype:${dbPassword}@database:5432/prototype`,
  JOB_SCHEMA: schema, PROBE_SERVICE_SECRET: secret, HOST_URL: 'http://host:3002', STATE_ROOT: '/state/harness',
  JWT_PUBLIC_KEY: Buffer.from(publicKey.export({ type: 'spki', format: 'pem' })).toString('base64') }; }
async function startBackend(release) {
  await launch('host', images[release].id, ['node', 'deployment/services.mjs', 'host'], backendEnv(), ['-p', '127.0.0.1::3002']);
  hostURL = await url('host', 3002); await waitFor(() => health(hostURL));
  await launch('api', images[release].id, ['node', 'deployment/services.mjs', 'api'], backendEnv(), ['-p', '127.0.0.1::3001']);
  apiURL = await url('api', 3001); await waitFor(() => health(apiURL));
}
async function startWorkers(release) {
  for (const role of ['worker-a', 'worker-b']) await launch(role, images[release].id, ['node', 'deployment/services.mjs', 'worker'], backendEnv());
}
async function stopBackend() { for (const role of ['worker-a', 'worker-b', 'api', 'host']) await stop(role); }
async function submit(prompt = 'fast-fixture') {
  const response = await fetch(`${apiURL}/api/ai/runs`, { method: 'POST', headers: auth,
    body: JSON.stringify({ prompt, idempotencyKey: crypto.randomUUID() }) });
  assert.equal(response.status, 202); const result = await response.json(); lastJob = result; return result;
}
async function completed(id, timeout = 10_000) {
  return waitFor(async () => {
    const res = await fetch(`${apiURL}/api/ai/runs/${id}`, { headers: auth });
    const result = await res.json();
    assert.notEqual(result.status, 'failed'); return result.status === 'succeeded' && result;
  }, timeout);
}
async function contentBaseline() {
  for (const [size, viewport] of [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
    for (const lang of ['en', 'zh']) {
      const page = await browser.newPage({ viewport, locale: 'en-US', timezoneId: 'Asia/Shanghai', colorScheme: 'light', reducedMotion: 'reduce' });
      try {
        await page.goto(`${siteURL}/?lang=${lang}`, { waitUntil: 'networkidle' });
        await page.evaluate(async () => { await document.fonts.ready; await Promise.all(Array.from(document.images, (i) => i.decode())); });
        const actual = await page.evaluate(() => ({ title: document.title,
          description: document.querySelector('meta[name="description"]')?.getAttribute('content'),
          favicon: document.querySelector('link[rel="icon"]')?.getAttribute('href'), language: document.documentElement.lang,
          text: document.querySelector('main')?.textContent?.replace(/\s+/g, ' ').trim(),
          sections: Array.from(document.querySelectorAll('section[id]'), (s) => s.id),
          links: Array.from(document.querySelectorAll('a'), (a) => ({ text: a.textContent?.trim(), href: a.getAttribute('href') })),
          images: Array.from(document.images, (i) => ({ src: i.getAttribute('src'), alt: i.alt })) }));
        assert.deepEqual(actual, JSON.parse(readFileSync(resolve(repo, `tests/visual/baselines/darwin/${size}-${lang}-content.json`))));
      } finally { await page.close(); }
    }
  }
}

let failure;
const diagnostics = [];
try {
  const baseline = JSON.parse(readFileSync(resolve(repo, 'docs/refactor/evidence/A-02-baseline.json')));
  await check('all protected website source and approved baseline hashes unchanged', async () => {
    for (const [file, digest] of Object.entries({ ...baseline.sha256, ...baseline.baselineSha256 })) {
      assert.equal(hash(readFileSync(resolve(repo, file))), digest, file);
    }
  });
  await docker('pull', 'node:24.21.0-bookworm-slim');
  nodeDigest = JSON.parse(await docker('image', 'inspect', 'node:24.21.0-bookworm-slim'))[0].RepoDigests[0];
  await docker('pull', 'postgres:17.11');
  pgDigest = JSON.parse(await docker('image', 'inspect', 'postgres:17.11'))[0].RepoDigests[0];
  await buildArtifacts();
  await docker('network', 'create', network); networkCreated = true;
  await docker('run', '--detach', '--name', name('database'), '--network', network, '--network-alias', 'database',
    '--env', 'POSTGRES_USER=prototype', '--env', `POSTGRES_PASSWORD=${dbPassword}`, '--env', 'POSTGRES_DB=prototype',
    '-p', '127.0.0.1::5432', pgDigest); containers.add('database');
  const databaseURL = `${await url('database', 5432)}`.replace('http://', `postgresql://prototype:${dbPassword}@`) + '/prototype';
  pool = createPool(databaseURL, schema);
  await waitFor(async () => { try { await pool.query('SELECT 1'); return true; } catch { return false; } });
  await pool.query(`CREATE SCHEMA ${schema}`);
  await pool.query(readFileSync(resolve(root, '../jobs/schema.sql'), 'utf8'));
  await pool.query('CREATE TABLE a09_quota(scope text PRIMARY KEY,calls integer NOT NULL CHECK(calls<=2))');
  database = (await pool.query('SELECT version() AS version')).rows[0].version; assert.match(database, /PostgreSQL 17\.11\b/);
  await launch('website', images.v1.id, ['node', 'deployment/static-server.mjs'], {}, ['-p', '127.0.0.1::3000']);
  siteURL = await url('website', 3000);
  await waitFor(async () => { try { return (await fetch(siteURL)).ok; } catch { return false; } });
  const siteHash = hash(Buffer.from(await (await fetch(siteURL)).arrayBuffer()));
  monitor = setInterval(async () => {
    try {
      const res = await fetch(siteURL, { signal: AbortSignal.timeout(2000) });
      siteSamples.push({ ok: res.ok && hash(Buffer.from(await res.arrayBuffer())) === siteHash });
    } catch { siteSamples.push({ ok: false }); }
  }, 100);
  browser = await chromium.launch({ headless: true });
  await startBackend('v1');

  await check('real Fastify API and isolated Harness Host boot', async () => {
    const api = await health(apiURL); const host = await health(hostURL);
    for (const state of [api, host]) { assert.equal(state.node, 'v24.21.0'); assert.equal(state.fastify, '5.12.7'); }
    assert.equal(host.harnessInitialized, true); return { node: api.node, fastify: api.fastify };
  });
  await check('kernel container limits and readonly artifact are configured', async () => {
    const state = await inspect('host');
    assert.equal(state.HostConfig.Memory, 512*1024*1024); assert.equal(state.HostConfig.NanoCpus, 1e9);
    assert.equal(state.HostConfig.PidsLimit, 128); assert.equal(state.HostConfig.ReadonlyRootfs, true);
    assert.match(state.HostConfig.Tmpfs['/tmp'], /noexec/);assert.match(state.HostConfig.Tmpfs['/state'], /noexec/);
    assert.match(state.HostConfig.Tmpfs['/native-cache'], /mode=700/);
    const cgroup = JSON.parse(await docker('exec', name('host'), 'node', '-e',
      "const fs=require('fs');console.log(JSON.stringify({memory:fs.readFileSync('/sys/fs/cgroup/memory.max','utf8').trim(),cpu:fs.readFileSync('/sys/fs/cgroup/cpu.max','utf8').trim()}))"));
    assert.equal(cgroup.memory, String(512*1024*1024)); return cgroup;
  });
  await check('Host synthetic-call concurrency cap rejects a third active call', async () => {
    const requests = [0,1].map(() => fetch(`${hostURL}/probe/call`, { method: 'POST', headers: internal, body: '{}' }));
    await waitFor(async () => (await health(hostURL)).active === 2);
    const third = await fetch(`${hostURL}/probe/call`, { method: 'POST', headers: internal, body: '{}' });
    assert.equal(third.status, 429); assert.equal((await third.json()).code, 'HOST_CONCURRENCY_LIMIT');
    for (const response of await Promise.all(requests)) { assert.equal(response.status, 200); await response.arrayBuffer(); }
  });
  await check('persistent synthetic model-call quota blocks excess admission', async () => {
    for (const expected of [200,200,429]) {
      const res = await fetch(`${hostURL}/probe/call`, { method: 'POST', headers: internal, body: '{"quota":true}' });
      assert.equal(res.status, expected); await res.arrayBuffer();
    }
    assert.equal((await pool.query("SELECT calls FROM a09_quota WHERE scope='fixture'")).rows[0].calls, 2);
  });
  await check('API rejects unauthenticated identity, forged tenant and sixth pending job', async () => {
    assert.equal((await fetch(`${apiURL}/api/probe/stream`)).status, 401);
    for(const field of ['tenantId','userId','roles']){
      const forged = await fetch(`${apiURL}/api/ai/runs`, { method: 'POST', headers: auth,
        body: JSON.stringify({ prompt: 'fixture', idempotencyKey: 'forged', [field]: 'attacker' }) });
      assert.equal(forged.status, 400);
    }
    for (let i=0;i<5;i++) await submit();
    const sixth = await fetch(`${apiURL}/api/ai/runs`, { method: 'POST', headers: auth,
      body: JSON.stringify({ prompt: 'fixture', idempotencyKey: 'sixth' }) });
    assert.equal(sixth.status, 429);
    const cross = await fetch(`${apiURL}/api/ai/runs/${lastJob.runId}`, { headers: { authorization: `Bearer ${token('b1')}` } });
    assert.equal(cross.status, 404);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM jobs')).rows[0].n, 5);
  });
  await startWorkers('v1');
  await waitFor(async () => (await pool.query("SELECT count(*)::int AS n FROM jobs WHERE status<>'succeeded'")).rows[0].n === 0);
  await check('real HTTP proxy forwards live frames before upstream completes', async () => {
    const start = performance.now(); const res = await fetch(`${apiURL}/api/probe/stream`, { headers: auth });
    assert.equal(res.status, 200); assert.equal(res.headers.get('x-accel-buffering'), 'no');
    let firstMs; let text = '';
    for await (const bytes of res.body) { firstMs ??= performance.now()-start; text += Buffer.from(bytes).toString(); }
    const totalMs=performance.now()-start;
    assert.equal((text.match(/event: run.delta/g) ?? []).length,3); assert.ok(firstMs < totalMs-100);
    return { firstMs, totalMs, frames: 3, executor: 'synthetic' };
  });
  await check('client stream disconnect closes upstream subscription', async () => {
    const res = await fetch(`${apiURL}/api/probe/stream`, { headers: auth }); const reader=res.body.getReader();
    await reader.read(); await reader.cancel();
    await waitFor(async () => (await health(hostURL)).streamConnections === 0,2000);
  });
  for (let round=1;round<=3;round++) await check(`Host SIGKILL ${round}: site baseline, explicit AI fault and single terminal recovery`, async () => {
    const job = await submit('slow-fixture');
    await waitFor(async () => (await health(hostURL)).active > 0);
    const live = await fetch(`${apiURL}/api/probe/stream`, { headers: auth }); const reader=live.body.getReader(); await reader.read();
    const crashAt = performance.now(); await docker('kill', '--signal=KILL', name('host'));
    const unavailable=await fetch(`${apiURL}/api/probe/stream`,{headers:auth});
    assert.equal(unavailable.status,503); assert.equal((await unavailable.json()).code,'AI_UNAVAILABLE');
    let remaining=''; for (;;) { const {value,done}=await reader.read();if(done)break;remaining+=Buffer.from(value).toString(); }
    assert.match(remaining,/AI_UNAVAILABLE/);
    if(round===1) await contentBaseline();
    else assert.equal(hash(Buffer.from(await (await fetch(siteURL)).arrayBuffer())),siteHash);
    await stop('host');
    await launch('host',images.v1.id,['node','deployment/services.mjs','host'],backendEnv(),['-p','127.0.0.1::3002']);
    hostURL=await url('host',3002);await waitFor(()=>health(hostURL));
    const recovered=await completed(job.runId,10_000-(performance.now()-crashAt));
    const recoverMs=performance.now()-crashAt;assert.ok(recoverMs<=10_000);assert.ok(recovered.attempt>=2);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM effects WHERE job_id=$1',[job.runId])).rows[0].n,1);
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM status_history WHERE job_id=$1 AND status IN ('succeeded','failed','cancelled')",[job.runId])).rows[0].n,1);
    return {recoverMs,attempts:recovered.attempt,siteContentBaseline:round===1?'desktop/mobile × en/zh approved DOM manifests':'identical artifact bytes'};
  });
  await check('quota remains exhausted after three Host restarts',async()=>{
    const res=await fetch(`${hostURL}/probe/call`,{method:'POST',headers:internal,body:'{"quota":true}'});assert.equal(res.status,429);await res.arrayBuffer();
  });
  await check('same immutable image promotes to all backend roles and rolls back within 60 seconds',async()=>{
    await launch('candidate',images.v2.id,['node','deployment/services.mjs','api'],backendEnv(),['-p','127.0.0.1::3001']);
    const candidateURL=await url('candidate',3001);await waitFor(()=>health(candidateURL));
    const candidateId=(await inspect('candidate')).Image;
    await stopBackend();await startBackend('v2');await startWorkers('v2');
    for(const role of ['api','host','worker-a','worker-b'])assert.equal((await inspect(role)).Image,candidateId);
    assert.equal((await health(apiURL)).release,'v2');await completed((await submit()).runId);
    const rollbackAt=performance.now();await stopBackend();await startBackend('v1');await startWorkers('v1');
    assert.equal((await health(apiURL)).release,'v1');assert.equal((await health(hostURL)).release,'v1');
    await completed((await submit()).runId);const rollbackMs=performance.now()-rollbackAt;assert.ok(rollbackMs<=60_000);
    for(const role of ['api','host','worker-a','worker-b'])assert.equal((await inspect(role)).Image,images.v1.id);
    return {candidateImage:candidateId,promotedImage:images.v2.id,rollbackImage:images.v1.id,rollbackMs};
  });
  await check('pg_dump restores exact fixtures into a separate database',async()=>{
    const snapshot=async(p)=>Object.fromEntries(await Promise.all(['jobs','status_history','effects','a09_quota'].map(async(table)=>
      [table,(await p.query(`SELECT * FROM ${table} ORDER BY to_jsonb(${table})::text`)).rows])));
    const before=await snapshot(pool);const restoreAt=performance.now();
    await docker('exec',name('database'),'pg_dump','-U','prototype','-d','prototype','-Fc','-f','/tmp/a09.dump');
    await docker('exec',name('database'),'createdb','-U','prototype','prototype_restore');
    await docker('exec',name('database'),'pg_restore','-U','prototype','-d','prototype_restore','/tmp/a09.dump');
    const restored=createPool(databaseURL.replace('/prototype','/prototype_restore'),schema);
    try {assert.deepEqual(await snapshot(restored),before);}finally{await restored.end();}
    return {restoreMs:performance.now()-restoreAt,source:'prototype',target:'prototype_restore',jobs:before.jobs.length,
      fixtureSHA256:hash(JSON.stringify(before))};
  });
  await check('kernel enforces memory cap and CPU throttling in disposable probes',async()=>{
    await launch('memory-probe',images.v1.id,['node','--max-old-space-size=512','-e',
      'const kept=[];for(let i=0;i<1000;i++)kept.push(Buffer.alloc(8*1024*1024,1));'],{},['--memory=64m','--memory-swap=64m']);
    assert.equal(await docker('wait',name('memory-probe')),'137');assert.equal((await inspect('memory-probe')).State.OOMKilled,true);
    await launch('cpu-probe',images.v1.id,['node','-e',
      "const fs=require('fs');const n=()=>Number(fs.readFileSync('/sys/fs/cgroup/cpu.stat','utf8').match(/nr_throttled (\\d+)/)[1]);const before=n();const t=Date.now();while(Date.now()-t<2000){}console.log(JSON.stringify({throttled:n()-before}));"],{},['--cpus=0.25']);
    assert.equal(await docker('wait',name('cpu-probe')),'0');const stats=JSON.parse(await docker('logs',name('cpu-probe')));assert.ok(stats.throttled>0);
    return {memoryProbeBytes:64*1024*1024,oomKilled:true,cpuProbeCores:0.25,...stats};
  });
  await check('all tasks terminal with one database effect and terminal event each',async()=>{
    const rows=(await pool.query(`SELECT j.id,j.status,count(DISTINCT e.job_id)::int AS effects,
      count(DISTINCT h.version)::int AS terminals FROM jobs j LEFT JOIN effects e ON e.job_id=j.id
      LEFT JOIN status_history h ON h.job_id=j.id AND h.status IN ('succeeded','failed','cancelled') GROUP BY j.id`)).rows;
    assert.ok(rows.length>=10);assert.ok(rows.every((r)=>r.status==='succeeded'&&r.effects===1&&r.terminals===1));return{tasks:rows.length};
  });
  await check('website responses remain byte-identical throughout faults and rollback',async()=>{
    assert.ok(siteSamples.length>20);assert.ok(siteSamples.every((r)=>r.ok));return{samples:siteSamples.length,failures:0};
  });
  await check('frontend and complete service logs exclude server credentials; traces correlate',async()=>{
    for(const file of files(resolve(repo,'dist-static')))assert.ok(!readFileSync(file).includes(Buffer.from(secret)));
    for(const role of [...containers])logs.push(await docker('logs',name(role)));
    const text=logs.join('\n');assert.equal(text.includes(secret),false);assert.equal(text.includes(dbPassword),false);
    assert.equal(/github_pat_[A-Za-z0-9_]{20,}|sk-[a-f0-9]{24,}/.test(text),false);
    const roles=new Set(text.split('\n').flatMap((line)=>{try{const r=JSON.parse(line);return r.requestId===lastJob.requestId?[r.role]:[];}catch{return[];}}));
    for(const role of ['api','worker','host'])assert.ok(roles.has(role));
    const website=(await inspect('website')).Config.Env.join('\n');assert.equal(website.includes(secret),false);
    return{credentialLeaks:0,traceRoles:[...roles]};
  });
} catch(error) { failure=sanitize(error.message);process.exitCode=1; }
finally {
  clearInterval(monitor);await browser?.close();await pool?.end();
  if(failure)for(const role of containers){
    try{const state=await inspect(role);diagnostics.push({role,status:state.State.Status,exitCode:state.State.ExitCode,
      oomKilled:state.State.OOMKilled,log:sanitize(await docker('logs',name(role))).slice(-15000)});}catch{}
  }
  for(const role of [...containers].reverse())try{await stop(role);}catch(error){failure??=sanitize(error.message);process.exitCode=1;}
  if(logs.some((text)=>text.includes(secret)||text.includes(dbPassword))){failure='credential canary found in service logs';process.exitCode=1;}
  if(networkCreated)try{await docker('network','rm',network);}catch{process.exitCode=1;}
  const report={time:new Date().toISOString(),node:process.version,platform:`${process.platform}-${process.arch}`,
    resources:{cpus:os.cpus().length,totalMemoryBytes:os.totalmem(),os:os.release()},database,
    baseImages:{node:nodeDigest,postgres:pgDigest},images,results,failure:failure??null,diagnostics,
    scope:'Real Docker/Fastify/API/Worker/Host/Harness boot/PostgreSQL/HTTP proxy; synthetic executor, issuer and quota; no public or production deployment',
    limitations:['No paid model calls in this suite; A-06 has separate real model evidence',
      'Linux DOM baseline is not a Linux pixel baseline; macOS pixel test recorded separately',
      'No schema migration rollback or production disaster recovery claim']};
  writeFileSync(resolve(outputs,'deployment-probe.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}
