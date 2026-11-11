/* people.js: Admin, People (sandbox spec 4.1, plan C8).
 *
 * People from /v1/admin/users (roles, domain ownership, clearance, and suspension in
 * sandbox mode), invitations from /v1/admin/invitations (create with roles and clearance,
 * revoke), and Confluence account links from /v1/admin/account-links (link, unlink). A link
 * changes what the linked person can find at once.
 */
(() => {
'use strict';
const B = window.BRAIN;
/** @type {(s: string, r?: ParentNode) => any} */
const $ = (s, r = document) => r.querySelector(s);
/** @type {(s: string, r?: ParentNode) => any[]} */
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = B.esc;

const INVITABLE = [['admin', 'Admin'], ['compliance', 'Compliance'], ['developer', 'Developer']];
/* The role filter narrows the people loaded so far; search asks the server. */
const ROLE_FILTERS = [['', 'All'], ['admin', 'Admin'], ['compliance', 'Compliance'], ['developer', 'Developer'], ['domain_owner', 'Domain owner'], ['suspended', 'Suspended']];
const INVITE_STATUS = { open: ['Waiting to sign in', 'blue'], accepted: ['Signed in', 'ok'], revoked: ['Revoked', ''] };

function state() {
  const c = B.S.cache;
  if (!c.people) {
    c.people = {
      tab: 'people',
      users: { q: '', items: [], next: null, loaded: false, loading: false, error: null, seq: 0 },
      invites: { items: [], next: null, loaded: false, loading: false, error: null, seq: 0 },
      links: null, linksError: null,
      domains: null,
    };
  }
  return c.people;
}
const T = window.DOMAIN_TREE;
/** A domain's full path (Payments / Payouts), since names repeat across the tree. */
const domainPath = (id, domains) => T.path(T.tree(domains || []), id).map((d) => d.name).join(' / ');
const domainName = (id, domains) => ((domains || []).find((d) => d.id === id) || { name: 'a domain' }).name;
const roleTag = (r, domains) => (r.role === 'domain_owner'
  ? `<span class="tag" title="${esc(domainPath(r.domain_id, domains))}">${esc(`Owns ${domainName(r.domain_id, domains)}`)}</span>`
  : `<span class="tag">${esc(B.ROLE_NAMES[r.role] || r.role)}</span>`);
const roleTags = (roles, domains) => (roles.length ? roles.map((r) => roleTag(r, domains)).join('') : '<span class="tag">Employee</span>');

function render(el) {
  const p = state();
  const tabs = [['people', 'People'], ['invitations', 'Invitations']];
  if (B.sandbox()) tabs.push(['links', 'Confluence accounts']);
  window.ADMIN.actions(B.sandbox() ? '<button type="button" class="btn primary sm" id="ppinvite" aria-haspopup="dialog">Invite people</button>' : '');
  el.innerHTML = `<div class="pphead"><div class="libchips govtabs" role="tablist" aria-label="People">${tabs.map(([k, l]) => `<button type="button" class="lchip ${p.tab === k ? 'on' : ''}" role="tab" aria-selected="${p.tab === k}" data-pt="${k}">${l}</button>`).join('')}</div></div><div id="pppane"></div>`;
  $$('[data-pt]', el).forEach((b) => { b.onclick = () => { p.tab = b.dataset.pt; render(el); }; });
  const inv = $('#ppinvite');
  if (inv) inv.onclick = inviteModal;
  // Role tags name their domain: draw the people again once the domains arrive, whichever
  // comes back first.
  if (!p.domains) domains().then(() => { if (p.tab === 'people' && p.users.loaded) drawUsers(); });
  if (p.tab === 'invitations') invitations();
  else if (p.tab === 'links') links();
  else people();
}
async function domains() {
  const p = state();
  if (p.domains) return p.domains;
  try { p.domains = (await B.api.get('/admin/domains')).items; } catch (e) { p.domains = []; }
  return p.domains;
}

/* ---------- people ---------- */
function people() {
  const u = state().users;
  $('#pppane').innerHTML = `<div class="bt-bar"><div class="libs ppsearch"><span class="libs-i">${ICON('search', 15)}</span><input id="ppq" type="search" placeholder="Search people" aria-label="Search people" value="${esc(u.q)}" autocomplete="off"></div><div class="bt-chips" role="group" aria-label="Filter by role">${ROLE_FILTERS.map(([k, l]) => `<button type="button" class="lchip ${(u.role || '') === k ? 'on' : ''}" aria-pressed="${(u.role || '') === k}" data-rf="${k}">${l}</button>`).join('')}</div></div><div class="ds-table bt ppdt" role="table" aria-label="People" style="--cols:minmax(0,1.6fr) minmax(0,1.6fr) minmax(0,.9fr) 100px" id="pplist"></div><div class="chmore" id="ppmore"></div>`;
  $$('[data-rf]').forEach((b) => {
    b.onclick = () => {
      u.role = b.dataset.rf;
      $$('[data-rf]').forEach((o) => { o.classList.toggle('on', o === b); o.setAttribute('aria-pressed', String(o === b)); });
      drawUsers();
    };
  });
  let timer = 0;
  $('#ppq').oninput = (e) => { clearTimeout(timer); timer = setTimeout(() => { u.q = e.target.value.trim(); loadUsers(true); }, 220); };
  if (!u.loaded || u.error) loadUsers(true); else drawUsers();
}
async function loadUsers(reset) {
  const u = state().users;
  if (!reset && (u.loading || !u.next)) return;
  const mine = ++u.seq;
  u.loading = true; u.error = null;
  if (reset) { u.items = []; u.next = null; u.loaded = false; }
  drawUsers();
  try {
    const page = await B.api.get('/admin/users', { q: u.q || null, limit: 50, cursor: reset ? null : u.next });
    if (mine !== u.seq) return;
    u.items = reset ? page.items : u.items.concat(page.items);
    u.next = page.next_cursor || null;
    u.loaded = true;
  } catch (error) { if (mine === u.seq) u.error = error; }
  finally { if (mine === u.seq) u.loading = false; }
  if (mine === u.seq) drawUsers();
}
function drawUsers() {
  const u = state().users;
  const list = $('#pplist'), more = $('#ppmore');
  if (!list) return;
  const head = '<div class="ds-tr ds-th" role="row"><span role="columnheader">Person</span><span role="columnheader">Roles</span><span role="columnheader">Clearance</span><span role="columnheader"><span class="sr">Actions</span></span></div>';
  if (!u.loaded) {
    list.innerHTML = head + (u.error ? `<div class="ds-tr dterr">${B.errorBlock(u.error, 'ppretry')}</div>` : B.skeletonRows(5, 'ds-tr'));
    const r = $('#ppretry');
    if (r) r.onclick = () => loadUsers(true);
    more.innerHTML = '';
    return;
  }
  const doms = state().domains;
  const shown = u.items.filter((x) => !u.role || (u.role === 'suspended' ? x.status === 'suspended' : x.roles.some((r) => r.role === u.role)));
  list.innerHTML = head + (shown.length
    ? shown.map((x) => `<div class="ds-tr" role="row" data-user="${x.id}"><span class="dtp ppwho m-main">${AVATAR(x.name, 'lav', 28)}<span><b>${esc(x.name)}</b><small>${esc(x.email)}</small></span>${x.status === 'suspended' ? '<span class="tag bad">Suspended</span>' : ''}</span><span class="dtm acchips">${roleTags(x.roles, doms)}</span><span class="dtm">${esc(B.clearanceName(x.clearance))}</span><span class="m-end"><button type="button" class="btn sm rowa" data-edit="${x.id}" aria-label="Edit ${esc(x.name)}">Edit</button></span></div>`).join('')
    : `<div class="ds-tr dtempty"><span class="amute">${u.q || u.role ? 'Nobody matches.' : 'Nobody has signed in yet.'}</span></div>`);
  more.innerHTML = u.next ? `<button type="button" class="btn sm" id="ppload" ${u.loading ? 'disabled' : ''}>${u.loading ? 'Loading' : 'Show more'}</button>` : '';
  const m = $('#ppload');
  if (m) m.onclick = () => loadUsers(false);
  $$('[data-edit]', list).forEach((b) => { b.onclick = () => editModal(u.items.find((x) => x.id === b.dataset.edit)); });
}
async function editModal(user) {
  const doms = await domains();
  const has = (role, domain) => user.roles.some((r) => r.role === role && (domain === undefined || r.domain_id === domain));
  // The domains they are made owner of directly. Owning a domain owns everything inside it, so
  // a domain under one of these shows ticked and fixed ("Owned through ..."); a direct grant
  // already there is kept, not silently dropped.
  const tree = T.tree(doms);
  const granted = new Set(user.roles.filter((r) => r.role === 'domain_owner').map((r) => r.domain_id));
  B.openModal(`<div class="modal ppmodal" role="dialog" aria-label="Edit ${esc(user.name)}"><div class="bar"><span>${esc(user.name)}</span><button type="button" class="link" data-close-modal>Close</button></div><div class="body">
    <div class="ppwho pphero">${AVATAR(user.name, 'lav', 40)}<span><b>${esc(user.name)}</b><small>${esc(user.email)}</small></span></div>
    <fieldset class="ppfs"><legend class="hsl">Roles</legend>${INVITABLE.map(([k, l]) => `<label class="ppck"><input type="checkbox" data-role="${k}" ${has(k) ? 'checked' : ''}><span>${l}</span></label>`).join('')}</fieldset>
    <fieldset class="ppfs ppdoms"><legend class="hsl">Domain owner of</legend>${doms.length ? T.options(tree).map(({ item: d, depth }) => `<label class="ppck ppdom" style="--depth:${depth}"><input type="checkbox" data-domain="${d.id}"><span>${esc(d.name)}<small class="ppthru" hidden></small></span></label>`).join('') : '<p class="amute">No domains yet.</p>'}</fieldset>
    <label class="hsl" for="ppclear">Clearance</label><select id="ppclear" aria-label="Clearance">${B.CLEARANCES.map(([k, l]) => `<option value="${k}" ${user.clearance === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
    <div class="hse" id="ppe" role="alert"></div>
    <div class="actions"><button type="button" class="btn primary" id="ppsave">Save</button><button type="button" class="btn" data-close-modal>Cancel</button><span class="lsp"></span>${B.sandbox() ? `<button type="button" class="btn ${user.status === 'suspended' ? '' : 'danger-o'}" id="ppstatus">${user.status === 'suspended' ? 'Reactivate' : 'Suspend'}</button>` : ''}</div></div></div>`);
  /** Each domain box shows its own grant, or, under a granted domain, that it is owned through it. */
  const syncDomains = () => {
    $$('[data-domain]').forEach((box) => {
      const id = box.dataset.domain;
      const above = T.path(tree, id).slice(0, -1).reverse().find((d) => granted.has(d.id));
      const hint = box.parentElement.querySelector('.ppthru');
      box.disabled = !!above;
      box.checked = !!above || granted.has(id);
      hint.hidden = !above;
      hint.textContent = above ? `Owned through ${above.name}` : '';
    });
  };
  $$('[data-domain]').forEach((box) => { box.onchange = () => { if (box.checked) granted.add(box.dataset.domain); else granted.delete(box.dataset.domain); syncDomains(); }; });
  syncDomains();
  $('#ppsave').onclick = () => B.busy($('#ppsave'), async () => {
    const roles = [
      ...$$('[data-role]:checked').map((c) => ({ role: c.dataset.role, domain_id: null })),
      ...[...granted].map((id) => ({ role: 'domain_owner', domain_id: id })),
    ];
    const same = roles.length === user.roles.length && roles.every((r) => user.roles.some((x) => x.role === r.role && (x.domain_id || null) === r.domain_id));
    let updated = user;
    if (!same) updated = await B.api.put(`/admin/users/${user.id}/roles`, { roles });
    const clearance = $('#ppclear').value;
    if (clearance !== user.clearance) updated = await B.api.put(`/admin/users/${user.id}/clearance`, { clearance });
    replaceUser(updated);
    B.closeModal();
    B.toast('Saved');
    if (user.id === B.S.me.id) { await B.loadMe(); B.renderSurfaces(); }
  }, (error) => { $('#ppe').textContent = B.problem(error); });
  const st = $('#ppstatus');
  if (st) {
    st.onclick = () => {
      const suspend = user.status !== 'suspended';
      if (suspend && !st.dataset.arm) { st.dataset.arm = '1'; st.textContent = 'Confirm suspend'; st.classList.add('danger'); $('#ppe').textContent = 'Suspending signs them out everywhere until you reactivate them.'; return; }
      B.busy(st, async () => {
        const result = await B.api.put(`/admin/users/${user.id}/status`, { status: suspend ? 'suspended' : 'active' });
        replaceUser(Object.assign({}, user, { status: result.status }));
        B.closeModal();
        B.toast(suspend ? 'Suspended and signed out' : 'Reactivated');
      }, (error) => { $('#ppe').textContent = B.problem(error); });
    };
  }
}
function replaceUser(updated) {
  const u = state().users;
  const i = u.items.findIndex((x) => x.id === updated.id);
  if (i >= 0) u.items[i] = updated;
  B.S.cache.names = null;
  drawUsers();
}

/* ---------- invitations ---------- */
function invitations() {
  $('#pppane').innerHTML = `<div class="ds-table bt ppdt" role="table" aria-label="Invitations" style="--cols:minmax(0,1.6fr) minmax(0,1.4fr) minmax(0,1fr) 100px" id="invlist"></div><div class="chmore" id="invmore"></div>`;
  const v = state().invites;
  if (!v.loaded || v.error) loadInvites(true); else drawInvites();
}
async function loadInvites(reset) {
  const v = state().invites;
  if (!reset && (v.loading || !v.next)) return;
  const mine = ++v.seq;
  v.loading = true; v.error = null;
  if (reset) { v.items = []; v.next = null; v.loaded = false; }
  drawInvites();
  try {
    const page = await B.api.get('/admin/invitations', { limit: 50, cursor: reset ? null : v.next });
    if (mine !== v.seq) return;
    v.items = reset ? page.items : v.items.concat(page.items);
    v.next = page.next_cursor || null;
    v.loaded = true;
  } catch (error) { if (mine === v.seq) v.error = error; }
  finally { if (mine === v.seq) v.loading = false; }
  if (mine === v.seq) drawInvites();
}
function drawInvites() {
  const v = state().invites;
  const list = $('#invlist'), more = $('#invmore');
  if (!list) return;
  const head = '<div class="ds-tr ds-th" role="row"><span role="columnheader">Email</span><span role="columnheader">Roles and clearance</span><span role="columnheader">Status</span><span role="columnheader"><span class="sr">Actions</span></span></div>';
  if (!v.loaded) {
    list.innerHTML = head + (v.error ? `<div class="ds-tr dterr">${B.errorBlock(v.error, 'invretry')}</div>` : B.skeletonRows(4, 'ds-tr'));
    const r = $('#invretry');
    if (r) r.onclick = () => loadInvites(true);
    more.innerHTML = '';
    return;
  }
  list.innerHTML = head + (v.items.length
    ? v.items.map((x) => { const st = INVITE_STATUS[x.status] || [x.status, '']; return `<div class="ds-tr" role="row"><span class="dtp m-main"><b style="font-weight:500">${esc(x.email)}</b><small class="amute ppago"> · ${B.when(x.created_at, B.ago(x.created_at))}</small></span><span class="dtm acchips">${x.roles.map((r) => `<span class="tag">${esc(B.ROLE_NAMES[r] || r)}</span>`).join('')}<span class="tag">${esc(B.clearanceName(x.clearance))}</span></span><span class="dtm"><span class="tag ${st[1]}">${st[0]}</span></span><span class="m-end">${x.status === 'open' ? `<button type="button" class="btn sm rowa" data-revoke="${x.id}">Revoke</button>` : ''}</span></div>`; }).join('')
    : '<div class="ds-tr dtempty"><span class="amute">No invitations yet. Invite the people who should use Broth.</span></div>');
  more.innerHTML = v.next ? `<button type="button" class="btn sm" id="invload" ${v.loading ? 'disabled' : ''}>${v.loading ? 'Loading' : 'Show more'}</button>` : '';
  const m = $('#invload');
  if (m) m.onclick = () => loadInvites(false);
  $$('[data-revoke]', list).forEach((b) => {
    b.onclick = () => {
      if (!b.dataset.arm) { b.dataset.arm = '1'; b.textContent = 'Confirm'; b.classList.add('danger'); return; }
      B.busy(b, async () => {
        await B.api.del(`/admin/invitations/${b.dataset.revoke}`);
        const i = v.items.findIndex((x) => x.id === b.dataset.revoke);
        if (i >= 0) v.items[i] = Object.assign({}, v.items[i], { status: 'revoked' });
        B.toast('Invitation revoked');
        drawInvites();
      });
    };
  });
}
function inviteModal() {
  const origin = location.origin;
  const anchor = $('#ppinvite');
  if (anchor && anchor.getAttribute('aria-expanded') === 'true') { window.ADMIN.closePop(); return; }
  const p = window.ADMIN.pop(anchor, `<form id="invf" class="dmbody" novalidate><div><label class="dmlab" for="invemail">Google account</label><input id="invemail" class="eminp" type="email" inputmode="email" autocomplete="off" placeholder="name@example.com" aria-describedby="inve"><div class="hse ds-msg bad" id="inve" role="alert"></div><p class="ds-msg">They sign in at ${esc(origin)} with this account. No email is sent: share the address yourself.</p></div>
    <fieldset class="ppfs"><legend class="dmlab">Roles</legend>${INVITABLE.map(([k, l]) => `<label class="ppck"><input type="checkbox" data-irole="${k}"><span>${l}</span></label>`).join('')}<p class="ds-msg">Everyone can ask and use the library. Make someone a domain owner after they sign in.</p></fieldset>
    <div><label class="dmlab" for="invclear">Clearance</label><select id="invclear" aria-label="Clearance">${B.CLEARANCES.map(([k, l]) => `<option value="${k}" ${k === 'internal' ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    <div class="actions"><button type="button" class="btn" id="invcancel">Cancel</button><span class="lsp"></span><button type="submit" class="btn primary" id="invgo">Invite</button></div></form>`, 'Invite people');
  const field = $('#invemail', p), err = $('#inve', p);
  const bad = (text) => { err.textContent = text; if (text) field.setAttribute('aria-invalid', 'true'); else field.removeAttribute('aria-invalid'); };
  const valid = () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(field.value.trim());
  field.oninput = () => { if (err.textContent) bad(''); };
  field.onblur = () => { if (field.value.trim() && !valid()) bad('Enter the email of their Google account'); };
  $('#invcancel', p).onclick = () => window.ADMIN.closePop();
  $('#invf', p).onsubmit = (e) => {
    e.preventDefault();
    const email = field.value.trim();
    if (!valid()) { bad('Enter the email of their Google account'); field.focus(); return; }
    B.busy($('#invgo', p), async () => {
      const created = await B.api.post('/admin/invitations', { email, roles: $$('[data-irole]:checked', p).map((c) => c.dataset.irole), clearance: $('#invclear', p).value });
      const v = state().invites;
      v.items = [created, ...v.items];
      window.ADMIN.closePop();
      B.toast(`Invited ${created.email}`);
      state().tab = 'invitations';
      B.route();
    }, (error) => { bad(B.problem(error)); });
  };
}

/* ---------- Confluence account links ---------- */
async function links() {
  const p = state();
  const pane = $('#pppane');
  pane.innerHTML = `<p class="sub ppintro">Link each Confluence account to the person who uses it. A link gives that person what the account can open in Confluence, at once; an unlinked account gives nobody anything.</p><div id="lnbody">${B.loadingBlock('Loading accounts', 3, 'actr')}</div>`;
  try {
    const [result] = await Promise.all([B.api.get('/admin/account-links'), allUsers()]);
    p.links = result;
  } catch (error) {
    $('#lnbody').innerHTML = B.errorBlock(error, 'lnretry');
    $('#lnretry').onclick = links;
    return;
  }
  drawLinks();
}
async function allUsers() {
  const c = B.S.cache;
  if (!c.allUsers) c.allUsers = (await B.api.get('/admin/users', { limit: 200 })).items;
  return c.allUsers;
}
function drawLinks() {
  const p = state();
  const box = $('#lnbody');
  if (!box) return;
  const users = (B.S.cache.allUsers || []).filter((u) => u.status === 'active');
  const options = users.map((u) => `<option value="${u.id}">${esc(u.name)} (${esc(u.email)})</option>`).join('');
  box.innerHTML = `<h3 class="ach">Not linked</h3>${p.links.unlinked.length ? `<div class="actl">${p.links.unlinked.map((a) => `<div class="actr lnrow" data-acc="${esc(a.account_id)}"><span class="actic">${B.srcIcon('confluence', 16)}</span><span class="actt"><b>${esc(a.display_name || 'Unnamed account')}</b><small>Seen ${B.when(a.last_seen_at, B.ago(a.last_seen_at))}</small></span><span class="actb"><select data-pick aria-label="Person for ${esc(a.display_name || 'this account')}"><option value="">Choose a person</option>${options}</select><button type="button" class="btn sm primary" data-link disabled>Link</button></span></div>`).join('')}</div>` : '<p class="actn lnnone">Every account Broth has seen is linked.</p>'}
    <h3 class="ach">Linked</h3>${p.links.linked.length ? `<div class="actl">${p.links.linked.map((a) => `<div class="actr lnrow" data-acc="${esc(a.account_id)}"><span class="actic">${B.srcIcon('confluence', 16)}</span><span class="actt"><b>${esc(a.display_name || 'Unnamed account')}</b><small>Linked to ${esc(a.user_name)} · ${esc(a.user_email)}</small></span><span class="actb"><button type="button" class="btn sm" data-unlink>Unlink</button></span></div>`).join('')}</div>` : '<p class="actn lnnone">No accounts are linked yet.</p>'}`;
  $$('[data-link]', box).forEach((b) => {
    const row = b.closest('[data-acc]');
    const pick = $('[data-pick]', row);
    pick.onchange = () => { b.disabled = !pick.value; };
    b.onclick = () => B.busy(b, async () => {
      await B.api.put(`/admin/account-links/${encodeURIComponent(row.dataset.acc)}`, { user_id: pick.value });
      B.toast('Linked. Their access changed now.');
      p.links = await B.api.get('/admin/account-links');
      drawLinks();
    });
  });
  $$('[data-unlink]', box).forEach((b) => {
    const row = b.closest('[data-acc]');
    b.onclick = () => {
      if (!b.dataset.arm) { b.dataset.arm = '1'; b.textContent = 'Confirm unlink'; b.classList.add('danger'); return; }
      B.busy(b, async () => {
        await B.api.del(`/admin/account-links/${encodeURIComponent(row.dataset.acc)}`);
        B.toast('Unlinked. Their access changed now.');
        p.links = await B.api.get('/admin/account-links');
        drawLinks();
      });
    };
  });
}

window.ADMIN.tabs.people = { label: 'People', hint: 'Who can use Broth, and what each person can do.', roles: ['admin'], render };
})();
