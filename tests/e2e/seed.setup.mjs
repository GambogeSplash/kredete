// Runs before each viewport and theme project: a fresh database for its scenarios.
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { test as setup } from '@playwright/test';
import { STATE, restartApi, saveSeed, seed } from './stack.mjs';

setup('seed the e2e stack', async () => {
  setup.setTimeout(240_000);
  saveSeed(seed('ready'));
  rmSync(resolve(STATE, 'tokens'), { recursive: true, force: true });
  await restartApi();
});
