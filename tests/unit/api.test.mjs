// Unit tests for api.js (sandbox spec 4.1 and 6.2): fetch is stubbed, nothing touches the network.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';

const { createApi, ApiError, latest } = createRequire(import.meta.url)('../../api.js');

const encoder = new TextEncoder();

/** A JSON response. */
const json = (status, body, headers = {}) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

/** An RFC 9457 problem response. */
const problem = (status, title, extra = {}, headers = {}) =>
  new Response(JSON.stringify({ type: 'about:blank', title, status, ...extra }), {
    status,
    headers: { 'content-type': 'application/problem+json', ...headers },
  });

/** A text/event-stream response whose body arrives in exactly these chunks. */
function sse(chunks, { hang = false } = {}) {
  let cancelled = false;
  const body = new ReadableStream({
    async pull(controller) {
      if (chunks.length) {
        const next = chunks.shift();
        controller.enqueue(typeof next === 'string' ? encoder.encode(next) : next);
        return;
      }
      if (hang) await new Promise(() => {});
      controller.close();
    },
    cancel() {
      cancelled = true;
    },
  });
  const response = new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
  return { response, wasCancelled: () => cancelled };
}

/** A fetch stub that answers from `routes` ("METHOD /path" -> handler) and records every call. */
function stubFetch(routes) {
  const calls = [];
  const fetch = async (url, init = {}) => {
    const path = new URL(url, 'http://client.test').pathname;
    const key = `${init.method || 'GET'} ${path}`;
    calls.push({ key, url, init });
    const handler = routes[key];
    if (!handler) throw new Error(`unexpected request ${key}`);
    return handler({ url, init, calls });
  };
  return { fetch, calls };
}

const token = (value) => json(200, { access_token: value, token_type: 'bearer', expires_at: '2026-11-08T12:15:00Z' });

describe('requests and sessions', () => {
  it('keeps the access token in memory and sends it as a bearer token', async () => {
    const { fetch, calls } = stubFetch({
      'POST /v1/auth/refresh': () => token('t1'),
      'GET /v1/me': () => json(200, { id: 'u1' }),
    });
    const api = createApi({ fetch });
    assert.deepEqual(await api.get('/me'), { id: 'u1' });
    const refresh = calls.find((c) => c.key === 'POST /v1/auth/refresh');
    assert.equal(refresh.init.credentials, 'same-origin');
    const me = calls.find((c) => c.key === 'GET /v1/me');
    assert.equal(new Headers(me.init.headers).get('authorization'), 'Bearer t1');
  });

  it('shares one refresh between concurrent 401s and retries each request once', async () => {
    let refreshes = 0;
    const { fetch, calls } = stubFetch({
      'POST /v1/auth/refresh': async () => {
        refreshes += 1;
        await new Promise((r) => setTimeout(r, 5));
        return token(`t${refreshes + 1}`);
      },
      'GET /v1/me': ({ init }) =>
        new Headers(init.headers).get('authorization') === 'Bearer t2' ? json(200, { id: 'u1' }) : problem(401, 'Sign in again'),
      'GET /v1/facets': ({ init }) =>
        new Headers(init.headers).get('authorization') === 'Bearer t2' ? json(200, { systems: [] }) : problem(401, 'Sign in again'),
    });
    const api = createApi({ fetch });
    api.setToken('t1');
    const [me, facets] = await Promise.all([api.get('/me'), api.get('/facets')]);
    assert.deepEqual(me, { id: 'u1' });
    assert.deepEqual(facets, { systems: [] });
    assert.equal(refreshes, 1);
    assert.equal(calls.filter((c) => c.key === 'GET /v1/me').length, 2);
  });

  it('signs out when the refresh is refused, and clears the token', async () => {
    const { fetch } = stubFetch({
      'POST /v1/auth/refresh': () => problem(401, 'Sign in to continue', { code: 'auth_required' }),
      'GET /v1/me': () => problem(401, 'Sign in to continue'),
    });
    const api = createApi({ fetch });
    let signedOut = 0;
    api.onSignedOut(() => {
      signedOut += 1;
    });
    api.setToken('stale');
    await assert.rejects(api.get('/me'), (error) => error instanceof ApiError && error.status === 401);
    assert.equal(signedOut, 1);
    assert.equal(api.hasToken(), false);
  });

  it('signs out once even when several requests fail at the same time', async () => {
    const { fetch } = stubFetch({
      'POST /v1/auth/refresh': () => problem(401, 'Sign in to continue'),
      'GET /v1/me': () => problem(401, 'Sign in to continue'),
    });
    const api = createApi({ fetch });
    let signedOut = 0;
    api.onSignedOut(() => {
      signedOut += 1;
    });
    api.setToken('stale');
    await Promise.allSettled([api.get('/me'), api.get('/me'), api.get('/me')]);
    assert.equal(signedOut, 1);
  });

  it('does not sign out when the refresh fails for another reason', async () => {
    const { fetch } = stubFetch({
      'POST /v1/auth/refresh': () => {
        throw new TypeError('Failed to fetch');
      },
    });
    const api = createApi({ fetch });
    let signedOut = 0;
    api.onSignedOut(() => {
      signedOut += 1;
    });
    await assert.rejects(api.refresh(), (error) => error instanceof ApiError && error.status === 0 && error.retryable);
    assert.equal(signedOut, 0);
  });

  it('serializes refreshes through the cross-tab lock when one is available', async () => {
    const order = [];
    const lock = async (name, task) => {
      order.push(`lock ${name}`);
      const result = await task();
      order.push('unlock');
      return result;
    };
    const { fetch } = stubFetch({ 'POST /v1/auth/refresh': () => token('t1') });
    const api = createApi({ fetch, lock });
    await api.refresh();
    assert.deepEqual(order, ['lock broth-refresh', 'unlock']);
  });

  it('logs out on the server and forgets the token even if the server is unreachable', async () => {
    const { fetch } = stubFetch({
      'POST /v1/auth/logout': () => {
        throw new TypeError('Failed to fetch');
      },
    });
    const api = createApi({ fetch });
    api.setToken('t1');
    await api.logout();
    assert.equal(api.hasToken(), false);
  });

  it('returns null for 204 responses and sends JSON bodies', async () => {
    const { fetch, calls } = stubFetch({ 'PUT /v1/turns/t1/feedback': () => new Response(null, { status: 204 }) });
    const api = createApi({ fetch });
    api.setToken('t1');
    assert.equal(await api.put('/turns/t1/feedback', { vote: 'up' }), null);
    const [call] = calls;
    assert.equal(new Headers(call.init.headers).get('content-type'), 'application/json');
    assert.equal(call.init.body, JSON.stringify({ vote: 'up' }));
  });

  it('encodes query parameters and skips empty ones', async () => {
    const { fetch, calls } = stubFetch({ 'GET /v1/documents': () => json(200, { items: [], next_cursor: null }) });
    const api = createApi({ fetch });
    api.setToken('t1');
    await api.get('/documents', { system: 'confluence', q: 'fees & limits', domain: '', cursor: null, path: undefined });
    assert.equal(new URL(calls[0].url, 'http://client.test').search, '?system=confluence&q=fees+%26+limits');
  });

  it('calls unauthenticated routes without refreshing', async () => {
    const { fetch, calls } = stubFetch({
      'GET /v1/setup/status': () => json(200, { needs_setup: true, setup_session: false, google_configured: false }),
    });
    const api = createApi({ fetch });
    await api.get('/setup/status', undefined, { auth: false });
    assert.deepEqual(calls.map((c) => c.key), ['GET /v1/setup/status']);
    assert.equal(new Headers(calls[0].init.headers).get('authorization'), null);
    assert.equal(calls[0].init.credentials, 'same-origin');
  });
});

describe('writes to one resource', () => {
  /** A promise the test resolves by hand. */
  const gate = () => {
    let open;
    const opened = new Promise((resolve) => { open = resolve; });
    return { opened, open };
  };
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
  const bodies = (calls, key) => calls.filter((c) => c.key === key).map((c) => JSON.parse(c.init.body));

  it('sends the next write to a resource only after the previous one has been answered', async () => {
    const first = gate();
    let n = 0;
    const { fetch, calls } = stubFetch({
      'PUT /v1/turns/t1/feedback': async () => { n += 1; if (n === 1) await first.opened; return json(204); },
    });
    const api = createApi({ fetch });
    api.setToken('t');
    const a = api.put('/turns/t1/feedback', { vote: 'down' });
    const b = api.put('/turns/t1/feedback', { vote: 'down', reason: 'outdated' });
    await settle();
    assert.deepEqual(bodies(calls, 'PUT /v1/turns/t1/feedback'), [{ vote: 'down' }]);
    first.open();
    await Promise.all([a, b]);
    assert.deepEqual(bodies(calls, 'PUT /v1/turns/t1/feedback'), [{ vote: 'down' }, { vote: 'down', reason: 'outdated' }]);
  });

  it('keeps the order across methods: a PATCH, then a DELETE, then another PATCH', async () => {
    const first = gate();
    let n = 0;
    const order = [];
    const handler = async ({ init }) => { n += 1; const mine = n; if (mine === 1) await first.opened; order.push(init.method); return json(204); };
    const { fetch } = stubFetch({ 'PATCH /v1/conversations/c1': handler, 'DELETE /v1/conversations/c1': handler });
    const api = createApi({ fetch });
    api.setToken('t');
    const done = Promise.all([
      api.patch('/conversations/c1', { pinned: true }),
      api.del('/conversations/c1'),
      api.patch('/conversations/c1', { title: 'Later' }),
    ]);
    await settle();
    assert.deepEqual(order, []);
    first.open();
    await done;
    assert.deepEqual(order, ['PATCH', 'DELETE', 'PATCH']);
  });

  it('still sends the next write when the previous one failed, and each caller sees its own result', async () => {
    const { fetch, calls } = stubFetch({
      'PATCH /v1/me': ({ init }) => (JSON.parse(init.body).nickname === 'bad' ? problem(422, 'Nickname is too long') : json(200, { nickname: 'Ok' })),
    });
    const api = createApi({ fetch });
    api.setToken('t');
    const a = api.patch('/me', { nickname: 'bad' });
    const b = api.patch('/me', { nickname: 'Ok' });
    await assert.rejects(a, (error) => error instanceof ApiError && error.status === 422);
    assert.deepEqual(await b, { nickname: 'Ok' });
    assert.equal(calls.length, 2);
  });

  it('does not hold back writes to other resources, or reads', async () => {
    const first = gate();
    const { fetch, calls } = stubFetch({
      'PUT /v1/turns/t1/feedback': async () => { await first.opened; return json(204); },
      'PUT /v1/turns/t2/feedback': () => json(204),
      'GET /v1/turns/t1/feedback': () => json(200, { vote: 'up', reason: null }),
      'POST /v1/turns/t1/reports': () => json(201, { id: 'r1' }),
    });
    const api = createApi({ fetch });
    api.setToken('t');
    const held = api.put('/turns/t1/feedback', { vote: 'up' });
    await api.put('/turns/t2/feedback', { vote: 'down' });
    await api.get('/turns/t1/feedback');
    await api.post('/turns/t1/reports', {});
    assert.deepEqual(calls.map((c) => c.key), [
      'PUT /v1/turns/t1/feedback',
      'PUT /v1/turns/t2/feedback',
      'GET /v1/turns/t1/feedback',
      'POST /v1/turns/t1/reports',
    ]);
    first.open();
    await held;
  });
});

describe('problems', () => {
  it('turns problem details into an ApiError with status, title, detail and code', async () => {
    const { fetch } = stubFetch({
      'POST /v1/admin/invitations': () =>
        problem(409, 'That person already has access', { detail: 'a@b.test is a user', code: 'invalid_state' }),
    });
    const api = createApi({ fetch });
    api.setToken('t1');
    const error = await api.post('/admin/invitations', { email: 'a@b.test' }).catch((e) => e);
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 409);
    assert.equal(error.title, 'That person already has access');
    assert.equal(error.message, 'That person already has access');
    assert.equal(error.detail, 'a@b.test is a user');
    assert.equal(error.code, 'invalid_state');
    assert.equal(error.retryable, false);
    assert.equal(error.reached, true);
  });

  it('keeps the fields a 422 names, so a form can show each message under its field', async () => {
    const { fetch } = stubFetch({
      'PATCH /v1/admin/products/p1': () =>
        problem(422, 'Validation error', { code: 'validation_error', errors: [
          { loc: ['body', 'allowed_origins', 1], msg: 'Value error, a site must use https', type: 'value_error' },
          { loc: ['body', 'name'], msg: 'String should have at most 60 characters', type: 'string_too_long' },
          'not an error',
        ] }),
      'PATCH /v1/admin/products/p2': () => problem(409, 'Conflict'),
    });
    const api = createApi({ fetch });
    api.setToken('t1');
    const error = await api.patch('/admin/products/p1', {}).catch((e) => e);
    assert.deepEqual(error.errors, [
      { loc: ['body', 'allowed_origins', 1], msg: 'Value error, a site must use https' },
      { loc: ['body', 'name'], msg: 'String should have at most 60 characters' },
    ]);
    const other = await api.patch('/admin/products/p2', {}).catch((e) => e);
    assert.deepEqual(other.errors, []);
  });
  it('says whether Broth itself answered: not for a network failure or a page from something in between', async () => {
    const { fetch } = stubFetch({
      'GET /v1/me': () => new Response('<html>Bad gateway</html>', { status: 502, headers: { 'content-type': 'text/html' } }),
      'GET /v1/facets': () => { throw new TypeError('Failed to fetch'); },
      'GET /v1/documents': () => problem(503, 'Broth is updating its index', {}, { 'retry-after': '5' }),
    });
    const api = createApi({ fetch });
    api.setToken('t1');
    const proxy = await api.get('/me').catch((e) => e);
    const offline = await api.get('/facets').catch((e) => e);
    const busy = await api.get('/documents').catch((e) => e);
    assert.deepEqual([proxy.status, proxy.reached], [502, false]);
    assert.deepEqual([offline.status, offline.reached], [0, false]);
    assert.deepEqual([busy.status, busy.reached, busy.title], [503, true, 'Broth is updating its index']);
  });

  it('honors Retry-After in seconds for 429 and as an HTTP date for 503', async () => {
    const now = Date.parse('2026-11-08T12:00:00Z');
    const { fetch } = stubFetch({
      'POST /v1/setup/claim': () => problem(429, 'Too many attempts', { code: 'rate_limited' }, { 'retry-after': '30' }),
      'GET /v1/me': () => problem(503, 'Broth is busy', { code: 'model_unavailable' }, { 'retry-after': 'Sun, 08 Nov 2026 12:00:12 GMT' }),
    });
    const api = createApi({ fetch, now: () => now });
    api.setToken('t1');
    const limited = await api.post('/setup/claim', { code: 'x', email: 'a@b.test' }, { auth: false }).catch((e) => e);
    assert.equal(limited.status, 429);
    assert.equal(limited.retryAfter, 30);
    assert.equal(limited.retryable, true);
    const busy = await api.get('/me').catch((e) => e);
    assert.equal(busy.retryAfter, 12);
    assert.equal(busy.retryable, true);
  });

  it('gives a readable title to errors that are not problem documents', async () => {
    const { fetch } = stubFetch({ 'GET /v1/me': () => new Response('<html>Bad gateway</html>', { status: 502 }) });
    const api = createApi({ fetch });
    api.setToken('t1');
    const error = await api.get('/me').catch((e) => e);
    assert.equal(error.status, 502);
    assert.equal(error.title, 'Broth could not be reached. Try again.');
    assert.equal(error.retryable, true);
  });

  it('reports a network failure as a retryable error with status 0', async () => {
    const { fetch } = stubFetch({
      'GET /v1/me': () => {
        throw new TypeError('Failed to fetch');
      },
    });
    const api = createApi({ fetch });
    api.setToken('t1');
    const error = await api.get('/me').catch((e) => e);
    assert.equal(error.status, 0);
    assert.equal(error.retryable, true);
  });
});

describe('answer streams', () => {
  const started = 'event: turn.started\ndata: {"turn_id":"t9"}\n\n';
  const completed = 'event: turn.completed\ndata: {"kind":"answered","text":"Yes [1].","citations":[]}\n\n';

  it('parses typed events from frames split across chunks and multi-byte characters', async () => {
    const delta = 'event: answer.delta\ndata: {"text":"Fees are €5 [1]."}\n\n';
    const bytes = encoder.encode(started + delta + completed);
    const euro = encoder.encode(started + 'event: answer.delta\ndata: {"text":"Fees are ').length + 1;
    const chunks = [bytes.slice(0, 7), bytes.slice(7, euro), bytes.slice(euro, euro + 40), bytes.slice(euro + 40)];
    const { response } = sse(chunks);
    const { fetch, calls } = stubFetch({ 'POST /v1/conversations/c1/turns': () => response });
    const api = createApi({ fetch });
    api.setToken('t1');
    const events = [];
    const result = await api.ask('c1', { question: 'Fees?' }, { onEvent: (e) => events.push(e) });
    assert.deepEqual(
      events.map((e) => e.event),
      ['turn.started', 'answer.delta', 'turn.completed'],
    );
    assert.equal(events[1].data.text, 'Fees are €5 [1].');
    assert.deepEqual(result, { event: 'turn.completed', data: { kind: 'answered', text: 'Yes [1].', citations: [] } });
    assert.equal(calls[0].init.method, 'POST');
    assert.equal(new Headers(calls[0].init.headers).get('accept'), 'text/event-stream');
    assert.equal(calls[0].init.body, JSON.stringify({ question: 'Fees?' }));
  });

  it('accepts CRLF and CR line endings and multi-line data', async () => {
    const { response } = sse([
      ': keep-alive\r\n\r\n',
      'event: status\r\ndata: {"stage":"searching",\r\ndata: "searched_documents":4}\r\n\r\n',
      'event: turn.completed\rdata: {"kind":"not_found"}\r\r',
    ]);
    const { fetch } = stubFetch({ 'POST /v1/turns/t1/regenerate': () => response });
    const api = createApi({ fetch });
    api.setToken('t1');
    const events = [];
    await api.regenerate('t1', { onEvent: (e) => events.push(e) });
    assert.deepEqual(events[0], { event: 'status', data: { stage: 'searching', searched_documents: 4 } });
    assert.equal(events[1].event, 'turn.completed');
  });

  it('ignores heartbeat comments and unknown events', async () => {
    const { response } = sse([started, ': keep-alive\n\n', 'event: something.new\ndata: {}\n\n', ':\n\n', completed]);
    const { fetch } = stubFetch({ 'POST /v1/conversations/c1/turns': () => response });
    const api = createApi({ fetch });
    api.setToken('t1');
    const events = [];
    await api.ask('c1', { question: 'q' }, { onEvent: (e) => events.push(e) });
    assert.deepEqual(
      events.map((e) => e.event),
      ['turn.started', 'turn.completed'],
    );
  });

  it('resolves with the error event when the stream reports one', async () => {
    const { response } = sse([
      started,
      'event: error\ndata: {"code":"model_unavailable","message":"Try again soon","retryable":true}\n\n',
    ]);
    const { fetch } = stubFetch({ 'POST /v1/conversations/c1/turns': () => response });
    const api = createApi({ fetch });
    api.setToken('t1');
    const result = await api.ask('c1', { question: 'q' });
    assert.deepEqual(result, {
      event: 'error',
      data: { code: 'model_unavailable', message: 'Try again soon', retryable: true },
    });
  });

  it('raises a retryable error when the stream ends without turn.completed or error', async () => {
    const { response } = sse([started, 'event: answer.delta\ndata: {"text":"Half an"}\n\n']);
    const { fetch } = stubFetch({ 'POST /v1/conversations/c1/turns': () => response });
    const api = createApi({ fetch });
    api.setToken('t1');
    const events = [];
    const error = await api.ask('c1', { question: 'q' }, { onEvent: (e) => events.push(e) }).catch((e) => e);
    assert.ok(error instanceof ApiError);
    assert.equal(error.code, 'stream_incomplete');
    assert.equal(error.retryable, true);
    assert.equal(error.turnId, 't9');
    assert.equal(events.length, 2);
  });

  it('stops reading when cancelled', async () => {
    const { response, wasCancelled } = sse([started], { hang: true });
    const { fetch } = stubFetch({ 'POST /v1/conversations/c1/turns': () => response });
    const api = createApi({ fetch });
    api.setToken('t1');
    const controller = new AbortController();
    const events = [];
    const pending = api.ask('c1', { question: 'q' }, {
      signal: controller.signal,
      onEvent: (e) => {
        events.push(e);
        controller.abort();
      },
    });
    await assert.rejects(pending, (error) => error.name === 'AbortError');
    assert.equal(wasCancelled(), true);
    assert.equal(events.length, 1);
  });

  it('returns problems that happen before the stream as ApiErrors', async () => {
    const { fetch } = stubFetch({
      'POST /v1/conversations/c1/turns': () => problem(429, 'Too many questions', { code: 'rate_limited' }, { 'retry-after': '20' }),
    });
    const api = createApi({ fetch });
    api.setToken('t1');
    const error = await api.ask('c1', { question: 'q' }).catch((e) => e);
    assert.equal(error.status, 429);
    assert.equal(error.retryAfter, 20);
  });

  it('refreshes once and retries the stream on 401', async () => {
    let asks = 0;
    const { fetch } = stubFetch({
      'POST /v1/auth/refresh': () => token('t2'),
      'POST /v1/conversations/c1/turns': ({ init }) => {
        asks += 1;
        if (new Headers(init.headers).get('authorization') !== 'Bearer t2') return problem(401, 'Sign in again');
        return sse([started, completed]).response;
      },
    });
    const api = createApi({ fetch });
    api.setToken('t1');
    const result = await api.ask('c1', { question: 'q' });
    assert.equal(result.event, 'turn.completed');
    assert.equal(asks, 2);
  });
});

describe('overlapping reads of one thing', () => {
  /** A read the test answers or fails by hand, in any order. */
  function reads() {
    const pending = [];
    const read = () => new Promise((resolve, reject) => pending.push({ resolve, reject }));
    return { read, pending };
  }

  it('a lone read settles with its own answer', async () => {
    const { read, pending } = reads();
    const facets = latest(read);
    const first = facets();
    pending[0].resolve('a');
    assert.equal(await first, 'a');
  });

  it('reads one after another each settle with their own answer', async () => {
    const { read, pending } = reads();
    const facets = latest(read);
    const first = facets();
    pending[0].resolve('a');
    assert.equal(await first, 'a');
    const second = facets();
    pending[1].resolve('b');
    assert.equal(await second, 'b');
  });

  it('an earlier read that lands after a later one settles with the later answer', async () => {
    const { read, pending } = reads();
    const facets = latest(read);
    const earlier = facets();
    const later = facets();
    pending[1].resolve('new');
    assert.equal(await later, 'new');
    pending[0].resolve('old');
    assert.equal(await earlier, 'new');
  });

  it('an earlier read that lands first waits for the later one', async () => {
    const { read, pending } = reads();
    const facets = latest(read);
    const earlier = facets();
    const later = facets();
    pending[0].resolve('old');
    let settled = false;
    earlier.then(() => { settled = true; });
    await new Promise((r) => setTimeout(r, 5));
    assert.equal(settled, false);
    pending[1].resolve('new');
    assert.deepEqual(await Promise.all([earlier, later]), ['new', 'new']);
  });

  it('when the later read fails, the earlier one fails with it even though it was answered', async () => {
    const { read, pending } = reads();
    const facets = latest(read);
    const earlier = facets();
    const later = facets();
    pending[0].resolve('old');
    pending[1].reject(new Error('down'));
    await assert.rejects(later, /down/);
    await assert.rejects(earlier, /down/);
  });

  it('when the earlier read fails, the later answer still counts for both', async () => {
    const { read, pending } = reads();
    const facets = latest(read);
    const earlier = facets();
    const later = facets();
    pending[0].reject(new Error('blip'));
    pending[1].resolve('new');
    assert.deepEqual(await Promise.all([earlier, later]), ['new', 'new']);
  });

  it('three reads answered in reverse settle with the third answer', async () => {
    const { read, pending } = reads();
    const facets = latest(read);
    const all = [facets(), facets(), facets()];
    pending[2].resolve('c');
    pending[1].resolve('b');
    pending[0].resolve('a');
    assert.deepEqual(await Promise.all(all), ['c', 'c', 'c']);
  });

  it('a read started while an overtaken one waits takes over in turn', async () => {
    const { read, pending } = reads();
    const facets = latest(read);
    const first = facets();
    const second = facets();
    pending[0].resolve('a'); // first now waits for second
    await new Promise((r) => setTimeout(r, 0));
    const third = facets();
    pending[1].resolve('b');
    pending[2].resolve('c');
    assert.deepEqual(await Promise.all([first, second, third]), ['c', 'c', 'c']);
  });
});
