// The support bot widget on the demo page (support bot spec 7, 10 and 11.4; plan W4.2).
// Anonymous visitors: no sign-in. The page is the client's own demo page, embedding the widget
// with the seeded Help centre bot's key; the widget calls broth-public on its own port.
import { expect, test } from './fixtures.mjs';

// The fixtures serve pages through route.fulfill (to add the Vercel headers), so Chromium sees a
// page with no address and treats it as public; its calls to the bot API on localhost then
// fail Local Network Access. A real page on a real host makes no such request, so the check is
// off for this file only.
test.use({ launchOptions: { args: ['--disable-features=LocalNetworkAccessChecks'] } });

/** The demo page with a key and the bot API address. */
const demo = (seed, key = seed.bot_key) =>
  `/embed-demo.html?key=${encodeURIComponent(key)}&api=${encodeURIComponent(seed.bot_api)}`;
const TURNS = '**/v1/bot/conversations/*/turns';

/** Opens the panel from the launcher. */
async function openPanel(page) {
  await page.getByRole('button', { name: 'Open help' }).click();
  await expect(page.getByRole('dialog', { name: 'Kredete Help' })).toBeVisible();
}

/** Asks in the open panel and waits for the reply (or a notice) to land. */
async function ask(page, question) {
  const before = await page.locator('.msg.bot[data-kind]').count();
  await page.getByRole('textbox', { name: 'Ask a question' }).fill(question);
  await page.keyboard.press('Enter');
  await expect(page.locator('.msg.bot[data-kind]')).toHaveCount(before + 1, { timeout: 20_000 });
  return page.locator('.msg.bot[data-kind]').last();
}

/** Contrast, target size and labels inside the widget's shadow root (tools/audit.js stops at it). */
async function auditWidget(page) {
  return page.evaluate(() => {
    const root = document.querySelector('#kredete-help')?.shadowRoot;
    if (!root) return { missing: true };
    const lum = (c) => {
      const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const rgb = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map(Number); return { c: p.slice(0, 3), a: p[3] ?? 1 }; };
    const background = (el) => {
      for (let e = el; e; e = e.parentElement || e.getRootNode().host) {
        const bg = rgb(getComputedStyle(e).backgroundColor);
        if (bg && bg.a > 0.9) return bg.c;
      }
      return [255, 255, 255];
    };
    const shown = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
    const low = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const el = walker.currentNode.parentElement;
      if (!el || !walker.currentNode.textContent.trim() || !shown(el) || el.tagName === 'STYLE') continue;
      const cs = getComputedStyle(el);
      const fg = rgb(cs.color);
      const bg = background(el);
      const mixed = fg.c.map((v, i) => Math.round(v * fg.a + bg[i] * (1 - fg.a)));
      const [hi, lo] = [lum(mixed), lum(bg)].sort((a, b) => b - a);
      const ratio = (hi + 0.05) / (lo + 0.05);
      const large = parseFloat(cs.fontSize) >= 24;
      if (ratio < (large ? 3 : 4.5)) low.push(`${el.className || el.tagName} ${ratio.toFixed(2)} "${el.textContent.trim().slice(0, 24)}"`);
    }
    const small = [];
    const unlabelled = [];
    for (const el of root.querySelectorAll('button, a[href], textarea')) {
      if (!shown(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 24 || r.height < 24) small.push(`${el.className || el.tagName} ${Math.round(r.width)}x${Math.round(r.height)}`);
      const named = el.textContent.trim() || el.getAttribute('aria-label') || (el.id && root.querySelector(`label[for="${el.id}"]`));
      if (!named) unlabelled.push(el.className || el.tagName);
    }
    return { low, small, unlabelled };
  });
}

async function checkWidget(page, check, name) {
  expect(await auditWidget(page), `${name}: widget audit`).toEqual({ low: [], small: [], unlabelled: [] });
  await check(page, name);
}

test('the launcher waits closed on the page, then opens on the welcome', async ({ open, check, seed }) => {
  const page = await open(null, demo(seed));
  await expect(page.getByRole('button', { name: 'Open help' })).toBeVisible();
  await checkWidget(page, check, 'bot-launcher');
  await openPanel(page);
  const panel = page.getByRole('dialog', { name: 'Kredete Help' });
  await expect(panel.getByText('I give general information from our help pages, not personal financial advice.')).toBeVisible();
  await expect(panel.getByText('Hi, I can answer general questions about Kredete.')).toBeVisible();
  await expect(panel.getByRole('button', { name: seed.bot_questions.answered })).toBeVisible();
  await expect(panel.getByText("Don't share personal details. Questions are kept for 90 days.")).toBeVisible();
  await expect(panel.getByRole('link', { name: 'How we use your questions' })).toHaveAttribute('href', 'https://kredete.com/privacy');
  await checkWidget(page, check, 'bot-welcome');
});

test('a starter question gets a checked answer with its source, and thumbs are recorded', async ({ open, check, seed }) => {
  const page = await open(null, demo(seed));
  await openPanel(page);
  const statuses = [];
  page.on('response', (r) => { if (r.url().includes('/feedback')) statuses.push(r.status()); });
  await page.getByRole('button', { name: seed.bot_questions.answered }).click();
  const answer = page.locator('.msg.bot[data-kind="answered"]');
  await expect(answer).toContainText('Standard accounts can send up to 5,000 dollars per day[1].', { timeout: 20_000 });
  await expect(answer.getByRole('list', { name: 'Sources' })).toContainText('Transfer limits policy');
  // Starters give way to the conversation.
  await expect(page.getByRole('button', { name: seed.bot_questions.answered })).toHaveCount(0);
  await checkWidget(page, check, 'bot-answered');

  await answer.getByRole('button', { name: 'Not helpful' }).click();
  await expect(answer.getByRole('group', { name: 'What was wrong?' })).toBeVisible();
  await checkWidget(page, check, 'bot-feedback-reasons');
  await answer.getByRole('button', { name: 'Out of date' }).click();
  await expect(answer.getByText('Thanks for the feedback.')).toBeVisible();
  await expect.poll(() => statuses).toEqual([204, 204]);
});

test('an account question is redirected to support', async ({ open, check, seed }) => {
  const page = await open(null, demo(seed));
  await openPanel(page);
  const reply = await ask(page, seed.bot_questions.account_question);
  await expect(reply).toHaveAttribute('data-kind', 'account_question');
  await expect(reply).toContainText("I can't see your account, so I can't answer questions about it. Our support team can help.");
  await expect(reply.getByRole('link', { name: 'Contact support' })).toHaveAttribute('href', 'https://kredete.com/support');
  await checkWidget(page, check, 'bot-account-question');
});

test('questions about pages that are not Public, or that nothing covers, get no answer', async ({ open, check, seed }) => {
  const page = await open(null, demo(seed));
  await openPanel(page);
  const internal = await ask(page, seed.bot_questions.not_public);
  await expect(internal).toHaveAttribute('data-kind', 'no_answer');
  await expect(internal).not.toContainText('dollars');
  const uncovered = await ask(page, seed.bot_questions.not_covered);
  await expect(uncovered).toHaveAttribute('data-kind', 'no_answer');
  await expect(uncovered).toContainText("I couldn't find that in our help content.");
  await expect(uncovered.getByRole('link', { name: 'Contact support' })).toBeVisible();
  await checkWidget(page, check, 'bot-no-answer');
});

test('a card number is hidden, and the visitor is warned', async ({ open, check, seed }) => {
  const page = await open(null, demo(seed));
  await openPanel(page);
  const reply = await ask(page, 'My card 4111 1111 1111 1111 was lost. What is the daily transfer limit for standard accounts?');
  await expect(reply.getByRole('note')).toHaveText("Please don't share card or account numbers here. I've hidden what you typed.");
  const mine = page.locator('.msg.me').last();
  await expect(mine).toContainText('My card [card number] was lost.');
  await expect(mine).not.toContainText('4111');
  const stored = await page.evaluate(() => JSON.stringify(Object.entries(sessionStorage)));
  expect(stored).not.toContain('4111');
  await checkWidget(page, check, 'bot-personal-data');
});

test('the conversation survives moving to another page of the site', async ({ open, seed }) => {
  const page = await open(null, demo(seed));
  await openPanel(page);
  await ask(page, seed.bot_questions.account_question);
  await page.reload();
  await openPanel(page);
  await expect(page.locator('.msg.me')).toHaveText([seed.bot_questions.account_question]);
});

test('offline, the widget says so and asks again when the connection returns', async ({ open, check, seed }) => {
  const page = await open(null, demo(seed));
  await openPanel(page);
  await page.context().setOffline(true);
  const notice = await ask(page, seed.bot_questions.answered);
  await expect(notice).toHaveAttribute('data-kind', 'offline');
  await checkWidget(page, check, 'bot-offline');
  await page.context().setOffline(false);
  await expect(page.locator('.msg.bot[data-kind="answered"]')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.msg.bot[data-kind="offline"]')).toHaveCount(0);
});

test('a failed answer offers a retry, and the retry answers', async ({ open, seed }) => {
  const page = await open(null, demo(seed));
  await openPanel(page);
  let failures = 1;
  await page.route(TURNS, async (route) => {
    if (failures-- > 0) {
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'text/event-stream', 'access-control-allow-origin': new URL(page.url()).origin },
        body: 'event: turn.started\ndata: {"turn_id":"x"}\n\nevent: error\ndata: {"code":"model_unavailable","message":"","retryable":true}\n\n',
      });
    } else await route.continue();
  });
  const failed = await ask(page, seed.bot_questions.answered);
  await expect(failed).toHaveAttribute('data-kind', 'error');
  await failed.getByRole('button', { name: 'Try again' }).click();
  await expect(page.locator('.msg.bot[data-kind="answered"]')).toBeVisible({ timeout: 20_000 });
});

test('a visitor asking too fast is told how long to wait', async ({ open, seed }) => {
  const page = await open(null, demo(seed));
  await openPanel(page);
  await page.route(TURNS, (route) =>
    route.fulfill({
      status: 429,
      headers: { 'content-type': 'application/problem+json', 'retry-after': '12', 'access-control-allow-origin': new URL(page.url()).origin, 'access-control-expose-headers': 'retry-after' },
      body: JSON.stringify({ code: 'rate_limited', status: 429, title: 'Too many requests' }),
    }),
  );
  const notice = await ask(page, 'How do refunds work?');
  await expect(notice).toHaveText("You're asking quickly. Try again in 12 seconds.");
});

test('the keyboard alone opens the widget, asks, rates and closes it', async ({ open, seed }) => {
  const page = await open(null, demo(seed));
  const launcher = page.getByRole('button', { name: 'Open help' });
  await launcher.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('textbox', { name: 'Ask a question' })).toBeFocused();
  await page.keyboard.type(seed.bot_questions.answered);
  await page.keyboard.press('Enter');
  const answer = page.locator('.msg.bot[data-kind="answered"]');
  await expect(answer).toBeVisible({ timeout: 20_000 });
  // Focus stays inside the open panel: tabbing from the last control wraps to the first.
  for (let i = 0; i < 12; i++) await page.keyboard.press('Tab');
  const inside = await page.evaluate(() => {
    const root = document.querySelector('#kredete-help').shadowRoot;
    return !!root.activeElement && !!root.activeElement.closest('.panel');
  });
  expect(inside).toBe(true);
  await answer.getByRole('button', { name: 'Helpful', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(answer.getByText('Thanks for the feedback.')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Open help' })).toBeFocused();
});

test('a revoked key, or a site the product does not allow, leaves no widget', async ({ open, seed }) => {
  const warnings = [];
  const revoked = await open(null, demo(seed, seed.bot_revoked_key), {
    before: (page) => page.on('console', (m) => { if (m.type() === 'warning') warnings.push(m.text()); }),
  });
  await expect(revoked.locator('#kredete-help')).toHaveCount(0);
  await expect.poll(() => warnings).toContain('Broth help is unavailable on this page.');

  // The same page from an origin the product does not list: the preflight is refused.
  const elsewhere = await open(null, new URL(demo(seed), revoked.url().replace('localhost', '127.0.0.1')).href);
  await expect(elsewhere.locator('#kredete-help')).toHaveCount(0);
  await expect(elsewhere.locator('main h1')).toHaveText('How can we help?');
});
