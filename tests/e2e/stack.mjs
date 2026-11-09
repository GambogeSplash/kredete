// The broth-service e2e stack: seeding through scripts/e2e_seed.py and restarting the API.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(HERE, '../..');
export const SERVICE = resolve(process.env.BROTH_SERVICE_DIR || resolve(ROOT, '../broth-service'));
export const BASE = process.env.BROTH_E2E_URL || 'http://localhost:8766';
/** Harness state lives outside test-results, which Playwright empties at the start of a run. */
export const STATE = resolve(ROOT, 'tests/e2e/.state');
export const SEED_FILE = resolve(STATE, 'seed.json');
/** Refresh tokens per person per project; split between the workers. */
export const SESSIONS = 80;
export const WORKERS = 4;

/** Seeds the e2e database at a setup state (or `ready`) and returns the seed JSON. */
export function seed(state = 'ready', sessions = SESSIONS) {
  const out = execFileSync('make', ['-s', '-C', SERVICE, 'e2e-seed', `ARGS=--state ${state} --sessions ${sessions}`], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
    timeout: 120_000,
  });
  return JSON.parse(out.trim().split('\n').pop() || '{}');
}

/** Restarts the API so nothing it cached (OAuth client credentials, five minutes) outlives a reseed. */
export async function restartApi() {
  execFileSync('docker', ['compose', '--profile', 'e2e', 'restart', 'e2e-api'], { cwd: SERVICE, stdio: 'ignore', timeout: 120_000 });
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE}/readyz`);
      if (response.ok) return;
    } catch (error) { /* starting */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`the e2e API at ${BASE} did not become ready; is \`make e2e-up\` running?`);
}

export function saveSeed(data) {
  mkdirSync(dirname(SEED_FILE), { recursive: true });
  writeFileSync(SEED_FILE, JSON.stringify(data));
}
export function loadSeed() {
  return JSON.parse(readFileSync(SEED_FILE, 'utf8'));
}
