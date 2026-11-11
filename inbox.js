/* Inbox and Insights: what owners need to fix, and what Broth learned from the questions people ask.
 * Sample data only. Items resolve in place and the rail badge follows the count. */
(() => {
const B = window.BRAIN; if (!B) return;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = B.esc || ((x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;'));
const ICON = (n, s) => window.ICON(n, s);

const SHARE = [
  { id: 's1', doc: 'Partner Pricing 2026', sys: 'Google Drive', scope: 'public', by: 'Leo Marsh', when: '3 h ago', status: 'pending', note: 'Partners keep asking for the rate card. Making it public saves a request each time.' },
  { id: 's2', doc: 'Onboarding checklist', sys: 'Confluence', scope: 'internal', by: 'Zainab Bello', when: 'Yesterday', status: 'pending', note: 'New hires in every team need it in week one.' },
  { id: 's3', doc: 'Savings Rate Sheet', sys: 'Google Drive', scope: 'public', by: 'Tomas Berg', when: '2 d ago', status: 'needs_review', note: 'Rates changed after this request was sent, so it needs another look.' },
  { id: 's4', doc: 'Support escalation guide', sys: 'Google Drive', scope: 'internal', by: 'Daniel Reyes', when: '4 d ago', status: 'approved', note: 'Approved for everyone at the company.' },
  { id: 's5', doc: 'Crypto Custody Policy', sys: 'Confluence', scope: 'public', by: 'Priya Nair', when: '5 d ago', status: 'rejected', note: 'Contains internal controls that must stay private.' },
  { id: 's6', doc: 'Brand and UI guidelines', sys: 'Google Drive', scope: 'public', by: 'Zainab Bello', when: '1 wk ago', status: 'approved', note: 'Public for agencies and partners.' },
  { id: 's7', doc: 'Product roadmap 2027', sys: 'Confluence', scope: 'internal', by: 'Amara Okafor', when: '1 wk ago', status: 'revoked', note: 'Access was withdrawn after the plan changed.' }
];
const shareSt = () => { const S = B.S; S.share = S.share || {}; return S.share; };
const shareOf = (r) => Object.assign({}, r, { status: shareSt()[r.id] || r.status });
window.SHARING = { list: () => SHARE.map(shareOf), set: (id, v) => { shareSt()[id] = v; B.save(); } };
const ITEMS = [
  { id: 'i5', kind: 'request', ref: 's1', title: 'Partner Pricing 2026 wants to be public', meta: 'Leo Marsh asked to share it outside the company. You can approve or reject it.', who: 'Leo Marsh', age: '3 h ago', hits: 0, src: ['Google Drive'], act: 'Review request' },
  { id: 'i1', kind: 'conflict', title: 'Card replacement fee: $5.00 or $7.50?', meta: 'Fee Schedule 2026 says $5.00, Cards FAQ says $7.50', who: 'Sam Idowu', age: '2 h ago', hits: 6, src: ['Confluence', 'Google Drive'], act: 'Mark fixed' },
  { id: 'i2', kind: 'gap', title: 'Crypto custody for business accounts', meta: 'Asked 9 times this week. No source was good enough.', who: 'Compliance team', age: 'Yesterday', hits: 9, src: [], act: 'Assign an owner' },
  { id: 'i3', kind: 'stale', title: 'Transfer Limits Policy is overdue for review', meta: 'Last verified 150 days ago. Cited in 14 answers.', who: 'Priya Nair', age: '3 d ago', hits: 14, src: ['Confluence'], act: 'Verify now' },
  { id: 'i4', kind: 'feedback', title: 'Savings interest answer marked wrong', meta: 'Savings Rate Sheet is past its review date.', who: 'Tomas Berg', age: '3 d ago', hits: 2, src: ['Google Drive'], act: 'Review answer' }
];
const KIND = { request: ['Request', 'globe', 'blue'], conflict: ['Conflict', 'shield', 'warn'], gap: ['Gap', 'search', 'blue'], stale: ['Stale', 'clock', 'warn'], feedback: ['Feedback', 'chat', ''] };

const st = () => { const S = B.S; S.inbox = S.inbox || { done: {}, filter: 'all' }; return S.inbox; };
const isDone = (i) => st().done[i.id] || (i.ref && !['pending', 'needs_review'].includes(shareSt()[i.ref] || 'pending'));
const open = () => ITEMS.filter((i) => !isDone(i)).length;
window.INBOX = { open, ITEMS };

function inbox() {
  const s = st(); const left = ITEMS.filter((i) => !isDone(i));
  const shown = left.filter((i) => s.filter === 'all' || i.kind === s.filter);
  const chips = [['all', 'All'], ['request', 'Requests'], ['conflict', 'Conflicts'], ['gap', 'Gaps'], ['stale', 'Stale'], ['feedback', 'Feedback']]
    .map(([k, l]) => `<button type="button" class="ixchip ${s.filter === k ? 'on' : ''}" data-f="${k}">${l}<em>${k === 'all' ? left.length : left.filter((i) => i.kind === k).length}</em></button>`).join('');
  const rows = shown.map((i) => { const [lab, ic, tone] = KIND[i.kind];
    return `<article class="ixrow" data-id="${i.id}"><span class="ixic ${tone}">${ICON(ic, 18)}</span><div class="ixb"><div class="ixt"><b>${esc(i.title)}</b><span class="tag ${tone}">${lab}</span></div><p>${esc(i.meta)}</p><div class="ixm">${i.src.map((x) => window.SRCICON(x, 14)).join('')}<span>${esc(i.who)}</span><i></i><span>${i.hits} ${i.hits === 1 ? 'question' : 'questions'}</span><i></i><span>${esc(i.age)}</span></div></div><div class="ixa"><button type="button" class="btn sm primary" data-do="${i.id}">${esc(i.act)}</button><button type="button" class="btn sm" data-snooze="${i.id}">Later</button></div></article>`; }).join('');
  $('#app').className = '';
  $('#app').innerHTML = `<div class="pg ixpg"><h1>Inbox</h1><div class="ixchips" role="tablist">${chips}</div><div class="ixlist">${rows || `<div class="ixempty"><span class="ixok">${ICON('check', 22)}</span><b>All caught up</b><p>New reports from your team show up here.</p></div>`}</div></div>`;
  $$('[data-f]').forEach((b) => { b.onclick = () => { s.filter = b.dataset.f; B.save(); inbox(); }; });
  const resolve = (id, msg) => { const row = $(`.ixrow[data-id="${id}"]`); s.done[id] = true; B.save(); const fin = () => { B.renderSurfaces(); inbox(); B.toast(msg); };
    if (row && row.animate && !matchMedia('(prefers-reduced-motion: reduce)').matches) { row.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(24px)' }], { duration: 220, easing: 'ease-in' }).finished.then(fin).catch(fin); } else fin(); };
  $$('[data-do]').forEach((b) => { b.onclick = () => { const i = ITEMS.find((x) => x.id === b.dataset.do); if (i.kind === 'request') { B.S.surface = 'account'; B.S.acctTab = 'Sharing'; B.save(); B.route(); window.scrollTo(0, 0); return; } resolve(i.id, i.kind === 'conflict' ? 'Marked fixed. The owner was told.' : i.kind === 'gap' ? 'Owner assigned.' : i.kind === 'stale' ? 'Verified today.' : 'Answer reviewed.'); }; });
  $$('[data-snooze]').forEach((b) => { b.onclick = () => resolve(b.dataset.snooze, 'Snoozed for a week'); });
}

const SAVED0 = [
  { id: 'v1', q: 'What is the card replacement fee?', a: '$5.00 per Fee Schedule 2026. The Cards FAQ still says $7.50, and the owner has been told.', src: ['Confluence', 'Google Drive'], st: 'current', when: 'Nov 9' },
  { id: 'v2', q: 'What is the daily transfer limit?', a: '$10,000 for personal accounts and $50,000 for business accounts.', src: ['Confluence'], st: 'current', when: 'Nov 6' },
  { id: 'v3', q: 'What is the savings interest rate?', a: '3.4% AER at the last review. The Savings Rate Sheet was updated on 9 Nov.', src: ['Google Drive'], st: 'changed', when: 'Nov 2' },
  { id: 'v4', q: 'How do I request access to a source?', a: 'Open the document in the Library and choose Request access. The owner is told straight away.', src: ['Notion'], st: 'current', when: 'Oct 28' },
  { id: 'v5', q: 'Who approves public sharing?', a: 'Admins. A request goes to Sharing requests first, then to the owner.', src: ['Confluence'], st: 'changed', when: 'Oct 21' }
];
const savedSt = () => { const S = B.S; S.savedAns = S.savedAns || { gone: {}, mine: [] }; return S.savedAns; };
window.SAVED = {
  list: () => { const s = savedSt(); return s.mine.concat(SAVED0.filter((x) => !s.gone[x.id])); },
  add: (q, a, src) => { const s = savedSt(); if (s.mine.some((x) => x.q === q)) return false; s.mine.unshift({ id: 'm' + Date.now(), q, a, src: src || [], st: 'current', when: 'Today' }); B.save(); return true; },
  has: (q) => savedSt().mine.some((x) => x.q === q),
  drop: (q) => { const s = savedSt(); s.mine = s.mine.filter((x) => x.q !== q); B.save(); }
};

function saved() {
  const s = savedSt(); const L = window.SAVED.list();
  const rows = L.map((x) => `<div class="ds-tr lift svcols" data-ask="${esc(x.q)}" role="row" tabindex="0"><span class="ltb"><b>${esc(x.q)}</b><small>${esc(x.a)}</small></span><span class="svsrc">${x.src.map((n) => window.SRCICON(n, 18)).join('')}</span><span>${x.st === 'changed' ? '<span class="tag warn">Changed</span>' : '<span class="tag ok">Current</span>'}</span><span class="amute">${esc(x.when)}</span><span class="svx"><button type="button" class="btn sm" data-unsave="${x.id}" aria-label="Remove bookmark">${ICON('x', 14)}</button></span></div>`).join('');
  $('#app').className = '';
  $('#app').innerHTML = `<div class="pg ixpg"><h1>Bookmarks</h1>${L.length ? `<div class="ds-table libt" role="table"><div class="ds-tr ds-th svcols" role="row"><span>Answer</span><span>Sources</span><span>Status</span><span>Added</span><span></span></div>${rows}</div>` : `<div class="ixempty"><span class="ixok">${ICON('bookmark', 22)}</span><b>No bookmarks yet</b><p>Bookmark an answer in chat and it is kept here. Broth tells you if it changes.</p></div>`}</div>`;
  $$('[data-ask]').forEach((r) => {
    const go = () => { B.S.surface = 'app'; B.S.thread = []; B.save(); B.route(); setTimeout(() => B.ask && B.ask(r.dataset.ask), 350); };
    r.onclick = (e) => { if (e.target.closest('[data-unsave]')) return; go(); };
    r.onkeydown = (e) => { if (e.key === 'Enter') go(); };
  });
  $$('[data-unsave]').forEach((b) => { b.onclick = () => { const id = b.dataset.unsave; if (id[0] === 'm') s.mine = s.mine.filter((x) => x.id !== id); else s.gone[id] = true; B.save(); saved(); B.toast('Removed from bookmarks'); }; });
}

window.SURFACES.inbox = inbox;
window.SURFACES.saved = saved;
window.SURFACES.insights = saved;
})();
