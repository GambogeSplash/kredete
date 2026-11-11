/* domains.js: the Admin > Domains tab (labelling spec 4.5; nested domains spec 4.5).
 *
 * Domains from /v1/admin/domains as a tree, each with its page count and owners, including
 * the owners it inherits from the domains above it. An admin creates a domain (the slug is
 * suggested from the name) inside another or at the top level, renames or moves it, and adds or
 * removes owners; owners are written through /v1/admin/users/{id}/roles with the person's other
 * roles kept. The slug is never edited here: Confluence labels name it (broth-domain-<slug>),
 * so changing it would break every label that uses it. The server decides whether a move is
 * allowed (no cycles, at most six levels); its message shows in the modal.
 */
(() => {
'use strict';
const B = window.BRAIN;
const ICON = window.ICON;
/** @type {(s: string, r?: ParentNode) => any} */
const $ = (s, r = document) => r.querySelector(s);
/** @type {(s: string, r?: ParentNode) => any[]} */
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = B.esc;
const T = window.DOMAIN_TREE;

function state() {
  const c = B.S.cache;
  if (!c.domains) c.domains = { items: [], loaded: false, loading: false, error: null };
  return c.domains;
}
/** The API's problem detail is written for people; the title is the fallback. */
const message = (error) => {
  const text = (error && error.detail) || B.problem(error);
  return text.charAt(0).toUpperCase() + text.slice(1);
};
const labelOf = (d) => `broth-domain-${d.slug}`;
/** A slug from a name: lowercase letters, digits and dashes, up to 41 characters. */
const slugify = (name) => name.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 41).replace(/-+$/, '');
/** Other parts of the app cache domains and people; they read again after a change here. */
function forgetCaches() {
  const c = B.S.cache;
  if (c.people) { c.people.domains = null; c.people.users.loaded = false; }
  c.names = null;
  B.loadFacets();
}

function render(el) {
  window.ADMIN.closePop();
  const s = state();
  s.rise = true;
  const view = s.view || 'list';
  const toggle = (k, icon, label) => `<button type="button" class="segb ${view === k ? 'on' : ''}" data-view="${k}" aria-pressed="${view === k}" aria-label="${label}">${ICON(icon, 15)}</button>`;
  window.ADMIN.actions(`<div class="seg" role="group" aria-label="View">${toggle('list', 'rows', 'List view')}${toggle('grid', 'grid', 'Grid view')}</div><button type="button" class="btn sm primary" id="dmnew" aria-haspopup="dialog">New domain</button>`);
  el.innerHTML = '<div id="dmlist"></div>';
  $('#dmnew').onclick = () => createModal();
  $$('[data-view]').forEach((b) => { b.onclick = () => { s.view = b.dataset.view; render(el); }; });
  if (!s.loaded || s.error) load(); else draw();
}
async function load() {
  const s = state();
  s.loading = true; s.error = null;
  draw();
  try {
    s.items = (await B.api.get('/admin/domains')).items;
    s.loaded = true;
  } catch (error) { s.error = error; }
  finally { s.loading = false; }
  draw();
}
const sub = (d, tree) => T.path(tree, d.id).slice(0, -1).map((x) => x.name).join(' / ');
const tile = (d) => `<span class="ds-ic adsti adfav" data-l="${esc((d.name[0] || '?').toUpperCase())}"></span>`;
const countText = (d) => `${d.document_count} ${d.document_count === 1 ? 'page' : 'pages'}`;
function draw() {
  const s = state();
  const list = $('#dmlist');
  if (!list) return;
  const view = s.view || 'list';
  if (!s.loaded) {
    if (s.error) { list.innerHTML = `<div class="ds-card">${B.errorBlock(s.error, 'dmretry')}</div>`; const r = $('#dmretry'); if (r) r.onclick = load; return; }
    list.innerHTML = view === 'grid'
      ? `<div class="ds-grid c3" role="status" aria-label="Loading domains">${[0, 1, 2].map(() => '<div class="ds-card dmsk" aria-hidden="true"><i class="pvsk" style="width:46%"></i><i class="pvsk sksub" style="width:30%"></i></div>').join('')}</div>`
      : `<div class="ds-table" role="status" aria-label="Loading domains">${B.skeletonRows(4, 'ds-tr')}</div>`;
    return;
  }
  if (!s.items.length) {
    list.innerHTML = `<div class="ds-grid c3"><button type="button" class="ds-card add" id="dmadd"><span class="ds-ic adsti">${ICON('plus', 18)}</span><b>Add a domain</b><small>Group pages by subject</small></button></div>`;
    $('#dmadd').onclick = () => createModal();
    return;
  }
  // The tree: each domain under its parent, siblings by name, indented by depth.
  const tree = T.tree(s.items);
  const rows = /** @type {{ item: any, depth: number }[]} */ (T.options(tree));
  if (view === 'grid') {
    list.innerHTML = `<div class="ds-grid c3"><button type="button" class="ds-card add" id="dmadd"><span class="ds-ic adsti">${ICON('plus', 18)}</span><b>Add a domain</b><small>Group pages by subject</small></button>${rows.map(({ item: d }) => `<button type="button" class="ds-card lift addom" data-domain="${d.id}" aria-label="${esc(d.name)}, ${countText(d)}"><div class="addh">${tile(d)}<div><b>${esc(d.name)}</b><small>${esc(sub(d, tree) ? sub(d, tree) + ' · ' : '')}${countText(d)}</small></div>${d.owners.length || d.inherited_owners.length ? '' : '<span class="tag warn">No owner</span>'}</div></button>`).join('')}</div>`;
  } else {
    list.innerHTML = `<div class="ds-table" role="table" aria-label="Domains"><div class="ds-tr ds-th dmcols dmc4" role="row"><span role="columnheader">Domain</span><span role="columnheader">Label</span><span role="columnheader">Owners</span><span role="columnheader">Pages</span></div><button type="button" class="ds-tr ds-add dmcols dmc4" id="dmadd"><span class="dmn"><span class="ds-ic adsti">${ICON('plus', 16)}</span><b>Add a domain</b></span></button>${rows.map(({ item: d, depth }) => `<button type="button" class="ds-tr lift dmcols dmc4" role="row" data-domain="${d.id}" data-depth="${depth}" aria-label="${esc(d.name)}"><span class="dmn dmname" style="--depth:${depth}">${tile(d)}<b>${esc(d.name)}</b></span><span class="dmlabel"><code>${esc(labelOf(d))}</code></span><span class="acchips">${owners(d)}</span><span class="amute dmpages">${pages(d)}</span></button>`).join('')}</div>`;
  }
  $('#dmadd', list).onclick = () => createModal();
  if (s.rise) { s.rise = false; window.ADMIN.life(list); }
  $$('[data-domain]', list).forEach((b) => { b.onclick = () => editModal(s.items.find((d) => d.id === b.dataset.domain)); });
}

/** Its own owners, then, muted, those it inherits from the domains above it. */
function owners(d) {
  const own = d.owners.map((o) => `<span class="tag">${esc(o.name)}</span>`);
  const inherited = d.inherited_owners.map((o) => `<span class="tag dminh" title="Owns ${esc(o.from_domain.name)}">${esc(o.name)}<span class="sr">, owns ${esc(o.from_domain.name)}</span></span>`);
  return own.length || inherited.length ? own.concat(inherited).join('') : '<span class="tag warn">No owner</span>';
}
/** Pages filed directly in the domain, and, when its sub-domains hold more, the total. */
function pages(d) {
  const unit = (n) => `<span class="dmunit"> ${n === 1 ? 'page' : 'pages'}</span>`;
  return `<span>${d.document_count}${unit(d.document_count)}</span>${d.total_count !== d.document_count ? `<small class="dmtotal">${d.total_count} in total</small>` : ''}`;
}
/** The Parent select: the top level, then the tree; never the domain itself or anything under it. */
function parentSelect(domain) {
  return `<label class="hsl" for="dmparent">Parent</label><select id="dmparent" class="eminp" aria-describedby="dmparenthint"><option value="">None (top level)</option>${T.optionTags(T.tree(state().items), { selected: domain ? domain.parent_id : null, exclude: domain ? domain.id : null })}</select>
    <p class="${domain ? 'suhint' : 'ds-msg'}" id="dmparenthint">Its pages show inside the parent's folder in the Library, and the parent's owners own it too.</p>`;
}

/** A centred dialog, as the prototype's Add a domain: a title bar, a body, Close. */
function dialog(label, html) {
  B.openModal(`<div class="modal bt" style="max-width:460px" role="dialog" aria-label="${esc(label)}"><div class="bar"><span class="dmttl">${esc(label)}</span><button type="button" class="link" data-close-modal>Close</button></div><div class="body">${html}</div></div>`);
}
function createModal() {
  dialog('New domain', `<form id="dmf" class="dmbody" novalidate><div><label class="dmlab" for="dmname">Name</label><input id="dmname" class="eminp" autocomplete="off" maxlength="120" placeholder="Payments"></div>
    <div><label class="dmlab" for="dmslug">Label</label><div class="dmslug"><span class="dmpre">broth-domain-</span><input id="dmslug" class="eminp" autocomplete="off" maxlength="41" spellcheck="false" placeholder="payments" aria-describedby="dmslughint"></div>
    <p class="ds-msg" id="dmslughint">Lowercase letters, digits and dashes. Pages use it in their label, so it cannot be changed later.</p></div>
    <div>${parentSelect(null)}</div>
    <div class="hse ds-msg bad" id="dme" role="alert"></div><div class="actions"><button type="button" class="btn" data-close-modal>Cancel</button><span class="lsp"></span><button type="submit" class="btn primary" id="dmgo">Create</button></div></form>`);
  const name = $('#dmname'), slug = $('#dmslug'), err = $('#dme');
  let typed = false;
  setTimeout(() => name.focus(), 80);
  const bad = (text, field) => { err.textContent = text; [name, slug].forEach((f) => f.removeAttribute('aria-invalid')); if (text && field) { field.setAttribute('aria-invalid', 'true'); field.focus(); } };
  name.oninput = () => { if (!typed) slug.value = slugify(name.value); };
  slug.oninput = () => { typed = slug.value !== ''; };
  $('#dmf').onsubmit = (e) => {
    e.preventDefault();
    if (!name.value.trim()) { bad('Give the domain a name', name); return; }
    if (!slug.value.trim()) { bad('Give the domain a label', slug); return; }
    B.busy($('#dmgo'), async () => {
      const created = await B.api.post('/admin/domains', { name: name.value.trim(), slug: slug.value.trim(), parent_id: $('#dmparent').value || null });
      const s = state();
      s.items = s.items.concat(created).sort((a, b) => a.slug.localeCompare(b.slug)); // the reply carries its inherited owners
      forgetCaches();
      B.closeModal();
      B.toast(`Created. Pages join it with ${labelOf(created)}`);
      draw();
    }, (error) => { bad(message(error)); });
  };
}

async function editModal(domain) {
  let users = [];
  try { users = (await B.api.get('/admin/users', { limit: 200 })).items.filter((u) => u.status === 'active'); } catch (error) { B.toast(B.problem(error)); return; }
  const owns = (u) => u.roles.some((r) => r.role === 'domain_owner' && r.domain_id === domain.id);
  // Owners of a domain above already own this one: shown ticked, and not granted twice.
  const through = new Map(domain.inherited_owners.map((o) => [o.user_id, o.from_domain.name]));
  const owner = (u) => (through.has(u.id) && !owns(u)
    ? `<label class="ppck"><input type="checkbox" data-owner="${u.id}" checked disabled><span>${esc(u.name)}<small class="ppthru">Owns ${esc(through.get(u.id))}</small></span></label>`
    : `<label class="ppck"><input type="checkbox" data-owner="${u.id}" ${owns(u) ? 'checked' : ''}><span>${esc(u.name)}</span></label>`);
  B.openModal(`<div class="modal ppmodal" role="dialog" aria-label="Edit ${esc(domain.name)}"><div class="bar"><span>${esc(domain.name)}</span><button type="button" class="link" data-close-modal>Close</button></div><div class="body">
    <label class="hsl" for="dmname">Name</label><input id="dmname" class="eminp" autocomplete="off" maxlength="120" value="${esc(domain.name)}">
    <p class="hsl">Label</p><p class="dmfixed"><span class="dmlabel"><code>${esc(labelOf(domain))}</code><button type="button" class="lib dmcopy" data-copy="${esc(labelOf(domain))}" aria-label="Copy the label ${esc(labelOf(domain))}">${ICON('copy', 14)}</button></span><span class="suhint">Pages use this label, so it stays as it is.</span></p>
    ${parentSelect(domain)}
    <fieldset class="ppfs"><legend class="hsl">Owners</legend>${users.length ? users.map(owner).join('') : '<p class="amute">Nobody has signed in yet.</p>'}<p class="suhint ppnote">Owners keep this domain's pages, and those of the domains inside it, current and see their label problems.</p></fieldset>
    <div class="hse" id="dme" role="alert"></div><div class="actions"><button type="button" class="btn primary" id="dmsave">Save</button><button type="button" class="btn" data-close-modal>Cancel</button></div></div></div>`);
  $$('#modal [data-copy]').forEach((b) => { b.onclick = async () => { try { await navigator.clipboard.writeText(b.dataset.copy); } catch (e) { /* clipboard blocked */ } B.toast('Label copied'); }; });
  $('#dmsave').onclick = () => B.busy($('#dmsave'), async () => {
    let updated = domain;
    const name = $('#dmname').value.trim();
    if (!name) { $('#dme').textContent = 'Give the domain a name'; return; }
    const parent = $('#dmparent').value || null;
    const change = { ...(name !== domain.name ? { name } : {}), ...(parent !== domain.parent_id ? { parent_id: parent } : {}) };
    if (Object.keys(change).length) updated = await B.api.patch(`/admin/domains/${domain.id}`, change);
    for (const u of users) {
      const box = $(`[data-owner="${u.id}"]`);
      if (box.disabled) continue; // owned through a domain above: nothing to grant here
      const want = box.checked;
      if (want === owns(u)) continue;
      const others = u.roles.filter((r) => !(r.role === 'domain_owner' && r.domain_id === domain.id)).map((r) => ({ role: r.role, domain_id: r.domain_id || null }));
      const roles = want ? others.concat({ role: 'domain_owner', domain_id: domain.id }) : others;
      await B.api.put(`/admin/users/${u.id}/roles`, { roles });
    }
    const s = state();
    s.items = (await B.api.get('/admin/domains')).items;
    forgetCaches();
    B.closeModal();
    B.toast('Saved');
    draw();
    if (updated.id && users.some((u) => u.id === B.S.me.id)) { await B.loadMe(); }
  }, (error) => { $('#dme').textContent = message(error); });
}

window.ADMIN.tabs.domains = { label: 'Domains', hint: 'A domain groups pages by subject, such as Payments or Cards. Give a page its domain with its label, or set a space\'s default in Connectors.', roles: ['admin'], render };
})();
