// The Developer role on the real stack (developer role spec 3.5 and 7, item 4; plan DRE.1), as
// the corpus's developer, Kofi Asante: Admin shows Sources only, where docs repositories are
// the only thing to act on and Confluence is read-only; Support agent is theirs; the document
// drawer shows an anonymous lineage. The sync run's hidden count is in sync.spec.mjs, which
// reseeds for each scenario.
//
// Views share one stack, so the bot this file creates is named for the view, as agent.spec.mjs does.
import { expect, test } from './fixtures.mjs';

const phone = (page) => page.viewportSize().width < 900;
/** The Settings rail's items; a phone leaves Sign out to the profile menu. */
const railItems = (page, items) => (phone(page) ? items : [...items, 'Sign out']);
const unique = (base, info) => `${base} for ${info.project.name}`.slice(0, 32);

test('Admin shows a developer Sources only, and the other admin screens send them back there', async ({ open, check }) => {
  const page = await open('developer', '/admin/people');
  await expect(page).toHaveURL(/\/admin\/sources$/);
  const rail = page.getByRole('navigation', { name: 'Settings' });
  await expect(rail.getByRole('button')).toHaveText(railItems(page, ['Profile', 'Sessions', 'Sources']));
  // No credentials, and only docs repositories can be added.
  await expect(page.locator('[data-src="creds"]')).toHaveCount(0);
  await expect(page.locator('#cnaddcard')).toContainText('Docs repositories');
  await expect(page.locator('#cnaddcard')).not.toContainText('Confluence');
  await check(page, 'developer-sources');
  for (const path of ['/admin/workspace', '/admin/domains', '/admin/audit']) {
    await page.evaluate((p) => window.BRAIN.go(p), path);
    await expect(page).toHaveURL(/\/admin\/sources$/);
  }
});

test('a developer reads Confluence but cannot change it, and lists only spaces they can open', async ({ open, check }) => {
  const page = await open('developer', '/admin/sources/confluence');
  const card = page.locator('.cnconn').first();
  await expect(card).toBeVisible();
  for (const name of ['Sync now', 'Disconnect', 'Find spaces', 'Re-authorize', 'Settings']) {
    await expect(card.getByRole('button', { name, exact: true })).toHaveCount(0);
  }
  await expect(card.getByRole('combobox')).toHaveCount(0); // no owner to choose
  await expect(card.getByRole('checkbox')).toHaveCount(0); // nothing to include
  await expect(card.locator('.dt-r[data-space]')).toHaveText([/Cards \(CARD\)/, /Engineering \(ENG\)/, /Payments \(PAY\)/]);
  await check(page, 'developer-confluence');
});

test('a developer opens Support agent from the rail and creates a bot with its sources', async ({ open, check }, info) => {
  const page = await open('developer', '/');
  if (phone(page)) await page.getByRole('button', { name: 'Open menu' }).click();
  await page.locator(phone(page) ? '#surfaces' : '#rail').getByRole('button', { name: 'Support agent' }).click();
  await expect(page).toHaveURL(/\/support-agent/);
  await page.getByRole('button', { name: 'New bot' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'New bot' });
  await dialog.getByLabel('Name').fill(unique('Dev bot', info));
  await dialog.getByLabel('Contact link').fill('https://kredete.com/support');
  await dialog.getByLabel('Privacy link').fill('https://kredete.com/privacy');
  await dialog.getByRole('button', { name: 'Create bot' }).click();
  await expect(page).toHaveURL(/\/knowledge$/);
  await page.getByRole('checkbox', { name: /Payments \(PAY\)/ }).check();
  const bar = page.getByRole('region', { name: 'Unsaved changes' });
  await bar.getByRole('button', { name: 'Save' }).click();
  await expect(bar).toBeHidden();
  await page.reload();
  await expect(page.getByRole('checkbox', { name: /Payments \(PAY\)/ })).toBeChecked();
  await check(page, 'developer-bot-knowledge', { mask: ['.agname'] });
});

test("a developer sees a page's lineage without anyone's name", async ({ open, check, seed }) => {
  // An employee's answer cites the Payments space's home page, Transfer limits policy, so its
  // lineage has a row. (The developer's own chats are history.spec.mjs's fixed list.)
  const asker = await open('employee', '/');
  await asker.getByRole('textbox', { name: 'Ask a question' }).fill(seed.questions.answered.question);
  await asker.keyboard.press('Enter');
  await expect(asker.locator('#thread article .ans .cite')).toHaveCount(1, { timeout: 20_000 });
  await asker.close();
  const lineage = [];
  const page = await open('developer', '/library/payments', {
    before: (p) => p.on('request', (r) => { if (/\/v1\/(documents\/[^/]+\/lineage|admin\/audit)/.test(r.url())) lineage.push(new URL(r.url()).pathname); }),
  });
  await page.locator('#libbody .lcthome').filter({ hasText: 'Payments (PAY)' }).first().click();
  const drawer = page.locator('#drawer');
  await expect(drawer.getByRole('heading', { name: 'Transfer limits policy' })).toBeVisible();
  await drawer.getByRole('button', { name: 'Details and lineage' }).click();
  const rows = page.getByRole('dialog', { name: 'Details and lineage' }).locator('#lin .actr');
  await expect(rows.first()).toContainText('Cited in an answer');
  const said = (await rows.allTextContents()).join(' ');
  for (const name of ['Kofi', 'Ada', 'Eve', 'Dami', 'Chidi', 'Asante', 'Okafor']) expect(said).not.toContain(name);
  expect(lineage.length).toBeGreaterThan(0);
  expect(lineage.every((path) => /\/v1\/documents\/[^/]+\/lineage$/.test(path))).toBe(true);
  // Other views cite the page too, so the rows themselves are masked.
  await check(page, 'developer-lineage', { mask: ['#lin .actl', '.linmore'] });
});
