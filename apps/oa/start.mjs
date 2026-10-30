#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

const root = fileURLToPath(new URL('.', import.meta.url));
let child; let timer;
try {
  const { values } = parseArgs({ strict: true, options: {
    port: { type: 'string', default: '3080' }, workspace: { type: 'string' },
    open: { type: 'boolean', default: false }, help: { type: 'boolean', short: 'h' },
    'public-url': { type: 'string' },
  } });
  if (values.help) {
    console.log('nuochong-oa [--port 3080] [--workspace PATH] [--open] [--public-url https://host/path/]\nStarts the official Harness Web page. The listener stays on loopback behind a trusted reverse proxy.\nOpen the private startup URL printed by Harness; no model request is made on startup.');
  } else {
    if (process.version !== 'v24.21.0') throw new Error('OA preview requires the verified Node 24.21.0 runtime.');
    if (!/^\d+$/.test(values.port) || +values.port < 1 || +values.port > 65535) throw new Error('Port must be 1..65535.');
    const publicValue = values['public-url'] ?? process.env.NUOCHONG_OA_PUBLIC_URL;
    let publicUrl;
    if (publicValue) {
      publicUrl = new URL(publicValue);
      const local = ['localhost', '127.0.0.1', '[::1]'].includes(publicUrl.hostname);
      if (publicUrl.username || publicUrl.password || publicUrl.search || publicUrl.hash ||
          !(publicUrl.protocol === 'https:' || (publicUrl.protocol === 'http:' && local))) throw new Error('Invalid public URL.');
      if (!publicUrl.pathname.endsWith('/')) publicUrl.pathname += '/';
    }
    const home = resolve(process.env.NUOCHONG_OA_HOME ?? resolve(root, '.state'));
    const workspace = resolve(values.workspace ?? resolve(home, 'workspace'));
    mkdirSync(workspace, { recursive: true }); mkdirSync(resolve(home, 'tmp'), { recursive: true });
    const require = createRequire(import.meta.url);
    const manifestPath = require.resolve('@deepseek-ai/dsh/package.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    if (manifest.version !== '0.2.1-rc.2') throw new Error('Unexpected Harness version; verify the isolated lockfile.');
    const binary = resolve(dirname(manifestPath), typeof manifest.bin === 'string' ? manifest.bin : manifest.bin.dsh);
    child = spawn(process.execPath, [binary, '--profile', 'web', '--host', '127.0.0.1', '--port', values.port,
      ...(publicUrl ? ['--public-url', publicUrl.href, '--trusted-host', publicUrl.host] : []),
      ...(values.open ? [] : ['--no-open'])], { cwd: workspace, stdio: 'inherit',
      env: { PATH: process.env.PATH, HOME: home, DSH_HOME: home, TMPDIR: resolve(home, 'tmp'), LANG: 'en_US.UTF-8', TERM: process.env.TERM ?? 'dumb',
        ...(process.env.DEEPSEEK_API_KEY && { DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY }) } });
    const stop = () => {
      child.kill('SIGTERM'); timer ??= setTimeout(() => child.kill('SIGKILL'), 5000); timer.unref();
    };
    process.on('SIGINT', stop); process.on('SIGTERM', stop);
    try { const [code, signal] = await once(child, 'exit'); process.exitCode = code ?? (signal ? 1 : 0); }
    finally { process.off('SIGINT', stop); process.off('SIGTERM', stop); }
  }
} catch {
  console.error('OA preview could not start. Check the verified Node version, port and apps/oa installation.'); process.exitCode = 1;
} finally { clearTimeout(timer); }
