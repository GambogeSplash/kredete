// The account page: profile, sessions and signing out (sandbox spec 4.2; plan C2). As Dami,
// whom no other scenario uses. Serial: the last steps end Dami's sessions.
import { expect, test } from './fixtures.mjs';

test.describe.configure({ mode: 'serial' });

/** This browser's device name depends on the machine the suite runs on. */
const THIS_DEVICE = '.sesdt .dt-r:has(.tag.ok) .dtp b';

test('the profile, and a preferred name that sticks', async ({ open, check }) => {
  const page = await open('owner', '/account');
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Dami Bello' })).toBeVisible();
  await check(page, 'account');

  await page.getByRole('button', { name: 'Edit' }).click();
  const name = page.getByRole('textbox', { name: 'Preferred name' });
  await name.fill('Dee');
  await check(page, 'account-edit-name');
  await name.press('Enter');
  await expect(page.locator('#toast')).toContainText('Saved');
  await page.reload();
  await expect(page.locator('#acpane')).toContainText('Dee');

  await page.getByRole('button', { name: 'Edit' }).click();
  await page.getByRole('textbox', { name: 'Preferred name' }).fill('');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('#acpane .frow').first()).toContainText('Dami');
});

test('sessions list every signed-in device', async ({ open, check, seed }) => {
  const page = await open('owner', '/account/sessions');
  const total = seed.people.owner.refresh_tokens.length;
  await expect(page.getByRole('heading', { name: `Signed in on ${total} devices` })).toBeVisible();
  await expect(page.locator('.sesdt .dt-r:not(.dt-h)')).toHaveCount(total);
  await expect(page.locator('.sesdt .tag.ok')).toHaveText('This device');
  await check(page, 'sessions', { mask: [THIS_DEVICE] });

  await page.locator('.sesdt .dt-r:not(.dt-h)').filter({ hasNot: page.locator('.tag.ok') }).first().getByRole('button', { name: 'Sign out' }).click();
  await expect(page.locator('#toast')).toContainText('Device signed out');
  await expect(page.getByRole('heading', { name: `Signed in on ${total - 1} devices` })).toBeVisible();
});

test('sign out of every other device, then of this one', async ({ open, check }) => {
  const page = await open('owner', '/account/sessions');
  await page.getByRole('button', { name: 'Sign out of all other devices' }).click();
  await expect(page.getByRole('heading', { name: 'Signed in on 1 device' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Sign out of all other devices' })).toHaveCount(0);
  await check(page, 'sessions-one-device', { mask: [THIS_DEVICE] });

  if (page.viewportSize().width < 900) await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('button', { name: 'Account', exact: true }).click();
  await page.getByRole('menu', { name: 'Profile' }).getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/signin$/);
  await page.reload();
  await expect(page).toHaveURL(/\/signin$/); // the session is gone on the server too
});
