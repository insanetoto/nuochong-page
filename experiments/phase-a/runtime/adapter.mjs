import { DeepSeekHarness } from '@deepseek-ai/dsh-sdk-client';

// One owned subprocess per run: cancellation may close this entire process.
// A-07 owns persistent business state; this class is deliberately execution-only.
export class RuntimeAdapter {
  constructor(options, factory = (config) => new DeepSeekHarness(config)) {
    this.harness = factory(options);
    this.controller = new AbortController();
    this.started = false;
    this.closing = null;
  }

  close() {
    return this.closing ??= Promise.resolve().then(() => this.harness.close()).catch((error) => {
      this.teardownReject?.(error);
      throw error;
    });
  }

  cancel() {
    this.controller.abort(new Error('run cancelled'));
    // Completion means subprocess teardown settled, not merely abort acknowledged.
    return this.close();
  }

  async run(prompt, { timeoutMs = 180_000, onNotification = () => {} } = {}) {
    if (this.started) throw new Error('adapter is single-use');
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) throw new Error('invalid timeout');
    this.started = true;
    this.controller.signal.throwIfAborted();
    let timedOut = false;
    let closeError;
    const teardownFailure = new Promise((_, reject) => { this.teardownReject = reject; });
    const timer = setTimeout(() => {
      timedOut = true;
      this.controller.abort(new Error('run timed out'));
      this.close().catch((error) => { closeError = error; });
    }, timeoutMs);
    let outcome;
    try {
      const result = await Promise.race([this.harness.run(prompt, {
        onNotification: (event) => {
          if (!this.controller.signal.aborted) onNotification(event);
        },
      }), teardownFailure]);
      const rootTerminal = result.notifications?.filter((n) => n.method === 'session.event'
        && n.params.sessionId === result.sessionId && n.params.event?.type === 'turn/end').at(-1)?.params.event.data.reason;
      outcome = this.controller.signal.aborted
        ? { status: timedOut ? 'timed_out' : 'cancelled' }
        : rootTerminal?.kind === 'completed' ? { status: 'succeeded', result }
          : { status: 'failed', errorCode: rootTerminal?.kind === 'error' ? 'ModelRequestFailed' : 'UnsuccessfulTurn' };
    } catch (error) {
      outcome = { status: timedOut ? 'timed_out' : this.controller.signal.aborted ? 'cancelled' : 'failed',
        errorCode: error.constructor.name };
    } finally {
      clearTimeout(timer);
      // Never report terminal success/cancel until owned process cleanup completes.
      await this.close();
    }
    if (closeError) throw closeError;
    return outcome;
  }
}

// In-memory contract fixture ONLY. Recreate from DB in A-07/B-04, not from SDK tokens.
export class EventJournal {
  constructor(runId) { this.runId = runId; this.events = []; this.keys = new Set(); }
  append(sourceKey, type) {
    if (!['run.created', 'run.started', 'run.completed', 'run.failed', 'run.cancelled'].includes(type)) {
      throw new Error('not a durable lifecycle event');
    }
    if (this.keys.has(sourceKey)) return;
    this.keys.add(sourceKey);
    const sequence = this.events.length + 1;
    this.events.push(Object.freeze({ eventId: `${this.runId}:${sequence}`,
      runId: this.runId, sequence, type, time: new Date().toISOString() }));
  }
  replay(lastEventId) {
    if (!lastEventId) return this.events.slice();
    const cursor = this.events.findIndex((event) => event.eventId === lastEventId);
    if (cursor < 0) throw new Error('unknown cursor');
    return this.events.slice(cursor + 1);
  }
}
