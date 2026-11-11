/* library.js: the Library (sandbox spec 4.3, plan C6; nested domains spec 4.2).
 *
 * Folders are domains. Browsing, the Library shows the folder's sub-folders and then its own
 * pages; at the root, the top-level folders and then the pages with no domain. Searching or
 * filtering turns it into the flat list of results, scoped to the folder it is in.
 * library-browse.js decides which, and the documents query each needs; domain-tree.js builds
 * the folders from /v1/facets, which the Library reads again each time it opens. The folder is
 * in the URL (/library/<slug>), so back, forward and links work. Admins and domain owners can
 * filter to label problems (labelling spec 4.2). A document opens in the drawer
 * (document-drawer.js).
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
const T = window.DOMAIN_TREE;
const LB = window.LIBRARY_BROWSE;

function state() {
  const s = S();
  if (!s.lib) s.lib = { folder: '', q: '', system: '', path: '', problems: '', view: 'list', items: [], next: null, loaded: false, loading: false, error: null, seq: 0, facets: { loading: false, error: null }, facetsRoute: null };
  return s.lib;
}
const { authorityTag, domainCol, domainLabel, kindName, KIND_ICON } = window.DOCUMENTS;
const openDocument = (id) => window.DOCUMENTS.openDocument(id);
/** Where the document sits in its source (readable names), else the source and domain. */
const subline = (d) => esc(d.path || [B.systemName(d.system), d.domain && d.domain.name].filter(Boolean).join(' · '));
const pages = (n) => `${n} ${n === 1 ? 'page' : 'pages'}`;

/** A document row. While browsing, every page shown is filed in the folder itself (or, at the
 *  root, in no domain), so its domain label would only repeat the heading. */
function row(d) {
  const label = LB.mode(state()) === 'search' ? domainLabel(d) : '';
  return `<div class="lrow" data-open="${d.id}" role="button" tabindex="0"><span class="lst">${B.srcIcon(d.system, 18)}</span><span class="ltt"><span>${esc(d.title)}</span><small class="lpath">${subline(d)}</small></span><span class="lr">${authorityTag(d)}${label}<span class="ldoc">${ICON(KIND_ICON[d.kind] || 'doc', 14)}${esc(kindName(d.kind))}</span>${d.owner ? AVATAR(d.owner.name, 'lav', 22) : '<span class="lavsp" aria-hidden="true"></span>'}<span class="ldt">${B.when(d.last_verified_at, B.fmtDate(d.last_verified_at))}</span></span></div>`;
}
function card(d) {
  return `<button type="button" class="gcard" data-open="${d.id}"><span class="gc-p" style="background:${d.system === 'confluence' ? '#eef3ff' : '#eef8f2'}"><span class="gc-l"><i></i><i></i><i></i></span>${B.srcIcon(d.system, 30)}<span class="gc-k">${esc(kindName(d.kind))}</span></span><span class="gc-t">${esc(d.title)}</span><small>${subline(d)}</small><span class="gc-f">${d.owner ? AVATAR(d.owner.name, 'lav', 20) : ''}<span>${esc(d.owner ? d.owner.name : '')}</span><span class="lsp"></span><span>${B.when(d.last_verified_at, B.fmtDate(d.last_verified_at))}</span></span></button>`;
}
function folderRow(f) {
  return `<a class="lrow lfold" href="/library/${esc(f.slug)}" data-link data-folder style="--dc:${domainCol(f.slug)}"><span class="lst lfic">${ICON('folder', 18)}</span><span class="ltt"><span>${esc(f.name)}</span><small class="lpath">${pages(f.total)}</small></span><span class="lr"><span class="lchev">${ICON('chevr', 16)}</span></span></a>`;
}
function folderCard(f) {
  return `<a class="gcard gfold" href="/library/${esc(f.slug)}" data-link data-folder style="--dc:${domainCol(f.slug)}"><span class="gc-p">${ICON('folder', 30)}<span class="gc-k">Folder</span></span><span class="gc-t">${esc(f.name)}</span><small>${pages(f.total)}</small></a>`;
}

/* ---------- folders ---------- */
/** The folders the person can open, from the facets; null until the facets first load. */
function folderTree() {
  return S().facets ? T.tree(LB.folders(S().facets)) : null;
}
/** The current folder: null at the root, undefined when the facets do not list it (yet). */
function currentFolder(tree) {
  const L = state();
  if (!L.folder) return null;
  return [...tree.items.values()].find((f) => f.slug === L.folder);
}
/** Folders drive navigation, so the Library reads the facets again each time it opens. */
async function loadFacets() {
  const L = state();
  L.facets = { loading: true, error: null };
  try {
    S().facets = await B.readFacets();
    L.facets = { loading: false, error: null };
  } catch (error) {
    L.facets = { loading: false, error };
  }
  if (S().route.surface === 'library') { head(); chips(); draw(); }
}

/* ---------- the page ---------- */
function page(params) {
  const L = state();
  const folder = (params && params.domain) || '';
  const moved = folder !== L.folder;
  if (moved) { L.folder = folder; L.loaded = false; L.items = []; L.next = null; }
  $('#app').innerHTML = `<div class="pg"><nav class="libcrumb" id="libcrumb" aria-label="Folders" hidden></nav><h1 id="libh1">Library</h1>
    <div class="libbar"><div class="libs"><span class="libs-i">${ICON('search', 15)}</span><input id="libq" type="search" autocomplete="off" value="${esc(L.q)}"></div>
      <div class="fwrap"><button type="button" class="fbtn ${L.system || L.problems ? 'on' : ''}" id="lfbtn" aria-label="Filter" aria-haspopup="true" aria-expanded="false">${ICON('filter', 15)}<span>Filter</span></button><div class="fmenu" id="lfmenu" hidden></div></div>
      <div class="seg" role="group" aria-label="View"><button type="button" class="segb ${L.view === 'list' ? 'on' : ''}" data-v="list" aria-label="List view" aria-pressed="${L.view === 'list'}">${ICON('rows', 15)}</button><button type="button" class="segb ${L.view === 'grid' ? 'on' : ''}" data-v="grid" aria-label="Grid view" aria-pressed="${L.view === 'grid'}">${ICON('grid', 15)}</button></div></div>
    <div class="libchips" id="libchips"></div>
    <div class="lbody ${L.view === 'grid' ? 'isgrid' : ''}" id="libbody"></div><div class="chmore" id="libmore"></div></div>`;
  let timer = 0;
  $('#libq').oninput = (e) => { clearTimeout(timer); timer = setTimeout(() => { L.q = e.target.value.trim(); load(true); }, 220); };
  $$('[data-v]').forEach((b) => { b.onclick = () => { L.view = b.dataset.v; page({ domain: L.folder }); }; });
  wireFilterMenu();
  // Once per visit: arriving from another screen, not moving between folders or toggling views.
  const route = S().route;
  if (!S().facets || (route.from !== 'library' && L.facetsRoute !== route)) { L.facetsRoute = route; loadFacets(); }
  head();
  chips();
  if (!L.loaded || L.error) load(true); else draw();
  const panel = $('.mainpanel');
  if (moved) { $('#app').scrollTop = 0; if (panel) panel.scrollTop = 0; }
  const onScroll = () => { if (S().route.surface !== 'library') return; const m = $('#app'); if (m && m.scrollTop + m.clientHeight > m.scrollHeight - 300) load(false); };
  $('#app').onscroll = onScroll;
  if (panel) panel.onscroll = onScroll;
}
/** The breadcrumb of the folders above this one, the folder's name (the heading, and the top bar
 *  on phones, where the heading is hidden), and the search box's words. */
function head() {
  const crumb = $('#libcrumb'), h1 = $('#libh1');
  if (!crumb) return;
  const L = state();
  const tree = folderTree();
  const here = tree && currentFolder(tree);
  const pending = L.folder && here === undefined && (!tree || L.facets.loading);
  const where = here ? here.name : 'the library';
  const input = $('#libq');
  input.placeholder = `Search ${where}`;
  input.setAttribute('aria-label', `Search ${where}`);
  const above = here ? T.path(tree, here.id).slice(0, -1) : [];
  crumb.hidden = !here && !pending;
  crumb.innerHTML = [{ slug: '', name: 'Library' }, ...above].map((f) => `<a href="/library${f.slug ? '/' + esc(f.slug) : ''}" data-link>${esc(f.name)}</a><i aria-hidden="true">/</i>`).join('');
  h1.innerHTML = here ? esc(here.name) : pending ? '<i class="pvsk libhsk"></i><span class="sr">Loading the folder</span>' : 'Library';
  S().route.title = here ? here.name : '';
  B.mbTitle();
}
function wireFilterMenu() {
  const L = state();
  const button = $('#lfbtn'), menu = $('#lfmenu');
  const close = () => { menu.hidden = true; button.setAttribute('aria-expanded', 'false'); document.removeEventListener('mousedown', outside); };
  const outside = (e) => { if (!e.target.closest('.fwrap')) close(); };
  const open = () => {
    const f = S().facets || { systems: [] };
    const opt = (key, value, label, n, icon) => `<button type="button" class="fopt ${L[key] === value ? 'on' : ''}" data-fk="${key}" data-fv="${esc(value)}">${icon || ''}<span>${esc(label)}</span>${n != null ? `<em>${n}</em>` : ''}</button>`;
    const total = f.systems.reduce((n, s) => n + s.count, 0);
    menu.innerHTML = `<div class="fgh">Source</div>${opt('system', '', 'All sources', total)}${f.systems.map((s) => opt('system', s.value, B.systemName(s.value), s.count, B.srcIcon(s.value, 16))).join('')}${typeof f.label_problems === 'number' ? `<div class="fgh">Labels</div>${opt('problems', '', 'Any labels', null)}${opt('problems', '1', 'Label problems', f.label_problems)}` : ''}`;
    menu.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    document.addEventListener('mousedown', outside);
    $$('[data-fk]', menu).forEach((b) => { b.onclick = () => { L[b.dataset.fk] = b.dataset.fv; close(); page({ domain: L.folder }); load(true); }; });
    const first = $('.fopt', menu);
    if (first) first.focus();
  };
  button.onclick = () => (menu.hidden ? open() : close());
  menu.onkeydown = (e) => { if (e.key === 'Escape') { close(); button.focus(); } };
}
function chips() {
  const L = state();
  const box = $('#libchips');
  if (!box) return;
  const filters = [];
  if (L.system) filters.push(['system', B.systemName(L.system)]);
  if (L.path) filters.push(['path', `Location: ${L.path}`]);
  if (L.problems) filters.push(['problems', 'Label problems']);
  const tree = folderTree();
  const here = tree && currentFolder(tree);
  const list = [...(LB.mode(L) === 'search' && here ? [['folder', `In ${here.name}`]] : []), ...filters];
  box.innerHTML = list.map(([k, label]) => `<button type="button" class="lchip on" data-clear="${k}" aria-label="Remove filter ${esc(label)}">${esc(label)}${ICON('x', 12)}</button>`).join('') + (filters.length > 1 ? '<button type="button" class="link" data-clear="all">Clear all</button>' : '') + (L.problems ? window.DOCS.link('findLabelProblems', 'Fixing label problems') : '');
  box.hidden = !list.length;
  $$('[data-clear]', box).forEach((b) => {
    b.onclick = () => {
      const k = b.dataset.clear;
      if (k === 'folder') { B.go('/library'); return; } // the same search, across the whole Library
      if (k === 'all') { L.system = ''; L.path = ''; L.problems = ''; } else L[k] = '';
      page({ domain: L.folder }); load(true);
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
    const result = await B.api.get('/documents', { ...LB.request(L), limit: 40, cursor: reset ? null : L.next });
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
  if (S().route.surface === 'library' && mine === L.seq) { chips(); draw(); }
}

/** Rows in the list view, cards in the grid. */
const cards = (html) => (state().view === 'grid' ? `<div class="ggrid">${html}</div>` : html);
const docSkeleton = () => (state().view === 'grid'
  ? `<div class="ggrid" aria-hidden="true">${Array.from({ length: 6 }, () => '<span class="gcard skcard"><span class="gc-p"></span><i class="pvsk" style="width:70%"></i><i class="pvsk" style="width:45%"></i></span>').join('')}</div>`
  : `<div class="skwrap" role="status"><span class="sr">Loading the library</span>${B.skeletonRows(8, 'lrow')}</div>`);
function draw() {
  const L = state();
  const body = $('#libbody');
  if (!body) return;
  const grid = L.view === 'grid';
  const browsing = LB.mode(L) === 'browse';
  const tree = folderTree();
  const here = tree && currentFolder(tree);
  // Drawing again replaces the rows; whoever was on one with the keyboard stays on it.
  const active = /** @type {HTMLElement | null} */ (document.activeElement);
  const focused = active && body.contains(active) ? (active.dataset.open ? `[data-open="${active.dataset.open}"]` : active.matches('[data-folder]') ? `[data-folder][href="${active.getAttribute('href')}"]` : null) : null;
  if (browsing && tree && here === undefined) {
    // A slug the facets do not list: the fresh facets may still be on their way.
    body.innerHTML = L.facets.loading ? docSkeleton() : B.emptyBlock('Folder not found', "It doesn't exist, has moved, or holds nothing you can open.", '<a class="btn sm" href="/library" data-link>Go to the Library</a>');
    $('#libmore').innerHTML = '';
    return;
  }
  // Folders come first while browsing: skeletons until the facets first load, or their error.
  const folders = browsing && tree ? T.children(tree, here ? here.id : null) : [];
  let before = '';
  if (browsing && !tree) {
    before = L.facets.error ? `<div class="libferr" role="alert"><span>Couldn't load the folders. ${esc(B.problem(L.facets.error))}</span><button type="button" class="link" id="libfretry">Try again</button></div>` : grid ? '' : `<div class="skwrap" role="status"><span class="sr">Loading folders</span>${B.skeletonRows(3, 'lrow')}</div>`;
  }
  const folderHtml = folders.map(grid ? folderCard : folderRow).join('');
  let docHtml = '';
  let after = '';
  if (!L.loaded && L.error) after = B.errorBlock(L.error, 'libretry');
  else if (!L.loaded) after = folders.length ? '' : docSkeleton();
  else if (L.items.length) docHtml = L.items.map(grid ? card : row).join('');
  else if (!browsing) after = B.emptyBlock('Nothing matches', 'Try other words or clear a filter.');
  else if (!folders.length && tree) {
    after = here
      ? B.emptyBlock('Nothing here yet', `Pages filed in ${esc(here.name)} appear here.`)
      : B.emptyBlock('Nothing here yet', B.isAdmin() ? 'Connect a source in Admin, Connectors.' : 'Documents you can open appear here once your admin connects a source.');
  }
  body.innerHTML = before + (folderHtml || docHtml ? cards(folderHtml + docHtml) : '') + after;
  const fretry = $('#libfretry');
  if (fretry) fretry.onclick = () => { loadFacets(); draw(); };
  const retry = $('#libretry');
  if (retry) retry.onclick = () => load(true);
  $$('[data-open]', body).forEach((r, i) => {
    r.style.setProperty('--i', String(Math.min(i, 12)));
    const go = () => openDocument(r.dataset.open);
    r.onclick = go;
    r.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } };
  });
  // Folders are links, which Enter opens; Space opens them too, as it does a document row.
  $$('[data-folder]', body).forEach((a) => { a.onkeydown = (e) => { if (e.key === ' ') { e.preventDefault(); a.click(); } }; });
  const again = focused && $(focused, body);
  if (again) again.focus({ preventScroll: true });
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

/** Shows the whole Library filtered to a place in the source (the drawer's Location link). */
function showLocation(path) {
  const L = state();
  L.path = path;
  L.q = '';
  L.loaded = false;
  if (S().route.surface === 'library' && !L.folder) { page({ domain: '' }); load(true); } else B.go('/library');
}
window.LIBRARY = { showLocation };
})();
