/* admin.js: the Admin area (sandbox spec 4.3, plan C7 and C8) and its Audit tab.
 *
 * A settings-style page with the Settings rail (settings-rail.js). Each person sees the tabs
 * their capabilities open (capabilities.js says which): admins every tab, compliance Audit,
 * developers Sources (the router also refuses the others by URL). Tabs register in
 * window.ADMIN.tabs: connectors.js, people.js, domains.js and workspace.js add theirs.
 */
(() => {
'use strict';
const B = window.BRAIN;
/** @type {(s: string, r?: ParentNode) => any} */
const $ = (s, r = document) => r.querySelector(s);
/** @type {(s: string, r?: ParentNode) => any[]} */
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = B.esc;

/** @type {Record<string, { label: string, hint?: string, render: (el: HTMLElement, params?: any) => void }>} */
const tabs = {};
const allowed = () => window.CAPS.adminTabs(B.S.me).filter((k) => tabs[k]);

window.SURFACES.admin = (params) => {
  const mine = allowed();
  // Sources lives at /admin/sources; the tab is still called connectors here.
  const tab = params.tab === 'sources' ? 'connectors' : params.tab;
  // The old address keeps working; the address bar moves to the canonical one, query string untouched.
  if (location.pathname.startsWith('/admin/connectors')) history.replaceState(history.state, '', location.pathname.replace('/admin/connectors', '/admin/sources') + location.search + location.hash);
  if (!tab || !mine.includes(tab)) { B.go('/admin/' + (mine[0] || ''), { replace: true }); return; }
  closePop();
  $('#app').innerHTML = `<div class="lset">${window.SETTINGS.rail(tab)}<div class="lcont"><div class="ds-head"><h1 class="lcont-t">${tabs[tab].label}</h1><div class="ds-act" id="adact"></div></div><div id="adpane"></div></div></div>`;
  window.SETTINGS.wire($('.lrail'));
  tabs[tab].render($('#adpane'), params);
};

/** A page inside a tab (a source's own page): its title, with a plain back link before it. */
function setTitle(html, backHref, backLabel) {
  const h1 = $('.lcont-t');
  if (!h1) return;
  h1.innerHTML = html;
  const head = h1.parentElement;
  const old = $('.srcback', head);
  if (old) old.remove();
  if (backHref) head.insertAdjacentHTML('afterbegin', `<a class="srcback" href="${backHref}" data-link>${ICON('chevl', 14)}<span>${backLabel}</span></a>`);
}

/** The (i) hint: a short sentence on hover or focus, in place of a subtitle. */
const hint = (text) => `<span class="hint" tabindex="0" data-tip="${esc(text)}" aria-label="${esc(text)}">i</span>`;
/* The prototype's adLife entrance: cards and rows rise 10px and fade in, 360 ms, 34 ms apart (the
   first twelve), and the clearance bars grow from 20 percent, 420 ms, 28 ms apart. */
function life(root) {
  if (!root || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const ease = 'cubic-bezier(.22,1,.36,1)';
  $$('.adseg i.on', root).forEach((i, k) => { if (i.animate) i.animate([{ transform: 'scaleY(.2)', opacity: 0.3 }, { transform: 'none', opacity: 1 }], { duration: 420, delay: k * 28, easing: ease, fill: 'backwards' }); });
  $$('.adst,.adsc,.adrow,.addom,.adhero,.adrq,.aud-r:not(.aud-h)', root).forEach((c, k) => { if (c.animate) c.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 360, delay: Math.min(k, 12) * 34, easing: ease, fill: 'backwards' }); });
}
/* ---------- domain tiles: a favicon for a name that is a hostname, else the initial ----------
   A knowledge domain such as "Payments" has no host and makes no request. A name that is a host
   (northwind.com) asks the favicon service for that host only, once per host, with no referrer;
   the image is swapped in only when it is wider than 16 px (16 px is the generic globe). */
const HOST = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i;
const hostOf = (name) => { const h = String(name || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, ''); return HOST.test(h) ? h : ''; };
/** @type {Map<string, Promise<string | null>>} */
const favicons = new Map();
/** @param {string} host */
function faviconFor(host) {
  if (!favicons.has(host)) {
    favicons.set(host, new Promise((resolve) => {
      const img = new Image();
      img.referrerPolicy = 'no-referrer';
      img.onload = () => resolve(img.naturalWidth > 16 ? img.src : null);
      img.onerror = () => resolve(null);
      img.src = `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://${host}&size=128`;
    }));
  }
  return favicons.get(host);
}
/** The tile's markup: a fixed 40 px squircle with the initial; hydrateTiles adds a logo when there is one. */
const domainTile = (name) => { const host = hostOf(name); return `<span class="dmtile" aria-hidden="true" data-l="${esc((String(name || '?').trim()[0] || '?').toUpperCase())}"${host ? ` data-host="${esc(host)}"` : ''}></span>`; };
/** @param {ParentNode} root */
function hydrateTiles(root) {
  $$('[data-host]:not([data-done])', root).forEach((tile) => {
    tile.dataset.done = '1';
    faviconFor(tile.dataset.host).then((src) => {
      if (!src || !tile.isConnected) return;
      const img = document.createElement('img');
      img.alt = '';
      img.referrerPolicy = 'no-referrer';
      img.src = src;
      tile.appendChild(img);
      requestAnimationFrame(() => img.classList.add('on'));
    });
  });
}
/** Fills the page title row's right-hand controls. */
const actions = (html) => { const a = $('#adact'); if (a) a.innerHTML = html; return a; };

/* A popover under the control that opened it (.ds-pop). One at a time; closes on outside
   press, Escape, or when its control leaves the page. */
/** @type {null | (() => void)} */
let popClose = null;
function closePop() { if (popClose) popClose(); }
/**
 * @param {HTMLElement} anchor
 * @param {string} html
 * @param {string} label
 * @param {{ scrim?: boolean, sheet?: boolean, menu?: boolean }} [opts] scrim: a backdrop behind it; sheet: a bottom sheet on phones
 * @returns {HTMLElement}
 */
function pop(anchor, html, label, opts) {
  closePop();
  const o = opts || {};
  const scrim = o.scrim ? document.createElement('div') : null;
  if (scrim) { scrim.className = 'ds-scrim'; document.body.appendChild(scrim); }
  const el = document.createElement('div');
  el.className = 'ds-pop' + (o.sheet ? ' sheet' : '') + (o.menu ? ' menu' : '');
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', label);
  el.innerHTML = html;
  document.body.appendChild(el);
  const place = () => {
    const r = anchor.getBoundingClientRect();
    el.style.top = (r.bottom + 8) + 'px';
    if (o.menu) el.style.left = Math.max(12, Math.min(r.left, innerWidth - el.offsetWidth - 12)) + 'px';
    else el.style.right = Math.max(12, innerWidth - r.right) + 'px';
    el.style.maxHeight = Math.max(200, innerHeight - r.bottom - 20) + 'px';
  };
  place();
  anchor.setAttribute('aria-expanded', 'true');
  const away = (/** @type {any} */ e) => { if (!el.contains(e.target) && !anchor.contains(e.target) && !e.target.closest('.ssel-menu, [role=listbox]')) closePop(); };
  const key = (/** @type {KeyboardEvent} */ e) => {
    if (e.key === 'Escape' && !$('.ssel-menu')) { closePop(); return; }
    if (e.key !== 'Tab' || $('.ssel-menu')) return;
    // focus stays inside the popover while it is open
    const items = $$('button:not([disabled]), [href], input:not([disabled]), textarea, [tabindex]:not([tabindex="-1"])', el).filter((x) => x.offsetParent !== null);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (!el.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  const watch = new MutationObserver(() => { if (!anchor.isConnected) closePop(); });
  watch.observe($('#app'), { childList: true, subtree: true });
  setTimeout(() => { document.addEventListener('pointerdown', away, true); }, 0);
  document.addEventListener('keydown', key, true);
  window.addEventListener('resize', place);
  popClose = () => {
    popClose = null;
    watch.disconnect();
    document.removeEventListener('pointerdown', away, true);
    document.removeEventListener('keydown', key, true);
    window.removeEventListener('resize', place);
    el.remove();
    if (scrim) scrim.remove();
    anchor.removeAttribute('aria-expanded');
    if (anchor.isConnected) anchor.focus({ preventScroll: true });
  };
  const first = $('input:not([type=checkbox]), textarea, button:not([disabled])', el);
  if (first) first.focus({ preventScroll: true });
  return el;
}

/* ---------- people names, for whoever manages people (audit actors, promotion requesters, owners) ---------- */
async function names() {
  const c = B.S.cache;
  if (!B.can('people.manage')) return {};
  if (!c.names) {
    try {
      const page = await B.api.get('/admin/users', { limit: 200 });
      c.names = Object.fromEntries(B.rows(page).map((u) => [u.id, u.name]));
    } catch (error) { c.names = {}; }
  }
  return c.names;
}

/* ---------- Audit ---------- */
const ACTIONS = [
  ['answer.served', 'Answer served'],
  ['promotion.requested', 'Sharing requested'], ['promotion.approved', 'Sharing approved'], ['promotion.rejected', 'Sharing rejected'], ['promotion.revoked', 'Sharing revoked'], ['promotion.needs_review', 'Sharing needs review'],
  ['role.granted', 'Role granted'], ['role.revoked', 'Role removed'], ['clearance.changed', 'Clearance changed'],
  ['invitation.created', 'Invitation created'], ['invitation.revoked', 'Invitation revoked'], ['invitation.accepted', 'Invitation accepted'],
  ['user.suspended', 'Person suspended'], ['user.reactivated', 'Person reactivated'],
  ['account.linked', 'Account linked'], ['account.unlinked', 'Account unlinked'],
  ['connection.created', 'Connection created'], ['connection.disconnected', 'Connection removed'], ['container.changed', 'Space changed'],
  ['credential.changed', 'Credentials changed'], ['setup.claimed', 'Setup claimed'],
  ['session.created', 'Signed in'], ['session.revoked', 'Signed out'],
  ['alias.declared', 'All-staff group declared'], ['alias.removed', 'All-staff group removed'], ['domain.changed', 'Domain changed'],
  ['connection.warning_changed', 'Connection warning changed'],
];
const actionName = (a) => (ACTIONS.find((x) => x[0] === a) || [a, a.replace(/[._]/g, ' ')])[1];
const SIZES = [25, 50, 100];
const SIZE_KEY = 'broth-audit-page';
/** The page size, remembered in this browser as a convenience. */
function storedSize() {
  try { const n = Number(localStorage.getItem(SIZE_KEY)); return SIZES.includes(n) ? n : 25; } catch (e) { return 25; }
}
/* The audit API is cursor based and returns no total: each page is kept in memory, in order, for the
   current filters and page size, so Previous never asks again. Cursors stay out of the address. */
function auditState() {
  const c = B.S.cache;
  if (!c.audit) c.audit = { action: '', from: '', to: '', size: storedSize(), pages: [], page: 0, items: [], next: null, loaded: false, loading: false, error: null, seq: 0, animate: false };
  return c.audit;
}
function audit(el) {
  const a = auditState();
  const count = (a.action ? 1 : 0) + (a.from ? 1 : 0) + (a.to ? 1 : 0);
  const btn = actions(`<button type="button" class="btn sm" id="audfb" aria-haspopup="dialog">Filter${count ? `<em class="fcount">${count}</em>` : ''}</button><button type="button" class="btn sm" id="audexp">Export CSV</button>`).firstElementChild;
  $('#audexp').onclick = exportCsv;
  el.innerHTML = `<div class="audt" id="audt" role="table" aria-label="Audit log"></div><div id="audmore"></div>`;
  btn.onclick = () => {
    if (btn.getAttribute('aria-expanded') === 'true') { closePop(); return; }
    const p = pop(btn, `<form class="dmbody" id="audff" novalidate><div><p class="dmlab">Action</p><select id="audact" aria-label="Action"><option value="">Any action</option>${ACTIONS.map(([k, l]) => `<option value="${k}" ${a.action === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div><div class="audf2"><div><p class="dmlab">From</p><input type="date" id="audfrom" class="eminp" aria-label="From" value="${esc(a.from)}"></div><div><p class="dmlab">To</p><input type="date" id="audto" class="eminp" aria-label="To" value="${esc(a.to)}"></div></div><div class="actions"><button type="button" class="btn" id="audclr">Clear</button><span class="lsp"></span><button type="submit" class="btn primary">Show results</button></div></form>`, 'Filter the audit log');
    $('#audclr', p).onclick = () => { a.action = ''; a.from = ''; a.to = ''; closePop(); audit(el); restart(); };
    $('#audff', p).onsubmit = (e) => {
      e.preventDefault();
      a.action = $('#audact', p).value; a.from = $('#audfrom', p).value; a.to = $('#audto', p).value;
      closePop();
      audit(el);
      restart();
    };
  };
  if (!a.loaded || a.error) restart(); else draw();
}
/** Filters or page size changed: forget the cached pages and start at the first. */
function restart() {
  const a = auditState();
  a.pages = []; a.page = 0; a.items = []; a.next = null; a.loaded = false; a.error = null;
  load(0);
}
/** Shows page `idx`: from memory when it was fetched, otherwise from the API with the cursor the page before it gave. */
async function load(idx) {
  const a = auditState();
  if (a.pages[idx]) { a.page = idx; a.items = a.pages[idx].items; a.next = a.pages[idx].next; a.loaded = true; a.error = null; a.animate = true; draw(); return; }
  const cursor = idx === 0 ? null : (a.pages[idx - 1] || {}).next;
  if (idx > 0 && !cursor) return;
  const mine = ++a.seq;
  const table = $('#audt');
  if (table && a.loaded) table.style.minHeight = table.offsetHeight + 'px'; // rows never jump while the next page loads
  a.loading = true; a.error = null; a.page = idx; a.loaded = false;
  draw();
  const day = (d, end) => (d ? new Date(d + (end ? 'T23:59:59.999' : 'T00:00:00')).toISOString() : null);
  try {
    const [page] = await Promise.all([B.api.get('/admin/audit', { action: a.action || null, from: day(a.from, false), to: day(a.to, true), limit: a.size, cursor }), names()]);
    if (mine !== a.seq) return;
    a.pages[idx] = { items: B.rows(page), next: B.cursorOf(page) };
    a.items = a.pages[idx].items; a.next = a.pages[idx].next;
    a.loaded = true; a.animate = true;
  } catch (error) {
    if (mine !== a.seq) return;
    a.error = error;
  } finally {
    if (mine === a.seq) a.loading = false;
  }
  if (mine === a.seq) draw();
}
/** Saves the events loaded so far as a CSV, in the browser (there is no export endpoint). */
function exportCsv() {
  const a = auditState();
  if (!a.items.length) { B.toast('No events to export'); return; }
  const cell = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
  const names = B.S.cache.names || {};
  const lines = [['Timestamp', 'Event', 'Actor', 'Resource', 'Outcome'].map(cell).join(',')].concat(a.items.map((e) => [e.ts, actionName(e.action), e.actor ? names[e.actor] || e.actor : 'System', e.action === 'answer.served' ? `${B.arr(e.sources).length} sources` : String(e.target_type || '').replace(/_/g, ' '), String(e.outcome).replace(/_/g, ' ')].map(cell).join(',')));
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([lines.join('\n') + '\n'], { type: 'text/csv' }));
  link.download = 'audit-log.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  B.toast(`Exported ${a.items.length} ${a.items.length === 1 ? 'event' : 'events'}`);
}
function actor(id) {
  if (!id) return '<span class="amute">System</span>';
  const n = (B.S.cache.names || {})[id];
  return n ? `${AVATAR(n, 'lav', 18)} ${esc(n)}` : `<span class="amute mono" title="${esc(id)}">${esc(id.slice(0, 8))}</span>`;
}
function target(e) {
  if (e.action === 'answer.served') { const n = B.arr(e.sources).length; return `${n} ${n === 1 ? 'source' : 'sources'}`; }
  if (e.target_type) return esc(e.target_type.replace(/_/g, ' '));
  return '';
}
const ICONS = { answer: 'chat', promotion: 'globe', role: 'user', clearance: 'user', invitation: 'user', user: 'lock', account: 'link', connection: 'plug', container: 'folder', credential: 'lock', setup: 'settings', session: 'lock', alias: 'hash', domain: 'hash' };
const actionIcon = (a) => ICONS[String(a).split('.')[0]] || 'doc';
const outcomeTone = (o) => (o === 'ok' || o === 'answered' ? 'ok' : /denied|refused|failed|error|blocked|rejected/.test(String(o)) ? 'bad' : '');
function draw() {
  const a = auditState();
  const t = $('#audt'), more = $('#audmore');
  if (!t) return;
  const head = '<div class="aud-r aud-h" role="row"><span role="columnheader">Timestamp</span><span role="columnheader">Event</span><span role="columnheader">Actor</span><span role="columnheader">Resource</span><span role="columnheader">Outcome</span></div>';
  if (!a.loaded) {
    // An error is one framed card in place of the table and pager; loading keeps the table's shape.
    t.classList.toggle('isempty', !!a.error);
    if (a.error) t.style.minHeight = '';
    t.innerHTML = a.error ? `<div class="ds-empty">${B.errorBlock(a.error, 'audretry')}</div>` : head + B.skeletonRows(6, 'aud-r');
    const r = $('#audretry');
    if (r) r.onclick = () => load(a.page); // the same page again
    more.innerHTML = '';
    return;
  }
  t.style.minHeight = '';
  const empty = !a.items.length;
  t.classList.toggle('isempty', empty);
  // Nothing to show replaces the table, its header and the pager with one framed card.
  if (empty) { t.innerHTML = '<div class="ds-empty"><b>No events match</b><p>Try a different action or dates.</p></div>'; more.innerHTML = ''; return; }
  t.innerHTML = head + a.items.map((e) => `<div class="aud-r" role="row"><span class="amute">${B.when(e.ts, B.dayLabel(e.ts, true))}</span><span class="audw"><i class="audi">${ICON(actionIcon(e.action), 14)}</i><b class="audact">${esc(actionName(e.action))}</b>${e.channel && e.channel !== 'employee' ? `<small class="amute"> · ${esc(e.channel)}</small>` : ''}</span><span class="audwho">${actor(e.actor)}</span><span>${target(e)}</span><span><span class="tag ${outcomeTone(e.outcome)}">${esc(String(e.outcome).replace(/_/g, ' '))}</span></span></div>`).join('');
  const from = a.page * a.size + 1;
  const hasNext = !!a.next;
  more.innerHTML = `<div class="pager" role="navigation" aria-label="Audit log pages"><div class="pgsize"><label for="audsize">Rows per page</label><select id="audsize" aria-label="Rows per page">${SIZES.map((n) => `<option value="${n}" ${n === a.size ? 'selected' : ''}>${n}</option>`).join('')}</select></div><span class="pgrange" aria-live="polite">${from} to ${from + a.items.length - 1}</span><span class="pgn">Page ${a.page + 1}</span><span class="lsp"></span><div class="pgbtns"><button type="button" class="btn sm" id="audprev" ${a.page === 0 ? 'disabled aria-disabled="true"' : ''}>Previous</button><button type="button" class="btn sm" id="audnext" ${hasNext ? '' : 'disabled aria-disabled="true"'}>Next</button></div></div>`;
  $('#audprev').onclick = () => { if (a.page > 0) { a.animate = true; load(a.page - 1); toTop(); } };
  $('#audnext').onclick = () => { if (a.next) { load(a.page + 1); toTop(); } };
  $('#audsize').onchange = (e) => {
    a.size = Number(e.target.value);
    try { localStorage.setItem(SIZE_KEY, String(a.size)); } catch (err) { /* storage unavailable */ }
    restart();
  };
  if (a.animate) { a.animate = false; life(t); }
}
/** After a page change the table starts at the top of the view, smoothly unless motion is reduced. */
function toTop() {
  const t = $('#audt');
  if (!t) return;
  const r = t.getBoundingClientRect();
  if (r.top < 0) t.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}
tabs.audit = { label: 'Audit log', render: audit };

window.ADMIN = { tabs, names, setTitle, hint, actions, pop, closePop, life, allowed, domainTile, hydrateTiles };
})();
