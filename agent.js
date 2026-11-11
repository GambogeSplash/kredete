/* agent.js: the Support agent (bot admin spec 4): the bots, and each bot's pages.
 *
 * Admins only, as the bot admin API is. /agent lists the bots, always, even with one: a
 * redirect would trap "All bots" on that bot. /agent/<bot>/<page> shows one of the bot's pages;
 * the pages register in window.AGENT.pages (agent-overview.js, agent-knowledge.js,
 * agent-experience.js, agent-products.js) and get the bot, the containers and connections, and
 * `saved(bot)`, so the rail, the breadcrumb and every page show the same record.
 *
 * The bots, containers and connections load once each time someone arrives at the Support
 * agent, so Public page counts are current after promoting pages in the Library.
 */
(() => {
'use strict';
const B = window.BRAIN;
const F = window.BOT_FORM;
/** @type {(s: string, r?: ParentNode) => any} */
const $ = (s, r = document) => r.querySelector(s);
/** @type {(s: string, r?: ParentNode) => any[]} */
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = B.esc;

const LABELS = { overview: 'Overview', knowledge: 'Knowledge', experience: 'Experience', products: 'Products' };
/** The docs section a page links to. */
const DOCS = { list: 'botSources', knowledge: 'botSources', products: 'botSnippet' };
/** A framed empty state: icon tile, title, one line, optional action. */
const empty = (title, text, action = '', icon = 'inbox') => `<div class="ds-empty" role="status"><span class="ds-empty-ic" aria-hidden="true">${window.ICON(icon, 20)}</span><b>${esc(title)}</b>${text ? `<p>${text}</p>` : ''}${action}</div>`;
/** A framed error with retry. */
const failed = (error, retryId) => empty(B.problem(error), error && error.status === 0 ? 'Check your connection.' : 'The rest of Broth still works.', `<button type="button" class="btn sm" id="${retryId}">Try again</button>`, 'refresh').replace('role="status"', 'role="alert"');
/** The page title row: title, (i) hint, then the page's own controls. */
const head = (title, key, actions = '') => `<div class="ds-head aghd"><h1 class="lcont-t">${esc(title)}</h1><span class="lsp"></span><div class="ds-act">${DOCS[key] ? window.DOCS.link(DOCS[key]).replace('class="dclink"', 'class="dclink btn sm"') : ''}${actions}</div></div>`;
/** @type {Record<string, (el: HTMLElement, ctx: any) => void>} */
const pages = {};

function state() {
  const c = B.S.cache;
  if (!c.agent) c.agent = { bots: [], containers: [], connections: [], loaded: false, error: null };
  return c.agent;
}

async function load(params) {
  const s = state();
  s.error = null;
  try {
    const [bots, containers, connections] = await Promise.all([
      B.api.get('/admin/bots'),
      B.api.get('/admin/containers'),
      B.api.get('/admin/connections'),
    ]);
    s.bots = B.rows(bots).map(B.bot); s.containers = B.rows(containers); s.connections = B.rows(connections);
    s.loaded = true;
  } catch (error) { s.error = error; }
  if (B.S.route.surface === 'bot' && B.S.route.params === params) window.SURFACES.bot(params, true);
}

window.SURFACES.bot = (params, loaded) => {
  const s = state();
  // Arriving from elsewhere reads everything again; moving between pages does not.
  if (!loaded && (B.S.route.from !== 'bot' || s.error || !s.loaded)) { s.loaded = false; load(params); }
  render(params);
};

function render(params) {
  const s = state();
  const app = $('#app');
  if (!s.loaded) {
    B.S.route.title = '';
    app.innerHTML = `<div class="lcont agwide">${s.error ? failed(s.error, 'agretry') : B.skeletonRows(4, 'dt-r')}</div>`;
    const r = $('#agretry');
    if (r) r.onclick = () => { s.error = null; render(params); load(params); };
    return;
  }
  if (!params.bot) { list(app); B.setCrumb(); B.mbTitle(); return; }
  const bot = s.bots.find((b) => b.id === params.bot);
  if (!bot) {
    B.S.route.title = '';
    app.innerHTML = `<div class="lcont agwide">${empty("This bot doesn't exist", 'It may have been removed, or the link is wrong.', '<a class="btn sm" href="/support-agent" data-link>All bots</a>', 'chat')}</div>`;
    return;
  }
  if (!params.page) { B.go(`/support-agent/${bot.id}/overview`, { replace: true }); return; }
  B.S.route.title = bot.name;
  B.setCrumb(); B.mbTitle();
  app.innerHTML = `<div class="lset"><nav class="lrail agtabs" aria-label="Support agent"></nav><div class="lcont agwide">${head(LABELS[params.page], params.page)}<div id="agpane"></div></div></div>`;
  rail(bot, params.page);
  const page = pages[params.page];
  if (page) page($('#agpane'), context(bot, params));
}

/** What a page gets from the shell. */
function context(bot, params) {
  const s = state();
  return {
    bot,
    containers: s.containers,
    connections: s.connections,
    /** After a save: the server's bot replaces the cached one, and the rail and crumb follow it. */
    saved(next) {
      s.bots = s.bots.map((b) => (b.id === next.id ? next : b));
      if (B.S.route.params !== params) return;
      B.S.route.title = next.name;
      rail(next, params.page);
      B.setCrumb(); B.mbTitle();
    },
    go: (page) => B.go(`/support-agent/${bot.id}/${page}`),
  };
}

/** Where the rail's highlight last sat, so a page change slides it from there. */
/** @type {{ l: number, t: number, w: number, h: number } | null} */
let pillAt = null;
function rail(bot, current) {
  const nav = $('.lrail');
  if (!nav) return;
  const tab = (p) => `<button type="button" class="tab" data-ap="${p}" aria-current="${p === current ? 'page' : 'false'}">${LABELS[p]}</button>`;
  nav.innerHTML = `<div class="lrail-h">Support agent</div>${bot ? `<a class="tab agback" href="/support-agent" data-link aria-current="false">All bots</a><div class="lrail-sep" role="separator"></div><div class="lrail-h agname" title="${esc(bot.name)}">${esc(bot.name)}</div>${tab('overview')}<div class="lrail-sep" role="separator"></div><div class="lrail-h">Build</div>${['knowledge', 'experience', 'products'].map(tab).join('')}` : '<a class="tab agback" href="/support-agent" data-link aria-current="page">All bots</a>'}`;
  $$('[data-ap]', nav).forEach((b) => { b.onclick = () => B.go(`/support-agent/${bot.id}/${b.dataset.ap}`); });
  slidePill(nav);
}
/** The highlight under the current rail item; it slides from the last one when the page changes (the Sources panel pattern in ask.js). */
function slidePill(nav) {
  const on = $('[aria-current=page]', nav);
  if (!on) { pillAt = null; return; }
  const pill = document.createElement('span');
  pill.className = 'agpill';
  nav.append(pill);
  const at = { l: on.offsetLeft, t: on.offsetTop, w: on.offsetWidth, h: on.offsetHeight };
  pill.style.cssText = `left:${at.l}px;top:${at.t}px;width:${at.w}px;height:${at.h}px`;
  const prev = pillAt;
  pillAt = at;
  if (prev && pill.animate && !/** @type {any} */ (window).__entering && !matchMedia('(prefers-reduced-motion: reduce)').matches && (prev.l !== at.l || prev.t !== at.t)) {
    pill.animate([{ transform: `translate(${prev.l - at.l}px,${prev.t - at.t}px) scale(${prev.w / at.w},${prev.h / at.h})` }, { transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)' });
  }
}

/* ---- the bot list (spec 4.2) ---- */
function list(app) {
  const s = state();
  B.S.route.title = '';
  const rows = s.bots.map((bot) => {
    const live = bot.products.filter((p) => p.status === 'live').length;
    const sites = F.liveSites(bot);
    return `<a class="ds-tr agrow" href="/support-agent/${bot.id}/overview" data-link><span class="dmn"><span class="ds-ic" aria-hidden="true">${window.ICON('chat', 16)}</span><b>${esc(bot.name)}</b></span><span class="dtm">${count(bot.sources.length, 'source')}</span><span class="dtm">${live} of ${bot.products.length} live</span><span>${sites ? `<span class="tag ok">Live on ${count(sites, 'site')}</span>` : '<span class="tag warn">Needs setup</span>'}</span></a>`;
  }).join('');
  app.innerHTML = `<div class="lset"><nav class="lrail agtabs" aria-label="Support agent"></nav><div class="lcont agwide">${head('Support agent', 'list', '<button type="button" class="btn primary sm" id="agnew">New bot</button>')}
    ${s.bots.length
      ? `<div class="ds-table agbots" style="--cols:minmax(0,2fr) minmax(0,1fr) minmax(0,1fr) 150px"><div class="ds-tr ds-th"><span>Bot</span><span>Sources</span><span>Products</span><span>Status</span></div>${rows}</div>`
      : empty('No bots yet', 'Create one, choose the sources it answers from, then put it on a site.', '<button type="button" class="btn primary sm" id="agnew2">New bot</button>', 'chat')}
  </div></div>`;
  rail(null, '');
  $('#agnew').onclick = newBot;
  const again = $('#agnew2');
  if (again) again.onclick = newBot;
}
const count = (n, word) => `${n} ${n === 1 ? word : word + 's'}`;

function newBot() {
  B.openModal(`<div class="modal ppmodal" role="dialog" aria-label="New bot"><div class="bar"><span>New bot</span><button type="button" class="link" data-close-modal>Close</button></div><div class="body dmbody">
    <form id="nbf" class="dmbody" novalidate>
      ${field('name', 'Name', { placeholder: 'Help centre', hint: 'Shown in the chat header.', max: 32 })}
      ${field('contact_url', 'Contact link', { placeholder: 'https://kredete.com/support', hint: "A web page or a mailto: address, shown whenever the bot can't answer." })}
      ${field('privacy_url', 'Privacy link', { placeholder: 'https://kredete.com/privacy', hint: 'Where visitors read how their questions are used.' })}
      <div class="hse" id="nbe" role="alert"></div>
      <div class="actions"><button type="submit" class="btn primary" id="nbgo">Create bot</button><button type="button" class="btn" data-close-modal>Cancel</button></div>
    </form></div></div>`);
  const form = $('#nbf');
  counters(form);
  $('#nbname').focus();
  form.onsubmit = (e) => {
    e.preventDefault();
    const values = { name: $('#nbname').value, contact_url: $('#nbcontact_url').value, privacy_url: $('#nbprivacy_url').value };
    let first = null;
    for (const [k, v] of Object.entries(values)) {
      const error = F.fieldError(k, v);
      showError(form, k, error);
      if (error && !first) first = k;
    }
    if (first) { $(`#nb${first}`).focus(); return; }
    B.busy($('#nbgo'), async () => {
      const bot = await B.api.post('/admin/bots', Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.trim()])));
      state().bots.push(bot);
      B.closeModal();
      B.toast(`${bot.name} is ready. Choose what it answers from.`);
      B.go(`/support-agent/${bot.id}/knowledge`);
    }, (error) => serverErrors(form, error, $('#nbe')));
  };
}

/* ---- form helpers the pages share ---- */

/**
 * A labelled text field with a hint and a slot for its error. Ids are prefixed by the form.
 * @param {string} key
 * @param {string} label
 * @param {{ value?: string, placeholder?: string, hint?: string, max?: number, rows?: number, prefix?: string, type?: string }} [o]
 */
function field(key, label, o = {}) {
  const id = (o.prefix || 'nb') + key.replace(/\W/g, '');
  const value = o.value == null ? '' : String(o.value);
  const attrs = `id="${id}" class="eminp" name="${esc(key)}" autocomplete="off"${o.placeholder ? ` placeholder="${esc(o.placeholder)}"` : ''} aria-describedby="${id}-h ${id}-e"`;
  const control = o.rows
    ? `<textarea ${attrs} rows="${o.rows}">${esc(value)}</textarea>`
    : `<input ${attrs}${o.type ? ` type="${o.type}"` : ''} value="${esc(value)}"${o.type === 'number' ? ' inputmode="numeric" min="1" step="1"' : ''}>`;
  const counter = o.max ? `<span class="agcount" data-count="${id}" data-max="${o.max}" aria-hidden="true"></span>` : '';
  return `<div class="agfield" data-field="${esc(key)}"><div class="aglab"><label class="hsl" for="${id}">${esc(label)}</label>${counter}</div>${control}${o.hint ? `<p class="suhint" id="${id}-h">${esc(o.hint)}</p>` : ''}<p class="agerr" id="${id}-e" role="alert"></p></div>`;
}

/** Shows or clears the error under a field, and marks the control invalid. */
function showError(root, key, message) {
  const box = $(`[data-field="${key}"]`, root);
  if (!box) return;
  const err = $('.agerr', box);
  const fresh = !!message && !!err && err.textContent !== message;
  if (err) err.textContent = message || '';
  const control = $('input,textarea,select', box);
  if (control) control.setAttribute('aria-invalid', message ? 'true' : 'false');
  // A new message under the field being typed in stays in view, clear of the floating Save bar
  // (scroll-margin-bottom in components.css leaves room for it).
  if (fresh && box.contains(document.activeElement)) box.scrollIntoView({ block: 'nearest' });
}

/** Keeps each field's character counter current; calling it again redraws them after a reset. */
function counters(root) {
  $$('[data-count]', root).forEach((c) => {
    const input = $(`#${c.dataset.count}`, root);
    if (!input) return;
    const sync = () => {
      const n = input.value.trim().length;
      c.textContent = `${n}/${c.dataset.max}`;
      c.classList.toggle('over', n > Number(c.dataset.max));
    };
    if (!input.dataset.counted) { input.dataset.counted = '1'; input.addEventListener('input', sync); }
    sync();
  });
}

/**
 * A 422's messages under the fields they name; anything else goes in `fallback`.
 * @param {ParentNode} root
 * @param {any} error
 * @param {HTMLElement | null} fallback
 */
function serverErrors(root, error, fallback) {
  const located = (error && error.status === 422 && error.errors) || [];
  let placed = false;
  for (const e of located) {
    const [where, key, index] = e.loc;
    if (where !== 'body' || typeof key !== 'string') continue;
    const box = (typeof index === 'number' && $(`[data-field="${key}.${index}"]`, root)) || $(`[data-field="${key}"]`, root);
    if (!box) continue;
    showError(root, box.dataset.field, humanize(e.msg));
    placed = true;
  }
  if (fallback) fallback.textContent = placed ? '' : B.problem(error);
  return placed;
}
/** "Value error, a site must use https" reads as "A site must use https." */
function humanize(msg) {
  const text = String(msg).replace(/^Value error,\s*/i, '');
  const sentence = text.charAt(0).toUpperCase() + text.slice(1);
  return /[.!?]$/.test(sentence) ? sentence : `${sentence}.`;
}

/**
 * The sticky Save bar: shown while `dirty()`; Save is off while `valid()` is false. It also
 * guards leaving the page while there are unsaved changes.
 * @param {HTMLElement} host
 * @param {{ dirty: () => boolean, valid: () => boolean, save: (button: HTMLButtonElement) => void, discard: () => void }} o
 */
function saveBar(host, o) {
  host.insertAdjacentHTML('beforeend', `<div class="agsave" role="region" aria-label="Unsaved changes" hidden><span class="agsave-t">Unsaved changes</span><span class="agsave-e" role="alert"></span><span class="lsp"></span><button type="button" class="btn sm" data-discard>Discard</button><button type="button" class="btn primary sm" data-save>Save</button></div>`);
  const bar = /** @type {HTMLElement} */ (host.lastElementChild);
  const save = /** @type {HTMLButtonElement} */ ($('[data-save]', bar));
  $('[data-discard]', bar).onclick = () => o.discard();
  save.onclick = () => o.save(save);
  const update = () => {
    const dirty = o.dirty();
    bar.hidden = !dirty;
    if (!save.classList.contains('busy')) save.disabled = !o.valid();
    if (!dirty) $('.agsave-e', bar).textContent = '';
  };
  B.guardLeaving(o.dirty);
  update();
  return { update, error: (text) => { $('.agsave-e', bar).textContent = text || ''; }, el: bar };
}

/**
 * A confirmation for an action that cannot be undone; resolves true when confirmed.
 * @param {{ title: string, text: string, action: string }} o
 * @returns {Promise<boolean>}
 */
function confirmAction(o) {
  return new Promise((resolve) => {
    B.openModal(`<div class="modal ppmodal" role="alertdialog" aria-modal="true" aria-labelledby="cft" aria-describedby="cfd"><div class="body"><h2 id="cft">${esc(o.title)}</h2><p class="sub" id="cfd">${esc(o.text)}</p><div class="actions"><button type="button" class="btn danger" id="cfgo">${esc(o.action)}</button><button type="button" class="btn" id="cfno">Cancel</button></div></div></div>`);
    const modal = $('#modal');
    let done = false;
    const watch = new MutationObserver(() => { if (!modal.classList.contains('on')) finish(false); });
    const finish = (yes) => { if (done) return; done = true; watch.disconnect(); B.closeModal(); resolve(yes); };
    $('#cfgo').onclick = () => finish(true);
    $('#cfno').onclick = () => finish(false);
    $('#cfno').focus();
    watch.observe(modal, { attributes: true, attributeFilter: ['class'] });
  });
}

window.AGENT = { empty, pages, field, showError, counters, serverErrors, saveBar, confirmAction, count };
})();
