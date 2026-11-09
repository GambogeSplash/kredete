// The Library (sandbox spec 6.2: library filters and search; plan C6). As Eve, who can open
// seven of the corpus pages: three in Payments, two in Cards, two in Engineering.
import { expect, test } from './fixtures.mjs';

const rows = (page) => page.locator('#libbody .lrow');
const titles = (page) => rows(page).locator('.ltt > span').allTextContents();
async function filter(page, option) {
  await page.getByRole('button', { name: 'Filter', exact: true }).click();
  await page.locator('#lfmenu').getByRole('button', { name: option }).click();
}

test('the Library lists the documents you can open', async ({ open, check }) => {
  const page = await open('employee', '/library');
  await expect(rows(page)).toHaveCount(7);
  await check(page, 'library');
});

test('source, domain and search combine, and each can be undone', async ({ open, check }) => {
  const page = await open('employee', '/library');
  await filter(page, /^Confluence/);
  await filter(page, /^Payments/);
  await expect(rows(page)).toHaveCount(3);
  expect((await titles(page)).sort()).toEqual(['KYC onboarding procedure', 'Savings rate sheet', 'Transfer limits policy']);
  await expect(page.getByRole('button', { name: 'Clear all' })).toBeVisible();
  await check(page, 'library-filtered');

  await page.getByRole('searchbox', { name: 'Search the library' }).fill('card');
  await expect(page.getByText('Nothing matches')).toBeVisible();
  await check(page, 'library-nothing-matches');

  await page.getByRole('button', { name: 'Remove filter Payments' }).click();
  await expect(rows(page)).toHaveCount(2);
  expect((await titles(page)).sort()).toEqual(['Card replacement fees', 'Cards FAQ']);
  await page.getByRole('searchbox', { name: 'Search the library' }).fill('');
  await page.getByRole('button', { name: 'Remove filter Confluence' }).click();
  await expect(rows(page)).toHaveCount(7);
  await expect(page.locator('#libchips')).toBeHidden();
});

test('the grid view', async ({ open, check }) => {
  const page = await open('employee', '/library');
  await page.getByRole('button', { name: 'Grid view' }).click();
  await expect(page.locator('#libbody .gcard')).toHaveCount(7);
  await expect(page.getByRole('button', { name: 'Grid view' })).toHaveAttribute('aria-pressed', 'true');
  await check(page, 'library-grid');
});

test("a document's details, and its folder as a filter", async ({ open, check }) => {
  const page = await open('employee', '/library');
  await rows(page).filter({ hasText: 'KYC onboarding procedure' }).click();
  const drawer = page.locator('#drawer');
  await expect(drawer.getByRole('heading', { name: 'KYC onboarding procedure' })).toBeVisible();
  await expect(drawer.getByRole('link', { name: /Open in Confluence/ })).toHaveAttribute('target', '_blank');
  await expect(drawer.getByRole('button', { name: 'Share more widely' })).toBeVisible();
  await expect(drawer.getByRole('button', { name: 'Lineage' })).toHaveCount(0); // admins and compliance only
  await check(page, 'document');

  await drawer.getByRole('button', { name: 'Payments (PAY) / Transfer limits policy' }).click();
  await expect(page.getByRole('button', { name: 'Remove filter Folder: Payments (PAY) / Transfer limits policy' })).toBeVisible();
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page)).toContainText('KYC onboarding procedure');
  await check(page, 'library-folder');
});

test('when the Library cannot load, it says so and retries', async ({ open, check }) => {
  const page = await open('employee', '/', {
    before: (p) => p.route(/\/v1\/documents\?/, (route) => route.fulfill({
      status: 500,
      contentType: 'application/problem+json',
      body: JSON.stringify({ title: 'Something went wrong on our side.', status: 500 }),
    })),
  });
  await page.evaluate(() => window.BRAIN.go('/library'));
  await expect(page.getByText('Something went wrong on our side.')).toBeVisible();
  await check(page, 'library-error');
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(rows(page)).toHaveCount(7);
});
