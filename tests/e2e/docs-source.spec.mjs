// Docs repositories on Connectors, and their Public declarations in Governance (docs source
// spec 8). The seed has no GitHub connection, so its connection, repositories, runs and
// declarations are added to the real API's responses here; every write is answered here too.
import { expect, test } from './fixtures.mjs';

const CONNECTION = '00000000-0000-4000-8000-00000000d0c1';
const REPO = '00000000-0000-4000-8000-00000000d0c2';
const SECOND = '00000000-0000-4000-8000-00000000d0c3';
const RUN = '00000000-0000-4000-8000-00000000d0c4';
const DECLARATION = '00000000-0000-4000-8000-00000000d0c5';
/** Ten minutes before the run: the page says how long ago, so a fixed date would change its words, and its wrap, day by day. */
const AT = new Date(Date.now() - 10 * 60_000).toISOString();

function docsConnection(over = {}) {
  return {
    id: CONNECTION, system: 'github_docs', site: 'kredete', status: 'healthy', authorized: true,
    last_sync_at: AT, last_permission_sync_at: AT, last_error: null, warnings: {}, active_run: null, last_run: null, ...over,
  };
}
function repo(id, path, over = {}) {
  return {
    id, connection_id: CONNECTION, external_id: id.slice(-4), kind: 'repo', path, included: true, owner_user_id: null,
    default_domain_id: null, default_authority: 'approved', default_sensitivity: null, review_interval_months: 12,
    indexer_verified_at: AT, active_run: null, last_run: null, public_declaration: null, ...over,
  };
}
const finishedRun = {
  id: RUN, connection_id: CONNECTION, container_id: null, trigger: 'manual', status: 'succeeded', total: 4, done: 4,
  failing: 0, error: null, started_at: AT, finished_at: AT,
};

/** Adds the docs connection and repositories to what the API lists. */
async function withDocs(page, { connection = docsConnection(), repos = [repo(REPO, 'kredete/docs')] } = {}) {
  await page.route('**/v1/admin/connections', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const response = await route.fetch();
    const body = await response.json();
    return route.fulfill({ response, json: { ...body, items: [...body.items, connection] } });
  });
  await page.route('**/v1/admin/containers', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    return route.fulfill({ response, json: { ...body, items: [...body.items, ...repos] } });
  });
}
/** The Docs repositories card opens the source's own page, its section laid out as the page body. */
const docsSection = (page) => page.locator('[data-sec="docs"]');
const docsCard = (page) => page.locator('[data-src="github"]');
const openDocs = async (page) => { await docsCard(page).click(); return docsSection(page); };

test.describe('docs repositories', () => {
  test('a GitHub account that is not installed yet offers the install', async ({ open, check }) => {
    const posted = [];
    const page = await open('admin', '/admin/connectors', {
      before: async (p) => {
        await withDocs(p, { connection: docsConnection({ authorized: false, last_sync_at: null }), repos: [] });
        await p.route(`**/v1/admin/connections/${CONNECTION}/github/install`, (route) => {
          posted.push(route.request().method());
          return route.fulfill({ json: { install_url: 'https://github.com/apps/broth-docs/installations/new?state=s1' } });
        });
        await p.route('https://github.com/**', (route) => route.fulfill({ contentType: 'text/html', body: '<title>GitHub</title><h1>Install Broth</h1>' }));
      },
    });
    const section = await openDocs(page);
    // A connected source opens as its own page, titled with its name.
    await expect(page).toHaveURL(/\/admin\/sources\/docs-repositories$/);
    await expect(page.getByRole('heading', { level: 1, name: /Docs repositories/ })).toBeVisible();
    await expect(section.locator('.cnstate')).toContainText('Not installed');
    await expect(section.getByRole('button', { name: 'Find repositories' })).toHaveCount(0);
    await section.scrollIntoViewIfNeeded();
    await check(page, 'docs-not-installed');
    await section.getByRole('button', { name: 'Install on GitHub' }).click();
    await expect(page).toHaveURL(/github\.com\/apps\/broth-docs\/installations\/new\?state=s1$/);
    expect(posted).toEqual(['POST']);
  });

  test('connecting an account checks the name, then creates the connection and installs', async ({ open }) => {
    const created = [];
    const page = await open('admin', '/admin/connectors', {
      before: async (p) => {
        // Connecting needs the GitHub App saved first (sandbox), else the card offers to add it.
        await p.route('**/v1/admin/credentials', async (route) => {
          const response = await route.fetch();
          const body = await response.json();
          return route.fulfill({ response, json: { ...body, items: body.items.map((c) => (c.name === 'github_app' ? { ...c, configured: true, client_id_last4: '1234' } : c)) } });
        });
        await p.route('**/v1/admin/connections', (route) => {
          if (route.request().method() !== 'POST') return route.fallback();
          created.push(route.request().postDataJSON());
          return route.fulfill({ status: 201, json: docsConnection({ authorized: false }) });
        });
        await p.route(`**/v1/admin/connections/${CONNECTION}/github/install`, (route) => route.fulfill({ json: { install_url: 'https://github.com/apps/broth-docs/installations/new?state=s2' } }));
        await p.route('https://github.com/**', (route) => route.fulfill({ contentType: 'text/html', body: '<title>GitHub</title>' }));
      },
    });
    await docsCard(page).click();
    const dialog = page.getByRole('dialog', { name: 'Docs repositories' });
    await dialog.getByLabel('GitHub organization or user').fill('not a name!');
    await dialog.getByRole('button', { name: 'Connect' }).click();
    await expect(dialog.locator('#ghadde')).toHaveText('Enter the GitHub organization or user name, like kredete');
    expect(created).toEqual([]);
    await dialog.getByLabel('GitHub organization or user').fill('https://github.com/kredete');
    await dialog.getByRole('button', { name: 'Connect' }).click();
    await expect(page).toHaveURL(/state=s2$/);
    expect(created).toEqual([{ system: 'github_docs', site: 'kredete' }]);
  });

  test('a returned install says so, and a refused one says why', async ({ open }) => {
    const page = await open('admin', `/admin/connectors?connected=${CONNECTION}`, { before: (p) => withDocs(p) });
    await expect(page.locator('#toast')).toContainText('The GitHub App is installed. Find the repositories next.');
    await expect(page).toHaveURL(/\/admin\/sources\/docs-repositories$/); // the connected source's own page
    await page.goto('/admin/connectors?error=wrong_account');
    await expect(page.getByRole('alert').first()).toHaveText('The app was installed on a different GitHub account than the one you connected. Install it on that account.');
  });

  test('repositories show where their Public request stands, and one can be requested', async ({ open, check }) => {
    const requested = [];
    const page = await open('admin', '/admin/connectors', {
      before: async (p) => {
        await withDocs(p, {
          repos: [
            repo(REPO, 'kredete/docs'),
            repo(SECOND, 'kredete/api-docs', { public_declaration: { id: DECLARATION, container_id: SECOND, container_path: null, status: 'approved', requested_by: SECOND, approved_by: SECOND, reason: null, created_at: AT, decided_at: AT, can_decide: false } }),
          ],
        });
        await p.route(`**/v1/admin/containers/${REPO}/public-declaration`, (route) => {
          requested.push(route.request().postDataJSON());
          return route.fulfill({ status: 201, json: { id: DECLARATION, container_id: REPO, container_path: null, status: 'pending', requested_by: REPO, approved_by: null, reason: 'Published at docs.kredete.com', created_at: AT, decided_at: null, can_decide: false } });
        });
      },
    });
    const section = await openDocs(page);
    await expect(section.locator('.dt-h')).toHaveText(/Repository\s*Owner\s*Bots\s*Settings\s*Included/);
    const rows = section.locator('[data-space]');
    await expect(rows.nth(1).locator('.cndecl')).toHaveText('Public');
    await section.scrollIntoViewIfNeeded();
    await check(page, 'docs-repositories');
    await rows.nth(0).getByRole('button', { name: 'Request public for kredete/docs' }).click();
    const dialog = page.getByRole('dialog', { name: 'Request public for kredete/docs' });
    await expect(dialog.locator('a')).toHaveAttribute('href', '/help/connecting-docs-repositories#public-declaration');
    await dialog.getByLabel('Why').fill('Published at docs.kredete.com');
    await dialog.getByRole('button', { name: 'Request' }).click();
    await expect(page.locator('#toast')).toContainText('Requested. An admin or a domain owner approves it in Governance.');
    await expect(rows.nth(0).locator('.cndecl')).toHaveText('Requested');
    expect(requested).toEqual([{ reason: 'Published at docs.kredete.com' }]);
  });

  test('a repository Broth does not read yet asks to be included before it can go Public', async ({ open }) => {
    const page = await open('admin', '/admin/connectors', { before: (p) => withDocs(p, { repos: [repo(REPO, 'kredete/docs', { included: false })] }) });
    const row = (await openDocs(page)).locator('[data-space]');
    await expect(row.locator('.cndecl')).toHaveText('Include it first');
    await expect(row.getByRole('button', { name: /Request public/ })).toHaveCount(0);
  });

  test("a repository's settings leave out what a repository derives", async ({ open }) => {
    const page = await open('admin', '/admin/connectors', { before: (p) => withDocs(p) });
    await (await openDocs(page)).getByRole('button', { name: 'Settings for kredete/docs' }).click();
    const drawer = page.getByRole('dialog', { name: 'Repository settings, kredete/docs' });
    await expect(drawer.getByRole('heading', { name: 'kredete/docs' })).toBeVisible();
    await expect(drawer.getByText(/^Repository settings\./)).toBeVisible();
    await expect(drawer.getByRole('button', { name: 'Default authority' })).toHaveCount(0);
    await expect(drawer.getByRole('button', { name: 'Default sensitivity' })).toHaveCount(0);
    await expect(drawer.getByText('Published docs are approved.')).toBeVisible();
  });

  test('a finished docs run lists the pages it kept out of Public, with why', async ({ open, check }) => {
    const page = await open('admin', '/admin/connectors', {
      before: async (p) => {
        await withDocs(p, { connection: docsConnection({ last_run: finishedRun }) });
        await p.route(`**/v1/admin/sync-runs/${RUN}/notices**`, (route) => route.fulfill({
          json: { items: [{ external_id: '101:docs/cards/renew.mdx', title: 'Renew a card', url: 'https://docs.kredete.com/cards/renew', notice: 'Not public: a card number found.' }], next_cursor: null },
        }));
      },
    });
    const section = await openDocs(page);
    await section.getByText('Show failed and held-back pages').click();
    await expect(section.locator('.cnnh')).toHaveText('Kept out of Public');
    await expect(section.locator('.cnnbox li')).toHaveText(/Renew a card\s*Not public: a card number found\./);
    await expect(section.getByRole('link', { name: 'What these mean' })).toHaveAttribute('href', '/help/connecting-docs-repositories#problems');
    await section.scrollIntoViewIfNeeded();
    await check(page, 'docs-held-back');
  });

  test('the GitHub App credential takes an app ID, a private key and a webhook secret', async ({ open }) => {
    const saved = [];
    const page = await open('admin', '/admin/connectors', {
      before: async (p) => {
        // The credential row sits in the Docs repositories dialog, which opens for a connected account.
        await withDocs(p);
        await p.route('**/v1/admin/credentials/github_app', (route) => {
          saved.push(route.request().postDataJSON());
          return route.fulfill({ status: 204 });
        });
      },
    });
    const row = (await openDocs(page)).locator('[data-cred="github_app"]');
    await expect(row).toContainText('GitHub App');
    await expect(row.locator('.tag')).toHaveText('Not configured');
    await row.getByRole('button', { name: 'Add' }).click();
    const dialog = page.getByRole('dialog', { name: 'GitHub App' });
    await dialog.getByLabel('App ID').fill('abc');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog.getByRole('alert')).toHaveText("The App ID is a number, from the app's settings on GitHub");
    await dialog.getByLabel('App ID').fill('123456');
    await dialog.getByLabel('Private key').fill('-----BEGIN RSA PRIVATE KEY-----\nkey\n-----END RSA PRIVATE KEY-----');
    await dialog.getByLabel('Webhook secret').fill('hook');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(page.locator('#toast')).toContainText('Saved');
    expect(saved).toEqual([{ app_id: '123456', private_key: '-----BEGIN RSA PRIVATE KEY-----\nkey\n-----END RSA PRIVATE KEY-----', webhook_secret: 'hook' }]);
  });
});

test.describe('governance of docs repositories', () => {
  test('a pending repository request is listed first, and an approver approves it', async ({ open, check }) => {
    const decided = [];
    const page = await open('admin', '/governance', {
      before: async (p) => {
        await p.route(/\/v1\/public-declarations(\?.*)?$/, (route) => route.fulfill({
          json: { items: [{ id: DECLARATION, container_id: REPO, container_path: 'kredete/docs', status: 'pending', requested_by: REPO, approved_by: null, reason: 'Published at docs.kredete.com', created_at: AT, decided_at: null, can_decide: true }], next_cursor: null },
        }));
        await p.route(`**/v1/public-declarations/${DECLARATION}/approve`, (route) => {
          decided.push('approve');
          return route.fulfill({ json: { id: DECLARATION, container_id: REPO, container_path: null, status: 'approved', requested_by: REPO, approved_by: REPO, reason: null, created_at: AT, decided_at: AT, can_decide: true } });
        });
      },
    });
    const row = page.locator('.govrepo');
    await expect(row).toContainText('kredete/docs');
    await expect(row).toContainText('Whole repository, wants to share with Public');
    await expect(row).toContainText('a colleague');
    await expect(page.locator('.govr').first()).toHaveClass(/govrepo/);
    await check(page, 'governance-repository');
    await row.getByRole('button', { name: 'Approve' }).click();
    await expect(page.locator('#toast')).toContainText("Approved. The repository's published pages are Public now.");
    // Approved, it stays listed, so it can be revoked where it was approved.
    await expect(row.locator('.adrqt .tag')).toHaveText('Approved');
    await expect(row.getByRole('button', { name: 'Revoke' })).toBeVisible();
    expect(decided).toEqual(['approve']);
  });
});

/* Including a repository needs a hosted docs site (docs site link spec 3.3 and 4.2). The API's
   refusal is answered here; broth-service's tests cover when it refuses. */
test.describe('including a docs repository', () => {
  const NO_SITE = 'Include needs a broth.docs.yaml that names the docs site. broth.docs.yaml is not valid: the file is missing.';

  test('a repository without a docs site stays excluded and says why', async ({ open }) => {
    const sent = [];
    const page = await open('admin', '/admin/connectors', {
      before: async (p) => {
        await withDocs(p, { repos: [repo(REPO, 'kredete/handbook', { included: false })] });
        await p.route(`**/v1/admin/containers/${REPO}`, (route) => {
          if (route.request().method() !== 'PATCH') return route.fallback();
          sent.push(route.request().postDataJSON());
          return route.fulfill({
            status: 409,
            contentType: 'application/problem+json',
            json: { type: 'about:blank', title: 'Invalid state', status: 409, code: 'invalid_state', detail: NO_SITE },
          });
        });
      },
    });
    const include = (await openDocs(page)).getByRole('checkbox', { name: 'Include kredete/handbook' });
    await include.click();
    await expect(page.locator('#toast')).toContainText(NO_SITE);
    await expect(include).not.toBeChecked();
    expect(sent.map((body) => body.included)).toEqual([true]);
  });
});

/* A docs page's open button names the docs site it opens (docs site link spec 4.1). Two seed
   pages are answered here as a docs repository's operation and as one of its problems. */
test.describe('opening a docs page', () => {
  const SITE_URL = 'https://proteensheykh.github.io/broth-docs-fixture/bankinglive/api/card-issuance/card-renewal';
  const FILE_URL = 'https://github.com/Proteensheykh/broth-docs-fixture/blob/main/openapi/banking-live.yaml';
  const AS = {
    'Cards FAQ': { system: 'github_docs', kind: 'api_operation', url: SITE_URL, link_target: 'docs_site' },
    'Card replacement fees': { system: 'github_docs', kind: 'docs_problem', url: FILE_URL, link_target: 'source' },
  };
  const asDocs = (p) => p.route('**/v1/documents/*', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    await route.fulfill({ response, json: { ...body, ...(AS[body.title] || {}) } });
  });
  const docRows = (page) => page.locator('#libbody [data-open]');
  /** The open button's box, and whether its words fit without being cut off. */
  const measure = (button) => button.evaluate((el) => {
    const label = /** @type {HTMLElement} */ (el.querySelector('.lbl'));
    return { width: el.getBoundingClientRect().width, natural: label.scrollWidth, fits: label.scrollWidth <= label.clientWidth };
  });

  test('a docs page opens its docs site, and a page Broth could not publish opens its file on GitHub', async ({ open, check }) => {
    const page = await open('employee', '/library/cards', { before: asDocs });
    const drawer = page.locator('#drawer');
    const button = drawer.locator('#dopen');

    await docRows(page).filter({ hasText: 'Cards FAQ' }).click();
    await expect(button).toHaveText('Open docs site');
    await expect(button).toHaveAttribute('href', SITE_URL);
    await expect(button.locator('svg[data-i="globe"]')).toHaveCount(1);
    await expect(button.locator('.srclogo')).toHaveCount(0);
    await expect(drawer.locator('.sv-sys .srclogo-github')).toHaveCount(1); // the header still says where it is read from
    const site = await measure(button);
    await check(page, 'document-docs-site');

    await drawer.locator('#ddet').click();
    const details = page.getByRole('dialog', { name: 'Details and lineage' });
    const detailsOpen = details.locator('.actions a.btn.primary');
    await expect(detailsOpen).toHaveText('Open docs site');
    await expect(detailsOpen).toHaveAttribute('href', SITE_URL);
    await expect(detailsOpen.locator('svg[data-i="globe"]')).toHaveCount(1);
    await details.getByRole('button', { name: 'Close' }).click();

    await page.locator('[data-close-drawer]').first().click();
    await page.locator('#libbody').getByRole('button', { name: 'Open Cards (CARD) home page' }).click(); // the space's home page heads its group
    await expect(drawer.getByRole('heading', { name: 'Card replacement fees' })).toBeVisible();
    await expect(button).toHaveText('Open in GitHub');
    await expect(button).toHaveAttribute('href', FILE_URL);
    await expect(button.locator('.srclogo-github')).toHaveCount(1);
    await expect(button.locator('svg[data-i="globe"]')).toHaveCount(0);
    const github = await measure(button);

    // Same box as before, and the new words fit in it as the old ones did.
    expect(site.width).toBe(github.width);
    expect(site.fits).toBe(true);
    expect(github.fits).toBe(true);
    expect(site.natural).toBeLessThanOrEqual(github.natural);
  });
});
