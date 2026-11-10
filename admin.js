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

/** @type {Record<string, { label: string, roles: string[], render: (el: HTMLElement) => void }>} */
const tabs = {};
const ORDER = ['connectors', 'people', 'domains', 'audit'];
const allowed = () => ORDER.filter((k) => tabs[k] && B.hasRole(...tabs[k].roles));

window.SURFACES.admin = (params) => {
  const mine = allowed();
  const tab = params.tab;
  if (!tab || !mine.includes(tab)) { B.go('/admin/' + (mine[0] || ''), { replace: true }); return; }
  $('#app').innerHTML = `<div class="lset"><nav class="lrail" aria-label="Admin">${mine.map((k) => `<button type="button" class="tab" data-at="${k}" aria-current="${k === tab ? 'page' : 'false'}">${tabs[k].label}</button>`).join('')}${B.setupPending() ? '<div class="lrail-sep" role="separator"></div><button type="button" class="tab" data-setup="1">Finish setup</button>' : ''}</nav><div class="lcont"><h1 class="lcont-t">${tabs[tab].label}</h1><div id="adpane"></div></div></div>`;
  $$('[data-at]').forEach((b) => { b.onclick = () => B.go('/admin/' + b.dataset.at); });
  const s = $('[data-setup]');
  if (s) s.onclick = () => B.go('/setup');
  tabs[tab].render($('#adpane'));
};

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
  el.innerHTML = `<div class="audf"><label class="audfl"><span class="hsl">Action</span><select id="audact" aria-label="Action"><option value="">Any action</option>${ACTIONS.map(([k, l]) => `<option value="${k}" ${a.action === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label><label class="audfl"><span class="hsl">From</span><input type="date" id="audfrom" class="eminp" value="${esc(a.from)}"></label><label class="audfl"><span class="hsl">To</span><input type="date" id="audto" class="eminp" value="${esc(a.to)}"></label></div><div class="dt auddt" style="--cols:minmax(0,1.1fr) minmax(0,1.4fr) minmax(0,1.1fr) minmax(0,1.2fr) minmax(0,.9fr)" id="audt"></div><div class="chmore" id="audmore"></div>`;
  const change = () => { a.action = $('#audact').value; a.from = $('#audfrom').value; a.to = $('#audto').value; load(true); };
  $('#audact').onchange = change;
  $('#audfrom').onchange = change;
  $('#audto').onchange = change;
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
function draw() {
  const a = auditState();
  const t = $('#audt'), more = $('#audmore');
  if (!t) return;
  const head = '<div class="dt-r dt-h"><span>When</span><span>What</span><span>Who</span><span>About</span><span>Outcome</span></div>';
  if (!a.loaded) {
    t.innerHTML = head + (a.error ? `<div class="dt-r dterr">${B.errorBlock(a.error, 'audretry')}</div>` : B.skeletonRows(6, 'dt-r'));
    const r = $('#audretry');
    if (r) r.onclick = () => load(true);
    more.innerHTML = '';
    return;
  }
  t.innerHTML = head + (a.items.length
    ? a.items.map((e) => `<div class="dt-r"><span class="dtm">${B.when(e.ts, B.dayLabel(e.ts, true))}</span><span class="dtp"><b class="audact">${esc(actionName(e.action))}</b>${e.channel && e.channel !== 'employee' ? `<small class="amute"> · ${esc(e.channel)}</small>` : ''}</span><span class="dtm audwho">${actor(e.actor)}</span><span class="dtm">${target(e)}</span><span><span class="tag ${e.outcome === 'ok' || e.outcome === 'answered' ? 'ok' : ''}">${esc(String(e.outcome).replace(/_/g, ' '))}</span></span></div>`).join('')
    : '<div class="dt-r dtempty"><span class="amute">No events match.</span></div>');
  more.innerHTML = a.next ? `<button type="button" class="btn sm" id="audload" ${a.loading ? 'disabled' : ''}>${a.loading ? 'Loading' : 'Show more'}</button>` : '';
  const m = $('#audload');
  if (m) m.onclick = () => load(false);
}
tabs.audit = { label: 'Audit', roles: ['admin', 'compliance'], render: audit };

window.ADMIN = { tabs, names };
})();
