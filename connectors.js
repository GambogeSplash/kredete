/* connectors.js: Admin, Connectors (sandbox spec 4.3, plan C7.1).
 *
 * Confluence: the connections from /v1/admin/connections with authorize (OAuth), verify,
 * sync and disconnect, and their spaces from /v1/admin/containers with include and owner, and
 * a Settings drawer for each space's defaults (labelling spec 4.3): pages start from them and
 * labels can only make a page more cautious. A connection shows its warnings, such as the
 * indexer group check (labelling spec 4.4).
 * Google Drive: a setup checklist; in sandbox mode it explains that Drive needs a Google
 * Workspace account. In sandbox mode the OAuth clients are managed here too. The Confluence
 * authorization returns to /admin/connectors?connected=<id> or ?error=<reason>.
 */
(() => {
'use strict';
const B = window.BRAIN;
/** @type {(s: string, r?: ParentNode) => any} */
const $ = (s, r = document) => r.querySelector(s);
/** @type {(s: string, r?: ParentNode) => any[]} */
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = B.esc;

const STATUS = { healthy: ['Healthy', 'ok'], degraded: ['Degraded', 'warn'], failing: ['Failing', 'bad'], disconnected: ['Disconnected', ''] };
const OAUTH_ERRORS = {
  invalid_state: 'The Confluence authorization expired or was started in another browser. Authorize again.',
  authorization_failed: 'Atlassian did not complete the authorization. Authorize again, and allow every requested permission.',
};
const CREDENTIALS = { google_oauth: ['Google sign-in', 'The OAuth client people sign in with.'], confluence_oauth: ['Confluence app', 'The Atlassian OAuth app Brain reads Confluence with.'] };

let data = null; // { connections, containers, credentials, users, domains }
const AUTHORITIES = [['approved', 'Approved'], ['unapproved', 'Unapproved'], ['draft', 'Draft']];
/* Public is not offered: a page becomes public only through a Public promotion. */
const SENSITIVITIES = [['internal', 'Internal'], ['confidential', 'Confidential'], ['restricted', 'Restricted']];
const SETTINGS_HELP = {
  owner: 'Pages without an owner of their own are owned by this person.',
  authority: 'The most a page in this space is trusted. Page labels can only lower it.',
  sensitivity: 'The least protection a page in this space gets. Page labels can only raise it.',
  domain: 'Pages without a domain label of their own belong to this domain.',
  review: 'How long a verified page stays current before it is due for review.',
};
let banner = null;

async function fetchAll() {
  const [connections, containers, credentials, users, domains] = await Promise.all([
    B.api.get('/admin/connections'),
    B.api.get('/admin/containers'),
    B.sandbox() ? B.api.get('/admin/credentials') : Promise.resolve({ items: [] }),
    B.api.get('/admin/users', { limit: 200 }),
    B.api.get('/admin/domains'),
  ]);
  return { connections: connections.items, containers: containers.items, credentials: credentials.items, users: users.items, domains: domains.items };
}

/** Handles the return from Atlassian, then drops the query so a reload starts clean. */
function readReturn() {
  const q = new URLSearchParams(location.search);
  if (!q.has('connected') && !q.has('error')) return;
  if (q.has('connected')) {
    B.toast('Confluence is connected');
    banner = null;
    history.replaceState({}, '', '/admin/connectors');
    if (B.setupPending()) { B.go('/setup', { replace: true }); return 'moved'; }
  } else {
    banner = OAUTH_ERRORS[q.get('error')] || 'The Confluence authorization did not finish. Authorize again.';
    history.replaceState({}, '', '/admin/connectors');
  }
  return undefined;
}

async function render(el) {
  if (readReturn() === 'moved') return;
  el.innerHTML = `${banner ? `<div class="banner bad" role="alert">${esc(banner)}</div>` : ''}<div id="cnbody">${B.loadingBlock('Loading connectors', 3, 'cnsec skcapp')}</div>`;
  try { data = await fetchAll(); }
  catch (error) {
    const body = $('#cnbody');
    if (body) { body.innerHTML = B.errorBlock(error, 'cnretry'); $('#cnretry').onclick = () => render(el); }
    return;
  }
  draw();
}
function draw() {
  const body = $('#cnbody');
  if (!body || !data) return;
  const confluence = data.connections.filter((c) => c.system === 'confluence' && c.status !== 'disconnected');
  const drive = data.connections.filter((c) => c.system === 'gdrive' && c.status !== 'disconnected');
  const conf = data.credentials.find((c) => c.name === 'confluence_oauth');
  body.innerHTML = `<section class="cnsec"><div class="cnsec-h">${B.srcIcon('confluence', 32)}<div><h2>Confluence</h2><p class="amute">Brain reads the spaces you include, with each person's Confluence access.</p></div></div>
      ${B.sandbox() && conf && !conf.configured ? `<div class="notice low"><span>Add the Confluence app below before connecting a site.</span></div>` : ''}
      ${confluence.map(connectionHtml).join('') || `<div class="cnempty"><p class="amute">No Confluence site is connected.</p></div>`}
      <form class="cnadd" id="cnadd" novalidate><label class="hsl" for="cnsite">${confluence.length ? 'Connect another site' : 'Connect a site'}</label><div class="cnaddrow"><input id="cnsite" class="eminp" placeholder="yourteam.atlassian.net" autocomplete="off" spellcheck="false" inputmode="url"><button type="submit" class="btn primary" id="cnaddgo">Connect</button></div><div class="hse" id="cnadde" role="alert"></div></form></section>
    <section class="cnsec"><div class="cnsec-h">${B.srcIcon('gdrive', 32)}<div><h2>Google Drive</h2><p class="amute">${B.sandbox() ? 'Unavailable in this sandbox.' : 'Brain reads the shared drives you include.'}</p></div>${B.sandbox() ? '<span class="tag">Needs Google Workspace</span>' : ''}</div>
      ${B.sandbox() ? '<div class="notice none"><span>Google Drive needs a Google Workspace account: Brain reads Drive through domain-wide delegation, which a personal Google account does not have.</span></div>' : ''}
      <ol class="cncheck ${B.sandbox() ? 'off' : ''}"><li><b>Authorize Brain in the Google Admin console</b><span>Add Brain's client ID with the Drive and Admin SDK read scopes under domain-wide delegation.</span></li><li><b>Add the indexer to each shared drive</b><span>Invite broth-indexer@ as a viewer on every shared drive Brain should read.</span></li><li><b>Verify</b><span>Brain checks that it can see each shared drive, then you include them.</span></li></ol>
      ${drive.map(connectionHtml).join('')}</section>
    ${B.sandbox() ? `<section class="cnsec"><div class="cnsec-h"><span class="cnsec-i">${ICON('lock', 18)}</span><div><h2>App credentials</h2><p class="amute">OAuth clients for this sandbox. Secrets are stored encrypted and never shown again.</p></div></div><div class="fgroup cncreds">${data.credentials.map(credentialRow).join('')}</div></section>` : ''}`;
  wire();
}
function connectionHtml(c) {
  const st = STATUS[c.status] || [c.status, ''];
  const spaces = data.containers.filter((x) => x.connection_id === c.id);
  return `<div class="cnconn" data-conn="${c.id}"><div class="cnconn-h"><b>${esc(c.site)}</b><span class="tag ${st[1]}">${st[0]}</span>${c.system === 'confluence' && !c.authorized ? '<span class="tag warn">Not authorized</span>' : ''}<span class="lsp"></span><span class="amute cnsync">${c.last_sync_at ? 'Synced ' + B.when(c.last_sync_at, B.ago(c.last_sync_at)) : 'Not synced yet'}</span></div>
    ${c.last_error ? `<div class="banner bad cnerr">${esc(c.last_error)}</div>` : ''}
    ${warningsHtml(c.warnings || {})}
    <div class="cnacts">${c.system === 'confluence' && !c.authorized ? `<button type="button" class="btn sm primary" data-cact="authorize">Authorize with Atlassian</button>` : `<button type="button" class="btn sm" data-cact="verify">Find spaces</button><button type="button" class="btn sm" data-cact="sync">Sync now</button>${c.system === 'confluence' ? '<button type="button" class="btn sm" data-cact="authorize">Re-authorize</button>' : ''}`}<span class="lsp"></span><button type="button" class="btn sm" data-cact="disconnect">Disconnect</button></div>
    ${c.authorized || c.system === 'gdrive' ? `<div class="cnspaces">${spaces.length ? `<div class="dt" style="--cols:minmax(0,1.6fr) minmax(0,1.2fr) 64px 84px"><div class="dt-r dt-h"><span>${c.system === 'gdrive' ? 'Shared drive' : 'Space'}</span><span>Owner</span><span>Included</span><span></span></div>${spaces.map((s) => spaceRow(s)).join('')}</div>` : '<p class="amute cnnone">No spaces found yet. Use Find spaces.</p>'}</div>` : ''}</div>`;
}
function spaceRow(s) {
  const options = data.users.filter((u) => u.status === 'active').map((u) => `<option value="${u.id}" ${s.owner_user_id === u.id ? 'selected' : ''}>${esc(u.name)}</option>`).join('');
  const name = B.containerName(s.path);
  return `<div class="dt-r" data-space="${s.id}"><span class="dtp"><b style="font-weight:500">${esc(name)}</b></span><span class="cnown"><select data-owner aria-label="Owner of ${esc(name)}"><option value="" ${s.owner_user_id ? '' : 'selected'}>No owner</option>${options}</select></span><span class="cninc"><input type="checkbox" class="sw" data-include ${s.included ? 'checked' : ''} aria-label="Include ${esc(name)}"></span><span><button type="button" class="btn sm" data-settings aria-label="Settings for ${esc(name)}">Settings</button></span></div>`;
}
function credentialRow(c) {
  const [title, sub] = CREDENTIALS[c.name] || [c.name, ''];
  return `<div class="frow cnc" data-cred="${c.name}"><div class="frl"><b>${title}</b><small>${sub}</small></div><div class="frv">${c.configured ? `<span class="tag ok">Configured</span><span class="amute"> Client ID ends in ${esc(c.client_id_last4 || '')}${c.updated_at ? ' · ' + B.when(c.updated_at, B.ago(c.updated_at)) : ''}</span>` : '<span class="tag warn">Not configured</span>'}</div><div class="fra"><button type="button" class="btn sm" data-cedit="${c.name}">${c.configured ? 'Replace' : 'Add'}</button></div></div>`;
}
function wire() {
  const body = $('#cnbody');
  $('#cnadd').onsubmit = (e) => {
    e.preventDefault();
    const site = $('#cnsite').value.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(site)) { $('#cnadde').textContent = 'Enter the site address, like yourteam.atlassian.net'; return; }
    B.busy($('#cnaddgo'), async () => {
      const created = await B.api.post('/admin/connections', { system: 'confluence', site });
      await window.SETUP.authorize(created.id);
    }, (error) => { $('#cnadde').textContent = B.problem(error); refresh(); });
  };
  $$('[data-cact]', body).forEach((b) => {
    const id = b.closest('[data-conn]').dataset.conn;
    b.onclick = () => {
      const act = b.dataset.cact;
      if (act === 'disconnect' && !b.dataset.arm) { b.dataset.arm = '1'; b.textContent = 'Confirm disconnect'; b.classList.add('danger'); return; }
      B.busy(b, async () => {
        if (act === 'authorize') { await window.SETUP.authorize(id); return; }
        if (act === 'verify') { const r = await B.api.post(`/admin/connections/${id}/verify`); B.toast(`Found ${r.containers} ${r.containers === 1 ? 'space' : 'spaces'}`); }
        if (act === 'sync') { await B.api.post(`/admin/connections/${id}/sync`); B.toast('Sync started'); }
        if (act === 'disconnect') { await B.api.del(`/admin/connections/${id}`); B.toast('Disconnected. Its content is hidden now.'); }
        await refresh();
      });
    };
  });
  $$('[data-space]', body).forEach((row) => {
    const id = row.dataset.space;
    const include = $('[data-include]', row), owner = $('[data-owner]', row);
    include.onchange = () => {
      const space = data.containers.find((x) => x.id === id);
      const change = { included: include.checked };
      if (include.checked && !space.owner_user_id) change.owner_user_id = B.S.me.id; // a space needs an owner to be included
      patchSpace(id, change, () => { include.checked = !include.checked; });
    };
    owner.onchange = () => {
      const space = data.containers.find((x) => x.id === id);
      if (!owner.value && space.included) { B.toast('An included space needs an owner'); owner.value = space.owner_user_id || ''; return; }
      patchSpace(id, { owner_user_id: owner.value || null }, () => { owner.value = space.owner_user_id || ''; });
    };
    $('[data-settings]', row).onclick = () => settingsDrawer(data.containers.find((x) => x.id === id));
  });
  $$('[data-cedit]', body).forEach((b) => { b.onclick = () => credentialForm(b.dataset.cedit); });
}
async function patchSpace(id, change, undo) {
  try {
    const updated = await B.api.patch(`/admin/containers/${id}`, change);
    const i = data.containers.findIndex((x) => x.id === id);
    data.containers[i] = updated;
    B.toast(change.included === true ? 'Included. Brain reads it on the next sync.' : change.included === false ? 'Excluded. Its content is hidden now.' : 'Owner changed');
    draw();
    if (change.included !== undefined) { B.loadFacets(); B.refreshSetupProgress().then(() => B.renderSurfaces()); }
  } catch (error) {
    undo();
    B.toast(B.problem(error));
  }
}
/** What an admin must fix on a connection, in plain words. */
function warningsHtml(warnings) {
  const lines = [];
  const missing = warnings.indexer_group_missing, members = warnings.indexer_group_members;
  if (missing) lines.push([`Create a ${esc(missing.group)} group containing only the indexer account, so restricted pages can opt in.`, 'indexerGroupMissing']);
  if (members) lines.push([`Only the indexer account should be in ${esc(members.group)}. Also in it: ${members.members.map(esc).join(', ')}.`, 'indexerGroupMembers']);
  return lines.map(([l, doc]) => `<div class="notice low cnwarn" role="status"><span>${l} ${window.DOCS.link(doc, 'How to fix it')}</span></div>`).join('');
}

const options = (list, value) => list.map(([k, l]) => `<option value="${k}" ${k === value ? 'selected' : ''}>${esc(l)}</option>`).join('');
const field = (id, label, control, help) => `<div class="cnfield"><label class="hsl" for="${id}">${label}</label>${control}<p class="suhint" id="${id}h">${help}</p></div>`;
function settingsDrawer(space) {
  const name = B.containerName(space.path);
  const people = data.users.filter((u) => u.status === 'active');
  const authority = space.default_authority || 'unapproved';
  const sensitivity = space.default_sensitivity && space.default_sensitivity !== 'public' ? space.default_sensitivity : 'internal';
  B.openDrawer(`<div class="sv" role="dialog" aria-label="Settings for ${esc(name)}"><div class="sv-top"><span class="sv-sys">${B.srcIcon('confluence', 20)}${esc(name)}</span><button type="button" class="xbtn2" data-close-drawer aria-label="Close">${ICON('x', 16)}</button></div><form class="sv-body cnsettings" id="cnsf" novalidate>
    <h2>Space settings</h2><p class="sub">Every page in this space starts from these. A page's labels can only make it more cautious.</p><p class="cndoc">${window.DOCS.link('spaceSettings')}</p>
    ${field('cnsowner', 'Owner', `<select id="cnsowner" aria-describedby="cnsownerh"><option value="">No owner</option>${options(people.map((u) => [u.id, u.name]), space.owner_user_id)}</select>`, SETTINGS_HELP.owner)}
    ${field('cnsauth', 'Default authority', `<select id="cnsauth" aria-describedby="cnsauthh">${options(AUTHORITIES, authority)}</select>`, SETTINGS_HELP.authority)}
    ${field('cnssens', 'Default sensitivity', `<select id="cnssens" aria-describedby="cnssensh">${options(SENSITIVITIES, sensitivity)}</select>`, SETTINGS_HELP.sensitivity)}
    ${field('cnsdom', 'Default domain', `<select id="cnsdom" aria-describedby="cnsdomh"><option value="">No domain</option>${options(data.domains.map((d) => [d.id, d.name]), space.default_domain_id)}</select>`, SETTINGS_HELP.domain)}
    ${field('cnsrev', 'Review interval in months', `<input id="cnsrev" class="eminp" type="number" inputmode="numeric" min="1" max="120" step="1" value="${space.review_interval_months}" aria-describedby="cnsrevh">`, SETTINGS_HELP.review)}
    <div class="hse" id="cnse" role="alert"></div>
    <div class="actions"><button type="submit" class="btn primary" id="cnsgo">Save</button><button type="button" class="btn" data-close-drawer>Cancel</button></div></form></div>`);
  $('#cnsf').onsubmit = (e) => {
    e.preventDefault();
    const months = Number($('#cnsrev').value);
    if (!Number.isInteger(months) || months < 1 || months > 120) { $('#cnse').textContent = 'The review interval is a whole number of months, from 1 to 120'; return; }
    const owner = $('#cnsowner').value || null;
    if (!owner && space.included) { $('#cnse').textContent = 'An included space needs an owner'; return; }
    const wanted = {
      owner_user_id: owner,
      default_authority: $('#cnsauth').value,
      default_sensitivity: $('#cnssens').value,
      default_domain_id: $('#cnsdom').value || null,
      review_interval_months: months,
    };
    const current = { owner_user_id: space.owner_user_id || null, default_authority: authority, default_sensitivity: sensitivity, default_domain_id: space.default_domain_id || null, review_interval_months: space.review_interval_months };
    const change = Object.fromEntries(Object.entries(wanted).filter(([k, v]) => v !== current[k]));
    if (!Object.keys(change).length) { B.closeDrawer(); return; }
    B.busy($('#cnsgo'), async () => {
      const updated = await B.api.patch(`/admin/containers/${space.id}`, change);
      data.containers[data.containers.findIndex((x) => x.id === space.id)] = updated;
      B.closeDrawer();
      B.toast(updated.included ? 'Saved. Brain re-reads this space now.' : 'Saved');
      draw();
    }, (error) => { $('#cnse').textContent = (error && error.detail) || B.problem(error); });
  };
}

function credentialForm(name) {
  const [title] = CREDENTIALS[name] || [name];
  B.openModal(`<div class="modal" role="dialog" aria-label="${esc(title)}"><div class="bar"><span>${esc(title)}</span><button type="button" class="link" data-close-modal>Close</button></div><div class="body"><h2>${esc(title)}</h2><p class="sub">The new client replaces the current one right away.</p><form id="credf" novalidate><label class="hsl" for="credid">Client ID</label><input id="credid" class="eminp" autocomplete="off" spellcheck="false"><label class="hsl" for="credsecret">Client secret</label><input id="credsecret" class="eminp" type="password" autocomplete="off" spellcheck="false"><div class="hse" id="crede" role="alert"></div><div class="actions"><button type="submit" class="btn primary" id="credgo">Save</button><button type="button" class="btn" data-close-modal>Cancel</button></div></form></div></div>`);
  $('#credid').focus();
  $('#credf').onsubmit = (e) => {
    e.preventDefault();
    const client_id = $('#credid').value.trim(), client_secret = $('#credsecret').value.trim();
    if (!client_id || !client_secret) { $('#crede').textContent = 'Enter the client ID and the client secret'; return; }
    B.busy($('#credgo'), async () => {
      await B.api.put(`/admin/credentials/${name}`, { client_id, client_secret });
      B.closeModal();
      B.toast('Saved');
      await refresh();
    }, (error) => { $('#crede').textContent = B.problem(error); });
  };
}
async function refresh() {
  try { data = await fetchAll(); draw(); } catch (error) { B.toast(B.problem(error)); }
}

window.ADMIN.tabs.connectors = { label: 'Connectors', roles: ['admin'], render };
})();
