import { spawnSync } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('.', import.meta.url));
const home = resolve(root, '.dsh-home');
mkdirSync(home, { recursive: true });
const packages = {};
for (const name of ['dsh', 'dsh-sdk-client']) {
  const p = JSON.parse(readFileSync(resolve(root, 'node_modules/@deepseek-ai', name, 'package.json'), 'utf8'));
  if (p.version !== '0.2.1-rc.2') throw new Error(`Unexpected ${name} version`);
  packages[name] = { version: p.version, license: p.license ?? 'not declared', engines: p.engines ?? null };
}
const bin = resolve(root, 'node_modules/@deepseek-ai/dsh/lib/bin.js');
// Whitelist environment: do not inherit GitHub/model tokens or personal Harness config.
const env = { PATH: process.env.PATH, DSH_HOME: home, LANG: 'en_US.UTF-8', TERM: 'dumb' };
const results = [];
for (const profile of ['sdk', 'sdk-minimal']) {
  const result = spawnSync(process.execPath, [bin, '--profile', profile, '--dump-config'], {
    cwd: root, env, encoding: 'utf8', timeout: 30_000, maxBuffer: 8 * 1024 * 1024,
  });
  results.push({ profile, status: result.status, signal: result.signal,
    error: result.error?.message ?? null,
    outputBytes: Buffer.byteLength(result.stdout ?? ''),
    outputSha256: createHash('sha256').update(result.stdout ?? '').digest('hex'),
    // Scrub local absolute paths; no raw configuration or inherited credentials are stored.
    diagnostic: (result.stderr ?? '').replaceAll(root, '<spike>/').slice(-3000) });
}
const report = { time: new Date().toISOString(), node: process.version,
  platform: `${process.platform}-${process.arch}`, packages, results,
  scope: 'Named-profile configuration resolution only; not model execution or full SDK handshake' };
mkdirSync(resolve(root, 'outputs'), { recursive: true });
writeFileSync(resolve(root, 'outputs/runtime-probe.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (results.some((r) => r.status !== 0 || r.outputBytes === 0)) process.exitCode = 1;
