/* library.js: the Library (sandbox spec 4.3, plan C6) and the document drawer.
 *
 * GET /v1/documents with the system, domain, path and title filters (all combinable),
 * /v1/facets for the filter counts, and /v1/documents/{id} for the drawer. "Open in source"
 * replaces "Request access": people ask for access in Confluence or Drive. A document can be
 * proposed for wider sharing (a promotion); admins and compliance see its lineage.
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
  if (!s.lib) s.lib = { q: '', system: '', domain: '', path: '', view: 'list', items: [], next: null, loaded: false, loading: false, error: null, seq: 0 };
  return s.lib;
}
const KIND_ICON = { confluence_page: 'doc', page: 'doc', blogpost: 'doc', gdoc: 'doc', sheet: 'analytics', slides: 'panel' };
const KIND_NAME = { confluence_page: 'Page', page: 'Page', blogpost: 'Post', gdoc: 'Doc', sheet: 'Sheet', slides: 'Slides', pdf: 'PDF' };
const kindName = (k) => KIND_NAME[k] || (k ? k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, ' ') : 'Document');
const DOMAIN_COL = ['#5e6ad2', '#16a34a', '#f97316', '#0ea5a4', '#d946a8', '#3b82f6', '#e2a600'];
const domainCol = (slug) => DOMAIN_COL[[...String(slug)].reduce((a, c) => a + c.charCodeAt(0), 0) % DOMAIN_COL.length];
const SCOPE = { public: ['Public', 'ok'], internal: ['Everyone at Kredete', 'blue'], granular: ['Limited access', ''] };
function authorityTag(d) {
  if (d.authority === 'approved') {
    return d.review_due_at && new Date(d.review_due_at) < new Date() ? '<span class="tag warn">Past review date</span>' : '';
  }
  return `<span class="tag warn">${d.authority === 'draft' ? 'Draft' : 'Not approved'}</span>`;
}
const domainLabel = (d) => (d.domain ? `<span class="llab"><i style="background:${domainCol(d.domain.slug)}"></i>${esc(d.domain.name)}</span>` : '');
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
      <div class="fwrap"><button type="button" class="fbtn ${L.system || L.domain ? 'on' : ''}" id="lfbtn" aria-label="Filter" aria-haspopup="true" aria-expanded="false">${ICON('filter', 15)}<span>Filter</span></button><div class="fmenu" id="lfmenu" hidden></div></div>
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
    menu.innerHTML = `<div class="fgh">Source</div>${opt('system', '', 'All sources', total)}${f.systems.map((s) => opt('system', s.value, B.systemName(s.value), s.count, B.srcIcon(s.value, 16))).join('')}${f.domains.length ? `<div class="fgh">Domain</div>${opt('domain', '', 'All domains', null)}${f.domains.map((d) => opt('domain', d.value, d.label, d.count, `<i class="fdot" style="background:${domainCol(d.value)}"></i>`)).join('')}` : ''}`;
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
  const box = $('#libchips');
  box.innerHTML = list.map(([k, label]) => `<button type="button" class="lchip on" data-clear="${k}" aria-label="Remove filter ${esc(label)}">${esc(label)}${ICON('x', 12)}</button>`).join('') + (list.length > 1 ? '<button type="button" class="link" data-clear="all">Clear all</button>' : '');
  box.hidden = !list.length;
  $$('[data-clear]', box).forEach((b) => {
    b.onclick = () => {
      if (b.dataset.clear === 'all') { L.system = ''; L.domain = ''; L.path = ''; } else L[b.dataset.clear] = '';
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
    const result = await B.api.get('/documents', { q: L.q || null, system: L.system || null, domain: L.domain || null, path: L.path || null, limit: 40, cursor: reset ? null : L.next });
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

/* ---------- the document drawer ---------- */
async function openDocument(id, opts) {
  const o = opts || {};
  const c = o.citation;
  B.openDrawer(`<div class="sv"><div class="sv-top"><span class="sv-sys">${c ? `${B.srcIcon(c.system, 20)}${esc(B.systemName(c.system))}` : '<i class="pvsk" style="width:90px"></i>'}</span><button type="button" class="xbtn2" data-close-drawer aria-label="Close">${ICON('x', 16)}</button></div><div class="sv-body" id="svbody">${c ? `<h2>${esc(c.title)}</h2>` : ''}<div class="skwrap" role="status"><span class="sr">Loading the document</span><i class="pvsk" style="width:80%;height:14px"></i><i class="pvsk" style="width:55%"></i><i class="pvsk" style="width:65%"></i></div></div></div>`);
  let d;
  try {
    d = await B.api.get('/documents/' + id);
  } catch (error) {
    const body = $('#svbody');
    if (body) body.innerHTML = error.status === 404 ? B.emptyBlock('Not available', 'This document is not available to you. It may have moved, or its access changed.') : B.errorBlock(error, 'docretry');
    const r = $('#docretry');
    if (r) r.onclick = () => openDocument(id, o);
    return;
  }
  const drawer = $('#drawer');
  if (!drawer.classList.contains('on')) return;
  const scope = SCOPE[d.scope] || SCOPE.granular;
  const lineage = B.hasRole('admin', 'compliance');
  const canWiden = d.scope !== 'public';
  drawer.innerHTML = `<div class="sv"><div class="sv-top"><span class="sv-sys">${B.srcIcon(d.system, 20)}${esc(B.systemName(d.system))}</span><button type="button" class="xbtn2" data-close-drawer aria-label="Close">${ICON('x', 16)}</button></div>
    <div class="sv-body"><h2>${esc(d.title)}</h2>
      <div class="sv-tags">${authorityTag(d) || '<span class="tag ok">Approved</span>'}<span class="tag ${scope[1]}">${esc(scope[0])}</span>${d.sensitivity !== 'internal' ? `<span class="tag">${esc(B.clearanceName(d.sensitivity))}</span>` : ''}${domainLabel(d)}</div>
      ${c && c.quote ? `<blockquote class="sv-q">${esc(c.quote)}</blockquote>` : ''}
      ${d.owner ? `<div class="sv-own">${AVATAR(d.owner.name, 'lav', 40)}<div><b>${esc(d.owner.name)}</b><small>${esc(d.owner.title || 'Owner')}</small></div>${d.last_verified_at ? `<span class="sv-ver"><small>Verified</small>${B.when(d.last_verified_at, B.fmtDate(d.last_verified_at, true))}</span>` : ''}</div>` : ''}
      <dl class="kv svkv">${d.path ? `<dt>Folder</dt><dd><button type="button" class="link" id="dfolder">${esc(d.path)}</button></dd>` : ''}<dt>Kind</dt><dd>${esc(kindName(d.kind))}</dd>${d.review_due_at ? `<dt>Review due</dt><dd>${B.when(d.review_due_at, B.fmtDate(d.review_due_at, true))}</dd>` : ''}${!d.owner && d.last_verified_at ? `<dt>Verified</dt><dd>${B.when(d.last_verified_at, B.fmtDate(d.last_verified_at, true))}</dd>` : ''}</dl>
    </div>
    <div class="sv-act"><a class="btn primary" id="dopen" href="${esc(d.url)}" target="_blank" rel="noopener noreferrer">${B.srcIcon(d.system, 16)}Open in ${esc(B.systemName(d.system))}${ICON('ext', 14)}</a>${canWiden ? '<button type="button" class="btn" id="dshare">Share more widely</button>' : ''}${lineage ? '<button type="button" class="btn" id="dlineage">Lineage</button>' : ''}</div></div>`;
  $('[data-close-drawer]', drawer).onclick = B.closeDrawer;
  const folder = $('#dfolder');
  if (folder) folder.onclick = () => { const L = state(); L.path = d.path; L.q = ''; B.closeDrawer(); if (S().route.surface === 'library') { page(); load(true); } else { L.loaded = false; B.go('/library'); } };
  const share = $('#dshare');
  if (share) share.onclick = () => shareModal(d);
  const lin = $('#dlineage');
  if (lin) lin.onclick = () => lineageModal(d);
}

function shareModal(d) {
  const options = [];
  if (d.scope === 'granular') options.push(['internal', 'Everyone at Kredete', 'Every employee can find it and get answers from it.']);
  options.push(['public', 'Public', 'Customers can see it through the support agent. Only for content that is safe to publish.']);
  B.openModal(`<div class="modal" role="dialog" aria-label="Share more widely"><div class="bar"><span>Share more widely</span><button type="button" class="link" data-close-modal>Close</button></div><div class="body"><h2>${esc(d.title)}</h2><p class="sub">An owner or admin approves the request. Until then, nothing changes.</p>
    <div class="obopts promopts" role="radiogroup" aria-label="Who can see it">${options.map(([k, l, t], i) => `<button type="button" class="obopt ${i ? '' : 'on'}" role="radio" aria-checked="${!i}" data-scope="${k}"><b>${l}</b><small>${t}</small></button>`).join('')}</div>
    <label class="hsl" for="preason">Why</label><textarea id="preason" class="eminp" rows="3" maxlength="500" placeholder="For example: every support agent needs this."></textarea><div class="hse" id="pre" role="alert"></div>
    <div class="actions"><button type="button" class="btn primary" id="psend">Send request</button><button type="button" class="btn" data-close-modal>Cancel</button></div></div></div>`);
  let scope = options[0][0];
  $$('[data-scope]').forEach((b) => {
    b.onclick = () => { scope = b.dataset.scope; $$('[data-scope]').forEach((x) => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-checked', String(on)); }); };
  });
  $('#psend').onclick = () => B.busy($('#psend'), async () => {
    await B.api.post(`/documents/${d.id}/promotions`, { to_scope: scope, reason: $('#preason').value.trim() || null });
    B.closeModal();
    B.toast('Request sent. Follow it in Governance.');
  }, (error) => { $('#pre').textContent = B.problem(error); });
}

const ACTIONS = { 'answer.served': 'Cited in an answer', 'promotion.requested': 'Wider sharing requested', 'promotion.approved': 'Sharing approved', 'promotion.rejected': 'Sharing rejected', 'promotion.revoked': 'Sharing revoked', 'promotion.needs_review': 'Sharing needs review' };
async function lineageModal(d) {
  B.openModal(`<div class="modal lineage" role="dialog" aria-label="Lineage"><div class="bar"><span>Lineage</span><button type="button" class="link" data-close-modal>Close</button></div><div class="body"><h2>${esc(d.title)}</h2><p class="sub">Answers that cited this document, and changes to how widely it is shared. Only admins and compliance see this.</p><div id="lin">${B.loadingBlock('Loading lineage', 3, 'actr')}</div></div></div>`);
  try {
    const page = await B.api.get('/admin/audit', { document_id: d.id, limit: 50 });
    const box = $('#lin');
    if (!box) return;
    box.innerHTML = page.items.length
      ? `<div class="actl">${page.items.map((e) => `<div class="actr"><span class="actic">${ICON(e.action === 'answer.served' ? 'chat' : 'shield', 16)}</span><span class="actt"><b>${esc(ACTIONS[e.action] || e.action)}</b><small>${B.when(e.ts, B.dayLabel(e.ts, true))}${e.channel ? ' · ' + esc(e.channel) : ''}${e.outcome && e.outcome !== 'ok' ? ' · ' + esc(e.outcome.replace(/_/g, ' ')) : ''}</small></span></div>`).join('')}</div>${page.next_cursor ? '<p class="amute linmore">Showing the 50 most recent. See all in Admin, Audit.</p>' : ''}`
      : '<p class="actn">Nothing yet. Answers that cite this document appear here.</p>';
  } catch (error) {
    const box = $('#lin');
    if (box) box.innerHTML = B.errorBlock(error);
  }
}

window.LIBRARY = { openDocument };
})();
