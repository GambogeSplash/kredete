// Unit tests for api.js (sandbox spec 4.1 and 6.2): fetch is stubbed, nothing touches the network.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';

const { createApi, ApiError } = createRequire(import.meta.url)('../../api.js');

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
  });

  it('honors Retry-After in seconds for 429 and as an HTTP date for 503', async () => {
    const now = Date.parse('2026-11-08T12:00:00Z');
    const { fetch } = stubFetch({
      'POST /v1/setup/claim': () => problem(429, 'Too many attempts', { code: 'rate_limited' }, { 'retry-after': '30' }),
      'GET /v1/me': () => problem(503, 'Brain is busy', { code: 'model_unavailable' }, { 'retry-after': 'Sun, 08 Nov 2026 12:00:12 GMT' }),
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
    assert.equal(error.title, 'Brain could not be reached. Try again.');
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
