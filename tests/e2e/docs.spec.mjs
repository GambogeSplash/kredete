// The product user docs (user docs spec 4). The e2e API serves broth-service's real
// user-docs/, so these tests also prove that every section a screen links to exists.
import { expect, test } from './fixtures.mjs';

const cards = (page) => page.locator('#dcgrid .dccard');
const toc = (page) => page.getByRole('complementary', { name: 'On this page' });

test('the contents, from the sidebar', async ({ open, check }) => {
  const page = await open('employee', '/');
  const mobile = (page.viewportSize() || { width: 1440 }).width < 900;
  if (mobile) await page.getByRole('button', { name: 'Open menu' }).click();
  // The icon rail on a desktop, the menu on a phone.
  await page.locator(mobile ? '#surfaces' : '#rail').getByRole('button', { name: 'Help center' }).click();
  await expect(page).toHaveURL(/\/docs$/);
  await expect(cards(page)).toHaveCount(6);
  await expect(cards(page).first()).toContainText('Getting started');
  const size = page.viewportSize() || { width: 1440, height: 900 };
  await page.mouse.move(size.width - 4, size.height - 4); // off the cards, so none shows its hover
  await check(page, 'docs');
});

test('the contents are the same topics for everyone, and the search finds articles but never the hidden Inbox one', async ({ open, check }) => {
  // The audience chips are gone: the contents list six topics, and the search reads what is inside the articles.
  const page = await open('admin', '/docs');
  await expect(cards(page).locator('b')).toHaveText(['Getting started', 'Asking questions', 'Sources and connectors', 'Owners and conflicts', 'Admin', 'Privacy and security']);
  const rows = page.locator('#dcgrid .dcrow');
  await page.getByRole('searchbox', { name: 'Search the help center' }).fill('audit log');
  await expect(rows.filter({ hasText: 'Read the audit log' })).toHaveCount(1);
  await check(page, 'docs-filtered');
  await page.getByRole('searchbox', { name: 'Search the help center' }).fill('inbox');
  await expect(rows.filter({ hasText: 'Work through your Inbox' })).toHaveCount(0);
  await page.getByRole('searchbox', { name: 'Search the help center' }).fill('xylophone');
  await expect(page.getByText('No articles match')).toBeVisible();
});

test('an article, its sections, and links between articles', async ({ open, check }) => {
  const page = await open('employee', '/docs');
  // Labelling pages is listed in the Owners and conflicts topic: open the topic, then the article from its list.
  await cards(page).filter({ hasText: 'Owners and conflicts' }).click();
  await page.locator('.dcnav').getByRole('link', { name: 'Labelling pages' }).click();
  await expect(page).toHaveURL(/\/docs\/labelling-pages$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Labelling pages' })).toBeVisible();
  await expect(page.locator('.dcprose table')).toBeVisible();
  await expect(page).toHaveTitle('Labelling pages - Broth help center');
  const mobile = (page.viewportSize() || { width: 1440 }).width < 900;
  if (mobile) {
    await expect(toc(page)).toBeHidden();
    await page.getByText('Sections', { exact: true }).click();
    await check(page, 'docs-article-sections');
    await page.locator('.dcsecm').getByRole('link', { name: 'Restricted pages and Broth' }).click();
  } else {
    await check(page, 'docs-article');
    await toc(page).getByRole('link', { name: 'Restricted pages and Broth' }).click();
    await expect(toc(page).getByRole('link', { name: 'Restricted pages and Broth' })).toHaveAttribute('aria-current', 'location');
  }
  await expect(page).toHaveURL(/#restricted-pages$/);
  await expect(page.locator('#restricted-pages')).toBeInViewport();

  await page.locator('.dcprose').getByRole('link', { name: 'Fixing label problems' }).click();
  await expect(page).toHaveURL(/\/docs\/fixing-label-problems$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Fixing label problems' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1, name: 'Labelling pages' })).toBeVisible();
  await page.locator('.dcback').click();
  await expect(cards(page)).toHaveCount(6);
});

test('an unknown section opens the article at the top, and an unknown article says so', async ({ open, check }) => {
  const page = await open('employee', '/docs/setting-up-spaces#no-such-section');
  await expect(page.getByRole('heading', { level: 1, name: 'Setting up spaces' })).toBeInViewport();
  const missing = await open('employee', '/docs/no-such-article');
  await expect(missing.getByText("This article doesn't exist")).toBeVisible();
  await check(missing, 'docs-missing');
  await missing.getByRole('link', { name: 'See all help articles' }).click();
  await expect(cards(missing)).toHaveCount(6);
});

test('the docs say when they cannot be loaded, and try again', async ({ open, check }) => {
  let fail = true;
  const page = await open('employee', '/docs', {
    before: (p) => p.route('**/v1/docs', (route) => (fail ? route.fulfill({ status: 503, contentType: 'application/problem+json', body: JSON.stringify({ title: 'Service not ready', status: 503, code: 'not_ready' }) }) : route.fallback())),
  });
  await expect(page.getByRole('alert')).toContainText('Service not ready');
  await check(page, 'docs-error');
  fail = false;
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(cards(page)).toHaveCount(6);
});

test('signed out, the docs open on their own with a way back', async ({ open, check }) => {
  const page = await open(null, '/docs');
  await expect(page.getByRole('heading', { level: 1, name: 'Help center' })).toBeVisible();
  await expect(page.locator('#surfaces .surf')).toHaveCount(0);
  await check(page, 'docs-signed-out');
  await cards(page).filter({ hasText: 'Sources and connectors' }).click();
  await page.locator('.dcnav').getByRole('link', { name: 'Setting up spaces' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Setting up spaces' })).toBeVisible();
  await check(page, 'docs-signed-out-article');
  await page.getByRole('link', { name: 'Back to sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
});

test('every section a screen links to exists', async ({ open }) => {
  const page = await open(null, '/docs');
  const targets = await page.evaluate(() => Object.values(window.DOCS.links));
  expect(targets.length).toBeGreaterThan(0);
  for (const target of targets) {
    const [slug, anchor] = target.split('#');
    await page.goto(`/docs/${slug}#${anchor}`);
    await expect(page.locator(`.dcprose [id="${anchor}"]`), target).toBeInViewport();
  }
});

test("a page's label problems link to what they mean", async ({ open }) => {
  const page = await open('employee', '/library/cards', {
    before: (p) => p.route('**/v1/documents/*', async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      await route.fulfill({ response, json: body.title === 'Cards FAQ' ? { ...body, label_warnings: ['Unknown Broth label "broth-domian-cards".'] } : body });
    }),
  });
  await page.locator('#libbody [data-open]').filter({ hasText: 'Cards FAQ' }).click();
  await page.locator('#drawer').getByRole('link', { name: 'What these mean' }).click();
  await expect(page).toHaveURL(/\/docs\/labelling-pages#label-problems$/);
  await expect(page.locator('#drawer')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('#label-problems')).toBeInViewport();
});
