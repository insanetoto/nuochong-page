import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import test from 'node:test';

// Reuse Ajv 6.15.0 pinned in the existing root lockfile; no production dependency change.
const require = createRequire(import.meta.url);
const Ajv = require('ajv');
assert.equal(require('ajv/package.json').version, '6.15.0');
const ajv = new Ajv({ allErrors: true, removeAdditional: false });
const fixtures = {
  actor: {
    valid: { userId: 'user-a', tenantId: 'tenant-a', roles: ['member'], requestId: 'request-a' },
    invalid: [
      { userId: 'a', roles: ['member'], requestId: 'r' },
      { userId: 'a', tenantId: 't', roles: ['owner'], requestId: 'r' },
      { userId: 'a', tenantId: 't', roles: ['member'], requestId: 'r', bypass: true },
    ],
  },
  'create-run': {
    valid: { prompt: 'Synthetic test input', idempotencyKey: 'test-key' },
    invalid: [
      { prompt: '', idempotencyKey: 'k' },
      { prompt: 'hello', idempotencyKey: 'k', tenantId: 'victim' },
      { prompt: 'hello', idempotencyKey: 'k', roles: ['admin'] },
      { prompt: 'hello', idempotencyKey: 'k', userId: 'victim' },
    ],
  },
  run: {
    valid: { runId: 'run-a', tenantId: 'tenant-a', actorId: 'user-a', status: 'queued', idempotencyKey: 'k', version: 1 },
    invalid: [
      { runId: 'a', tenantId: 't', actorId: 'u', status: 'magic', idempotencyKey: 'k', version: 1 },
      { runId: 'a', tenantId: 't', actorId: 'u', status: 'queued', idempotencyKey: 'k', version: 0 },
    ],
  },
  event: {
    valid: { eventId: 'event-a', runId: 'run-a', sequence: 1, type: 'run.created', time: '2026-10-29T00:00:00Z' },
    invalid: [
      { eventId: 'e', runId: 'r', sequence: 0, type: 'run.created', time: '2026-10-29T00:00:00Z' },
      { eventId: 'e', runId: 'r', sequence: 1, type: 'run.created', time: 'invalid' },
      { eventId: 'e', runId: 'r', sequence: 1, type: 'run.delta', time: '2026-10-29T00:00:00Z' },
    ],
  },
};
for (const [name, fixture] of Object.entries(fixtures)) {
  const validate = ajv.compile(JSON.parse(readFileSync(new URL(`./${name}.schema.json`, import.meta.url), 'utf8')));
  test(`${name}: valid fixture accepted`, () => assert.equal(validate(fixture.valid), true, JSON.stringify(validate.errors)));
  fixture.invalid.forEach((value, index) => test(`${name}: invalid fixture ${index + 1} rejected`, () => assert.equal(validate(value), false)));
}
