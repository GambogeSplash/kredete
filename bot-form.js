/* bot-form.js: the bot admin's rules, with no DOM (bot admin spec 6.2 and 7.2).
 *
 * The API's field rules, so a form can say what is wrong as someone types; allowed sites in
 * the server's canonical form (broth.bots.settings.normalize_origin); the fields that changed
 * between a saved bot and a form; and the bot's status. The server stays the authority: its
 * 422 is still shown under the field it names.
 *
 * Loaded as a classic script (window.BOT_FORM) and as a CommonJS module by the unit tests.
 */
(function (root, factory) {
  const exported = factory();
  if (typeof module === 'object' && module.exports) module.exports = exported;
  else root.BOT_FORM = exported;
})(globalThis, function () {
  'use strict';

  /** Text lengths, counted after trimming as the API does. */
  const LENGTHS = {
    name: [1, 32],
    greeting: [0, 120],
    contact_label: [1, 32],
    notice: [1, 160],
    starter: [1, 60],
    product_name: [1, 60],
  };
  const MAX_STARTERS = 3;
  const MAX_SITES = 10;
  const MAX_DAILY = 1000000;
  const BOT_FIELDS = ['name', 'greeting', 'starters', 'contact_label', 'contact_url', 'notice', 'privacy_url', 'daily_question_limit'];

  const HOST = /^(?:\[[0-9a-f:.]+\]|[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*)$/;
  const EMAIL = /^[^@\s/?#]+@[^@\s/?#]+\.[^@\s/?#]+$/;
  const DEFAULT_PORT = { https: 443, http: 80 };
  const EXAMPLE = 'https://help.kredete.com';

  /**
   * A URL's parts, split the way Python's urlsplit does for the inputs that matter here.
   * @param {string} raw
   */
  function split(raw) {
    const m = /^(?:([a-zA-Z][a-zA-Z0-9+.-]*):)?(?:\/\/([^/?#]*))?([^?#]*)(\?[^#]*)?(#.*)?$/.exec(raw);
    if (!m) return null;
    const [, scheme = '', netloc = '', path = '', query = '', fragment = ''] = m;
    const at = netloc.lastIndexOf('@');
    const credentials = at >= 0;
    const hostport = credentials ? netloc.slice(at + 1) : netloc;
    let host = hostport;
    let port = '';
    if (hostport.startsWith('[')) {
      const end = hostport.indexOf(']');
      host = end >= 0 ? hostport.slice(1, end) : hostport.slice(1);
      const rest = end >= 0 ? hostport.slice(end + 1) : '';
      if (rest.startsWith(':')) port = rest.slice(1);
    } else {
      const colon = hostport.lastIndexOf(':');
      if (colon >= 0) { host = hostport.slice(0, colon); port = hostport.slice(colon + 1); }
    }
    return { scheme: scheme.toLowerCase(), host: host.toLowerCase(), port, path, query: query.length > 1 ? query : '', fragment: fragment.length > 1 ? fragment : '', credentials };
  }

  /**
   * An allowed site in the server's canonical form, or the reason it is refused.
   * `http://localhost` passes: only the server knows whether it runs in dev or test.
   * @param {string} value
   * @returns {{ origin: string, error?: undefined } | { error: string, origin?: undefined }}
   */
  function normalizeOrigin(value) {
    const raw = String(value == null ? '' : value).trim();
    const invalid = { error: `Enter a site like ${EXAMPLE}.` };
    if (raw.includes('*')) return { error: 'Enter one exact site. Wildcards are not allowed.' };
    const parts = split(raw);
    if (!parts) return invalid;
    let port = null;
    if (parts.port !== '') {
      if (!/^\d+$/.test(parts.port)) return invalid;
      port = Number(parts.port);
      if (port < 1 || port > 65535) return invalid;
    }
    if (parts.credentials) return { error: 'Leave out the user name and password.' };
    if ((parts.path !== '' && parts.path !== '/') || parts.query || parts.fragment) return { error: `Use only the site, like ${EXAMPLE}.` };
    if (!parts.host || !HOST.test(parts.host.includes(':') ? `[${parts.host}]` : parts.host)) return invalid;
    if (parts.scheme === 'http') {
      if (parts.host !== 'localhost') return { error: 'Use https.' };
    } else if (parts.scheme !== 'https') return { error: 'Use https.' };
    const host = parts.host.includes(':') ? `[${parts.host}]` : parts.host;
    if (port === null || port === DEFAULT_PORT[parts.scheme]) return { origin: `${parts.scheme}://${host}` };
    return { origin: `${parts.scheme}://${host}:${port}` };
  }

  /** @param {string} value */
  function httpsUrl(value) {
    const parts = split(value);
    return !!parts && parts.scheme === 'https' && !!parts.host;
  }

  /**
   * What is wrong with a field's value, or null.
   * @param {string} field
   * @param {unknown} value
   * @returns {string | null}
   */
  function fieldError(field, value) {
    const text = String(value == null ? '' : value).trim();
    if (field in LENGTHS) {
      const [min, max] = LENGTHS[/** @type {keyof typeof LENGTHS} */ (field)];
      if (text.length < min) return 'Required.';
      if (text.length > max) return `At most ${max} characters.`;
      return null;
    }
    if (!text && ['contact_url', 'privacy_url', 'daily_question_limit', 'accent'].includes(field)) return 'Required.';
    switch (field) {
      case 'contact_url':
        if (text.startsWith('mailto:')) return EMAIL.test(text.slice(7)) ? null : 'Use one email address, like mailto:help@kredete.com.';
        return httpsUrl(text) ? null : 'Use an https link or a mailto: address.';
      case 'privacy_url':
        return httpsUrl(text) ? null : 'Use an https link.';
      case 'daily_question_limit': {
        if (!/^\d+$/.test(text)) return 'Use a whole number.';
        const n = Number(text);
        return n >= 1 && n <= MAX_DAILY ? null : 'Use a number from 1 to 1,000,000.';
      }
      case 'accent':
        return /^#[0-9a-fA-F]{6}$/.test(text) ? null : 'Use a hex colour, like #5e6ad2.';
      default:
        return null;
    }
  }

  /** @param {unknown[]} list */
  const cleanStarters = (list) => (list || []).map((s) => String(s).trim()).filter(Boolean);

  /**
   * The bot fields that differ between the saved bot and the form, as the API takes them.
   * @param {Record<string, any>} saved
   * @param {Record<string, any>} form
   */
  function changes(saved, form) {
    /** @type {Record<string, any>} */
    const out = {};
    for (const field of BOT_FIELDS) {
      if (!(field in form)) continue;
      if (field === 'starters') {
        const next = cleanStarters(form.starters);
        if (JSON.stringify(next) !== JSON.stringify(cleanStarters(saved.starters))) out.starters = next;
      } else if (field === 'daily_question_limit') {
        const next = Number(String(form[field]).trim());
        if (next !== Number(saved[field])) out[field] = next;
      } else {
        const next = String(form[field] == null ? '' : form[field]).trim();
        if (next !== String(saved[field] == null ? '' : saved[field])) out[field] = next;
      }
    }
    return out;
  }

  /** @param {{ products: { status: string, allowed_origins: string[] }[] }} bot */
  const liveProducts = (bot) => bot.products.filter((p) => p.status === 'live');

  /**
   * Live products first, revoked ones after, each group as the server listed it.
   * @template {{ status: string }} P
   * @param {P[]} products
   * @returns {P[]}
   */
  const byStatus = (products) => [...products].sort((a, b) => (a.status === b.status ? 0 : a.status === 'live' ? -1 : 1));

  /**
   * Distinct sites the bot is live on: none while it is paused or archived, whatever its
   * products say (bot pause and archive spec 3.6).
   * @param {{ status: string, products: { status: string, allowed_origins: string[] }[] }} bot
   */
  const liveSites = (bot) => (bot.status === 'live' ? new Set(liveProducts(bot).flatMap((p) => p.allowed_origins)).size : 0);

  /**
   * The one state every screen shows for a bot (bot pause and archive spec 4.1): its own
   * status first, then, for a live bot, whether any product puts it on a site.
   * @param {{ status: string, products: { status: string }[] }} bot
   * @returns {'archived' | 'paused' | 'live' | 'setup'}
   */
  const botState = (bot) => {
    if (bot.status === 'archived') return 'archived';
    if (bot.status === 'paused') return 'paused';
    return bot.products.some((p) => p.status === 'live') ? 'live' : 'setup';
  };

  /**
   * Whether Broth serves a container's pages at all: included, and its connection not
   * disconnected. Every screen asks this one question, so they never disagree.
   * @param {{ included: boolean, connection_id: string }} container
   * @param {{ id: string, status: string }[]} connections
   */
  const serves = (container, connections) => container.included && !connections.some((c) => c.id === container.connection_id && c.status === 'disconnected');

  /**
   * The bot's chosen sources that Broth serves.
   * @template {{ id: string, included: boolean, connection_id: string, public_documents: number }} C
   * @param {{ sources: string[] }} bot
   * @param {C[]} containers
   * @param {{ id: string, status: string }[]} connections
   * @returns {C[]}
   */
  const served = (bot, containers, connections) => containers.filter((c) => bot.sources.includes(c.id) && serves(c, connections));

  /** Public pages over the bot's served sources. */
  const publicPages = (/** @type {any} */ bot, /** @type {any[]} */ containers, /** @type {any[]} */ connections) => served(bot, containers, connections).reduce((n, c) => n + c.public_documents, 0);

  /** Whether at least one chosen source has a Public page (spec 5, step 1). */
  const canAnswer = (/** @type {any} */ bot, /** @type {any[]} */ containers, /** @type {any[]} */ connections) => publicPages(bot, containers, connections) > 0;

  /**
   * The contrast of white text on a hex colour (WCAG 2.2): the widget's launcher, header avatar,
   * sent questions and contact button all draw white on the accent.
   * @param {string} hex
   */
  function whiteContrast(hex) {
    const channel = (/** @type {number} */ i) => {
      const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    const luminance = 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
    return 1.05 / (luminance + 0.05);
  }

  /** @param {string} key */
  const maskKey = (key) => `${key.slice(0, 12)}••••${key.slice(-4)}`;

  /**
   * The client and bot API origins a site's Content Security Policy must allow, from a snippet.
   * @param {string | null} snippet
   */
  function snippetOrigins(snippet) {
    if (!snippet) return null;
    const src = /\ssrc="([^"]+)"/.exec(snippet);
    const api = /\sdata-api="([^"]+)"/.exec(snippet);
    if (!src || !api) return null;
    const origin = (/** @type {string} */ url) => { const p = split(url); return p ? `${p.scheme}://${p.port ? `${p.host}:${p.port}` : p.host}` : url; };
    return { client: origin(src[1]), api: origin(api[1]) };
  }

  return { LENGTHS, MAX_STARTERS, MAX_SITES, normalizeOrigin, fieldError, changes, liveProducts, byStatus, liveSites, botState, serves, served, publicPages, canAnswer, whiteContrast, maskKey, snippetOrigins };
});
