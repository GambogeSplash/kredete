/* api.js: the only module that talks to the network (sandbox spec 4.1).
 *
 * - Every request is same-origin under /v1, so it works through the Vercel rewrite and when
 *   the API serves the client.
 * - The access token lives in memory only. On a 401 the request refreshes once through
 *   POST /v1/auth/refresh (the refresh cookie) and is retried; concurrent 401s share one
 *   refresh, and refreshes are serialized across tabs with the Web Locks API, because the
 *   server revokes a session when a rotated refresh token is presented twice.
 * - A refused refresh clears the token and notifies onSignedOut listeners (the app then
 *   shows the sign-in screen).
 * - Problems become one ApiError type carrying status, title, detail and code; Retry-After
 *   on 429 and 503 is exposed as retryAfter (seconds) so the UI can wait it out.
 * - ask() and regenerate() read the answer stream with fetch, parse its event/data frames
 *   into the typed events of the contract and support cancelling through an AbortSignal.
 *
 * Loaded as a classic script (window.API) and as a CommonJS module by the unit tests.
 */
(function (root, factory) {
  const exported = factory();
  if (typeof module === 'object' && module.exports) module.exports = exported;
  else root.API = exported.createApi({ fetch: root.fetch.bind(root) });
})(globalThis, function () {
  'use strict';

  /** @typedef {import('./types').components['schemas']} Schemas */
  /** @typedef {{ event: 'turn.started', data: { turn_id: string } }} TurnStartedEvent */
  /** @typedef {{ event: 'status', data: { stage: 'searching' | 'reading' | 'writing', searched_documents: number } }} StatusEvent */
  /** @typedef {{ event: 'answer.delta', data: { text: string } }} AnswerDeltaEvent */
  /** @typedef {{ event: 'turn.completed', data: Schemas['AnswerOut'] }} TurnCompletedEvent */
  /** @typedef {{ event: 'error', data: { code: string, message: string, retryable: boolean } }} StreamErrorEvent */
  /** @typedef {TurnStartedEvent | StatusEvent | AnswerDeltaEvent | TurnCompletedEvent | StreamErrorEvent} StreamEvent */
  /** @typedef {TurnCompletedEvent | StreamErrorEvent} StreamResult */
  /** @typedef {Record<string, string | number | boolean | null | undefined>} Query */
  /**
   * @typedef {object} RequestOptions
   * @property {boolean} [auth] false for routes that need no access token (setup status, claim)
   * @property {AbortSignal} [signal]
   */
  /**
   * @typedef {object} StreamOptions
   * @property {AbortSignal} [signal] aborting stops reading and rejects with an AbortError
   * @property {(event: StreamEvent) => void} [onEvent] called for every typed event, in order
   */
  /**
   * @typedef {object} ApiOptions
   * @property {typeof fetch} fetch
   * @property {string} [base] defaults to /v1
   * @property {() => number} [now] milliseconds since the epoch, for Retry-After dates
   * @property {<T>(name: string, task: () => Promise<T>) => Promise<T>} [lock] a cross-tab lock
   */

  const UNREACHABLE = 'Broth could not be reached. Try again.';
  const STREAM_EVENTS = new Set(['turn.started', 'status', 'answer.delta', 'turn.completed', 'error']);

  class ApiError extends Error {
    /**
     * @param {object} fields
     * @param {number} fields.status HTTP status, or 0 when the server could not be reached
     * @param {string} fields.title the problem title, safe to show to people
     * @param {string} [fields.detail]
     * @param {string} [fields.code] the problem's stable code
     * @param {number | null} [fields.retryAfter] seconds to wait before retrying
     * @param {boolean} [fields.retryable]
     * @param {string | null} [fields.turnId] for streams: the turn that had started
     * @param {boolean} [fields.reached] whether Broth itself answered (not a network failure, or a
     *   page without a problem document from something in between, such as a proxy's 502)
     */
    constructor({ status, title, detail = '', code = '', retryAfter = null, retryable, turnId = null, reached }) {
      super(title);
      this.name = 'ApiError';
      this.status = status;
      this.title = title;
      this.detail = detail;
      this.code = code;
      this.retryAfter = retryAfter;
      this.retryable = retryable ?? (status === 0 || status === 429 || status >= 500);
      this.turnId = turnId;
      this.reached = reached ?? status !== 0;
    }
  }

  /** @param {unknown} error */
  const isAbort = (error) => error instanceof Error && error.name === 'AbortError';
  /** Methods that write a resource in place, so the order of two writes decides what is stored. */
  const ORDERED = new Set(['PUT', 'PATCH', 'DELETE']);
  const settled = () => undefined;

  /**
   * Wraps a read that is repeated while earlier ones may still be in flight (the facets are
   * read at sign-in, as the Library opens and after an admin change). Every call settles with
   * the outcome of the read started last, so an earlier read that lands later never replaces
   * a newer answer, and the order the answers arrive in does not matter.
   * @template T
   * @param {() => Promise<T>} read
   * @returns {() => Promise<T>}
   */
  function latest(read) {
    /** @type {Promise<T> | null} */
    let newest = null;
    return async () => {
      /** @type {Promise<T>} */
      let mine = (newest = read());
      for (;;) {
        try {
          const value = await mine;
          if (mine === newest) return value;
        } catch (error) {
          if (mine === newest) throw error;
        }
        mine = /** @type {Promise<T>} */ (newest); // a later read took over: its outcome counts
      }
    };
  }

  /**
   * Seconds until a Retry-After value (delta seconds or an HTTP date), or null.
   * @param {string | null} value
   * @param {number} now
   */
  function parseRetryAfter(value, now) {
    if (!value) return null;
    if (/^\d+$/.test(value.trim())) return Number(value.trim());
    const at = Date.parse(value);
    return Number.isNaN(at) ? null : Math.max(0, Math.ceil((at - now) / 1000));
  }

  /**
   * @param {Response} response
   * @param {number} now
   * @returns {Promise<ApiError>}
   */
  async function problemOf(response, now) {
    /** @type {{ title?: unknown, detail?: unknown, code?: unknown }} */
    let body = {};
    const type = response.headers.get('content-type') || '';
    if (/json/.test(type)) body = await response.json().catch(() => ({}));
    const retryAfter =
      response.status === 429 || response.status === 503
        ? parseRetryAfter(response.headers.get('retry-after'), now)
        : null;
    const reached = typeof body.title === 'string' && !!body.title;
    return new ApiError({
      status: response.status,
      reached,
      title: reached ? /** @type {string} */ (body.title) : UNREACHABLE,
      detail: typeof body.detail === 'string' ? body.detail : '',
      code: typeof body.code === 'string' ? body.code : '',
      retryAfter,
    });
  }

  /**
   * Splits a byte stream into server-sent event frames ({event, data} with data parsed as
   * JSON). Comment lines (heartbeats) and frames without data are skipped.
   * @param {ReadableStreamDefaultReader<Uint8Array>} reader
   * @returns {AsyncGenerator<{ event: string, data: unknown }>}
   */
  async function* frames(reader) {
    const decoder = new TextDecoder();
    let buffer = '';
    let event = '';
    /** @type {string[]} */
    let data = [];
    let ended = false;
    while (!ended) {
      const { value, done } = await reader.read();
      if (done) {
        buffer += decoder.decode();
        ended = true;
      } else {
        buffer += decoder.decode(value, { stream: true });
      }
      // A lone \r at the end may be the first half of \r\n: wait for the next chunk.
      const lines = buffer.split(/\r\n|\n|\r(?!$)/);
      buffer = ended ? '' : lines.pop() || '';
      if (ended && lines.length && lines[lines.length - 1] === '') lines.pop();
      for (const raw of lines) {
        const line = raw.replace(/\r$/, '');
        if (line === '') {
          if (data.length) {
            const text = data.join('\n');
            /** @type {unknown} */
            let parsed = text;
            try {
              parsed = JSON.parse(text);
            } catch {
              /* keep the raw text */
            }
            yield { event: event || 'message', data: parsed };
          }
          event = '';
          data = [];
          continue;
        }
        if (line.startsWith(':')) continue;
        const colon = line.indexOf(':');
        const field = colon < 0 ? line : line.slice(0, colon);
        const content = colon < 0 ? '' : line.slice(colon + 1).replace(/^ /, '');
        if (field === 'event') event = content;
        else if (field === 'data') data.push(content);
      }
    }
  }

  /** @param {ApiOptions} options */
  function createApi(options) {
    const base = options.base ?? '/v1';
    const now = options.now ?? (() => Date.now());
    const fetchImpl = options.fetch;
    const lock =
      options.lock ??
      /** @type {<T>(name: string, task: () => Promise<T>) => Promise<T>} */ (
        (name, task) => {
          const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
          return locks ? /** @type {any} */ (locks.request(name, task)) : task();
        }
      );

    /** @type {string | null} */
    let token = null;
    /** @type {Promise<string> | null} */
    let refreshing = null;
    /** True once the session is known to be over; listeners fire on the change only. */
    let ended = false;
    /** @type {Set<() => void>} */
    const signedOutListeners = new Set();
    /** The last write still in flight for each resource path. @type {Map<string, Promise<unknown>>} */
    const writes = new Map();

    /**
     * @param {string} path
     * @param {Query} [query]
     */
    function url(path, query) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(query || {})) {
        if (value !== undefined && value !== null && value !== '') params.append(key, String(value));
      }
      const search = params.toString();
      return `${base}${path}${search ? `?${search}` : ''}`;
    }

    /**
     * @param {string} target
     * @param {RequestInit} init
     */
    async function send(target, init) {
      try {
        return await fetchImpl(target, { credentials: 'same-origin', ...init });
      } catch (error) {
        if (isAbort(error)) throw error;
        throw new ApiError({ status: 0, title: UNREACHABLE, code: 'network' });
      }
    }

    function signOut() {
      token = null;
      if (ended) return;
      ended = true;
      for (const listener of signedOutListeners) listener();
    }

    /**
     * Exchanges the refresh cookie for a new access token. Concurrent callers share one
     * request. A refused refresh signs out; other failures leave the session alone.
     * @returns {Promise<string>}
     */
    function refresh() {
      if (!refreshing) {
        refreshing = lock('broth-refresh', async () => {
          const response = await send(url('/auth/refresh'), { method: 'POST' });
          if (!response.ok) throw await problemOf(response, now());
          /** @type {Schemas['AccessTokenResponse']} */
          const body = await response.json();
          return body.access_token;
        })
          .then((value) => {
            token = value;
            ended = false;
            return value;
          })
          .catch((error) => {
            if (error instanceof ApiError && error.status === 401) signOut();
            throw error;
          })
          .finally(() => {
            refreshing = null;
          });
      }
      return refreshing;
    }

    /**
     * Sends a request with the access token, refreshing first when there is none and once
     * more on a 401. Resolves with the Response for 2xx answers.
     * @param {string} target
     * @param {RequestInit} init
     * @param {boolean} auth
     */
    async function authorized(target, init, auth) {
      if (!auth) {
        const response = await send(target, init);
        if (!response.ok) throw await problemOf(response, now());
        return response;
      }
      for (let attempt = 0; ; attempt += 1) {
        const current = token ?? (await refresh());
        const headers = new Headers(init.headers);
        headers.set('authorization', `Bearer ${current}`);
        const response = await send(target, { ...init, headers });
        if (response.status === 401 && attempt === 0) {
          // Another request may already hold a newer token; otherwise refresh (shared).
          if (token === current) token = null;
          if (token === null) await refresh();
          continue;
        }
        if (response.status === 401) signOut();
        if (!response.ok) throw await problemOf(response, now());
        return response;
      }
    }

    /**
     * @param {string} method
     * @param {string} path
     * @param {{ query?: Query, body?: unknown } & RequestOptions} [options]
     * @returns {Promise<any>}
     */
    function request(method, path, options = {}) {
      if (!ORDERED.has(method)) return exchange(method, path, options);
      // Writes to one resource go out one at a time, in the order they were made: two in flight
      // at once can reach the server in either order and leave it holding the older one.
      const previous = writes.get(path);
      const mine = (previous ? previous.then(settled, settled) : Promise.resolve()).then(() => exchange(method, path, options));
      writes.set(path, mine);
      const forget = () => { if (writes.get(path) === mine) writes.delete(path); };
      mine.then(forget, forget);
      return mine;
    }

    /**
     * @param {string} method
     * @param {string} path
     * @param {{ query?: Query, body?: unknown } & RequestOptions} [options]
     * @returns {Promise<any>}
     */
    async function exchange(method, path, options = {}) {
      /** @type {RequestInit} */
      const init = { method, signal: options.signal, headers: { accept: 'application/json' } };
      if (options.body !== undefined) {
        init.body = JSON.stringify(options.body);
        init.headers = { ...init.headers, 'content-type': 'application/json' };
      }
      const response = await authorized(url(path, options.query), init, options.auth !== false);
      if (response.status === 204) return null;
      const type = response.headers.get('content-type') || '';
      return /json/.test(type) ? response.json() : null;
    }

    /**
     * POSTs to a streaming route and reads its events until turn.completed or error.
     * @param {string} path
     * @param {unknown} body
     * @param {StreamOptions} options
     * @returns {Promise<StreamResult>}
     */
    async function stream(path, body, options = {}) {
      /** @type {RequestInit} */
      const init = {
        method: 'POST',
        signal: options.signal,
        headers: { accept: 'text/event-stream', 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      };
      const response = await authorized(url(path), init, true);
      if (!response.body) throw new ApiError({ status: 0, title: UNREACHABLE, code: 'network' });
      const reader = response.body.getReader();
      const stopReading = () => {
        reader.cancel().catch(() => {});
      };
      options.signal?.addEventListener('abort', stopReading, { once: true });
      /** @type {string | null} */
      let turnId = null;
      try {
        for await (const frame of frames(reader)) {
          if (!STREAM_EVENTS.has(frame.event)) continue;
          const event = /** @type {StreamEvent} */ (frame);
          if (event.event === 'turn.started') turnId = event.data.turn_id;
          if (options.onEvent) options.onEvent(event);
          if (options.signal && options.signal.aborted) break;
          if (event.event === 'turn.completed' || event.event === 'error') return event;
        }
      } catch (error) {
        if (isAbort(error)) throw error;
        if (error instanceof ApiError) throw error;
        throw new ApiError({
          status: 0,
          title: 'The answer was cut off.',
          code: 'stream_incomplete',
          retryable: true,
          turnId,
        });
      } finally {
        options.signal?.removeEventListener('abort', stopReading);
        reader.cancel().catch(() => {});
      }
      if (options.signal && options.signal.aborted) {
        throw new DOMException('The answer was stopped', 'AbortError');
      }
      throw new ApiError({
        status: 0,
        title: 'The answer was cut off.',
        code: 'stream_incomplete',
        retryable: true,
        turnId,
      });
    }

    return {
      ApiError,
      latest,
      /** Where a full-page navigation starts Google sign-in. */
      signInUrl: `${base}/auth/google/start`,
      /** @param {string | null} value */
      setToken(value) {
        token = value;
        if (value !== null) ended = false;
      },
      hasToken: () => token !== null,
      /** @param {() => void} listener */
      onSignedOut(listener) {
        signedOutListeners.add(listener);
        return () => signedOutListeners.delete(listener);
      },
      refresh,
      /** Ends the session on the server (best effort) and forgets the access token. */
      async logout() {
        try {
          const response = await send(url('/auth/logout'), { method: 'POST' });
          if (!response.ok && response.status !== 401) throw await problemOf(response, now());
        } catch {
          /* the token is dropped either way; the refresh cookie expires on its own */
        } finally {
          token = null;
        }
      },
      /**
       * @param {string} path
       * @param {Query} [query]
       * @param {RequestOptions} [options]
       */
      get: (path, query, options) => request('GET', path, { ...options, query }),
      /**
       * @param {string} path
       * @param {unknown} [body]
       * @param {RequestOptions} [options]
       */
      post: (path, body, options) => request('POST', path, { ...options, body }),
      /**
       * @param {string} path
       * @param {unknown} [body]
       * @param {RequestOptions} [options]
       */
      put: (path, body, options) => request('PUT', path, { ...options, body }),
      /**
       * @param {string} path
       * @param {unknown} [body]
       * @param {RequestOptions} [options]
       */
      patch: (path, body, options) => request('PATCH', path, { ...options, body }),
      /**
       * @param {string} path
       * @param {RequestOptions} [options]
       */
      del: (path, options) => request('DELETE', path, options),
      /**
       * Asks a question in a conversation. Resolves with the terminal event.
       * @param {string} conversationId
       * @param {Schemas['AskIn']} body
       * @param {StreamOptions} [options]
       */
      ask: (conversationId, body, options) =>
        stream(`/conversations/${encodeURIComponent(conversationId)}/turns`, body, options),
      /**
       * Regenerates a turn: a new turn that replaces it. Resolves with the terminal event.
       * @param {string} turnId
       * @param {StreamOptions} [options]
       */
      regenerate: (turnId, options) => stream(`/turns/${encodeURIComponent(turnId)}/regenerate`, undefined, options),
    };
  }

  return { createApi, ApiError, parseRetryAfter, latest };
});
