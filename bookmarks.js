/* Bookmarks: answers saved in this browser only (localStorage, no API). The Bookmarks page lists them. */
(() => {
'use strict';
const B = window.BRAIN;
/** @type {(s: string, r?: ParentNode) => any} */
const $ = (s, r = document) => r.querySelector(s);
const KEY = 'broth-bookmarks';
const esc = B.esc;
const TRASH = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 7h15M9.5 7V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2M6.5 7l.8 11.2a1.5 1.5 0 0 0 1.5 1.3h6.4a1.5 1.5 0 0 0 1.5-1.3L17.5 7M10 11v5M14 11v5"/></svg>';
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function read() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(list) ? list.filter((x) => x && x.id) : [];
  } catch (e) { return []; }
}
function write(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); return true; } catch (e) { return false; }
}
const idOf = (turn) => String(turn.id || '');
const has = (turn) => read().some((x) => x.id === idOf(turn));

/** Adds or removes the bookmark for an answered turn. Returns true when it is now saved. */
function toggle(turn) {
  const id = idOf(turn);
  const list = read();
  const at = list.findIndex((x) => x.id === id);
  if (at >= 0) {
    list.splice(at, 1);
    write(list);
    B.toast('Bookmark removed');
    return false;
  }
  const a = turn.answer || { text: '', citations: [] };
  const systems = [...new Set((a.citations || []).map((c) => c.system).filter(Boolean))];
  list.unshift({
    id,
    question: String(turn.question || ''),
    answer: String(a.text || '').replace(/\s*\[\d+\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 200),
    sources: systems.map((s) => ({ system: s })),
    conversation: B.S.conv ? B.S.conv.id : '',
    savedAt: new Date().toISOString(),
  });
  if (!write(list)) { B.toast('Could not save in this browser'); return false; }
  B.toast('Bookmarked');
  return true;
}

function page() {
  const list = read();
  const rows = list.map((x) => `<div class="ds-tr svcols" data-id="${esc(x.id)}" data-c="${esc(x.conversation)}" role="row" tabindex="0"><span class="ltb"><b>${esc(x.question)}</b><small>${esc(x.answer)}</small></span><span class="svsrc">${(x.sources || []).map((s) => `<span class="svs" tabindex="0" data-tip="${esc(B.systemName(s.system))}" aria-label="${esc(B.systemName(s.system))}">${B.srcIcon(s.system, 20)}</span>`).join('')}</span><span class="amute svw">${B.when(x.savedAt, B.ago(x.savedAt))}</span><span class="svx"><button type="button" class="btn sm svrm" data-rm="${esc(x.id)}" aria-label="Remove bookmark">${TRASH}</button></span></div>`).join('');
  $('#app').innerHTML = `<div class="pg"><div class="ds-head"><h1>Bookmarks <span class="hint" tabindex="0" data-tip="Saved in this browser only." aria-label="Saved in this browser only.">i</span></h1></div>
   ${list.length ? `<div class="ds-table" role="table" aria-label="Bookmarks"><div class="ds-tr ds-th svcols" role="row"><span>Question</span><span class="svsrc">Sources</span><span class="svw">Saved</span><span></span></div>${rows}</div>` : '<p class="actn">Nothing bookmarked yet. <button type="button" class="link" id="bkask">Ask Broth</button></p>'}</div>`;
  const ask = $('#bkask');
  if (ask) ask.onclick = () => B.go('/');
  /** @type {any[]} */ ([...document.querySelectorAll('.svcols[data-id]')]).forEach((row) => {
    const open = () => { if (row.dataset.c) B.go('/c/' + row.dataset.c); };
    row.onclick = (e) => { if (!e.target.closest('.svx')) open(); };
    row.onkeydown = (e) => { if (e.key === 'Enter' && e.target === row) open(); };
  });
  /** @type {any[]} */ ([...document.querySelectorAll('[data-rm]')]).forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      const row = b.closest('.ds-tr');
      const done = () => { write(read().filter((x) => x.id !== b.dataset.rm)); B.toast('Bookmark removed'); page(); };
      if (!row.animate || calm()) { done(); return; }
      row.style.pointerEvents = 'none';
      row.style.overflow = 'hidden';
      const h = row.getBoundingClientRect().height;
      row.animate([{ opacity: 1, height: h + 'px' }, { opacity: 0, height: '0px', minHeight: '0px', paddingTop: '0px', paddingBottom: '0px' }], { duration: 240, easing: 'ease-out', fill: 'forwards' }).finished.then(done, done);
    };
  });
}
window.SURFACES.bookmarks = page;
window.BOOKMARKS = { has, toggle };
})();
