// Chat history (sandbox spec 6.2: history paging, pin, rename and delete). As Kofi, whose 26
// seeded chats ("Earlier question 01" newest to "26" oldest, 25 and 26 pinned) no other
// scenario changes. Serial: the later steps change what the earlier ones read.
import { expect, test } from './fixtures.mjs';

test.describe.configure({ mode: 'serial' });

const phone = (page) => page.viewportSize().width < 900;
/** On a phone the chat list lives in the menu. */
async function sidebar(page) {
  if (phone(page)) await page.getByRole('button', { name: 'Open menu' }).click();
  return page.locator('#srec');
}
const chatRows = (page) => page.locator('#srec [data-chat]');
const titles = (locator) => locator.evaluateAll((els) => els.map((e) => e.textContent.trim()));

test('the sidebar lists pinned chats first and pages without duplicates', async ({ open }) => {
  const page = await open('developer', '/');
  const list = await sidebar(page);
  await expect(chatRows(page)).toHaveCount(20);
  await expect(list.locator('.sgl').first()).toHaveText('Pinned');
  expect((await titles(chatRows(page))).slice(0, 2)).toEqual(['Earlier question 25', 'Earlier question 26']);
  await list.evaluate((el) => { el.scrollTop = el.scrollHeight; el.dispatchEvent(new Event('scroll')); });
  await expect(chatRows(page)).toHaveCount(26);
  const ids = await chatRows(page).evaluateAll((els) => els.map((e) => e.dataset.chat));
  expect(new Set(ids).size).toBe(26);
});

test('the sidebar groups chats by day', async ({ open, check }) => {
  // Times relative to the browser's clock, so the groups do not depend on when the suite runs.
  const page = await open('developer', '/', {
    before: (p) => p.route(/\/v1\/conversations\?/, async (route) => {
      const now = Date.now();
      const at = (ms) => new Date(now - ms).toISOString();
      const chat = (n, title, ago, pinned = false) => ({ id: `00000000-0000-7000-8000-00000000000${n}`, title, pinned, created_at: at(ago), updated_at: at(ago) });
      const H = 3_600_000;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            chat(1, 'Card replacement fees', 30 * 24 * H, true),
            chat(2, 'Release checklist steps', 1 * 60_000),
            chat(3, 'Daily transfer limits', 24 * H),
            chat(4, null, 3 * 24 * H),
            chat(5, 'Savings interest rates', 12 * 24 * H),
          ],
          next_cursor: null,
        }),
      });
    }),
  });
  await sidebar(page);
  await expect(page.locator('#srec .sgl')).toHaveText(['Pinned', 'Today', 'Yesterday', 'Previous 7 days', 'Earlier']);
  await expect(chatRows(page).nth(3)).toHaveText('Untitled chat');
  await check(page, 'sidebar-groups', { mask: ['.lh-t'], chats: true });
});

test('the Chats page lists every chat and finds them by title', async ({ open, check }) => {
  const page = await open('developer', '/chats');
  const rows = page.locator('#chl .chr');
  await expect(rows).toHaveCount(20);
  await check(page, 'chats');
  await page.getByRole('button', { name: 'Show more' }).click();
  await expect(rows).toHaveCount(26);
  await expect(page.getByRole('button', { name: 'Show more' })).toHaveCount(0);

  await page.getByRole('searchbox', { name: 'Search chats' }).fill('Earlier question 07');
  await expect(rows.first()).toContainText('Earlier question 07');
  await page.getByRole('searchbox', { name: 'Search chats' }).fill('xylophone');
  await expect(page.getByText('No chats match')).toBeVisible();
  await check(page, 'chats-no-match');
});

test('rename, pin and delete from the Chats page, and they stick', async ({ open, check }) => {
  const page = await open('developer', '/chats');
  const rows = page.locator('#chl .chr');
  const row = (title) => rows.filter({ hasText: title });
  const menu = async (title) => {
    await row(title).getByRole('button', { name: 'Chat actions' }).click();
    return page.getByRole('menu');
  };

  await (await menu('Earlier question 03')).getByRole('menuitem', { name: 'Rename' }).click();
  const input = page.getByRole('textbox', { name: 'Chat title' });
  await input.fill('Transfer limits for business accounts');
  await input.press('Enter');
  await expect(row('Transfer limits for business accounts')).toHaveCount(1);

  const actions = await menu('Earlier question 04');
  await check(page, 'chats-menu');
  await actions.getByRole('menuitem', { name: 'Pin to top' }).click();
  await expect(rows.nth(0)).toContainText('Earlier question 04');
  await expect(rows.nth(0).getByLabel('Pinned')).toBeVisible();

  const remove = (await menu('Earlier question 05')).getByRole('menuitem', { name: 'Delete chat' });
  await remove.click();
  await expect(page.getByRole('menuitem', { name: 'Confirm delete' })).toBeVisible();
  await page.getByRole('menuitem', { name: 'Confirm delete' }).click();
  await expect(row('Earlier question 05')).toHaveCount(0);

  await page.reload();
  await expect(rows).toHaveCount(20);
  await page.getByRole('button', { name: 'Show more' }).click();
  await expect(rows).toHaveCount(25);
  expect((await titles(rows.locator('.actt b'))).slice(0, 3)).toEqual(['Earlier question 04', 'Earlier question 25', 'Earlier question 26']);
  await expect(row('Transfer limits for business accounts')).toHaveCount(1);
  await expect(row('Earlier question 05')).toHaveCount(0);
  await sidebar(page);
  await expect(page.locator('#srec')).toContainText('Transfer limits for business accounts');
});
