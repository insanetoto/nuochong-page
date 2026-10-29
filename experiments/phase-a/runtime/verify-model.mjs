import { loadEnvFile } from 'node:process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { RuntimeAdapter } from './adapter.mjs';
import { writeReadonlyPatch } from './profile-patch.mjs';

const root = fileURLToPath(new URL('.', import.meta.url));
const localEnv = resolve(root, '.env.local');
if (existsSync(localEnv)) loadEnvFile(localEnv);
if (!process.env.DEEPSEEK_API_KEY) throw new Error('DEEPSEEK_API_KEY is not configured');
mkdirSync(resolve(root, 'outputs'), { recursive: true });
const workspace = resolve(root, 'outputs', 'model-workspace');
mkdirSync(workspace, { recursive: true });
// CLI overlay syntax is public. Disable all profile-provided filesystem/shell
// and directory tools; install only our synthetic readonly fixture tool.
const useBridge = process.argv.includes('--bridge');
const patch = writeReadonlyPatch(root, useBridge);
function createAdapter(id) { return new RuntimeAdapter({
  profile: 'sdk-minimal', patches: [patch],
  dshHome: resolve(root, '.dsh-home', `real-model-${id}`), cwd: workspace, processCwd: root,
  env: { PATH: process.env.PATH, LANG: 'en_US.UTF-8', TERM: 'dumb',
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
    NUOCHONG_TOOL_AUDIT: resolve(root, 'outputs', `tool-audit-${id}.jsonl`) },
  initializeTimeoutMs: 20_000, requestTimeoutMs: 180_000,
  shutdownTimeoutMs: 1000, disposeEofGraceMs: 1000, disposeGraceMs: 1000,
}); }

async function runCase(id, mode = 'success') {
const adapter = createAdapter(id);
const started = performance.now();
const notificationMethods = new Set();
const eventTypes = new Set();
let ttftMs = null;
let chunks = 0;
let cancelRequestedMs = null;
let cancelAckMs = null;
let cancelClosedMs = null;
let cancelTask;
let disconnectTask;
let fixtureCalls = 0;
let postCancelCalls = 0;
const usage = [];
const auditPath = resolve(root, 'outputs', `tool-audit-${id}.jsonl`);
const auditCount = () => existsSync(auditPath) ? readFileSync(auditPath, 'utf8').trim().split('\n').filter(Boolean).length : 0;
let auditAtCancel = null;
function requestCancel() {
  if (cancelTask) return;
  auditAtCancel = auditCount();
  cancelRequestedMs = performance.now();
  cancelTask = adapter.cancel();
  cancelAckMs = performance.now() - cancelRequestedMs;
  cancelTask.then(() => { cancelClosedMs = performance.now() - cancelRequestedMs; }, () => {});
}
const outcome = await adapter.run(mode === 'cancel' || mode === 'disconnect'
  ? 'Write the integers from 1 to 10000, one per line. Do not use tools.'
  : mode === 'cancel-tools' ? 'Call read_fixture 20 times sequentially, one tool call per step. Do not stop after the first call.'
  : 'Call read_fixture exactly once and reply only with the code it returns.', {
  timeoutMs: mode === 'timeout' ? 500 : 180_000,
  onNotification: (notification) => {
    notificationMethods.add(notification.method);
    if (notification.method === 'session.event') eventTypes.add(notification.params.event?.type);
    const event = notification.params.event;
    if (event?.type === 'tool/call') {
      if (event.data.name === 'read_fixture') fixtureCalls++;
      if (cancelRequestedMs !== null) postCancelCalls++;
    }
    if (event?.type === 'assistant/message' && event.data.usage) usage.push(event.data.usage);
    if (event?.type === 'tool/result' && mode === 'cancel-tools') requestCancel();
    const frame = notification.params.frame;
    if (notification.method === 'nuochong.assistant.stream' && frame?.type === 'chunk') {
      chunks++;
      if (frame.chunk?.type === 'text-delta' && ttftMs === null) ttftMs = performance.now() - started;
      if (frame.chunk?.type === 'text-delta' && mode === 'cancel' && !cancelTask) {
        requestCancel();
      }
      if (frame.chunk?.type === 'text-delta' && mode === 'disconnect' && !disconnectTask) {
        disconnectTask = adapter.harness.client.close();
        disconnectTask.catch(() => {});
      }
    }
  },
});
if (cancelTask) await cancelTask;
if (disconnectTask) await disconnectTask;
const auditedCalls = auditCount();
if (auditAtCancel !== null) postCancelCalls = auditedCalls - auditAtCancel;
// Never print SDK errors or raw notifications: they can carry request metadata.
const report = { id, mode, time: new Date().toISOString(), node: process.version,
  platform: `${process.platform}-${process.arch}`,
  route: { provider: 'deepseek-official', model: 'deepseek-v4-flash' },
  status: outcome.status, totalMs: performance.now() - started,
  responseMatches: outcome.result?.finalResponse.trim() === 'NUOCHONG_FIXTURE_42',
  notificationMethods: [...notificationMethods], eventTypes: [...eventTypes],
  errorCode: outcome.errorCode ?? null,
  bridge: useBridge, chunks, ttftMs,
  fixtureCalls, postCancelCalls, cancelAckMs, cancelClosedMs, usage,
  auditedCalls, auditAtCancel,
  ttftReason: useBridge ? 'Measured from public agent hook via deployment-owned bridge'
    : 'SDK protocol exposes durable session events, not transient assistant stream frames',
  cost: { amount: null, status: 'unknown' } };
report.passed = mode === 'success'
  ? report.status === 'succeeded' && report.responseMatches && fixtureCalls >= 1 && auditedCalls === fixtureCalls
    && (!useBridge || (ttftMs !== null && ttftMs <= 15_000)) && report.totalMs <= 120_000
  : mode === 'cancel' || mode === 'cancel-tools'
    ? report.status === 'cancelled' && cancelAckMs <= 1000 && cancelClosedMs <= 5000 && postCancelCalls === 0
    : mode === 'disconnect' ? report.status === 'failed' && report.errorCode === 'TransportClosedError'
      : report.status === 'timed_out';
if (process.argv.includes('--resume') && outcome.result?.sessionId) {
  const restored = createAdapter(id);
  try {
    const session = await restored.harness.resumeSession(outcome.result.sessionId);
    report.resume = { restored: true, sameWorkingDirectory: await session.getWorkingDirectory() === workspace,
      scope: 'Same persisted JSONL home, new process, no new prompt or model request' };
    report.passed &&= report.resume.sameWorkingDirectory;
  } finally { await restored.close(); }
}
return report;
}

const results = [];
const prefix = crypto.randomUUID();
if (process.argv.includes('--cancel-tools')) {
  results.push(await runCase(`${prefix}-cancel-tools`, 'cancel-tools'));
} else if (process.argv.includes('--disconnect')) {
  results.push(await runCase(`${prefix}-disconnect`, 'disconnect'));
} else if (process.argv.includes('--matrix')) {
  if (!useBridge) throw new Error('matrix requires --bridge for live TTFT/cancellation measurement');
  for (let batch = 0; batch < 2; batch++) {
    results.push(...await Promise.all(Array.from({ length: 5 }, (_, i) => runCase(`${prefix}-${batch}-${i}`))));
  }
  results.push(await runCase(`${prefix}-cancel`, 'cancel'));
  results.push(await runCase(`${prefix}-timeout`, 'timeout'));
} else { results.push(await runCase(`${prefix}-smoke`)); }
const p95 = (values) => values.sort((a, b) => a - b)[Math.ceil(values.length * .95) - 1];
const successSamples = results.filter((r) => r.mode === 'success');
// Failures stay in the sample as +Infinity; serialized as explicit strings.
const measure = (field) => {
  if (!successSamples.length) return null;
  const result = p95(successSamples.map((r) => r.passed && r[field] !== null ? r[field] : Infinity));
  return Number.isFinite(result) ? result : 'Infinity (failed/missing sample)';
};
const report = { time: new Date().toISOString(), concurrency: process.argv.includes('--matrix') ? 5 : 1,
  sampleCount: successSamples.length, ttftP95Ms: useBridge ? measure('ttftMs') : null,
  totalP95Ms: measure('totalMs'), costStatus: 'unknown; usage recorded, no verified billing amount', results };
const reportName = process.argv.includes('--matrix') ? 'model-matrix' : process.argv.includes('--resume') ? 'model-resume'
  : process.argv.includes('--cancel-tools') ? 'model-cancel-tools' : process.argv.includes('--disconnect') ? 'model-disconnect' : 'model-probe';
writeFileSync(resolve(root, `outputs/${reportName}.json`), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (results.some((r) => !r.passed)) process.exitCode = 1;
