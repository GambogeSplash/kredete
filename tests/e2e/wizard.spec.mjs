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
/* The e2e stack has no Confluence behind it, so "Find spaces" is answered here. */
const VERIFY = '**/v1/admin/connections/*/verify';
const CONTAINERS = '**/v1/admin/containers?*';
const confluenceFound = (page) => page.route(VERIFY, (route) => route.fulfill({ json: { containers: 3 } }));
/** Calls the API as the signed-in page. */
const api = (page, method, path, body) => page.evaluate(([m, p, b]) => window.BRAIN.api[m](p, b), [method, path, body]);
/** Sets the fake source's per-fetch delay or failing pages for the connection (plan S0.1). */
const configure = (page, connection, fields) => api(page, 'post', '/sandbox/fake-source/configure', { connection_id: connection, ...fields });
/** Includes spaces through the API, as the Connectors page does, by their names. */
async function include(page, connection, names) {
  const containers = (await api(page, 'get', '/admin/containers', { connection_id: connection })).items;
  const me = await page.evaluate(() => window.BRAIN.S.me.id);
  for (const name of names) {
    const space = containers.find((c) => c.path === name);
    await api(page, 'patch', `/admin/containers/${space.id}`, { included: true, owner_user_id: me });
  }
}
/**
 * Waits until no space of the connection is being read. A scenario that leaves reads going
 * calls this last, so the next scenario's reseed does not run while the worker still writes.
 */
const readsFinished = (page, connection) => expect.poll(async () => (await api(page, 'get', '/admin/containers', { connection_id: connection }))
  .items.filter((c) => c.active_run).length, { timeout: 90_000 }).toBe(0);
/** The sync step's status region: the reads together, then the list of spaces. */
const reading = (page) => page.getByRole('status').filter({ has: page.getByRole('list', { name: 'Spaces' }) });
/** The sync step's row for a space. */
const row = (page, name) => page.getByRole('listitem').filter({ hasText: name });
const STEPS = [
  { state: 'claim', heading: 'Set up Kredete Brain', as: 'visitor' },
  { state: 'google', heading: 'Connect Google sign-in', as: 'claimer' },
  { state: 'signin', heading: 'Sign in as the first admin', as: 'claimer' },
  { state: 'confluence', heading: 'Add the Confluence app', as: 'admin' },
  { state: 'connect', heading: 'Connect your Confluence site', as: 'admin' },
  { state: 'spaces', heading: 'Pick the spaces Brain reads', as: 'admin', before: confluenceFound },
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
  if (step.as === 'admin') return open('admin', '/setup', { view, token: seeded.people.admin.refresh_tokens[i], before: step.before });
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
  test.setTimeout(150_000);
  let seeded = await seedState('confluence');
  let page = await open('admin', '/setup', { token: seeded.people.admin.refresh_tokens[0] });
  await page.getByRole('textbox', { name: 'Client ID' }).fill('browser-test-client');
  await page.getByLabel('Secret').fill('browser-test-secret');
  await page.getByRole('button', { name: /Save/ }).click();
  await expect(page.getByRole('heading', { name: 'Connect your Confluence site' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Leave setup for now' })).toBeVisible();

  seeded = await seedState('spaces');
  page = await open('admin', '/setup', { token: seeded.people.admin.refresh_tokens[0], before: confluenceFound });
  await configure(page, seeded.connection_id, { delay_ms: 2000 }); // the read outlasts the assertion
  await page.getByRole('checkbox').first().check();
  await page.getByRole('button', { name: /Include/ }).click();
  await expect(page.getByRole('heading', { name: 'Brain is reading your spaces' })).toBeVisible();
  await readsFinished(page, seeded.connection_id);
});

test('spaces: a space created after connecting appears on opening and on "Look again"', async ({ open }) => {
  const seeded = await seedState('spaces');
  let extra = [];
  const page = await open('admin', '/setup', {
    token: seeded.people.admin.refresh_tokens[0],
    before: async (p) => {
      await confluenceFound(p);
      await p.route(CONTAINERS, async (route) => {
        const response = await route.fetch();
        const body = await response.json();
        await route.fulfill({ response, json: { ...body, items: [...body.items, ...extra] } });
      });
    },
  });
  const base = { connection_id: seeded.connection_id || null, kind: 'space', included: false, owner_user_id: null, default_domain_id: null, default_authority: null, default_sensitivity: null, review_interval_months: 12, indexer_verified_at: null };
  await expect(page.getByRole('checkbox')).toHaveCount(3);
  await page.getByRole('checkbox', { name: 'Include Cards (CARD)' }).uncheck();
  extra = [
    { ...base, id: '00000000-0000-4000-8000-0000000000a1', external_id: 'kb', path: 'Kredete Knowledge Base (KB)' },
    { ...base, id: '00000000-0000-4000-8000-0000000000a2', external_id: 'me', path: 'Ada Okafor (~5f1e2d3c4b5a69788796a5b4)' },
  ];
  await page.getByRole('button', { name: 'Look again' }).click();
  await expect(page.getByRole('checkbox')).toHaveCount(5);
  await expect(page.getByRole('checkbox', { name: 'Include Kredete Knowledge Base (KB)' })).toBeChecked();
  // A personal space shows as one, and starts unticked.
  await expect(page.getByRole('checkbox', { name: 'Include Ada Okafor (personal space)' })).not.toBeChecked();
  await expect(page.getByText(/~5f1e2d3c/)).toHaveCount(0);
  // What the person unticked before looking again stays unticked.
  await expect(page.getByRole('checkbox', { name: 'Include Cards (CARD)' })).not.toBeChecked();
  await expect(page.getByRole('button', { name: 'Include 3 spaces' })).toBeEnabled();
});

test('spaces: when Confluence cannot be read, the known spaces stay usable', async ({ open }) => {
  test.setTimeout(150_000);
  const seeded = await seedState('spaces');
  const detail = 'the source could not be read: Atlassian refused the grant; an admin must authorize again';
  const page = await open('admin', '/setup', {
    token: seeded.people.admin.refresh_tokens[0],
    before: (p) => p.route(VERIFY, (route) => route.fulfill({
      status: 409,
      contentType: 'application/problem+json',
      json: { type: 'urn:broth:problem:invalid_state', title: 'Invalid state', status: 409, code: 'invalid_state', detail },
    })),
  });
  await expect(page.getByRole('alert')).toHaveText(`Couldn't check Confluence for new spaces: ${detail}`);
  await expect(page.getByRole('checkbox')).toHaveCount(3);
  await configure(page, seeded.connection_id, { delay_ms: 2000 }); // the read outlasts the assertion
  await page.getByRole('button', { name: 'Include 3 spaces' }).click();
  await expect(page.getByRole('heading', { name: 'Brain is reading your spaces' })).toBeVisible();
  await readsFinished(page, seeded.connection_id);
});

// Sync runs plan C0.1: the bug this scenario reproduces is that the sync step moves on to
// "Brain is ready" as soon as the connection's first poll finishes, while the included spaces
// are still being read. On the e2e stack the worker reads them from the fake source (plan S0),
// slowed down here so the reading takes a while; the fake source's page list says which pages
// Broth has actually stored. Plan task C3 drives the step from the spaces' read runs.
test('setup says Brain is ready only once the included spaces are read', async ({ open }) => {
  test.setTimeout(150_000);
  const seeded = await seedState('spaces');
  const connection = seeded.connection_id;
  const page = await open('admin', '/setup', { token: seeded.people.admin.refresh_tokens[0] });
  const unread = async () => (await api(page, 'get', '/sandbox/fake-source/pages', { connection_id: connection }))
    .items.filter((p) => !p.stored).map((p) => p.external_id).sort();
  await configure(page, connection, { delay_ms: 4000 });

  await page.getByRole('button', { name: 'Include 3 spaces' }).click();
  await expect(page.getByRole('heading', { name: 'Brain is reading your spaces' })).toBeVisible();
  // The connection's first poll, as the scheduler would run it (the e2e stack has none). A
  // first poll only records where the change feed starts; it reads no pages.
  await api(page, 'post', `/admin/connections/${connection}/sync`);

  const ready = page.getByRole('heading', { name: 'Brain is ready' });
  const deadline = Date.now() + 120_000;
  for (;;) {
    const shown = await ready.isVisible();
    const left = await unread();
    if (shown) {
      expect(left, '"Brain is ready" is shown while these pages are still unread').toEqual([]);
      break;
    }
    if (!left.length) {
      await expect(ready, 'every page is read, so setup is done').toBeVisible({ timeout: 30_000 });
      break;
    }
    expect(Date.now() < deadline, `pages still unread after two minutes: ${left.join(', ')}`).toBe(true);
    await page.waitForTimeout(250);
  }
});

/** Including spaces waits on the API and the queue, which can take a while on a busy machine. */
const INCLUDED = 30_000;

// Sync runs plan C3 (spec 3.3). The worker reads 4 pages at a time, and the fake source's delay
// keeps every fetch going for a while, so each state below holds long enough to look at:
// Payments' 4 pages fill the worker, so the spaces included after them wait to be listed;
// once Payments is read, the other 5 pages are listed and wait on the next fetches.
test('the sync step shows each space being listed and read, then moves on', async ({ open, check }) => {
  test.setTimeout(240_000);
  const seeded = await seedState('spaces');
  const connection = seeded.connection_id;
  const opened = [];
  const first = await open('admin', '/setup', { view: VIEWS[0], token: seeded.people.admin.refresh_tokens[0], before: confluenceFound });
  opened.push(first);
  await configure(first, connection, { delay_ms: 20_000 });
  await first.getByRole('checkbox', { name: 'Include Cards (CARD)' }).uncheck();
  await first.getByRole('checkbox', { name: 'Include Engineering (ENG)' }).uncheck();
  await first.getByRole('button', { name: 'Include 1 space' }).click();
  await expect(first.getByRole('heading', { name: 'Brain is reading your spaces' })).toBeVisible({ timeout: INCLUDED });
  await expect(row(first, 'Payments (PAY)')).toContainText('0 of 4', { timeout: 30_000 });
  // No Sync now here; the step reads on by itself (spec 3.3).
  await expect(first.getByRole('button', { name: 'Sync now' })).toHaveCount(0);

  // Two more spaces, included elsewhere (the Connectors page), join the step.
  await include(first, connection, ['Cards (CARD)', 'Engineering (ENG)']);
  for (const [i, view] of VIEWS.entries()) {
    if (i) opened.push(await open('admin', '/setup', { view, token: seeded.people.admin.refresh_tokens[i] }));
  }
  for (const [i, page] of opened.entries()) {
    await expect(row(page, 'Cards (CARD)')).toContainText('Listing pages…');
    await expect(row(page, 'Engineering (ENG)')).toContainText('Listing pages…');
    await expect(reading(page)).toContainText('Listing pages… 4 so far');
    await expect(page.getByRole('progressbar')).toHaveCount(0); // the total is not known yet
    await check(page, `sync-listing-${VIEWS[i].name}`);
  }

  for (const [i, page] of opened.entries()) {
    await expect(reading(page)).toContainText('Reading 4 of 9 pages', { timeout: 60_000 });
    await expect(row(page, 'Payments (PAY)')).toContainText('4 pages');
    await expect(row(page, 'Cards (CARD)')).toContainText('0 of 2');
    await expect(row(page, 'Engineering (ENG)')).toContainText('0 of 3');
    const bar = page.getByRole('progressbar', { name: 'Pages read' });
    await expect(bar).toHaveAttribute('aria-valuenow', '44');
    await expect(bar).toHaveAttribute('aria-valuemax', '100');
    await expect(bar).toHaveAttribute('aria-valuetext', 'Reading 4 of 9 pages');
    await check(page, `sync-reading-${VIEWS[i].name}`);
  }

  for (const page of opened) {
    await expect(page.getByRole('heading', { name: 'Brain is ready' })).toBeVisible({ timeout: 90_000 });
    await expect(page.getByText(/couldn't be read/)).toHaveCount(0);
  }
  const stored = (await api(first, 'get', '/sandbox/fake-source/pages', { connection_id: connection })).items;
  expect(stored.filter((p) => !p.stored).map((p) => p.external_id), 'every page is read when setup says ready').toEqual([]);
});

test('the sync step can be left to carry on in the background', async ({ open }) => {
  test.setTimeout(150_000);
  const seeded = await seedState('spaces');
  const page = await open('admin', '/setup', { token: seeded.people.admin.refresh_tokens[0], before: confluenceFound });
  await configure(page, seeded.connection_id, { delay_ms: 3000 });
  await page.getByRole('button', { name: 'Include 3 spaces' }).click();
  await expect(page.getByRole('heading', { name: 'Brain is reading your spaces' })).toBeVisible({ timeout: INCLUDED });
  await expect(page.getByRole('button', { name: 'Leave setup for now' })).toHaveCount(0); // Continue replaces it
  let polls = 0;
  page.on('request', (r) => { if (r.url().includes('/v1/admin/containers?')) polls += 1; });
  await page.getByRole('button', { name: 'Continue in the background' }).click();
  await expect(page).toHaveURL(/\/$/);
  // Setup is not finished while the spaces are read, so the way back stays in the sidebar.
  await expect(page.getByRole('button', { name: 'Finish setup' }).first()).toBeAttached();
  // The step stopped watching the reads when it was left: let a few poll intervals pass.
  const before = polls;
  await page.waitForTimeout(5000);
  expect(polls - before, 'the sync step still polls after it was left').toBe(0);
  await readsFinished(page, seeded.connection_id); // they carry on without the step
});

test('reloading the sync step resumes the reads where they are', async ({ open }) => {
  test.setTimeout(120_000);
  const seeded = await seedState('spaces');
  const page = await open('admin', '/setup', { token: seeded.people.admin.refresh_tokens[0], before: confluenceFound });
  await configure(page, seeded.connection_id, { delay_ms: 6000 });
  await page.getByRole('checkbox', { name: 'Include Cards (CARD)' }).uncheck();
  await page.getByRole('checkbox', { name: 'Include Engineering (ENG)' }).uncheck();
  await page.getByRole('button', { name: 'Include 1 space' }).click();
  await expect(row(page, 'Payments (PAY)')).toContainText('0 of 4', { timeout: 30_000 });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Brain is reading your spaces' })).toBeVisible({ timeout: INCLUDED });
  await expect(row(page, 'Payments (PAY)')).toContainText('0 of 4');
  await expect(reading(page)).toContainText('Reading 0 of 4 pages');
  await expect(page.getByRole('heading', { name: 'Brain is ready' })).toBeVisible({ timeout: 60_000 });
});
