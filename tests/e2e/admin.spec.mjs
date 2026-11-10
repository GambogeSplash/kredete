// Surfaces follow roles, and the admin screens (sandbox spec 6.2: the People screen; surfaces
// following roles; plan C7, C8). Changes stay on people no other scenario reads: Finn (no
// Confluence account) and Sam's unlinked Confluence account.
import { expect, test } from './fixtures.mjs';

const phone = (page) => page.viewportSize().width < 900;
async function nav(page) {
  if (phone(page)) await page.getByRole('button', { name: 'Open menu' }).click();
  return page.locator('#surfaces');
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
    if (phone(page)) await page.getByRole('button', { name: 'Close menu' }).click();
    const menu = await profileMenu(page);
    await expect(menu.getByRole('menuitem', { name: 'Account settings' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Support agent' })).toHaveCount(0);
    await check(page, 'menu-employee', { mask: ['.lh-t'], chats: true });
    for (const path of ['/admin', '/admin/people', '/agent', '/setup']) {
      await page.evaluate((p) => window.BRAIN.go(p), path);
      await expect(page).toHaveURL(/\/$/);
    }
  });

  test('compliance sees Audit and the Support agent, not the other admin screens', async ({ open, check }) => {
    const page = await open('compliance', '/admin/people');
    await expect(page).toHaveURL(/\/admin\/audit$/);
    const rail = page.getByRole('navigation', { name: 'Admin' });
    await expect(rail.getByRole('button')).toHaveText(['Audit']);
    await page.getByRole('button', { name: 'Action' }).click();
    await page.getByRole('option', { name: 'Sharing requested' }).click();
    await expect(page.locator('#audt .dt-r:not(.dt-h)')).toHaveCount(1);
    await expect(page.locator('#audt .audact')).toHaveText('Sharing requested');
    await check(page, 'audit-compliance');
    const menu = await profileMenu(page);
    await expect(menu.getByRole('menuitem', { name: 'Support agent' })).toBeVisible();
  });

  test('a developer has the Support agent and no Admin', async ({ open, check }) => {
    const page = await open('developer', '/');
    const surfaces = await nav(page);
    await expect(surfaces.getByRole('button', { name: 'Admin' })).toHaveCount(0);
    if (phone(page)) await page.getByRole('button', { name: 'Close menu' }).click();
    const menu = await profileMenu(page);
    await menu.getByRole('menuitem', { name: 'Support agent' }).click();
    await expect(page).toHaveURL(/\/agent$/);
    await check(page, 'support-agent');
    await page.evaluate(() => window.BRAIN.go('/admin'));
    await expect(page).toHaveURL(/\/$/);
  });

  test('an admin has every admin screen', async ({ open }) => {
    const page = await open('admin', '/admin');
    await expect(page).toHaveURL(/\/admin\/connectors$/);
    await expect(page.getByRole('navigation', { name: 'Admin' }).getByRole('button')).toHaveText(['Connectors', 'People', 'Domains', 'Audit']);
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
  const DOMAINS = '**/v1/admin/domains';
  const captured = (page, pattern, method, reply) => {
    const bodies = [];
    return page.route(pattern, async (route) => {
      if (route.request().method() !== method) return route.fallback();
      bodies.push({ url: route.request().url(), body: route.request().postDataJSON() });
      return route.fulfill(await reply(route, bodies));
    }).then(() => bodies);
  };

  test('lists each domain with the label to use, its owners and page count', async ({ open, check }) => {
    const page = await open('admin', '/admin/domains');
    const payments = page.locator('[data-domain]').filter({ hasText: 'Payments' });
    await expect(payments.locator('code')).toHaveText('broth-domain-payments');
    await expect(payments.locator('.tag')).toHaveText(['Dami Bello']);
    await check(page, 'domains');
  });

  test('a new domain suggests its label from the name', async ({ open, check }) => {
    const page = await open('admin', '/admin/domains');
    const created = await captured(page, DOMAINS, 'POST', (route) => ({
      status: 201,
      json: { id: '00000000-0000-4000-8000-0000000000d1', slug: 'card-disputes', name: 'Card Disputes', document_count: 0, owners: [] },
    }));
    await page.getByRole('button', { name: 'New domain' }).click();
    await page.getByRole('textbox', { name: 'Name' }).fill('Card Disputes');
    await expect(page.getByRole('textbox', { name: 'Label' })).toHaveValue('card-disputes');
    await check(page, 'domains-new');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.locator('[data-domain]').filter({ hasText: 'Card Disputes' }).locator('code')).toHaveText('broth-domain-card-disputes');
    expect(created.map((c) => c.body)).toEqual([{ name: 'Card Disputes', slug: 'card-disputes' }]);
  });

  test('an edited label is kept, and a taken one is explained', async ({ open }) => {
    const page = await open('admin', '/admin/domains');
    const sent = await captured(page, DOMAINS, 'POST', () => ({
      status: 409,
      contentType: 'application/problem+json',
      json: { type: 'urn:broth:problem:invalid_state', title: 'Invalid state', status: 409, code: 'invalid_state', detail: 'a domain with this slug already exists' },
    }));
    await page.getByRole('button', { name: 'New domain' }).click();
    await page.getByRole('textbox', { name: 'Label' }).fill('payments');
    await page.getByRole('textbox', { name: 'Name' }).fill('Payments Two');
    await expect(page.getByRole('textbox', { name: 'Label' })).toHaveValue('payments');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('alert')).toHaveText('A domain with this slug already exists');
    expect(sent.map((c) => c.body.slug)).toEqual(['payments']);
  });

  test('renaming and changing owners keeps everyone\'s other roles', async ({ open, check }) => {
    const page = await open('admin', '/admin/domains');
    const renamed = await captured(page, `${DOMAINS}/*`, 'PATCH', (route) => ({
      json: { id: route.request().url().split('/').pop(), slug: 'payments', name: 'Payments and Transfers', document_count: 0, owners: [] },
    }));
    const roles = await captured(page, '**/v1/admin/users/*/roles', 'PUT', () => ({ json: {} }));
    await page.locator('[data-domain]').filter({ hasText: 'Payments' }).getByRole('button', { name: 'Edit' }).click();
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

  test('with no domains, the tab explains what they are for', async ({ open, check }) => {
    const page = await open('admin', '/admin/domains', {
      before: (p) => p.route(DOMAINS, (route) => (route.request().method() === 'GET' ? route.fulfill({ json: { items: [], next_cursor: null } }) : route.fallback())),
    });
    await expect(page.getByRole('heading', { name: 'No domains yet' })).toBeVisible();
    await check(page, 'domains-empty');
  });
});

test.describe('connectors', () => {
  test('the Confluence connection, its spaces, Google Drive and the app credentials', async ({ open, check }) => {
    const page = await open('admin', '/admin/connectors');
    await expect(page.getByRole('heading', { name: 'Confluence' })).toBeVisible();
    await expect(page.locator('[data-space]')).toHaveCount(3);
    await expect(page.getByText('Needs Google Workspace')).toBeVisible();
    await expect(page.locator('.cnc .tag.ok')).toHaveCount(2); // both OAuth clients configured
    await check(page, 'connectors');
    await page.getByRole('heading', { name: 'App credentials' }).scrollIntoViewIfNeeded();
    await check(page, 'connectors-credentials');
  });

  test('an authorized connection can be authorized again, and personal spaces read as such', async ({ open }) => {
    const page = await open('admin', '/admin/connectors', {
      before: (p) => p.route('**/v1/admin/containers', async (route) => {
        const response = await route.fetch();
        const body = await response.json();
        const personal = { ...body.items[0], id: '00000000-0000-4000-8000-0000000000b1', external_id: 'me', path: 'Ada Okafor (~5f1e2d3c4b5a69788796a5b4)', included: false, owner_user_id: null };
        await route.fulfill({ response, json: { ...body, items: [...body.items, personal] } });
      }),
    });
    const connection = page.locator('.cnconn').first();
    await expect(connection.getByRole('button', { name: 'Re-authorize' })).toBeVisible();
    await expect(connection.getByText('Ada Okafor (personal space)')).toBeVisible();
    await expect(connection.getByText(/~5f1e2d3c/)).toHaveCount(0);
  });

  test("a space's settings save only what changed, and Brain re-reads it", async ({ open, check }) => {
    const sent = [];
    const page = await open('admin', '/admin/connectors', {
      before: (p) => p.route('**/v1/admin/containers/*', async (route) => {
        if (route.request().method() !== 'PATCH') return route.fallback();
        const change = route.request().postDataJSON();
        sent.push(change);
        const listed = await (await route.fetch({ method: 'GET', url: route.request().url().replace(/\/[^/]+$/, '') })).json();
        const space = listed.items.find((s) => route.request().url().endsWith(s.id));
        return route.fulfill({ json: { ...space, ...change } });
      }),
    });
    await page.getByRole('button', { name: 'Settings for Payments (PAY)' }).click();
    const drawer = page.getByRole('dialog', { name: 'Settings for Payments (PAY)' });
    await expect(drawer.getByRole('button', { name: 'Default authority' })).toBeVisible();
    await check(page, 'space-settings');
    await drawer.getByRole('button', { name: 'Default authority' }).click();
    await page.getByRole('option', { name: 'Draft' }).click();
    await drawer.getByRole('spinbutton', { name: 'Review interval in months' }).fill('7');
    await drawer.getByRole('button', { name: 'Save' }).click();
    await expect(page.locator('#toast')).toContainText('Saved. Brain re-reads this space now.');
    expect(sent).toEqual([{ default_authority: 'draft', review_interval_months: 7 }]);
  });

  test("a space's settings explain what they cannot save", async ({ open }) => {
    const sent = [];
    const page = await open('admin', '/admin/connectors', {
      before: (p) => p.route('**/v1/admin/containers/*', (route) => {
        if (route.request().method() !== 'PATCH') return route.fallback();
        sent.push(route.request().postDataJSON());
        return route.fulfill({ status: 422, contentType: 'application/problem+json', json: { type: 'urn:broth:problem:validation_error', title: 'Validation error', status: 422, code: 'validation_error', detail: 'the default domain does not exist' } });
      }),
    });
    await page.getByRole('button', { name: 'Settings for Cards (CARD)' }).click();
    const drawer = page.getByRole('dialog', { name: 'Settings for Cards (CARD)' });
    await drawer.getByRole('spinbutton', { name: 'Review interval in months' }).fill('0');
    await drawer.getByRole('button', { name: 'Save' }).click();
    await expect(drawer.getByRole('alert')).toHaveText('The review interval is a whole number of months, from 1 to 120');
    expect(sent).toEqual([]);
    await drawer.getByRole('spinbutton', { name: 'Review interval in months' }).fill('3');
    await drawer.getByRole('button', { name: 'Save' }).click();
    await expect(drawer.getByRole('alert')).toHaveText('the default domain does not exist');
  });

  test('a connection says what to fix about the indexer group', async ({ open, check }) => {
    const page = await open('admin', '/admin/connectors', {
      before: (p) => p.route('**/v1/admin/connections', async (route) => {
        if (route.request().method() !== 'GET') return route.fallback();
        const response = await route.fetch();
        const body = await response.json();
        body.items = body.items.map((c) => (c.system === 'confluence' ? { ...c, warnings: { indexer_group_members: { group: 'broth-indexer', members: ['Kofi Asante', 'Eve Mensah'] } } } : c));
        return route.fulfill({ response, json: body });
      }),
    });
    await expect(page.locator('.cnwarn')).toHaveText('Only the indexer account should be in broth-indexer. Also in it: Kofi Asante, Eve Mensah.');
    await check(page, 'connection-warnings');
  });

  test('a connection says when the indexer group is missing', async ({ open }) => {
    const page = await open('admin', '/admin/connectors', {
      before: (p) => p.route('**/v1/admin/connections', async (route) => {
        if (route.request().method() !== 'GET') return route.fallback();
        const response = await route.fetch();
        const body = await response.json();
        body.items = body.items.map((c) => (c.system === 'confluence' ? { ...c, warnings: { indexer_group_missing: { group: 'broth-indexer' } } } : c));
        return route.fulfill({ response, json: body });
      }),
    });
    await expect(page.locator('.cnwarn')).toHaveText('Create a broth-indexer group containing only the indexer account, so restricted pages can opt in.');
  });

  test('a failed Confluence authorization says what to do', async ({ open, check }) => {
    const page = await open('admin', '/admin/connectors?error=invalid_state');
    await expect(page.getByRole('alert')).toHaveText('The Confluence authorization expired or was started in another browser. Authorize again.');
    await expect(page).toHaveURL(/\/admin\/connectors$/);
    await check(page, 'connectors-authorization-failed');
  });

  test('a finished Confluence authorization is confirmed', async ({ open, seed }) => {
    const page = await open('admin', `/admin/connectors?connected=${seed.connection_id}`);
    await expect(page.locator('#toast')).toContainText('Confluence is connected');
    await expect(page).toHaveURL(/\/admin\/connectors$/);
  });
});

test.describe('governance', () => {
  test('an approver can decide on a request', async ({ open, check }) => {
    const page = await open('admin', '/governance');
    const request = page.locator('.govr').filter({ hasText: 'Engineering handbook' });
    await expect(request).toContainText('requested by Eve Mensah');
    await expect(request.getByRole('button', { name: 'Approve' })).toBeVisible();
    await expect(request.getByRole('button', { name: 'Reject' })).toBeVisible();
    await check(page, 'governance-approver');
  });

  test('the requester follows their request but cannot approve it', async ({ open, check }) => {
    const page = await open('employee', '/governance');
    const request = page.locator('.govr').filter({ hasText: 'Engineering handbook' });
    await expect(request).toContainText('requested by you');
    await expect(request.getByRole('button')).toHaveText(['Engineering handbook']);
    await check(page, 'governance-requester');
  });
});

test.describe('people', () => {
  test.describe.configure({ mode: 'serial' });
  const finn = (page) => page.locator('[data-user]').filter({ hasText: 'Finn Adeyemi' });

  test('the people list', async ({ open, check }) => {
    const page = await open('admin', '/admin/people');
    await expect(page.locator('[data-user]')).toHaveCount(6);
    await check(page, 'people');
    await page.getByRole('searchbox', { name: 'Search people' }).fill('chidi');
    await expect(page.locator('[data-user]')).toHaveCount(1);
    await expect(page.locator('[data-user]')).toContainText('Chidi Eze');
  });

  test('roles and clearance change, and a person can be suspended and reactivated', async ({ open, check }) => {
    const page = await open('admin', '/admin/people');
    await finn(page).getByRole('button', { name: 'Edit' }).click();
    const dialog = page.getByRole('dialog', { name: 'Edit Finn Adeyemi' });
    await dialog.getByRole('checkbox', { name: 'Developer' }).check();
    await dialog.getByRole('checkbox', { name: 'Payments' }).check();
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
    await dialog.getByRole('checkbox', { name: 'Payments' }).uncheck();
    await dialog.getByRole('button', { name: 'Save' }).click();
    await finn(page).getByRole('button', { name: 'Edit' }).click();
    await dialog.getByRole('button', { name: 'Reactivate' }).click();
    await expect(finn(page).getByText('Suspended')).toHaveCount(0);
    await expect(finn(page).locator('.acchips')).toHaveText('Employee');
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
    await expect(page.getByRole('tab', { name: 'Invitations' })).toHaveAttribute('aria-selected', 'true');
    const row = page.locator('#invlist .dt-r').filter({ hasText: 'grace.obi@kredete.com' });
    await expect(row).toContainText('Waiting to sign in');
    await check(page, 'invitations');
    await row.getByRole('button', { name: 'Revoke' }).click();
    await row.getByRole('button', { name: 'Confirm' }).click();
    await expect(row).toContainText('Revoked');
  });

  test('a Confluence account is linked to a person, then unlinked', async ({ open, check }) => {
    const page = await open('admin', '/admin/people');
    await page.getByRole('tab', { name: 'Confluence accounts' }).click();
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
  await expect(page.locator('#audt .dt-r:not(.dt-h)').first()).toBeVisible();
  await page.getByRole('button', { name: 'Action' }).click();
  await page.getByRole('option', { name: 'Connection created' }).click();
  await expect(page.locator('#audt .dt-r:not(.dt-h)')).toHaveCount(1);
  await expect(page.locator('#audt .audact')).toHaveText('Connection created');
  await check(page, 'audit');
});
