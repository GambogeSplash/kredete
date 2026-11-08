// The setup wizard (sandbox spec 4.1 and 6.2): the step is derived from API state, from an
// empty database and from a seeded database at each step. Every step is checked at both widths
// in both themes. Google sign-in and the Confluence authorization leave Broth, so those two
// transitions are covered by the manual run; the forms between them are driven here.
// Serial: each test reseeds the database and restarts the API (it caches OAuth clients).
import { expect, test } from './fixtures.mjs';
import { VIEWS } from '../../playwright.config.mjs';
import { restartApi, saveSeed, seed } from './stack.mjs';

test.describe.configure({ mode: 'serial' });

const ADMIN_EMAIL = 'ada.okafor@kredete.com';
const STEPS = [
  { state: 'claim', heading: 'Set up Kredete Brain', as: 'visitor' },
  { state: 'google', heading: 'Connect Google sign-in', as: 'claimer' },
  { state: 'signin', heading: 'Sign in as the first admin', as: 'claimer' },
  { state: 'confluence', heading: 'Add the Confluence app', as: 'admin' },
  { state: 'connect', heading: 'Connect your Confluence site', as: 'admin' },
  { state: 'spaces', heading: 'Pick the spaces Brain reads', as: 'admin' },
  { state: 'sync', heading: 'Brain is reading your spaces', as: 'admin' },
  { state: 'ready', heading: 'Brain is ready', as: 'admin' },
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
  if (step.as === 'admin') return open('admin', '/setup', { view, token: seeded.people.admin.refresh_tokens[i] });
  return open(null, '/', { view, setupSession: step.as === 'claimer' ? seeded.setup_session : undefined });
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
  const page = await open(null, '/');
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
  const page = await open(null, '/', { setupSession: seeded.setup_session });
  await page.getByRole('textbox', { name: 'Client ID' }).fill('1234-test.apps.googleusercontent.com');
  await page.getByLabel('Client secret').fill('GOCSPX-browser-test-secret');
  await page.getByRole('button', { name: /Save/ }).click();
  await expect(page.getByRole('heading', { name: 'Sign in as the first admin' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Google/ })).toHaveAttribute('href', '/v1/auth/google/start');
});

test('the Confluence app moves on to connecting a site, and spaces move on to the first sync', async ({ open }) => {
  let seeded = await seedState('confluence');
  let page = await open('admin', '/setup', { token: seeded.people.admin.refresh_tokens[0] });
  await page.getByRole('textbox', { name: 'Client ID' }).fill('browser-test-client');
  await page.getByLabel('Secret').fill('browser-test-secret');
  await page.getByRole('button', { name: /Save/ }).click();
  await expect(page.getByRole('heading', { name: 'Connect your Confluence site' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Leave setup for now' })).toBeVisible();

  seeded = await seedState('spaces');
  page = await open('admin', '/setup', { token: seeded.people.admin.refresh_tokens[0] });
  await page.getByRole('checkbox').first().check();
  await page.getByRole('button', { name: /Include/ }).click();
  await expect(page.getByRole('heading', { name: 'Brain is reading your spaces' })).toBeVisible();
});
