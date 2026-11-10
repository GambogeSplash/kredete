// Browser suite (sandbox spec 6.2, plan C9). Runs against the broth-service e2e stack:
//   make -C ../broth-service e2e-up     # API with fake models, serving this checkout on :8766
//   npm run test:e2e
// From a worktree whose service checkout has its own stack.env, point at that stack:
//   BROTH_SERVICE_DIR=../broth-service-wt BROTH_E2E_URL=http://localhost:8776 npm run test:e2e
//
// Projects run one after another, each on a freshly seeded database: the setup wizard states
// first, then the sync runs on the Connectors page, then every scenario at 1440 px and 390 px,
// light and dark. Inside a project the scenarios run in parallel; each person's sessions come
// from a pool split by worker. The wizard and sync projects run serially and seed their own
// states, because they change what the shared database would show the other scenarios.
import { defineConfig } from '@playwright/test';

const BASE = process.env.BROTH_E2E_URL || 'http://localhost:8766';
export const VIEWS = [
  { name: '1440-light', width: 1440, height: 900, theme: 'light' },
  { name: '1440-dark', width: 1440, height: 900, theme: 'dark' },
  { name: '390-light', width: 390, height: 844, theme: 'light' },
  { name: '390-dark', width: 390, height: 844, theme: 'dark' },
];

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /.*\.(spec|setup)\.mjs$/,
  timeout: 60_000,
  expect: { timeout: 10_000, toHaveScreenshot: { animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.002 } },
  retries: 0,
  workers: 4,
  fullyParallel: true,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{arg}{ext}',
  use: {
    baseURL: BASE,
    browserName: 'chromium',
    reducedMotion: 'reduce',
    locale: 'en-GB',
    timezoneId: 'Africa/Lagos',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'wizard', testMatch: /wizard\.spec\.mjs$/, fullyParallel: false },
    { name: 'sync', testMatch: /sync\.spec\.mjs$/, fullyParallel: false, dependencies: ['wizard'] },
    ...VIEWS.flatMap((view, i) => [
      {
        name: `seed-${view.name}`,
        testMatch: /seed\.setup\.mjs$/,
        dependencies: [i === 0 ? 'sync' : VIEWS[i - 1].name],
      },
      {
        name: view.name,
        testIgnore: [/wizard\.spec\.mjs$/, /sync\.spec\.mjs$/, /seed\.setup\.mjs$/],
        dependencies: [`seed-${view.name}`],
        use: { viewport: { width: view.width, height: view.height }, theme: view.theme },
      },
    ]),
  ],
});
