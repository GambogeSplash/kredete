// Conversational Broth (broth-service docs/specs/2026-11-12-conversational-broth-design.md):
// the original replay. A greeting is answered by Broth as a conversation, not as a failed search
// with the not-found copy, not-found follow-ups and the "logged for owners" note. As Eve.
import { expect, test } from './fixtures.mjs';

const NOT_FOUND = 'I could not find a good source for that.';

/** The answer stream has finished (completed, failed or stopped). */
async function idle(page) {
  await expect(page.locator('.dsend.stop, .dsend.busy')).toHaveCount(0, { timeout: 20_000 });
  await expect(page.locator('#thread .ans.thinking, #thread .ans.cursor')).toHaveCount(0);
}

// Replay, held failing until CVW1.1 renders chat replies (plan CV0.1).
test('a greeting gets a conversational reply, not a failed search', async ({ open }) => {
  test.fail();
  const page = await open('employee', '/');
  await page.getByRole('textbox', { name: 'Ask a question' }).fill('Hey broth');
  await page.keyboard.press('Enter');
  await expect(page.locator('#thread article')).toHaveCount(1);
  await idle(page);
  const answer = page.locator('#thread article').last();
  await expect(answer.locator('.ans')).not.toHaveText(NOT_FOUND);
  await expect(answer.locator('.ans')).not.toBeEmpty();
  await expect(answer.locator('.notice.none')).toHaveCount(0);
  await expect(answer.getByRole('button', { name: /source read/ })).toHaveCount(0);
  await expect(answer.getByText('Who should I ask about this?')).toHaveCount(0);
  await expect(answer.getByRole('button', { name: 'Helpful', exact: true })).toBeVisible();
});
