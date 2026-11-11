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
  const empty = st.error ? B.errorBlock(st.error, 'ixretry') : st.loaded ? `<div class="ds-empty"><span class="ds-empty-ic">${ICON('check', 22)}</span><b>All caught up</b><p>Nothing needs your review right now.</p></div>` : B.skeletonRows(3);
  $('#app').className = '';
  $('#app').innerHTML = `<div class="pg ixpg"><h1>Inbox <span class="hint" tabindex="0" data-tip="Things that need your attention, such as sharing requests you can decide." aria-label="Things that need your attention, such as sharing requests you can decide.">i</span></h1><div class="ixchips" role="tablist">${chips}</div><div class="ixlist">${rows || empty}</div></div>`;
  const retry = $('#ixretry');
  if (retry) retry.onclick = load;
  /** @type {any[]} */ ([...document.querySelectorAll('[data-f]')]).forEach((b) => { b.onclick = () => { st.filter = b.dataset.f; page(); }; });
  /** @type {any[]} */ ([...document.querySelectorAll('[data-do]')]).forEach((b) => { b.onclick = () => review(st.items.find((x) => x.id === b.dataset.do), b); });
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

/* ---------- the review popup: read the request and decide it here (the Governance calls and rules) ---------- */
const SCOPE = { public: 'Public', internal: 'Everyone at the company', granular: 'Specific people' };
const STATUS = { pending: 'Pending', needs_review: 'Needs review', approved: 'Approved', rejected: 'Rejected', revoked: 'Revoked' };
const OPENS = ['pending', 'needs_review'];
function review(p, opener) {
  if (!p) return;
  const back = document.createElement('div');
  back.className = 'rv-back';
  const mine = p.requested_by === B.S.me.id;
  const open = OPENS.includes(p.status);
  const canDecide = p.can_decide && open;
  back.innerHTML = `<div class="ds-pop rv-pop" role="dialog" aria-modal="true" aria-labelledby="rvt" tabindex="-1">
    <div class="rv-top"><h2 id="rvt">Review request</h2><button type="button" class="rv-x" aria-label="Close">${ICON('x', 16)}</button></div>
    <div class="rv-who">${AVATAR(p.who, 'avimg', 36)}<span><b>${esc(p.who)}</b><small>${B.when(p.created_at, B.ago(p.created_at))}</small></span><span class="tag ${p.status === 'needs_review' ? 'warn' : 'blue'}">${esc(STATUS[p.status] || p.status)}</span></div>
    <div class="rv-doc" id="rvdoc"><span class="rv-dl"></span><span class="rv-dt"><b>${esc(p.document_title || 'A document')}</b><small id="rvpath"></small></span><button type="button" class="link" id="rvopen">Open document</button></div>
    <div class="rv-acc"><span class="amute">Access</span><span class="tag" id="rvfrom">...</span><span class="rv-ar" aria-hidden="true">${ICON('arrow', 14)}</span><span class="tag blue">${esc(SCOPE[p.to_scope] || p.to_scope)}</span></div>
    ${p.reason ? `<p class="rv-note">${esc(p.reason)}</p>` : ''}
    <div class="hse" id="rverr" role="alert"></div>
    <div class="rv-act">${canDecide ? `${mine ? '' : '<button type="button" class="btn primary" id="rvyes">Approve</button>'}<button type="button" class="btn" id="rvno">Decline</button>` : ''}<span class="lsp"></span><button type="button" class="btn" id="rvclose">Close</button></div></div>`;
  document.body.appendChild(back);
  const pop = /** @type {any} */ (back.firstElementChild);
  const bg = [...document.querySelectorAll('.top,.mainpanel,#rail')];
  bg.forEach((x) => x.setAttribute('inert', ''));
  const M = window.Motion;
  if (M && M.animate && !calm()) { M.animate(back, { opacity: [0, 1] }, { duration: 0.16 }); M.animate(pop, { opacity: [0, 1], y: [14, 0], scale: [0.97, 1] }, { type: 'spring', stiffness: 420, damping: 30 }); }
  let done = false;
  const close = (restore = true) => {
    if (done) return;
    done = true;
    document.removeEventListener('keydown', key, true);
    const fin = () => { back.remove(); bg.forEach((x) => x.removeAttribute('inert')); if (restore && opener && opener.isConnected) opener.focus(); };
    if (M && M.animate && !calm()) { M.animate(pop, { opacity: [1, 0], y: [0, 8], scale: [1, 0.98] }, { duration: 0.14 }); M.animate(back, { opacity: [1, 0] }, { duration: 0.14 }).finished.then(fin, fin); } else fin();
  };
  const FOC = 'button:not([disabled]),[href],input,[tabindex]:not([tabindex="-1"])';
  const key = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
    if (e.key !== 'Tab') return;
    const f = [...pop.querySelectorAll(FOC)].filter((x) => x.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === pop)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  document.addEventListener('keydown', key, true);
  back.addEventListener('pointerdown', (e) => { if (e.target === back) close(); });
  pop.querySelector('.rv-x').onclick = () => close();
  pop.querySelector('#rvclose').onclick = () => close();
  setTimeout(() => /** @type {any} */ (pop.querySelector('#rvyes') || pop.querySelector('#rvno') || pop.querySelector('#rvclose')).focus(), 30);
  B.api.get('/documents/' + p.document_id).then((d) => {
    if (done) return;
    pop.querySelector('.rv-dl').innerHTML = B.srcIcon(d.system, 24);
    pop.querySelector('#rvpath').textContent = d.path ? B.containerName(d.path) : B.systemName(d.system);
    pop.querySelector('#rvfrom').textContent = SCOPE[d.scope] || d.scope;
  }, () => { if (!done) { pop.querySelector('#rvfrom').textContent = 'Current access'; } });
  pop.querySelector('#rvopen').onclick = () => { close(false); if (window.DOCUMENTS) window.DOCUMENTS.openDocument(p.document_id); };
  const decide = (btn, act) => {
    if (act === 'reject' && !btn.dataset.arm) { btn.dataset.arm = '1'; btn.textContent = 'Confirm decline'; btn.classList.add('danger'); return; }
    B.busy(btn, async () => {
      await B.api.post(`/promotions/${p.id}/${act}`, {});
      B.toast(act === 'approve' ? 'Approved. It is shared more widely now.' : 'Declined');
      close(false);
      const row = document.querySelector(`.ixrow[data-id="${p.id}"]`);
      const fin = () => { st.items = st.items.filter((x) => x.id !== p.id); B.renderSurfaces(); page(); };
      if (row && row.animate && !calm()) row.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(24px)' }], { duration: 220, easing: 'ease-in' }).finished.then(fin, fin); else fin();
    }, (error) => { pop.querySelector('#rverr').textContent = B.problem(error); });
  };
  const yes = pop.querySelector('#rvyes'); if (yes) yes.onclick = () => decide(yes, 'approve');
  const no = pop.querySelector('#rvno'); if (no) no.onclick = () => decide(no, 'reject');
}
window.SURFACES.inbox = () => { page(); load(); };
/* The rail badge follows the count: read once the app is up, then every few minutes. */
let started = false;
setInterval(() => { if (B.S.phase === 'app') { if (!started) { started = true; load(); } } else started = false; }, 1500);
setInterval(() => { if (B.S.phase === 'app') load(); }, 180000);
})();
