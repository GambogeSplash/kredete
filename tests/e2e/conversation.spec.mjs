// Conversational Broth (broth-service docs/specs/2026-11-12-conversational-broth-design.md):
// the original replay. A greeting is answered by Broth as a conversation, not as a failed search
// with the not-found copy, not-found follow-ups and the "logged for owners" note. As Eve.
import { expect, test } from './fixtures.mjs';

const NOT_FOUND = 'I could not find a good source for that.';
const TURNS = '**/v1/conversations/*/turns';

/** The answer stream has finished (completed, failed or stopped). */
async function idle(page) {
  await expect(page.locator('.dsend.stop, .dsend.busy')).toHaveCount(0, { timeout: 20_000 });
  await expect(page.locator('#thread .ans.thinking, #thread .ans.cursor')).toHaveCount(0);
}

async function ask(page, question) {
  await page.getByRole('textbox', { name: 'Ask a question' }).fill(question);
  await page.keyboard.press('Enter');
  await expect(page.locator('#thread article')).toHaveCount(1);
  await idle(page);
  return page.locator('#thread article').last();
}

// The replay (plan CV0.1).
test('a greeting gets a conversational reply, not a failed search', async ({ open, check }) => {
  const page = await open('employee', '/');
  const answer = await ask(page, 'Hey broth');
  await expect(answer.locator('.ans')).not.toHaveText(NOT_FOUND);
  await expect(answer.locator('.ans')).not.toBeEmpty();
  await expect(answer.locator('.notice.none')).toHaveCount(0);
  await expect(answer.getByRole('button', { name: /source read/ })).toHaveCount(0);
  await expect(answer.getByText('Who should I ask about this?')).toHaveCount(0);
  await expect(answer.getByRole('button', { name: 'Helpful', exact: true })).toBeVisible();
  await check(page, 'answer-chat');
});

// An answer stored before the server worded not-found answers keeps the client's copy, its
// owner line and the logged note (conversational spec 4.4).
test('a not-found answer stored before keeps its old copy', async ({ open, seed }) => {
  const page = await open('employee', '/');
  await page.route(TURNS, async (route) => {
    const started = { turn_id: '00000000-0000-0000-0000-000000000001' };
    const old = {
      kind: 'not_found', text: '', citations: [], conflict: null, low_confidence_reason: null,
      not_found: { suggested_owner: { name: 'Ngozi Okafor', team: 'Payments' } },
      access_limited: false, follow_ups: ['Who should I ask about this?'],
    };
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      body: `event: turn.started\ndata: ${JSON.stringify(started)}\n\nevent: turn.completed\ndata: ${JSON.stringify(old)}\n\n`,
    });
  });
  const answer = await ask(page, seed.questions.not_found.question);
  await expect(answer.locator('.ans')).toHaveText(NOT_FOUND);
  await expect(answer.locator('.notice.none')).toContainText('The likely owner is');
  await expect(answer.locator('.notice.none')).toContainText('Your question was logged so the owners can see the gap.');
});
