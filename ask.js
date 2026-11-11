/* ask.js: the Ask surface (sandbox spec 4.3, plan C4).
 *
 * Answers stream from POST /v1/conversations/{id}/turns (and /v1/turns/{id}/regenerate):
 * the status stage shows while Broth searches and reads, answer.delta sentences appear as
 * they arrive, and turn.completed brings the answer with its citations and kind. A stream
 * that fails or ends early shows a retryable error; a stopped or partial answer is never
 * shown as complete. Feedback, Report to owner and Regenerate round-trip to the API, and a
 * reopened conversation shows what the API returns (redacted to current access).
 */
(() => {
'use strict';
const B = window.BRAIN;
/** @type {(s: string, r?: ParentNode) => any} */
const $ = (s, r = document) => r.querySelector(s);
/** @type {(s: string, r?: ParentNode) => any[]} */
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = B.esc;
const S = () => B.S;
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- state ---------- */
/** Whether a conversation shows the sources panel: open on wide screens until it is closed. */
function panelOn() { const p = askState().panel; return p === null ? innerWidth >= 1200 : !!p; }
function askState() {
  const s = S();
  if (!s.ask) {
    s.ask = {
      panel: null, // null: the default (open from 1200 px up, like the prototype); true or false once chosen
      homeOpen: false, // the panel on the home view: closed until the Broth avatar opens it
      pt: 'answer',
      focus: null, // the turn whose sources the panel shows (defaults to the last answer)
      filters: { system: '', domain: '', when: '' },
      exclude: [],
      docs: { q: '', items: [], next: null, loading: false, error: null, loaded: false },
    };
  }
  return s.ask;
}
const REASONS = [['wrong', 'Wrong'], ['outdated', 'Outdated'], ['incomplete', 'Incomplete'], ['could_not_check', 'Could not check']];
const FAILED = {
  model_unavailable: 'Broth could not reach its model just now.',
  answer_refused: 'Broth declined to answer this question.',
  internal: 'Something went wrong while answering.',
};

/** A view of a stored turn (TurnOut). */
function fromApi(t) {
  const view = { id: t.id, question: t.question, created_at: t.created_at, answer: t.answer, text: '', feedback: t.feedback, reported: !!t.reported, error: null, status: 'completed' };
  if (t.status === 'failed') {
    if (t.error === 'cancelled') view.status = 'stopped';
    else { view.status = 'failed'; view.error = { title: FAILED[t.error] || FAILED.internal, retryable: t.error !== 'answer_refused' }; }
  } else if (t.status === 'streaming') {
    view.status = 'failed';
    view.error = { title: 'This answer did not finish.', retryable: true };
  }
  return view;
}

/* ---------- streaming ---------- */
let active = null; // { controller, turn }
function stop() {
  if (active) active.controller.abort();
}
function sendButton() { return $('.cxcomp .dsend') || $('#askform .dsend'); }
function showStop(on) {
  const b = sendButton();
  if (!b) return;
  if (on) {
    b.classList.add('stop'); b.type = 'button'; b.setAttribute('aria-label', 'Stop');
    b.innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><rect x="3" y="3" width="8" height="8" rx="2" fill="currentColor"/></svg>';
    b.onclick = stop;
  } else {
    b.classList.remove('stop'); b.type = 'submit'; b.setAttribute('aria-label', 'Ask');
    b.innerHTML = ICON('send', 16); b.onclick = null;
  }
}

function filtersBody() {
  const f = askState().filters;
  /** @type {any} */
  const filters = {};
  if (f.system) filters.systems = [f.system];
  if (f.domain) filters.domains = [f.domain];
  if (f.when) filters.verified_within_days = Number(f.when);
  if (askState().exclude.length) filters.exclude_document_ids = askState().exclude.slice(0, 100);
  return Object.keys(filters).length ? { filters } : {};
}

async function run(turn, start) {
  const controller = new AbortController();
  active = { controller, turn };
  showStop(true);
  try {
    const result = await start({ signal: controller.signal, onEvent: (event) => onEvent(turn, event) });
    if (result.event === 'turn.completed') { turn.status = 'completed'; turn.answer = result.data; }
    else { turn.status = 'failed'; turn.error = { title: result.data.message || FAILED[result.data.code] || FAILED.internal, retryable: !!result.data.retryable }; }
  } catch (error) {
    if (B.isAbort(error)) turn.status = 'stopped';
    else {
      turn.status = 'failed';
      turn.error = { title: B.problem(error), retryable: error.retryable !== false, retryAfter: error.retryAfter || 0 };
      if (error.turnId && !turn.id) turn.id = error.turnId;
    }
  } finally {
    if (active && active.turn === turn) active = null;
    showStop(false);
    paint(turn);
    renderPanel();
    B.haptic(turn.status === 'completed' ? 'success' : 'light');
  }
}
function onEvent(turn, event) {
  if (event.event === 'turn.started') turn.id = event.data.turn_id;
  else if (event.event === 'status') { turn.stage = event.data.stage; turn.searched = event.data.searched_documents; }
  else if (event.event === 'answer.delta') turn.text = (turn.text || '') + (turn.text ? ' ' : '') + event.data.text;
  paint(turn);
}

/** A new chat is being created for a question: until it exists, nothing else is sent. */
let creating = false;
function sending(on) {
  const b = sendButton();
  if (!b) return;
  b.disabled = on;
  b.classList.toggle('busy', on);
  if (on) { b.setAttribute('aria-busy', 'true'); b.innerHTML = '<span class="spin" aria-hidden="true"></span>'; }
  else { b.removeAttribute('aria-busy'); b.innerHTML = ICON('send', 16); }
}
/** Puts a question that could not be sent back in the composer, unless something new was typed. */
function giveBack(question) {
  const ta = $('#askin');
  if (!ta || ta.value.trim()) return;
  ta.value = question;
  ta.dispatchEvent(new Event('input'));
}

/** Asks `question` in the open conversation, creating one first on the home page. */
async function ask(question) {
  const q = String(question || '').trim();
  if (!q || creating) return;
  stop();
  let conv = S().conv;
  if (!conv || !S().route.params.id) {
    let created;
    creating = true;
    sending(true);
    try { created = await B.api.post('/conversations', {}); }
    catch (error) { B.toast(B.problem(error)); giveBack(q); return; }
    finally { creating = false; sending(false); }
    conv = S().conv = Object.assign({}, created, { turns: [], loaded: true });
    askState().panel = null; // a new chat starts with the default panel, as in the prototype
    B.touchChat(created);
  }
  const turn = { id: null, question: q, created_at: new Date().toISOString(), status: 'streaming', text: '', stage: 'searching', searched: 0, answer: null, error: null, feedback: null, reported: false };
  conv.turns.push(turn);
  if (S().route.params.id === conv.id) appendTurn(turn);
  else {
    const draft = $('#askin') ? $('#askin').value : ''; // typed while the chat was being created
    history.pushState({}, '', '/c/' + conv.id);
    B.route();
    if (draft) giveBack(draft);
  }
  const first = conv.turns.length === 1;
  await run(turn, (opts) => B.api.ask(conv.id, Object.assign({ question: q }, filtersBody()), opts));
  if (S().conv === conv) refreshMeta(conv, first);
}
/** After an answer the conversation moved to the top; its first answer also titles it. */
async function refreshMeta(conv, first) {
  if (!first) { B.touchChat(Object.assign({}, conv, { updated_at: new Date().toISOString() })); return; }
  try {
    const detail = await B.api.get('/conversations/' + conv.id);
    conv.title = detail.title;
    conv.updated_at = detail.updated_at;
    B.touchChat({ id: conv.id, title: detail.title, pinned: detail.pinned, created_at: detail.created_at, updated_at: detail.updated_at });
    const t = $('#cxtitle');
    if (t) t.textContent = B.chatTitle(conv);
    B.setCrumb(); B.mbTitle();
  } catch (error) { /* the title shows on the next load */ }
}
/** Regenerates a turn: a new turn replaces it in the view. Without a turn id, asks again. */
async function regenerate(turn) {
  const conv = S().conv;
  const index = conv.turns.indexOf(turn);
  if (index < 0) return;
  stop();
  const next = { id: null, question: turn.question, created_at: new Date().toISOString(), status: 'streaming', text: '', stage: 'searching', searched: 0, answer: null, error: null, feedback: null, reported: false };
  conv.turns[index] = next;
  const old = $(`#thread article[data-turn="${index}"]`);
  const fresh = turnEl(next, index);
  if (old) old.replaceWith(fresh);
  if (S().ask && S().ask.focus === turn) S().ask.focus = null;
  await run(next, turn.id
    ? (opts) => B.api.regenerate(turn.id, opts)
    : (opts) => B.api.ask(conv.id, Object.assign({ question: turn.question }, filtersBody()), opts));
}

/* ---------- rendering ---------- */
const systems = () => ((S().facets && S().facets.systems) || []).map((s) => s.value);
const totalDocs = () => ((S().facets && S().facets.systems) || []).reduce((n, s) => n + s.count, 0);
const GREET = {
  m: ['Good morning, {n}', 'Morning, {n}. What are we finding?', 'Fresh start, {n}'],
  a: ['Afternoon, {n}', 'Good afternoon, {n}', 'Still hunting, {n}?'],
  e: ['Evening, {n}', 'Winding down, {n}?', 'One more thing, {n}?'],
  l: ['Working late, {n}?', 'Still up, {n}?'],
  any: ['What do you want to know, {n}?', 'Ask away, {n}', 'Looking for something, {n}?', "Let's find it, {n}", "What's on your mind, {n}?"],
};
let greetingText = '';
function greeting() {
  const h = new Date().getHours();
  const me = S().me;
  const name = me ? me.nickname || String(me.name).split(' ')[0] : '';
  if (!greetingText) {
    const pool = [...(h >= 5 && h < 12 ? GREET.m : h >= 12 && h < 18 ? GREET.a : h >= 18 && h < 22 ? GREET.e : GREET.l), ...GREET.any];
    greetingText = pool[Math.floor(Math.random() * pool.length)];
  }
  return name ? greetingText.replace('{n}', esc(name)) : greetingText.replace(/, \{n\}|\{n\}/, '');
}
function sourcesLabel() {
  const total = totalDocs();
  if (!S().facets) return 'Sources';
  const n = Math.max(0, total - askState().exclude.length);
  const narrowed = askState().filters.system || askState().filters.domain || askState().filters.when;
  return `${narrowed ? 'Filtered · ' : ''}${n} ${n === 1 ? 'source' : 'sources'}`;
}
function composer(home, placeholder, convId) {
  return `<form class="dform" id="askform"><textarea id="askin" rows="${home ? 3 : 1}" placeholder="${placeholder}" aria-label="Ask a question" autocomplete="off" maxlength="4000" ${convId ? `data-conv="${esc(convId)}"` : ''}></textarea><div class="drow"><button type="button" class="dchip" id="cxsrc">${ICON('stack', 14)}<span>${esc(sourcesLabel())}</span>${B.CARET}</button><span class="lsp"></span><button class="dsend" type="submit" aria-label="Ask">${ICON('send', 16)}</button></div></form>`;
}
function feedHtml() {
  const sys = systems();
  if (!S().facets) return '<p class="lh-feed" id="lhfeed"><i class="pvsk" style="width:160px;display:inline-block"></i></p>';
  if (!sys.length) {
    return `<p class="lh-feed" id="lhfeed"><span>Nothing is connected yet.${B.isAdmin() ? ' <button type="button" class="link" data-go="/admin/connectors">Connect a source</button>' : ' Your admin connects sources.'}</span></p>`;
  }
  return `<p class="lh-feed" id="lhfeed">${sys.map((k) => B.srcIcon(k, 14)).join('')}<span>Reading from ${sys.length} connected ${sys.length === 1 ? 'app' : 'apps'}</span></p>`;
}
/** Questions that show what Broth is for; each starts a chat. The icon is a connected app's. */
const EXAMPLES = [
  ['How do I request access to a source?', 'lock'],
  ['What is our onboarding process?', null],
  ['Where is the latest expenses policy?', null],
  ['Who owns the pricing page?', null],
];
function examplesHtml() {
  const sys = systems();
  if (S().facets && !sys.length) return '';
  let n = 0;
  return `<div class="lh-sugs">${EXAMPLES.map(([q, icon], i) => {
    const mark = icon ? ICON(icon, 16) : sys.length ? B.srcIcon(sys[n++ % sys.length], 18) : ICON('doc', 16);
    return `<button type="button" class="lh-sug" data-lf="1" style="--i:${i}" data-q="${esc(q)}"><span class="lh-si">${mark}</span><span class="lh-sq">${esc(q)}</span><span class="lh-go">${ICON('arrow', 14)}</span></button>`;
  }).join('')}</div>`;
}
function renderHome() {
  $('#app').className = 'cxapp';
  const open = askState().homeOpen;
  $('#app').innerHTML = `<div class="cx ${open ? '' : 'closed'}"><section class="cxmain"><div class="lhome"><button type="button" class="hometog" id="hometog" aria-label="Show sources" title="Sources" aria-expanded="${open}"><span class="hav"><img src="/assets/brand/mascot-head.png" alt="" width="26" height="26" draggable="false"><i class="hdot"></i></span></button><div class="dchead"><b>New chat</b></div><div class="lh-in"><div class="lm" role="img" aria-label="Broth"></div><h1 class="lh-t">${greeting()}</h1>${composer(true, 'Ask a question')}<div id="lhsugs">${examplesHtml()}</div>${feedHtml()}</div></div></section><aside class="cxside" id="rsrc" aria-label="Sources"></aside></div>`;
  wireComposer(true);
  wireHome();
  const tog = $('#hometog');
  if (tog) tog.onclick = () => { askState().pt = 'sources'; setPanel(true); };
  if (open) renderPanel();
  cyclePlaceholder();
  enterCards();
}
/** The example cards rise in one after another, as life.js does for rows (same stagger, length and ease). */
function enterCards() {
  const M = window.Motion;
  const cards = $$('.lh-sug');
  if (!M || calm() || !cards.length) return;
  cards.forEach((c) => { c.style.opacity = '0'; });
  const done = () => cards.forEach((c) => { c.style.opacity = ''; c.style.transform = ''; });
  M.animate(cards, { opacity: [0, 1], y: [12, 0] }, { delay: M.stagger(0.028), duration: 0.4, ease: [0.22, 1, 0.36, 1] }).finished.then(done).catch(done);
}
/** The empty composer on the home view suggests a question every few seconds, fading between them. */
function cyclePlaceholder() {
  const ta = $('#askin');
  if (!ta || calm()) return;
  const ex = EXAMPLES.filter(([, icon]) => !icon).map(([q]) => q).concat(['What changed this week?']);
  let k = 0;
  const tick = () => {
    if (!document.body.contains(ta)) return;
    if (!ta.value && document.activeElement !== ta) {
      k = (k + 1) % ex.length;
      ta.classList.add('phx');
      setTimeout(() => { ta.placeholder = ex[k]; ta.classList.remove('phx'); }, 180);
    }
    setTimeout(tick, 3200);
  };
  setTimeout(tick, 3200);
}
function wireHome() {
  $$('#app [data-q]').forEach((b) => { b.onclick = () => { if (!active && !creating) ask(b.dataset.q); }; });
  $$('[data-open-chat]').forEach((b) => { b.onclick = () => B.go('/c/' + b.dataset.openChat); });
  $$('#app [data-go]').forEach((b) => { b.onclick = () => B.go(b.dataset.go); });
}
/** The sidebar lists recent chats; the home page no longer repeats them. */
function refreshRecent() {}

/** What is being typed in this conversation's composer, to carry over a re-render. */
function takeDraft(convId) {
  const ta = $('#askin');
  if (!ta || ta.dataset.conv !== convId || !ta.value) return null;
  return { value: ta.value, focused: document.activeElement === ta, start: ta.selectionStart, end: ta.selectionEnd };
}
function putDraft(draft) {
  const ta = $('#askin');
  if (!draft || !ta) return;
  ta.value = draft.value;
  ta.dispatchEvent(new Event('input'));
  if (draft.focused) { ta.focus({ preventScroll: true }); ta.setSelectionRange(draft.start, draft.end); }
}

function renderConversation(conv) {
  greetingText = '';
  const draft = takeDraft(conv.id); // the view re-renders when the chat loads or is renamed
  const a = askState();
  $('#app').className = 'cxapp';
  $('#app').innerHTML = `<div class="cx ${panelOn() ? '' : 'closed'}"><section class="cxmain"><div class="dchead"><b class="dtitle" id="cxtitle" tabindex="0" role="button" title="Rename chat">${esc(B.chatTitle(conv))}</b><button type="button" class="lib dpen" id="cxmore" aria-label="Chat actions" aria-haspopup="menu" title="Chat actions">${ICON('more', 16)}</button><span class="lsp"></span><button type="button" class="lib ctog" id="cxtog" aria-label="Sources" title="Sources" aria-expanded="${panelOn()}">${togInner()}</button></div><div class="chatscroll" id="chat"><div class="dthread"><div class="thread" id="thread"></div></div></div><div class="cxcomp">${composer(false, 'Ask a follow-up', conv.id)}<p class="cxcap">Broth can be inaccurate. Check the sources.</p></div></section><aside class="cxside" id="rsrc" aria-label="Sources"></aside></div>`;
  const thread = $('#thread');
  if (!conv.loaded) {
    thread.innerHTML = conv.error ? B.errorBlock(conv.error, 'convretry') : `<div class="skwrap" role="status"><span class="sr">Loading the conversation</span>${skeletonTurn()}${skeletonTurn()}</div>`;
    const retry = $('#convretry');
    if (retry) retry.onclick = () => openConversation(conv.id, true);
  } else if (!conv.turns.length) {
    thread.innerHTML = '<p class="actn thempty">No questions in this chat yet. Ask one below.</p>';
  } else {
    conv.turns.forEach((t, i) => thread.appendChild(turnEl(t, i)));
  }
  const rename = () => {
    const t = $('#cxtitle');
    const before = B.chatTitle(conv);
    if (t) {
      B.editTitle(t, conv, () => {
        if (S().conv === conv) renderConversation(conv);
        B.setCrumb(); B.mbTitle();
        const next = $('#cxtitle');
        if (next && B.chatTitle(conv) !== before && !calm()) { next.classList.add('drawn'); setTimeout(() => next.classList.remove('drawn'), 1400); }
      });
    }
  };
  $('#cxtitle').onclick = rename;
  $('#cxtitle').onkeydown = (e) => { if (e.key === 'Enter' || e.key === 'F2') { e.preventDefault(); rename(); } };
  $('#cxmore').onclick = (e) => { e.stopPropagation(); B.chatMenu($('#cxmore'), conv, { rename }); };
  $('#cxtog').onclick = () => setPanel(!panelOn());
  wireComposer(false);
  putDraft(draft);
  renderPanel();
  const chat = $('#chat');
  if (chat) chat.scrollTop = chat.scrollHeight;
  if (active && conv.turns.includes(active.turn)) showStop(true);
}
function skeletonTurn() {
  return '<article aria-hidden="true" class="sktturn"><div class="umsg skumsg"><i class="pvsk" style="width:180px"></i></div><div class="ans"><i class="pvsk" style="width:88%"></i><i class="pvsk" style="width:64%"></i></div></article>';
}
function togInner() {
  const last = latestAnswered();
  const cites = last ? last.answer.citations : [];
  const sys = [...new Set(cites.map((c) => c.system))].slice(0, 3);
  const n = new Set(cites.map((c) => c.document_id)).size;
  return `${sys.length ? `<span class="ctogs">${sys.map((x) => B.srcIcon(x, 16)).join('')}</span>` : ICON('stack', 15)}<span class="ctogn">${n ? n + (n === 1 ? ' source' : ' sources') : ''}</span>`;
}
function latestAnswered() {
  const conv = S().conv;
  if (!conv) return null;
  for (let i = conv.turns.length - 1; i >= 0; i -= 1) {
    const t = conv.turns[i];
    if (t.status === 'completed' && t.answer && t.answer.citations.length) return t;
  }
  return null;
}

function wireComposer(home) {
  const ta = $('#askin');
  const form = $('#askform');
  ta.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); } };
  ta.oninput = () => { ta.style.height = 'auto'; ta.style.height = Math.min(160, ta.scrollHeight) + 'px'; };
  form.onsubmit = (e) => {
    e.preventDefault();
    if (active || creating) return;
    const v = ta.value.trim();
    if (!v) return;
    ta.value = '';
    ta.style.height = '';
    ask(v);
  };
  $('#cxsrc').onclick = () => {
    askState().pt = 'sources';
    if (innerWidth <= 860) openSourcesDrawer();
    else setPanel(true);
  };
}

/* ---------- a turn ---------- */
const keyOf = (index) => String(index);
function citeHtml(text, turn, index) {
  const cited = new Set(((turn && turn.answer && turn.answer.citations) || []).map((c) => c.n));
  return esc(text)
    .replace(/\n{2,}/g, '<br><br>')
    .replace(/\[(\d+)\]/g, (m, n) => (cited.has(Number(n))
      ? `<button type="button" class="cite" data-cite="${keyOf(index)}:${n}" aria-label="Source ${n}">${n}</button>`
      : turn && turn.status === 'streaming' ? `<span class="cite pending" aria-hidden="true">${n}</span>` : ''));
}
function stageText(turn) {
  if (turn.stage === 'reading') return turn.searched ? `Reading ${turn.searched} ${turn.searched === 1 ? 'document' : 'documents'}` : 'Reading your sources';
  if (turn.stage === 'writing') return 'Writing the answer';
  return 'Searching your sources';
}
function thinkingHtml(turn) {
  const sys = systems().length ? systems() : ['confluence'];
  return `<span class="thk"><span class="thk-l">${sys.map((k, j) => `<i style="--j:${j}">${B.srcIcon(k, 16)}</i>`).join('')}</span><span class="thk-t">${esc(stageText(turn))}</span></span>`;
}
function turnEl(turn, index) {
  const el = document.createElement('article');
  el.dataset.turn = String(index);
  const conv = S().conv;
  const prev = conv.turns[index - 1];
  const dayKey = (iso) => new Date(iso).toDateString();
  const chip = !prev || dayKey(prev.created_at) !== dayKey(turn.created_at) ? `<div class="dday"><span>${B.when(turn.created_at, B.dayLabel(turn.created_at, !prev))}</span></div>` : '';
  el.innerHTML = `${chip}<div class="umsg" title="${esc(new Date(turn.created_at).toLocaleString())}"><span>${esc(turn.question)}</span></div><div class="umrow"><div class="umt"><time datetime="${esc(turn.created_at)}">${esc(B.fmtTime(turn.created_at))}</time></div></div><div class="ans"></div><div class="extra"></div>`;
  fill(el, turn, index);
  return el;
}
function appendTurn(turn) {
  const thread = $('#thread');
  if (!thread) return;
  const empty = $('.thempty', thread);
  if (empty) empty.remove();
  const conv = S().conv;
  const el = turnEl(turn, conv.turns.indexOf(turn));
  thread.appendChild(el);
  el.scrollIntoView({ behavior: calm() ? 'auto' : 'smooth', block: 'nearest' });
}
/** Repaints one turn in place (streaming updates and final states). */
function paint(turn) {
  const conv = S().conv;
  if (!conv) return;
  const index = conv.turns.indexOf(turn);
  const el = index >= 0 ? $(`#thread article[data-turn="${index}"]`) : null;
  if (!el) return;
  fill(el, turn, index);
  const chat = $('#chat');
  if (chat && turn.status === 'streaming' && chat.scrollHeight - chat.scrollTop - chat.clientHeight < 160) chat.scrollTop = chat.scrollHeight;
  const tog = $('#cxtog');
  if (tog && turn.status !== 'streaming') tog.innerHTML = togInner();
}
function fill(el, turn, index) {
  const ans = $('.ans', el), extra = $('.extra', el);
  ans.className = 'ans';
  ans.removeAttribute('aria-live');
  if (turn.status === 'streaming') {
    ans.setAttribute('aria-live', 'polite');
    if (!turn.text) { ans.classList.add('thinking'); ans.innerHTML = thinkingHtml(turn); }
    else { ans.classList.add('cursor'); ans.innerHTML = citeHtml(turn.text, turn, index); }
    extra.innerHTML = '';
    return;
  }
  if (turn.status === 'stopped') {
    ans.innerHTML = turn.text ? citeHtml(turn.text, turn, index) : 'Stopped before an answer.';
    if (turn.text) ans.classList.add('partial');
    extra.innerHTML = `<div class="fb arow gact"><span class="tag">Stopped</span><button type="button" class="gpill" data-regen="1">${ICON('refresh', 16)} Regenerate</button></div>`;
    bind(el, turn, index);
    return;
  }
  if (turn.status === 'failed') {
    const e = turn.error || { title: FAILED.internal, retryable: true };
    ans.textContent = e.title; // a partial answer is never shown as if it were complete
    extra.innerHTML = `<div class="notice low" role="alert"><span>${e.retryable ? `Your question was not lost. <button type="button" class="link" data-retry="1" ${e.retryAfter ? 'disabled' : ''}>${e.retryAfter ? `Try again in ${e.retryAfter} s` : 'Try again'}</button>` : 'Try asking it a different way.'}</span></div>`;
    bind(el, turn, index);
    if (e.retryAfter) countdown(el, turn);
    return;
  }
  const a = turn.answer;
  const access = a.access_limited ? '<div class="notice access"><span>Some content may not be visible to you.</span></div>' : '';
  if (a.kind === 'not_found') {
    const owner = a.not_found && a.not_found.suggested_owner;
    ans.textContent = 'I could not find a good source for that.';
    extra.innerHTML = `${access}<div class="notice none"><span>${owner ? `The likely owner is ${PERSON(owner.name, 16)}${owner.team ? ` (${esc(owner.team)})` : ''}. ` : ''}Your question was logged so the owners can see the gap.</span></div>${fbHtml(turn, false)}${followUps(a)}`;
  } else if (a.kind === 'conflict') {
    ans.innerHTML = citeHtml(a.text || (a.conflict && a.conflict.summary) || '', turn, index);
    extra.innerHTML = `${conflictHtml(turn, index)}${access}${fbHtml(turn, true)}${followUps(a)}`;
  } else {
    ans.innerHTML = citeHtml(a.text, turn, index);
    const low = a.kind === 'low_confidence' ? `<div class="notice low"><span>${esc(a.low_confidence_reason || 'The sources for this answer may be out of date.')}</span></div>` : '';
    extra.innerHTML = `${low}${access}${a.citations.length ? `<div class="srcrow">${pillHtml(a)}</div>` : ''}${fbHtml(turn, true)}${followUps(a)}`;
  }
  bind(el, turn, index);
}
function countdown(el, turn) {
  const b = $('[data-retry]', el);
  if (!b) return;
  let left = turn.error.retryAfter;
  const tick = () => {
    if (!b.isConnected) return;
    left -= 1;
    if (left <= 0) { turn.error.retryAfter = 0; b.disabled = false; b.textContent = 'Try again'; return; }
    b.textContent = `Try again in ${left} s`;
    setTimeout(tick, 1000);
  };
  setTimeout(tick, 1000);
}
function pillHtml(a) {
  const docs = [];
  a.citations.forEach((c) => { if (!docs.some((d) => d.document_id === c.document_id)) docs.push(c); });
  return `<button type="button" class="srcpill" data-pill="1"><span class="favs">${docs.slice(0, 3).map((d) => `<i>${B.srcIcon(d.system, 14)}</i>`).join('')}</span>${docs.length === 1 ? '1 source' : docs.length + ' sources'} read</button>`;
}
function conflictHtml(turn, index) {
  const a = turn.answer;
  const sides = (a.conflict && a.conflict.sides) || [];
  const cite = (n) => a.citations.find((c) => c.n === n);
  return `<div class="conflict"><div class="cfh">${esc((a.conflict && a.conflict.summary) || 'Sources disagree')}</div>
    ${sides.map((s) => { const c = cite(s.n); return `<button type="button" class="cfrow" ${c ? `data-cite="${keyOf(index)}:${s.n}"` : 'disabled'}>${c ? B.srcIcon(c.system, 22) : ''}<span class="cft"><b>${esc(c ? c.title : 'Source ' + s.n)}</b><small>${c ? esc(B.systemName(c.system)) + (c.last_verified_at ? ` · verified ${B.when(c.last_verified_at, B.fmtDate(c.last_verified_at))}` : '') : ''}</small></span><span class="cfv">${esc(s.value)}</span>${c ? authorityTag(c.authority) : ''}</button>`; }).join('')}
    <div class="cff"><button type="button" class="btn sm" data-report="1" ${turn.reported ? 'disabled' : ''}>${turn.reported ? `${ICON('check', 14)} Sent` : 'Report to owner'}</button>${turn.reported ? '<span class="cfsent">The owners can fix it at the source.</span>' : ''}</div></div>`;
}
function authorityTag(authority) {
  if (authority === 'approved') return '<span class="tag ok">Approved</span>';
  return `<span class="tag warn">${authority === 'draft' ? 'Draft' : 'Not approved'}</span>`;
}
function fbHtml(turn, share) {
  const f = turn.feedback;
  return `<div class="fb arow gact">
    ${share ? `<button type="button" class="gic" data-copy="1" aria-label="Copy">${ICON('copy', 18)}</button><button type="button" class="gic" data-regen="1" aria-label="Regenerate" title="Regenerate">${ICON('refresh', 18)}</button>` : ''}
    <button type="button" class="gic" aria-pressed="${!!(f && f.vote === 'up')}" data-v="up" aria-label="Helpful">${ICON('thumbup', 18)}</button>
    <button type="button" class="gic" aria-pressed="${!!(f && f.vote === 'down')}" data-v="down" aria-label="Not helpful">${ICON('thumbdown', 18)}</button>
    ${f && f.vote === 'down' && !f.reason ? `<div class="reasons">${REASONS.map(([k, l]) => `<button type="button" class="chip" data-r="${k}">${l}</button>`).join('')}</div>` : ''}
    ${f && f.reason ? `<span class="tag">${esc((REASONS.find((r) => r[0] === f.reason) || ['', f.reason])[1])}, thanks</span>` : ''}
    ${f && f.vote === 'up' ? '<span class="tag ok">Thanks</span>' : ''}
  </div>`;
}
function followUps(a) {
  const list = (a.follow_ups || []).slice(0, 3);
  return list.length ? `<div class="fu"><div class="gm-sugs left">${list.map((q) => `<button type="button" class="gm-sug" data-fu="${esc(q)}">${esc(q)}</button>`).join('')}</div></div>` : '';
}

function bind(el, turn, index) {
  $$('.cite[data-cite], .cfrow[data-cite]', el).forEach((b) => { b.onclick = () => focusCitation(turn, Number(b.dataset.cite.split(':')[1])); });
  $$('[data-pill]', el).forEach((b) => {
    b.onclick = () => { askState().focus = turn; askState().pt = 'answer'; if (innerWidth > 860) setPanel(true); else openSourcesDrawer(); };
  });
  $$('[data-regen]', el).forEach((b) => { b.onclick = () => regenerate(turn); });
  $$('[data-retry]', el).forEach((b) => { b.onclick = () => regenerate(turn); });
  $$('[data-fu]', el).forEach((b) => { b.onclick = () => ask(b.dataset.fu); });
  $$('[data-copy]', el).forEach((b) => {
    b.onclick = async () => {
      try { await navigator.clipboard.writeText(String((turn.answer && turn.answer.text) || '').replace(/\s*\[\d+\]/g, '')); } catch (e) { /* clipboard blocked */ }
      if (!b.dataset.orig) b.dataset.orig = b.innerHTML;
      b.innerHTML = ICON('check', 18); b.classList.add('done'); b.setAttribute('aria-label', 'Copied');
      B.toast('Copied');
      setTimeout(() => { b.innerHTML = b.dataset.orig; b.classList.remove('done'); b.setAttribute('aria-label', 'Copy'); }, 1800);
    };
  });
  $$('.fb [data-v]', el).forEach((b) => { b.onclick = () => vote(turn, index, { vote: b.dataset.v, reason: null }); });
  $$('.fb [data-r]', el).forEach((b) => { b.onclick = () => vote(turn, index, { vote: 'down', reason: b.dataset.r }); });
  $$('[data-report]', el).forEach((b) => {
    b.onclick = () => B.busy(b, async () => {
      await B.api.post(`/turns/${turn.id}/reports`, {});
      turn.reported = true;
      B.toast('Sent to the owners');
      paint(turn);
    });
  });
}
async function vote(turn, index, feedback) {
  if (!turn.id) return;
  const before = turn.feedback;
  turn.feedback = feedback;
  paint(turn);
  try {
    await B.api.put(`/turns/${turn.id}/feedback`, feedback.reason ? feedback : { vote: feedback.vote });
  } catch (error) {
    turn.feedback = before;
    paint(turn);
    B.toast(B.problem(error));
  }
}

/* ---------- the sources panel ---------- */
function setPanel(open) {
  const a = askState();
  const home = !!$('.lhome');
  if (home) a.homeOpen = !!open; else a.panel = !!open;
  const on = home ? a.homeOpen : panelOn();
  const cx = $('.cx');
  if (cx) cx.classList.toggle('closed', !on);
  const tog = $(home ? '#hometog' : '#cxtog');
  if (tog) tog.setAttribute('aria-expanded', String(on));
  if (on) renderPanel();
}
function focusCitation(turn, n) {
  const a = askState();
  a.focus = turn;
  a.pt = 'answer';
  if (innerWidth <= 860) { openSourcesDrawer(n); return; }
  setPanel(true);
  const row = $(`#rsrc [data-n="${n}"]`);
  if (row) { row.scrollIntoView({ block: 'nearest', behavior: calm() ? 'auto' : 'smooth' }); row.classList.remove('pulse'); void row.offsetWidth; row.classList.add('pulse'); }
}
function panelTurn() {
  const a = askState();
  const conv = S().conv;
  if (a.focus && conv && conv.turns.includes(a.focus) && a.focus.answer) return a.focus;
  return latestAnswered();
}
function citationRows(turn) {
  const cites = turn.answer.citations;
  return `<div class="cxh">${cites.length} ${cites.length === 1 ? 'source' : 'sources'} used</div>${cites.map((c) => `<div class="cxs" data-n="${c.n}" data-doc="${c.document_id}" tabindex="0" role="button"><div class="cxs-h">${B.srcIcon(c.system, 20)}<b>${esc(c.title)}</b><span class="cite">${c.n}</span></div><div class="cxs-q">${c.quote ? esc(c.quote) : '<span class="amute">This passage is no longer available.</span>'}</div><div class="cxs-f">${authorityTag(c.authority)}<span>${c.owner ? PERSON(c.owner.name, 16) : ''}${c.last_verified_at ? ` · ${B.when(c.last_verified_at, B.fmtDate(c.last_verified_at))}` : ''}</span><span class="cxs-go">${ICON('chevr', 14)}</span></div></div>`).join('')}`;
}
function answerTab() {
  const turn = panelTurn();
  if (!turn) return `<div class="cxnone"><span class="cxni">${ICON('stack', 20)}</span><b>No sources yet</b><p>The sources behind an answer show up here.</p></div>`;
  return citationRows(turn);
}
function sourcesTab() {
  const a = askState();
  const f = S().facets || { systems: [], domains: [] };
  const opt = (value, label, current) => `<option value="${esc(value)}" ${current === value ? 'selected' : ''}>${esc(label)}</option>`;
  return `<div class="cxf"><input id="srcq" class="cxin" type="search" placeholder="Search sources" aria-label="Search sources" value="${esc(a.docs.q)}" autocomplete="off"><div class="cxpills">
    <select id="fsrc" class="cxsel" aria-label="Source type">${opt('', 'Any source', a.filters.system)}${f.systems.map((s) => opt(s.value, B.systemName(s.value), a.filters.system)).join('')}</select>
    <select id="fdom" class="cxsel" aria-label="Domain">${opt('', 'Any domain', a.filters.domain)}${window.DOMAIN_TREE.optionTags(window.DOMAIN_TREE.tree(window.LIBRARY_BROWSE.folders(f)), { selected: a.filters.domain, value: (d) => d.slug })}</select>
    <select id="fwhen" class="cxsel" aria-label="Verified">${opt('', 'Any date', a.filters.when)}${opt('90', 'Verified in 90 days', a.filters.when)}${opt('365', 'Verified this year', a.filters.when)}</select></div></div>
    <div class="gall"><span id="selcount">${esc(selectedCount())}</span><button type="button" class="link" id="selall" ${a.exclude.length ? '' : 'disabled'}>Select all</button></div><div class="glist" id="srclist">${docRows()}</div>`;
}
function selectedCount() {
  const total = totalDocs();
  return `${Math.max(0, total - askState().exclude.length)} of ${total} used for your next question`;
}
function docRows() {
  const d = askState().docs;
  if (!d.loaded && d.loading) return B.skeletonRows(4, 'gsrc skgsrc');
  if (d.error) return `<div class="gempty">${esc(B.problem(d.error))} <button type="button" class="link" id="docretry">Try again</button></div>`;
  if (!d.items.length) return `<div class="gempty">${d.q ? 'No sources match.' : 'No sources yet.'}</div>`;
  const ex = new Set(askState().exclude);
  return d.items.map((doc) => `<label class="gsrc">${B.srcIcon(doc.system, 22)}<span class="gt"><span>${esc(doc.title)}</span><small>${esc([B.systemName(doc.system), doc.path].filter(Boolean).join(' · '))}</small></span><input type="checkbox" class="gck" data-sd="${doc.id}" ${ex.has(doc.id) ? '' : 'checked'} aria-label="Use ${esc(doc.title)}"></label>`).join('') + (d.next ? `<button type="button" class="link gmore" id="docmore" ${d.loading ? 'disabled' : ''}>${d.loading ? 'Loading' : 'Show more'}</button>` : '');
}
async function loadDocs(reset) {
  const d = askState().docs;
  if (d.loading) return;
  d.loading = true; d.error = null;
  if (reset) { d.items = []; d.next = null; d.loaded = false; }
  redrawDocs();
  try {
    const page = await B.api.get('/documents', { q: d.q || null, limit: 30, cursor: reset ? null : d.next });
    d.items = reset ? page.items : d.items.concat(page.items);
    d.next = page.next_cursor || null;
    d.loaded = true;
  } catch (error) { d.error = error; }
  finally { d.loading = false; }
  redrawDocs();
}
function redrawDocs() {
  const list = $('#srclist') || $('#dsrclist');
  if (!list) return;
  list.innerHTML = docRows();
  wireDocRows(list);
}
function wireDocRows(root) {
  const a = askState();
  $$('[data-sd]', root).forEach((c) => {
    c.onchange = () => {
      const id = c.dataset.sd;
      a.exclude = c.checked ? a.exclude.filter((x) => x !== id) : [...new Set([...a.exclude, id])];
      updateCounts();
    };
  });
  const more = $('#docmore', root);
  if (more) more.onclick = () => loadDocs(false);
  const retry = $('#docretry', root);
  if (retry) retry.onclick = () => loadDocs(true);
}
function updateCounts() {
  const c = $('#selcount');
  if (c) c.textContent = selectedCount();
  const all = $('#selall');
  if (all) all.disabled = !askState().exclude.length;
  $$('#cxsrc span').forEach((s) => { if (!s.querySelector('svg')) s.textContent = sourcesLabel(); });
}
function wireSourcesTab(root) {
  const a = askState();
  const q = $('#srcq', root);
  let timer = 0;
  q.oninput = () => { clearTimeout(timer); timer = setTimeout(() => { a.docs.q = q.value.trim(); loadDocs(true); }, 200); };
  const change = (key) => (e) => { a.filters[key] = e.target.value; updateCounts(); B.toast('Applies to your next question'); };
  $('#fsrc', root).onchange = change('system');
  $('#fdom', root).onchange = change('domain');
  $('#fwhen', root).onchange = change('when');
  $('#selall', root).onclick = () => { a.exclude = []; redrawDocs(); updateCounts(); };
  wireDocRows(root);
  if (!a.docs.loaded && !a.docs.loading) loadDocs(true);
}
function wireAnswerTab(root) {
  $$('[data-doc]', root).forEach((row) => {
    const open = () => {
      const turn = panelTurn();
      const c = turn && turn.answer.citations.find((x) => String(x.n) === row.dataset.n);
      window.DOCUMENTS.openDocument(row.dataset.doc, { citation: c });
    };
    row.onclick = open;
    row.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } };
  });
}
/** Where the panel's tab highlight last sat, so a tab change slides it from there. */
/** @type {{ pt: string, l: number, w: number } | null} */
let pillAt = null;
function renderPanel() {
  const p = $('#rsrc');
  if (!p) return;
  const a = askState();
  const pt = a.pt === 'sources' ? 'sources' : 'answer';
  const QUOTE = '<svg class="ic-svg" data-i="quote" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.5 8H7a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h2.5v1.5A2.5 2.5 0 0 1 7 19M18.5 8H16a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h2.5v1.5A2.5 2.5 0 0 1 16 19"/></svg>';
  const tabIcon = { answer: QUOTE, sources: ICON('stack', 18) };
  p.innerHTML = `${proHtml()}<div class="cxtabs" role="tablist">${[['answer', 'Answer'], ['sources', 'Sources']].map(([k, l]) => `<button type="button" class="ltab ic ${pt === k ? 'on' : ''}" role="tab" aria-selected="${pt === k}" data-pt="${k}" aria-label="${l}" title="${l}">${tabIcon[k]}<span class="ltl">${l}</span></button>`).join('')}</div><div class="cxbody">${pt === 'answer' ? answerTab() : sourcesTab()}</div>`;
  $$('[data-pt]', p).forEach((b) => { b.onclick = () => { a.pt = b.dataset.pt; renderPanel(); }; });
  $('#cxclose', p).onclick = () => setPanel(false);
  const tabs = $('.cxtabs', p), on = $('.ltab.on', tabs);
  if (on) {
    const pill = document.createElement('span');
    pill.className = 'cxpill';
    tabs.prepend(pill);
    const tr = tabs.getBoundingClientRect(), r = on.getBoundingClientRect();
    const l = r.left - tr.left, w = r.width;
    pill.style.cssText = `left:${l}px;width:${w}px;height:${r.height}px;top:${r.top - tr.top}px`;
    const prev = pillAt;
    pillAt = { pt, l, w };
    const still = calm();
    if (prev && prev.pt !== pt && pill.animate) {
      const ease = 'cubic-bezier(.2,.8,.2,1)', body = $('.cxbody', p), dir = pt === 'sources' ? 1 : -1;
      pill.animate([{ transform: `translateX(${prev.l - l}px) scaleX(${prev.w / w})` }, { transform: 'none' }], { duration: still ? 1 : 260, easing: ease });
      if (body) body.animate(still ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: `translateX(${dir * 14}px)` }, { opacity: 1, transform: 'none' }], { duration: still ? 160 : 240, easing: ease });
    }
  }
  if (pt === 'answer') wireAnswerTab(p); else wireSourcesTab(p);
}
/** The close button and Broth's card at the top of the panel. */
function proHtml() {
  const connected = systems().length > 0;
  return `<button type="button" class="lib cxclose" id="cxclose" aria-label="Close panel">${ICON('x', 16)}</button><div class="cxpro"><div class="cxav"><img src="/assets/brand/mascot-head.png" alt="" draggable="false"></div><b class="cxname">Broth</b><span class="cxst ${connected ? 'on' : ''}"><i></i>${connected ? 'Connected' : 'No sources connected'}</span></div>`;
}
function openSourcesDrawer(n) {
  const a = askState();
  const turn = panelTurn();
  const showAnswer = a.pt === 'answer' && turn;
  B.openDrawer(`<button type="button" class="btn sm" data-close-drawer>Close</button><h3>${showAnswer ? 'Sources' : 'Sources for your next question'}</h3><div class="cxbody drawerbody">${showAnswer ? citationRows(turn) : sourcesTab().replace('id="srclist"', 'id="dsrclist"')}</div>`);
  const d = $('#drawer');
  if (showAnswer) {
    wireAnswerTab(d);
    if (n) { const row = $(`[data-n="${n}"]`, d); if (row) row.scrollIntoView({ block: 'nearest' }); }
  } else wireSourcesTab(d);
}

/* ---------- loading a conversation ---------- */
let loadSeq = 0;
async function openConversation(id, force) {
  const known = S().chats.items.find((c) => c.id === id);
  const conv = S().conv = { id, title: known ? known.title : '', pinned: known ? known.pinned : false, turns: [], loaded: false, error: null };
  renderConversation(conv);
  const mine = ++loadSeq;
  try {
    const detail = await B.api.get('/conversations/' + id);
    if (mine !== loadSeq || S().conv !== conv) return;
    Object.assign(conv, { title: detail.title, pinned: detail.pinned, created_at: detail.created_at, updated_at: detail.updated_at, turns: detail.turns.map(fromApi), loaded: true });
  } catch (error) {
    if (mine !== loadSeq || S().conv !== conv) return;
    if (error.status === 404) { B.toast('That chat is not available.'); S().conv = null; B.go('/', { replace: true }); return; }
    conv.error = error;
  }
  if (S().route.surface === 'ask' && S().route.params.id === id) { renderConversation(conv); B.setCrumb(); B.mbTitle(); }
  if (force) B.renderChatList();
}

window.SURFACES.ask = (params) => {
  askState();
  if (!params.id) {
    stop();
    S().conv = null;
    renderHome();
    return;
  }
  const conv = S().conv;
  if (conv && conv.id === params.id) renderConversation(conv);
  else { stop(); askState().focus = null; openConversation(params.id); }
};

/** The answer's citation for a .cite element (the hover card in motion.js). */
function citation(el) {
  const [index, n] = String(el.dataset.cite || '').split(':').map(Number);
  const conv = S().conv;
  const turn = conv && conv.turns[index];
  return (turn && turn.answer && turn.answer.citations.find((c) => c.n === n)) || null;
}
/** Starts a new chat with `question` (the command palette). */
function askFresh(question) {
  stop();
  S().conv = null;
  if (S().route.surface !== 'ask' || S().route.params.id) B.go('/');
  ask(question);
}

/** The home page's source line, once facets arrive. */
function refreshFeed() {
  // The composer's source count shows in a chat too, not only on the home page.
  $$('#cxsrc span').forEach((x) => { if (!x.querySelector('svg')) x.textContent = sourcesLabel(); });
  const sg = $('#lhsugs');
  if (sg) {
    // Only the icons can change; swapping the cards would restart their entrance.
    const fresh = document.createElement('div');
    fresh.innerHTML = examplesHtml();
    const next = $$('.lh-si', fresh);
    const now = $$('.lh-si', sg);
    if (now.length && next.length === now.length) now.forEach((el, i) => { el.innerHTML = next[i].innerHTML; });
    else { sg.innerHTML = examplesHtml(); wireHome(); }
  }
  const f = $('#lhfeed');
  if (!f) return;
  f.outerHTML = feedHtml();
  wireHome();
}

window.ASK = { stop, ask, askFresh, citation, refreshRecent, refreshFeed };
})();
