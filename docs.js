/* Help center: a small help centre. Search, six topics, short articles, and a way to reach a person. */
(() => {
const B = window.BRAIN; if (!B) return;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const ICON = (n, s) => window.ICON(n, s);

const TOPICS = [
  { id: 'start', hue: ['#8b95f0', '#5e6ad2'], icon: 'compose', title: 'Getting started', blurb: 'Your first question, and what to expect.' },
  { id: 'ask', hue: ['#f08bb8', '#d9468a'], icon: 'search', title: 'Asking questions', blurb: 'Better questions, better answers.' },
  { id: 'sources', hue: ['#5fd3c4', '#13a899'], icon: 'grid', title: 'Sources and connectors', blurb: 'What Broth reads, and how it stays current.' },
  { id: 'owners', hue: ['#ffc46b', '#f08a1c'], icon: 'inbox', title: 'Owners and conflicts', blurb: 'Fixing what Broth finds wrong.' },
  { id: 'admin', hue: ['#b58cf2', '#7c4ddb'], icon: 'settings', title: 'Admin', blurb: 'People, policies, and the audit log.' },
  { id: 'trust', hue: ['#7ad28a', '#2f9e55'], icon: 'shield', title: 'Privacy and security', blurb: 'Who can see what.' }
];
const ARTICLES = [
  /* Getting started */
  { id: 'a1', t: 'start', title: 'Ask your first question', sum: 'Broth answers from the documents you already have access to, and shows where each answer came from.', steps: [['Open New chat', 'Choose the pencil icon at the top of the rail, or press the New chat shortcut.'], ['Type it like you would to a colleague', '"What is the daily transfer limit?" works better than keywords.'], ['Read the answer, then the sources', 'Each claim carries a number that matches a source in the card on the right.'], ['Tell Broth if it is wrong', 'Use the thumbs-down under the answer and pick a reason. The owner is told.']], tip: 'You do not need to name the system. Broth searches every source you are allowed to read.', fix: 'If you get "no source fits", the topic probably has no document yet. Broth will name who likely owns it, and you can ask them to write one.', go: ['Start a chat', 'app'], rel: ['a4', 'a5', 'a2'] },
  { id: 'a2', t: 'start', title: 'What Broth can and cannot do', sum: 'Broth is built to answer, cite and flag. It is not built to guess or to give personal advice.', steps: [['It answers from your documents', 'Only sources you can open are used, and permissions are checked on every question.'], ['It cites every answer', 'You can open any source to see the exact passage and its owner.'], ['It shows disagreement', 'When two documents give different answers, Broth shows both and recommends the most recent, authoritative one.'], ['It stays in its lane', 'It declines personal financial advice and will not make things up when no source fits.']], tip: 'Treat a "Recommended" tag as a pointer, not a ruling. The owner has the final say.', go: ['Read about privacy', 'docs-trust'], rel: ['a16', 'a10'] },
  { id: 'a3', t: 'start', title: 'Find your way around', sum: 'Five places, all one click from the rail on the left.', steps: [['New chat and Search', 'Start a conversation, or press the search shortcut to jump to any chat or document.'], ['Library', 'Browse everything Broth can read, by source and folder.'], ['Inbox', 'Conflicts, gaps and requests waiting for an owner. The badge counts what is open.'], ['Bookmarks', 'Answers you kept, with a warning if a source changed since.'], ['Your account', 'Bottom of the rail: account settings, admin settings, the support agent and this help center.']], tip: 'The chat history panel only appears on chat pages, so other pages get the full width.', rel: ['a19', 'a6'] },
  { id: 'a19', t: 'start', title: 'Read the Broth card', sum: 'The card beside your chat shows what Broth did, which sources it used and what it remembers.', steps: [['Activity', 'A feed of what Broth did today: questions answered, sources synced, conflicts found.'], ['Answer', 'The sources behind the current answer, with the quote and who owns each one.'], ['Sources', 'What is connected, and the filters that limit which sources are used.'], ['Memory', 'Your name, team and access level, and recent topics. Forget anything you do not want kept.']], tip: 'Close the card with the cross in its corner to give the chat more room. It comes back when a new answer has sources.', rel: ['a18', 'a5'] },
  { id: 'a20', t: 'start', title: 'Set up your profile', sum: 'Your name and avatar are how teammates and owners see you.', steps: [['Open your account', 'Choose the avatar at the bottom of the rail, then Account settings.'], ['Change your avatar', 'Pick one from the library or upload a photo. Photos are cropped to a rounded square.'], ['Set a preferred name', 'Broth uses it when it greets you. Your work name stays unchanged elsewhere.'], ['Choose your appearance', 'Light, dark, or match your device. Dark is the default.']], go: ['Open Profile', 'account', 'Profile'], rel: ['a30', 'a31'] },

  /* Asking questions */
  { id: 'a4', t: 'ask', title: 'Write questions that get good answers', sum: 'A specific question gets a specific answer. A vague one gets a careful maybe.', steps: [['Name the thing', '"Card replacement fee" beats "how much does it cost".'], ['Add the audience when it matters', '"For business accounts" stops Broth picking the personal-account rule.'], ['Ask one thing at a time', 'Then use follow-ups. Long questions with three parts blur the sources.'], ['Narrow the sources if you need to', 'Choose what to ask in the card to limit the search to a source, domain or date.']], tip: 'If an answer feels general, add a number or a name from the document you expect to see.', fix: 'Still vague? Open the sources and check the document is current. A stale source gives a stale answer.', rel: ['a21', 'a5', 'a8'] },
  { id: 'a5', t: 'ask', title: 'Read an answer and its sources', sum: 'Every answer is built so you can check it in two clicks.', steps: [['Find the number', 'Each claim has a small number that matches a source in the card.'], ['Open the source', 'You see the quote, its owner, when it was verified and the approval status.'], ['Check the tag', '"Approved" means reviewed and current. "Past review date" means the owner has not confirmed it lately.'], ['See why it was picked', 'Choose How I answered under the reply to see the steps Broth took.']], tip: '"Recommended" marks the most recent authoritative source when two disagree.', fix: 'If the quote does not support the claim, thumbs-down it and choose Wrong. That goes to the owner.', rel: ['a10', 'a8'] },
  { id: 'a6', t: 'ask', title: 'Use the search palette', sum: 'Jump to any chat or document without leaving the keyboard.', steps: [['Open it', 'Press the search shortcut anywhere in the app.'], ['Type', 'Results are grouped into chats and documents as you type.'], ['Move and open', 'Use the arrow keys and Enter. Escape closes it.'], ['Or ask', 'If nothing fits, press Enter on the question itself and Broth answers it.']], tip: 'The palette respects your access: you will never see a document you cannot open.', rel: ['a3', 'a24'] },
  { id: 'a21', t: 'ask', title: 'Follow up on an answer', sum: 'Ask the next question in the same chat so Broth keeps the context.', steps: [['Use the suggested follow-ups', 'Broth offers the questions people usually ask next, like "Who owns this?"'], ['Or type your own', 'It understands "and for business accounts?" as a follow-up.'], ['Start fresh when the topic changes', 'A new chat keeps unrelated sources out of the answer.']], tip: 'Ask "When was this last verified?" to see how current the source is.', rel: ['a4', 'a22'] },
  { id: 'a22', t: 'ask', title: 'Bookmark an answer', sum: 'Keep the answers you rely on, and be told if a source behind one changes.', steps: [['Bookmark it', 'Choose the bookmark icon under any answer.'], ['Find it later', 'Open Bookmarks in the rail. Each one shows its sources and a Current or Changed tag.'], ['Reopen it', 'Choose a bookmark to ask the same question again with the latest sources.']], tip: '"Changed" means a document behind the answer was updated after you saved it. Ask again before you rely on it.', go: ['Open Bookmarks', 'saved'], rel: ['a8', 'a5'] },

  /* Sources and connectors */
  { id: 'a7', t: 'sources', title: 'Connect a source', sum: 'Admins connect Confluence, Google Drive and Notion. Broth reads only what each person can already open.', steps: [['Open Sources', 'Account menu, Admin settings, then Sources.'], ['Choose Add a source', 'Pick Confluence, Google Drive or Notion from the list.'], ['Review what Broth can do', 'It can search and read. It never creates, edits, comments or deletes.'], ['Sign in and approve', 'You are sent to the provider to approve read access, then returned to Broth.']], tip: 'Notion lets you choose which pages to share, so start with a small set.', fix: 'If the sign-in fails, check you are an admin and that your provider account has access to the content you want to share.', go: ['Open Sources', 'account', 'Sources'], rel: ['a9', 'a23'] },
  { id: 'a8', t: 'sources', title: 'Why an answer is out of date', sum: 'Broth reads what was in the source at its last sync, so a change made minutes ago may not be there yet.', steps: [['Check the sync time', 'Open the card, then Sources, and look at the time under each one.'], ['Ask the owner to verify', 'Report the answer or use Ask owner in the Inbox. They confirm or update it.'], ['Sync again', 'Admins can use Sync now on a source. Syncs also run every 30 minutes.']], tip: 'A document marked "Past review date" is the usual cause. It still answers, but Broth warns you.', rel: ['a23', 'a12'] },
  { id: 'a9', t: 'sources', title: 'What Broth reads from each source', sum: 'Permissions are checked on every question, not once at connection.', steps: [['Only what you can open', 'Private files stay private. Another person never sees them through Broth.'], ['Read-only', 'Broth searches and reads. It has no way to change your documents.'], ['Disconnecting removes it', 'When a source is disconnected, its documents leave every answer straight away.']], tip: 'If a colleague loses access to a document, Broth stops using it for them on the next question.', rel: ['a17', 'a7'] },
  { id: 'a23', t: 'sources', title: 'Sync a source', sum: 'Pull the latest changes in without waiting for the schedule.', steps: [['Open Sources', 'Under Admin settings.'], ['Choose Sync now', 'It shows a spinner and updates the sync time when done.'], ['Check the result', 'Changed documents show up in Activity, and anything out of date is flagged to its owner.']], go: ['Open Sources', 'account', 'Sources'], rel: ['a8', 'a7'] },
  { id: 'a24', t: 'sources', title: 'Browse the Library', sum: 'Everything Broth can read, organised the way your teams keep it.', steps: [['Open Library', 'Choose the book icon in the rail.'], ['Switch the view', 'List shows a table per source. Grid shows folders as cards.'], ['Open a folder or a file', 'A file opens in a panel on the right with its text, owner and a link to the original.'], ['Filter', 'Use the filter button to show one source, or search by title, path or owner.']], tip: 'Folders mirror your sources, so a tidy source gives a tidy Library.', go: ['Open Library', 'library'], rel: ['a6', 'a25'] },

  /* Owners and conflicts */
  { id: 'a10', t: 'owners', title: 'Report a conflict to the owner', sum: 'When two documents disagree, one report fixes it for everyone.', steps: [['Look at the answer', 'Broth shows both values and which one it recommends.'], ['Choose Report to owner', 'Broth sends the two quotes, the question and who asked.'], ['Approve if asked', 'If your admin requires approval first, you will see Approve or Skip in the card.'], ['Follow it up', 'The owner sees it in their Inbox and marks it fixed. You are told when it is.']], tip: 'You do not need to find the owner. Broth routes it to the right person.', fix: 'If nothing happens, check the Inbox tab on your side. The report appears as a Conflict item.', go: ['Open Inbox', 'inbox'], rel: ['a11', 'a12'] },
  { id: 'a11', t: 'owners', title: 'Work through your Inbox', sum: 'The Inbox holds what needs a person: conflicts, gaps, stale documents and requests.', steps: [['Open Inbox', 'The badge on the rail icon counts what is open.'], ['Filter by type', 'Requests, Conflicts, Gaps, Stale or Feedback.'], ['Take the main action', 'Each card has one primary action, like Mark fixed or Verify now.'], ['Snooze what can wait', 'Later hides an item for a week.']], tip: 'Items resolve in place, and the count on the rail updates as you go.', go: ['Open Inbox', 'inbox'], rel: ['a12', 'a26'] },
  { id: 'a12', t: 'owners', title: 'Keep documents verified', sum: 'Verified documents move to the top of answers and earn the Approved tag.', steps: [['Look for Stale items', 'Documents past their review date appear in your Inbox.'], ['Review the document', 'Open it from the item and check it is still correct.'], ['Choose Verify now', 'It is stamped with today\'s date and your name.'], ['Edit at the source', 'If it needs changing, fix it in Confluence, Drive or Notion first, then verify.']], tip: 'Verifying is a promise that the content is right, so only verify what you have read.', rel: ['a8', 'a11'] },
  { id: 'a25', t: 'owners', title: 'Request access to a document', sum: 'If a document is above your access level, you can ask the owner to open it for you.', steps: [['Find the locked document', 'It shows in the Library with a lock.'], ['Choose Request access', 'You can add a short reason.'], ['Wait for the owner', 'They approve or decline from their Inbox. You get a message when they do.']], tip: 'Access levels are General, Internal, Confidential and Restricted. Yours comes from your work account.', rel: ['a17', 'a26'] },
  { id: 'a26', t: 'owners', title: 'Approve a sharing request', sum: 'Owners and admins decide when a document is shared more widely.', steps: [['Open the request', 'It appears in your Inbox as a Request, and in Admin settings under Sharing requests.'], ['Read what is asked', 'You see the document, the scope (internal or public), who asked and why.'], ['Approve or reject', 'You cannot approve your own request. A rejected request tells the person why.'], ['Revoke later if the plan changes', 'Approved items can be withdrawn from the same page.']], go: ['Open Sharing requests', 'account', 'Sharing'], rel: ['a11', 'a14'] },

  /* Admin */
  { id: 'a13', t: 'admin', title: 'Invite people and set roles', sum: 'Roles decide who can verify content, own a domain or change settings.', steps: [['Open People and access', 'Account menu, Admin settings.'], ['Invite people', 'Enter work email addresses, separated by commas. They show as Pending until they join.'], ['Pick a role', 'Employee, Content owner, or Admin. People who sign in from a verified domain join as the role you set for it.'], ['Resend or cancel', 'Pending invites have Resend and Cancel on their row.']], tip: 'Give Admin sparingly. Content owner is usually what a team lead needs.', go: ['Open People and access', 'account', 'People'], rel: ['a27', 'a14'] },
  { id: 'a14', t: 'admin', title: 'Set policies', sum: 'Policies apply to everyone straight away.', steps: [['Open Policies', 'Admin settings, then Policies.'], ['Turn on what you need', 'Verified-only answers, conflict visibility, approval before reporting, approval before public sharing, declining financial advice, hiding personal data.'], ['Check the effect', 'Each policy changes what people see the next time they ask.']], tip: 'Start with approval before reporting while your teams get used to Broth.', go: ['Open Policies', 'account', 'Policies'], rel: ['a15', 'a26'] },
  { id: 'a15', t: 'admin', title: 'Read the audit log', sum: 'A record of every question, source use, verification and access change.', steps: [['Open Audit log', 'Admin settings, then Audit log.'], ['Filter', 'Use the filter button for type, action and a date range.'], ['Read a row', 'Timestamp, event, actor, resource and outcome.'], ['Export', 'Export CSV sends the filtered rows to your compliance team.']], tip: 'The log shows that a question was asked and which sources were used, not the answer the person read.', go: ['Open Audit log', 'account', 'Audit'], rel: ['a16', 'a14'] },
  { id: 'a27', t: 'admin', title: 'Add and verify a domain', sum: 'Verified domains decide who can sign in and which role they get.', steps: [['Open Domains', 'Admin settings, then Domains.'], ['Choose Add a domain', 'Enter your company domain, like company.com. Personal email domains are not allowed.'], ['Add the DNS record', 'Copy the TXT value and add it at your DNS provider.'], ['Verify', 'DNS can take up to an hour. Choose Try again if it is not found yet.'], ['Set the default role', 'Open the domain to choose what new people join as.']], fix: 'If it will not verify, check the TXT record was added to the exact domain, without extra spaces.', go: ['Open Domains', 'account', 'Domains'], rel: ['a13', 'a15'] },
  { id: 'a28', t: 'admin', title: 'Remove someone', sum: 'Removing a person ends their access straight away.', steps: [['Open People and access', 'Find the person in the table.'], ['Choose Remove', 'You are asked to confirm, since it cannot be undone from here.'], ['Check the audit log', 'The change is recorded with your name.']], tip: 'Removing a domain also stops new sign-ins from it. Existing people are listed first so nobody is locked out by surprise.', go: ['Open People and access', 'account', 'People'], rel: ['a13', 'a15'] },

  /* Privacy and security */
  { id: 'a16', t: 'trust', title: 'Who can see my questions', sum: 'Your chats are yours. Admins see that something was asked, not what you read.', steps: [['Your chats are private', 'Only you can open them.'], ['Admins see an audit entry', 'It records that a question was asked and which sources were used.'], ['Retention is 90 days', 'Admins can change it. Older chats are removed.']], tip: 'You can delete your own history any time from Account settings.', go: ['Open Profile', 'account', 'Profile'], rel: ['a31', 'a15'] },
  { id: 'a17', t: 'trust', title: 'How access levels work', sum: 'Four levels, set by your work account, that decide which documents Broth may use for you.', steps: [['Each document has a level', 'General, Internal, Confidential or Restricted.'], ['Broth uses your level and below', 'A Confidential reader sees General, Internal and Confidential.'], ['You cannot change your own level', 'It comes from your work account. Ask IT, or request access to one document.']], tip: 'If an answer seems to ignore a document, it is probably above your level.', rel: ['a25', 'a9'] },
  { id: 'a18', t: 'trust', title: 'What Broth remembers about you', sum: 'A short list you can read and edit.', steps: [['Open the Memory tab', 'In the Broth card on the right.'], ['Read it', 'Your preferred name, team, access level and recent topics.'], ['Forget anything', 'Choose Forget and it is removed for good.']], rel: ['a19', 'a31'] },
  { id: 'a30', t: 'trust', title: 'Sign-in and devices', sum: 'See where you are signed in, and end a session you do not recognise.', steps: [['Open Sessions', 'Account settings, then Sessions.'], ['Read the table', 'Each device shows where, when it was first and last seen, and whether it is trusted.'], ['Sign one out', 'Choose Sign out on a device you do not recognise. A new location is flagged for you.'], ['Sign out everywhere else', 'One button ends every session except this one.']], tip: 'Sign-in and two-step verification are managed by your IT team.', go: ['Open Sessions', 'account', 'Sessions'], rel: ['a16', 'a31'] },
  { id: 'a31', t: 'trust', title: 'Download or delete your data', sum: 'You control your own history.', steps: [['Open Profile', 'Account settings, then Profile.'], ['Download my data', 'Gets a file with your profile and your questions.'], ['Delete my question history', 'Asks you to confirm, then removes it. Audit entries stay with your admins.']], go: ['Open Profile', 'account', 'Profile'], rel: ['a16', 'a18'] }
];


const st = () => { const S = B.S; S.doc = S.doc || { q: '', open: null }; return S.doc; };


/* One step from the card to the answer: the topic's articles sit in a list on the left, the article is already open on the right. */
const artHtml = (a, t) => {
  const rel = (a.rel || []).map((id) => ARTICLES.find((x) => x.id === id)).filter(Boolean);
  const go = a.go ? `<button type="button" class="btn primary dcgo" data-go="${esc(a.go[1])}" data-tab="${esc(a.go[2] || '')}">${esc(a.go[0])}</button>` : '';
  return `<div class="dcmeta">${esc(t.title)}</div><h1>${esc(a.title)}</h1><p class="dcsum">${esc(a.sum)}</p>
  <ol class="dcsteps">${a.steps.map((x) => `<li><b>${esc(x[0])}</b><span>${esc(x[1])}</span></li>`).join('')}</ol>
  ${a.tip ? `<div class="dctip"><i>${ICON('bulb', 16)}</i><div><b>Tip</b><p>${esc(a.tip)}</p></div></div>` : ''}
  ${a.fix ? `<div class="dcfix"><h3>If this does not work</h3><p>${esc(a.fix)}</p></div>` : ''}
  ${go}
  ${rel.length ? `<h3 class="dch3">Related</h3><div class="dcrel">${rel.map((x) => `<button type="button" class="dcrl" data-rel="${x.id}">${esc(x.title)}<span>${ICON('chevr', 14)}</span></button>`).join('')}</div>` : ''}
  <div class="dchelp"><span>Was this helpful?</span><button type="button" class="btn sm" data-h="y">Yes</button><button type="button" class="btn sm" data-h="n">No</button><span class="lsp"></span><small>Updated 11 Nov 2026</small></div>`;
};
const calmMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
function view(from) {
  const s = st();
  const art = s.open ? ARTICLES.find((x) => x.id === s.open) : null;
  const t = TOPICS.find((x) => x.id === (art ? art.t : s.topic));
  const list = ARTICLES.filter((x) => x.t === t.id);
  const cur = art || list[0];
  s.topic = t.id; s.open = cur.id; B.save();
  $('#app').innerHTML = `<div class="pg dcpg dcview"><aside class="dcnav"><button type="button" class="link dcback" id="dcb">${ICON('chevl', 16)}Help center</button><span class="dcimg" id="dcim"><img src="assets/help/${t.id}.jpg" alt="" draggable="false"></span><h2 class="dct">${esc(t.title)}</h2><p class="dcbl">${esc(t.blurb)}</p><div class="dcarts" role="list">${list.map((x) => `<button type="button" role="listitem" class="dcai ${x.id === cur.id ? 'on' : ''}" data-a="${x.id}" aria-current="${x.id === cur.id ? 'true' : 'false'}">${esc(x.title)}</button>`).join('')}</div></aside><article class="dcbody" id="dcbody">${artHtml(cur, t)}</article></div>`;
  const wireHelp = () => {
    $$('[data-h]').forEach((b) => { b.onclick = () => { $('.dchelp').innerHTML = '<span>Thanks. That helps us improve this page.</span>'; }; });
    $$('.dcgo').forEach((b) => { b.onclick = () => { const g = b.dataset.go; if (g === 'docs-trust') { s.topic = 'trust'; s.open = null; B.save(); docs(); return; } B.S.surface = g; if (b.dataset.tab) B.S.acctTab = b.dataset.tab; B.save(); B.route(); window.scrollTo(0, 0); }; });
    $$('[data-rel]').forEach((b) => { b.onclick = () => { const x = ARTICLES.find((y) => y.id === b.dataset.rel); s.topic = x.t; s.open = x.id; B.save(); window.scrollTo(0, 0); docs(); }; });
  };
  wireHelp();
  $('#dcb').onclick = () => {
    const pg = $('.dcview');
    const go = () => { s.topic = null; s.open = null; B.save(); docs('back'); };
    if (pg && pg.animate && !calmMotion()) pg.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(6px)' }], { duration: 140, easing: 'ease-in', fill: 'forwards' }).finished.then(go).catch(go); else go();
  };
  $$('.dcai').forEach((b) => {
    b.onclick = () => {
      if (b.dataset.a === s.open) return;
      s.open = b.dataset.a; B.save();
      const a2 = ARTICLES.find((x) => x.id === s.open);
      $$('.dcai').forEach((o) => { const on = o === b; o.classList.toggle('on', on); o.setAttribute('aria-current', on ? 'true' : 'false'); });
      const body = $('#dcbody');
      const swap = () => { body.innerHTML = artHtml(a2, t); wireHelp(); if (body.animate && !calmMotion()) body.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)' }); };
      if (body.animate && !calmMotion()) body.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 90, fill: 'forwards' }).finished.then(swap).catch(swap); else swap();
    };
  });
  if (calmMotion()) return;
  const nav = $('.dcnav'); const body = $('#dcbody'); const im = $('#dcim');
  if (from && from.width && im.animate) {
    /* the card's picture travels to its place at the top of the list */
    const to = im.getBoundingClientRect();
    const dx = from.left - to.left, dy = from.top - to.top, sx = from.width / to.width, sy = from.height / to.height;
    im.style.transformOrigin = 'top left';
    im.animate([{ transform: `translate(${dx}px,${dy}px) scale(${sx},${sy})`, borderRadius: '14px' }, { transform: 'none', borderRadius: '14px' }], { duration: 520, easing: 'cubic-bezier(.2,.85,.2,1)' });
    [...nav.children].filter((el) => el !== im).forEach((el, i) => el.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 380, delay: 200 + i * 40, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' }));
    body.animate([{ opacity: 0, transform: 'translateX(18px)' }, { opacity: 1, transform: 'none' }], { duration: 440, delay: 260, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
  } else {
    [nav, body].forEach((el, i) => el.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 300, delay: i * 70, easing: 'ease-out', fill: 'backwards' }));
  }
}

function docs(from) {
  const s = st();
  const q = (s.q || '').toLowerCase().trim();
  $('#app').className = '';
  if ((s.open || s.topic) && !q) { view(from); return; }
  const hits = q ? ARTICLES.filter((a) => (a.title + ' ' + a.sum + ' ' + a.steps.map((x) => x.join(' ')).join(' ')).toLowerCase().includes(q)) : [];
  const body = q
    ? `<div class="dclist">${hits.length ? hits.map((a) => `<button type="button" class="dcrow" data-a="${a.id}">${esc(a.title)}<small>${esc(TOPICS.find((t) => t.id === a.t).title)}</small><span>${ICON('chevr', 14)}</span></button>`).join('') : `<div class="dcnone"><b>No articles match</b><p>Try fewer words, or ask us below.</p></div>`}</div>`
    : `<div class="dcgrid">${TOPICS.map((t) => { const n = ARTICLES.filter((a) => a.t === t.id).length; return `<button type="button" class="dccard" data-topic="${t.id}"><span class="dcimg"><img src="assets/help/${t.id}.jpg" alt="" loading="lazy" draggable="false"></span><h3>${esc(t.title)}</h3><p>${esc(t.blurb)}</p><small class="dccount">${n} articles</small></button>`; }).join('')}</div>`;
  $('#app').innerHTML = `<div class="pg dcpg"><div class="dchero"><h1>Help center</h1><div class="dcsearch"><span>${ICON('search', 16)}</span><input id="dcq" type="search" placeholder="Search the help center" aria-label="Search the help center" value="${esc(s.q || '')}" autocomplete="off"></div></div>${body}
    <div class="dcsupport"><div><b>Still stuck?</b><p>Ask Broth about Broth, or write to a person. We reply within one working day.</p></div><div class="dcbtns"><button type="button" class="btn primary" id="dcask">Ask Broth</button><a class="btn" href="mailto:support@broth.app">Email support</a></div></div>
    <p class="dcstat"><i></i>All systems normal</p></div>`;
  const inp = $('#dcq'); if (s.q) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
  inp.oninput = () => { s.q = inp.value; B.save(); docs(); };
  $$('[data-topic]').forEach((b) => { b.onclick = () => {
    const r = $('.dcimg', b).getBoundingClientRect();
    const rect = { left: r.left, top: r.top, width: r.width, height: r.height };
    s.topic = b.dataset.topic; s.open = null; B.save(); window.scrollTo(0, 0);
    const grid = $('.dcgrid'); const go = () => docs(rect);
    go();
    if (grid && grid.animate) { /* the old page stays gone; the new one is already in place */ }
  }; });
  $$('[data-a]').forEach((b) => { b.onclick = () => { s.open = b.dataset.a; B.save(); window.scrollTo(0, 0); docs(); }; });
  if (from === 'back' && !calmMotion()) $$('.dccard').forEach((c, i) => c.animate([{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 360, delay: i * 45, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' }));
  $('#dcask').onclick = () => { B.S.surface = 'app'; B.S.thread = []; B.save(); B.route(); setTimeout(() => B.ask && B.ask('How do I connect a source?'), 350); };
}

window.SURFACES.docs = docs;
})();
