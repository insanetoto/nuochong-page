import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { createInterface } from 'node:readline';

const home = process.env.NUOCHONG_OA_HOME;
if (!home) throw new Error('Service home is required.');
mkdirSync(home, { recursive: true, mode: 0o700 });
const child = spawn(process.execPath, ['--max-old-space-size=384', fileURLToPath(new URL('../start.mjs', import.meta.url))], {
  env: process.env, stdio: ['ignore', 'pipe', 'pipe'],
});
for (const output of [child.stdout, child.stderr]) {
  const lines = createInterface({ input: output });
  lines.on('line', (line) => {
    // Keep the authenticated launch URL only in a private server file.
    for (const value of line.match(/https?:\/\/[^\s\u001b]+/g) ?? []) {
      try {
        const url = new URL(value); const expected = new URL(process.env.NUOCHONG_OA_PUBLIC_URL);
        if (url.origin === expected.origin && url.pathname === expected.pathname && url.search) {
          writeFileSync(resolve(home, 'launch-url'), url.href + '\n', { mode: 0o600 });
        }
      } catch { /* Diagnostics are scrubbed below. */ }
    }
    console.log(line.replace(/https?:\/\/[^\s\u001b]+/g, '<redacted-url>'));
  });
}
const stop = () => child.kill('SIGTERM');
process.on('SIGTERM', stop); process.on('SIGINT', stop);
try { const [code] = await once(child, 'exit'); process.exitCode = code ?? 1; }
finally { process.off('SIGTERM', stop); process.off('SIGINT', stop); }
