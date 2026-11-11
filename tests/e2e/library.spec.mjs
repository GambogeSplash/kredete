// The Library (sandbox spec 6.2; nested domains spec 4 and plan C3 and C4). As Eve, who can open
// seven of the corpus pages. Folders are domains: Cards holds two pages; Payments holds two and
// the folder Payouts, which holds only the folder Cross-border, which holds one; Engineering's
// handbook and release checklist have no domain, so they sit at the root. Collections and
// Engineering hold only pages Eve cannot open, so she sees neither.
import { expect, test } from './fixtures.mjs';

const docRows = (page) => page.locator('#libbody [data-open]');
const folders = (page) => page.locator('#libbody [data-folder]');
const titles = (page) => docRows(page).locator('.ltb b, .gc-t').allTextContents();
const folderNames = (page) => folders(page).locator('.ltb b, .gc-t').allTextContents();
const back = (page) => page.locator('#libback');
const heading = (page) => page.locator('#libfolder');
const phone = (page) => page.viewportSize().width < 900;
/** The folder's name: the heading on a desktop, the top bar on a phone (the heading is hidden). */
const title = (page) => heading(page);
const search = (page) => page.locator('#libq');
async function filter(page, option) {
  await page.getByRole('button', { name: 'Filter', exact: true }).click();
  await page.locator('#lfmenu').getByRole('button', { name: option }).click();
}

/* ---------- browsing ---------- */

test('the Library opens on its top-level folders, then the pages with no domain', async ({ open, check }) => {
  const page = await open('employee', '/library');
  await expect(folders(page)).toHaveCount(2);
  expect(await folderNames(page)).toEqual(['Cards', 'Payments']);
  await expect(folders(page)).toContainText(['2 pages', '3 pages']);
  expect(await titles(page)).toEqual(['Engineering handbook', 'Release checklist']);
  await expect(back(page)).toBeHidden();
  await expect(search(page)).toHaveAttribute('placeholder', 'Search the library');
  await check(page, 'library');
});

test('folders open all the way down, and the breadcrumb goes back up', async ({ open, check }) => {
  const page = await open('employee', '/library');
  await folders(page).filter({ hasText: 'Payments' }).click();
  await expect(page).toHaveURL(/\/library\/payments$/);
  await expect(title(page)).toHaveText('Payments');
  await expect(back(page)).toHaveAttribute('aria-label', 'Back to the Library');
  await expect(folders(page)).toHaveCount(1);
  expect(await folderNames(page)).toEqual(['Payouts']);
  await expect(docRows(page)).toHaveCount(2);
  expect(await titles(page)).toEqual(['KYC onboarding procedure', 'Savings rate sheet']);
  await expect(search(page)).toHaveAttribute('placeholder', 'Search Payments');
  await check(page, 'library-folder');

  await folders(page).filter({ hasText: 'Payouts' }).click();
  await expect(title(page)).toHaveText('Payouts');
  await expect(back(page)).toHaveAttribute('aria-label', 'Back to Payments');
  expect(await folderNames(page)).toEqual(['Cross-border']);
  await expect(docRows(page)).toHaveCount(0);
  await expect(page.locator('#libbody .ds-empty')).toHaveCount(0); // its folder is its content

  await folders(page).filter({ hasText: 'Cross-border' }).click();
  await expect(title(page)).toHaveText('Cross-border');
  await expect(back(page)).toHaveAttribute('aria-label', 'Back to Payouts');
  await expect(folders(page)).toHaveCount(0);
  await expect(docRows(page)).toHaveCount(1);
  expect(await titles(page)).toEqual(['Transfer limits policy']);
  await check(page, 'library-nested');

  await back(page).click();
  await expect(page).toHaveURL(/\/library\/payouts$/);
  await back(page).click();
  await expect(page).toHaveURL(/\/library\/payments$/);
  await expect(folders(page)).toHaveText([/Payouts/]);
  await back(page).click();
  await expect(page).toHaveURL(/\/library$/);
  await expect(folders(page)).toHaveCount(2);
});

test('a link opens its folder, and back and forward step through folders from the top', async ({ open }) => {
  const page = await open('employee', '/library/cross-border');
  await expect(title(page)).toHaveText('Cross-border');
  await expect(docRows(page)).toHaveText([/Transfer limits policy/]);
  await back(page).click();
  await expect(title(page)).toHaveText('Payouts');
  const scrolled = () => page.evaluate(() => Math.max(document.querySelector('#app').scrollTop, (document.querySelector('.mainpanel') || {}).scrollTop || 0, window.scrollY));
  await page.goBack();
  await expect(title(page)).toHaveText('Cross-border');
  expect(await scrolled()).toBe(0);
  await page.goForward();
  await expect(title(page)).toHaveText('Payouts');
  expect(await scrolled()).toBe(0);
});

test('a folder that does not exist, or holds nothing you can open, says so', async ({ open, check }) => {
  const page = await open('employee', '/library/collections'); // only a page Eve cannot open
  await expect(page.getByText('Folder not found', { exact: true })).toBeVisible();
  await expect(page.locator('#libh1')).toHaveText('Library'); // #libfolder is only the folder's own name
  await check(page, 'library-folder-missing');
  await page.getByRole('link', { name: 'Go to the Library' }).click();
  await expect(page).toHaveURL(/\/library$/);
  await expect(folders(page)).toHaveCount(2);

  await page.evaluate(() => window.BRAIN.go('/library/no-such-folder'));
  await expect(page.getByText('Folder not found', { exact: true })).toBeVisible();
});

test('the grid view shows folders as cards before the pages', async ({ open, check }) => {
  const page = await open('employee', '/library/payments');
  await page.getByRole('button', { name: 'Grid view' }).click();
  await expect(page.getByRole('button', { name: 'Grid view' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#libbody .gfold')).toHaveCount(1);
  await expect(page.locator('#libbody .gcard')).toHaveCount(3);
  await expect(page.locator('#libbody .gcard').first()).toContainText('Payouts');
  await check(page, 'library-grid');
});

test('Enter and Space open a folder', async ({ open }) => {
  const page = await open('employee', '/library');
  await folders(page).filter({ hasText: 'Payments' }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/library\/payments$/);
  await folders(page).filter({ hasText: 'Payouts' }).focus();
  await page.keyboard.press('Space');
  await expect(page).toHaveURL(/\/library\/payouts$/);
});

const failing = (route) => route.fulfill({
  status: 500,
  contentType: 'application/problem+json',
  body: JSON.stringify({ title: 'Something went wrong on our side.', status: 500 }),
});

test('when the folders cannot load, the pages still do, and Try again brings the folders', async ({ open, check }) => {
  const page = await open('employee', '/', { before: (p) => p.route('**/v1/facets', failing) });
  await page.evaluate(() => window.BRAIN.go('/library'));
  await expect(page.getByRole('alert')).toContainText("Couldn't load the folders");
  await expect(page.getByRole('alert')).toContainText('Something went wrong on our side.');
  await expect(docRows(page)).toHaveCount(2);
  await check(page, 'library-folders-error');
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(folders(page)).toHaveCount(2);
});

test('when the pages cannot load, the Library says so and retries', async ({ open, check }) => {
  const page = await open('employee', '/', { before: (p) => p.route(/\/v1\/documents\?/, failing) });
  await page.evaluate(() => window.BRAIN.go('/library'));
  await expect(page.getByText('Something went wrong on our side.')).toBeVisible();
  await expect(folders(page)).toHaveCount(2); // the folders still show
  await check(page, 'library-error');
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(docRows(page)).toHaveCount(2);
});

/** The facets without Cards, as if Cards had no pages yet. */
const withoutCards = (body) => ({ ...body, domains: body.domains.filter((d) => d.value !== 'cards') });

test('the Library reads its folders again each time it opens, not on every folder', async ({ open }) => {
  let hideCards = true;
  let asked = 0;
  let answered = 0;
  const page = await open('employee', '/', {
    before: (p) => p.route('**/v1/facets', async (route) => {
      asked += 1;
      const hide = hideCards; // what the server holds when the read reaches it
      const response = await route.fetch();
      const body = await response.json();
      await route.fulfill({ response, json: hide ? withoutCards(body) : body });
      answered += 1;
    }),
  });
  await page.evaluate(() => window.BRAIN.go('/library'));
  await expect.poll(() => answered).toBe(2); // one at sign-in, one as the Library opens
  await expect(folders(page)).toHaveText([/Payments/]);
  const opened = asked;
  await folders(page).filter({ hasText: 'Payments' }).click();
  await expect(title(page)).toHaveText('Payments');
  await back(page).click();
  await expect(folders(page)).toHaveText([/Payments/]);
  expect(asked).toBe(opened); // moving between folders reads nothing new

  hideCards = false; // Cards gains its first page meanwhile
  await page.evaluate(() => window.BRAIN.go('/governance'));
  await page.evaluate(() => window.BRAIN.go('/library'));
  await expect.poll(() => answered).toBe(opened + 1);
  await expect(folders(page)).toHaveCount(2);
  expect(await folderNames(page)).toEqual(['Cards', 'Payments']);
  expect(asked).toBe(opened + 1);
});

test('a slow folder read that lands after a newer one does not bring back the older folders', async ({ open }) => {
  let asked = 0;
  let answered = 0;
  let release = () => {};
  const held = new Promise((r) => { release = r; });
  const page = await open('employee', '/', {
    before: (p) => p.route('**/v1/facets', async (route) => {
      asked += 1;
      const read = asked;
      const response = await route.fetch();
      const body = await response.json();
      if (read === 2) await held; // the Library's first read is slow, and Cards is still empty for it
      await route.fulfill({ response, json: read <= 2 ? withoutCards(body) : body });
      answered += 1;
    }),
  });
  await page.evaluate(() => window.BRAIN.go('/library'));
  await expect.poll(() => asked).toBe(2);
  await page.evaluate(() => window.BRAIN.go('/governance'));
  await page.evaluate(() => window.BRAIN.go('/library'));
  await expect.poll(() => answered).toBe(2); // sign-in's read and the newer Library read
  await expect(folders(page)).toHaveCount(2);

  release();
  await expect.poll(() => answered).toBe(3);
  await page.waitForTimeout(150); // time for the late answer to be drawn, if it were
  await expect(folders(page)).toHaveCount(2);
  expect(await folderNames(page)).toEqual(['Cards', 'Payments']);
});

/* ---------- searching and filtering ---------- */

test('a search inside a folder covers the folders under it and nothing beside it', async ({ open, check }) => {
  const page = await open('employee', '/library/payments');
  await search(page).fill('limits');
  await expect(docRows(page)).toHaveText([/Transfer limits policy/]); // two levels down
  await expect(folders(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Remove filter In Payments' })).toBeVisible();
  await check(page, 'library-search-in-folder');
  await search(page).fill('card');
  await expect(page.getByText('Nothing matches')).toBeVisible(); // Cards sits beside Payments

  await page.getByRole('button', { name: 'Remove filter In Payments' }).click();
  await expect(page).toHaveURL(/\/library$/);
  await expect(docRows(page)).toHaveText([/Card replacement fees/, /Cards FAQ/]);
  await search(page).fill('');
  await expect(folders(page)).toHaveCount(2);
});

test('a search one level down never reaches the folder above', async ({ open }) => {
  const page = await open('employee', '/library/payouts');
  await search(page).fill('kyc');
  await expect(page.getByText('Nothing matches')).toBeVisible();
  await search(page).fill('');
  await expect(folders(page)).toHaveText([/Cross-border/]); // back to browsing the same folder
  await expect(title(page)).toHaveText('Payouts');
});

test('source, folder and search combine, and each can be undone', async ({ open, check }) => {
  const page = await open('employee', '/library/payments');
  await filter(page, /^Confluence/);
  await expect(docRows(page)).toHaveCount(3);
  expect((await titles(page)).sort()).toEqual(['KYC onboarding procedure', 'Savings rate sheet', 'Transfer limits policy']);
  await expect(page.getByRole('button', { name: 'Remove filter In Payments' })).toBeVisible();
  await check(page, 'library-filtered');

  await search(page).fill('card');
  await expect(page.getByText('Nothing matches')).toBeVisible();
  await check(page, 'library-nothing-matches');

  await page.getByRole('button', { name: 'Remove filter In Payments' }).click();
  await expect(docRows(page)).toHaveText([/Card replacement fees/, /Cards FAQ/]);
  await search(page).fill('');
  await expect(docRows(page)).toHaveCount(7); // a source filter at the root lists every page
  await expect(folders(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Remove filter Confluence' }).click();
  await expect(page.locator('#libchips')).toBeHidden();
  await expect(folders(page)).toHaveCount(2);
});

test('the Filter menu has no Domain section: folders are the domains', async ({ open }) => {
  const page = await open('employee', '/library');
  await page.getByRole('button', { name: 'Filter', exact: true }).click();
  await expect(page.locator('#lfmenu').getByText('Source', { exact: true })).toBeVisible();
  await expect(page.locator('#lfmenu').getByText('Domain')).toHaveCount(0);
});

/* ---------- the drawer ---------- */

test("a document's details, its domain as folders, and its location as a filter", async ({ open, check }) => {
  const page = await open('employee', '/library/payments');
  await docRows(page).filter({ hasText: 'KYC onboarding procedure' }).click();
  const drawer = page.locator('#drawer');
  await expect(drawer.getByRole('heading', { name: 'KYC onboarding procedure' })).toBeVisible();
  await expect(drawer.getByRole('link', { name: /Open in Confluence/ })).toHaveAttribute('target', '_blank');
  await drawer.getByRole('button', { name: 'Details and lineage' }).click(); // everyone reads the details
  await expect(page.locator('#modal')).toContainText('Admins and compliance see which answers cited this document.'); // the lineage is theirs
  await expect(page.locator('#modal').getByRole('button', { name: 'Share more widely' })).toBeVisible(); // asking for wider sharing lives with the details
  await page.locator('#modal [data-close-modal]').click();
  await expect(drawer.locator('.svcrumb a')).toHaveText(['Payments']);
  await check(page, 'document');

  await drawer.getByRole('button', { name: 'Payments (PAY) / Transfer limits policy' }).click();
  await expect(page).toHaveURL(/\/library$/);
  await expect(page.getByRole('button', { name: 'Remove filter Location: Payments (PAY) / Transfer limits policy' })).toBeVisible();
  await expect(docRows(page)).toHaveText([/KYC onboarding procedure/]);
  await check(page, 'library-location');
});

test("a page's Domain breadcrumb opens any folder on its path", async ({ open }) => {
  const page = await open('employee', '/library/cross-border');
  await docRows(page).filter({ hasText: 'Transfer limits policy' }).click();
  const drawer = page.locator('#drawer');
  await expect(drawer.locator('.svcrumb a')).toHaveText(['Payments', 'Payouts', 'Cross-border']);
  await drawer.locator('.svcrumb').getByRole('link', { name: 'Payouts' }).click();
  await expect(page).toHaveURL(/\/library\/payouts$/);
  await expect(drawer).not.toHaveClass(/\bon\b/);
  await expect(folders(page)).toHaveText([/Cross-border/]);
});

/* Label problems (labelling spec 4.1 and 4.2). The warnings and counts are answered here, so the
   shared corpus stays as every other test expects; broth-service's tests cover how they arise. */
const WARNINGS = ['Unknown Broth label "broth-domian-cards".', "Labels can't lower sensitivity below the space's Confidential."];
async function withWarnings(p, name) {
  await p.route('**/v1/documents/*', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    await route.fulfill({ response, json: body.title === name ? { ...body, label_warnings: WARNINGS } : body });
  });
}

test("a document's label problems say what to fix, and other documents show none", async ({ open, check }) => {
  const page = await open('employee', '/library/cards', { before: (p) => withWarnings(p, 'Cards FAQ') });
  await docRows(page).filter({ hasText: 'Cards FAQ' }).click();
  const drawer = page.locator('#drawer');
  const box = drawer.getByRole('note');
  await expect(box.getByText('Label problems')).toBeVisible();
  await expect(box.locator('li')).toHaveText(WARNINGS);
  await expect(box).toContainText('Fix the labels in Confluence');
  await check(page, 'document-label-problems');

  await page.locator('[data-close-drawer]').first().click();
  await docRows(page).filter({ hasText: 'Card replacement fees' }).click();
  await expect(drawer.getByRole('heading', { name: 'Card replacement fees' })).toBeVisible();
  await expect(drawer.getByRole('note')).toHaveCount(0);
});

/** The label_problems and domain of each /v1/documents request. */
function recordQueries(p, into) {
  p.on('request', (r) => {
    if (!r.url().includes('/v1/documents?')) return;
    const q = new URL(r.url()).searchParams;
    into.push({ problems: q.get('label_problems'), domain: q.get('domain') });
  });
}

test('admins can filter the Library to label problems', async ({ open, check }) => {
  const requests = [];
  const page = await open('admin', '/library', {
    before: async (p) => {
      await p.route('**/v1/facets', async (route) => {
        const response = await route.fetch();
        await route.fulfill({ response, json: { ...(await response.json()), label_problems: 2 } });
      });
      recordQueries(p, requests);
    },
  });
  await page.getByRole('button', { name: 'Filter', exact: true }).click();
  await expect(page.locator('#lfmenu').getByRole('button', { name: /^Label problems/ })).toContainText('2');
  await check(page, 'library-label-filter');
  await page.locator('#lfmenu').getByRole('button', { name: /^Label problems/ }).click();
  await expect(page.getByRole('button', { name: 'Remove filter Label problems' })).toBeVisible();
  await expect.poll(() => requests.at(-1)).toEqual({ problems: 'true', domain: null });
  await page.getByRole('button', { name: 'Remove filter Label problems' }).click();
  await expect.poll(() => requests.at(-1)).toEqual({ problems: null, domain: null });
});

test('label problems inside a folder are those of the folder and the folders under it', async ({ open }) => {
  const requests = [];
  const page = await open('admin', '/library/payments', { before: (p) => recordQueries(p, requests) });
  await filter(page, /^Label problems/);
  await expect.poll(() => requests.at(-1)).toEqual({ problems: 'true', domain: 'payments' });
  await expect(page.getByRole('button', { name: 'Remove filter In Payments' })).toBeVisible();
});

test('people who review nothing see no label problems filter', async ({ open }) => {
  const page = await open('employee', '/library');
  await page.getByRole('button', { name: 'Filter', exact: true }).click();
  await expect(page.locator('#lfmenu').getByText('Labels')).toHaveCount(0);
});
