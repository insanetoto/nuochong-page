import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const execute = promisify(execFile);
const root = fileURLToPath(new URL('..', import.meta.url));
const temporary = mkdtempSync(resolve(tmpdir(), 'nuochong-cli-pack-'));
const env = { ...process.env, npm_config_cache: resolve(temporary, 'cache'), npm_config_offline: 'true' };
try {
  const packed = await execute('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', temporary], { cwd: root, env });
  const metadata = JSON.parse(packed.stdout)[0];
  assert.ok(metadata.files.some((f) => f.path === 'bin/nuochong.mjs'));
  assert.ok(!metadata.files.some((f) => f.path.includes('.env') || f.path.startsWith('test/')));
  await execute('npm', ['install', '--prefix', resolve(temporary, 'installed'), '--ignore-scripts', '--no-audit', '--no-fund',
    resolve(temporary, metadata.filename)], { env });
  const binary = resolve(temporary, 'installed/node_modules/@nuochong/cli/bin/nuochong.mjs');
  const discovery = await execute(process.execPath, [binary, 'capabilities', '--json'], { env: { PATH: process.env.PATH } });
  assert.equal(JSON.parse(discovery.stdout).data.commands.length, 22);
  const preview = await execute(process.execPath, [binary, 'runs', 'get', '--run-id', 'fixture', '--dry-run'], { env: { PATH: process.env.PATH } });
  assert.equal(JSON.parse(preview.stdout).data.executed, false);
  console.log(JSON.stringify({ passed: true, scope: 'offline npm tarball install and executable smoke, no source-tree imports', version: metadata.version }));
} finally { rmSync(temporary, { recursive: true, force: true }); }
