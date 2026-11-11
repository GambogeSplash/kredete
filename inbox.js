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

function insights() {
  const stats = [['Questions answered', '124', '+18% this week', [4, 6, 5, 8, 7, 9, 12]], ['Answered with sources', '91%', 'up from 86%', [7, 7, 8, 8, 9, 9, 9]], ['Open conflicts', String(ITEMS.filter((i) => i.kind === 'conflict' && !st().done[i.id]).length), 'across 2 documents', [3, 2, 3, 2, 2, 1, 1]], ['Knowledge gaps', '5', '3 new this week', [1, 2, 2, 3, 3, 4, 5]]];
  const gaps = [['Crypto custody for business accounts', 9], ['Student account eligibility', 7], ['Chargeback time limits', 5], ['Overdraft fee waivers', 4], ['Joint account closure', 3]];
  const attn = [['Transfer Limits Policy', 'Confluence', 'Stale, 150 days', 'Priya Nair'], ['Cards FAQ (internal)', 'Google Drive', 'Conflicts with Fee Schedule', 'Daniel Reyes'], ['Savings Rate Sheet', 'Google Drive', 'Past review date', 'Tomas Berg']];
  const max = gaps[0][1];
  const bars = (a) => `<span class="ixspark">${a.map((v) => `<i style="height:${Math.round(v / Math.max(...a) * 100)}%"></i>`).join('')}</span>`;
  $('#app').className = '';
  $('#app').innerHTML = `<div class="pg ixpg"><h1>Insights</h1>
   <div class="ixstats">${stats.map(([l, v, d, a]) => `<div class="ixstat"><small>${l}</small><b>${v}</b><span>${d}</span>${bars(a)}</div>`).join('')}</div>
   <section class="ixsec"><h2>Most asked, no good source</h2>${gaps.map(([q, n]) => `<div class="ixgap"><span>${esc(q)}</span><span class="ixbar"><i style="width:${Math.round(n / max * 100)}%"></i></span><em>${n}</em><button type="button" class="btn sm" data-mk="${esc(q)}">Create source</button></div>`).join('')}</section>
   <section class="ixsec"><h2>Needs attention</h2>${attn.map(([d, sys, why, o]) => `<div class="ixdoc">${window.SRCICON(sys, 22)}<div><b>${esc(d)}</b><small>${esc(why)}</small></div><span class="ixown">${window.AVATAR(o, 'lav', 22)}${esc(o)}</span><button type="button" class="btn sm" data-ver="${esc(d)}">Ask owner</button></div>`).join('')}</section>
   <section class="ixsec"><h2>Answer quality</h2><div class="ixq"><div><b>87%</b><small>marked helpful</small></div><span class="ixbar big"><i style="width:87%"></i></span><div class="ixr"><span>Wrong or outdated <em>8</em></span><span>Missing detail <em>5</em></span><span>Hard to read <em>2</em></span></div></div></section></div>`;
  $$('[data-mk]').forEach((b) => { b.onclick = () => { b.disabled = true; b.textContent = 'Task created'; B.toast('Task created for the owner'); }; });
  $$('[data-ver]').forEach((b) => { b.onclick = () => { b.disabled = true; b.textContent = 'Owner asked'; B.toast('Owner notified'); }; });
}

window.SURFACES.inbox = inbox;
window.SURFACES.insights = insights;
})();
