// Split search (split search spec 5.3): the chat list's own search, the palette's people, and a
// person's page. The chat search runs as Gina, a person only this spec signs in as, so the chat
// it asks for is the only one she has. Serial: the later steps read that chat.
import { expect, test } from './fixtures.mjs';

test.describe.configure({ mode: 'serial' });

const phone = (page) => page.viewportSize().width < 900;
/** On a phone the chat list and its search live in the menu. */
async function menu(page) {
  if (phone(page)) await page.getByRole('button', { name: 'Open menu' }).click();
}
const searchChats = (page) => page.locator('#sbsearch').getByRole('searchbox', { name: 'Search chats' });
const hits = (page) => page.locator('#srec [data-hit]');

async function ask(page, question) {
  await page.getByRole('textbox', { name: 'Ask a question' }).fill(question);
  await page.keyboard.press('Enter');
  await expect(page.locator('.dsend.stop, .dsend.busy')).toHaveCount(0, { timeout: 20_000 });
  await expect(page.locator('#cxtitle')).not.toHaveText('Untitled chat');
}

test('the chat list finds a chat by what Broth answered and opens it at that answer', async ({ open, check, seed }) => {
  const page = await open('searcher', '/');
  await ask(page, seed.questions.answered.question);
  // Search from a fresh home page, so the results are what the chat list shows on its own.
  await page.goto('/');
  await expect(page.getByRole('textbox', { name: 'Ask a question' })).toBeVisible();

  await menu(page);
  // A word only in Broth's answer, never in the question or the title.
  await searchChats(page).fill('send');
  await expect(hits(page)).toHaveCount(1);
  await expect(hits(page).first().locator('.chs')).toContainText('Broth:');
  await expect(hits(page).first().locator('.chs mark')).toHaveText(['send']);
  await check(page, 'chat-search-results', { chats: true });

  await searchChats(page).fill('xylophone');
  await expect(page.locator('#srec')).toContainText('No chats match “xylophone”');
  await check(page, 'chat-search-no-match', { chats: true });

  await searchChats(page).press('Escape');
  await expect(searchChats(page)).toHaveValue('');
  await expect(page.locator('#srec [data-chat]')).toHaveCount(1);

  await searchChats(page).fill('send');
  await hits(page).first().click();
  await expect(page).toHaveURL(/\/c\/[0-9a-f-]{36}$/);
  await expect(page.locator('#thread article.linked')).toHaveCount(1);
});

test('the palette finds people and documents, not chats', async ({ open, check }) => {
  const page = await open('employee', '/');
  await page.keyboard.press('Control+k');
  const palette = page.getByRole('dialog', { name: 'Search' });
  await expect(palette).toBeVisible();
  await expect(palette.locator('.kh').first()).toHaveText('Recent chats');

  // Eve has 26 chats titled "Earlier question NN": typed, the palette no longer lists them.
  await page.locator('#kq').fill('Earlier question');
  await expect(palette.getByText('Nothing found')).toBeVisible();
  await expect(palette.locator('.kh')).toHaveText(['Ask']);

  // Text that matches a person and a document lists each in its own group.
  await page.locator('#kq').fill('an');
  await expect(palette.locator('.kh')).toHaveText(['Ask', 'People', 'Library']);
  await expect(palette.locator('.kg').nth(1)).toContainText('Kofi Asante');
  await expect(palette.locator('.kg').nth(2)).toContainText('Transfer limits policy');

  await page.locator('#kq').fill('dami');
  await expect(palette.locator('.kh')).toHaveText(['Ask', 'People']);
  await expect(palette.locator('.kr').nth(1)).toContainText('Dami Bello');
  await check(page, 'palette-people');

  await palette.locator('.kr').nth(1).click();
  await expect(page).toHaveURL(/\/people\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Dami Bello');
});

test('a person page shows what they own; activity only to audit readers', async ({ open, check, seed }) => {
  const dami = seed.people.owner.id;
  const page = await open('employee', `/people/${dami}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Dami Bello');
  await expect(page.getByRole('heading', { name: 'Owns' })).toBeVisible();
  await expect(page.locator('.pschips')).toContainText('Payments');
  await expect(page.getByRole('heading', { name: 'Activity' })).toHaveCount(0);
  await check(page, 'person-employee');

  const audit = await open('compliance', `/people/${dami}`);
  await expect(audit.getByRole('heading', { name: 'Activity' })).toBeVisible();
  await expect(audit.locator('#psaudt .aud-r:not(.aud-h)').first()).toBeVisible();
  await audit.locator('#psfilt .ssel-btn').first().click();
  await audit.locator('.ssel-menu .ssel-o', { hasText: /^Signed in$/ }).click();
  await expect(audit).toHaveURL(/\?action=session\.created$/);
  await expect(audit.locator('#psaudt')).not.toContainText('Answer served');
  await check(audit, 'person-compliance', { mask: ['#psaudt'] });
});

test('audit actors link to their page, and an unknown person is not found', async ({ open }) => {
  const page = await open('compliance', '/admin/audit');
  const actor = page.locator('#audt .audwho-l').first();
  await expect(actor).toBeVisible();
  await actor.click();
  await expect(page).toHaveURL(/\/people\/[0-9a-f-]{36}$/);

  const missing = await open('employee', '/people/00000000-0000-7000-8000-000000000000');
  await expect(missing.getByText('Person not found')).toBeVisible();
});

test('held-out variant 5: a person named like a document shows in People and the document in Library', async ({ open }) => {
  // No seeded person shares a document's title, so the directory answers with one who does.
  const page = await open('employee', '/', {
    before: (p) => p.route(/\/v1\/people\?/, (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [{ id: '00000000-0000-7000-8000-0000000000aa', name: 'Release Checklist', title: null, team: 'Platform', email: 'release.checklist@kredete.com' }], next_cursor: null }),
    })),
  });
  await page.keyboard.press('Control+k');
  const palette = page.getByRole('dialog', { name: 'Search' });
  await page.locator('#kq').fill('release checklist');
  await expect(palette.locator('.kh')).toHaveText(['Ask', 'People', 'Library']);
  await expect(palette.locator('.kg').nth(1).locator('.kr')).toHaveCount(1);
  await expect(palette.locator('.kg').nth(1)).toContainText('Release Checklist');
  await expect(palette.locator('.kg').nth(1)).toContainText('Platform');
  await expect(palette.locator('.kg').nth(2)).toContainText('Release checklist');
});
