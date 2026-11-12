// A dialog that puts focus somewhere itself keeps it: the default focus every dialog gets a moment
// after opening must not take it back. One that chooses nothing still gets focus inside.
import { expect, test } from './fixtures.mjs';

/** Longer than the default focus waits, so a late steal would have happened. */
const settle = (page) => page.waitForTimeout(250);

test('typing as soon as Add a product opens goes into its name', async ({ open }) => {
  const page = await open('admin', '/support-agent');
  await page.getByRole('link', { name: /Kredete Help/ }).click();
  await page.getByRole('navigation', { name: 'Support agent' }).getByRole('button', { name: 'Products' }).click();
  await page.getByRole('button', { name: /Add a product/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Add a product' });
  await page.keyboard.type('Docs');
  await settle(page);
  await expect(dialog.getByLabel('Name')).toHaveValue('Docs');
  await expect(dialog.getByLabel('Name')).toBeFocused();
});

test('New bot keeps focus on its name', async ({ open }) => {
  const page = await open('admin', '/support-agent');
  await page.getByRole('button', { name: 'New bot' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'New bot' });
  await settle(page);
  await expect(dialog.getByLabel('Name')).toBeFocused();
});

test('a confirmation keeps focus on its safe choice', async ({ open }) => {
  const page = await open('admin', '/support-agent');
  await page.getByRole('link', { name: /Kredete Help/ }).click();
  await page.getByRole('button', { name: /^More actions for / }).click();
  await page.getByRole('menuitem', { name: 'Archive bot…' }).click();
  const sure = page.getByRole('alertdialog', { name: /^Archive / });
  await settle(page);
  await expect(sure.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await sure.getByRole('button', { name: 'Cancel' }).click();
});

test('Edit workspace keeps focus on the workspace name', async ({ open }) => {
  const page = await open('admin', '/admin/workspace');
  await page.locator('#wsedit').click();
  const dialog = page.getByRole('dialog', { name: 'Edit workspace' });
  await page.keyboard.type('X');
  await settle(page);
  await expect(dialog.getByLabel('Workspace name')).toBeFocused();
  await expect(dialog.getByLabel('Workspace name')).toHaveValue(/X$/);
});

test('New domain keeps focus on its name', async ({ open }) => {
  const page = await open('admin', '/admin/domains');
  await page.getByRole('button', { name: 'New domain' }).click();
  const dialog = page.getByRole('dialog', { name: 'New domain' });
  await page.keyboard.type('Card');
  await settle(page);
  await expect(dialog.getByRole('textbox', { name: 'Name' })).toHaveValue('Card');
});

test('a dialog that chooses no focus still gets it inside', async ({ open }) => {
  const page = await open('employee', '/library/payments');
  await page.locator('#libbody [data-open]').filter({ hasText: 'KYC onboarding procedure' }).click();
  await page.locator('#drawer').getByRole('button', { name: 'Details and lineage' }).click();
  const details = page.getByRole('dialog', { name: 'Details and lineage' });
  await settle(page);
  expect(await details.evaluate((el) => el.contains(document.activeElement))).toBe(true);
});
