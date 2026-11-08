// C9.1: the harness works end to end: a seeded person's session opens Ask.
import { expect, test } from './fixtures.mjs';

test('a seeded person opens Ask', async ({ open, seed }) => {
  const page = await open('employee', '/');
  await expect(page.getByRole('textbox', { name: 'Ask a question' })).toBeVisible();
  await expect(page.locator('#acct')).toContainText(seed.people.employee.name);
});
