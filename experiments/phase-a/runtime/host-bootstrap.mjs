import { DeepSeekHarness } from '@deepseek-ai/dsh-sdk-client';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { writeReadonlyPatch } from './profile-patch.mjs';

// A-09 boots the real SDK but uses a separate synthetic executor to test the
// deployment without a paid model call. No parent credentials are inherited.
export async function bootHarness(stateRoot) {
  const root = fileURLToPath(new URL('.', import.meta.url));
  mkdirSync(stateRoot, { recursive: true });
  const harness = new DeepSeekHarness({ profile: 'sdk-minimal',
    patches: [writeReadonlyPatch(root, true, stateRoot)], dshHome: resolve(stateRoot, 'dsh'),
    cwd: stateRoot, processCwd: root,
    env: { PATH: process.env.PATH, LANG: 'en_US.UTF-8', TERM: 'dumb',
      HOME: stateRoot, XDG_CACHE_HOME: resolve(stateRoot, 'cache') },
    initializeTimeoutMs: 20_000, shutdownTimeoutMs: 1000, disposeEofGraceMs: 1000, disposeGraceMs: 1000 });
  try { await harness.start(); return harness; }
  catch (error) { await harness.close(); throw error; }
}
