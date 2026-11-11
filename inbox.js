/* Inbox, from the Broth prototype: your personal feed. Governance keeps every request and its history; this
 * is what needs you, and what happened to the requests you made or decided. Built from GET /v1/promotions.
 * Browser-only state: "Later" (a week), dismissed items and what you have already seen.
 * Needs backend (not faked): conflicts between sources, unanswered questions, overdue source reviews,
 * answer feedback. */
(() => {
'use strict';
const B = window.BRAIN;
/** @type {(s: string, r?: ParentNode) => any} */
const $ = (s, r = document) => r.querySelector(s);
const esc = B.esc;
const WEEK = 7 * 864e5;
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const store = (k) => { try { return JSON.parse(localStorage.getItem(k) || '{}'); } catch (e) { return {}; } };
const keep = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } };
const LATER = 'broth-inbox-later', GONE = 'broth-inbox-dismissed', SEEN = 'broth-inbox-seen';

const st = { all: [], names: {}, loaded: false, error: null };
const keyOf = (p) => p.id + ':' + p.status;
const OPENS = ['pending', 'needs_review'];
const me = () => B.S.me.id;
const who = (id) => (id === me() ? 'You' : st.names[id] || 'A colleague');
const when = (p) => p.decided_at || p.created_at;
const waiting = () => st.all.filter((p) => OPENS.includes(p.status) && p.can_decide && p.requested_by !== me() && (store(LATER)[p.id] || 0) <= Date.now());
const activity = () => {
  const gone = store(GONE);
  return st.all.filter((p) => (p.requested_by === me() || (p.approved_by === me() && p.status === 'approved')) && !gone[keyOf(p)])
    .sort((x, y) => Date.parse(when(y) || '') - Date.parse(when(x) || '')).slice(0, 20);
};
const unread = () => {
  const seen = store(SEEN);
  return waiting().filter((p) => !seen['w:' + keyOf(p)]).length + activity().filter((p) => !seen['a:' + keyOf(p)]).length;
};

async function load() {
  try {
    const [page, names] = await Promise.all([B.api.get('/promotions', { limit: 50 }), window.ADMIN ? window.ADMIN.names() : Promise.resolve({})]);
    st.all = page.items;
    st.names = names;
    st.error = null;
  } catch (error) { st.error = error; }
  const first = !st.loaded;
  st.loaded = true;
  if (first || document.querySelector('#rail')) B.renderSurfaces();
  if (B.S.route.surface === 'inbox') page();
}
window.INBOX = { open: () => (st.loaded ? unread() : 0), load };

const KINDS = { pending: ['shield', 'blue', 'Open'], approved: ['check', 'ok', 'Approved'], rejected: ['x', 'bad', 'Declined'], revoked: ['x', '', 'Revoked'], needs_review: ['shield', 'warn', 'Needs review'] };
const dot = (on) => (on ? '<i class="ixdot" aria-label="New"></i>' : '');
function waitingRow(p, seen) {
  const pub = p.to_scope === 'public';
  const name = who(p.requested_by);
  const title = `${p.document_title || 'A document'} ${pub ? 'wants to be public' : 'wants to be shared with the company'}`;
  const meta = p.status === 'needs_review' ? 'It changed after the request was sent, so it needs another look.' : `${name} asked to share it ${pub ? 'outside the company' : 'with everyone at the company'}. You can approve or reject it.`;
  return `<article class="ixrow" data-id="${esc(p.id)}"><span class="ixic blue">${ICON('globe', 18)}${dot(!seen['w:' + keyOf(p)])}</span><div class="ixb"><div class="ixt"><b>${esc(title)}</b><span class="tag blue">Request</span></div><p>${esc(meta)}</p><div class="ixm"><span>${esc(name)}</span><i></i><span>${B.when(p.created_at, B.ago(p.created_at))}</span></div></div><div class="ixa"><button type="button" class="btn sm primary" data-do="${esc(p.id)}">Review request</button><button type="button" class="btn sm" data-snooze="${esc(p.id)}">Later</button></div></article>`;
}
function activityRow(p, seen) {
  const mineReq = p.requested_by === me();
  const [ic, tone, lab] = KINDS[p.status] || KINDS.pending;
  const doc = p.document_title || 'A document';
  const to = p.to_scope === 'public' ? 'public' : 'shared with the company';
  const title = mineReq ? `Your request for ${doc} to be ${to}` : `You approved ${doc}`;
  const meta = !mineReq ? `${who(p.requested_by)} asked for it to be ${to}.`
    : p.status === 'pending' || p.status === 'needs_review' ? 'Waiting for a reviewer.'
    : p.status === 'approved' ? `${p.approved_by ? who(p.approved_by) + ' approved it' : 'It was approved'}.`
    : p.status === 'rejected' ? 'It was declined.' : 'Access was withdrawn.';
  return `<article class="ixrow" data-id="${esc(p.id)}"><span class="ixic ${tone}">${ICON(ic, 18)}${dot(!seen['a:' + keyOf(p)])}</span><div class="ixb"><div class="ixt"><b>${esc(title)}</b><span class="tag ${tone}">${esc(lab)}</span></div><p>${esc(meta)}</p><div class="ixm"><span>${B.when(when(p), B.ago(when(p)))}</span></div></div><div class="ixa"><button type="button" class="btn sm" data-gone="${esc(keyOf(p))}">Dismiss</button></div></article>`;
}
const dayStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

function page() {
  const seen = store(SEEN);
  const wait = waiting();
  const act = activity();
  const today = dayStart(new Date());
  /** @type {any[]} */ const groups = [['Today', act.filter((p) => Date.parse(when(p) || '') >= today)], ['Earlier', act.filter((p) => Date.parse(when(p) || '') < today)]].filter(([, l]) => l.length);
  const body = (wait.length ? `<div class="ixgrp">Waiting on you</div>${wait.map((p) => waitingRow(p, seen)).join('')}` : '')
    + groups.map(([g, l]) => `<div class="ixgrp">${g}</div>${l.map((p) => activityRow(p, seen)).join('')}`).join('');
  const empty = st.error ? B.errorBlock(st.error, 'ixretry') : st.loaded ? `<div class="ds-empty"><span class="ds-empty-ic">${ICON('check', 22)}</span><b>All caught up</b><p>Nothing needs your review right now.</p></div>` : B.skeletonRows(3);
  $('#app').className = '';
  $('#app').innerHTML = `<div class="pg ixpg"><div class="ds-head"><h1>Inbox</h1><div class="ds-act"><button type="button" class="link" id="ixall">See all requests ${ICON('arrow', 14)}</button></div></div><div class="ixlist">${body || empty}</div></div>`;
  $('#ixall').onclick = () => B.go('/governance');
  const retry = $('#ixretry');
  if (retry) retry.onclick = load;
  const leave = (row, fn, msg) => {
    const fin = () => { fn(); B.renderSurfaces(); page(); if (msg) B.toast(msg); };
    if (row && row.animate && !calm()) row.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(24px)' }], { duration: 220, easing: 'ease-in' }).finished.then(fin, fin);
    else fin();
  };
  /** @type {any[]} */ ([...document.querySelectorAll('[data-do]')]).forEach((b) => { b.onclick = () => { const p = st.all.find((x) => x.id === b.dataset.do); if (p) { const s = store(SEEN); s['w:' + keyOf(p)] = 1; keep(SEEN, s); B.renderSurfaces(); } review(p ? Object.assign({}, p, { who: who(p.requested_by) }) : null); }; });
  /** @type {any[]} */ ([...document.querySelectorAll('[data-snooze]')]).forEach((b) => { b.onclick = () => leave(b.closest('.ixrow'), () => { const l = store(LATER); l[b.dataset.snooze] = Date.now() + WEEK; keep(LATER, l); }, 'Snoozed for a week'); });
  /** @type {any[]} */ ([...document.querySelectorAll('[data-gone]')]).forEach((b) => { b.onclick = () => leave(b.closest('.ixrow'), () => { const g = store(GONE); g[b.dataset.gone] = 1; keep(GONE, g); }, null); });
  // Visiting the Inbox reads the activity; "Waiting on you" stays new until you open it.
  if (st.loaded && act.some((p) => !seen['a:' + keyOf(p)])) { const s = store(SEEN); act.forEach((p) => { s['a:' + keyOf(p)] = 1; }); keep(SEEN, s); setTimeout(() => B.renderSurfaces(), 0); }
}

/* ---------- the review popup: read the request and decide it here (the Governance calls and rules) ---------- */
const SCOPE = { public: 'Public', internal: 'Everyone at the company', granular: 'Specific people' };
const STATUS = { pending: 'Pending', needs_review: 'Needs review', approved: 'Approved', rejected: 'Rejected', revoked: 'Revoked' };
function review(p) {
  if (!p) return;
  const mine = p.requested_by === B.S.me.id;
  const canDecide = p.can_decide && OPENS.includes(p.status);
  B.openModal(`<div class="modal" style="max-width:480px" role="dialog" aria-label="Review request"><div class="bar"><span>Review request</span><button type="button" class="link" data-close-modal>Close</button></div><div class="body rvbody">
    <div class="rv-who">${AVATAR(p.who, 'avimg', 36)}<span><b>${esc(p.who)}</b><small>${B.when(p.created_at, B.ago(p.created_at))}</small></span><span class="tag ${p.status === 'needs_review' ? 'warn' : 'blue'}">${esc(STATUS[p.status] || p.status)}</span></div>
    <div class="rv-doc"><span class="rv-dl"></span><span class="rv-dt"><b>${esc(p.document_title || 'A document')}</b><small id="rvpath"></small></span><button type="button" class="link" id="rvopen">Open document</button></div>
    <div class="rv-acc"><span class="amute">Access</span><span class="tag" id="rvfrom">...</span><span class="rv-ar" aria-hidden="true">${ICON('arrow', 14)}</span><span class="tag blue">${esc(SCOPE[p.to_scope] || p.to_scope)}</span></div>
    ${p.reason ? `<p class="rv-note">${esc(p.reason)}</p>` : ''}
    <div class="hse" id="rverr" role="alert"></div>
    <div class="actions">${canDecide ? `${mine ? '' : '<button type="button" class="btn primary" id="rvyes">Approve</button>'}<button type="button" class="btn" id="rvno">Decline</button>` : ''}</div></div></div>`);
  const m = $('#modal');
  B.api.get('/documents/' + p.document_id).then((d) => {
    if (!m.querySelector('#rvpath')) return;
    m.querySelector('.rv-dl').innerHTML = B.srcIcon(d.system, 24);
    m.querySelector('#rvpath').textContent = d.path ? B.containerName(d.path) : B.systemName(d.system);
    m.querySelector('#rvfrom').textContent = SCOPE[d.scope] || d.scope;
  }, () => { const f = m.querySelector('#rvfrom'); if (f) f.textContent = 'Current access'; });
  m.querySelector('#rvopen').onclick = () => { B.closeModal(); if (window.DOCUMENTS) window.DOCUMENTS.openDocument(p.document_id); };
  const decide = (btn, act) => {
    if (act === 'reject' && !btn.dataset.arm) { btn.dataset.arm = '1'; btn.textContent = 'Confirm decline'; btn.classList.add('danger'); return; }
    B.busy(btn, async () => {
      await B.api.post(`/promotions/${p.id}/${act}`, {});
      B.toast(act === 'approve' ? 'Approved. It is shared more widely now.' : 'Declined');
      B.closeModal();
      const row = document.querySelector(`.ixrow[data-id="${p.id}"]`);
      const fin = () => { load(); };
      if (row && row.animate && !calm()) row.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(24px)' }], { duration: 220, easing: 'ease-in' }).finished.then(fin, fin); else fin();
    }, (error) => { m.querySelector('#rverr').textContent = B.problem(error); });
  };
  const yes = m.querySelector('#rvyes'); if (yes) yes.onclick = () => decide(yes, 'approve');
  const no = m.querySelector('#rvno'); if (no) no.onclick = () => decide(no, 'reject');
}
window.SURFACES.inbox = () => { page(); load(); };
/* The rail badge follows the count: read once the app is up, then every few minutes. */
let started = false;
setInterval(() => { if (B.S.phase === 'app') { if (!started) { started = true; load(); } } else started = false; }, 1500);
setInterval(() => { if (B.S.phase === 'app') load(); }, 180000);
})();
