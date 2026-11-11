// The account page: profile, sessions and signing out (sandbox spec 4.2; plan C2). As Dami,
// whom no other scenario uses. Serial: the last steps end Dami's sessions.
import { expect, test } from './fixtures.mjs';

test.describe.configure({ mode: 'serial' });

/** This browser's device name depends on the machine the suite runs on. */
const THIS_DEVICE = '.sesdt .ds-tr:has(.tag.blue) .ltb b';

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
  await expect(page.getByRole('table', { name: 'Devices' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Devices' })).toHaveCount(0);
  await expect(page.locator('.sesdt .ds-tr:not(.ds-th)')).toHaveCount(total);
  await expect(page.locator('.sesdt .tag.blue')).toHaveText('This device');
  await check(page, 'sessions', { mask: [THIS_DEVICE] });

  // Signing a device out takes two presses: the first arms the button, which then reads Confirm sign out.
  const other = page.locator('.sesdt .ds-tr:not(.ds-th)').filter({ hasNot: page.locator('.tag.blue') }).first().getByRole('button', { name: /sign out/i });
  await other.click();
  await other.click();
  await expect(page.locator('#toast')).toContainText('Device signed out');
  await expect(page.locator('.sesdt .ds-tr:not(.ds-th)')).toHaveCount(total - 1);
});

test('sign out of every other device, then of this one', async ({ open, check }) => {
  const page = await open('owner', '/account/sessions');
  // Two presses: the first arms the button (Confirm sign out of all), the second signs the others out.
  const all = page.getByRole('button', { name: /sign out of all/i });
  await all.click();
  await all.click();
  await expect(page.locator('.sesdt .ds-tr:not(.ds-th)')).toHaveCount(1, { timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Sign out of all other devices' })).toHaveCount(0);
  await check(page, 'sessions-one-device', { mask: [THIS_DEVICE] });

  if (page.viewportSize().width < 900) await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('button', { name: 'Account', exact: true }).click();
  // Sign out takes two presses; the menu stays open after the first.
  const signOut = page.getByRole('menu', { name: 'Profile' }).getByRole('menuitem', { name: /sign out/i });
  await signOut.click();
  await signOut.click();
  await expect(page).toHaveURL(/\/signin$/);
  await page.reload();
  await expect(page).toHaveURL(/\/signin$/); // the session is gone on the server too
});
