export const CLIENT_VERSION = '0.1.0';
export const CONTRACT_VERSION = '1.0';
const string = { type: 'string', minLength: 1, maxLength: 256 };
const object = (properties, required = Object.keys(properties)) => ({
  $schema: 'http://json-schema.org/draft-07/schema#', type: 'object', additionalProperties: false, required, properties,
});
export const commands = [
  { id: 'runs.create', argv: ['runs', 'create'], description: 'Submit one AI run; HTTP acceptance is not business completion.',
    method: 'POST', path: '/api/ai/runs', sideEffect: 'create-run', idempotency: 'required-client-key', success: [202],
    inputSchema: object({ prompt: { type: 'string', minLength: 1, maxLength: 20000 },
      idempotencyKey: { type: 'string', minLength: 1, maxLength: 128 } }),
    outputSchema: object({ runId: string, requestId: string }, ['runId']) },
  { id: 'runs.get', argv: ['runs', 'get'], description: 'Read authorized durable run state.',
    method: 'GET', path: '/api/ai/runs/{runId}', sideEffect: 'none', idempotency: 'read', success: [200],
    inputSchema: object({ runId: string }), outputSchema: object({
      runId: { type: 'string', minLength: 1 },
      actorId: { type: 'string', minLength: 1 }, status: { enum: ['queued', 'running', 'retry_wait', 'succeeded', 'failed', 'cancelled'] },
      idempotencyKey: { type: 'string', minLength: 1 }, version: { type: 'integer', minimum: 1 },
      sessionId: { type: 'string', minLength: 1 }, cancelRequested: { type: 'boolean' },
      errorCode: { enum: ['unauthorized', 'forbidden', 'invalid_input', 'not_found', 'conflict', 'timeout', 'provider_error', 'cancelled', 'unavailable'] },
    }, ['runId', 'actorId', 'status', 'idempotencyKey', 'version']) },
  { id: 'runs.cancel', argv: ['runs', 'cancel'], description: 'Request cancellation; never overwrite a completed business outcome.',
    method: 'POST', path: '/api/ai/runs/{runId}/cancel', sideEffect: 'request-cancellation', idempotency: 'server-idempotent', success: [200, 202],
    inputSchema: object({ runId: string }),
    outputSchema: object({ runId: string, cancelRequested: { const: true }, requestId: string }, ['runId', 'cancelRequested']) },
  { id: 'runs.events', argv: ['runs', 'events'], description: 'Follow SSE to a terminal event; stdout is NDJSON. Interrupt only stops following.',
    method: 'GET', path: '/api/ai/runs/{runId}/events', sideEffect: 'none', idempotency: 'read', success: [200], streaming: true,
    inputSchema: object({ runId: string, after: string }, ['runId']),
    outputSchema: object({ eventId: { type: 'string', minLength: 1 }, runId: { type: 'string', minLength: 1 },
      sequence: { type: 'integer', minimum: 1 },
      type: { enum: ['run.created', 'run.started', 'run.completed', 'run.failed', 'run.cancelled'] },
      time: { type: 'string', format: 'date-time' }, text: { type: 'string' } }, ['eventId', 'runId', 'sequence', 'type', 'time']),
  },
].map((command) => ({ ...command, clientStatus: 'implemented', serverStatus: 'requires-compatible-harness-api',
  authorization: 'server-identity-and-resource-policy', automaticRetry: false }));

export function manifest() {
  return { contractVersion: CONTRACT_VERSION, clientVersion: CLIENT_VERSION, discovery: 'local-client-contracts; not live permission discovery',
    commands, plannedDomains: ['auth', 'sessions', 'models', 'tools', 'permissions', 'runtime', 'audit', 'usage', 'settings', 'integrations'],
    transportAdapters: { cli: 'implemented-foundation', http: 'harness-api-required', mcp: 'planned-adapter-of-same-contracts' } };
}

// This package deliberately supports only the primitive schemas it publishes.
// Refuse unsupported schema constructs instead of silently claiming full JSON Schema validation.
export function valid(schema, value) {
  const supported = ['$schema', 'type', 'additionalProperties', 'required', 'properties', 'minLength', 'maxLength', 'minimum', 'enum', 'const', 'format'];
  if (Object.keys(schema).some((key) => !supported.includes(key))) throw new Error('unsupported client schema');
  if (schema.enum && !schema.enum.includes(value)) return false;
  if ('const' in schema && value !== schema.const) return false;
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    if ((schema.required ?? []).some((key) => !Object.hasOwn(value, key))) return false;
    if (schema.additionalProperties === false && Object.keys(value).some((key) => !Object.hasOwn(schema.properties, key))) return false;
    return Object.entries(value).every(([key, item]) => !schema.properties[key] || valid(schema.properties[key], item));
  }
  if (schema.type === 'string') {
    if (typeof value !== 'string') return false;
    const length = [...value].length;
    if (schema.minLength !== undefined && length < schema.minLength) return false;
    if (schema.maxLength !== undefined && length > schema.maxLength) return false;
    if (schema.format === 'date-time' && (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(value) || Number.isNaN(Date.parse(value)))) return false;
  } else if (schema.type === 'integer') {
    if (!Number.isSafeInteger(value) || (schema.minimum !== undefined && value < schema.minimum)) return false;
  } else if (schema.type === 'boolean' && typeof value !== 'boolean') return false;
  else if (schema.type && !['object', 'string', 'integer', 'boolean'].includes(schema.type)) throw new Error('unsupported client schema type');
  return true;
}
