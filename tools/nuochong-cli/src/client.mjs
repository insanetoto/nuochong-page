import { valid } from './registry.mjs';
import { createHash } from 'node:crypto';

export class CliError extends Error {
  constructor(code, exitCode, message, details = {}) { super(message); Object.assign(this, { code, exitCode, details }); }
}
export const invalid = () => new CliError('INVALID_INPUT', 2, 'Arguments or input do not match the command schema.');
const protocol = () => new CliError('PROTOCOL_ERROR', 12, 'The server response does not match the versioned client contract.');

export function configuration(options, env) {
  let url;
  try { url = new URL(options['api-url'] ?? env.NUOCHONG_API_URL); } catch {
    throw new CliError('CONFIG_REQUIRED', 3, 'Set NUOCHONG_API_URL to the Harness API origin.');
  }
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/' || !['https:', 'http:'].includes(url.protocol)) throw invalid();
  if (url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    throw new CliError('CONFIG_INVALID', 3, 'Remote API origins require HTTPS; HTTP is supported for loopback development.');
  }
  const token = env.NUOCHONG_ACCESS_TOKEN;
  if (!token || /[\r\n]/.test(token)) throw new CliError('AUTH_REQUIRED', 4, 'Set NUOCHONG_ACCESS_TOKEN to a user or scoped service credential.');
  return { origin: url.origin, token };
}
function httpError(status, requestId) {
  const mapping = { 401: ['UNAUTHORIZED', 4], 403: ['FORBIDDEN', 5], 404: ['NOT_FOUND', 6], 409: ['CONFLICT', 7],
    429: ['RATE_LIMITED', 8], 502: ['PROVIDER_ERROR', 9], 503: ['UNAVAILABLE', 9], 504: ['TIMEOUT', 11],
    400: ['INVALID_INPUT', 2], 422: ['INVALID_INPUT', 2] };
  const [code, exit] = mapping[status] ?? ['HTTP_ERROR', 9];
  return new CliError(code, exit, 'The Harness API rejected the request.', { httpStatus: status, ...(requestId && { requestId }) });
}
export function plan(command, input) {
  if (!valid(command.inputSchema, input)) throw invalid();
  const body = {...input};
  let path = command.path.replace(/\{([^}]+)\}/g, (_, key) => {
    const value=input[key]; if(typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/.test(value) || ['.','..'].includes(value)) throw invalid();
    delete body[key]; return encodeURIComponent(value);
  });
  if(input.after && /[\r\n]/.test(input.after)) throw invalid();
  if(command.method==='GET' && !command.streaming && input.after) path += '?after=' + encodeURIComponent(input.after);
  return {method:command.method,path,...(command.method==='POST'?{body}:{}),sideEffect:command.sideEffect,automaticRetry:false};
}
export async function request(command, input, config, signal) {
  const operation = plan(command, input);
  let response;
  try { response = await fetch(config.origin + operation.path, { method: operation.method, redirect: 'manual', signal,
    headers: { authorization: `Bearer ${config.token}`, accept: command.streaming ? 'text/event-stream' : 'application/json',
      ...(operation.body && { 'content-type': 'application/json' }), ...(command.streaming && input.after && { 'last-event-id': input.after }) },
    ...(operation.body && { body: JSON.stringify(operation.body) }) }); }
  catch { throw signal.aborted ? signal.reason : new CliError('NETWORK_ERROR', 10, 'Could not reach the configured Harness API. No automatic retry was attempted.'); }
  const candidate = response.headers.get('x-request-id');
  const requestId = candidate && /^[A-Za-z0-9._:-]{1,128}$/.test(candidate) && !candidate.includes(config.token) ? candidate : undefined;
  if (!response.ok) { await response.body?.cancel(); throw httpError(response.status, requestId); }
  if (!command.success.includes(response.status)) { await response.body?.cancel(); throw protocol(); }
  return { response, requestId };
}
export async function jsonResult(command, response) {
  if (response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') { await response.body?.cancel(); throw protocol(); }
  let text = ''; let bytes = 0;
  const decoder = new TextDecoder('utf-8', { fatal: true });
  try {
    for await (const chunk of response.body) {
      bytes += chunk.byteLength; if (bytes > 1024 * 1024) throw protocol(); text += decoder.decode(chunk, { stream: true });
    }
    text += decoder.decode();
    const data = JSON.parse(text); if (!valid(command.outputSchema, data)) throw protocol(); return data;
  } catch (error) { if (error instanceof CliError) throw error; throw protocol(); }
}

export async function follow(command, input, response, emit) {
  if (response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'text/event-stream') { await response.body?.cancel(); throw protocol(); }
  const reader = response.body.getReader(); const decoder = new TextDecoder('utf-8', { fatal: true });
  let buffer = ''; let lastEventId = input.after ?? null; let sequence = 0; let terminal = null;
  let frame = { data: [], id: undefined, type: 'message' }; let frameSize = 0; const seen = new Map(); let emitted = 0;
  async function dispatch() {
    if (!frame.data.length) { frame = { data: [], id: undefined, type: 'message' }; return; }
    let data; try { data = JSON.parse(frame.data.join('\n')); } catch { throw protocol(); }
    if (frame.type === 'run.delta') {
      if (frame.id !== undefined || !data || typeof data.text !== 'string' || data.text.length > 20000
        || Object.keys(data).some((key) => !['text', 'runId'].includes(key)) || (data.runId && data.runId !== input.runId)) throw protocol();
      await emit({ kind: 'delta', data });
    } else {
      if (!valid(command.outputSchema, data) || data.runId !== input.runId || frame.id !== data.eventId || frame.type !== data.type) throw protocol();
      const fingerprint = createHash('sha256').update(JSON.stringify(data, Object.keys(data).sort())).digest('hex');
      if (seen.has(data.eventId)) { if (seen.get(data.eventId) !== fingerprint) throw protocol(); }
      else if (data.eventId !== input.after) {
        if (data.sequence <= sequence || ++emitted > 10000) throw protocol();
        seen.set(data.eventId, fingerprint); sequence = data.sequence; lastEventId = data.eventId;
        await emit({ kind: 'event', event: data, cursor: lastEventId });
        if (['run.completed', 'run.failed', 'run.cancelled'].includes(data.type)) terminal = data.type;
      }
    }
    frame = { data: [], id: undefined, type: 'message' }; frameSize = 0;
  }
  async function line(value) {
    if (Buffer.byteLength(value) > 256 * 1024) throw protocol();
    if (value === '') { await dispatch(); return; }
    if (value.startsWith(':')) return;
    const colon = value.indexOf(':'); const key = colon < 0 ? value : value.slice(0, colon);
    let content = colon < 0 ? '' : value.slice(colon + 1); if (content.startsWith(' ')) content = content.slice(1);
    if (key === 'data') { frame.data.push(content); frameSize += Buffer.byteLength(content); }
    else if (key === 'id') { if (content.includes('\0') || content.length > 256) throw protocol(); frame.id = content; }
    else if (key === 'event') frame.type = content;
    if (frameSize > 256 * 1024) throw protocol();
  }
  try {
    while (!terminal) {
      const { value, done } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      for (;;) {
        const index = buffer.search(/[\r\n]/); if (index < 0) break;
        if (buffer[index] === '\r' && index === buffer.length - 1 && !done) break;
        const width = buffer[index] === '\r' && buffer[index + 1] === '\n' ? 2 : 1;
        await line(buffer.slice(0, index)); buffer = buffer.slice(index + width); if (terminal) break;
      }
      if (Buffer.byteLength(buffer) > 256 * 1024 && !terminal) throw protocol();
      if (done) break;
    }
    if (!terminal) throw new CliError('INCOMPLETE_STREAM', 12, 'The stream ended before a durable terminal event; resume using the cursor or read run state.', { lastEventId });
    return { lastEventId, terminal };
  } catch (error) {
    if (error instanceof CliError) { error.details = { ...error.details, lastEventId }; throw error; }
    throw new CliError('STREAM_INTERRUPTED', 10, 'The stream was interrupted; no automatic reconnect or run cancellation was performed.', { lastEventId });
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
