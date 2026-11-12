// Sync runs on the Connectors page (sync runs spec 3.1, 3.2, 3.4.1 and 3.5; plan C2): the
// connection card while Sync now runs and after, and each space row while its read runs.
//
// The worker reads the fake source (plan S0). A scenario slows its fetches down through
// /v1/sandbox/fake-source/configure, so every state stays on screen until the test has looked
// at it: the worker reads 4 pages at a time, each taking the delay, so with more pages than
// that, or with slots already busy, a run stops part way for a known while. Each state is
// checked at 1440 and 390 px, light and dark, by opening the page in every view once the state
// is reached. The failed-pages states are also rendered from given answers in admin.spec.mjs,
// so every view project has them; the last scenario here reaches them through real runs.
//
// Serial, in a project of its own: each scenario reseeds `ready` and changes what the shared
// database would show other scenarios (a run's outcome stays on the card).
import { expect, test } from './fixtures.mjs';
import { VIEWS } from '../../playwright.config.mjs';
import { restartApi, saveSeed, seed } from './stack.mjs';

test.describe.configure({ mode: 'serial' });

const SITE = 'kredete-e2e.atlassian.net';
const PATH = '/admin/connectors';

/** A fresh `ready` database, with admin sessions for every page a scenario opens. */
async function fresh() {
  const seeded = seed('ready', 16);
  saveSeed(seeded);
  await restartApi();
  const tokens = [...seeded.people.admin.refresh_tokens];
  return { connection: seeded.connection_id, token: () => tokens.shift() };
}
const call = (page, method, path, body) => page.evaluate(([m, p, b]) => window.BRAIN.api[m](p, b), [method, path, body]);
/** Changes the connection's fake source: `configure` (delay_ms, fail) or `edit` (external_id). */
const fake = (page, s, action, body) => call(page, 'post', `/sandbox/fake-source/${action}`, { connection_id: s.connection, ...body });

const card = (page) => page.locator('.cnconn').filter({ hasText: SITE });
const status = (page) => card(page).locator('.cnsync');
const syncNow = (page) => card(page).getByRole('button', { name: 'Sync now' });
// The Confluence card opens its connection and spaces in a dialog; until then they sit in a hidden holder.
const openSource = async (page) => { await page.locator('[data-src="confluence"]').click(); return page; };
// Only the connection's rows: the picker of spaces to include also has a [data-space] per space.
const row = (page, name) => page.locator('.dt-r[data-space]').filter({ hasText: name });
const spaceRun = (page, name) => row(page, name).locator('.cnsrun');
const toast = (page) => page.locator('#toast.on');

/** The page already open in the first view, and the Connectors page opened in each other view. */
async function everyView(open, s, first, options = {}) {
  const rest = await Promise.all(VIEWS.slice(1).map(async (view) => openSource(await open('admin', PATH, { view, token: s.token(), ...options }))));
  return [first, ...rest].map((page, i) => ({ view: VIEWS[i], page }));
}
/** Waits until every view shows the state, then compares each view's screenshot. */
async function shoot(check, views, name, shows) {
  for (const { page } of views) await shows(page);
  for (const { view, page } of views) await check(page, `${name}-${view.name}`);
}
async function closeOthers(views) {
  for (const { page } of views.slice(1)) await page.close();
}

test('Sync now checks for changes, and says when it found none', async ({ open, check }) => {
  test.setTimeout(240_000);
  const s = await fresh();
  // The fake source answers a check for changes at once, so the run is held at what Sync now
  // returned (still checking) until the test lets the next read of the connections through.
  let held = null;
  const hold = async (p) => {
    await p.route('**/v1/admin/connections/*/sync', async (route) => {
      const response = await route.fetch();
      held = await response.json();
      await route.fulfill({ response });
    });
    await p.route('**/v1/admin/connections', async (route) => {
      // Read `held` once: the test may release it while this read is in flight.
      const run = held;
      if (!run || route.request().method() !== 'GET') return route.fallback();
      const response = await route.fetch();
      const body = await response.json();
      body.items = body.items.map((c) => (c.id === run.connection_id ? { ...c, active_run: run } : c));
      return route.fulfill({ response, json: body });
    });
  };
  const page = await openSource(await open('admin', PATH, { view: VIEWS[0], token: s.token(), before: hold }));
  // The seed's first sync ran as the schedule runs it: no run, so only when it synced.
  await expect(status(page)).toHaveText(/^Synced (just now|\d+ min ago)$/);

  await syncNow(page).click();
  await expect(status(page)).toHaveText('Checking for changes…');
  await expect(syncNow(page)).toBeDisabled();
  await expect(card(page).getByRole('progressbar')).toHaveCount(0); // no page total yet
  const views = await everyView(open, s, page, { before: hold });
  await shoot(check, views, 'connectors-checking', (p) => expect(status(p)).toHaveText('Checking for changes…'));

  held = null;
  await expect(toast(page)).toHaveText(`${SITE} synced. No changes.`);
  await shoot(check, views, 'connectors-no-changes', async (p) => {
    await expect(status(p)).toHaveText('Synced just now · No changes');
    await expect(card(p).locator('.cnsync .tag')).toHaveCount(0); // a healthy read is muted text, not a tag
    await expect(syncNow(p)).toBeEnabled();
  });
  await closeOthers(views);
});

test('Sync now shows its progress, carries on after a reload, and says what it updated', async ({ open, check }) => {
  test.setTimeout(300_000);
  const s = await fresh();
  const page = await openSource(await open('admin', PATH, { view: VIEWS[0], token: s.token() }));
  // Five pages changed at the source: four are read together, the fifth after them.
  await fake(page, s, 'configure', { delay_ms: 30_000 });
  for (const id of ['pay-limits', 'pay-savings', 'pay-kyc', 'card-fees', 'eng-release']) await fake(page, s, 'edit', { external_id: id });

  await syncNow(page).click();
  await expect(syncNow(page)).toBeDisabled();
  await expect(syncNow(page).locator('.suspin')).toBeVisible();
  await expect(status(page)).toHaveText('Syncing 0 of 5 pages', { timeout: 30_000 });
  await expect(status(page)).toHaveText('Syncing 4 of 5 pages', { timeout: 60_000 });
  const bar = card(page).getByRole('progressbar');
  await expect(bar).toHaveAttribute('aria-valuenow', '80');
  await expect(bar).toHaveAttribute('aria-valuemin', '0');
  await expect(bar).toHaveAttribute('aria-valuemax', '100');
  const views = await everyView(open, s, page);
  await shoot(check, views, 'connectors-syncing', async (p) => {
    await expect(status(p)).toHaveText('Syncing 4 of 5 pages');
    await expect(syncNow(p)).toBeDisabled();
  });
  await closeOthers(views);

  // A reload picks the same run up again and follows it to the end. The Confluence page has its
  // own address, so the reload stays on it.
  await page.reload();
  await expect(page).toHaveURL(/\/admin\/sources\/confluence$/);
  await expect(status(page)).toHaveText('Syncing 4 of 5 pages');
  await expect(syncNow(page)).toBeDisabled();
  await expect(toast(page)).toHaveText(`${SITE} synced. 5 pages updated.`, { timeout: 60_000 });
  const done = await everyView(open, s, page);
  await shoot(check, done, 'connectors-synced', async (p) => {
    await expect(status(p)).toHaveText('Synced just now · 5 pages updated');
    await expect(card(p).getByRole('progressbar')).toHaveCount(0);
    await expect(card(p).getByText('Show failed pages')).toHaveCount(0);
    await expect(syncNow(p)).toBeEnabled();
  });
  await closeOthers(done);
});

test('each space being read shows its own progress, and a changed default reads it again', async ({ open, check }) => {
  test.setTimeout(420_000);
  const s = await fresh();
  const page = await openSource(await open('admin', PATH, { view: VIEWS[0], token: s.token() }));
  // The spaces start excluded, as before their first read.
  for (const name of ['Payments (PAY)', 'Cards (CARD)', 'Engineering (ENG)']) {
    await row(page, name).getByRole('checkbox').uncheck();
    await expect(row(page, name).getByRole('checkbox')).not.toBeChecked();
  }
  const stored = async () => (await call(page, 'get', '/sandbox/fake-source/pages', { connection_id: s.connection })).items.filter((p) => p.stored).length;
  await expect.poll(stored, { timeout: 60_000 }).toBe(0);

  // Cards' two pages hold two of the worker's four slots for a minute; Payments' four pages go
  // through the other two meanwhile, two at a time; Engineering waits to be listed until a
  // slot frees.
  await fake(page, s, 'configure', { delay_ms: 60_000 }); // the most the fake source allows
  await row(page, 'Cards (CARD)').getByRole('checkbox').check();
  await expect(spaceRun(page, 'Cards (CARD)')).toHaveText('0 of 2', { timeout: 30_000 });
  await fake(page, s, 'configure', { delay_ms: 25_000 });
  await row(page, 'Payments (PAY)').getByRole('checkbox').check();
  await expect(spaceRun(page, 'Payments (PAY)')).toHaveText('0 of 4', { timeout: 30_000 });
  await row(page, 'Engineering (ENG)').getByRole('checkbox').check();
  await expect(spaceRun(page, 'Engineering (ENG)')).toHaveText('Listing pages…');
  const views = await everyView(open, s, page);
  await shoot(check, views, 'connectors-space-reading', async (p) => {
    await expect(spaceRun(p, 'Engineering (ENG)')).toHaveText('Listing pages…');
    await expect(spaceRun(p, 'Payments (PAY)')).toHaveText('0 of 4');
    await expect(row(p, 'Payments (PAY)').getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
    await expect(spaceRun(p, 'Cards (CARD)')).toHaveText('0 of 2');
  });
  await shoot(check, views, 'connectors-space-progress', async (p) => {
    await expect(spaceRun(p, 'Payments (PAY)')).toHaveText('2 of 4', { timeout: 60_000 });
    await expect(row(p, 'Payments (PAY)').getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');
    await expect(spaceRun(p, 'Cards (CARD)')).toHaveText('0 of 2');
    await expect(spaceRun(p, 'Engineering (ENG)')).toHaveText('Listing pages…');
  });
  // The connection card shows Sync now runs only.
  await expect(status(page)).toHaveText(/^Synced (just now|\d+ min ago)$/);
  await fake(page, s, 'configure', { delay_ms: 0 });
  await shoot(check, views, 'connectors-space-done', async (p) => {
    await expect(spaceRun(p, 'Payments (PAY)')).toHaveText('4 pages', { timeout: 180_000 });
    await expect(spaceRun(p, 'Engineering (ENG)')).toHaveText('3 pages', { timeout: 180_000 });
    await expect(spaceRun(p, 'Cards (CARD)')).toHaveText('2 pages', { timeout: 180_000 });
    await expect(row(p, 'Cards (CARD)').locator('.cnok svg')).toBeVisible();
    // The first reads have finished, so setup is done: nothing offers to finish it any more.
    await expect(p.getByText('Finish setup', { exact: true })).toHaveCount(0);
  });
  await closeOthers(views);

  // Changing a space's defaults reads it again, and its row follows that read.
  await fake(page, s, 'configure', { delay_ms: 5000 });
  await row(page, 'Payments (PAY)').getByRole('button', { name: 'Settings for Payments (PAY)' }).click();
  const drawer = page.getByRole('dialog', { name: 'Space settings, Payments (PAY)' });
  await drawer.getByRole('button', { name: 'Default authority' }).click();
  await page.getByRole('option', { name: 'Draft' }).click();
  await drawer.getByRole('button', { name: 'Save' }).click();
  await expect(toast(page)).toHaveText('Saved. Broth re-reads this space now.');
  await expect(spaceRun(page, 'Payments (PAY)')).toHaveText(/^(Listing pages…|[0-3] of 4)$/);
  await expect(spaceRun(page, 'Payments (PAY)')).toHaveText('4 pages', { timeout: 60_000 });
});

// The fake source fails a page on every fetch; the worker gives up on it after 5 tries and the
// run ends partial, until a later sync reads it.
test('Sync now lists the pages it could not read, until a later sync reads them', async ({ open }) => {
  test.setTimeout(300_000);
  const s = await fresh();
  const page = await openSource(await open('admin', PATH, { view: VIEWS[0], token: s.token() }));
  await fake(page, s, 'configure', { delay_ms: 0, fail: ['card-faq'] });
  for (const id of ['pay-limits', 'card-faq']) await fake(page, s, 'edit', { external_id: id });
  await syncNow(page).click();
  await expect(toast(page)).toHaveText(`${SITE} synced. 1 page couldn't be read.`, { timeout: 120_000 });
  await expect(status(page)).toHaveText('Synced, 1 failed just now · 1 page updated');
  await card(page).getByText('Show failed pages').click();
  await expect(card(page).locator('.cnflist li')).toHaveText(['Cards FAQThe source returned an error for this page']);
  await fake(page, s, 'configure', { fail: [] });
  await syncNow(page).click();
  await expect(toast(page)).toHaveText(`${SITE} synced. 1 page updated.`, { timeout: 60_000 });
  await expect(card(page).getByText('Show failed pages')).toHaveCount(0);
});
