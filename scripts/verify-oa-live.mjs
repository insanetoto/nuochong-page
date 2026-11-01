import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
let browser; let page; let phase = 'startup';
try {
  const url = new URL(process.env.OA_PRIVATE_LAUNCH_URL);
  assert.equal(url.origin, 'https://www.nuochong.net');
  assert.equal(url.pathname, '/oa-test/');
  assert.ok(url.searchParams.get('token'));
  phase = 'anonymous-auth';
  const anonymous = await fetch(new URL(url.pathname, url.origin), { signal: AbortSignal.timeout(15000) });
  assert.equal(anonymous.status, 401);
  phase = 'browser-launch';
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage();
  let frames = 0; const errors = [];
  page.on('websocket', (socket) => socket.on('framereceived', () => frames++));
  page.on('pageerror', (error) => errors.push(error.name));
  phase = 'native-load';
  await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => document.querySelector('#root')?.children.length > 0, { timeout: 30000 });
  assert.equal(await page.title(), 'DeepSeek Harness');
  assert.equal(new URL(page.url()).search, '');
  assert.equal(new URL(page.url()).pathname, '/oa-test/');
  for (let i = 0; i < 200 && !frames; i++) await new Promise((done) => setTimeout(done, 100));
  phase = 'native-websocket';
  assert.ok(frames > 0, 'Authenticated WebSocket must receive native frames.');
  assert.equal(errors.length, 0);
  assert.ok((await page.context().cookies()).some((cookie) => cookie.secure && cookie.httpOnly && cookie.path === '/oa-test/'));
  if (process.env.OA_SETUP_DEMO === 'true') {
    phase = 'managed-onboarding';
    await page.waitForTimeout(2000);
    assert.equal(await page.getByRole('dialog').count(), 0);
    assert.equal(await page.getByRole('textbox', { name: /API Key/i }).count(), 0);
    phase = 'model-composer';
    const composer = page.locator('[data-composer-input][contenteditable="true"]:visible').first();
    await composer.waitFor({ state: 'visible', timeout: 60000 });
    phase = 'composer-fill';
    await composer.fill('请不要使用任何工具，只回复 DEMO_MODEL_READY');
    phase = 'composer-submit';
    await page.getByRole('button', { name: /^发送消息$|^Send message$/i }).click();
    phase = 'model-response';
    await page.locator('[data-conversation-region="chat"]').getByText(/^DEMO_MODEL_READY[.!。]?$/).waitFor({ state: 'visible', timeout: 120000 });
  }
  phase = 'entry-form';
  if (process.env.OA_ENTRY_ORIGIN) {
    const login = await browser.newPage();
    await login.goto(new URL('/oa-login.html', process.env.OA_ENTRY_ORIGIN).href, { waitUntil: 'domcontentloaded', timeout: 60000 });
    assert.ok(await login.getByLabel('账号').isVisible());
    assert.ok(await login.getByLabel('密码').isVisible());
    assert.ok(await login.getByRole('button', { name: '登录 OA' }).isVisible());
    if (process.env.OA_SETUP_ACCOUNT === 'true') {
      assert.ok(process.env.OA_TEST_LOGIN_USER && process.env.OA_TEST_LOGIN_PASSWORD);
      await login.getByLabel('账号').fill(process.env.OA_TEST_LOGIN_USER);
      await login.getByLabel('密码').fill(process.env.OA_TEST_LOGIN_PASSWORD);
      await login.getByRole('button', { name: '登录 OA' }).click();
      await login.waitForFunction(() => document.querySelector('#root')?.children.length > 0, { timeout: 30000 });
      assert.equal(await login.title(), 'DeepSeek Harness');
      assert.ok((await login.context().cookies()).some(cookie => cookie.secure && cookie.httpOnly && cookie.path === '/oa-test/'));
    }
    await login.close();
  }
  phase = 'entry-redirect';
  const entry = await fetch('https://nuochong-company-homepage-test.76gzwtk9sb.workers.dev/oa', { redirect: 'manual', signal: AbortSignal.timeout(15000) });
  assert.equal(entry.status, 307);
  assert.equal(entry.headers.get('location'), 'https://www.nuochong.net/oa-test/');
  console.log(JSON.stringify({ passed: true, scope: 'Live HTTPS native UI and authenticated WebSocket', anonymousStatus: 401, tokenRemoved: true, secureScopedCookie: true, testEntryRedirect: 307, entryForm: Boolean(process.env.OA_ENTRY_ORIGIN), managedDemoNoOnboarding: process.env.OA_SETUP_DEMO === 'true', accountLogin: process.env.OA_SETUP_ACCOUNT === 'true', pageErrors: 0, modelSmokePrompts: process.env.OA_SETUP_DEMO === 'true' ? 1 : 0, modelCalls: process.env.OA_SETUP_DEMO === 'true' ? 'not-measured' : 0 }));
} catch (error) {
  if (page && process.env.OA_SETUP_DEMO === 'true') {
    try { console.error(JSON.stringify({ diagnostic: 'managed-demo', phase, errorType: error.name,
      composerCount: await page.locator('[data-composer-input]').count(),
      editableComposerCount: await page.locator('[data-composer-input][contenteditable="true"]').count(),
      visibleDialogCount: await page.getByRole('dialog').count(),
      composerEmpty: (await page.locator('[data-composer-input]').first().innerText()).trim().length === 0 })); } catch { /* No private diagnostics. */ }
  }
  console.error('Live native UI verification failed at ' + phase + '; private credentials and browser diagnostics are omitted.'); process.exitCode = 1;
} finally { await browser?.close(); }
