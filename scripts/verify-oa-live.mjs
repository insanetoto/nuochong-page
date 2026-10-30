import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
let browser;
try {
  const url = new URL(process.env.OA_PRIVATE_LAUNCH_URL);
  assert.equal(url.origin, 'https://www.nuochong.net');
  assert.equal(url.pathname, '/oa-test/');
  assert.ok(url.searchParams.get('token'));
  const anonymous = await fetch(new URL(url.pathname, url.origin), { signal: AbortSignal.timeout(15000) });
  assert.equal(anonymous.status, 401);
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  let frames = 0; const errors = [];
  page.on('websocket', (socket) => socket.on('framereceived', () => frames++));
  page.on('pageerror', (error) => errors.push(error.name));
  await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => document.querySelector('#root')?.children.length > 0, { timeout: 30000 });
  assert.equal(await page.title(), 'DeepSeek Harness');
  assert.equal(new URL(page.url()).search, '');
  assert.equal(new URL(page.url()).pathname, '/oa-test/');
  for (let i = 0; i < 200 && !frames; i++) await new Promise((done) => setTimeout(done, 100));
  assert.ok(frames > 0, 'Authenticated WebSocket must receive native frames.');
  assert.equal(errors.length, 0);
  assert.ok((await page.context().cookies()).some((cookie) => cookie.secure && cookie.httpOnly && cookie.path === '/oa-test/'));
  const entry = await fetch('https://nuochong-company-homepage-test.76gzwtk9sb.workers.dev/oa', { redirect: 'manual', signal: AbortSignal.timeout(15000) });
  assert.equal(entry.status, 307);
  assert.equal(entry.headers.get('location'), 'https://www.nuochong.net/oa-test/');
  console.log(JSON.stringify({ passed: true, scope: 'Live HTTPS native UI and authenticated WebSocket', anonymousStatus: 401, tokenRemoved: true, secureScopedCookie: true, testEntryRedirect: 307, pageErrors: 0, modelCalls: 0 }));
} catch {
  console.error('Live native UI verification failed; private credentials and browser diagnostics are omitted.'); process.exitCode = 1;
} finally { await browser?.close(); }
