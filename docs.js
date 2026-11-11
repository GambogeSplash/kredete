/* Docs and support: a small help centre. Search, six topics, short articles, and a way to reach a person. */
(() => {
const B = window.BRAIN; if (!B) return;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const ICON = (n, s) => window.ICON(n, s);

const TOPICS = [
  { id: 'start', icon: 'compose', title: 'Getting started', blurb: 'Your first question, and what to expect.' },
  { id: 'ask', icon: 'search', title: 'Asking questions', blurb: 'Better questions, better answers.' },
  { id: 'sources', icon: 'grid', title: 'Sources and connectors', blurb: 'What Broth reads, and how it stays current.' },
  { id: 'owners', icon: 'inbox', title: 'Owners and conflicts', blurb: 'Fixing what Broth finds wrong.' },
  { id: 'admin', icon: 'settings', title: 'Admin', blurb: 'People, policies, and the audit log.' },
  { id: 'trust', icon: 'shield', title: 'Privacy and security', blurb: 'Who can see what.' }
];
const ARTICLES = [
  { id: 'a1', t: 'start', title: 'Ask your first question', steps: ['Open New chat from the rail on the left.', 'Type a question the way you would ask a colleague.', 'Read the answer, then open the sources it cites.', 'If something looks wrong, tell Broth with the thumbs-down.'] },
  { id: 'a2', t: 'start', title: 'What Broth can and cannot do', steps: ['Broth answers from documents you already have access to.', 'It cites every source and shows when they disagree.', 'It does not give personal advice or guess when no source fits.', 'When it cannot find an answer, it tells you who probably owns the topic.'] },
  { id: 'a3', t: 'start', title: 'Find your way around', steps: ['The rail on the left has New chat, Search, Library, Inbox, Insights and Connectors.', 'Your account, admin settings and these docs are in the menu at the bottom.', 'The Broth card on the right shows what it did today, your sources, and what it remembers.'] },
  { id: 'a4', t: 'ask', title: 'Write questions that get good answers', steps: ['Name the thing: "card replacement fee" beats "how much".', 'Add the audience when it matters: "for business accounts".', 'Ask one thing at a time, then follow up.', 'Use Choose what to ask in the card to limit which sources are used.'] },
  { id: 'a5', t: 'ask', title: 'Read an answer and its sources', steps: ['Each claim has a number that matches a source in the card.', 'Open a source to see the quote and its owner.', 'A "Recommended" tag means it is the most recent and authoritative one.'] },
  { id: 'a6', t: 'ask', title: 'Use the search palette', steps: ['Press ⌘K anywhere.', 'Type to search chats and documents, or press Enter to ask Broth.', 'Use the arrow keys to move and Enter to open.'] },
  { id: 'a7', t: 'sources', title: 'Connect a source', steps: ['Open Connectors from the rail.', 'Choose Confluence, Google Drive or Notion.', 'Sign in and approve read access.', 'Broth syncs your pages and shows the first results in a few minutes.'] },
  { id: 'a8', t: 'sources', title: 'Why an answer is out of date', steps: ['Broth reads what was in the source at the last sync.', 'Check the sync time under Sources in the card.', 'If the document changed, ask the owner to verify it, or sync again.'] },
  { id: 'a9', t: 'sources', title: 'What Broth reads from each source', steps: ['Only documents you can already open there.', 'Private files stay private, and permissions are checked on every question.', 'Disconnecting a source removes its documents from answers straight away.'] },
  { id: 'a10', t: 'owners', title: 'Report a conflict to the owner', steps: ['When two sources disagree, Broth shows both.', 'Choose Report to owner and Broth sends the details.', 'The owner sees it in their Inbox and can mark it fixed.'] },
  { id: 'a11', t: 'owners', title: 'Work through your Inbox', steps: ['Open Inbox from the rail. The badge counts open items.', 'Filter by Conflicts, Gaps, Stale or Feedback.', 'Choose the main action on a card, or Later to snooze it a week.'] },
  { id: 'a12', t: 'owners', title: 'Keep documents verified', steps: ['Open Insights and look at Needs attention.', 'Review the document, then choose Verify now in your Inbox.', 'Verified documents move to the top of answers.'] },
  { id: 'a13', t: 'admin', title: 'Invite people and set roles', steps: ['Open the account menu, then Admin settings.', 'Choose People and access, then Invite people.', 'Pick a role: Employee, Content owner, or Admin.'] },
  { id: 'a14', t: 'admin', title: 'Set policies', steps: ['Open Admin settings, then Policies.', 'Turn on verified-only answers, conflict visibility, or approval before reporting.', 'Changes apply to everyone straight away.'] },
  { id: 'a15', t: 'admin', title: 'Read the audit log', steps: ['Open Admin settings, then Audit log.', 'Every question, source use, verification and access change is listed.', 'Use Export CSV to send it to your compliance team.'] },
  { id: 'a16', t: 'trust', title: 'Who can see my questions', steps: ['Only you can see your chats.', 'Admins can see an audit entry that a question was asked, not the answer you read.', 'Retention defaults to 90 days and admins can change it.'] },
  { id: 'a17', t: 'trust', title: 'How access levels work', steps: ['Each document has a level: General, Internal, Confidential or Restricted.', 'Broth only uses documents at or below your level.', 'Your level comes from your work account and cannot be changed in Broth.'] },
  { id: 'a18', t: 'trust', title: 'What Broth remembers about you', steps: ['Open the Memory tab in the Broth card.', 'You will see your preferred name, team, access level and recent topics.', 'Choose Forget to remove anything. It is removed for good.'] }
];

const st = () => { const S = B.S; S.doc = S.doc || { q: '', open: null }; return S.doc; };

function docs() {
  const s = st();
  const q = (s.q || '').toLowerCase().trim();
  $('#app').className = '';
  if (s.open) {
    const a = ARTICLES.find((x) => x.id === s.open); const t = TOPICS.find((x) => x.id === a.t);
    const more = ARTICLES.filter((x) => x.t === a.t && x.id !== a.id);
    $('#app').innerHTML = `<div class="pg dcpg"><button type="button" class="link dcback" id="dcb">← Docs and support</button><div class="dcmeta">${esc(t.title)}</div><h1>${esc(a.title)}</h1><ol class="dcsteps">${a.steps.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
      <div class="dchelp"><span>Was this helpful?</span><button type="button" class="btn sm" data-h="y">Yes</button><button type="button" class="btn sm" data-h="n">No</button></div>
      ${more.length ? `<h2 class="dch2">More in ${esc(t.title)}</h2><div class="dclist">${more.map((x) => `<button type="button" class="dcrow" data-a="${x.id}">${esc(x.title)}<span>${ICON('chevr', 14)}</span></button>`).join('')}</div>` : ''}</div>`;
    $('#dcb').onclick = () => { s.open = null; B.save(); docs(); };
    $$('[data-a]').forEach((b) => { b.onclick = () => { s.open = b.dataset.a; B.save(); docs(); window.scrollTo(0, 0); }; });
    $$('[data-h]').forEach((b) => { b.onclick = () => { $('.dchelp').innerHTML = '<span>Thanks. That helps us improve this page.</span>'; }; });
    return;
  }
  const hits = q ? ARTICLES.filter((a) => (a.title + ' ' + a.steps.join(' ')).toLowerCase().includes(q)) : [];
  const body = q
    ? `<div class="dclist">${hits.length ? hits.map((a) => `<button type="button" class="dcrow" data-a="${a.id}">${esc(a.title)}<small>${esc(TOPICS.find((t) => t.id === a.t).title)}</small><span>${ICON('chevr', 14)}</span></button>`).join('') : `<div class="dcnone"><b>No articles match</b><p>Try fewer words, or ask us below.</p></div>`}</div>`
    : `<div class="dcgrid">${TOPICS.map((t) => `<section class="dccard"><span class="dcic">${ICON(t.icon, 18)}</span><h3>${esc(t.title)}</h3><p>${esc(t.blurb)}</p>${ARTICLES.filter((a) => a.t === t.id).map((a) => `<button type="button" class="dclink" data-a="${a.id}">${esc(a.title)}</button>`).join('')}</section>`).join('')}</div>`;
  $('#app').innerHTML = `<div class="pg dcpg"><h1>Docs and support</h1><div class="dcsearch"><span>${ICON('search', 16)}</span><input id="dcq" type="search" placeholder="Search the docs" aria-label="Search the docs" value="${esc(s.q || '')}" autocomplete="off"></div>${body}
    <div class="dcsupport"><div><b>Still stuck?</b><p>Ask Broth about Broth, or write to a person. We reply within one working day.</p></div><div class="dcbtns"><button type="button" class="btn primary" id="dcask">Ask Broth</button><a class="btn" href="mailto:support@broth.app">Email support</a></div></div>
    <p class="dcstat"><i></i>All systems normal</p></div>`;
  const inp = $('#dcq'); if (s.q) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
  inp.oninput = () => { s.q = inp.value; B.save(); docs(); };
  $$('[data-a]').forEach((b) => { b.onclick = () => { s.open = b.dataset.a; B.save(); docs(); window.scrollTo(0, 0); }; });
  $('#dcask').onclick = () => { B.S.surface = 'app'; B.S.thread = []; B.save(); B.route(); setTimeout(() => B.ask && B.ask('How do I connect a source?'), 350); };
}

window.SURFACES.docs = docs;
})();
