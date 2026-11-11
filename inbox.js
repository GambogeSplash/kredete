/* Inbox, from the Broth prototype: what needs your attention. In the real app that is the sharing requests
 * you can decide (GET /v1/promotions). Conflicts, gaps, stale sources and feedback have no endpoint yet.
 * "Later" hides an item for a week in this browser only. */
(() => {
'use strict';
const B = window.BRAIN;
/** @type {(s: string, r?: ParentNode) => any} */
const $ = (s, r = document) => r.querySelector(s);
const esc = B.esc;
const LATER = 'broth-inbox-later';
const WEEK = 7 * 864e5;
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const st = { items: [], loaded: false, error: null, filter: 'all' };
const later = () => { try { return JSON.parse(localStorage.getItem(LATER) || '{}'); } catch (e) { return {}; } };
const snooze = (id) => { const l = later(); l[id] = Date.now() + WEEK; try { localStorage.setItem(LATER, JSON.stringify(l)); } catch (e) { /* storage unavailable */ } };
const hidden = (id) => (later()[id] || 0) > Date.now();
const left = () => st.items.filter((p) => !hidden(p.id));

async function load() {
  try {
    const [a, b] = await Promise.all([B.api.get('/promotions', { status: 'pending', limit: 50 }), B.api.get('/promotions', { status: 'needs_review', limit: 50 })]);
    const names = window.ADMIN ? await window.ADMIN.names() : {};
    st.items = [...a.items, ...b.items].filter((p) => p.can_decide).map((p) => Object.assign({}, p, { who: names[p.requested_by] || 'A colleague' }));
    st.error = null;
  } catch (error) { st.error = error; }
  const before = st.loaded;
  st.loaded = true;
  if (!before || document.querySelector('.rl-dot, #rail')) B.renderSurfaces();
  if (B.S.route.surface === 'inbox') page();
}
window.INBOX = { open: () => (st.loaded ? left().length : 0), load };

function page() {
  const items = left();
  const chips = [['all', 'All', items.length], ['request', 'Requests', items.length]].map(([k, l, n]) => `<button type="button" class="ixchip ${st.filter === k ? 'on' : ''}" data-f="${k}">${l}<em>${n}</em></button>`).join('');
  const rows = items.map((p) => {
    const pub = p.to_scope === 'public';
    const title = `${p.document_title || 'A document'} ${pub ? 'wants to be public' : 'wants to be shared with the company'}`;
    const meta = p.status === 'needs_review' ? 'It changed after the request was sent, so it needs another look.' : `${p.who} asked to share it ${pub ? 'outside the company' : 'with everyone at the company'}. You can approve or reject it.`;
    return `<article class="ixrow" data-id="${esc(p.id)}"><span class="ixic blue">${ICON('globe', 18)}</span><div class="ixb"><div class="ixt"><b>${esc(title)}</b><span class="tag blue">Request</span></div><p>${esc(meta)}</p><div class="ixm"><span>${esc(p.who)}</span><i></i><span>${B.when(p.created_at, B.ago(p.created_at))}</span></div></div><div class="ixa"><button type="button" class="btn sm primary" data-do="${esc(p.id)}">Review request</button><button type="button" class="btn sm" data-snooze="${esc(p.id)}">Later</button></div></article>`;
  }).join('');
  const empty = st.error ? B.errorBlock(st.error, 'ixretry') : st.loaded ? `<div class="ixempty"><span class="ixok">${ICON('check', 22)}</span><b>All caught up</b><p>New reports from your team show up here.</p></div>` : B.skeletonRows(3);
  $('#app').className = '';
  $('#app').innerHTML = `<div class="pg ixpg"><h1>Inbox</h1><div class="ixchips" role="tablist">${chips}</div><div class="ixlist">${rows || empty}</div></div>`;
  const retry = $('#ixretry');
  if (retry) retry.onclick = load;
  /** @type {any[]} */ ([...document.querySelectorAll('[data-f]')]).forEach((b) => { b.onclick = () => { st.filter = b.dataset.f; page(); }; });
  /** @type {any[]} */ ([...document.querySelectorAll('[data-do]')]).forEach((b) => { b.onclick = () => { B.go('/governance'); window.scrollTo(0, 0); }; });
  /** @type {any[]} */ ([...document.querySelectorAll('[data-snooze]')]).forEach((b) => {
    b.onclick = () => {
      const row = b.closest('.ixrow');
      snooze(b.dataset.snooze);
      const fin = () => { B.renderSurfaces(); page(); B.toast('Snoozed for a week'); };
      if (row && row.animate && !calm()) row.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(24px)' }], { duration: 220, easing: 'ease-in' }).finished.then(fin, fin);
      else fin();
    };
  });
}
window.SURFACES.inbox = () => { page(); load(); };
/* The rail badge follows the count: read once the app is up, then every few minutes. */
let started = false;
setInterval(() => { if (B.S.phase === 'app') { if (!started) { started = true; load(); } } else started = false; }, 1500);
setInterval(() => { if (B.S.phase === 'app') load(); }, 180000);
})();
