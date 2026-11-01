#!/usr/bin/env node
// Administrator deployment utility. Input is private JSON on stdin; no secret output.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync, chmodSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const packageRoot = process.env.OA_PACKAGE_ROOT ?? fileURLToPath(new URL('..', import.meta.url));
const { parse, stringify } = createRequire(resolve(packageRoot, 'package.json'))('yaml');
export const disabledDemoEntries = ['ui-settings-account', 'ui-settings-models', 'ui-settings-web-search',
  'ui-plugin-manager', 'ui-settings-plugin-inventory', 'llm-deepseek-account', 'llm-pi-ai'];
export function configureDemo(home, key) {
  if (!home || typeof key !== 'string' || !/^sk-[A-Za-z0-9_-]{16,256}$/.test(key)) throw new Error('Invalid demo configuration');
  const profile = resolve(home, 'profiles/web'); mkdirSync(profile, { recursive: true, mode: 0o700 });
  const patchPath = resolve(profile, 'cordis.patch.yml');
  const entries = existsSync(patchPath) ? parse(readFileSync(patchPath, 'utf8')) ?? [] : [];
  if (!Array.isArray(entries)) throw new Error('Unexpected profile shape');
  const credentialsPath = resolve(home, '.credentials.yaml');
  const credentials = existsSync(credentialsPath) ? parse(readFileSync(credentialsPath, 'utf8')) ?? {} : {};
  if (typeof credentials !== 'object' || Array.isArray(credentials) || (credentials.version !== undefined && credentials.version !== 1)) throw new Error('Unexpected credential format');
  credentials.version = 1; credentials.refs ??= {};
  if (typeof credentials.refs !== 'object' || Array.isArray(credentials.refs)) throw new Error('Unexpected credential references');
  credentials.refs.DEEPSEEK_API_KEY = key;
  for (const id of disabledDemoEntries) {
    const found = entries.find(e => e?.id === id);
    if (found) found.disabled = true; else entries.push({ id, disabled: true });
  }
  // Headless Linux hosts often have no OS Documents directory. Use the isolated
  // demo directory for the official first-use workspace initializer.
  const documentsDirectory = resolve(home, 'workspace');
  mkdirSync(documentsDirectory, { recursive: true, mode: 0o700 });
  const workspace = entries.find(e => e?.id === 'workspace-controller');
  if (workspace) workspace.config = { ...workspace.config, documentsDirectory };
  else entries.push({ id: 'workspace-controller', config: { documentsDirectory } });
  const model = entries.find(e => e?.id === 'llm-deepseek');
  if (model) { model.disabled = false; model.config = { ...model.config, apiKeyEnv: 'DEEPSEEK_API_KEY' }; }
  else entries.push({ id: 'llm-deepseek', disabled: false, config: { apiKeyEnv: 'DEEPSEEK_API_KEY' } });
  const atomic = (path, content) => { const temp = path + '.demo-next'; writeFileSync(temp, content, {mode:0o600}); chmodSync(temp,0o600); renameSync(temp,path); chmodSync(path,0o600); };
  // Official local credential document; never put the key into the profile or browser.
  atomic(credentialsPath, stringify(credentials));
  atomic(patchPath, stringify(entries));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const input = JSON.parse(readFileSync(0, 'utf8'));
    configureDemo(process.env.NUOCHONG_OA_HOME, input.apiKey);
    console.log('Managed demo profile configured; credential values omitted.');
  } catch { console.error('Managed demo configuration failed; private diagnostics omitted.'); process.exitCode = 1; }
}
