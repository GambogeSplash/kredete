// Surfaces follow roles, and the admin screens (sandbox spec 6.2: the People screen; surfaces
// following roles; plan C7, C8). Changes stay on people no other scenario reads: Finn (no
// Confluence account) and Sam's unlinked Confluence account.
import { expect, test } from './fixtures.mjs';
import { BASE } from './stack.mjs';

const phone = (page) => page.viewportSize().width < 900;
/** The Settings rail's items; a phone leaves Sign out to the profile menu. */
const railItems = (page, items) => (phone(page) ? items : [...items, 'Sign out']);
/** The places: the menu on a phone, the icon rail on a desktop (the sidebar's list of places is hidden there). */
async function nav(page) {
  if (phone(page)) {
    await page.getByRole('button', { name: 'Open menu' }).click();
    return page.locator('#surfaces');
  }
  return page.locator('#rail');
}
async function profileMenu(page) {
  await nav(page);
  await page.getByRole('button', { name: 'Account', exact: true }).click();
  return page.getByRole('menu');
}

test.describe('surfaces follow roles', () => {
  test('an employee asks, reads and follows requests, and nothing more', async ({ open, check }) => {
    // The profile menu opens over the chat list; an empty list keeps the screenshot unmasked there.
    const page = await open('employee', '/', {
      before: (p) => p.route(/\/v1\/conversations\?/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"items":[],"next_cursor":null}' })),
    });
    const surfaces = await nav(page);
    await expect(surfaces.getByRole('button', { name: 'Library' })).toBeVisible();
    await expect(surfaces.getByRole('button', { name: 'Governance' })).toBeVisible();
    await expect(surfaces.getByRole('button', { name: 'Admin' })).toHaveCount(0);
    await expect(surfaces.getByRole('button', { name: 'Support agent' })).toHaveCount(0);
    if (phone(page)) await page.getByRole('button', { name: 'Close menu' }).click();
    const menu = await profileMenu(page);
    await expect(menu.getByRole('menuitem', { name: 'Settings' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: /admin/i })).toHaveCount(0);
    await check(page, 'menu-employee', { mask: ['.lh-t'], chats: true });
    // Settings holds only their own account: no Administration group, not even an empty one.
    await menu.getByRole('menuitem', { name: 'Settings' }).click();
    await expect(page).toHaveURL(/\/account$/);
    const rail = page.getByRole('navigation', { name: 'Settings' });
    await expect(rail.getByRole('button')).toHaveText(railItems(page, ['Profile', 'Sessions']));
    await expect(rail).not.toContainText('Administration');
    for (const path of ['/admin', '/admin/people', '/support-agent', '/setup']) {
      await page.evaluate((p) => window.BRAIN.go(p), path);
      await expect(page).toHaveURL(/\/$/);
    }
  });

  test('compliance sees Audit only: no other admin screen and no Support agent', async ({ open, check }) => {
    const page = await open('compliance', '/admin/people');
    await expect(page).toHaveURL(/\/admin\/audit$/);
    const rail = page.getByRole('navigation', { name: 'Settings' });
    const items = railItems(page, ['Profile', 'Sessions', 'Audit log']);
    await expect(rail.getByRole('button')).toHaveText(items);
    await page.getByRole('button', { name: 'Filter' }).click();
    await page.getByRole('button', { name: 'Action' }).click();
    await page.getByRole('option', { name: 'Sharing requested' }).click();
    await page.getByRole('button', { name: 'Show results' }).click();
    // The pending request, and the two the seed made for the Help centre bot's Public pages.
    await expect(page.locator('#audt .aud-r:not(.aud-h)')).toHaveCount(3);
    await expect(page.locator('#audt .audact')).toHaveText(Array(3).fill('Sharing requested'));
    await check(page, 'audit-compliance');
    const places = await nav(page);
    await expect(places.getByRole('button', { name: 'Support agent' })).toHaveCount(0);
    if (phone(page)) await page.getByRole('button', { name: 'Close menu' }).click();
    const menu = await profileMenu(page);
    // Their own Profile shows the same rail: only the admin screens their role allows.
    await menu.getByRole('menuitem', { name: 'Settings' }).click();
    await expect(page).toHaveURL(/\/account$/);
    await expect(rail.getByRole('button')).toHaveText(items);
    // The bot admin API is admin only, and so are its screens (bot admin spec 4.1).
    await page.keyboard.press('Escape');
    await page.evaluate(() => window.BRAIN.go('/support-agent'));
    await expect(page).not.toHaveURL(/\/support-agent/);
  });

  test('a developer has Sources and the Support agent, and no other admin screen', async ({ open }) => {
    // Developer role spec 3.5; developer.spec.mjs walks through each screen. Support agent is a rail place.
    const page = await open('developer', '/');
    const surfaces = await nav(page);
    await surfaces.getByRole('button', { name: 'Support agent' }).click();
    await expect(page).toHaveURL(/\/support-agent$/);
    for (const path of ['/admin', '/admin/people', '/admin/domains', '/admin/audit']) {
      await page.evaluate((p) => window.BRAIN.go(p), path);
      await expect(page).toHaveURL(/\/admin\/sources$/);
    }
  });

  test('an admin has every admin screen, under one Settings with one rail', async ({ open }) => {
    const page = await open('admin', '/admin');
    await expect(page).toHaveURL(/\/admin\/workspace$/);
    const items = railItems(page, ['Profile', 'Sessions', 'Workspace', 'People and access', 'Sources', 'Domains', 'Audit log']);
    const rail = page.getByRole('navigation', { name: 'Settings' });
    // The same rail on every settings page, however it was reached; only the current item moves.
    for (const [path, current] of [['/account', 'Profile'], ['/account/sessions', 'Sessions'], ['/admin/people', 'People and access'], ['/admin/sources', 'Sources'], ['/admin/audit', 'Audit log']]) {
      await page.evaluate((p) => window.BRAIN.go(p), path);
      await expect(rail.getByRole('button')).toHaveText(items);
      await expect(rail.locator('[aria-current="page"]')).toHaveText(current);
      if (!phone(page)) await expect(page.locator('#crumb')).toContainText(`Settings›${current}`);
    }
    const menu = await profileMenu(page);
    await expect(menu.getByRole('menuitem', { name: 'Settings' })).toHaveCount(1);
    await expect(menu.getByRole('menuitem', { name: /admin/i })).toHaveCount(0);
    // The profile menu keeps to the account: Support agent and Docs are places on the rail.
    await expect(menu.locator('.pm-i')).toHaveText(['Settings', 'Sign out']);
  });

  test('compliance cannot open Domains by its address', async ({ open }) => {
    const page = await open('compliance', '/admin/domains');
    await expect(page).toHaveURL(/\/admin\/audit$/);
  });
});

/* Domains. Writes are answered here, not by the API: tests in a view share one seed and run
   in parallel, and what the client sends is what these tests check (the API side is covered
   by broth-service's integration tests). */
test.describe('domains', () => {
  // The seeded tree (nested domains plan N6.2): Cards and Engineering at the top level, and
  // Payments holding Collections and Payouts, which holds Cross-border. Dami Bello owns Payments.
  // Writes are answered here, so the shared tree stays as every other test expects.
  const DOMAINS = '**/v1/admin/domains';
  const captured = (page, pattern, method, reply) => {
    const bodies = [];
    return page.route(pattern, async (route) => {
      if (route.request().method() !== method) return route.fallback();
      bodies.push({ url: route.request().url(), body: route.request().postDataJSON() });
      return route.fulfill(await reply(route, bodies));
    }).then(() => bodies);
  };
  const row = (page, name) => page.locator('[data-domain]').filter({ has: page.locator('.dmname b', { hasText: new RegExp(`^${name}$`) }) });
  const idOf = (page, name) => row(page, name).getAttribute('data-domain');
  /** A DomainOut the API would send back. */
  const domainOut = (fields) => ({ parent_id: null, document_count: 0, total_count: 0, owners: [], inherited_owners: [], ...fields });
  const problem = (detail) => ({
    status: 422,
    contentType: 'application/problem+json',
    json: { type: 'urn:broth:problem:validation_error', title: 'Validation error', status: 422, code: 'validation_error', detail },
  });

  test('lists the domains as a tree, with their labels, owners and pages', async ({ open, check }) => {
    const page = await open('admin', '/admin/domains');
    await expect(page.locator('[data-domain] .dmname b')).toHaveText(['Cards', 'Engineering', 'Payments', 'Collections', 'Payouts', 'Cross-border']);
    expect(await page.locator('[data-domain]').evaluateAll((rows) => rows.map((r) => r.dataset.depth))).toEqual(['0', '0', '0', '1', '1', '2']);
    const payments = row(page, 'Payments');
    await expect(payments.locator('code')).toHaveText('broth-domain-payments');
    await expect(payments.locator('.tag')).toHaveText(['Dami Bello']);
    await expect(payments.locator('.dmpages')).toHaveText(/^2.*4 in total$/);
    await expect(row(page, 'Payouts').locator('.dmpages')).toHaveText(/^0.*1 in total$/);
    await expect(row(page, 'Cards').locator('.dmtotal')).toHaveCount(0); // no sub-domains, no total
    const inherited = row(page, 'Cross-border').locator('.tag.dminh');
    await expect(inherited).toHaveText('Dami Bello, owns Payments');
    await expect(inherited).toHaveAttribute('title', 'Owns Payments');
    await check(page, 'domains');
  });

  test('a new domain suggests its label from the name, and can go inside another', async ({ open, check }) => {
    const page = await open('admin', '/admin/domains');
    const payouts = await idOf(page, 'Payouts');
    const created = await captured(page, DOMAINS, 'POST', (route) => ({
      status: 201,
      json: domainOut({ id: '00000000-0000-4000-8000-0000000000d1', slug: 'card-disputes', name: 'Card Disputes', ...route.request().postDataJSON() }),
    }));
    await page.getByRole('button', { name: 'New domain' }).click();
    await page.getByRole('textbox', { name: 'Name' }).fill('Card Disputes');
    await expect(page.getByRole('textbox', { name: 'Label' })).toHaveValue('card-disputes');
    await expect(page.locator('#dmparent')).toHaveValue(''); // the top level unless chosen
    await check(page, 'domains-new');
    await page.locator('#dmparent').selectOption(payouts);
    await page.getByRole('button', { name: 'Create' }).click();
    const added = row(page, 'Card Disputes');
    await expect(added.locator('code')).toHaveText('broth-domain-card-disputes');
    await expect(added).toHaveAttribute('data-depth', '2'); // under Payouts, under Payments
    expect(created.map((c) => c.body)).toEqual([{ name: 'Card Disputes', slug: 'card-disputes', parent_id: payouts }]);
    const names = await page.locator('[data-domain] .dmname b').allTextContents();
    expect(names.indexOf('Card Disputes')).toBe(names.indexOf('Payouts') + 1); // listed inside Payouts, before Cross-border
  });

  test('the Parent picker shows the tree and never the domain itself or anything inside it', async ({ open }) => {
    const page = await open('admin', '/admin/domains');
    await row(page, 'Payouts').click();
    const options = page.locator('#dmparent option');
    await expect(options).toHaveText(['None (top level)', 'Cards', 'Engineering', 'Payments', 'Collections']);
    await expect(page.locator('#dmparent')).toHaveValue(await idOf(page, 'Payments'));
    await expect(page.getByRole('dialog').locator('.ssel-btn')).toHaveText('Payments');
    await page.locator('[data-close-modal]').first().click();

    await row(page, 'Cross-border').click();
    await expect(page.getByRole('dialog').locator('.ssel-btn')).toHaveText('Payments / Payouts'); // the full path, once chosen
    await page.getByRole('dialog').locator('.ssel-btn').click();
    await expect(page.locator('.ssel-menu .ssel-o')).toHaveText(['None (top level)', 'Cards', 'Engineering', 'Payments', 'Collections', 'Payouts']);
    await expect(page.locator('.ssel-menu .ssel-o').filter({ hasText: 'Collections' })).toHaveAttribute('style', '--depth:1');
  });

  test('a move the server refuses says why, and moving saves only the parent', async ({ open }) => {
    const page = await open('admin', '/admin/domains');
    const cards = await idOf(page, 'Cards');
    const moves = await captured(page, `${DOMAINS}/*`, 'PATCH', (route, bodies) => (bodies.length === 1
      ? problem('domains can be nested up to 6 levels')
      : { json: domainOut({ id: route.request().url().split('/').pop(), slug: 'payouts', name: 'Payouts', parent_id: cards }) }));
    await row(page, 'Payouts').click();
    const dialog = page.getByRole('dialog', { name: 'Edit Payouts' });
    await dialog.locator('#dmparent').selectOption(cards);
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog.getByRole('alert')).toHaveText('Domains can be nested up to 6 levels');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(page.locator('#toast')).toContainText('Saved');
    expect(moves.map((c) => c.body)).toEqual([{ parent_id: cards }, { parent_id: cards }]);
  });

  test("an inherited owner is ticked and fixed in the domain's owners, and never granted again", async ({ open }) => {
    const page = await open('admin', '/admin/domains');
    const roles = await captured(page, '**/v1/admin/users/*/roles', 'PUT', () => ({ json: {} }));
    const renamed = await captured(page, `${DOMAINS}/*`, 'PATCH', (route) => ({ json: domainOut({ id: route.request().url().split('/').pop(), slug: 'cross-border', name: 'Cross-border payouts' }) }));
    await row(page, 'Cross-border').click();
    const dialog = page.getByRole('dialog', { name: 'Edit Cross-border' });
    const dami = dialog.getByRole('checkbox', { name: /Dami Bello/ });
    await expect(dami).toBeChecked();
    await expect(dami).toBeDisabled();
    await expect(dialog.locator('.ppck').filter({ hasText: 'Dami Bello' })).toContainText('Owns Payments');
    await dialog.getByRole('textbox', { name: 'Name' }).fill('Cross-border payouts');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(page.locator('#toast')).toContainText('Saved');
    expect(renamed.map((c) => c.body)).toEqual([{ name: 'Cross-border payouts' }]); // the parent stays
    expect(roles).toEqual([]);
  });

  test('renaming and changing owners keeps everyone\'s other roles', async ({ open, check }) => {
    const page = await open('admin', '/admin/domains');
    const renamed = await captured(page, `${DOMAINS}/*`, 'PATCH', (route) => ({
      json: domainOut({ id: route.request().url().split('/').pop(), slug: 'payments', name: 'Payments and Transfers' }),
    }));
    const roles = await captured(page, '**/v1/admin/users/*/roles', 'PUT', () => ({ json: {} }));
    await row(page, 'Payments').click();
    const dialog = page.getByRole('dialog', { name: 'Edit Payments' });
    await expect(dialog.getByRole('checkbox', { name: 'Dami Bello' })).toBeChecked();
    await check(page, 'domains-edit');
    await dialog.getByRole('textbox', { name: 'Name' }).fill('Payments and Transfers');
    await dialog.getByRole('checkbox', { name: 'Dami Bello' }).uncheck();
    await dialog.getByRole('checkbox', { name: 'Kofi Asante' }).check();
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(page.locator('#toast')).toContainText('Saved');
    expect(renamed.map((c) => c.body)).toEqual([{ name: 'Payments and Transfers' }]);
    const byRoles = roles.map((c) => c.body.roles.map((r) => r.role).sort());
    // Kofi keeps Developer and gains Payments; Dami loses Payments and keeps nothing else.
    expect(byRoles.sort()).toEqual([[], ['developer', 'domain_owner']]);
  });

  test('a move shows in the Library straight away, with no reload', async ({ open }) => {
    // After a save the tab reads the facets again; here they answer as the server would once
    // Cross-border moved from inside Payouts to directly inside Payments.
    let moved = false;
    const page = await open('admin', '/admin/domains', {
      before: (p) => p.route('**/v1/facets', async (route) => {
        const response = await route.fetch().catch(() => null); // a read can outlive the test
        if (!response) return undefined;
        const body = await response.json();
        if (!moved) return route.fulfill({ response, json: body });
        const payments = body.domains.find((d) => d.value === 'payments');
        const domains = body.domains.filter((d) => d.value !== 'payouts').map((d) => (d.value === 'cross-border' ? { ...d, parent_id: payments.id } : d));
        return route.fulfill({ response, json: { ...body, domains } });
      }),
    });
    const payments = await idOf(page, 'Payments');
    await captured(page, `${DOMAINS}/*`, 'PATCH', (route) => ({ json: domainOut({ id: route.request().url().split('/').pop(), slug: 'cross-border', name: 'Cross-border', parent_id: payments }) }));
    await row(page, 'Cross-border').click();
    await page.getByRole('dialog').locator('#dmparent').selectOption(payments);
    moved = true;
    const reread = page.waitForResponse('**/v1/facets');
    await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
    await reread;
    await page.evaluate(() => window.BRAIN.go('/library/payments'));
    await expect(page.locator('#libbody [data-folder] .ltb b')).toHaveText(['Cross-border']);
  });

  test('with no domains, the tab explains what they are for', async ({ open, check }) => {
    const page = await open('admin', '/admin/domains', {
      before: (p) => p.route(DOMAINS, (route) => (route.request().method() === 'GET' ? route.fulfill({ json: { items: [], next_cursor: null } }) : route.fallback())),
    });
    await expect(page.locator('.ds-empty').getByText('No domains yet')).toBeVisible();
    await check(page, 'domains-empty');
  });
});

test.describe('connectors', () => {
  // Each source is a card: a connected one opens its own page, the others a dialog (their sections sit in a hidden holder until then).
  const openSource = async (page, key = 'confluence') => { await page.locator(`[data-src="${key}"]`).click(); return page; };
  test('the Confluence connection, its spaces, Google Drive and the app credentials', async ({ open, check }) => {
    const page = await open('admin', '/admin/sources');
    await openSource(page);
    await expect(page.getByRole('heading', { name: 'Confluence' })).toBeVisible();
    await expect(page.locator('.dt-r[data-space]')).toHaveCount(3);
    // Both OAuth clients are configured; the GitHub App is not, in the seed.
    for (const name of ['confluence_oauth', 'google_oauth']) await expect(page.locator(`.cnc[data-cred="${name}"] .frv`)).toHaveText(/^Configured · /);
    // The seed synced the connection as the schedule does, which starts no run (sync runs
    // spec 2): the card says only when it synced, with no run status, bar or failed pages.
    const connection = page.locator('.cnconn').first();
    await expect(connection.locator('.cnsync')).toHaveText(/^Synced (just now|\d+ min ago)$/);
    await expect(connection.locator('.cnsync .tag, .cnsync .suspin')).toHaveCount(0);
    await expect(connection.getByRole('progressbar')).toHaveCount(0);
    await expect(connection.getByText('Show failed pages')).toHaveCount(0);
    await expect(connection.locator('.cnsrun')).toHaveText(['', '', '']); // no space has a read of its own
    await expect(connection.getByRole('button', { name: 'Sync now' })).toBeEnabled();
    await check(page, 'connectors');
    // A connected source is its own page; back on Sources, the others open in a dialog.
    await page.evaluate(() => window.BRAIN.go('/admin/sources'));
    await openSource(page, 'gdrive');
    await expect(page.getByRole('dialog', { name: 'Google Drive' })).toContainText('Google Drive needs a Google Workspace account');
    await page.keyboard.press('Escape');
    await openSource(page, 'creds');
    await expect(page.getByRole('dialog', { name: 'App credentials' })).toBeVisible();
    await check(page, 'connectors-credentials');
  });

  test('an authorized connection can be authorized again, and personal spaces read as such', async ({ open }) => {
    const page = await open('admin', '/admin/sources', {
      before: (p) => p.route('**/v1/admin/containers', async (route) => {
        const response = await route.fetch();
        const body = await response.json();
        const personal = { ...body.items[0], id: '00000000-0000-4000-8000-0000000000b1', external_id: 'me', path: 'Ada Okafor (~5f1e2d3c4b5a69788796a5b4)', included: false, owner_user_id: null };
        await route.fulfill({ response, json: { ...body, items: [...body.items, personal] } });
      }),
    });
    await openSource(page);
    const connection = page.locator('.cnconn').first();
    await expect(connection.getByRole('button', { name: 'Re-authorize' })).toBeVisible();
    await expect(connection.getByText('Ada Okafor (personal space)')).toBeVisible();
    await expect(connection.getByText(/~5f1e2d3c/)).toHaveCount(0);
  });

  test("a space's default domain is chosen from the tree, each shown with its path (nested domains spec 4.6)", async ({ open }) => {
    const page = await open('admin', '/admin/sources');
    await openSource(page);
    await page.getByRole('button', { name: 'Settings for Engineering (ENG)' }).click();
    const drawer = page.getByRole('dialog', { name: 'Space settings, Engineering (ENG)' });
    await expect(drawer.getByRole('button', { name: 'Default domain' })).toHaveText('No domain');
    await drawer.getByRole('button', { name: 'Default domain' }).click();
    const options = page.locator('.ssel-menu .ssel-o');
    await expect(options).toHaveText(['No domain', 'Cards', 'Engineering', 'Payments', 'Collections', 'Payouts', 'Cross-border']);
    await expect(options.filter({ hasText: 'Cross-border' })).toHaveAttribute('style', '--depth:2');
    await page.getByRole('option', { name: 'Cross-border' }).click();
    await expect(drawer.getByRole('button', { name: 'Default domain' })).toHaveText('Payments / Payouts / Cross-border');
  });

  test("beside a space's settings the page stays usable, and a click on it keeps the edits", async ({ open }, info) => {
    test.skip(info.project.use.viewport.width < 900, 'a phone opens a sheet over the page');
    const page = await open('admin', '/admin/sources');
    await openSource(page);
    await page.getByRole('button', { name: 'Settings for Payments (PAY)' }).click();
    const drawer = page.getByRole('dialog', { name: 'Space settings, Payments (PAY)' });
    await drawer.getByRole('spinbutton', { name: 'Review interval in months' }).fill('7');
    await expect(page.locator('.mainpanel')).not.toHaveAttribute('inert', '');
    await page.getByRole('heading', { name: 'Confluence' }).click();
    await expect(drawer.getByRole('spinbutton', { name: 'Review interval in months' })).toHaveValue('7');
    await page.getByRole('button', { name: 'Settings for Engineering (ENG)' }).click();
    await expect(page.getByRole('dialog', { name: 'Space settings, Engineering (ENG)' })).toBeVisible();
  });

  test("a space's settings save only what changed, and Broth re-reads it", async ({ open, check }) => {
    const sent = [];
    const page = await open('admin', '/admin/sources', {
      before: (p) => p.route('**/v1/admin/containers/*', async (route) => {
        if (route.request().method() !== 'PATCH') return route.fallback();
        const change = route.request().postDataJSON();
        sent.push(change);
        const listed = await (await route.fetch({ method: 'GET', url: route.request().url().replace(/\/[^/]+$/, '') })).json();
        const space = listed.items.find((s) => route.request().url().endsWith(s.id));
        return route.fulfill({ json: { ...space, ...change } });
      }),
    });
    await openSource(page);
    await page.getByRole('button', { name: 'Settings for Payments (PAY)' }).click();
    const drawer = page.getByRole('dialog', { name: 'Space settings, Payments (PAY)' });
    await expect(drawer.getByRole('button', { name: 'Default authority' })).toBeVisible();
    await check(page, 'space-settings');
    await drawer.getByRole('button', { name: 'Default authority' }).click();
    await page.getByRole('option', { name: 'Draft' }).click();
    await drawer.getByRole('spinbutton', { name: 'Review interval in months' }).fill('7');
    await drawer.getByRole('button', { name: 'Save' }).click();
    await expect(page.locator('#toast')).toContainText('Saved. Broth re-reads this space now.');
    expect(sent).toEqual([{ default_authority: 'draft', review_interval_months: 7 }]);
  });

  test("a space's settings explain what they cannot save", async ({ open }) => {
    const sent = [];
    const page = await open('admin', '/admin/sources', {
      before: (p) => p.route('**/v1/admin/containers/*', (route) => {
        if (route.request().method() !== 'PATCH') return route.fallback();
        sent.push(route.request().postDataJSON());
        return route.fulfill({ status: 422, contentType: 'application/problem+json', json: { type: 'urn:broth:problem:validation_error', title: 'Validation error', status: 422, code: 'validation_error', detail: 'the default domain does not exist' } });
      }),
    });
    await openSource(page);
    await page.getByRole('button', { name: 'Settings for Cards (CARD)' }).click();
    const drawer = page.getByRole('dialog', { name: 'Space settings, Cards (CARD)' });
    await drawer.getByRole('spinbutton', { name: 'Review interval in months' }).fill('0');
    await drawer.getByRole('button', { name: 'Save' }).click();
    await expect(drawer.getByRole('alert')).toHaveText('The review interval is a whole number of months, from 1 to 120');
    expect(sent).toEqual([]);
    await drawer.getByRole('spinbutton', { name: 'Review interval in months' }).fill('3');
    await drawer.getByRole('button', { name: 'Save' }).click();
    await expect(drawer.getByRole('alert')).toHaveText('the default domain does not exist');
  });

  test('a connection says what to fix about the indexer group', async ({ open, check }) => {
    const page = await open('admin', '/admin/sources', {
      before: (p) => p.route('**/v1/admin/connections', async (route) => {
        if (route.request().method() !== 'GET') return route.fallback();
        const response = await route.fetch();
        const body = await response.json();
        body.items = body.items.map((c) => (c.system === 'confluence' ? { ...c, warnings: { indexer_group_members: { group: 'broth-indexer', members: ['Kofi Asante', 'Eve Mensah'] } } } : c));
        return route.fulfill({ response, json: body });
      }),
    });
    await openSource(page);
    await expect(page.locator('.cnwarn')).toHaveText('Only the indexer account should be in broth-indexer. Also in it: Kofi Asante, Eve Mensah. How to fix it');
    await expect(page.locator('.cnwarn').getByRole('link', { name: 'How to fix it' })).toHaveAttribute('href', '/help/setting-up-spaces#warn-indexer-group-members');
    await check(page, 'connection-warnings');
  });

  test('a connection says when the indexer group is missing', async ({ open }) => {
    const page = await open('admin', '/admin/sources', {
      before: (p) => p.route('**/v1/admin/connections', async (route) => {
        if (route.request().method() !== 'GET') return route.fallback();
        const response = await route.fetch();
        const body = await response.json();
        body.items = body.items.map((c) => (c.system === 'confluence' ? { ...c, warnings: { indexer_group_missing: { group: 'broth-indexer' } } } : c));
        return route.fulfill({ response, json: body });
      }),
    });
    await openSource(page);
    await expect(page.locator('.cnwarn')).toHaveText('Create a broth-indexer group containing only the indexer account, so restricted pages can opt in. How to fix it');
    await expect(page.locator('.cnwarn').getByRole('link', { name: 'How to fix it' })).toHaveAttribute('href', '/help/setting-up-spaces#warn-indexer-group-missing');
  });

  test('failed pages load a page at a time when the list opens', async ({ open }) => {
    // A finished run with more failed pages than one page of the list holds.
    const pages = [
      { items: [1, 2].map((i) => ({ external_id: `p${i}`, title: `Quarterly report ${i}`, url: `https://kredete-e2e.atlassian.net/wiki/p${i}`, error: 'The source did not respond', change: 'content' })), next_cursor: 'next' },
      { items: [{ external_id: 'p3', title: null, url: null, error: null, change: 'content' }], next_cursor: null },
    ];
    const asked = [];
    const page = await open('admin', '/admin/sources', {
      before: async (p) => {
        await p.route('**/v1/admin/connections', async (route) => {
          if (route.request().method() !== 'GET') return route.fallback();
          const response = await route.fetch();
          const body = await response.json();
          const at = new Date().toISOString();
          body.items = body.items.map((c) => (c.system !== 'confluence' ? c : { ...c, last_run: {
            id: '00000000-0000-4000-8000-0000000000d1', trigger: 'manual', status: 'partial', connection_id: c.id, container_id: null,
            tasks_total: 2, tasks_done: 2, pages_total: 12, pages_done: 9, pages_failed: 3, failing: 3, updated: 9, removed: 0,
            started_at: at, finished_at: at, error: null,
          } }));
          return route.fulfill({ response, json: body });
        });
        await p.route('**/v1/admin/sync-runs/*/failures?*', (route) => {
          const cursor = new URL(route.request().url()).searchParams.get('cursor');
          asked.push(cursor);
          return route.fulfill({ json: pages[cursor ? 1 : 0] });
        });
      },
    });
    await openSource(page);
    const connection = page.locator('.cnconn').first();
    await expect(connection.locator('.cnsync')).toHaveText(/^Synced, 3 failed (just now|\d+ min ago)\s·\s9\spages updated$/);
    expect(asked).toEqual([]); // nothing is fetched until the list opens
    await connection.getByText('Show failed pages').click();
    await expect(connection.locator('.cnflist li')).toHaveCount(2);
    await connection.getByRole('button', { name: 'Show more' }).click();
    await expect(connection.locator('.cnflist li')).toHaveCount(3);
    await expect(connection.getByRole('button', { name: 'Show more' })).toHaveCount(0);
    // A page the source gave no title, link or reason for still reads as a failed page.
    await expect(connection.locator('.cnflist li').nth(2)).toHaveText("p3Couldn't read this page");
    await expect(connection.getByRole('link', { name: 'Open Quarterly report 1 in Confluence' })).toHaveAttribute('href', 'https://kredete-e2e.atlassian.net/wiki/p1');
    // Closing and opening again keeps what was loaded.
    await connection.getByText('Hide failed pages').click();
    await connection.getByText('Show failed pages').click();
    await expect(connection.locator('.cnflist li')).toHaveCount(3);
    expect(asked).toEqual([null, 'next']);
  });

  // Runs that ended with failed pages, or failed, as the API reports them (sync runs spec 6).
  // The e2e stack cannot end a run that way yet (see sync.spec.mjs), so the tests give them.
  const run = (fields) => {
    const at = new Date().toISOString();
    return {
      id: '00000000-0000-4000-8000-0000000000e1', trigger: 'manual', status: 'succeeded', connection_id: '', container_id: null,
      tasks_total: 2, tasks_done: 2, pages_total: 0, pages_done: 0, pages_failed: 0, failing: 0, updated: 0, removed: 0,
      started_at: at, finished_at: at, error: null, ...fields,
    };
  };
  /** Gives the Confluence connection and its spaces the runs `change` returns. */
  const withRuns = (p, { connection = (c) => c, space = (s) => s, failures = [] }) => Promise.all([
    p.route('**/v1/admin/connections', async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      const response = await route.fetch();
      const body = await response.json();
      body.items = body.items.map((c) => (c.system === 'confluence' ? connection(c) : c));
      return route.fulfill({ response, json: body });
    }),
    p.route('**/v1/admin/containers', async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      const response = await route.fetch();
      const body = await response.json();
      body.items = body.items.map(space);
      return route.fulfill({ response, json: body });
    }),
    p.route('**/v1/admin/sync-runs/*/failures?*', (route) => route.fulfill({ json: { items: failures, next_cursor: null } })),
  ]);
  const FAILED = [
    { external_id: 'pay-limits', title: 'Transfer limits policy', url: 'https://kredete-e2e.atlassian.net/wiki/spaces/PAY/pages/pay-limits', error: 'The source did not respond', change: 'content' },
    { external_id: 'card-faq', title: 'Cards FAQ: replacement, freezing and limits for every card we issue', url: 'https://kredete-e2e.atlassian.net/wiki/spaces/CARD/pages/card-faq', error: 'The source returned an error for this page', change: 'content' },
  ];

  test('a sync that could not read some pages says how many, and lists them', async ({ open, check }) => {
    const page = await open('admin', '/admin/sources', {
      before: (p) => withRuns(p, {
        connection: (c) => ({ ...c, last_run: run({ connection_id: c.id, status: 'partial', pages_total: 9, pages_done: 7, pages_failed: 2, failing: 2, updated: 6, removed: 1 }) }),
        failures: FAILED,
      }),
    });
    await openSource(page);
    const connection = page.locator('.cnconn').first();
    await expect(connection.locator('.cnsync')).toHaveText(/^Synced, 2 failed (just now|\d+ min ago)\s·\s6\spages updated, 1\sremoved$/);
    await expect(connection.locator('.cnsync .tag.warn')).toHaveText('Synced, 2 failed');
    await connection.getByText('Show failed pages').click();
    await expect(connection.locator('.cnflist li')).toHaveText([
      'Transfer limits policyThe source did not respond',
      'Cards FAQ: replacement, freezing and limits for every card we issueThe source returned an error for this page',
    ]);
    await expect(connection.getByRole('link', { name: 'Open Transfer limits policy in Confluence' })).toHaveAttribute('target', '_blank');
    await check(page, 'connectors-partial');
  });

  test("a space's read that could not read a page links to it, until a later sync reads it", async ({ open, check }) => {
    let fixed = false;
    const page = await open('admin', '/admin/sources', {
      before: (p) => withRuns(p, {
        space: (s) => (s.path !== 'Cards (CARD)' ? s : { ...s, last_run: run({ trigger: 'space_read', connection_id: s.connection_id, container_id: s.id, status: 'partial', tasks_total: 1, tasks_done: 1, pages_total: 2, pages_done: 1, pages_failed: 1, failing: fixed ? 0 : 1, updated: 1 }) }),
        failures: FAILED.slice(1),
      }),
    });
    await openSource(page);
    const cards = page.locator('.dt-r[data-space]').filter({ hasText: 'Cards (CARD)' });
    await expect(cards.locator('.cnsrun')).toHaveText('1 page · 1 failed');
    await check(page, 'connectors-space-failed');
    await cards.getByRole('button', { name: '1 failed' }).click();
    const drawer = page.getByRole('dialog', { name: 'Failed pages in Cards (CARD)' });
    await expect(drawer.locator('.cnflist li')).toHaveText(['Cards FAQ: replacement, freezing and limits for every card we issueThe source returned an error for this page']);
    await check(page, 'connectors-space-failures');
    await drawer.getByRole('button', { name: 'Close' }).click();
    // A later Sync now read the page: the space's own count stays, its amber state goes (spec 3.4.1).
    fixed = true;
    await page.evaluate(() => window.BRAIN.go('/admin/people'));
    await page.evaluate(() => window.BRAIN.go('/admin/sources'));
    await openSource(page);
    await expect(cards.locator('.cnsrun')).toHaveText('2 pages');
  });

  test('a sync that the connection failing ended says so under the connection error', async ({ open, check }) => {
    // As the worker leaves a connection after Atlassian refused its grant (sync runs spec 5.5).
    const page = await open('admin', '/admin/sources', {
      before: (p) => withRuns(p, {
        connection: (c) => ({
          ...c,
          status: 'failing',
          last_error: 'Atlassian refused the refresh token; an admin must authorize again',
          last_run: run({ connection_id: c.id, status: 'failed', tasks_done: 1, error: 'The connection failed: access to the source was refused' }),
        }),
      }),
    });
    await openSource(page);
    const connection = page.locator('.cnconn').first();
    await expect(connection.locator('.cnstate .tag.bad')).toHaveText('Failing');
    await expect(connection.locator('.cnerr')).toHaveText('Atlassian refused the refresh token; an admin must authorize again');
    await expect(connection.locator('.cnsync')).toHaveText('Sync failed The connection failed: access to the source was refused');
    await expect(connection.getByRole('button', { name: 'Sync now' })).toBeEnabled();
    await check(page, 'connectors-failed');
  });

  test('a failed Confluence authorization says what to do', async ({ open, check }) => {
    const page = await open('admin', '/admin/sources?error=invalid_state');
    await expect(page.getByRole('alert')).toHaveText('The Confluence authorization expired or was started in another browser. Authorize again.');
    await expect(page).toHaveURL(/\/admin\/sources$/);
    await check(page, 'connectors-authorization-failed');
  });

  test('a finished Confluence authorization is confirmed', async ({ open, seed }) => {
    const page = await open('admin', `/admin/connectors?connected=${seed.connection_id}`);
    await expect(page.locator('#toast')).toContainText('Confluence is connected');
    await expect(page).toHaveURL(/\/admin\/sources\/confluence$/); // the connected source's own page
  });
});

test.describe('governance', () => {
  test('an approver can decide on a request', async ({ open, check }) => {
    const page = await open('admin', '/governance');
    // Governance is a place of its own: no Settings rail, even for an admin.
    await expect(page.getByRole('heading', { level: 1, name: 'Governance' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Settings' })).toHaveCount(0);
    const request = page.locator('.govr').filter({ hasText: 'Engineering handbook' });
    await expect(request.locator('.adrqm')).toContainText('Eve Mensah');
    await expect(request.getByRole('button', { name: 'Approve' })).toBeVisible();
    await expect(request.getByRole('button', { name: 'Reject' })).toBeVisible();
    await check(page, 'governance-approver');
  });

  test('the requester follows their request but cannot approve it', async ({ open, check }) => {
    const page = await open('employee', '/governance');
    const request = page.locator('.govr').filter({ hasText: 'Engineering handbook' });
    await expect(request.locator('.adrqm')).toContainText('you');
    await expect(request.getByRole('button')).toHaveText(['Engineering handbook']);
    await check(page, 'governance-requester');
  });
});

test.describe('people', () => {
  test.describe.configure({ mode: 'serial' });
  const finn = (page) => page.locator('[data-user]').filter({ hasText: 'Finn Adeyemi' });

  test('the people list', async ({ open, check }) => {
    const page = await open('admin', '/admin/people');
    await expect(page.locator('[data-user]')).toHaveCount(7);
    await check(page, 'people');
    await page.getByRole('searchbox', { name: 'Search people' }).fill('chidi');
    await expect(page.locator('[data-user]')).toHaveCount(1);
    await expect(page.locator('[data-user]')).toContainText('Chidi Eze');
  });

  test('owning a domain shows the domains inside it as owned through it (nested domains spec 4.6)', async ({ open, check }) => {
    // Finn is answered as owning Cross-border, so his tag can show the full path; nothing is saved.
    const page = await open('admin', '/admin/people', {
      before: (p) => p.route(/\/v1\/admin\/users(\?|$)/, async (route) => {
        const response = await route.fetch();
        const body = await response.json();
        const domains = await (await route.fetch({ url: route.request().url().replace(/\/users.*$/, '/domains') })).json();
        const crossBorder = domains.items.find((d) => d.slug === 'cross-border');
        const items = body.items.map((u) => (u.name === 'Finn Adeyemi' ? { ...u, roles: [{ role: 'domain_owner', domain_id: crossBorder.id }] } : u));
        await route.fulfill({ response, json: { ...body, items } });
      }),
    });
    const tag = finn(page).locator('.adroles .tag');
    await expect(tag).toHaveText('Owns Cross-border');
    await expect(tag).toHaveAttribute('title', 'Payments / Payouts / Cross-border');

    await finn(page).getByRole('button', { name: 'Edit' }).click();
    const dialog = page.getByRole('dialog', { name: 'Edit Finn Adeyemi' });
    const domains = dialog.locator('.ppdom');
    await expect(domains).toHaveText(['Cards', 'Engineering', 'Payments', 'Collections', 'Payouts', /^Cross-border/]);
    expect(await domains.evaluateAll((rows) => rows.map((r) => r.style.getPropertyValue('--depth')))).toEqual(['0', '0', '0', '1', '1', '2']);
    const box = (name) => dialog.getByRole('checkbox', { name: new RegExp(`^${name}`) });
    await expect(box('Cross-border')).toBeChecked();
    await expect(box('Cross-border')).toBeEnabled();

    await box('Payments').check();
    for (const name of ['Collections', 'Payouts', 'Cross-border']) {
      await expect(box(name)).toBeChecked();
      await expect(box(name)).toBeDisabled();
      await expect(domains.filter({ hasText: name })).toContainText('Owned through Payments');
    }
    await check(page, 'person-domains');
    await box('Payments').uncheck();
    await expect(box('Payouts')).not.toBeChecked();
    await expect(box('Payouts')).toBeEnabled();
    await expect(box('Cross-border')).toBeChecked(); // its own grant was kept all along
    await expect(domains.filter({ hasText: 'Cross-border' }).locator('.ppthru')).toBeHidden();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
  });

  test('roles and clearance change, and a person can be suspended and reactivated', async ({ open, check }) => {
    const page = await open('admin', '/admin/people');
    await finn(page).getByRole('button', { name: 'Edit' }).click();
    const dialog = page.getByRole('dialog', { name: 'Edit Finn Adeyemi' });
    await dialog.getByRole('checkbox', { name: 'Developer' }).check();
    await dialog.getByRole('checkbox', { name: 'Payments', exact: true }).check();
    await check(page, 'person-edit');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(finn(page)).toContainText('Developer');
    await expect(finn(page)).toContainText('Owns Payments');

    await finn(page).getByRole('button', { name: 'Edit' }).click();
    await dialog.getByRole('button', { name: 'Suspend' }).click();
    await expect(dialog.getByRole('alert')).toHaveText('Suspending signs them out everywhere until you reactivate them.');
    await dialog.getByRole('button', { name: 'Confirm suspend' }).click();
    await expect(finn(page).getByText('Suspended')).toBeVisible();

    await finn(page).getByRole('button', { name: 'Edit' }).click();
    await dialog.getByRole('checkbox', { name: 'Developer' }).uncheck();
    await dialog.getByRole('checkbox', { name: 'Payments', exact: true }).uncheck();
    await dialog.getByRole('button', { name: 'Save' }).click();
    await finn(page).getByRole('button', { name: 'Edit' }).click();
    await dialog.getByRole('button', { name: 'Reactivate' }).click();
    await expect(finn(page).getByText('Suspended')).toHaveCount(0);
    await expect(finn(page).locator('.adroles')).toHaveText('Employee');
  });

  test('an invitation is created, listed and revoked', async ({ open, check }) => {
    const page = await open('admin', '/admin/people');
    await page.getByRole('button', { name: 'Invite' }).click();
    const dialog = page.getByRole('dialog', { name: 'Invite people' });
    await dialog.getByRole('textbox', { name: 'Google account' }).fill('not an email');
    await dialog.getByRole('button', { name: 'Invite' }).click();
    await expect(dialog.getByRole('alert')).toHaveText('Enter the email of their Google account');
    await dialog.getByRole('textbox', { name: 'Google account' }).fill('grace.obi@kredete.com');
    await dialog.getByRole('checkbox', { name: 'Compliance' }).check();
    await check(page, 'invite');
    await dialog.getByRole('button', { name: 'Invite' }).click();
    await expect(page.locator('#toast')).toContainText('Invited grace.obi@kredete.com');
    const row = page.locator('.adrow.pend').filter({ hasText: 'grace.obi@kredete.com' });
    await expect(row).toContainText('Pending');
    await check(page, 'invitations');
    await row.getByRole('button', { name: 'Cancel' }).click();
    await row.getByRole('button', { name: 'Confirm' }).click();
    await expect(row).toHaveCount(0);
  });

  test('a Confluence account is linked to a person, then unlinked', async ({ open, check }) => {
    const page = await open('admin', '/admin/people');
    await page.getByRole('button', { name: /Filter people/ }).click();
    await page.getByRole('option', { name: 'Confluence accounts' }).click();
    const sam = page.locator('.lnrow').filter({ hasText: 'Sam Rivera' });
    await expect(sam).toBeVisible();
    await check(page, 'confluence-accounts');
    await expect(sam.getByRole('button', { name: 'Link', exact: true })).toBeDisabled();
    await sam.getByRole('button', { name: 'Person for Sam Rivera' }).click();
    await page.getByRole('option', { name: /Finn Adeyemi/ }).click();
    await sam.getByRole('button', { name: 'Link', exact: true }).click();
    await expect(page.locator('#toast')).toContainText('Linked');
    const linked = page.locator('.lnrow').filter({ hasText: 'Sam Rivera' });
    await expect(linked).toContainText('Linked to Finn Adeyemi');
    await linked.getByRole('button', { name: 'Unlink' }).click();
    await linked.getByRole('button', { name: 'Confirm unlink' }).click();
    await expect(page.locator('#toast')).toContainText('Unlinked');
    await expect(page.locator('.lnrow').filter({ hasText: 'Sam Rivera' })).not.toContainText('Linked to');
  });
});

test('the audit log filters by action', async ({ open, check }) => {
  const page = await open('admin', '/admin/audit');
  await expect(page.locator('#audt .aud-r:not(.aud-h)').first()).toBeVisible();
  await page.getByRole('button', { name: 'Filter' }).click();
  await page.getByRole('button', { name: 'Action' }).click();
  await page.getByRole('option', { name: 'Connection created' }).click();
  await page.getByRole('button', { name: 'Show results' }).click();
  await expect(page.locator('#audt .aud-r:not(.aud-h)')).toHaveCount(1);
  await expect(page.locator('#audt .audact')).toHaveText('Connection created');
  await check(page, 'audit');
});

test('the audit log leaves served answers out until Answers is shown', async ({ open, seed, request }) => {
  // A staff answer, then a support bot answer (the bot is the public channel).
  const asker = await open('employee', '/');
  await asker.getByRole('textbox', { name: 'Ask a question' }).fill(seed.questions.answered.question);
  await asker.keyboard.press('Enter');
  await expect(asker.locator('#thread article .ans .cite')).toHaveCount(1, { timeout: 20_000 });
  await asker.close();
  // The bot's answer is asked the way the widget asks it (bot.spec.mjs drives the widget itself).
  const bot = `${seed.bot_api.replace(/\/+$/, '')}/v1/bot`;
  const headers = { Authorization: `Bearer ${seed.bot_key}`, Origin: new URL(BASE).origin };
  const started = await request.post(`${bot}/conversations`, { headers });
  expect(started.ok()).toBe(true);
  const { conversation_id: id, visitor_token: visitor } = await started.json();
  const turn = await request.post(`${bot}/conversations/${id}/turns`, { headers: { ...headers, 'Broth-Visitor': visitor }, data: { question: seed.bot_questions.answered }, timeout: 30_000 });
  expect(turn.ok()).toBe(true);
  expect(await turn.text()).toContain('answered');

  const page = await open('admin', '/admin/audit');
  const events = page.locator('#audt .audact');
  await expect(events.first()).toBeVisible();
  // Both answers are newer than everything else, yet the default list shows the other events.
  await expect(events.filter({ hasText: 'Answer served' })).toHaveCount(0);
  const show = async (categories, expected) => {
    await page.getByRole('button', { name: /^Filter/ }).click();
    const form = page.getByRole('dialog', { name: 'Filter the audit log' });
    for (const name of ['Access', 'Sources', 'Bots', 'Sign-ins', 'Settings', 'Answers']) {
      await form.getByRole('checkbox', { name, exact: true }).setChecked(categories.includes(name));
    }
    await form.getByRole('button', { name: 'Show results' }).click();
    await expect(events.first()).toBeVisible();
    for (const text of await events.allTextContents()) expect(text).toMatch(expected);
  };
  await show(['Answers'], /^Answer served$/);
  const rows = page.locator('#audt .aud-r:not(.aud-h)');
  await expect(rows.filter({ hasText: '· public' }).first()).toBeVisible();
  await expect(rows.filter({ hasNotText: '· public' }).first()).toBeVisible();
  // Bot events read as words, not as the stored action.
  await show(['Bots'], /^(Bot|Product) [a-z ]+$/);
  // Unticking Bots keeps the rest of the default view.
  await show(['Access', 'Sources', 'Sign-ins', 'Settings'], /^(?!Answer served$|Bot |Product )/);
  await expect(page.getByRole('button', { name: /^Filter/ })).toContainText('1');
});
