#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { CLIENT_VERSION, CONTRACT_VERSION, commands, manifest } from '../src/registry.mjs';
import { CliError, invalid, configuration, plan, request, jsonResult, follow } from '../src/client.mjs';

let commandId = 'help'; let controller; let timer;
const interrupt = () => controller?.abort(new CliError('INTERRUPTED', 130, 'Stopped the CLI operation. A remote run was not automatically cancelled.'));
const outputClosed = () => {
  if (!controller?.signal.aborted) controller?.abort(new CliError('OUTPUT_CLOSED', 141, 'The output consumer closed the stream.'));
  process.exitCode ??= 141;
};
process.on('SIGINT', interrupt); process.stdout.on('error', outputClosed);
process.stderr.on('error', () => { process.exitCode ??= 141; });
async function write(value) {
  controller.signal.throwIfAborted();
  await new Promise((resolve, reject) => {
    const cleanup = () => controller.signal.removeEventListener('abort', abort);
    const abort = () => { cleanup(); process.stdout.destroy(); reject(controller.signal.reason); };
    controller.signal.addEventListener('abort', abort, { once: true });
    process.stdout.write(JSON.stringify({ schemaVersion: CONTRACT_VERSION, command: commandId, ...value }) + '\n', (error) => {
      cleanup(); error ? reject(new CliError('OUTPUT_CLOSED', 141, 'The output consumer closed the stream.')) : resolve();
    });
  });
}
async function inputValue(raw) {
  if (raw !== '-') { try { return JSON.parse(raw); } catch { throw invalid(); } }
  let text = ''; let bytes = 0;
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const abort = () => process.stdin.destroy(controller.signal.reason);
  controller.signal.addEventListener('abort', abort, { once: true });
  try {
    for await (const chunk of process.stdin) {
      bytes += chunk.byteLength; if (bytes > 512 * 1024) throw invalid(); text += decoder.decode(chunk, { stream: true });
    }
    text += decoder.decode();
    try { return JSON.parse(text); } catch { throw invalid(); }
  } catch (error) { if (controller.signal.aborted) throw controller.signal.reason; throw invalid(); }
  finally { controller.signal.removeEventListener('abort', abort); }
}
try {
  let parsed;
  try { parsed = parseArgs({ allowPositionals: true, strict: true, tokens: true, options: {
    json: { type: 'boolean' }, input: { type: 'string' }, 'run-id': { type: 'string' }, after: { type: 'string' },
    'api-url': { type: 'string' }, 'timeout-ms': { type: 'string' }, 'dry-run': { type: 'boolean' },
    help: { type: 'boolean', short: 'h' }, version: { type: 'boolean', short: 'v' },
  } }); } catch { throw invalid(); }
  const supplied = parsed.tokens.filter((item) => item.kind === 'option').map((item) => item.name);
  if (new Set(supplied).size !== supplied.length) throw invalid();
  const { values: options, positionals: args } = parsed;
  const timeout = options['timeout-ms'] ?? '30000';
  if (!/^\d+$/.test(timeout) || +timeout < 1 || +timeout > 180000) throw invalid();
  controller = new AbortController();
  timer = setTimeout(() => controller.abort(new CliError('TIMEOUT', 11, 'The client deadline elapsed. No automatic retry or remote cancellation was performed.')), +timeout);
  if (options.version || args[0] === 'version') {
    commandId = 'version'; await write({ ok: true, data: { clientVersion: CLIENT_VERSION, contractVersion: CONTRACT_VERSION } });
  } else if (options.help || args.length === 0 || args[0] === 'help') {
    if (options.json) { await write({ ok: true, data: manifest() }); }
    else process.stdout.write(`nuochong ${CLIENT_VERSION}\n\nCommands:\n  capabilities --json\n  schema <command-id> --json\n  runs create --input - [--dry-run]\n  runs get|cancel|events --run-id <id> [--after <event-id>]\n\nAll network commands use NUOCHONG_API_URL and NUOCHONG_ACCESS_TOKEN.\nUse --input - for JSON stdin, --timeout-ms 1..180000 for a bounded operation.\nTask clients require a compatible Harness API; future domains are planned.\n`);
  } else if (args[0] === 'capabilities' && args.length === 1) {
    commandId = 'capabilities'; await write({ ok: true, data: manifest() });
  } else if (args[0] === 'schema' && args.length === 2) {
    commandId = 'schema'; const command = commands.find((item) => item.id === args[1]);
    if (!command) throw invalid(); await write({ ok: true, data: command });
  } else {
    const command = commands.find((item) => item.argv.join(' ') === args.join(' '));
    if (!command) {
      if (manifest().plannedDomains.includes(args[0])) throw new CliError('FEATURE_NOT_AVAILABLE', 14, 'This domain is planned and has no implemented CLI command yet.');
      throw invalid();
    }
    commandId = command.id;
    if (command.id === 'runs.create' && (options['run-id'] !== undefined || options.after !== undefined)) throw invalid();
    if (command.id !== 'runs.events' && options.after !== undefined) throw invalid();
    if (options.input !== undefined && (options['run-id'] !== undefined || options.after !== undefined)) throw invalid();
    const input = options.input !== undefined ? await inputValue(options.input)
      : { ...(options['run-id'] !== undefined && { runId: options['run-id'] }), ...(options.after !== undefined && { after: options.after }) };
    const operation = plan(command, input);
    if (options['dry-run']) await write({ ok: true, data: { ...operation, executed: false } });
    else {
      const config = configuration(options, process.env);
      const { response, requestId } = await request(command, input, config, controller.signal);
      if (command.streaming) {
        const summary = await follow(command, input, response, (record) => write(record));
        await write({ kind: 'end', ok: true, data: summary, ...(requestId && { requestId }) });
      } else {
        const data = await jsonResult(command, response);
        if (input.runId && data.runId !== input.runId) throw new CliError('PROTOCOL_ERROR', 12, 'The response belongs to a different run.');
        await write({ ok: true, data, ...(requestId && { requestId }) });
      }
    }
  }
} catch (error) {
  const failure = controller?.signal.aborted ? controller.signal.reason
    : error instanceof CliError ? error : new CliError('INTERNAL_ERROR', 70, 'The client could not complete this operation.');
  const details = { ...(error?.details?.lastEventId !== undefined && { lastEventId: error.details.lastEventId }), ...failure.details };
  process.stderr.write(JSON.stringify({ schemaVersion: CONTRACT_VERSION, command: commandId, ok: false,
    error: { code: failure.code, message: failure.message, ...details } }) + '\n');
  process.exitCode = failure.exitCode;
} finally {
  clearTimeout(timer); process.off('SIGINT', interrupt);
}
