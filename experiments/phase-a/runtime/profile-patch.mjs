import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function writeReadonlyPatch(root, bridge = false, outputRoot = resolve(root, 'outputs')) {
  mkdirSync(outputRoot, { recursive: true });
  const path = resolve(outputRoot, bridge ? 'readonly-bridge.patch.yml' : 'readonly.patch.yml');
  writeFileSync(path, ['tool-fs', 'tool-working-directory', 'persistent-bash', 'persistent-pwsh',
    ...(bridge ? ['sdk-jsonrpc-server'] : [])]
    .map((id) => `- id: ${id}\n  disabled: true`).join('\n')
    + '\n- id: llm-deepseek\n  config:\n    apiKeyEnv: DEEPSEEK_API_KEY\n    retryPolicy:\n      mode: normal\n      maxRetries: 2\n'
    + `\n- insert:\n    - id: nuochong-fixture\n      name: ${JSON.stringify(resolve(root, 'readonly-plugin.mjs'))}\n`
    + (bridge ? `    - id: nuochong-bridge\n      name: ${JSON.stringify(resolve(root, 'stream-bridge-plugin.mjs'))}\n` : ''));
  return path;
}
