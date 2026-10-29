import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { mkdirSync, writeFileSync } from 'node:fs';
import { Context } from '@deepseek-ai/cordis';
import { SystemPrompt } from '@deepseek-ai/dsh-system-prompt';
import { ToolRuntime, defineTool } from '@deepseek-ai/dsh-tools';
import { RuntimeAdapter, EventJournal } from './adapter.mjs';

const results = [];
async function check(name, scope, body) {
  const start = performance.now();
  try { await body(); results.push({ name, scope, passed: true, ms: performance.now() - start }); }
  catch (error) { results.push({ name, scope, passed: false, error: error.message }); }
}
const ctx = new Context();
await ctx.plugin(SystemPrompt);
await ctx.plugin(ToolRuntime);
let calls = 0;
let active = 0;
let started;
let observedAbort = false;
const fiber = await ctx.plugin({ name: 'readonly-fixture', inject: ['tools'], apply(ctx) {
  return ctx.tools.register(defineTool({
    name: 'read_fixture', description: 'Read a synthetic fixture; no filesystem or network access',
    parameters: { wait: { type: 'boolean' } },
    output: { schema: { type: 'string' }, render: (_, value) => [{ type: 'text', text: value }] },
    async execute(args, exec) {
      calls++; active++; started?.();
      try {
        if (args.wait) await delay(5000, undefined, { signal: exec.signal });
        return 'synthetic document';
      } finally { active--; observedAbort = exec.signal.aborted; }
    },
  }));
} });
const invoke = (signal, wait = false) => ctx.tools.execute({
  callId: crypto.randomUUID(), name: 'read_fixture', arguments: { wait }, signal,
});
try {
  await check('registered readonly tool returns validated canonical output', 'real ToolRuntime', async () => {
    const result = await invoke(new AbortController().signal);
    assert.equal(result.isError, false); assert.equal(result.value, 'synthetic document');
  });
  await check('pre-cancelled call never enters tool body', 'real ToolRuntime', async () => {
    const before = calls;
    const result = await invoke(AbortSignal.abort());
    assert.equal(result.isError, true); assert.equal(calls, before);
  });
  await check('running cancellation joins cooperative tool; subsequent calls blocked', 'real ToolRuntime', async () => {
    const controller = new AbortController();
    const entered = new Promise((resolve) => { started = resolve; });
    const running = invoke(controller.signal, true);
    await entered; started = undefined; controller.abort();
    assert.equal((await running).isError, true);
    assert.equal(active, 0); assert.equal(observedAbort, true);
    const before = calls;
    assert.equal((await invoke(controller.signal)).isError, true); assert.equal(calls, before);
  });
  await check('deadline cooperatively stops tool and joins cleanup', 'real ToolRuntime, adapter signal deadline', async () => {
    const result = await invoke(AbortSignal.timeout(25), true);
    assert.equal(result.isError, true); assert.equal(active, 0);
  });
  await check('plugin unload removes registry entry and rejects future calls', 'real Cordis lifecycle', async () => {
    await fiber.dispose(); assert.equal(ctx.tools.get('read_fixture'), undefined);
    const before = calls;
    assert.equal((await invoke(new AbortController().signal)).isError, true); assert.equal(calls, before);
  });
} finally { await ctx.fiber.dispose(); }

// Explicit transport double: no LLM, HTTP/SSE proxy, or real transport-loss claim.
function fakeFactory(mode, state) {
  return () => {
    let rejectRun;
    return {
      async run(_, { onNotification }) {
        state.started = true;
        onNotification({ method: 'fixture.delta', params: { text: 'synthetic' } });
        if (mode === 'success' || mode === 'model-error') return { sessionId: 'fixture', finalResponse: 'synthetic',
          notifications: [{ method: 'session.event', params: { sessionId: 'fixture',
            event: { type: 'turn/end', data: { reason: { kind: mode === 'success' ? 'completed' : 'error' } } } } }] };
        if (mode === 'disconnect') throw new Error('synthetic transport loss');
        return new Promise((_, reject) => { rejectRun = reject; });
      },
      async close() {
        state.closes = (state.closes ?? 0) + 1;
        if (state.failClose) throw new Error('synthetic teardown failure');
        rejectRun?.(new Error('closed')); state.closed = true;
      },
    };
  };
}
await check('success forwards stream and closes once; rejects reuse', 'synthetic transport', async () => {
  const state = {}; const events = [];
  const adapter = new RuntimeAdapter({}, fakeFactory('success', state));
  assert.equal((await adapter.run('fixture', { onNotification: (e) => events.push(e) })).status, 'succeeded');
  assert.equal(events.length, 1); assert.equal(state.closes, 1);
  await assert.rejects(adapter.run('again'), /single-use/);
});
await check('cancel closes owned process before terminal result', 'synthetic transport', async () => {
  const state = {}; const adapter = new RuntimeAdapter({}, fakeFactory('wait', state));
  const running = adapter.run('fixture'); await adapter.cancel();
  assert.equal((await running).status, 'cancelled'); assert.equal(state.closed, true);
  assert.equal(state.closes, 1);
});
await check('request deadline closes and joins owned run', 'synthetic transport', async () => {
  const state = {}; const adapter = new RuntimeAdapter({}, fakeFactory('wait', state));
  assert.equal((await adapter.run('fixture', { timeoutMs: 25 })).status, 'timed_out');
  assert.equal(state.closed, true);
});
await check('transport loss is failed rather than successful', 'synthetic transport', async () => {
  const state = {}; const adapter = new RuntimeAdapter({}, fakeFactory('disconnect', state));
  assert.equal((await adapter.run('fixture')).status, 'failed'); assert.equal(state.closed, true);
});
await check('SDK idle with durable model error is failed', 'synthetic transport', async () => {
  const adapter = new RuntimeAdapter({}, fakeFactory('model-error', {}));
  assert.equal((await adapter.run('fixture')).status, 'failed');
});
await check('cleanup failure cannot become successful outcome', 'synthetic transport', async () => {
  const state = { failClose: true };
  const adapter = new RuntimeAdapter({}, fakeFactory('success', state));
  await assert.rejects(adapter.run('fixture'), /teardown failure/);
});
await check('deadline teardown failure rejects pending run rather than hanging', 'synthetic transport', async () => {
  const state = { failClose: true };
  const adapter = new RuntimeAdapter({}, fakeFactory('wait', state));
  await assert.rejects(adapter.run('fixture', { timeoutMs: 25 }), /teardown failure/);
});
await check('lifecycle replay deduplicates; rejects foreign cursor and token persistence', 'in-memory contract fixture', async () => {
  const journal = new EventJournal('run-fixture');
  journal.append('created', 'run.created'); journal.append('started', 'run.started');
  const delivered = journal.replay();
  journal.append('started', 'run.started'); journal.append('done', 'run.completed');
  assert.deepEqual(journal.replay(delivered.at(-1).eventId).map((e) => e.sequence), [3]);
  assert.throws(() => journal.replay('other-run:2'), /unknown cursor/);
  assert.throws(() => journal.append('delta', 'run.delta'), /not a durable/);
  assert.equal(journal.replay().length, 3);
});

const report = { time: new Date().toISOString(), node: process.version,
  platform: `${process.platform}-${process.arch}`, results,
  realModel: { status: 'not_run_in_this_suite', reason: 'This no-key suite makes no model request; see model-probe separately' },
  limitations: ['No real HTTP/SSE reconnect', 'No persistence or host crash recovery',
    'No real model latency, rate limiting, usage, billing or cancellation measurements'] };
mkdirSync(new URL('./outputs/', import.meta.url), { recursive: true });
writeFileSync(new URL('./outputs/adapter-probe.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (results.some((result) => !result.passed)) process.exitCode = 1;
