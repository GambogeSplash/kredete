/* domains.js: the Admin > Domains tab (labelling spec 4.5).
 *
 * Domains from /v1/admin/domains with their page count and owners. An admin creates a domain
 * (the slug is suggested from the name), renames it, and adds or removes owners; owners are
 * written through /v1/admin/users/{id}/roles with the person's other roles kept. The slug is
 * never edited here: Confluence labels name it (broth-domain-<slug>), so changing it would
 * break every label that uses it.
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
  el.innerHTML = `<p class="sub dmintro">A domain groups pages by subject, such as Payments or Cards. Give a page its domain with the label shown next to each one, or set a space's default domain in Connectors. ${window.DOCS.link('domains')}</p><div class="pphead"><span class="lsp"></span><button type="button" class="btn primary sm" id="dmnew">New domain</button></div><div class="dt dmdt" style="--cols:minmax(0,1.3fr) minmax(0,1.5fr) minmax(0,1.3fr) 64px 76px" id="dmlist"></div>`;
  $('#dmnew').onclick = () => createModal();
  const s = state();
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
function draw() {
  const s = state();
  const list = $('#dmlist');
  if (!list) return;
  const head = '<div class="dt-r dt-h"><span>Domain</span><span>Label</span><span>Owners</span><span>Pages</span><span></span></div>';
  if (!s.loaded) {
    list.innerHTML = head + (s.error ? `<div class="dt-r dterr">${B.errorBlock(s.error, 'dmretry')}</div>` : B.skeletonRows(4, 'dt-r'));
    const r = $('#dmretry');
    if (r) r.onclick = load;
    return;
  }
  if (!s.items.length) {
    list.innerHTML = `<div class="dt-r dtempty">${B.emptyBlock('No domains yet', 'Create one for each subject your pages cover, such as Payments, Cards or Compliance. Each domain can have owners who keep its pages current.')}</div>`;
    return;
  }
  list.innerHTML = head + s.items.map((d) => `<div class="dt-r" data-domain="${d.id}"><span class="dtp"><b style="font-weight:500">${esc(d.name)}</b></span><span class="dmlabel"><code>${esc(labelOf(d))}</code><button type="button" class="lib dmcopy" data-copy="${esc(labelOf(d))}" aria-label="Copy the label ${esc(labelOf(d))}">${ICON('copy', 14)}</button></span><span class="dtm acchips">${d.owners.length ? d.owners.map((o) => `<span class="tag">${esc(o.name)}</span>`).join('') : '<span class="amute">No owner</span>'}</span><span class="dtm">${d.document_count}<span class="dmunit"> ${d.document_count === 1 ? 'page' : 'pages'}</span></span><span><button type="button" class="btn sm" data-dedit="${d.id}">Edit</button></span></div>`).join('');
  $$('[data-copy]', list).forEach((b) => {
    b.onclick = async () => { try { await navigator.clipboard.writeText(b.dataset.copy); } catch (e) { /* clipboard blocked */ } B.toast('Label copied'); };
  });
  $$('[data-dedit]', list).forEach((b) => { b.onclick = () => editModal(s.items.find((d) => d.id === b.dataset.dedit)); });
}

function createModal() {
  B.openModal(`<div class="modal ppmodal" role="dialog" aria-label="New domain"><div class="bar"><span>New domain</span><button type="button" class="link" data-close-modal>Close</button></div><div class="body">
    <form id="dmf" novalidate><label class="hsl" for="dmname">Name</label><input id="dmname" class="eminp" autocomplete="off" maxlength="120" placeholder="Payments">
    <label class="hsl" for="dmslug">Label</label><div class="dmslug"><span class="dmpre">broth-domain-</span><input id="dmslug" class="eminp" autocomplete="off" maxlength="41" spellcheck="false" placeholder="payments" aria-describedby="dmslughint"></div>
    <p class="suhint" id="dmslughint">Lowercase letters, digits and dashes. Pages use it in their label, so it cannot be changed later.</p>
    <div class="hse" id="dme" role="alert"></div><div class="actions"><button type="submit" class="btn primary" id="dmgo">Create</button><button type="button" class="btn" data-close-modal>Cancel</button></div></form></div></div>`);
  const name = $('#dmname'), slug = $('#dmslug');
  let typed = false;
  name.focus();
  name.oninput = () => { if (!typed) slug.value = slugify(name.value); };
  slug.oninput = () => { typed = slug.value !== ''; };
  $('#dmf').onsubmit = (e) => {
    e.preventDefault();
    if (!name.value.trim()) { $('#dme').textContent = 'Give the domain a name'; return; }
    if (!slug.value.trim()) { $('#dme').textContent = 'Give the domain a label'; return; }
    B.busy($('#dmgo'), async () => {
      const created = await B.api.post('/admin/domains', { name: name.value.trim(), slug: slug.value.trim() });
      const s = state();
      s.items = s.items.concat(created).sort((a, b) => a.slug.localeCompare(b.slug));
      forgetCaches();
      B.closeModal();
      B.toast(`Created. Pages join it with ${labelOf(created)}`);
      draw();
    }, (error) => { $('#dme').textContent = message(error); });
  };
}

async function editModal(domain) {
  let users = [];
  try { users = (await B.api.get('/admin/users', { limit: 200 })).items.filter((u) => u.status === 'active'); } catch (error) { B.toast(B.problem(error)); return; }
  const owns = (u) => u.roles.some((r) => r.role === 'domain_owner' && r.domain_id === domain.id);
  B.openModal(`<div class="modal ppmodal" role="dialog" aria-label="Edit ${esc(domain.name)}"><div class="bar"><span>${esc(domain.name)}</span><button type="button" class="link" data-close-modal>Close</button></div><div class="body">
    <label class="hsl" for="dmname">Name</label><input id="dmname" class="eminp" autocomplete="off" maxlength="120" value="${esc(domain.name)}">
    <p class="hsl">Label</p><p class="dmfixed"><code>${esc(labelOf(domain))}</code><span class="suhint">Pages use this label, so it stays as it is.</span></p>
    <fieldset class="ppfs"><legend class="hsl">Owners</legend>${users.length ? users.map((u) => `<label class="ppck"><input type="checkbox" data-owner="${u.id}" ${owns(u) ? 'checked' : ''}><span>${esc(u.name)}</span></label>`).join('') : '<p class="amute">Nobody has signed in yet.</p>'}<p class="suhint ppnote">Owners keep this domain's pages current and see their label problems.</p></fieldset>
    <div class="hse" id="dme" role="alert"></div><div class="actions"><button type="button" class="btn primary" id="dmsave">Save</button><button type="button" class="btn" data-close-modal>Cancel</button></div></div></div>`);
  $('#dmsave').onclick = () => B.busy($('#dmsave'), async () => {
    let updated = domain;
    const name = $('#dmname').value.trim();
    if (!name) { $('#dme').textContent = 'Give the domain a name'; return; }
    if (name !== domain.name) updated = await B.api.patch(`/admin/domains/${domain.id}`, { name });
    for (const u of users) {
      const want = $(`[data-owner="${u.id}"]`).checked;
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

window.ADMIN.tabs.domains = { label: 'Domains', roles: ['admin'], render };
})();
