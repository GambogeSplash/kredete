/* library.js: the Library (sandbox spec 4.3, plan C6; nested domains spec 4.2).
 *
 * Folders are domains. Browsing, the Library shows the folder's sub-folders and then its own
 * pages; at the root, the top-level folders and then the pages with no domain. At every level
 * those pages sit under the container they come from (a space, a repository or a shared drive),
 * and a container's heading opens its home page (library containers spec 2). Searching or
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

/** The list or grid choice is a display preference, like the sidebar's: it lives in this browser only. */
const VIEW_KEY = 'brain-libview';
function savedView() {
  try { return localStorage.getItem(VIEW_KEY) === 'grid' ? 'grid' : 'list'; } catch (e) { return 'list'; }
}
function saveView(view) {
  try { localStorage.setItem(VIEW_KEY, view); } catch (e) { /* storage unavailable: the choice lasts this visit */ }
}
function state() {
  const s = S();
  if (!s.lib) s.lib = { folder: '', q: '', system: '', path: '', source: '', sourceName: '', problems: '', view: savedView(), items: [], next: null, loaded: false, loading: false, error: null, seq: 0, facets: { loading: false, error: null }, facetsRoute: null };
  return s.lib;
}
const { authorityTag, domainCol, domainLabel, kindName, KIND_ICON, emptyFrame, errorFrame } = window.DOCUMENTS;
const openDocument = (id) => window.DOCUMENTS.openDocument(id);
/** Where the document sits in its source (readable names), else the source and domain. */
const subline = (d) => esc(d.path || [B.systemName(d.system), d.domain && d.domain.name].filter(Boolean).join(' · '));
/** Under its container's heading: where it sits inside that container, or nothing. */
const sublineIn = (d) => esc(LB.withinContainer(d.path, d.container.name));
const small = (sub) => (sub ? `<small>${sub}</small>` : '');
const pages = (n) => `${n} ${n === 1 ? 'page' : 'pages'}`;

/* The list view is a table: one header row, then a clickable row per folder or page, on the same
   columns (.libcols in broth-library.css). Folders come first. */
const THEAD = '<div class="ds-tr ds-th libcols" role="row"><span role="columnheader">Name</span><span role="columnheader">Domain</span><span role="columnheader">Type</span><span role="columnheader">Owner</span><span role="columnheader">Updated</span><span aria-hidden="true"></span></div>';
const table = (inner, cap) => `<div class="ds-table libt" role="table" aria-label="Library">${cap || ''}${THEAD}${inner}</div>`;
/** A container's (or the folders') heading: a caption row over its table, a bar over its cards.
 *  With no rows under it, no number. With a home page, the heading is a button that opens it. */
const count = (n) => (n ? `<span class="lcount">${n}</span>` : '');
const homeAttrs = (name, home) => `type="button" data-open="${esc(home)}" aria-label="Open ${esc(name)} home page"`;
const chev = `<span class="lhchev" aria-hidden="true">${ICON('chevr', 14)}</span>`;
const capRow = (icon, name, n, home) => `<div class="ds-tr ds-cap" role="row"><span class="dmn" role="cell">${home ? `<button class="lcthome" ${homeAttrs(name, home)}>${icon}<b>${esc(name)}</b>${count(n)}${chev}</button>` : `${icon}<b>${esc(name)}</b>${count(n)}`}</span></div>`;
const grp = (icon, name, n, key, home) => (home
  ? `<button class="lgrp lgapp lcthome" data-app="${esc(key)}" ${homeAttrs(name, home)}><span class="lst">${icon}</span><b>${esc(name)}</b>${count(n)}${chev}</button>`
  : `<div class="lgrp lgapp" data-app="${esc(key)}"><span class="lst">${icon}</span><b>${esc(name)}</b>${count(n)}</div>`);
/** The container groups at this level, in the order the facets list the sources. */
function containerGroups(items, grid) {
  const order = ((S().facets && S().facets.systems) || []).map((x) => x.value);
  return LB.groups(items, order).map(({ container, system, rows }) => {
    const icon = B.srcIcon(system, grid ? 16 : 20);
    const name = B.containerName(container.name);
    const home = container.home_document_id;
    if (grid) return grp(icon, name, rows.length, system, home) + (rows.length ? `<div class="ggrid">${rows.map((d) => card(d, sublineIn(d))).join('')}</div>` : '');
    // A heading with nothing under it stands alone, without the column header.
    return rows.length ? table(rows.map((d) => row(d, sublineIn(d))).join(''), capRow(icon, name, rows.length, home)) : `<div class="ds-table libt" role="table" aria-label="${esc(name)}">${capRow(icon, name, 0, home)}</div>`;
  });
}
const TINT = { confluence: '#eef3ff', gdrive: '#eef8f2' };
/** A document row. While browsing, every page shown is filed in the folder itself (or, at the
 *  root, in no domain), so its domain label would only repeat the heading. */
function row(d, sub = subline(d)) {
  // The domain label is the cell itself, as in the prototype (its width is the column's).
  const label = domainLabel(d).replace('<span class="llab"', '<span role="cell" class="llab"') || '<span role="cell"></span>';
  const owner = d.owner ? `<span class="lown" role="cell" title="${esc(d.owner.name)}">${AVATAR(d.owner.name, 'lav', 22)}<span class="sr">${esc(d.owner.name)}</span></span>` : '<span class="lown amute" role="cell">None</span>';
  return `<div class="ds-tr lift libcols" data-open="${d.id}" role="row" tabindex="0"><span class="dmn" role="cell">${B.srcIcon(d.system, 22)}<span class="ltb"><span class="lt1"><b>${esc(d.title)}</b>${authorityTag(d)}</span>${small(sub)}</span></span>${label}<span class="amute lty" role="cell">${ICON(KIND_ICON[d.kind] || 'doc', 14)}${esc(kindName(d.kind))}</span>${owner}<span class="amute" role="cell">${B.when(d.last_verified_at, B.fmtDate(d.last_verified_at))}</span><span class="amute lcv" aria-hidden="true">${ICON('chevr', 14)}</span></div>`;
}
function card(d, sub = subline(d)) {
  return `<button type="button" class="gcard" data-open="${d.id}"><span class="gc-p" style="background:${TINT[d.system] || '#f4f4f5'}"><span class="gc-l"><i></i><i></i><i></i></span>${B.srcIcon(d.system, 30)}<span class="gc-k">${esc(kindName(d.kind))}</span></span><span class="gc-t">${esc(d.title)}</span>${small(sub)}<span class="gc-f">${d.owner ? AVATAR(d.owner.name, 'lav', 20) : ''}<span>${esc(d.domain ? d.domain.name : d.owner ? d.owner.name : '')}</span><span class="lsp"></span><span>${B.when(d.last_verified_at, B.fmtDate(d.last_verified_at))}</span></span></button>`;
}
/** The folder drawing from the prototype: a back, a front and a lighter stripe, in the folder's colour. */
const fsvg = (c, px) => `<svg class="fsvg" width="${px}" height="${px}" viewBox="0 0 28 28" aria-hidden="true"><path d="M3 9a3 3 0 0 1 3-3h4.2a2 2 0 0 1 1.5.7l1.3 1.5H22a3 3 0 0 1 3 3v1H3V9z" fill="${c}" opacity=".55"/><rect x="3" y="11" width="22" height="12" rx="3" fill="${c}"/><rect x="3" y="11" width="22" height="3" rx="1.5" fill="#fff" opacity=".22"/></svg>`;
function folderRow(f) {
  return `<a class="ds-tr lift libcols lfold" href="/library/${esc(f.slug)}" data-link data-folder role="row" style="--dc:${domainCol(f.slug)}"><span class="dmn" role="cell"><span class="lfi lfic">${fsvg(domainCol(f.slug), 22)}</span><span class="ltb"><b>${esc(f.name)}</b><small>${pages(f.total)}</small></span></span><span role="cell"></span><span class="amute lty" role="cell">${ICON('folder', 14)}Folder</span><span class="lown" role="cell"></span><span role="cell"></span><span class="amute lcv lchev" aria-hidden="true">${ICON('chevr', 14)}</span></a>`;
}
function folderCard(f) {
  const c = domainCol(f.slug);
  return `<a class="gcard fcard gfold" href="/library/${esc(f.slug)}" data-link data-folder style="--c:${c}" aria-label="${esc(f.name)}, ${pages(f.total)}"><span class="fc-art"><span class="fc-back"></span><span class="fc-sheet s1"><i></i><i></i><i></i></span><span class="fc-sheet s2"><i></i><i></i></span><span class="fc-sheet s3"><i></i><i></i><i></i></span><span class="fc-front"><span class="fc-count">${f.total}</span><span class="fc-app">${ICON('folder', 18)}</span></span></span><span class="gc-t">${esc(f.name)}</span><small>${pages(f.total)}</small></a>`;
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
  // Moving into a folder keeps the search and the filters where they are: no second entrance for them.
  const still = L.pop ? ' data-lf="1"' : '';
  $('#app').innerHTML = `<div class="pg"><h1 id="libh1">Library</h1>
    <div class="libbar"><div class="libs"${still}><span class="libs-i">${ICON('search', 15)}</span><input id="libq" type="search" autocomplete="off" value="${esc(L.q)}"></div>
      <div class="fwrap"><button type="button" class="fbtn ${L.system || L.problems ? 'on' : ''}" id="lfbtn" aria-label="Filter" aria-haspopup="true" aria-expanded="false">${ICON('filter', 15)}<span>${L.system ? esc(B.systemName(L.system)) : 'Filter'}</span></button><div class="fmenu" id="lfmenu" hidden></div></div>
      <div class="seg" role="group" aria-label="View"><button type="button" class="segb ${L.view === 'list' ? 'on' : ''}" data-v="list" aria-label="List view" aria-pressed="${L.view === 'list'}">${ICON('rows', 15)}</button><button type="button" class="segb ${L.view === 'grid' ? 'on' : ''}" data-v="grid" aria-label="Grid view" aria-pressed="${L.view === 'grid'}">${ICON('grid', 15)}</button></div></div>
    <div class="libchips" id="libchips"${still}></div>${L.folder ? `<div class="fhead" id="libhead"${still}><a class="fbk" id="libback" href="/library" data-link title="Back">${ICON('chevl', 18)}</a><span class="fh-i" id="libfi"></span><div class="fh-t"><h2 id="libfolder"></h2><small id="libcount"></small></div></div>` : ''}
    <div class="lbody ${L.view === 'grid' ? 'isgrid' : ''}${L.pop ? ' fin' : ''}" id="libbody"></div><div class="chmore" id="libmore"></div></div>`;
  let timer = 0;
  $('#libq').oninput = (e) => { clearTimeout(timer); timer = setTimeout(() => { L.q = e.target.value.trim(); load(true); }, 220); };
  $$('[data-v]').forEach((b) => { b.onclick = () => { L.view = b.dataset.v; saveView(L.view); page({ domain: L.folder }); }; });
  wireFilterMenu();
  // Once per visit: arriving from another screen, not moving between folders or toggling views.
  L.pop = false;
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
/** The back button to the folder above this one, the folder's name (the heading, and the top bar
 *  on phones, where the heading is hidden), and the search box's words. */
function head() {
  const h1 = $('#libh1');
  if (!h1) return;
  const L = state();
  const tree = folderTree();
  const here = tree && currentFolder(tree);
  const pending = L.folder && here === undefined && (!tree || L.facets.loading);
  const where = here ? here.name : 'the library';
  const input = $('#libq');
  input.placeholder = `Search ${where}`;
  input.setAttribute('aria-label', `Search ${where}`);
  // The folder's banner is built once with the page and filled in here, so it never re-enters.
  const banner = $('#libhead');
  if (banner) {
    const above = here ? T.path(tree, here.id).slice(0, -1) : [];
    const parent = above.length ? above[above.length - 1] : null;
    const back = $('#libback');
    back.href = parent ? `/library/${parent.slug}` : '/library';
    back.setAttribute('aria-label', `Back to ${parent ? parent.name : 'the Library'}`);
    const col = domainCol(L.folder);
    banner.style.setProperty('--c', col);
    $('#libfi').innerHTML = fsvg(col, 44);
    $('#libfolder').innerHTML = here ? esc(here.name) : pending ? '<i class="pvsk libhsk"></i><span class="sr">Loading the folder</span>' : '';
    $('#libcount').textContent = here ? pages(here.total) : '';
  }
  B.mbTitle();
}
function wireFilterMenu() {
  const L = state();
  const button = $('#lfbtn'), menu = $('#lfmenu');
  const close = () => { menu.hidden = true; button.setAttribute('aria-expanded', 'false'); document.removeEventListener('mousedown', outside); };
  const outside = (e) => { if (!e.target.closest('.fwrap')) close(); };
  const open = () => {
    const f = S().facets || { systems: [] };
    const opt = (key, value, label, n, icon) => `<button type="button" class="fopt ${L[key] === value ? 'on' : ''}" data-fk="${key}" data-fv="${esc(value)}">${icon ? `<span class="fopt-i" aria-hidden="true">${icon}</span>` : ''}<span>${esc(label)}</span>${n != null ? `<em>${n}</em>` : ''}</button>`;
    const total = f.systems.reduce((n, s) => n + s.count, 0);
    menu.innerHTML = `<div class="fgh">Source</div>${opt('system', '', 'All sources', total)}${f.systems.map((s) => opt('system', s.value, B.systemName(s.value), s.count, B.srcIcon(s.value, 16))).join('')}${typeof f.label_problems === 'number' ? `<div class="fgh">Labels</div>${opt('problems', '', 'Any labels', null)}${opt('problems', '1', 'Label problems', f.label_problems)}` : ''}`;
    menu.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    document.addEventListener('mousedown', outside);
    $$('[data-fk]', menu).forEach((b) => { b.onclick = () => { L[b.dataset.fk] = b.dataset.fv; close(); page({ domain: L.folder }); load(true); }; });
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
  if (L.source) filters.push(['source', `Source: ${L.sourceName}`]);
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
      if (k === 'all') { L.system = ''; L.path = ''; L.source = ''; L.problems = ''; } else L[k] = '';
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
    L.items = reset ? B.rows(result) : L.items.concat(B.rows(result));
    L.next = B.cursorOf(result);
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
const cards = (html) => (state().view === 'grid' ? `<div class="ggrid">${html}</div>` : table(html));
/** Skeleton rows keep the height of the rows they stand in for, so nothing moves on load. */
const skeletonTr = (n) => Array.from({ length: n }, (_, i) => `<div class="ds-tr libcols skrow-t" aria-hidden="true"><span class="dmn"><i class="pvsk skic"></i><span class="ltb"><i class="pvsk" style="width:${[46, 62, 38, 54, 44][i % 5]}%"></i><i class="pvsk sksub" style="width:${[22, 30, 18, 26, 20][i % 5]}%"></i></span></span></div>`).join('');
const docSkeleton = () => (state().view === 'grid'
  ? `<div class="ggrid" aria-hidden="true">${Array.from({ length: 6 }, () => '<span class="gcard skcard"><span class="gc-p"></span><i class="pvsk" style="width:70%"></i><i class="pvsk" style="width:45%"></i></span>').join('')}</div>`
  : `<div role="status"><span class="sr">Loading the library</span>${table(skeletonTr(8))}</div>`);
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
    body.innerHTML = L.facets.loading ? docSkeleton() : emptyFrame('folder', 'Folder not found', "It doesn't exist, has moved, or holds nothing you can open.", '<a class="btn sm" href="/library" data-link>Go to the Library</a>');
    $('#libmore').innerHTML = '';
    return;
  }
  // Folders come first while browsing: skeletons until the facets first load, or their error.
  const folders = browsing && tree ? T.children(tree, here ? here.id : null) : [];
  let before = '';
  let skeletonFolders = false;
  if (browsing && !tree) {
    before = L.facets.error ? `<div class="ds-empty errstate" role="alert"><span class="ds-empty-ic">${ICON('refresh', 20)}</span><b>Couldn't load the folders</b><p>${esc(B.problem(L.facets.error))}</p><button type="button" class="btn sm" id="libfretry">Try again</button></div>` : '';
    skeletonFolders = !L.facets.error;
  }
  const folderHtml = folders.map(grid ? folderCard : folderRow).join('');
  let docHtml = '';
  let after = '';
  if (!L.loaded && L.error) after = errorFrame(L.error, 'libretry');
  else if (!L.loaded) after = '';
  else if (L.items.length) docHtml = L.items.map((d) => (grid ? card(d) : row(d))).join('');
  else if (!browsing) after = emptyFrame('search', 'Nothing matches', L.system || L.path || L.source || L.problems ? 'Try other words or clear a filter.' : 'Try a different word.');
  else if (!folders.length && tree) {
    after = here
      ? emptyFrame('folder', 'Nothing here yet', `Pages filed in ${esc(here.name)} appear here.`)
      : emptyFrame('library', 'Nothing here yet', B.can('sources.manage') ? 'Connect a source in Admin, Connectors.' : 'Documents you can open appear here once your admin connects a source.');
  }
  // Folders still loading hold their place as rows (a grid shows none), inside the one table.
  const lead = skeletonFolders && !grid ? skeletonTr(3) : '';
  // Browsing, at the root and in every folder, the pages sit under the container they come from;
  // the folders (domains span containers) get their own group first. Searching or filtering, it is
  // one flat list.
  const grouped = browsing && (L.items.length > 0 || folders.length > 0);
  // Pages still loading: their rows are held in place under the folders, so nothing moves when they land.
  const pending = !L.loaded && !L.error && folders.length > 0;
  const pendingRows = pending ? (grid ? Array.from({ length: 3 }, () => '<span class="gcard skcard" aria-hidden="true"><span class="gc-p"></span><i class="pvsk" style="width:70%"></i><i class="pvsk" style="width:45%"></i></span>').join('') : skeletonTr(3)) : '';
  let main;
  if (pending) {
    main = grid ? grp(ICON('folder', 16), 'Folders', folders.length, 'folders') + `<div class="ggrid">${folderHtml}</div><div class="ggrid">${pendingRows}</div>` : table(folderHtml, capRow(ICON('folder', 20), 'Folders', folders.length)) + `<div role="status"><span class="sr">Loading the library</span>${table(pendingRows)}</div>`;
  } else if (grouped) {
    const parts = [];
    if (lead) parts.push(table(lead));
    if (folders.length) parts.push(grid ? grp(ICON('folder', 16), 'Folders', folders.length, 'folders') + `<div class="ggrid">${folderHtml}</div>` : table(folderHtml, capRow(ICON('folder', 20), 'Folders', folders.length)));
    parts.push(...containerGroups(L.items, grid));
    main = parts.join('');
  } else {
    const rows = lead + folderHtml + docHtml;
    main = rows ? cards(rows) : '';
  }
  body.innerHTML = before + main + after;

  const fretry = $('#libfretry');
  if (fretry) fretry.onclick = () => { loadFacets(); draw(); };
  const retry = $('#libretry');
  if (retry) retry.onclick = () => load(true);
  // Rows take their place in the stagger (the folder's own entrance, .fin, reads --i).
  $$('.ds-tr:not(.ds-th):not(.skrow-t),.gcard', body).forEach((r, i) => r.style.setProperty('--i', String(i)));
  $$('[data-open]', body).forEach((r) => {
    const go = () => openDocument(r.dataset.open);
    r.onclick = go;
    r.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } };
  });
  // Folders are links, which Enter opens; Space opens them too, as it does a document row.
  $$('[data-folder]', body).forEach((a) => { a.addEventListener('click', () => { L.pop = true; }); a.onkeydown = (e) => { if (e.key === ' ') { e.preventDefault(); a.click(); } }; });
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
/**
 * Shows the whole Library filtered to one source: what the Support agent's "Open in Library"
 * opens, so an admin can promote its pages to Public (bot admin spec 9.2).
 * @param {{ id: string, path: string }} container
 */
function showSource(container) {
  const L = state();
  // Only that source: no search, and no filter left from earlier, would hide any of its pages.
  L.source = container.id;
  L.sourceName = B.containerName(container.path);
  L.path = '';
  L.q = '';
  L.system = '';
  L.problems = '';
  L.loaded = false;
  B.go('/library');
}

/* ---------- Connectors for everyone: which apps Broth reads, read only ---------- */
const READ_APPS = [
  { value: 'confluence', name: 'Confluence', logo: 'confluence', unit: 'pages' },
  { value: 'gdrive', name: 'Google Drive', logo: 'gdrive', unit: 'files' },
  { value: 'github_docs', name: 'Docs repositories', logo: 'github', unit: 'pages' },
  { value: 'notion', name: 'Notion', logo: 'notion', unit: '', soon: true },
  { value: 'gcs', name: 'Google Cloud Storage', logo: 'google-cloud-storage', unit: '', soon: true },
  { value: 'slack', name: 'Slack', logo: 'slack', unit: '', soon: true },
  { value: 'sharepoint', name: 'SharePoint', logo: 'sharepoint', unit: '', soon: true },
];
function connectorsPage() {
  if (B.can('sources.manage')) { B.go('/admin/sources'); return; }
  const draw = () => {
    const live = (S().facets && S().facets.systems) || [];
    const card = (app) => {
      const hit = live.find((x) => x.value === app.value);
      const tag = hit ? '<span class="tag ok">Connected</span>' : app.soon ? '<span class="tag">Soon</span>' : '<span class="tag">Not connected</span>';
      const line = hit ? `${hit.count} ${hit.count === 1 ? app.unit.replace(/s$/, '') : app.unit} you can open` : app.soon ? 'Coming soon.' : 'Admin only';
      const act = hit ? `<div class="adscf"><button type="button" class="btn sm" data-lib="${app.value}">Open library</button></div>` : '';
      return `<div class="ds-card adsc${app.soon ? ' soonc' : ''}"><div class="adsch"><span class="adsl">${B.srcIcon(app.logo, 28)}</span><div><b>${esc(app.name)}</b><small>${esc(line)}</small></div>${tag}</div>${act}</div>`;
    };
    $('#app').innerHTML = `<div class="pg"><h1>Connectors</h1><div class="ds-grid c3">${READ_APPS.map(card).join('')}</div></div>`;
    $$('[data-lib]').forEach((b) => { b.onclick = () => { const L = state(); L.system = b.dataset.lib; L.loaded = false; B.go('/library'); }; });
  };
  draw();
  if (!S().facets) loadFacets().then(() => { if (S().route.surface === 'connectors') draw(); });
}
window.SURFACES.connectors = connectorsPage;
window.LIBRARY = { showLocation, showSource };
})();
