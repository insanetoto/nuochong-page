import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
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
const child = spawn(process.execPath, [resolve(root, 'start.mjs'), '--port', String(port)], {
  detached: true, stdio: ['ignore', 'pipe', 'pipe'], env: { PATH: process.env.PATH, NUOCHONG_OA_HOME: state },
});
let log = ''; let browser; let failure;
const capture = (bytes) => { log = (log + bytes.toString()).slice(-100_000); };
child.stdout.on('data', capture); child.stderr.on('data', capture);
const report = { time: new Date().toISOString(), node: process.version, platform: `${process.platform}-${process.arch}`,
  profile: 'web', runtime: '0.2.1-rc.2', scope: 'Official Harness Web UI, fresh isolated local administrator home; no model call or real credential' };
try {
  let startup;
  for (let i = 0; i < 600; i++) {
    const matches = log.match(/https?:\/\/[^\s\u001b]+/g) ?? [];
    startup = matches.map((value) => { try { return new URL(value); } catch { return null; } })
      .find((url) => url?.hostname === '127.0.0.1' && url.port === String(port) && url.search);
    if (startup) break;
    if (child.exitCode !== null || child.signalCode !== null) throw new Error('Official Web profile exited before readiness.');
    await delay(100);
  }
  assert.ok(startup, 'Official Web profile did not announce readiness.');
  const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  browser = await chromium.launch({ headless: true, ...(process.platform === 'darwin' && existsSync(chrome) ? { executablePath: chrome } : {}) });
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', (error) => errors.push(error.name));
  await page.goto(startup.href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#root')?.children.length > 0);
  assert.match(await page.title(), /DeepSeek Harness/);
  await page.waitForFunction(() => (document.body.textContent ?? '').trim().length > 20);
  assert.equal(new URL(page.url()).search, '', 'Launch credential must be stripped after cookie exchange.');
  assert.equal(errors.length, 0);
  assert.ok(await page.getByRole('button').count() > 0);
  assert.equal((await page.locator('body').innerText()).includes('员工账号'), false);
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
  if (child.exitCode === null && child.signalCode === null) {
    const closed = once(child, 'close'); process.kill(-child.pid, 'SIGTERM');
    const force = setTimeout(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch {} }, 7000);
    await closed; clearTimeout(force);
  }
  rmSync(state, { recursive: true, force: true }); mkdirSync(resolve(root, 'outputs'), { recursive: true });
  writeFileSync(resolve(root, 'outputs/oa-home-probe.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}
