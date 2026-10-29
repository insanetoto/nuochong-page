import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { RuntimeAdapter } from './adapter.mjs';

const root = fileURLToPath(new URL('.', import.meta.url));
mkdirSync(resolve(root, 'outputs'), { recursive: true });
const results = [];
for (const mode of ['rate_limit', 'stall']) {
  let attempts = 0;
  const server = createServer((req, res) => {
    attempts++;
    req.resume();
    if (mode === 'stall') return;
    res.writeHead(429, { 'content-type': 'application/json', 'retry-after': '0' });
    res.end(JSON.stringify({ error: { message: 'synthetic rate limit', type: 'rate_limit_error' } }));
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const patch = resolve(root, 'outputs', `fault-${mode}.patch.yml`);
  writeFileSync(patch, ['tool-fs', 'tool-working-directory', 'persistent-bash', 'persistent-pwsh']
    .map((id) => `- id: ${id}\n  disabled: true`).join('\n')
    + `\n- id: llm-deepseek\n  config:\n    apiKeyEnv: DEEPSEEK_API_KEY\n    baseURL: http://127.0.0.1:${server.address().port}\n    retryPolicy:\n      mode: normal\n      maxRetries: 2\n      backoff:\n        initialDelayMs: 20\n        maxDelayMs: 20\n        jitterRatio: 0\n`);
  const adapter = new RuntimeAdapter({ profile: 'sdk-minimal', patches: [patch],
    dshHome: resolve(root, '.dsh-home', `fault-${crypto.randomUUID()}`), cwd: resolve(root, 'outputs'), processCwd: root,
    env: { PATH: process.env.PATH, LANG: 'en_US.UTF-8', TERM: 'dumb', DEEPSEEK_API_KEY: 'synthetic-local-test-key' },
    initializeTimeoutMs: 20_000, requestTimeoutMs: 10_000,
    shutdownTimeoutMs: 1000, disposeEofGraceMs: 1000, disposeGraceMs: 1000,
  });
  const start = performance.now();
  try {
    const outcome = await adapter.run('Reply OK', { timeoutMs: mode === 'stall' ? 1500 : 10_000 });
    if (mode === 'rate_limit') { assert.equal(outcome.status, 'failed'); assert.equal(attempts, 3); }
    else { assert.equal(outcome.status, 'timed_out'); assert.ok(attempts > 0); }
    results.push({ mode, attempts, status: outcome.status, errorCode: outcome.errorCode ?? null,
      totalMs: performance.now() - start, passed: true });
  } finally {
    await adapter.close();
    server.closeAllConnections();
    await new Promise((done) => server.close(done));
  }
}
const report = { time: new Date().toISOString(), node: process.version,
  platform: `${process.platform}-${process.arch}`,
  scope: 'Real SDK subprocess and provider adapter against synthetic loopback HTTP faults; no real model or API credential', results };
writeFileSync(resolve(root, 'outputs/provider-faults.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
