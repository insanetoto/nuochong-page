import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';
import { EventJournal } from './adapter.mjs';

// Real loopback HTTP disconnect/reconnect over synthetic lifecycle events.
// No proxy, database, auth boundary or model is implied by this fixture.
const journal = new EventJournal('sse-fixture');
journal.append('create', 'run.created');
const subscribers = new Set();
const server = createServer((req, res) => {
  let events;
  try { events = journal.replay(req.headers['last-event-id']); }
  catch { res.writeHead(409); res.end(); return; }
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
  res.flushHeaders();
  const send = (event) => res.write(`id: ${event.eventId}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
  events.forEach(send);
  subscribers.add(send);
  res.on('close', () => subscribers.delete(send));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
function readOnce(cursor) {
  return new Promise((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port, headers: cursor ? { 'last-event-id': cursor } : {} }, (res) => {
      if (res.statusCode !== 200) { res.resume(); resolve({ status: res.statusCode }); return; }
      let buffer = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        buffer += chunk;
        if (!buffer.includes('\n\n')) return;
        const frame = buffer.split('\n\n')[0];
        const event = JSON.parse(frame.split('\n').find((line) => line.startsWith('data: ')).slice(6));
        res.destroy(); resolve({ status: 200, event });
      });
      res.on('error', reject);
    });
    req.setTimeout(2000, () => req.destroy(new Error('SSE fixture timeout')));
    req.on('error', reject); req.end();
  });
}
const results = [];
try {
  const first = await readOnce();
  assert.equal(first.event.sequence, 1);
  // Simulate execution progressing while the client is disconnected.
  journal.append('start', 'run.started');
  journal.append('start', 'run.started');
  const second = await readOnce(first.event.eventId);
  assert.equal(second.event.sequence, 2);
  journal.append('done', 'run.completed');
  const third = await readOnce(second.event.eventId);
  assert.equal(third.event.sequence, 3);
  assert.equal(new Set([first, second, third].map((r) => r.event.eventId)).size, 3);
  assert.equal((await readOnce('other-run:1')).status, 409);
  assert.equal(journal.replay().at(-1).type, 'run.completed');
  results.push({ name: 'real HTTP disconnect, Last-Event-ID replay, dedup and foreign cursor rejection', passed: true });
} finally {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
const report = { time: new Date().toISOString(), platform: `${process.platform}-${process.arch}`, node: process.version,
  scope: 'Real loopback HTTP/SSE with in-memory synthetic events; no proxy, persistence, auth or model', results };
mkdirSync(new URL('./outputs/', import.meta.url), { recursive: true });
writeFileSync(new URL('./outputs/sse-probe.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
