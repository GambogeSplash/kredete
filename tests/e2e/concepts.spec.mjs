// How Broth is organised (concepts article spec 4 and 7): it leads the Help center, the screens
// that use its terms link to their definitions, and a page shared with every employee says so.
import { expect, test } from './fixtures.mjs';

/** Follows a "How this works" link and checks it lands on the section, in the article. */
async function opensSection(page, link, anchor) {
  await link.click();
  await expect(page).toHaveURL(new RegExp(`/help/how-broth-is-organised#${anchor}$`));
  await expect(page.locator(`.dcprose [id="${anchor}"]`)).toBeInViewport();
}

test('the article is the first the Help center offers', async ({ open, check }) => {
  const page = await open('employee', '/help');
  const first = page.locator('#dcgrid .dccard').first();
  await expect(first).toHaveAttribute('href', '/help/how-broth-is-organised');
  await first.click();
  await expect(page.getByRole('heading', { name: 'How Broth is organised', level: 1 })).toBeVisible();
  await page.mouse.move(0, 0); // no hover left over from the tap on the card
  await check(page, 'docs-concepts');
  await page.goto('/help/how-broth-is-organised#roles');
  await expect(page.locator('.dcprose [id="roles"]')).toBeInViewport();
  await check(page, 'docs-concepts-roles');
});

test('a note above the topics points newcomers to the article until they close it or read it', async ({ open, check }) => {
  const page = await open('employee', '/help');
  const note = page.getByRole('complementary', { name: 'New to Broth' });
  await expect(note).toBeVisible();
  await page.mouse.move(0, 0);
  await check(page, 'docs-intro');
  // Searching shows results only; clearing the search brings the note back.
  const search = page.getByRole('searchbox', { name: 'Search the docs' });
  await search.fill('roles');
  await expect(note).toHaveCount(0);
  await search.fill('');
  await expect(note).toBeVisible();
  // Closed, it stays closed: on reload, and on the way back from an article.
  await note.getByRole('button', { name: "Close and don't show again" }).click();
  await expect(note).toHaveCount(0);
  await expect(search).toBeFocused();
  await page.reload();
  await expect(page.locator('#dcgrid .dccard').first()).toBeVisible();
  await expect(note).toHaveCount(0);
  // A fresh browser that follows the note's link has read the article: the note retires.
  await page.evaluate(() => localStorage.removeItem('broth-docs-intro-done'));
  await page.reload();
  await note.getByRole('link', { name: 'How Broth is organised' }).click();
  await expect(page.getByRole('heading', { name: 'How Broth is organised', level: 1 })).toBeVisible();
  await page.goBack();
  await expect(page.locator('#dcgrid .dccard').first()).toBeVisible();
  await expect(note).toHaveCount(0);
});

test('the People roles picker explains what roles allow', async ({ open }) => {
  const page = await open('admin', '/admin/people');
  await page.getByRole('button', { name: /^Edit / }).first().click();
  await opensSection(page, page.locator('#modal').getByRole('link', { name: 'What roles allow' }), 'roles');
});

test('Governance explains sharing more widely', async ({ open }) => {
  const page = await open('admin', '/governance');
  await opensSection(page, page.locator('.ds-head').getByRole('link', { name: 'How this works' }), 'sharing');
});

test('Domains explain what a domain is', async ({ open }) => {
  const page = await open('admin', '/admin/domains');
  await opensSection(page, page.getByRole('link', { name: 'How this works' }), 'domains');
});

test("a page's details say who can read it, in the words the article uses", async ({ open, check }) => {
  const page = await open('employee', '/library/payments');
  await page.locator('#libbody [data-open]').filter({ hasText: 'KYC onboarding procedure' }).click();
  const drawer = page.locator('#drawer');
  await expect(drawer).toContainText('Every employee');
  await expect(page.locator('body')).not.toContainText('Everyone at Broth');
  await drawer.getByRole('button', { name: 'Details and lineage' }).click();
  const details = page.getByRole('dialog', { name: 'Details and lineage' });
  await expect(details.locator('dl')).toContainText('AccessEvery employee');
  await check(page, 'details-access');
  await opensSection(page, details.getByRole('link', { name: 'Who can read a page' }), 'access');
});
