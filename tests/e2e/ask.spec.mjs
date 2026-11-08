// Ask (sandbox spec 4.3; plan C4): streaming, cancel, error recovery, every answer kind and the
// access-limited notice, feedback, report and regenerate, and the sources panel. As Eve.
import { expect, test } from './fixtures.mjs';

const TURNS = '**/v1/conversations/*/turns';
const phone = (page) => page.viewportSize().width < 900;

/** Asks in the open chat (or a new one from the home page) and waits for the answer to finish. */
async function ask(page, question) {
  const before = await page.locator('#thread article').count();
  await page.getByRole('textbox', { name: 'Ask a question' }).fill(question);
  await page.keyboard.press('Enter');
  await expect(page.locator('#thread article')).toHaveCount(before + 1);
  await idle(page);
}
/** The answer stream has finished (completed, failed or stopped). */
async function idle(page) {
  await expect(page.locator('.dsend.stop, .dsend.busy')).toHaveCount(0, { timeout: 20_000 });
  await expect(page.locator('#thread .ans.thinking, #thread .ans.cursor')).toHaveCount(0);
}
const lastAnswer = (page) => page.locator('#thread article').last();

test('the Ask home: composer, recent chats and connected sources', async ({ open, check }) => {
  const page = await open('employee', '/');
  await expect(page.getByRole('textbox', { name: 'Ask a question' })).toBeVisible();
  await expect(page.getByText('Pick up where you left off')).toBeVisible();
  await expect(page.getByText('Reading from 1 connected app')).toBeVisible();
  await check(page, 'ask-home', { mask: ['.lh-t', '#lhrecent'] });
});

test.describe('each answer kind', () => {
  const KINDS = {
    answered: async (answer) => {
      await expect(answer.locator('.ans .cite')).toHaveCount(1);
      await expect(answer.getByRole('button', { name: /1 source read/ })).toBeVisible();
    },
    low_confidence: async (answer) => {
      await expect(answer.locator('.notice.low')).toContainText('The best source for this answer is a draft.');
    },
    conflict: async (answer) => {
      await expect(answer.locator('.conflict .cfrow')).toHaveCount(2);
      await expect(answer.locator('.conflict')).toContainText('7.50 dollars');
      await expect(answer.getByRole('button', { name: 'Report to owner' })).toBeVisible();
    },
    not_found: async (answer) => {
      await expect(answer.locator('.ans')).toHaveText('I could not find a good source for that.');
      await expect(answer.locator('.notice.none')).toContainText('logged');
      await expect(answer.locator('.notice.access')).toHaveCount(0);
    },
    access_limited: async (answer) => {
      await expect(answer.locator('.ans')).toHaveText('I could not find a good source for that.');
      await expect(answer.locator('.notice.access')).toHaveText('Some content may not be visible to you.');
    },
  };
  for (const [kind, expectations] of Object.entries(KINDS)) {
    test(kind, async ({ open, check, seed }) => {
      const page = await open('employee', '/');
      await ask(page, seed.questions[kind].question);
      await expect(page).toHaveURL(/\/c\/[0-9a-f-]{36}$/);
      await expectations(lastAnswer(page));
      await check(page, `answer-${kind}`);
    });
  }
});

test('streaming shows progress, and Stop cancels without saving an answer', async ({ open, check, seed }) => {
  const page = await open('employee', '/');
  let hold = true;
  await page.route(TURNS, async (route) => {
    while (hold) await new Promise((r) => setTimeout(r, 100));
    await route.continue().catch(() => {});
  });
  await page.getByRole('textbox', { name: 'Ask a question' }).fill(seed.questions.answered.question);
  await page.keyboard.press('Enter');
  await expect(page.locator('.thk-t')).toHaveText('Searching your sources');
  await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible();
  await check(page, 'answer-streaming', { loading: true });
  await page.getByRole('button', { name: 'Stop' }).click();
  await expect(lastAnswer(page).locator('.ans')).toHaveText('Stopped before an answer.');
  hold = false;
  await page.unroute(TURNS);
  await check(page, 'answer-stopped');
  await lastAnswer(page).getByRole('button', { name: 'Regenerate' }).click();
  await idle(page);
  await expect(lastAnswer(page).locator('.ans .cite')).toHaveCount(1);
});

test('a refused ask waits out Retry-After, then retries', async ({ open, check, seed }) => {
  const page = await open('employee', '/');
  await page.route(TURNS, (route) => route.fulfill({
    status: 429,
    headers: { 'content-type': 'application/problem+json', 'retry-after': '2' },
    body: JSON.stringify({ title: 'Too many questions at once', status: 429, code: 'rate_limited' }),
  }));
  await ask(page, seed.questions.answered.question);
  await expect(lastAnswer(page).locator('.ans')).toHaveText('Too many questions at once');
  await expect(lastAnswer(page).getByRole('button', { name: /Try again in/ })).toBeDisabled();
  await check(page, 'answer-refused', { mask: ['[data-retry]'] });
  await page.unroute(TURNS);
  const retry = lastAnswer(page).getByRole('button', { name: 'Try again' });
  await expect(retry).toBeEnabled({ timeout: 5_000 });
  await retry.click();
  await idle(page);
  await expect(lastAnswer(page).locator('.ans .cite')).toHaveCount(1);
});

test('an answer cut off mid-stream is never shown as complete', async ({ open, check, seed }) => {
  const page = await open('employee', '/');
  // The server answers in full; the connection drops after the first sentence reaches the browser.
  await page.route(TURNS, async (route) => {
    const response = await route.fetch();
    const frames = (await response.text()).split(/\r?\n\r?\n/);
    const cut = frames.findIndex((f) => /^event: answer\.delta$/m.test(f));
    await route.fulfill({ response, body: frames.slice(0, cut + 1).join('\n\n') + '\n\n' });
  });
  await ask(page, seed.questions.answered.question);
  await expect(lastAnswer(page).locator('.ans')).toHaveText('The answer was cut off.');
  await expect(lastAnswer(page)).not.toContainText('Standard accounts can send');
  await check(page, 'answer-cut-off');
  await page.unroute(TURNS);
  await lastAnswer(page).getByRole('button', { name: 'Try again' }).click();
  await idle(page);
  await expect(lastAnswer(page).locator('.ans .cite')).toHaveCount(1);
});

test('feedback, Report to owner and Regenerate round-trip and survive a reload', async ({ open, check, seed }) => {
  const page = await open('employee', '/');
  await ask(page, seed.questions.conflict.question);
  // A slow first vote must not land after the reason that follows it.
  let first = true;
  await page.route('**/v1/turns/*/feedback', async (route) => {
    if (first) { first = false; await new Promise((r) => setTimeout(r, 500)); }
    await route.continue();
  });
  const saved = page.waitForResponse((r) => /\/feedback$/.test(r.url()) && r.request().postDataJSON().reason === 'outdated');
  const answer = lastAnswer(page);
  await answer.getByRole('button', { name: 'Not helpful' }).click();
  await answer.getByRole('button', { name: 'Outdated' }).click();
  await expect(answer.getByText('Outdated, thanks')).toBeVisible();
  await saved;
  await answer.getByRole('button', { name: 'Report to owner' }).click();
  await expect(answer.getByRole('button', { name: 'Sent' })).toBeDisabled();
  await page.reload();
  await expect(lastAnswer(page).getByText('Outdated, thanks')).toBeVisible();
  await expect(lastAnswer(page).getByRole('button', { name: 'Sent' })).toBeDisabled();
  await check(page, 'answer-acted-on');

  await lastAnswer(page).getByRole('button', { name: 'Regenerate' }).click();
  await idle(page);
  await expect(page.locator('#thread article')).toHaveCount(1); // the new turn replaced the old one
  await expect(lastAnswer(page).getByRole('button', { name: 'Report to owner' })).toBeEnabled();
  await page.reload();
  await expect(page.locator('#thread article')).toHaveCount(1);
});

test('the sources panel shows the citations and sets what the next question reads', async ({ open, check, seed }) => {
  const page = await open('employee', '/');
  await ask(page, seed.questions.answered.question);
  await lastAnswer(page).locator('.ans .cite').click();
  const sources = phone(page) ? page.locator('#drawer') : page.locator('#rsrc');
  await expect(sources.locator('.cxs')).toHaveCount(1);
  await expect(sources.locator('.cxs')).toContainText('Transfer limits policy');
  await expect(sources.locator('.cxs-q')).toContainText('Standard accounts can send up to 5,000 dollars per day.');
  await check(page, 'sources-cited');

  if (phone(page)) {
    await page.locator('#drawer [data-close-drawer]').click();
    await page.locator('#cxsrc').click();
  } else {
    await sources.getByRole('tab', { name: 'Sources' }).click();
  }
  const list = page.locator(phone(page) ? '#drawer' : '#rsrc');
  await expect(list.locator('.gsrc')).toHaveCount(7);
  await list.getByRole('checkbox', { name: 'Use Savings rate sheet' }).uncheck();
  await expect(list.getByText('6 of 7 used for your next question')).toBeVisible();
  await check(page, 'sources-next-question');
  if (phone(page)) await page.locator('#drawer [data-close-drawer]').click();

  const sent = page.waitForRequest((r) => /\/v1\/conversations\/[^/]+\/turns$/.test(r.url()) && r.method() === 'POST');
  await page.getByRole('textbox', { name: 'Ask a question' }).fill(seed.questions.low_confidence.question);
  await page.keyboard.press('Enter');
  const body = (await sent).postDataJSON();
  expect(body.filters.exclude_document_ids).toEqual([seed.documents['pay-savings']]);
  await idle(page);
  await expect(lastAnswer(page).locator('.ans')).toHaveText('I could not find a good source for that.');
});
