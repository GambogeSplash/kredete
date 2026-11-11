// The Support agent on the real stack (bot admin spec 4 to 7, plan AE1), with the seeded
// "Kredete Help" bot: sources over the Payments space, one live product on this client's
// origin ("Help site") and one revoked ("Old help site").
//
// Views share one stack, so tests that create bots or products name them for the view and the
// run, and never assume how many bots there are.
import { expect, test } from './fixtures.mjs';

const SEEDED = 'Kredete Help';
const phone = (page) => page.viewportSize().width < 700;
/** A name no other view or run uses. */
const unique = (base, info) => `${base} ${info.project.name.replace(/\W/g, '')}${Date.now().toString(36).slice(-4)}`.slice(0, 32);

async function openSeeded(open, page = 'overview') {
  const p = await open('admin', '/agent');
  await p.getByRole('link', { name: new RegExp(SEEDED) }).click();
  await expect(p).toHaveURL(/\/agent\/[0-9a-f-]{36}\/overview$/);
  if (page !== 'overview') {
    await p.getByRole('navigation', { name: 'Support agent' }).getByRole('button', { name: new RegExp(page, 'i') }).click();
    await expect(p).toHaveURL(new RegExp(`/${page}$`));
  }
  return p;
}

test.describe('the bot list', () => {
  test('lists every bot with its sources, products and status', async ({ open, check }) => {
    // Other views add bots to the shared stack; the snapshot shows the seeded one alone.
    const page = await open('admin', '/agent', { before: (p) => p.route(/\/v1\/admin\/bots$/, async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      await route.fulfill({ response, json: { ...body, items: body.items.filter((b) => b.name === SEEDED) } });
    }) });
    const row = page.getByRole('link', { name: new RegExp(SEEDED) });
    await expect(row).toContainText('1 source');
    await expect(row).toContainText('1 of 2 live');
    await expect(row).toContainText('Live on 1 site');
    await check(page, 'agent-bots');
  });

  test('a row opens the bot, and All bots comes back to the list', async ({ open }) => {
    const page = await openSeeded(open);
    await expect(page.getByRole('navigation', { name: 'Support agent' })).toContainText(SEEDED);
    await page.getByRole('link', { name: 'All bots' }).click();
    await expect(page).toHaveURL(/\/agent$/);
    await expect(page.getByRole('link', { name: new RegExp(SEEDED) })).toBeVisible();
  });

  test('an unknown bot says so', async ({ open }) => {
    const page = await open('admin', '/agent/00000000-0000-4000-8000-000000000000/overview');
    await expect(page.getByRole('heading', { name: "This bot doesn't exist" })).toBeVisible();
  });

  test('New bot checks its fields, then opens Knowledge for the new bot', async ({ open, check }, info) => {
    const page = await open('admin', '/agent');
    await page.getByRole('button', { name: 'New bot' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'New bot' });
    await dialog.getByLabel('Contact link').fill('http://kredete.com/support');
    await dialog.getByRole('button', { name: 'Create bot' }).click();
    await expect(dialog.getByText('Required.')).toHaveCount(2); // name and privacy link
    await expect(dialog.getByText('Use an https link or a mailto: address.')).toBeVisible();
    await expect(dialog.getByLabel('Name')).toBeFocused();
    await check(page, 'agent-new-bot');
    const name = unique('Docs bot', info);
    await dialog.getByLabel('Name').fill(name);
    await dialog.getByLabel('Contact link').fill('mailto:help@kredete.com');
    await dialog.getByLabel('Privacy link').fill('https://kredete.com/privacy');
    await dialog.getByRole('button', { name: 'Create bot' }).click();
    await expect(page).toHaveURL(/\/agent\/[0-9a-f-]{36}\/knowledge$/);
    await expect(page.getByRole('navigation', { name: 'Support agent' })).toContainText(name);
  });
});
