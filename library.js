/* library.js: the Library (sandbox spec 4.3, plan C6).
 *
 * GET /v1/documents with the system, domain, path and title filters (all combinable), and
 * /v1/facets for the filter counts. Admins and domain owners can filter the Library to label
 * problems (labelling spec 4.2). A document opens in the drawer (document-drawer.js).
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

function state() {
  const s = S();
  if (!s.lib) s.lib = { q: '', system: '', domain: '', path: '', problems: '', view: 'list', items: [], next: null, loaded: false, loading: false, error: null, seq: 0 };
  return s.lib;
}
const { authorityTag, domainCol, domainLabel, kindName, KIND_ICON } = window.DOCUMENTS;
const openDocument = (id) => window.DOCUMENTS.openDocument(id);
/** Where the document sits in its source (readable names), else the source and domain. */
const subline = (d) => esc(d.path || [B.systemName(d.system), d.domain && d.domain.name].filter(Boolean).join(' · '));

function row(d) {
  return `<div class="lrow" data-open="${d.id}" role="button" tabindex="0"><span class="lst">${B.srcIcon(d.system, 18)}</span><span class="ltt"><span>${esc(d.title)}</span><small class="lpath">${subline(d)}</small></span><span class="lr">${authorityTag(d)}${domainLabel(d)}<span class="ldoc">${ICON(KIND_ICON[d.kind] || 'doc', 14)}${esc(kindName(d.kind))}</span>${d.owner ? AVATAR(d.owner.name, 'lav', 22) : '<span class="lavsp" aria-hidden="true"></span>'}<span class="ldt">${B.when(d.last_verified_at, B.fmtDate(d.last_verified_at))}</span></span></div>`;
}
function card(d) {
  return `<button type="button" class="gcard" data-open="${d.id}"><span class="gc-p" style="background:${d.system === 'confluence' ? '#eef3ff' : '#eef8f2'}"><span class="gc-l"><i></i><i></i><i></i></span>${B.srcIcon(d.system, 30)}<span class="gc-k">${esc(kindName(d.kind))}</span></span><span class="gc-t">${esc(d.title)}</span><small>${subline(d)}</small><span class="gc-f">${d.owner ? AVATAR(d.owner.name, 'lav', 20) : ''}<span>${esc(d.owner ? d.owner.name : '')}</span><span class="lsp"></span><span>${B.when(d.last_verified_at, B.fmtDate(d.last_verified_at))}</span></span></button>`;
}

/* ---------- the page ---------- */
function page() {
  const L = state();
  $('#app').innerHTML = `<div class="pg"><h1>Library</h1>
    <div class="libbar"><div class="libs"><span class="libs-i">${ICON('search', 15)}</span><input id="libq" type="search" placeholder="Search the library" aria-label="Search the library" value="${esc(L.q)}" autocomplete="off"></div>
      <div class="fwrap"><button type="button" class="fbtn ${L.system || L.domain || L.problems ? 'on' : ''}" id="lfbtn" aria-label="Filter" aria-haspopup="true" aria-expanded="false">${ICON('filter', 15)}<span>Filter</span></button><div class="fmenu" id="lfmenu" hidden></div></div>
      <div class="seg" role="group" aria-label="View"><button type="button" class="segb ${L.view === 'list' ? 'on' : ''}" data-v="list" aria-label="List view" aria-pressed="${L.view === 'list'}">${ICON('rows', 15)}</button><button type="button" class="segb ${L.view === 'grid' ? 'on' : ''}" data-v="grid" aria-label="Grid view" aria-pressed="${L.view === 'grid'}">${ICON('grid', 15)}</button></div></div>
    <div class="libchips" id="libchips"></div>
    <div class="lbody ${L.view === 'grid' ? 'isgrid' : ''}" id="libbody"></div><div class="chmore" id="libmore"></div></div>`;
  let timer = 0;
  $('#libq').oninput = (e) => { clearTimeout(timer); timer = setTimeout(() => { L.q = e.target.value.trim(); load(true); }, 220); };
  $$('[data-v]').forEach((b) => { b.onclick = () => { L.view = b.dataset.v; page(); }; });
  wireFilterMenu();
  chips();
  if (!L.loaded || L.error) load(true); else draw();
  const panel = $('.mainpanel');
  const onScroll = () => { if (S().route.surface !== 'library') return; const m = $('#app'); if (m && m.scrollTop + m.clientHeight > m.scrollHeight - 300) load(false); };
  $('#app').onscroll = onScroll;
  if (panel) panel.onscroll = onScroll;
}
function wireFilterMenu() {
  const L = state();
  const button = $('#lfbtn'), menu = $('#lfmenu');
  const close = () => { menu.hidden = true; button.setAttribute('aria-expanded', 'false'); document.removeEventListener('mousedown', outside); };
  const outside = (e) => { if (!e.target.closest('.fwrap')) close(); };
  const open = () => {
    const f = S().facets || { systems: [], domains: [] };
    const opt = (key, value, label, n, icon) => `<button type="button" class="fopt ${L[key] === value ? 'on' : ''}" data-fk="${key}" data-fv="${esc(value)}">${icon || ''}<span>${esc(label)}</span>${n != null ? `<em>${n}</em>` : ''}</button>`;
    const total = f.systems.reduce((n, s) => n + s.count, 0);
    menu.innerHTML = `<div class="fgh">Source</div>${opt('system', '', 'All sources', total)}${f.systems.map((s) => opt('system', s.value, B.systemName(s.value), s.count, B.srcIcon(s.value, 16))).join('')}${f.domains.length ? `<div class="fgh">Domain</div>${opt('domain', '', 'All domains', null)}${f.domains.map((d) => opt('domain', d.value, d.label, d.count, `<i class="fdot" style="background:${domainCol(d.value)}"></i>`)).join('')}` : ''}${typeof f.label_problems === 'number' ? `<div class="fgh">Labels</div>${opt('problems', '', 'Any labels', null)}${opt('problems', '1', 'Label problems', f.label_problems)}` : ''}`;
    menu.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    document.addEventListener('mousedown', outside);
    $$('[data-fk]', menu).forEach((b) => { b.onclick = () => { L[b.dataset.fk] = b.dataset.fv; close(); page(); load(true); }; });
    const first = $('.fopt', menu);
    if (first) first.focus();
  };
  button.onclick = () => (menu.hidden ? open() : close());
  menu.onkeydown = (e) => { if (e.key === 'Escape') { close(); button.focus(); } };
}
function chips() {
  const L = state();
  const f = S().facets || { domains: [] };
  const list = [];
  if (L.system) list.push(['system', B.systemName(L.system)]);
  if (L.domain) list.push(['domain', (f.domains.find((d) => d.value === L.domain) || { label: L.domain }).label]);
  if (L.path) list.push(['path', `Folder: ${L.path}`]);
  if (L.problems) list.push(['problems', 'Label problems']);
  const box = $('#libchips');
  box.innerHTML = list.map(([k, label]) => `<button type="button" class="lchip on" data-clear="${k}" aria-label="Remove filter ${esc(label)}">${esc(label)}${ICON('x', 12)}</button>`).join('') + (list.length > 1 ? '<button type="button" class="link" data-clear="all">Clear all</button>' : '') + (L.problems ? window.DOCS.link('findLabelProblems', 'Fixing label problems') : '');
  box.hidden = !list.length;
  $$('[data-clear]', box).forEach((b) => {
    b.onclick = () => {
      if (b.dataset.clear === 'all') { L.system = ''; L.domain = ''; L.path = ''; L.problems = ''; } else L[b.dataset.clear] = '';
      page(); load(true);
    };
  });
}
async function load(reset) {
  const L = state();
  if (!reset && (L.loading || !L.next)) return;
  const mine = ++L.seq;
  L.loading = true;
  L.error = null;
  if (reset) { L.items = []; L.next = null; L.loaded = false; draw(); }
  else drawMore();
  try {
    const result = await B.api.get('/documents', { q: L.q || null, system: L.system || null, domain: L.domain || null, path: L.path || null, label_problems: L.problems ? true : null, limit: 40, cursor: reset ? null : L.next });
    if (mine !== L.seq) return;
    L.items = reset ? result.items : L.items.concat(result.items);
    L.next = result.next_cursor || null;
    L.loaded = true;
  } catch (error) {
    if (mine !== L.seq) return;
    L.error = error;
  } finally {
    if (mine === L.seq) L.loading = false;
  }
  if (S().route.surface === 'library' && mine === L.seq) draw();
}
function draw() {
  const L = state();
  const body = $('#libbody');
  if (!body) return;
  if (!L.loaded && L.error) {
    body.innerHTML = B.errorBlock(L.error, 'libretry');
    $('#libretry').onclick = () => load(true);
    drawMore();
    return;
  }
  if (!L.loaded) {
    body.innerHTML = L.view === 'grid'
      ? `<div class="ggrid" aria-hidden="true">${Array.from({ length: 6 }, () => '<span class="gcard skcard"><span class="gc-p"></span><i class="pvsk" style="width:70%"></i><i class="pvsk" style="width:45%"></i></span>').join('')}</div>`
      : `<div class="skwrap" role="status"><span class="sr">Loading the library</span>${B.skeletonRows(8, 'lrow')}</div>`;
    drawMore();
    return;
  }
  if (!L.items.length) {
    const filtered = L.q || L.system || L.domain || L.path;
    body.innerHTML = B.emptyBlock(filtered ? 'Nothing matches' : 'Nothing here yet', filtered ? 'Try other words or clear a filter.' : B.isAdmin() ? 'Connect a source in Admin, Connectors.' : 'Documents you can open appear here once your admin connects a source.');
    drawMore();
    return;
  }
  body.innerHTML = L.view === 'grid' ? `<div class="ggrid">${L.items.map(card).join('')}</div>` : L.items.map(row).join('');
  $$('[data-open]', body).forEach((r, i) => {
    r.style.setProperty('--i', String(Math.min(i, 12)));
    const go = () => openDocument(r.dataset.open);
    r.onclick = go;
    r.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } };
  });
  drawMore();
}
function drawMore() {
  const L = state();
  const box = $('#libmore');
  if (!box) return;
  if (L.loaded && L.error) {
    box.innerHTML = `<span class="amute">${esc(B.problem(L.error))}</span> <button type="button" class="link" id="libmoreretry">Try again</button>`;
    $('#libmoreretry').onclick = () => { L.error = null; load(false); };
  } else if (L.loaded && L.next) {
    box.innerHTML = `<button type="button" class="btn sm" id="libmorebtn" ${L.loading ? 'disabled' : ''}>${L.loading ? 'Loading' : 'Show more'}</button>`;
    $('#libmorebtn').onclick = () => load(false);
  } else box.innerHTML = '';
}
window.SURFACES.library = page;

/** Shows the Library filtered to a place in the source (the drawer's Folder link). */
function showLocation(path) {
  const L = state();
  L.path = path;
  L.q = '';
  if (S().route.surface === 'library') { page(); load(true); } else { L.loaded = false; B.go('/library'); }
}
window.LIBRARY = { showLocation };
})();
