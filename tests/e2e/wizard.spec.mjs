// The setup wizard (sandbox spec 4.1 and 6.2): three steps (claim, Google client, sign in), each
// derived from API state, from an empty database and from a seeded database. Every step is checked
// at both widths in both themes. Google sign-in leaves Broth, so that transition is covered by the
// manual run; the forms before it are driven here. Connecting a source (Confluence) is not part of
// the wizard: it happens on Admin, Sources, and is covered by the Connectors specs.
// Serial: each test reseeds the database and restarts the API (it caches OAuth clients).
import { expect, test } from './fixtures.mjs';
import { VIEWS } from '../../playwright.config.mjs';
import { restartApi, saveSeed, seed } from './stack.mjs';

test.describe.configure({ mode: 'serial' });

const ADMIN_EMAIL = 'ada.okafor@kredete.com';
/** Calls the API as the signed-in page. */
const api = (page, method, path, body) => page.evaluate(([m, p, b]) => window.BRAIN.api[m](p, b), [method, path, body]);
const STEPS = [
  { state: 'claim', heading: 'Set up Broth', as: 'visitor' },
  { state: 'google', heading: 'Connect Google sign-in', as: 'claimer' },
  { state: 'signin', heading: 'Sign in as the first admin', as: 'claimer' },
];

/** Seeds `state` with one admin session per view and one spare, and restarts the API. */
async function seedState(state) {
  const seeded = seed(state, VIEWS.length + 1);
  saveSeed(seeded);
  await restartApi();
  return seeded;
}
/** Opens the wizard as the step needs: before claiming, after claiming, or as the admin. */
function openAs(open, step, seeded, view, i) {
  return open(null, '/setup', { view, setupSession: step.as === 'claimer' ? seeded.setup_session : undefined });
}

for (const step of STEPS) {
  test(`the ${step.state} step`, async ({ open, check }) => {
    test.setTimeout(240_000);
    const seeded = await seedState(step.state);
    for (const [i, view] of VIEWS.entries()) {
      const page = await openAs(open, step, seeded, view, i);
      await expect(page.getByRole('heading', { name: step.heading })).toBeVisible();
      await check(page, `${step.state}-${view.name}`);
      await page.close();
    }
  });
}

test('claiming: a wrong code is refused, the right one moves on to Google', async ({ open }) => {
  const seeded = await seedState('claim');
  const page = await open(null, '/setup');
  await page.getByRole('textbox', { name: 'Setup code' }).fill('AAAA-BBBB-CCCC-DDDD');
  await page.getByRole('textbox', { name: 'Your Google account' }).fill(ADMIN_EMAIL);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('alert')).toHaveText('That setup code is not valid');
  await page.getByRole('textbox', { name: 'Setup code' }).fill(seeded.setup_code);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Connect Google sign-in' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Connect Google sign-in' })).toBeVisible(); // derived, not remembered
});

test('the Google client moves on to sign-in', async ({ open }) => {
  const seeded = await seedState('google');
  const page = await open(null, '/setup', { setupSession: seeded.setup_session });
  await page.getByRole('textbox', { name: 'Client ID' }).fill('1234-test.apps.googleusercontent.com');
  await page.getByLabel('Client secret').fill('GOCSPX-browser-test-secret');
  await page.getByRole('button', { name: /Save/ }).click();
  await expect(page.getByRole('heading', { name: 'Sign in as the first admin' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Google/ })).toHaveAttribute('href', '/v1/auth/google/start');
});

test('after the first admin signs in the wizard is over: /setup lands on Sources', async ({ open }) => {
  test.setTimeout(150_000);
  const seeded = await seedState('confluence');
  const page = await open('admin', '/setup', { token: seeded.people.admin.refresh_tokens[0] });
  await expect(page).toHaveURL(/\/admin\/connectors/);
  await expect(page.getByRole('heading', { name: 'Add the Confluence app' })).toHaveCount(0);
});
