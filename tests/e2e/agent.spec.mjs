// The Support agent on the real stack (bot admin spec 4 to 7, plan AE1), with the seeded
// "Kredete Help" bot: sources over the Payments space, one live product on this client's
// origin ("Help site") and one revoked ("Old help site").
//
// Views share one stack, so tests that create bots or products name them for the view, find
// them by where they land rather than by name, and never assume how many bots there are.
import { expect, test } from './fixtures.mjs';

// The demo page calls the bot API on another localhost port, as bot.spec.mjs does.
test.use({ launchOptions: { args: ['--disable-features=LocalNetworkAccessChecks'] } });

const SEEDED = 'Kredete Help';
const phone = (page) => page.viewportSize().width < 700;
/** A name for the view's own bots: names need not be unique, and a fixed one keeps snapshots steady. */
const unique = (base, info) => `${base} for ${info.project.name}`.slice(0, 32);

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
    await expect(page.getByText("This bot doesn't exist")).toBeVisible();
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

/** A new bot of the test's own, opened on `page`; returns the page and its name. */
async function newBot(open, info, page = 'overview') {
  const p = await open('admin', '/agent');
  await p.getByRole('button', { name: 'New bot' }).first().click();
  const dialog = p.getByRole('dialog', { name: 'New bot' });
  const name = unique('Bot', info);
  await dialog.getByLabel('Name').fill(name);
  await dialog.getByLabel('Contact link').fill('https://kredete.com/support');
  await dialog.getByLabel('Privacy link').fill('https://kredete.com/privacy');
  await dialog.getByRole('button', { name: 'Create bot' }).click();
  await expect(p).toHaveURL(/\/knowledge$/);
  if (page !== 'knowledge') {
    await p.getByRole('navigation', { name: 'Support agent' }).getByRole('button', { name: new RegExp(page, 'i') }).click();
    await expect(p).toHaveURL(new RegExp(`/${page}$`));
  }
  return { page: p, name };
}

test.describe('Overview', () => {
  test('a live bot shows its sources, experience and products, with nothing left to do', async ({ open, check }) => {
    const page = await openSeeded(open);
    await expect(page.locator('.aghd .tag')).toHaveText('Live on 1 site');
    await expect(page.getByRole('heading', { name: 'Getting it live' })).toHaveCount(0);
    const knowledge = page.getByRole('region', { name: 'Knowledge' });
    await expect(knowledge).toContainText('Sources1');
    await expect(knowledge).toContainText('Public pages2');
    const products = page.getByRole('region', { name: 'Products' });
    await expect(products.locator('li')).toHaveCount(2);
    await expect(products.locator('li').first()).toContainText('Help site');
    await expect(products.locator('li').last()).toContainText('Revoked');
    await check(page, 'agent-overview');
  });

  test('a new bot lists what it still needs, and each step opens its page', async ({ open, check }, info) => {
    const { page } = await newBot(open, info);
    await expect(page.locator('.aghd .tag')).toHaveText('Needs setup');
    const steps = page.getByRole('region', { name: 'Getting it live' });
    await expect(steps.getByRole('button')).toHaveText(['Go to Knowledge', 'Go to Products']);
    await check(page, 'agent-overview-new', { mask: ['.agname', '[aria-labelledby="agc-experience"] .agkv:first-child dd'] });
    await steps.getByRole('button', { name: 'Go to Products' }).click();
    await expect(page).toHaveURL(/\/products$/);
  });
});

test.describe('Knowledge', () => {
  test('lists every source with its Public pages, the chosen ones ticked', async ({ open, check }) => {
    const page = await openSeeded(open, 'knowledge');
    const payments = page.getByRole('checkbox', { name: /Payments \(PAY\)/ });
    await expect(payments).toBeChecked();
    await expect(page.getByRole('checkbox', { name: /Cards \(CARD\)/ })).not.toBeChecked();
    await expect(page.locator('.agks', { has: payments })).toContainText('2 Public pages');
    await expect(page.locator('.agks', { hasText: 'Cards (CARD)' })).toContainText('No Public pages');
    await expect(page.locator('#kstotal')).toHaveText('1 source · 2 Public pages');
    await expect(page.getByRole('region', { name: 'Unsaved changes' })).toBeHidden();
    await check(page, 'agent-knowledge');
  });

  test('choosing sources asks before leaving unsaved, and saving keeps them', async ({ open, check }, info) => {
    const { page } = await newBot(open, info, 'knowledge');
    await expect(page.locator('#kstotal')).toHaveText("No sources chosen. The bot can't answer anything yet.");
    await page.getByRole('checkbox', { name: /Cards \(CARD\)/ }).check();
    await expect(page.locator('#kstotal')).toHaveText("1 source · The bot can't answer anything yet.");
    await page.getByRole('checkbox', { name: /Payments \(PAY\)/ }).check();
    const bar = page.getByRole('region', { name: 'Unsaved changes' });
    await expect(bar).toBeVisible();
    await check(page, 'agent-knowledge-unsaved', { mask: ['.agname'] });
    // Leaving asks first; staying keeps the ticks.
    await page.getByRole('navigation', { name: 'Support agent' }).getByRole('button', { name: 'Overview' }).click();
    const ask = page.getByRole('alertdialog', { name: 'Leave without saving?' });
    await expect(ask).toBeVisible();
    await check(page, 'agent-leave-unsaved', { mask: ['.agname'] });
    await ask.getByRole('button', { name: 'Keep editing' }).click();
    await expect(page).toHaveURL(/\/knowledge$/);
    await expect(page.getByRole('checkbox', { name: /Payments \(PAY\)/ })).toBeChecked();
    await bar.getByRole('button', { name: 'Save' }).click();
    await expect(bar).toBeHidden();
    await page.reload();
    await expect(page.getByRole('checkbox', { name: /Payments \(PAY\)/ })).toBeChecked();
    await expect(page.getByRole('checkbox', { name: /Cards \(CARD\)/ })).toBeChecked();
    await page.getByRole('navigation', { name: 'Support agent' }).getByRole('button', { name: 'Overview' }).click();
    await expect(page.getByRole('region', { name: 'Knowledge' })).toContainText('Cards (CARD) has no Public pages.');
    await expect(page.getByRole('region', { name: 'Getting it live' }).getByRole('button')).toHaveText(['Go to Products']);
  });

  test('Open in Library lists only that source\'s pages', async ({ open, check }) => {
    const page = await openSeeded(open, 'knowledge');
    await page.getByRole('button', { name: 'Open Payments (PAY) in the Library' }).click();
    await expect(page).toHaveURL(/\/library$/);
    await expect(page.getByRole('button', { name: 'Remove filter Source: Payments (PAY)' })).toBeVisible();
    const rows = page.locator('#libbody [data-open]');
    await expect(rows.first()).toBeVisible();
    for (const path of await rows.locator('.ltb small').allTextContents()) expect(path).toMatch(/^Payments \(PAY\)/);
    await check(page, 'library-source-filter');
  });
});

/** The preview widget's shadow root content, as a locator. */
const preview = (page) => page.locator('#exhost');

test.describe('Experience', () => {
  test('shows the settings beside the real widget, at the start and when it cannot answer', async ({ open, check }) => {
    const page = await openSeeded(open, 'experience');
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue(SEEDED);
    await expect(preview(page).getByRole('heading', { name: SEEDED })).toBeVisible();
    await expect(preview(page).getByRole('button', { name: 'What is the daily transfer limit for standard accounts?' })).toBeVisible();
    await check(page, 'agent-experience');
    await page.getByRole('button', { name: "Can't answer" }).click();
    await expect(preview(page).getByText("I couldn't find that in our help content.")).toBeVisible();
    await expect(preview(page).getByRole('link', { name: 'Contact support' })).toHaveAttribute('href', 'https://kredete.com/support');
    await check(page, 'agent-experience-cant-answer');
  });

  test('every edit shows in the preview; a wrong field stops Save; saving keeps it', async ({ open, check }, info) => {
    const { page, name } = await newBot(open, info, 'experience');
    const bar = page.getByRole('region', { name: 'Unsaved changes' });
    const form = page.locator('#exform');
    const renamed = `${name.slice(0, 28)} two`;
    await form.getByLabel('Name', { exact: true }).fill(renamed);
    await expect(preview(page).getByRole('heading', { name: renamed })).toBeVisible();
    await form.getByLabel('Greeting').fill('Ask me about fees and limits.');
    await expect(preview(page).getByText('Ask me about fees and limits.')).toBeVisible();
    // Starters: at most three, each shown as a button in the preview.
    for (const q of ['What are the fees?', 'How do limits work?', 'How do I verify?']) {
      await form.getByRole('button', { name: 'Add a starter' }).click();
      await form.getByRole('textbox', { name: /^Starter \d$/ }).last().fill(q);
    }
    await expect(form.getByRole('button', { name: 'Add a starter' })).toHaveCount(0);
    await expect(preview(page).getByRole('button', { name: 'How do limits work?' })).toBeVisible();
    await form.getByRole('button', { name: 'Remove starter 2' }).click();
    await expect(preview(page).getByRole('button', { name: 'How do limits work?' })).toHaveCount(0);
    // A link that is not https keeps Save off, and says why under the field.
    await form.getByLabel('Contact link').fill('http://kredete.com/help');
    await expect(page.getByText('Use an https link or a mailto: address.')).toBeVisible();
    await expect(bar.getByRole('button', { name: 'Save' })).toBeDisabled();
    await check(page, 'agent-experience-invalid', { mask: ['.agname'] });
    await form.getByLabel('Contact link').fill('mailto:help@kredete.com');
    await form.getByLabel('Contact label').fill('Email us');
    await bar.getByRole('button', { name: 'Save' }).click();
    await expect(bar).toBeHidden();
    await page.reload();
    await expect(form.getByLabel('Name', { exact: true })).toHaveValue(renamed);
    await expect(form.getByRole('textbox', { name: /^Starter \d$/ })).toHaveCount(2);
    await expect(page.getByRole('navigation', { name: 'Support agent' })).toContainText(renamed);
    await page.getByRole('button', { name: "Can't answer" }).click();
    await expect(preview(page).getByRole('link', { name: 'Email us' })).toHaveAttribute('href', 'mailto:help@kredete.com');
  });

  test('the preview follows the app between light and dark', async ({ open }) => {
    const page = await openSeeded(open, 'experience');
    const mode = await page.evaluate(() => document.documentElement.dataset.mode || 'light');
    await expect(preview(page)).toHaveAttribute('data-scheme', mode === 'dark' ? 'dark' : 'light');
    await page.evaluate(() => { document.documentElement.dataset.mode = document.documentElement.dataset.mode === 'dark' ? 'light' : 'dark'; });
    await expect(preview(page)).toHaveAttribute('data-scheme', mode === 'dark' ? 'light' : 'dark');
  });
});

test.describe('Products', () => {
  test('a live product shows its snippet, the sites setup and its key; a revoked one is read only', async ({ open, check }) => {
    const page = await openSeeded(open, 'products');
    // A live product is three cards (Snippet, Settings, Key) in the detail; only a revoked one is a region named for the product.
    const live = page.locator('#agpdetail');
    await expect(live.locator('#agsnip')).toContainText('data-key="bk_live_');
    await expect(live).toContainText('script-src');
    await expect(live.getByRole('link', { name: 'Open the demo page' })).toBeVisible();
    await expect(live.getByRole('textbox', { name: 'Site 1' })).toHaveValue(new URL(page.url()).origin);
    await check(page, 'agent-products', { mask: ['#agsnip', '.agkey-v'] });
    await page.getByRole('button', { name: /Old help site/ }).click();
    const old = page.getByRole('region', { name: 'Old help site' });
    await expect(old).toContainText("can't be restored");
    await expect(old.getByRole('button')).toHaveCount(0);
    await check(page, 'agent-products-revoked', { mask: ['.agkey-v', '.agpd-sub'] });
  });

  test('a new bot goes live: a product on this site, its demo page, a new key, then revoked', async ({ open, check }, info) => {
    const { page, name } = await newBot(open, info, 'knowledge');
    await page.getByRole('checkbox', { name: /Payments \(PAY\)/ }).check();
    await page.getByRole('region', { name: 'Unsaved changes' }).getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('region', { name: 'Unsaved changes' })).toBeHidden();
    await page.getByRole('navigation', { name: 'Support agent' }).getByRole('button', { name: 'Products' }).click();
    await expect(page.locator('#agpdetail').getByText('No products yet')).toBeVisible();

    // Adding a product checks its site first.
    await page.getByRole('button', { name: /Add a product/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Add a product' });
    await dialog.getByLabel('Name').fill('Docs site');
    await dialog.getByLabel('Site it runs on').fill(`${new URL(page.url()).origin}/docs`);
    await dialog.getByRole('button', { name: 'Create key' }).click();
    await expect(dialog.getByText('Use only the site, like https://help.kredete.com.')).toBeVisible();
    await check(page, 'agent-add-product', { mask: ['.agname'] });
    await dialog.getByLabel('Site it runs on').fill(new URL(page.url()).origin);
    await dialog.getByRole('button', { name: 'Create key' }).click();
    const product = page.locator('#agpdetail');
    await expect(product.locator('#agsnip')).toContainText('data-key="bk_live_');

    // The demo page loads the new bot for a visitor.
    const demo = await product.getByRole('link', { name: 'Open the demo page' }).getAttribute('href');
    const visitor = await open(null, demo);
    await visitor.getByRole('button', { name: 'Open help' }).click();
    await expect(visitor.getByRole('dialog', { name })).toBeVisible();

    // A replaced key stops working at once.
    const oldKey = new URL(demo, page.url()).searchParams.get('key');
    await product.getByRole('button', { name: 'Replace key' }).click();
    await page.getByRole('alertdialog', { name: 'Replace this key?' }).getByRole('button', { name: 'Replace key' }).click();
    await expect(product.locator('#agsnip')).not.toContainText(oldKey);
    const again = await open(null, demo);
    await expect(again.locator('#kredete-help')).toHaveCount(0);

    // Revoking cannot be undone, and says so first.
    await product.getByRole('button', { name: 'Revoke' }).click();
    const sure = page.getByRole('alertdialog', { name: 'Revoke Docs site?' });
    await expect(sure).toContainText("This can't be undone.");
    await check(page, 'agent-revoke', { mask: ['.agname', '#agsnip', '.agkey-v'] });
    await sure.getByRole('button', { name: 'Revoke' }).click();
    await expect(page.getByRole('region', { name: 'Docs site' })).toContainText("can't be restored");
    await expect(page.getByRole('button', { name: /Docs site/ })).toContainText('Revoked');
  });

  test('settings save with their own bar, and a colour that hides white text is flagged', async ({ open }, info) => {
    const { page } = await newBot(open, info, 'products');
    await page.getByRole('button', { name: /Add a product/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Add a product' });
    await dialog.getByLabel('Name').fill('App');
    await dialog.getByLabel('Site it runs on').fill('https://app.kredete.com');
    await dialog.getByRole('button', { name: 'Create key' }).click();
    const product = page.locator('#agpdetail');
    await product.getByRole('button', { name: 'Add a site' }).click();
    await product.getByRole('textbox', { name: 'Site 2' }).fill('HTTPS://Docs.Kredete.com:443/');
    await product.getByRole('textbox', { name: 'Site 2' }).blur();
    await expect(product.getByRole('textbox', { name: 'Site 2' })).toHaveValue('https://docs.kredete.com');
    await product.getByRole('textbox', { name: 'Colour as a hex value' }).fill('#26a269');
    await expect(product.getByText('White text is hard to read on this colour.', { exact: false })).toBeVisible();
    await product.getByRole('button', { name: 'Green' }).click();
    await expect(product.getByText('White text is hard to read on this colour.', { exact: false })).toHaveCount(0);
    await product.getByRole('button', { name: 'Left' }).click();
    await page.getByRole('region', { name: 'Unsaved changes' }).getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('region', { name: 'Unsaved changes' })).toBeHidden();
    await page.reload();
    const saved = page.locator('#agpdetail');
    await expect(saved.getByRole('textbox', { name: 'Site 2' })).toHaveValue('https://docs.kredete.com');
    await expect(saved.getByRole('button', { name: 'Green' })).toHaveAttribute('aria-pressed', 'true');
    await expect(saved.getByRole('button', { name: 'Left' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: /App/ })).toContainText('+1 more');
  });
});
