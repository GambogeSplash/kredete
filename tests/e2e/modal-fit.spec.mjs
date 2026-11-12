// A modal taller than the window stays inside it and scrolls its body; its close button stays on
// screen. The class: a dialog's content grows (a long lineage, many fields, a short window) and the
// card ran off both edges with nothing to scroll. Each scenario is a different dialog, opened in a
// window too short for it; the last one is a short dialog that should keep its natural height.
// Phones already show modals as a capped bottom sheet, so this runs on the desktop views only.
import { expect, test } from './fixtures.mjs';

test.beforeEach(({ page }, info) => { test.skip(info.project.use.viewport.width < 900, 'phones use the bottom sheet'); });

const SHORT = { width: 1440, height: 420 };

/** The open dialog fits the window, its close control is on screen, and its last control can be scrolled to. */
async function fits(page, dialog) {
  await expect(dialog).toBeVisible();
  const vh = page.viewportSize().height;
  const box = await dialog.boundingBox();
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(vh + 0.5);
  const close = dialog.locator('[data-close-modal], .xbtn').first();
  if (await close.count()) {
    const c = await close.boundingBox();
    expect(c.y).toBeGreaterThanOrEqual(0);
    expect(c.y + c.height).toBeLessThanOrEqual(vh + 0.5);
  }
  const last = dialog.locator('button:visible, input:visible, select:visible, textarea:visible, a[href]:visible').last();
  await last.scrollIntoViewIfNeeded();
  const l = await last.boundingBox();
  expect(l.y).toBeGreaterThanOrEqual(0);
  expect(l.y + l.height).toBeLessThanOrEqual(vh + 0.5);
}

test("a developer's lineage dialog fits a short window", async ({ open }) => {
  const page = await open('developer', '/library/payments');
  await page.locator('#libbody .lcthome').filter({ hasText: 'Payments (PAY)' }).first().click();
  await page.locator('#drawer').getByRole('button', { name: 'Details and lineage' }).click();
  await page.setViewportSize(SHORT);
  const dialog = page.getByRole('dialog', { name: 'Details and lineage' });
  await expect(dialog.locator('#lin .skel, #lin [aria-busy]')).toHaveCount(0);
  await fits(page, dialog);
});

test("an admin's lineage dialog, from the audit log, fits a short window", async ({ open }) => {
  const page = await open('admin', '/library/payments');
  await page.locator('#libbody .lcthome').filter({ hasText: 'Payments (PAY)' }).first().click();
  await page.locator('#drawer').getByRole('button', { name: 'Details and lineage' }).click();
  await page.setViewportSize(SHORT);
  await fits(page, page.getByRole('dialog', { name: 'Details and lineage' }));
});

test('New bot fits a short window', async ({ open }) => {
  const page = await open('admin', '/support-agent');
  await page.setViewportSize({ width: 1280, height: 380 });
  await page.getByRole('button', { name: 'New bot' }).first().click();
  await fits(page, page.getByRole('dialog', { name: 'New bot' }));
});

test('Invite people fits a short window', async ({ open }) => {
  const page = await open('admin', '/admin/people');
  await page.setViewportSize({ width: 1024, height: 340 });
  await page.getByRole('button', { name: 'Invite' }).click();
  await fits(page, page.getByRole('dialog', { name: 'Invite people' }));
});

test("editing a person fits a short window", async ({ open }) => {
  const page = await open('admin', '/admin/people');
  await page.setViewportSize({ width: 1200, height: 360 });
  await page.locator('.adrow, tr').filter({ hasText: 'Finn Adeyemi' }).first().getByRole('button', { name: 'Edit' }).click();
  await fits(page, page.getByRole('dialog', { name: 'Edit Finn Adeyemi' }));
});

test('a short dialog keeps its own height and stays centred', async ({ open }) => {
  const page = await open('admin', '/support-agent');
  await page.getByRole('button', { name: 'New bot' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'New bot' });
  await expect(dialog).toBeVisible();
  const vh = page.viewportSize().height;
  const box = await dialog.boundingBox();
  expect(box.height).toBeLessThan(vh * 0.85);
  expect(Math.abs(box.y - (vh - box.y - box.height))).toBeLessThan(4);
  const body = dialog.locator('.body');
  expect(await body.evaluate((b) => b.scrollHeight - b.clientHeight)).toBeLessThanOrEqual(0);
});
