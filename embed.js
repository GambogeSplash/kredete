/* embed.js: the Broth support bot widget (support bot spec 7).
 *
 * Paste one script tag on a site the bot's product allows:
 *   <script src="https://<client>/embed.js" data-key="bk_live_..." data-api="https://<bot API>" async></script>
 *
 * - Everything but the key and the API address comes from GET /v1/bot. When the settings
 *   cannot load (unknown or revoked key, a site the product does not allow, a network or
 *   server error), the widget renders nothing and logs one console warning.
 * - It renders inside an open Shadow DOM, so the host page's CSS cannot reach it, and has
 *   no dependencies. Light and dark follow the visitor's prefers-color-scheme.
 * - Answers arrive whole: the bot API holds them until they are checked, and sends only
 *   status steps meanwhile.
 * - The conversation, its visitor token and the transcript live in sessionStorage behind
 *   try/catch; the widget works without storage.
 * - Personal data is detected by Broth only. When a question was masked, the masked text
 *   replaces what the visitor typed, on screen and in storage.
 *
 * Loaded as a classic script on host pages, and as a CommonJS module by the unit tests,
 * which use the pure parts: the stream parser, the bot client, the store and the views.
 */
(function (root, factory) {
  const exported = factory();
  if (typeof module === 'object' && module.exports) module.exports = exported;
  else void exported.boot(root);
})(globalThis, function () {
  'use strict';

  const MAX_QUESTION = 1000;

  /** What the visitor reads (support bot spec 5.3, 7.2 and 10). */
  const COPY = {
    no_answer: "I couldn't find that in our help content.",
    account_question: "I can't see your account, so I can't answer questions about it. Our support team can help.",
    advice_boundary: "I can explain how our products work, but I can't advise on what's right for you.",
    personal_data: "Please don't share card or account numbers here. I've hidden what you typed.",
    account_note: 'For anything about your own account, our support team can help.',
    unavailable: 'This assistant is unavailable right now.',
    error: 'Something went wrong.',
    offline: "You're offline. I'll try again when you're back online.",
    too_long: `That question is too long. Keep it under ${MAX_QUESTION.toLocaleString('en-US')} characters.`,
    rate: (/** @type {number} */ seconds) =>
      `You're asking quickly. Try again in ${seconds} ${seconds === 1 ? 'second' : 'seconds'}.`,
    retry: 'Try again',
    footer: "Don't share personal details. Questions are kept for 90 days.",
    privacy: 'How we use your questions',
    placeholder: 'Ask a question',
    send: 'Send',
    open: 'Open help',
    close: 'Close help',
    helpful: 'Helpful',
    not_helpful: 'Not helpful',
    thanks: 'Thanks for the feedback.',
    why: 'What was wrong?',
    sources: 'Sources',
    /** @type {Record<string, string>} */
    stages: {
      thinking: 'Thinking',
      searching: 'Searching our help content',
      reading: 'Reading',
      writing: 'Writing an answer',
      checking: 'Checking the answer',
    },
    reasons: [
      ['wrong', 'Wrong'],
      ['outdated', 'Out of date'],
      ['incomplete', "Didn't answer my question"],
      ['could_not_check', "Couldn't check the source"],
    ],
  };

  /** @type {Record<string, string>} */
  const REPLY_TEXT = {
    no_answer: COPY.no_answer,
    account_question: COPY.account_question,
    advice_boundary: COPY.advice_boundary,
  };

  // ---- the answer stream ----

  /**
   * Splits a text/event-stream into events. Feed it chunks; it returns the complete events.
   * Comment lines (heartbeats) are skipped, and so are malformed frames.
   */
  function createSseParser() {
    let buffer = '';
    /** @param {string} chunk */
    function feed(chunk) {
      buffer += chunk.replace(/\r\n/g, '\n');
      /** @type {{event: string, data: any}[]} */
      const out = [];
      let end;
      while ((end = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        let event = 'message';
        const data = [];
        for (const line of frame.split('\n')) {
          if (line.startsWith(':')) continue;
          if (line.startsWith('event:')) event = line.slice(6).trim();
          else if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
        }
        if (!data.length) continue;
        try {
          out.push({ event, data: JSON.parse(data.join('\n')) });
        } catch (_) {
          /* a malformed frame is ignored */
        }
      }
      return out;
    }
    return { feed };
  }

  // ---- the bot API ----

  class BotError extends Error {
    /**
     * @param {'http' | 'network' | 'stream'} kind
     * @param {{status?: number, code?: string, retryAfter?: number, retryable?: boolean}} [details]
     */
    constructor(kind, details = {}) {
      super(details.code || kind);
      this.kind = kind;
      this.status = details.status || 0;
      this.code = details.code || '';
      this.retryAfter = details.retryAfter || 0;
      this.retryable = details.retryable !== false;
    }
  }

  /** @param {Response} response */
  async function httpError(response) {
    let code = '';
    try {
      code = (await response.json()).code || '';
    } catch (_) {
      /* not a problem document */
    }
    const retryAfter = Number(response.headers.get('retry-after')) || 0;
    return new BotError('http', { status: response.status, code, retryAfter });
  }

  /**
   * The bot API client. `fetch` is injected so tests never touch the network.
   * @param {{fetch: typeof fetch, api: string, key: string}} options
   */
  function createBotClient({ fetch, api, key }) {
    const base = api.replace(/\/+$/, '') + '/v1/bot';
    /** @param {string} [visitor] */
    const headers = (visitor) => {
      /** @type {Record<string, string>} */
      const out = { Authorization: `Bearer ${key}` };
      if (visitor) out['Broth-Visitor'] = visitor;
      return out;
    };
    /**
     * @param {string} path
     * @param {RequestInit} init
     */
    async function call(path, init) {
      try {
        return await fetch(base + path, { ...init, credentials: 'omit', mode: 'cors' });
      } catch (_) {
        throw new BotError('network');
      }
    }
    return {
      async settings() {
        const response = await call('', { headers: headers() });
        if (!response.ok) throw await httpError(response);
        return response.json();
      },
      async start() {
        const response = await call('/conversations', { method: 'POST', headers: headers() });
        if (!response.ok) throw await httpError(response);
        const body = await response.json();
        return { id: String(body.conversation_id), token: String(body.visitor_token) };
      },
      /**
       * Asks and resolves with the turn: its id, the masked question (if masking changed
       * it) and the reply. `onStatus` receives each stage.
       * @param {{id: string, token: string}} conversation
       * @param {string} question
       * @param {(stage: string) => void} [onStatus]
       * @returns {Promise<{turnId: string, question: string | null, reply: any}>}
       */
      async ask(conversation, question, onStatus = () => {}) {
        const response = await call(`/conversations/${encodeURIComponent(conversation.id)}/turns`, {
          method: 'POST',
          headers: { ...headers(conversation.token), 'Content-Type': 'application/json' },
          body: JSON.stringify({ question }),
        });
        if (!response.ok) throw await httpError(response);
        if (!response.body) throw new BotError('stream');
        const parser = createSseParser();
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let turnId = '';
        /** @type {string | null} */
        let masked = null;
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            for (const { event, data } of parser.feed(decoder.decode(value, { stream: true }))) {
              if (event === 'turn.started') {
                turnId = String(data.turn_id);
                masked = typeof data.question === 'string' ? data.question : null;
              } else if (event === 'status') onStatus(String(data.stage));
              else if (event === 'turn.completed') return { turnId, question: masked, reply: data };
              else if (event === 'error') {
                throw new BotError('stream', { code: data.code, retryable: data.retryable !== false });
              }
            }
          }
        } catch (error) {
          if (error instanceof BotError) throw error;
          throw new BotError('network');
        }
        throw new BotError('stream');
      },
      /**
       * @param {string} turnId
       * @param {string} token
       * @param {'up' | 'down'} vote
       * @param {string | null} [reason]
       */
      async feedback(turnId, token, vote, reason = null) {
        const response = await call(`/turns/${encodeURIComponent(turnId)}/feedback`, {
          method: 'PUT',
          headers: { ...headers(token), 'Content-Type': 'application/json' },
          body: JSON.stringify(reason ? { vote, reason } : { vote }),
        });
        if (!response.ok) throw await httpError(response);
      },
    };
  }

  // ---- what is remembered for the tab ----

  /**
   * The conversation and transcript for this key, in sessionStorage. Every access is
   * guarded: a blocked or full storage simply remembers nothing.
   * @param {Storage | undefined} storage
   * @param {string} key
   */
  function createStore(storage, key) {
    const name = `broth-bot:${key.slice(-12)}`;
    return {
      /** @returns {{conversation: {id: string, token: string} | null, messages: any[]}} */
      load() {
        try {
          const raw = storage ? storage.getItem(name) : null;
          const parsed = raw ? JSON.parse(raw) : null;
          if (parsed && Array.isArray(parsed.messages)) {
            return { conversation: parsed.conversation || null, messages: parsed.messages };
          }
        } catch (_) {
          /* nothing usable */
        }
        return { conversation: null, messages: [] };
      },
      /** @param {{conversation: {id: string, token: string} | null, messages: any[]}} state */
      save(state) {
        try {
          if (storage) {
            const messages = state.messages.filter((m) => m.role !== 'notice').slice(-40);
            storage.setItem(name, JSON.stringify({ conversation: state.conversation, messages }));
          }
        } catch (_) {
          /* storage is optional */
        }
      },
    };
  }

  // ---- views: plain HTML strings, so they are testable without a DOM ----

  /** @param {unknown} text */
  const esc = (text) =>
    String(text == null ? '' : text).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

  /** A link that is safe to render: https, http or mailto only. @param {unknown} url */
  const safeUrl = (url) => (typeof url === 'string' && /^(https:|http:|mailto:)/i.test(url) ? url : null);

  /** @param {any} settings */
  function contactLink(settings) {
    const url = safeUrl(settings.contact_url);
    if (!url) return '';
    const external = url.startsWith('mailto:') ? '' : ' target="_blank" rel="noopener noreferrer"';
    return `<a class="contact" href="${esc(url)}"${external}>${esc(settings.contact_label)}</a>`;
  }

  /** Sentence text, with its [n] markers set apart. @param {string} text */
  const withMarkers = (text) => esc(text).replace(/\s*\[(\d+)\]/g, (_, n) => `<sup class="ref">[${n}]</sup>`);

  /**
   * One message of the transcript.
   * @param {any} message
   * @param {any} settings
   * @param {number} index
   */
  function messageView(message, settings, index) {
    if (message.role === 'user') return `<div class="msg me">${esc(message.text)}</div>`;
    if (message.role === 'greeting') return `<div class="msg bot">${esc(message.text)}</div>`;
    if (message.role === 'notice') return noticeView(message, settings);
    const reply = message.reply || {};
    const parts = [];
    if (reply.personal_data_warning) parts.push(`<p class="warn" role="note">${esc(COPY.personal_data)}</p>`);
    if (reply.kind === 'answered') {
      parts.push(`<p>${(reply.sentences || []).map((/** @type {any} */ s) => withMarkers(s.text)).join(' ')}</p>`);
      const sources = reply.sources || [];
      if (sources.length) {
        const items = sources.map((/** @type {any} */ s) => {
          const url = safeUrl(s.url);
          const title = esc(s.title);
          const body = url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${title}</a>` : title;
          return `<li value="${Number(s.n) || 0}">${body}</li>`;
        });
        parts.push(`<ol class="sources" aria-label="${esc(COPY.sources)}">${items.join('')}</ol>`);
      }
      // A rule asked about one's own account: answered, then pointed to support for the rest.
      if (reply.account_note) parts.push(`<p class="note">${esc(COPY.account_note)}</p>`, contactLink(settings));
    } else if (reply.kind === 'chat') {
      // A conversational reply (a greeting, thanks, a question about the assistant): no sources.
      parts.push(`<p>${sentencesText(reply)}</p>`);
    } else if (reply.kind === 'no_answer' && sentencesText(reply)) {
      // The server words it from the question's topic; replies stored before keep the copy.
      parts.push(`<p>${sentencesText(reply)}</p>`, contactLink(settings));
    } else {
      parts.push(`<p>${esc(REPLY_TEXT[reply.kind] || COPY.no_answer)}</p>`, contactLink(settings));
    }
    if (message.turnId) parts.push(feedbackView(message, index));
    return `<div class="msg bot" data-kind="${esc(reply.kind)}">${parts.join('')}</div>`;
  }

  /** A reply's uncited sentences, escaped, as one paragraph's text. @param {any} reply */
  function sentencesText(reply) {
    return (reply.sentences || []).map((/** @type {any} */ s) => esc(String(s.text || ''))).join(' ').trim();
  }

  /** @param {any} message @param {number} index */
  function feedbackView(message, index) {
    if (message.vote === 'up' || message.reason) return `<p class="thanks" role="status">${esc(COPY.thanks)}</p>`;
    const pressed = (/** @type {string} */ v) => (message.vote === v ? 'true' : 'false');
    const thumbs =
      `<div class="thumbs">` +
      `<button type="button" class="icon" data-action="vote" data-index="${index}" data-vote="up" aria-pressed="${pressed('up')}" aria-label="${esc(COPY.helpful)}">${ICONS.up}</button>` +
      `<button type="button" class="icon" data-action="vote" data-index="${index}" data-vote="down" aria-pressed="${pressed('down')}" aria-label="${esc(COPY.not_helpful)}">${ICONS.down}</button>` +
      `</div>`;
    if (message.vote !== 'down') return thumbs;
    const reasons = COPY.reasons
      .map(([value, label]) => `<button type="button" class="chip" data-action="reason" data-index="${index}" data-reason="${value}">${esc(label)}</button>`)
      .join('');
    return `${thumbs}<div class="reasons" role="group" aria-label="${esc(COPY.why)}"><span>${esc(COPY.why)}</span>${reasons}</div>`;
  }

  /** @param {any} message @param {any} settings */
  function noticeView(message, settings) {
    switch (message.kind) {
      case 'unavailable':
        return `<div class="msg bot notice" data-kind="unavailable"><p>${esc(COPY.unavailable)}</p>${contactLink(settings)}</div>`;
      case 'rate':
        return `<div class="msg bot notice" data-kind="rate"><p>${esc(COPY.rate(message.seconds || 1))}</p></div>`;
      case 'offline':
        return `<div class="msg bot notice" data-kind="offline"><p>${esc(COPY.offline)}</p></div>`;
      default:
        return `<div class="msg bot notice" data-kind="error"><p>${esc(COPY.error)}</p><button type="button" class="chip" data-action="retry">${esc(COPY.retry)}</button>${contactLink(settings)}</div>`;
    }
  }

  /**
   * The open panel.
   * @param {any} settings
   * @param {{messages: any[], busy: boolean, stage: string | null, started: boolean, error: string | null, disabled: boolean}} state
   */
  function panelView(settings, state) {
    const starters =
      !state.started && Array.isArray(settings.starters) && settings.starters.length
        ? `<div class="starters">${settings.starters
            .map((/** @type {string} */ q) => `<button type="button" class="chip" data-action="ask" data-question="${esc(q)}">${esc(q)}</button>`)
            .join('')}</div>`
        : '';
    const greeting = settings.greeting ? messageView({ role: 'greeting', text: settings.greeting }, settings, -1) : '';
    const status = state.busy
      ? `<div class="msg bot status" role="status"><span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>${esc(
          COPY.stages[state.stage || 'thinking'] || COPY.stages.thinking,
        )}</div>`
      : '';
    const privacy = safeUrl(settings.privacy_url);
    const messages = state.messages.map((m, i) => messageView(m, settings, i)).join('');
    const sendDisabled = state.busy || state.disabled ? ' disabled' : '';
    return (
      `<div class="panel" role="dialog" aria-modal="true" aria-labelledby="bot-name">` +
      `<header><span class="avatar" aria-hidden="true">${ICONS.mark}</span><h2 id="bot-name">${esc(settings.name)}</h2>` +
      `<button type="button" class="icon close" data-action="close" aria-label="${esc(COPY.close)}">${ICONS.close}</button></header>` +
      `<p class="notice-line">${esc(settings.notice)}</p>` +
      `<div class="log" role="log" aria-live="polite" aria-relevant="additions">${greeting}${starters}${messages}${status}</div>` +
      `<form class="composer" data-action="submit"><label class="sr" for="bot-input">${esc(COPY.placeholder)}</label>` +
      `<textarea id="bot-input" rows="1" maxlength="${MAX_QUESTION}" placeholder="${esc(COPY.placeholder)}"${state.disabled ? ' disabled' : ''}></textarea>` +
      `<button type="submit" class="send" aria-label="${esc(COPY.send)}"${sendDisabled}>${ICONS.send}</button></form>` +
      (state.error ? `<p class="input-error" role="alert">${esc(state.error)}</p>` : '') +
      `<footer>${esc(COPY.footer)}${privacy ? ` <a href="${esc(privacy)}" target="_blank" rel="noopener noreferrer">${esc(COPY.privacy)}</a>` : ''}</footer>` +
      `</div>`
    );
  }

  const ICONS = {
    chat: '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="currentColor" d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 4v-4H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/></svg>',
    mark: '<svg viewBox="0 0 276 245" width="16" height="14" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="M0.3 242.5 C-0.7 239.8 12.3 209.2 29.5 173.5 C41.1 149.5 50.7 128.0 75.6 69.6 C99.0 15.0 100.2 12.9 112.8 6.2 C124.0 0.2 128.1 -0.2 171.0 0.3 C213.8 0.7 217.0 1.1 230.4 8.3 C264.8 26.7 270.1 80.0 240.3 108.7 L234.9 113.8L240.7 117.8 C265.8 134.8 275.1 166.9 264.1 198.0 C255.8 221.5 238.8 236.0 213.0 241.8 C206.5 243.3 198.3 243.5 149.0 243.5 L92.5 243.5L92.2 241.0 C91.8 237.5 101.6 207.6 103.7 205.9 C105.0 204.8 114.7 204.4 153.4 204.0 C200.9 203.5 201.6 203.5 207.3 201.2 C232.7 190.9 234.4 153.1 209.9 140.5 C203.4 137.1 200.2 136.7 176.0 136.1 L151.5 135.5L151.2 118.1 C151.0 106.8 151.3 100.3 152.0 99.5 C152.8 98.5 158.7 98.1 175.3 97.8 C196.1 97.5 197.8 97.3 202.8 95.1 C221.0 86.9 225.7 60.6 211.4 46.3 C203.6 38.4 201.3 38.0 167.5 38.0 C131.3 38.0 135.2 35.8 124.7 62.0 C106.0 108.9 93.7 138.0 75.6 178.3 C69.7 191.5 61.6 210.9 52.8 233.0 C48.2 244.5 49.6 244.0 23.4 244.0 C4.1 244.0 0.9 243.8 0.3 242.5 Z"/></svg>',
    close: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M6 6l12 12M18 6 6 18"/></svg>',
    send: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M3 11.5 21 3l-6.5 18-3-7.5L3 11.5Z"/></svg>',
    up: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M7 11v9H4v-9h3Zm0 0 4-8a2 2 0 0 1 2 2v4h5.5a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 17.3 20H7"/></svg>',
    down: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M17 13V4h3v9h-3Zm0 0-4 8a2 2 0 0 1-2-2v-4H5.5a2 2 0 0 1-2-2.3l1.2-7A2 2 0 0 1 6.7 4H17"/></svg>',
  };

  const DARK = '--surface:#161616;--shell:#1f1f1f;--fill:#272727;--line:#333;--ink:#f1f1f1;--ink-2:#d2d2d2;--mute:#a1a1a1;--warn:#ffd77a;--warn-soft:#3a2f12;--danger:#ff8a80;--shadow:0 1px 2px rgba(0,0,0,.4),0 16px 40px -8px rgba(0,0,0,.6)';

  /**
   * Design-system tokens, inlined: the widget lives on other people's pages. A preview sets
   * data-contained (stay inside the host element, never full screen) and data-scheme (light or
   * dark, whatever the device prefers); host pages set neither.
   * @param {string} accent
   */
  function styles(accent) {
    return `
:host{all:initial;
  --font:"Inter Variable",Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  --accent:${accent};--surface:#fff;--shell:#f6f6f7;--fill:#efeff1;--line:#e6e6e9;--ink:#1b1b1f;--ink-2:#3b3d42;--mute:#62666d;
  --warn:#7a5200;--warn-soft:#fff1cf;--danger:#d23a30;--r-md:12px;--r-lg:18px;--r-xl:24px;
  --shadow:0 1px 2px rgba(0,0,0,.05),0 16px 40px -8px rgba(0,0,0,.18);--e3:var(--shadow);
  --dur:.22s;--ease:cubic-bezier(.2,.8,.2,1);
  position:fixed;bottom:20px;z-index:2147483000;font:14px/1.5 var(--font);color:var(--ink)}
@media (prefers-color-scheme:dark){:host(:not([data-scheme="light"])){${DARK}}}
:host([data-scheme="dark"]){${DARK}}
:host([data-side="right"]){right:20px}:host([data-side="left"]){left:20px}
:host([data-contained]){position:absolute;bottom:16px;z-index:1}
:host([data-contained][data-side="right"]){right:16px}:host([data-contained][data-side="left"]){left:16px}
:host([data-contained]) .panel{width:var(--bb-panel-w,380px);max-width:none;height:var(--bb-panel-h,520px)}
*{box-sizing:border-box}
button{font:inherit;color:inherit;cursor:pointer}
button:focus-visible,a:focus-visible,textarea:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.launcher{width:56px;height:56px;border-radius:999px;border:0;background:var(--accent);color:#fff;box-shadow:var(--e3);display:grid;place-items:center;transition:transform var(--dur) var(--ease)}
.launcher:hover{transform:translateY(-1px)}
.panel{position:absolute;bottom:72px;width:380px;max-width:calc(100vw - 40px);height:min(600px,calc(100vh - 120px));background:var(--surface);border:1px solid var(--line);border-radius:var(--r-xl);box-shadow:var(--e3);display:flex;flex-direction:column;overflow:hidden}
:host([data-side="right"]) .panel{right:0}:host([data-side="left"]) .panel{left:0}
header{display:flex;align-items:center;gap:10px;padding:12px 12px 12px 16px;border-bottom:1px solid var(--line)}
header h2{flex:1;margin:0;font-size:15px;line-height:1.3;font-weight:600}
.avatar{width:30px;height:30px;flex:none;border-radius:32%;background:var(--accent);color:#fff;display:grid;place-items:center}
.icon{border:0;background:transparent;width:32px;height:32px;border-radius:var(--r-md);display:grid;place-items:center;color:var(--mute)}
.icon:hover{background:var(--fill);color:var(--ink)}
.icon[aria-pressed="true"]{color:var(--accent);background:var(--fill)}
.notice-line{margin:0;padding:8px 16px;font-size:12px;line-height:1.4;color:var(--mute);background:var(--shell);border-bottom:1px solid var(--line)}
.log{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px}
.msg{max-width:88%;padding:10px 12px;border-radius:var(--r-lg);overflow-wrap:anywhere}
.msg>*+*{margin-top:8px}
.msg p{margin:0}
.msg.me{align-self:flex-end;background:var(--accent);color:#fff;border-bottom-right-radius:6px;white-space:pre-wrap}
.msg.bot{align-self:flex-start;background:var(--shell);border-bottom-left-radius:6px}
.msg.status{display:flex;align-items:center;gap:8px;color:var(--mute);font-size:13px}
.msg.status>*+*{margin-top:0}
.dots{display:inline-flex;gap:3px}.dots i{width:5px;height:5px;border-radius:999px;background:currentColor;animation:pulse 1.2s infinite ease-in-out}
.dots i:nth-child(2){animation-delay:.15s}.dots i:nth-child(3){animation-delay:.3s}
@keyframes pulse{0%,80%,100%{opacity:.25}40%{opacity:1}}
@media (prefers-reduced-motion:reduce){.dots i{animation:none;opacity:.6}.launcher{transition:none}}
.ref{font-size:11px;color:var(--mute)}
.sources{margin:0;padding-left:20px;font-size:13px;color:var(--ink-2)}
.sources a{color:var(--accent);text-decoration:none;display:inline-block;min-height:24px;line-height:24px}
.warn{background:var(--warn-soft);color:var(--warn);padding:8px 10px;border-radius:var(--r-md);font-size:13px}
.contact{display:inline-block;padding:6px 12px;border-radius:var(--r-md);background:var(--accent);color:#fff;text-decoration:none;font-weight:500;font-size:13px}
.starters{display:flex;flex-direction:column;align-items:flex-start;gap:6px}
.chip{border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:var(--r-md);padding:6px 10px;font-size:13px;text-align:left}
.chip{transition:background var(--dur)}.chip:hover{background:var(--fill)}
.notice .chip{margin-right:6px}
.thumbs{display:flex;gap:2px}
.reasons{display:flex;flex-wrap:wrap;gap:6px;font-size:12px;color:var(--mute);align-items:center}
.reasons span{width:100%}
.thanks{font-size:12px;color:var(--mute)}
.note{font-size:13px;color:var(--ink-2)}
.composer{display:flex;gap:8px;align-items:flex-end;padding:12px;border-top:1px solid var(--line)}
textarea{flex:1;resize:none;border:1px solid var(--line);border-radius:var(--r-md);padding:8px 10px;font:inherit;line-height:1.4;color:var(--ink);background:var(--surface);max-height:120px}
textarea::placeholder{color:var(--mute)}
.send{width:36px;height:36px;flex:none;border:0;border-radius:var(--r-md);background:var(--accent);color:#fff;display:grid;place-items:center}
.send:disabled{opacity:.5;cursor:default}
.input-error{margin:-4px 12px 8px;font-size:12px;color:var(--danger)}
footer{padding:0 16px 12px;font-size:11px;line-height:1.4;color:var(--mute)}
footer a{color:var(--ink-2);text-decoration:none;display:inline-block;min-height:24px;line-height:24px}footer a:hover{color:var(--ink)}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@media (max-width:480px){:host{bottom:16px}:host([data-side="right"]){right:16px}:host([data-side="left"]){left:16px}
  :host(:not([data-contained])) .panel{position:fixed;inset:0;width:100vw;max-width:none;height:100%;border-radius:0;border:0}
  :host([data-open]:not([data-contained])) .launcher{display:none}}
`;
  }

  // ---- the widget ----

  /**
   * @param {{client: ReturnType<typeof createBotClient>, store: ReturnType<typeof createStore>, settings: any, host: HTMLElement, win: any, preview?: boolean}} options
   */
  function createWidget({ client, store, settings: initial, host, win, preview = false }) {
    let settings = initial;
    const remembered = store.load();
    const state = {
      open: preview,
      busy: false,
      /** @type {string | null} */
      stage: null,
      /** @type {string | null} */
      error: null,
      disabled: false,
      conversation: remembered.conversation,
      /** @type {any[]} */
      messages: remembered.messages,
      /** A question to send again on retry or when the connection returns. @type {string | null} */
      pending: null,
    };
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `<style></style><div class="root"></div>`;
    const styleEl = /** @type {HTMLStyleElement} */ (shadow.querySelector('style'));
    const rootEl = /** @type {HTMLElement} */ (shadow.querySelector('.root'));
    /** Side and accent come from the settings; a preview changes them as the admin edits. */
    function apply() {
      host.setAttribute('data-side', settings.side === 'left' ? 'left' : 'right');
      const accent = /^#[0-9a-fA-F]{6}$/.test(settings.accent) ? settings.accent : '#5e6ad2';
      styleEl.textContent = styles(accent);
    }
    apply();

    const started = () => state.messages.some((m) => m.role === 'user');
    const persist = () => store.save({ conversation: state.conversation, messages: state.messages });
    const input = () => /** @type {HTMLTextAreaElement | null} */ (shadow.querySelector('textarea'));

    /** A selector for the focused control, so focus survives the next render. */
    function focusedSelector() {
      const active = /** @type {HTMLElement | null} */ (shadow.activeElement);
      if (!active) return null;
      if (active.tagName === 'TEXTAREA') return 'textarea';
      const data = Object.entries(active.dataset).map(([k, v]) => `[data-${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}="${CSS.escape(v || '')}"]`);
      return data.length ? data.join('') : null;
    }

    function render({ focusInput = false } = {}) {
      const draft = input();
      const text = draft ? draft.value : '';
      const focused = focusedSelector();
      const label = state.open ? COPY.close : COPY.open;
      const launcher = `<button type="button" class="launcher" data-action="toggle" aria-expanded="${state.open}" aria-label="${esc(label)}">${state.open ? ICONS.close : ICONS.chat}</button>`;
      rootEl.innerHTML = (state.open ? panelView(settings, { ...state, started: started() }) : '') + launcher;
      if (state.open) host.setAttribute('data-open', '');
      else host.removeAttribute('data-open');
      const field = input();
      if (field) field.value = text;
      const log = shadow.querySelector('.log');
      if (log) log.scrollTop = log.scrollHeight;
      // Keep keyboard focus where it was; if that control is gone (a vote turned into thanks),
      // fall back to the question box rather than dropping focus onto the page.
      const again = focused ? /** @type {HTMLElement | null} */ (shadow.querySelector(focused)) : null;
      if (focusInput && field && !field.disabled) field.focus();
      else if (again) again.focus();
      else if (focused && field && !field.disabled) field.focus();
    }

    function open() {
      state.open = true;
      render({ focusInput: true });
    }

    function close() {
      state.open = false;
      render();
      /** @type {HTMLElement | null} */ (shadow.querySelector('.launcher'))?.focus();
    }

    /** @param {any} message */
    function push(message) {
      state.messages = state.messages.filter((m) => m.role !== 'notice');
      state.messages.push(message);
      persist();
    }

    /** @param {string} question @param {boolean} [resent] */
    async function ask(question, resent = false) {
      const text = question.trim();
      if (preview || !text || state.busy || state.disabled) return;
      if (text.length > MAX_QUESTION) {
        state.error = COPY.too_long;
        render({ focusInput: true });
        return;
      }
      state.error = null;
      if (!resent) push({ role: 'user', text });
      else state.messages = state.messages.filter((m) => m.role !== 'notice');
      let asked = -1;
      state.messages.forEach((m, i) => {
        if (m.role === 'user') asked = i;
      });
      state.busy = true;
      state.stage = 'thinking';
      state.pending = text;
      render();
      try {
        if (!state.conversation) state.conversation = await client.start();
        persist();
        const turn = await client.ask(state.conversation, text, (stage) => {
          state.stage = stage;
          render();
        });
        if (turn.question && asked >= 0) state.messages[asked].text = turn.question;
        state.pending = null;
        state.busy = false;
        state.stage = null;
        push({ role: 'bot', reply: turn.reply, turnId: turn.turnId, vote: null, reason: null });
        render({ focusInput: true });
      } catch (error) {
        state.busy = false;
        state.stage = null;
        await failed(/** @type {BotError} */ (error), text, resent);
      }
    }

    /** @param {BotError} error @param {string} text @param {boolean} resent */
    async function failed(error, text, resent) {
      if (error.kind === 'http' && (error.status === 404 || error.status === 409) && !resent) {
        // The conversation ended (a day without turns, or full): start another, resend once.
        state.conversation = null;
        persist();
        await ask(text, true);
        return;
      }
      if (error.kind === 'http' && error.status === 422) {
        state.error = COPY.too_long;
      } else if (error.kind === 'http' && error.status === 429) {
        push({ role: 'notice', kind: 'rate', seconds: Math.max(1, error.retryAfter || 1) });
      } else if (error.kind === 'http' && (error.status === 401 || error.status === 403 || error.status === 503)) {
        state.disabled = error.status !== 503;
        push({ role: 'notice', kind: 'unavailable' });
      } else if (error.kind === 'network' && win.navigator && win.navigator.onLine === false) {
        push({ role: 'notice', kind: 'offline' });
      } else {
        push({ role: 'notice', kind: 'error' });
      }
      render({ focusInput: true });
    }

    /** @param {number} index @param {'up' | 'down'} vote @param {string | null} [reason] */
    async function rate(index, vote, reason = null) {
      if (preview) return;
      const message = state.messages[index];
      if (!message || !message.turnId || !state.conversation) return;
      message.vote = vote;
      if (reason) message.reason = reason;
      persist();
      render();
      try {
        await client.feedback(message.turnId, state.conversation.token, vote, reason);
      } catch (_) {
        /* feedback is best effort */
      }
    }

    /** Keeps focus inside the open panel (WCAG 2.2, dialog pattern). @param {KeyboardEvent} event */
    function trapFocus(event) {
      const focusable = /** @type {HTMLElement[]} */ ([
        ...shadow.querySelectorAll('.panel button:not([disabled]), .panel a[href], .panel textarea:not([disabled])'),
      ]);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = shadow.activeElement;
      if (event.shiftKey && (active === first || !active)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !active)) {
        event.preventDefault();
        first.focus();
      }
    }

    shadow.addEventListener('click', (event) => {
      const target = /** @type {HTMLElement} */ (event.target);
      const button = /** @type {HTMLElement | null} */ (target.closest('[data-action]'));
      if (!button || button.tagName === 'FORM') return;
      const action = button.dataset.action;
      if (action === 'toggle') (state.open ? close : open)();
      else if (action === 'close') close();
      else if (action === 'ask') void ask(button.dataset.question || '');
      else if (action === 'retry' && state.pending) void ask(state.pending, true);
      else if (action === 'vote') void rate(Number(button.dataset.index), button.dataset.vote === 'up' ? 'up' : 'down');
      else if (action === 'reason') void rate(Number(button.dataset.index), 'down', button.dataset.reason || null);
    });
    shadow.addEventListener('submit', (event) => {
      event.preventDefault();
      const field = input();
      if (!field || state.busy || !field.value.trim()) return;
      const text = field.value;
      field.value = '';
      void ask(text);
    });
    shadow.addEventListener('keydown', (event) => {
      const key = /** @type {KeyboardEvent} */ (event);
      const target = /** @type {HTMLElement} */ (key.target);
      if (key.key === 'Escape' && state.open) {
        key.preventDefault();
        close();
      } else if (key.key === 'Enter' && !key.shiftKey && target.tagName === 'TEXTAREA') {
        key.preventDefault();
        /** @type {HTMLFormElement | null} */ (shadow.querySelector('form'))?.requestSubmit();
      } else if (key.key === 'Tab' && state.open) {
        trapFocus(key);
      }
    });
    win.addEventListener('online', () => {
      const offline = state.messages.some((m) => m.role === 'notice' && m.kind === 'offline');
      if (offline && state.pending) void ask(state.pending, true);
    });

    /** A preview's new settings and messages, drawn without moving focus. @param {any} next @param {any[]} [messages] */
    function update(next, messages) {
      settings = next;
      if (messages) state.messages = messages;
      apply();
      render();
    }

    render();
    return { state, open, close, ask, rate, render, update, shadow };
  }

  // ---- the admin's preview (bot admin spec 6.2) ----

  /** A bot client for the preview: it never reaches the network. */
  function previewClient() {
    const refuse = () => Promise.reject(new BotError('network', { code: 'preview', retryable: false }));
    return { settings: refuse, start: refuse, ask: refuse, feedback: refuse };
  }

  /**
   * What the preview shows: the welcome (greeting and starters), or a question the bot could
   * not answer, with the contact route.
   * @param {'start' | 'no_answer'} view
   */
  function previewMessages(view) {
    if (view !== 'no_answer') return [];
    return [
      { role: 'user', text: 'Can I change the date my card payment is taken?' },
      { role: 'bot', reply: { kind: 'no_answer', sentences: [], sources: [], personal_data_warning: false } },
    ];
  }

  /**
   * The real widget inside `host`, open, contained and inert, for the bot admin's Experience.
   * @param {HTMLElement} host
   * @param {any} settings
   * @param {{ scheme?: 'light' | 'dark', view?: 'start' | 'no_answer' }} [options]
   */
  function preview(host, settings, options = {}) {
    host.setAttribute('data-contained', '');
    const scheme = (/** @type {string | undefined} */ value) => host.setAttribute('data-scheme', value === 'dark' ? 'dark' : 'light');
    scheme(options.scheme);
    const memory = createStore(undefined, 'preview');
    const widget = createWidget({ client: previewClient(), store: memory, settings, host, win: globalThis, preview: true });
    widget.update(settings, previewMessages(options.view || 'start'));
    return {
      /** @param {any} next @param {{ scheme?: 'light' | 'dark', view?: 'start' | 'no_answer' }} [o] */
      update(next, o = {}) {
        if (o.scheme) scheme(o.scheme);
        widget.update(next, o.view ? previewMessages(o.view) : undefined);
      },
      shadow: widget.shadow,
    };
  }

  /** Reads the script tag, loads the settings and mounts the widget. @param {any} win */
  async function boot(win) {
    const doc = win.document;
    const script = doc && doc.currentScript;
    if (script && script.dataset && 'preview' in script.dataset) {
      // The bot admin's own page: it renders previews, so hand it the module and mount nothing.
      win.BrothBot = exported;
      return;
    }
    if (!script || win.__brothBot) return;
    win.__brothBot = true;
    const key = script.dataset.key || '';
    const api = script.dataset.api || '';
    if (!/^bk_live_[A-Za-z0-9]{32}$/.test(key) || !/^https?:\/\//.test(api)) {
      win.console.warn('Broth help: the embed snippet needs data-key and data-api.');
      return;
    }
    const client = createBotClient({ fetch: win.fetch.bind(win), api, key });
    let settings;
    try {
      settings = await client.settings();
    } catch (_) {
      win.console.warn('Broth help is unavailable on this page.');
      return;
    }
    /** @type {Storage | undefined} */
    let storage;
    try {
      storage = win.sessionStorage;
    } catch (_) {
      storage = undefined;
    }
    const mount = () => {
      const host = doc.createElement('div');
      host.id = 'kredete-help';
      doc.body.appendChild(host);
      createWidget({ client, store: createStore(storage, key), settings, host, win });
    };
    if (doc.body) mount();
    else doc.addEventListener('DOMContentLoaded', mount, { once: true });
  }

  const exported = {
    COPY,
    MAX_QUESTION,
    BotError,
    createSseParser,
    createBotClient,
    createStore,
    messageView,
    panelView,
    createWidget,
    styles,
    previewClient,
    previewMessages,
    preview,
    boot,
  };
  return exported;
});
