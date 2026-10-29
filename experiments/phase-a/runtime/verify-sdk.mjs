import { DeepSeekHarness } from '@deepseek-ai/dsh-sdk-client';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('.', import.meta.url));
const env = { PATH: process.env.PATH, LANG: 'en_US.UTF-8', TERM: 'dumb' };
const results = [];
for (const profile of ['sdk-minimal', 'sdk']) {
  const harness = new DeepSeekHarness({
    profile, dshHome: resolve(root, '.dsh-home', profile), processCwd: root,
    cwd: root, env, initializeTimeoutMs: 20_000, requestTimeoutMs: 20_000,
    shutdownTimeoutMs: 5000,
  });
  let result = { profile, initialized: false, closed: false, error: null };
  try {
    await harness.start();
    result.initialized = true;
  } catch (error) {
    result.error = String(error).replaceAll(root, '<spike>/').slice(-3000);
  } finally {
    try { await harness.close(); result.closed = true; }
    catch (error) { result.error = String(error).replaceAll(root, '<spike>/').slice(-3000); }
  }
  results.push(result);
}
const report = { time: new Date().toISOString(), node: process.version,
  platform: `${process.platform}-${process.arch}`, results,
  scope: 'Real subprocess initialize/close only; no prompt, model request or tool execution',
  defaultRoute: { provider: 'deepseek-official', model: 'deepseek-v4-flash' } };
mkdirSync(resolve(root, 'outputs'), { recursive: true });
writeFileSync(resolve(root, 'outputs/sdk-probe.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (results.some((r) => !r.initialized || !r.closed)) process.exitCode = 1;
