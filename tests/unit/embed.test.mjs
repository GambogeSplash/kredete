// Unit tests for embed.js, the support bot widget (support bot spec 7 and 10).
// fetch is stubbed; the views are HTML strings, so no DOM is needed.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';

const embed = createRequire(import.meta.url)('../../embed.js');
const { COPY, BotError, createSseParser, createBotClient, createStore, messageView, panelView } = embed;

const KEY = 'bk_live_' + 'a'.repeat(32);
const API = 'https://bot.example';
const encoder = new TextEncoder();
const SETTINGS = {
  name: 'Kredete Help',
  greeting: 'Hi there.',
  starters: ['What is the daily limit?'],
  notice: 'General information, not advice.',
  contact_label: 'Contact support',
  contact_url: 'https://kredete.com/support',
  privacy_url: 'https://kredete.com/privacy',
  accent: '#26a269',
  side: 'right',
};

const json = (status, body, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

/** A text/event-stream response in exactly these chunks. */
const stream = (chunks) =>
  new Response(
    new ReadableStream({
      pull(controller) {
        if (chunks.length) controller.enqueue(encoder.encode(chunks.shift()));
        else controller.close();
      },
    }),
    { status: 200, headers: { 'content-type': 'text/event-stream' } },
  );

const frame = (event, data) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
const ANSWERED = {
  kind: 'answered',
  sentences: [{ text: 'Standard accounts can send up to $5,000 per day [1].', citations: [1] }],
  sources: [{ n: 1, title: 'Transfer limits policy', url: null }],
  personal_data_warning: false,
};

/** A client whose fetch answers from a queue of responses and records the requests. */
function clientWith(responses) {
  const requests = [];
  const fetch = async (url, init) => {
    requests.push({ url, init });
    const next = responses.shift();
    if (next instanceof Error) throw next;
    return typeof next === 'function' ? next() : next;
  };
  return { client: createBotClient({ fetch, api: API + '/', key: KEY }), requests };
}

describe('the stream parser', () => {
  it('splits frames across chunks, skips heartbeats and malformed frames', () => {
    const parser = createSseParser();
    assert.deepEqual(parser.feed(': keep-alive\n\nevent: status\nda'), []);
    assert.deepEqual(parser.feed('ta: {"stage":"reading"}\n\nevent: x\ndata: {nope\n\n'), [
      { event: 'status', data: { stage: 'reading' } },
    ]);
    assert.deepEqual(parser.feed('event: turn.completed\r\ndata: {"kind":"no_answer"}\r\n\r\n'), [
      { event: 'turn.completed', data: { kind: 'no_answer' } },
    ]);
  });
});

describe('the bot client', () => {
  it('sends the key, never credentials, and reads the settings', async () => {
    const { client, requests } = clientWith([json(200, SETTINGS)]);
    assert.deepEqual(await client.settings(), SETTINGS);
    assert.equal(requests[0].url, 'https://bot.example/v1/bot');
    assert.equal(requests[0].init.headers.Authorization, `Bearer ${KEY}`);
    assert.equal(requests[0].init.credentials, 'omit');
  });

  it('asks with the visitor token and returns the turn, the masked question and the reply', async () => {
    const stages = [];
    const { client, requests } = clientWith([
      stream([
        frame('turn.started', { turn_id: 't1', question: 'My card [card number]' }),
        frame('status', { stage: 'searching' }),
        ': keep-alive\n\n',
        frame('status', { stage: 'checking' }) + frame('turn.completed', ANSWERED),
      ]),
    ]);
    const turn = await client.ask({ id: 'c1', token: 'tok' }, 'My card 4111', (s) => stages.push(s));
    assert.deepEqual(turn, { turnId: 't1', question: 'My card [card number]', reply: ANSWERED });
    assert.deepEqual(stages, ['searching', 'checking']);
    assert.equal(requests[0].url, 'https://bot.example/v1/bot/conversations/c1/turns');
    assert.equal(requests[0].init.headers['Broth-Visitor'], 'tok');
    assert.deepEqual(JSON.parse(requests[0].init.body), { question: 'My card 4111' });
  });

  it('turns problems, stream errors, cut streams and network failures into BotErrors', async () => {
    const { client } = clientWith([
      json(429, { code: 'rate_limited' }, { 'retry-after': '7' }),
      stream([frame('turn.started', { turn_id: 't' }), frame('error', { code: 'model_unavailable', retryable: true })]),
      stream([frame('turn.started', { turn_id: 't' })]),
      new TypeError('Failed to fetch'),
    ]);
    const conversation = { id: 'c', token: 't' };
    await assert.rejects(client.ask(conversation, 'q'), (e) => e instanceof BotError && e.status === 429 && e.retryAfter === 7);
    await assert.rejects(client.ask(conversation, 'q'), (e) => e.kind === 'stream' && e.code === 'model_unavailable' && e.retryable);
    await assert.rejects(client.ask(conversation, 'q'), (e) => e.kind === 'stream');
    await assert.rejects(client.ask(conversation, 'q'), (e) => e.kind === 'network');
  });

  it('sends feedback with a reason only when there is one', async () => {
    const { client, requests } = clientWith([new Response(null, { status: 204 }), new Response(null, { status: 204 })]);
    await client.feedback('t1', 'tok', 'up');
    await client.feedback('t1', 'tok', 'down', 'wrong');
    assert.deepEqual(JSON.parse(requests[0].init.body), { vote: 'up' });
    assert.deepEqual(JSON.parse(requests[1].init.body), { vote: 'down', reason: 'wrong' });
    assert.equal(requests[1].init.method, 'PUT');
  });
});

describe('the store', () => {
  it('remembers the conversation and transcript, without notices', () => {
    const data = new Map();
    const storage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
    const store = createStore(storage, KEY);
    store.save({ conversation: { id: 'c', token: 't' }, messages: [{ role: 'user', text: 'hi' }, { role: 'notice', kind: 'error' }] });
    assert.deepEqual(store.load(), { conversation: { id: 'c', token: 't' }, messages: [{ role: 'user', text: 'hi' }] });
  });

  it('works when storage is missing, blocked or holds junk', () => {
    const throwing = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
    for (const storage of [undefined, throwing, { getItem: () => '{not json', setItem() {} }]) {
      const store = createStore(storage, KEY);
      store.save({ conversation: null, messages: [] });
      assert.deepEqual(store.load(), { conversation: null, messages: [] });
    }
  });
});

describe('the views', () => {
  it('render an answer with its markers, numbered sources and thumbs', () => {
    const html = messageView({ role: 'bot', reply: ANSWERED, turnId: 't1', vote: null }, SETTINGS, 3);
    assert.match(html, /\$5,000 per day<sup class="ref">\[1\]<\/sup>\./);
    assert.match(html, /<li value="1">Transfer limits policy<\/li>/);
    assert.doesNotMatch(html, /<a href/); // a source without a public URL is a title only
    assert.match(html, /data-vote="up" aria-pressed="false" aria-label="Helpful"/);
    const linked = messageView(
      { role: 'bot', reply: { ...ANSWERED, sources: [{ n: 1, title: 'Limits', url: 'https://help.kredete.com/limits' }] } },
      SETTINGS,
      0,
    );
    assert.match(linked, /<a href="https:\/\/help.kredete.com\/limits" target="_blank" rel="noopener noreferrer">Limits<\/a>/);
  });

  for (const kind of ['no_answer', 'account_question', 'advice_boundary']) {
    it(`render ${kind} with its copy and the contact route`, () => {
      const html = messageView({ role: 'bot', reply: { kind, sentences: [], sources: [] } }, SETTINGS, 0);
      assert.ok(html.includes(COPY[kind].replace(/'/g, '&#39;')), html);
      assert.match(html, /<a class="contact" href="https:\/\/kredete.com\/support" target="_blank"/);
    });
  }

  it('render a rule asked about oneself with the support note under the answer', () => {
    const html = messageView({ role: 'bot', reply: { ...ANSWERED, account_note: true } }, SETTINGS, 0);
    assert.ok(html.indexOf('$5,000') < html.indexOf('For anything about your own account'));
    assert.match(html, /class="contact" href="https:\/\/kredete.com\/support"/);
    assert.doesNotMatch(messageView({ role: 'bot', reply: ANSWERED }, SETTINGS, 0), /own account/);
  });

  it('render the personal data warning above the reply', () => {
    const html = messageView({ role: 'bot', reply: { ...ANSWERED, personal_data_warning: true } }, SETTINGS, 0);
    assert.ok(html.indexOf('class="warn"') < html.indexOf('$5,000'));
  });

  it('render each notice of spec 10', () => {
    const notices = {
      unavailable: [COPY.unavailable, 'class="contact"'],
      rate: [COPY.rate(7).replace(/'/g, '&#39;')],
      offline: [COPY.offline.replace(/'/g, '&#39;')],
      error: [COPY.error, 'data-action="retry"', 'class="contact"'],
    };
    for (const [kind, expected] of Object.entries(notices)) {
      const html = messageView({ role: 'notice', kind, seconds: 7 }, SETTINGS, 0);
      for (const text of expected) assert.ok(html.includes(text), `${kind}: ${text}`);
    }
    assert.equal(COPY.rate(1), "You're asking quickly. Try again in 1 second.");
  });

  it('render the reasons after a thumbs down, and thanks once rated', () => {
    const down = messageView({ role: 'bot', reply: ANSWERED, turnId: 't', vote: 'down' }, SETTINGS, 0);
    assert.match(down, /data-reason="incomplete">Didn&#39;t answer my question/);
    const done = messageView({ role: 'bot', reply: ANSWERED, turnId: 't', vote: 'down', reason: 'wrong' }, SETTINGS, 0);
    assert.match(done, /Thanks for the feedback/);
  });

  it('render the panel: notice, greeting, starters until the first question, footer', () => {
    const base = { messages: [], busy: false, stage: null, started: false, error: null, disabled: false };
    const html = panelView(SETTINGS, base);
    assert.match(html, /role="dialog" aria-modal="true" aria-labelledby="bot-name"/);
    assert.match(html, /<p class="notice-line">General information, not advice.<\/p>/);
    assert.match(html, /Hi there./);
    assert.match(html, /data-action="ask" data-question="What is the daily limit\?"/);
    assert.match(html, /Questions are kept for 90 days. <a href="https:\/\/kredete.com\/privacy"/);
    assert.match(html, /role="log" aria-live="polite"/);
    assert.doesNotMatch(panelView(SETTINGS, { ...base, started: true }), /data-action="ask"/);
    const busy = panelView(SETTINGS, { ...base, busy: true, stage: 'checking' });
    assert.match(busy, /Checking the answer/);
    assert.match(busy, /class="send" aria-label="Send" disabled/);
    assert.match(panelView(SETTINGS, { ...base, error: COPY.too_long }), /role="alert"/);
  });

  it('escape everything that comes from the server or the visitor', () => {
    const evil = '<img src=x onerror=alert(1)>';
    const html = panelView({ ...SETTINGS, name: evil, greeting: evil, contact_url: 'javascript:alert(1)' }, {
      messages: [{ role: 'user', text: evil }, { role: 'bot', reply: { kind: 'no_answer' } }],
      busy: false, stage: null, started: true, error: null, disabled: false,
    });
    assert.doesNotMatch(html, /<img/);
    assert.doesNotMatch(html, /javascript:/);
  });
});
