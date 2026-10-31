import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from '@playwright/test';

const root = fileURLToPath(new URL('.', import.meta.url));
const state = mkdtempSync(resolve(tmpdir(), 'nuochong-oa-preview-'));
const probe = createServer(); await new Promise((done) => probe.listen(0, '127.0.0.1', done));
const port = probe.address().port; await new Promise((done) => probe.close(done));
let nginx; let publicUrl;
if (process.env.OA_PROBE_NGINX === '1') {
  await new Promise((done) => probe.listen(0, '127.0.0.1', done));
  const proxyPort = probe.address().port; await new Promise((done) => probe.close(done));
  publicUrl = new URL(`https://localhost:${proxyPort}/oa-test/`);
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=localhost',
    '-addext', 'subjectAltName=DNS:localhost', '-keyout', resolve(state, 'tls.key'), '-out', resolve(state, 'tls.crt')], { stdio: 'ignore' });
  const { readFileSync } = await import('node:fs');
  const location = readFileSync(resolve(root, 'deploy/nginx-location.conf'), 'utf8')
    .replace('127.0.0.1:3080', `127.0.0.1:${port}`)
    .replace('/var/log/nginx/nuochong-oa-test-error.log', resolve(state, 'error.log'));
  writeFileSync(resolve(state, 'nginx.conf'), `pid ${state}/nginx.pid; error_log ${state}/error.log crit; events {} http { access_log off; server { listen 127.0.0.1:${proxyPort} ssl; server_name localhost; ssl_certificate ${state}/tls.crt; ssl_certificate_key ${state}/tls.key; ${location} } }`);
  nginx = spawn('nginx', ['-p', state, '-c', resolve(state, 'nginx.conf'), '-g', 'daemon off;'], { stdio: 'ignore' });
}
const child = spawn(process.execPath, [resolve(root, 'start.mjs'), '--port', String(port)], {
  detached: true, stdio: ['ignore', 'pipe', 'pipe'], env: { PATH: process.env.PATH, NUOCHONG_OA_HOME: state,
    ...(publicUrl && { NUOCHONG_OA_PUBLIC_URL: publicUrl.href }) },
});
let log = ''; let browser; let failure;
const capture = (bytes) => { log = (log + bytes.toString()).slice(-100_000); };
child.stdout.on('data', capture); child.stderr.on('data', capture);
const report = { time: new Date().toISOString(), node: process.version, platform: `${process.platform}-${process.arch}`,
  profile: 'web', runtime: '0.2.1-rc.2', scope: 'Official Harness Web UI, fresh isolated local administrator home; no model call or real credential' };
try {
  let startup;
  for (let i = 0; i < 600; i++) {
    // Startup output may contain terminal escape sequences.
    // eslint-disable-next-line no-control-regex
    const matches = log.match(/https?:\/\/[^\s\u001b]+/g) ?? [];
    startup = matches.map((value) => { try { return new URL(value); } catch { return null; } })
      .find((url) => url?.origin === (publicUrl?.origin ?? `http://127.0.0.1:${port}`) && url.search);
    if (startup) break;
    if (child.exitCode !== null || child.signalCode !== null) throw new Error('Official Web profile exited before readiness.');
    await delay(100);
  }
  assert.ok(startup, 'Official Web profile did not announce readiness.');
  const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  browser = await chromium.launch({ headless: true, ...(process.platform === 'darwin' && existsSync(chrome) ? { executablePath: chrome } : {}) });
  const page = await browser.newPage({ ignoreHTTPSErrors: Boolean(publicUrl) });
  let receivedFrames = 0;
  page.on('websocket', (socket) => socket.on('framereceived', () => receivedFrames++));
  const errors = []; page.on('pageerror', (error) => errors.push(error.name));
  await page.goto(startup.href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#root')?.children.length > 0);
  assert.match(await page.title(), /DeepSeek Harness/);
  await page.waitForFunction(() => (document.body.textContent ?? '').trim().length > 20);
  assert.equal(new URL(page.url()).search, '', 'Launch credential must be stripped after cookie exchange.');
  assert.equal(errors.length, 0);
  await page.getByRole('button').first().waitFor({ state: 'visible', timeout: 15000 });
  assert.equal((await page.locator('body').innerText()).includes('员工账号'), false);
  if (publicUrl) {
    assert.equal(new URL(page.url()).pathname, '/oa-test/');
    for (let i = 0; i < 100 && !receivedFrames; i++) await delay(100);
    assert.ok(receivedFrames > 0, 'Native authenticated WebSocket must receive frames through the proxy.');
    const cookies = await page.context().cookies();
    assert.ok(cookies.some((cookie) => cookie.secure && cookie.httpOnly && cookie.path === '/oa-test/'));
    Object.assign(report, { httpsPrefixProxy: true, authenticatedWebSocket: true, scopedSecureCookie: true });
  }
  mkdirSync(resolve(root, 'outputs'), { recursive: true });
  await page.screenshot({ path: resolve(root, 'outputs/oa-home.png'), fullPage: true });
  Object.assign(report, { passed: true, title: await page.title(), browser: browser.version(), launchTokenRemoved: true,
    rendered: true, pageErrors: 0, modelCalls: 0 });
} catch (error) {
  failure = String(error.message).replace(/https?:\/\/[^\s]+/g, '<redacted-url>');
  Object.assign(report, { passed: false, failure, startupDiagnostic: log.replace(/https?:\/\/[^\s]+/g, '<redacted-url>').slice(-4000) });
  process.exitCode = 1;
} finally {
  await browser?.close();
  if (nginx && nginx.exitCode === null) { const closed = once(nginx, 'close'); nginx.kill('SIGTERM'); await closed; }
  if (child.exitCode === null && child.signalCode === null) {
    const closed = once(child, 'close'); process.kill(-child.pid, 'SIGTERM');
    const force = setTimeout(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch { /* Process already exited. */ } }, 7000);
    await closed; clearTimeout(force);
  }
  rmSync(state, { recursive: true, force: true }); mkdirSync(resolve(root, 'outputs'), { recursive: true });
  writeFileSync(resolve(root, 'outputs/oa-home-probe.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}
