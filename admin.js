/* admin.js: the Admin area (sandbox spec 4.3, plan C7 and C8) and its Audit tab.
 *
 * A settings-style page with a left rail. Admins see Connectors, People, Domains and Audit;
 * compliance sees Audit only (the router also refuses the others by URL). Tabs register
 * in window.ADMIN.tabs: connectors.js, people.js and domains.js add theirs.
 */
(() => {
'use strict';
const B = window.BRAIN;
/** @type {(s: string, r?: ParentNode) => any} */
const $ = (s, r = document) => r.querySelector(s);
/** @type {(s: string, r?: ParentNode) => any[]} */
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = B.esc;

/** @type {Record<string, { label: string, hint?: string, roles: string[], render: (el: HTMLElement) => void }>} */
const tabs = {};
const ORDER = ['connectors', 'people', 'domains', 'audit'];
const allowed = () => ORDER.filter((k) => tabs[k] && B.hasRole(...tabs[k].roles));

window.SURFACES.admin = (params) => {
  const mine = allowed();
  const tab = params.tab;
  if (!tab || !mine.includes(tab)) { B.go('/admin/' + (mine[0] || ''), { replace: true }); return; }
  closePop();
  $('#app').innerHTML = `<div class="lset"><nav class="lrail" aria-label="Admin"></nav><div class="lcont"><div class="ds-head"><h1 class="lcont-t">${tabs[tab].label}${tabs[tab].hint ? hint(tabs[tab].hint) : ''}</h1><div class="ds-act" id="adact"></div></div><div id="adpane"></div></div></div>`;
  rail(tab);
  tabs[tab].render($('#adpane'));
};

/** The (i) hint: a short sentence on hover or focus, in place of a subtitle. */
const hint = (text) => `<span class="hint" tabindex="0" data-tip="${esc(text)}" aria-label="${esc(text)}">i</span>`;
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
 * @returns {HTMLElement}
 */
function pop(anchor, html, label) {
  closePop();
  const el = document.createElement('div');
  el.className = 'ds-pop';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', label);
  el.innerHTML = html;
  document.body.appendChild(el);
  const place = () => {
    const r = anchor.getBoundingClientRect();
    el.style.top = (r.bottom + 8) + 'px';
    el.style.right = Math.max(12, innerWidth - r.right) + 'px';
    el.style.maxHeight = Math.max(200, innerHeight - r.bottom - 20) + 'px';
  };
  place();
  anchor.setAttribute('aria-expanded', 'true');
  const away = (/** @type {any} */ e) => { if (!el.contains(e.target) && !anchor.contains(e.target) && !e.target.closest('.ssel-menu, [role=listbox]')) closePop(); };
  const key = (/** @type {KeyboardEvent} */ e) => { if (e.key === 'Escape' && !$('.ssel-menu')) closePop(); };
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
    anchor.removeAttribute('aria-expanded');
    if (anchor.isConnected) anchor.focus({ preventScroll: true });
  };
  const first = $('input:not([type=checkbox]), textarea', el);
  if (first) first.focus({ preventScroll: true });
  return el;
}

/**
 * The tab rail, with Finish setup while setup is pending.
 * @param {string} tab
 */
function rail(tab) {
  const nav = $('.lrail');
  if (!nav) return;
  nav.innerHTML = `${allowed().map((k) => `<button type="button" class="tab" data-at="${k}" aria-current="${k === tab ? 'page' : 'false'}">${tabs[k].label}</button>`).join('')}`;
  $$('[data-at]', nav).forEach((b) => { b.onclick = () => B.go('/admin/' + b.dataset.at); });
}
// Setup can finish while an Admin tab is open (a space's first read ends): the rail follows.
document.addEventListener('brain:setupchange', () => {
  if (B.S.route && B.S.route.surface === 'admin') rail(B.S.route.params.tab);
});

/* ---------- people names, for admins (audit actors, promotion requesters, owners) ---------- */
async function names() {
  const c = B.S.cache;
  if (!B.isAdmin()) return {};
  if (!c.names) {
    try {
      const page = await B.api.get('/admin/users', { limit: 200 });
      c.names = Object.fromEntries(page.items.map((u) => [u.id, u.name]));
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
function auditState() {
  const c = B.S.cache;
  if (!c.audit) c.audit = { action: '', from: '', to: '', items: [], next: null, loaded: false, loading: false, error: null, seq: 0 };
  return c.audit;
}
function audit(el) {
  const a = auditState();
  const count = (a.action ? 1 : 0) + (a.from ? 1 : 0) + (a.to ? 1 : 0);
  const btn = actions(`<button type="button" class="btn sm" id="audfb" aria-haspopup="dialog">Filter${count ? `<em class="fcount">${count}</em>` : ''}</button>`).firstElementChild;
  el.innerHTML = `<div class="ds-table bt auddt" id="audt" role="table" aria-label="Audit log" style="--cols:minmax(120px,.9fr) minmax(0,1.4fr) minmax(0,1.1fr) minmax(0,1fr) 120px"></div><div class="chmore" id="audmore"></div>`;
  btn.onclick = () => {
    if (btn.getAttribute('aria-expanded') === 'true') { closePop(); return; }
    const p = pop(btn, `<form class="dmbody" id="audff" novalidate><div><p class="dmlab">Action</p><select id="audact" aria-label="Action"><option value="">Any action</option>${ACTIONS.map(([k, l]) => `<option value="${k}" ${a.action === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div><div class="audf2"><div><p class="dmlab">From</p><input type="date" id="audfrom" class="eminp" aria-label="From" value="${esc(a.from)}"></div><div><p class="dmlab">To</p><input type="date" id="audto" class="eminp" aria-label="To" value="${esc(a.to)}"></div></div><div class="actions"><button type="button" class="btn" id="audclr">Clear</button><span class="lsp"></span><button type="submit" class="btn primary">Show results</button></div></form>`, 'Filter the audit log');
    $('#audclr', p).onclick = () => { a.action = ''; a.from = ''; a.to = ''; closePop(); audit(el); };
    $('#audff', p).onsubmit = (e) => {
      e.preventDefault();
      a.action = $('#audact', p).value; a.from = $('#audfrom', p).value; a.to = $('#audto', p).value;
      closePop();
      audit(el);
      load(true);
    };
  };
  if (!a.loaded || a.error) load(true); else draw();
}
async function load(reset) {
  const a = auditState();
  if (!reset && (a.loading || !a.next)) return;
  const mine = ++a.seq;
  a.loading = true; a.error = null;
  if (reset) { a.items = []; a.next = null; a.loaded = false; }
  draw();
  const day = (d, end) => (d ? new Date(d + (end ? 'T23:59:59.999' : 'T00:00:00')).toISOString() : null);
  try {
    const [page] = await Promise.all([B.api.get('/admin/audit', { action: a.action || null, from: day(a.from, false), to: day(a.to, true), limit: 50, cursor: reset ? null : a.next }), names()]);
    if (mine !== a.seq) return;
    a.items = reset ? page.items : a.items.concat(page.items);
    a.next = page.next_cursor || null;
    a.loaded = true;
  } catch (error) {
    if (mine !== a.seq) return;
    a.error = error;
  } finally {
    if (mine === a.seq) a.loading = false;
  }
  if (mine === a.seq) draw();
}
function actor(id) {
  if (!id) return '<span class="amute">System</span>';
  const n = (B.S.cache.names || {})[id];
  return n ? `${AVATAR(n, 'lav', 18)} ${esc(n)}` : `<span class="amute mono" title="${esc(id)}">${esc(id.slice(0, 8))}</span>`;
}
function target(e) {
  if (e.action === 'answer.served') return `${e.sources.length} ${e.sources.length === 1 ? 'source' : 'sources'}`;
  if (e.target_type) return esc(e.target_type.replace(/_/g, ' '));
  return '';
}
const outcomeTone = (o) => (o === 'ok' || o === 'answered' ? 'ok' : /denied|refused|failed|error|blocked|rejected/.test(String(o)) ? 'bad' : '');
function draw() {
  const a = auditState();
  const t = $('#audt'), more = $('#audmore');
  if (!t) return;
  const head = '<div class="ds-tr ds-th" role="row"><span role="columnheader">Timestamp</span><span role="columnheader">Event</span><span role="columnheader">Actor</span><span role="columnheader">Resource</span><span role="columnheader">Outcome</span></div>';
  if (!a.loaded) {
    t.innerHTML = head + (a.error ? `<div class="ds-tr dterr">${B.errorBlock(a.error, 'audretry')}</div>` : B.skeletonRows(6, 'ds-tr'));
    const r = $('#audretry');
    if (r) r.onclick = () => load(true);
    more.innerHTML = '';
    return;
  }
  t.innerHTML = head + (a.items.length
    ? a.items.map((e) => `<div class="ds-tr" role="row"><span class="dtm amute">${B.when(e.ts, B.dayLabel(e.ts, true))}</span><span class="dtp m-main"><b class="audact">${esc(actionName(e.action))}</b>${e.channel && e.channel !== 'employee' ? `<small class="amute"> · ${esc(e.channel)}</small>` : ''}</span><span class="dtm audwho">${actor(e.actor)}</span><span class="dtm">${target(e)}</span><span class="m-end"><span class="tag ${outcomeTone(e.outcome)}">${esc(String(e.outcome).replace(/_/g, ' '))}</span></span></div>`).join('')
    : '<div class="ds-tr dtempty"><span class="amute">No events match.</span></div>');
  more.innerHTML = a.next ? `<button type="button" class="btn sm" id="audload" ${a.loading ? 'disabled' : ''}>${a.loading ? 'Loading' : 'Show more'}</button>` : '';
  const m = $('#audload');
  if (m) m.onclick = () => load(false);
}
tabs.audit = { label: 'Audit', hint: 'Every sign-in, answer and change, newest first.', roles: ['admin', 'compliance'], render: audit };

window.ADMIN = { tabs, names, hint, actions, pop, closePop };
})();
