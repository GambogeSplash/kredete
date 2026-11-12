/* chat-search.js: the chat list's own search, in the box at the top of the chats sidebar
 * (split search spec 3.1). It searches only the signed-in person's chats, by title and by
 * what was said in them, through GET /v1/conversations/search.
 *
 * While a search is on, the chat list (#srec) shows its results instead of the chats by day:
 * app.js's renderChatList hands the list to render() below. Esc or the clear button ends the
 * search and the list returns. A response for an older query is dropped, so fast typing never
 * shows stale results. */
(() => {
'use strict';
const B = window.BRAIN;
/** @type {(s: string, r?: ParentNode) => any} */
const $ = (s, r = document) => r.querySelector(s);
/** @type {(s: string, r?: ParentNode) => any[]} */
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const MAX = 200; // the API takes 1 to 200 characters
const WAIT = 200;
/** @type {{ q: string, items: any[], next: string | null, loading: boolean, error: any, seq: number }} */
const st = { q: '', items: [], next: null, loading: false, error: null, seq: 0 };
let timer = 0;

/** A snippet from the API: plain text apart from <mark> tags. Escaped, then the marks put back. */
function marked(snippet) {
  return B.esc(snippet).replace(/&lt;mark&gt;/g, '<mark>').replace(/&lt;\/mark&gt;/g, '</mark>');
}

/** The chat that opens for a hit: at the matching turn when a message matched. */
const target = (hit) => '/c/' + hit.id + (hit.match ? '#turn-' + hit.match.turn_id : '');
/** The line under a hit's title: who said the matching words, and the words marked. Empty for a title match. */
const hitLine = (hit) => (hit.match ? `<span class="chs"><b>${hit.match.field === 'question' ? 'You' : 'Broth'}:</b> ${marked(hit.match.snippet)}</span>` : '');

function active() { return st.q !== ''; }

function reset() {
  clearTimeout(timer);
  st.q = ''; st.items = []; st.next = null; st.loading = false; st.error = null; st.seq += 1;
  syncClear();
  B.renderChatList();
}

async function fetchPage(first) {
  if (!st.q || (st.loading && !first) || (!first && !st.next)) return;
  const mine = ++st.seq;
  const q = st.q;
  st.loading = true; st.error = null;
  if (first) { st.items = []; st.next = null; }
  B.renderChatList();
  try {
    const page = await B.api.get('/conversations/search', { q, cursor: first ? null : st.next });
    if (mine !== st.seq) return;
    st.items = st.items.concat(page.items.filter((x) => !st.items.some((y) => y.id === x.id)));
    st.next = page.next_cursor || null;
  } catch (error) {
    if (mine !== st.seq || B.isAbort(error)) return;
    st.error = error;
  }
  st.loading = false;
  B.renderChatList();
}

function typed(value) {
  const q = value.trim().slice(0, MAX);
  syncClear();
  if (!q) { if (active()) reset(); return; }
  clearTimeout(timer);
  timer = setTimeout(() => { st.q = q; fetchPage(true); }, WAIT);
}

function syncClear() {
  const box = $('#sbsearch');
  const input = $('#sbq');
  if (box && input) box.classList.toggle('typed', input.value !== '');
}

/** Draws the results into the chat list. Called by renderChatList while a search is on. */
function render(rec) {
  const current = B.S.route.surface === 'ask' ? B.S.route.params.id : null;
  if (st.loading && !st.items.length) { rec.innerHTML = B.skeletonRows(4, 'surf chat skchat'); return; }
  if (st.error && !st.items.length) {
    rec.innerHTML = `<div class="sempty" role="status">Couldn't search chats. <button type="button" class="link" id="csretry">Retry</button></div>`;
    $('#csretry').onclick = () => fetchPage(true);
    return;
  }
  if (!st.items.length) {
    rec.innerHTML = `<div class="sempty" role="status">No chats match “${B.esc(st.q)}”</div>`;
    return;
  }
  const row = (x) => `<button type="button" class="surf chat hit" data-hit="${B.esc(x.id)}" title="${B.esc(B.chatTitle(x))}" aria-current="${current === x.id ? 'page' : 'false'}"><span class="chn">${B.esc(B.chatTitle(x))}</span>${hitLine(x)}</button>`;
  let h = `<div class="sgl" role="status">${st.items.length}${st.next ? '+' : ''} ${st.items.length === 1 ? 'chat' : 'chats'}</div>` + st.items.map(row).join('');
  if (st.loading) h += B.skeletonRows(2, 'surf chat skchat');
  else if (st.error) h += `<div class="sempty">Couldn't search chats. <button type="button" class="link" id="csmore">Retry</button></div>`;
  rec.innerHTML = h;
  const more = $('#csmore');
  if (more) more.onclick = () => fetchPage(false);
  $$('[data-hit]', rec).forEach((b) => {
    const hit = st.items.find((x) => x.id === b.dataset.hit);
    b.onclick = () => B.go(target(hit));
  });
}

/** The chat list scrolled near its end: the next page of results. */
function more() { fetchPage(false); }

/** Focuses the box, when it is on screen. False when it is not, so `/` can open the palette. */
function focus() {
  const input = $('#sbq');
  if (!input || !input.offsetParent || document.body.classList.contains('nochats')) return false;
  input.focus();
  input.select();
  return true;
}

document.addEventListener('input', (e) => {
  const t = /** @type {HTMLInputElement} */ (e.target);
  if (t && t.id === 'sbq') typed(t.value);
});
// Capture phase: Esc in the box clears the search before the phone menu's own Esc closes the menu.
document.addEventListener('keydown', (e) => {
  const t = /** @type {HTMLInputElement} */ (e.target);
  if (!t || t.id !== 'sbq') return;
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); t.value = ''; reset(); }
  else if (e.key === 'ArrowDown') {
    const first = $('#srec [data-hit]');
    if (first) { e.preventDefault(); first.focus(); }
  }
}, true);
document.addEventListener('click', (e) => {
  const x = /** @type {Element} */ (e.target).closest && /** @type {Element} */ (e.target).closest('#sbclear');
  if (!x) return;
  const input = $('#sbq');
  if (input) { input.value = ''; input.focus(); }
  reset();
});

window.CHATSEARCH = { active, render, more, focus, hitLine, target };
})();
