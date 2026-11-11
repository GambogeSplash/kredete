/* connectors.js: Admin, Connectors (sandbox spec 4.3, plan C7.1).
 *
 * Confluence: the connections from /v1/admin/connections with authorize (OAuth), verify,
 * sync and disconnect, and their spaces from /v1/admin/containers with include and owner, and
 * a Settings drawer for each space's defaults (labelling spec 4.3): pages start from them and
 * labels can only make a page more cautious. A connection shows its warnings, such as the
 * indexer group check (labelling spec 4.4).
 * Sync runs (sync runs spec 3.1, 3.2 and 3.4.1): a connection's header shows its Sync now run
 * and each space row its own read, both through SYNC.runView, followed by SYNC.watchRuns while
 * any is running. A poll repaints only what a run changes (paint), so focus, an open list of
 * failed pages and the live status regions survive it.
 * Docs repositories (docs source spec 8): a GitHub account is connected by installing the
 * GitHub App, its repositories are found, included and owned like spaces, and each can be
 * requested Public as a whole; another admin or a domain owner approves in Governance. A docs
 * connection's finished run also lists the pages it kept out of Public, with why.
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
  install_expired: 'The GitHub install expired or was started in another browser. Choose Install on GitHub again.',
  installation_failed: 'GitHub did not confirm the installation. Install the app again.',
  wrong_account: 'The app was installed on a different GitHub account than the one you connected. Install it on that account.',
};
const CREDENTIALS = { google_oauth: ['Google sign-in', 'The OAuth client people sign in with.'], confluence_oauth: ['Confluence app', 'The Atlassian OAuth app Broth reads Confluence with.'], github_app: ['GitHub App', 'The read-only GitHub App Broth reads docs repositories through.'] };
const DECLARED = { pending: ['Requested', 'blue'], approved: ['Public', 'ok'] };
/** A GitHub organization or user name. */
const GITHUB_LOGIN = /^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$/i;

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
/** The connection a return from Atlassian or GitHub just connected, toasted once loaded. */
let connected = null;
/** Stops following the page's runs; replaced each time the page is drawn. */
let stopWatching = () => {};
/** The failed pages loaded so far, by failuresKey, kept while the page repaints. */
const failedPages = new Map();
/** What each slot was last painted with, so an unchanged status is not announced again. */
const painted = new WeakMap();

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
/** Every run the page shows: each connection's and each space's running and last run. */
const runsOf = (connections, containers) => [...connections, ...containers].flatMap((x) => [x.active_run, x.last_run]);

/** Handles the return from Atlassian, then drops the query so a reload starts clean. */
function readReturn() {
  const q = new URLSearchParams(location.search);
  if (!q.has('connected') && !q.has('error')) return;
  if (q.has('connected')) {
    banner = null;
    history.replaceState({}, '', '/admin/connectors');
    if (B.setupPending()) { B.toast('Confluence is connected'); B.go('/setup', { replace: true }); return 'moved'; }
    connected = q.get('connected');
  } else {
    banner = OAUTH_ERRORS[q.get('error')] || 'The Confluence authorization did not finish. Authorize again.';
    history.replaceState({}, '', '/admin/connectors');
  }
  return undefined;
}

/** The Add a source popover: a Confluence site or a GitHub account to connect. */
function addSource() {
  const anchor = $('#cnadds');
  if (anchor.getAttribute('aria-expanded') === 'true') { window.ADMIN.closePop(); return; }
  const confluence = data ? data.connections.some((c) => c.system === 'confluence' && c.status !== 'disconnected') : false;
  const docs = data ? data.connections.some((c) => c.system === 'github_docs' && c.status !== 'disconnected') : false;
  const p = window.ADMIN.pop(anchor, `<div class="dmbody cnpop"><form id="cnadd" novalidate><label class="dmlab" for="cnsite">${confluence ? 'Connect another Confluence site' : 'Confluence site'}</label><div class="cnaddrow"><input id="cnsite" class="eminp" placeholder="yourteam.atlassian.net" autocomplete="off" spellcheck="false" inputmode="url"><button type="submit" class="btn primary" id="cnaddgo">Connect</button></div><div class="hse ds-msg bad" id="cnadde" role="alert"></div></form>
    <form id="ghadd" novalidate><label class="dmlab" for="ghlogin">${docs ? 'Connect another GitHub account' : 'GitHub docs'}</label><div class="cnaddrow"><input id="ghlogin" class="eminp" placeholder="Organization or user, like kredete" autocomplete="off" spellcheck="false"><button type="submit" class="btn primary" id="ghaddgo">Connect</button></div><div class="hse ds-msg bad" id="ghadde" role="alert"></div></form>
    <div class="cnsoon"><span class="cnsec-i">${B.srcIcon('gdrive', 18)}</span><span><b>Google Drive</b><small>${B.sandbox() ? 'Needs Google Workspace' : 'Set up under Google Drive below'}</small></span><span class="tag">${B.sandbox() ? 'Coming soon' : 'Below'}</span></div></div>`, 'Add a source');
  const flag = (id, msg) => { const f = $(id === 'cn' ? '#cnsite' : '#ghlogin', p); $(`#${id}adde`, p).textContent = msg; if (msg) f.setAttribute('aria-invalid', 'true'); else f.removeAttribute('aria-invalid'); };
  $('#cnsite', p).oninput = () => flag('cn', '');
  $('#ghlogin', p).oninput = () => flag('gh', '');
  $('#cnadd', p).onsubmit = (e) => {
    e.preventDefault();
    const site = $('#cnsite', p).value.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(site)) { flag('cn', 'Enter the site address, like yourteam.atlassian.net'); return; }
    B.busy($('#cnaddgo', p), async () => {
      const created = await B.api.post('/admin/connections', { system: 'confluence', site });
      await window.SETUP.authorize(created.id);
    }, (error) => { flag('cn', B.problem(error)); refresh(); });
  };
  $('#ghadd', p).onsubmit = (e) => {
    e.preventDefault();
    const login = $('#ghlogin', p).value.trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\/.*$/, '');
    if (!GITHUB_LOGIN.test(login)) { flag('gh', 'Enter the GitHub organization or user name, like kredete'); return; }
    B.busy($('#ghaddgo', p), async () => {
      const created = await B.api.post('/admin/connections', { system: 'github_docs', site: login });
      await install(created.id);
    }, (error) => { flag('gh', B.problem(error)); refresh(); });
  };
}

async function render(el) {
  if (readReturn() === 'moved') return;
  window.ADMIN.actions('<button type="button" class="btn primary sm" id="cnadds" aria-haspopup="dialog">Add a source</button>');
  $('#cnadds').onclick = addSource;
  el.innerHTML = `${banner ? `<div class="banner bad" role="alert">${esc(banner)}</div>` : ''}<div id="cnbody">${B.loadingBlock('Loading connectors', 3, 'cnsec skcapp')}</div>`;
  try { data = await fetchAll(); }
  catch (error) {
    const body = $('#cnbody');
    if (body) { body.innerHTML = B.errorBlock(error, 'cnretry'); $('#cnretry').onclick = () => render(el); }
    return;
  }
  if (connected) {
    const c = data.connections.find((x) => x.id === connected);
    B.toast(c && c.system === 'github_docs' ? 'The GitHub App is installed. Find the repositories next.' : 'Confluence is connected');
    connected = null;
  }
  draw();
}
function draw() {
  const body = $('#cnbody');
  if (!body || !data) return;
  const confluence = data.connections.filter((c) => c.system === 'confluence' && c.status !== 'disconnected');
  const drive = data.connections.filter((c) => c.system === 'gdrive' && c.status !== 'disconnected');
  const conf = data.credentials.find((c) => c.name === 'confluence_oauth');
  const docs = data.connections.filter((c) => c.system === 'github_docs' && c.status !== 'disconnected');
  const app = data.credentials.find((c) => c.name === 'github_app');
  body.innerHTML = `<section class="cnsec"><div class="cnsec-h">${B.srcIcon('confluence', 32)}<div><h2>Confluence</h2><p class="amute">Broth reads the spaces you include, with each person's Confluence access.</p></div>${confluence.length ? '<span class="tag ok">Connected</span>' : '<span class="tag">Not connected</span>'}</div>
      ${B.sandbox() && conf && !conf.configured ? `<div class="notice low"><span>Add the Confluence app below before connecting a site.</span></div>` : ''}
      ${confluence.map(connectionHtml).join('') || `<div class="cnempty"><p class="amute">No Confluence site is connected.</p></div>`}
</section>
    <section class="cnsec"><div class="cnsec-h">${B.srcIcon('gdrive', 32)}<div><h2>Google Drive</h2><p class="amute">${B.sandbox() ? 'Unavailable in this sandbox.' : 'Broth reads the shared drives you include.'}</p></div>${B.sandbox() ? '<span class="tag">Needs Google Workspace</span>' : drive.length ? '<span class="tag ok">Connected</span>' : '<span class="tag">Not connected</span>'}</div>
      ${B.sandbox() ? '<div class="notice none"><span>Google Drive needs a Google Workspace account: Broth reads Drive through domain-wide delegation, which a personal Google account does not have.</span></div>' : ''}
      <ol class="cncheck ${B.sandbox() ? 'off' : ''}"><li><b>Authorize Broth in the Google Admin console</b><span>Add Broth's client ID with the Drive and Admin SDK read scopes under domain-wide delegation.</span></li><li><b>Add the indexer to each shared drive</b><span>Invite broth-indexer@ as a viewer on every shared drive Broth should read.</span></li><li><b>Verify</b><span>Broth checks that it can see each shared drive, then you include them.</span></li></ol>
      ${drive.map(connectionHtml).join('')}</section>
    <section class="cnsec" id="cndocs"><div class="cnsec-h">${B.srcIcon('github_docs', 32)}<div><h2>Docs repositories</h2><p class="amute">Broth reads the product docs from the GitHub repositories you include, and links each answer to the page on the docs site. ${window.DOCS.link('docsInstall', 'How to connect')}</p></div>${docs.length ? '<span class="tag ok">Connected</span>' : '<span class="tag">Not connected</span>'}</div>
      ${B.sandbox() && app && !app.configured ? `<div class="notice low"><span>Add the GitHub App below before connecting an account.</span></div>` : ''}
      ${docs.map(connectionHtml).join('') || `<div class="cnempty"><p class="amute">No GitHub account is connected.</p></div>`}
</section>
    ${B.sandbox() ? `<section class="cnsec"><div class="cnsec-h"><span class="cnsec-i">${ICON('lock', 18)}</span><div><h2>App credentials</h2><p class="amute">The apps Broth uses in this sandbox. Secrets are stored encrypted and never shown again.</p></div></div><div class="fgroup cncreds">${data.credentials.map(credentialRow).join('')}</div></section>` : ''}`;
  paint();
  wire();
  watch();
}
/* The status, run status, bar, failed pages and error banner are slots that paint fills, when
   the card is drawn and again whenever its runs move. */
function connectionHtml(c) {
  const spaces = data.containers.filter((x) => x.connection_id === c.id);
  const repos = c.system === 'github_docs';
  const unit = repos ? 'Repository' : c.system === 'gdrive' ? 'Shared drive' : 'Space';
  const cols = repos ? 'minmax(0,1.5fr) minmax(0,1.1fr) 64px minmax(124px,0.9fr) 84px' : 'minmax(0,1.6fr) minmax(0,1.2fr) 64px 84px';
  const needs = (c.system === 'confluence' || repos) && !c.authorized;
  const start = repos ? '<button type="button" class="btn sm primary" data-cact="install">Install on GitHub</button>' : '<button type="button" class="btn sm primary" data-cact="authorize">Authorize with Atlassian</button>';
  const find = repos ? 'Find repositories' : 'Find spaces';
  return `<div class="cnconn" data-conn="${c.id}"><div class="cnconn-h"><b>${esc(c.site)}</b><span class="cnstate"></span><span class="lsp"></span><span class="amute cnsync" role="status"></span></div>
    <div class="cnbar"></div><div class="cnfails"></div><div class="cnerrs"></div>
    ${warningsHtml(c.warnings || {})}
    <div class="cnacts">${needs ? start : `<button type="button" class="btn sm" data-cact="verify">${find}</button><button type="button" class="btn sm cnsyncb" data-cact="sync"><span class="suspin" aria-hidden="true"></span><span>Sync now</span></button>${c.system === 'confluence' ? '<button type="button" class="btn sm" data-cact="authorize">Re-authorize</button>' : ''}`}<span class="lsp"></span><button type="button" class="btn sm" data-cact="disconnect">Disconnect</button></div>
    ${c.authorized || c.system === 'gdrive' ? `<div class="cnspaces">${spaces.length ? `<div class="dt" style="--cols:${cols}"><div class="dt-r dt-h"><span>${unit}</span><span>Owner</span><span>Included</span>${repos ? '<span>Bots</span>' : ''}<span></span></div>${spaces.map((s) => spaceRow(s, repos)).join('')}</div>` : `<p class="amute cnnone">No ${repos ? 'repositories' : 'spaces'} found yet. Use ${find}.</p>`}</div>` : ''}</div>`;
}
/** A repository's Public declaration: Request public, or where its request stands. */
function declarationCell(s) {
  const d = s.public_declaration;
  const name = B.containerName(s.path);
  const state = d && DECLARED[d.status];
  if (state) return `<span class="cndecl"><span class="tag ${state[1]}">${state[0]}</span></span>`;
  // A request for a repository Broth does not read yet would make nothing Public: include it first.
  if (!s.included) return '<span class="cndecl amute">Include it first</span>';
  return `<span class="cndecl"><button type="button" class="btn sm" data-declare aria-label="Request public for ${esc(name)}">Request public</button></span>`;
}
function spaceRow(s, repos = false) {
  const options = data.users.filter((u) => u.status === 'active').map((u) => `<option value="${u.id}" ${s.owner_user_id === u.id ? 'selected' : ''}>${esc(u.name)}</option>`).join('');
  const name = B.containerName(s.path);
  return `<div class="dt-r" data-space="${s.id}"><span class="dtp"><span><b>${esc(name)}</b><span class="cnsrun" role="status"></span></span></span><span class="cnown"><select data-owner aria-label="Owner of ${esc(name)}"><option value="" ${s.owner_user_id ? '' : 'selected'}>No owner</option>${options}</select></span><span class="cninc"><input type="checkbox" class="sw" data-include ${s.included ? 'checked' : ''} aria-label="Include ${esc(name)}"></span>${repos ? declarationCell(s) : ''}<span><button type="button" class="btn sm" data-settings aria-label="Settings for ${esc(name)}">Settings</button></span></div>`;
}
function credentialRow(c) {
  const [title, sub] = CREDENTIALS[c.name] || [c.name, ''];
  return `<div class="frow cnc" data-cred="${c.name}"><div class="frl"><b>${title}</b><small>${sub}</small></div><div class="frv">${c.configured ? `<span class="tag ok">Configured</span><span class="amute"> ${c.name === 'github_app' ? 'App ID' : 'Client ID'} ends in ${esc(c.client_id_last4 || '')}${c.updated_at ? ' · ' + B.when(c.updated_at, B.ago(c.updated_at)) : ''}</span>` : '<span class="tag warn">Not configured</span>'}</div><div class="fra"><button type="button" class="btn sm" data-cedit="${c.name}">${c.configured ? 'Replace' : 'Add'}</button></div></div>`;
}
function wire() {
  const body = $('#cnbody');
  $$('[data-cact]', body).forEach((b) => {
    const id = b.closest('[data-conn]').dataset.conn;
    b.onclick = () => {
      const act = b.dataset.cact;
      if (act === 'sync') { syncNow(b, id); return; }
      if (act === 'disconnect' && !b.dataset.arm) { b.dataset.arm = '1'; b.textContent = 'Confirm disconnect'; b.classList.add('danger'); return; }
      B.busy(b, async () => {
        if (act === 'authorize') { await window.SETUP.authorize(id); return; }
        if (act === 'install') { await install(id); return; }
        if (act === 'verify') {
          const r = await B.api.post(`/admin/connections/${id}/verify`);
          const repos = data.connections.some((x) => x.id === id && x.system === 'github_docs');
          const unit = repos ? ['repository', 'repositories'] : ['space', 'spaces'];
          B.toast(`Found ${r.containers} ${r.containers === 1 ? unit[0] : unit[1]}`);
        }
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
    const declare = $('[data-declare]', row);
    if (declare) declare.onclick = () => declarationForm(data.containers.find((x) => x.id === id));
  });
  $$('[data-cedit]', body).forEach((b) => { b.onclick = () => credentialForm(b.dataset.cedit); });
  // A space's failed-pages link is repainted with its run, so the click is handled here.
  body.onclick = (e) => {
    const link = e.target.closest('[data-failed]');
    const space = link && data.containers.find((x) => x.id === link.closest('[data-space]').dataset.space);
    if (space) failedDrawer(space, link.dataset.failed);
  };
}
/** Sends the admin to GitHub to install the app; GitHub returns to this page. */
async function install(id) {
  const started = await B.api.post(`/admin/connections/${id}/github/install`);
  location.assign(started.install_url);
}
function declarationForm(repo) {
  const name = B.containerName(repo.path);
  B.openModal(`<div class="modal" role="dialog" aria-label="Request public for ${esc(name)}"><div class="bar"><span>Request public</span><button type="button" class="link" data-close-modal>Close</button></div><div class="body"><h2>Make ${esc(name)} Public</h2><p class="sub">Every page this repository publishes becomes Public once another admin, or an owner of its domain, approves. Bots can then answer from it, and later changes need no new approval. ${window.DOCS.link('docsDeclaration')}</p><form id="declf" novalidate><label class="hsl" for="declwhy">Why</label><textarea id="declwhy" class="eminp" rows="3" maxlength="500" placeholder="Published at docs.kredete.com"></textarea><div class="hse" id="decle" role="alert"></div><div class="actions"><button type="submit" class="btn primary" id="declgo">Request</button><button type="button" class="btn" data-close-modal>Cancel</button></div></form></div></div>`);
  $('#declwhy').focus();
  $('#declf').onsubmit = (e) => {
    e.preventDefault();
    const reason = $('#declwhy').value.trim() || null;
    B.busy($('#declgo'), async () => {
      const declaration = await B.api.post(`/admin/containers/${repo.id}/public-declaration`, { reason });
      data.containers[data.containers.findIndex((x) => x.id === repo.id)] = Object.assign({}, repo, { public_declaration: declaration });
      B.closeModal();
      B.toast('Requested. Another admin or a domain owner approves it in Governance.');
      draw();
    }, (error) => { $('#decle').textContent = B.problem(error); });
  };
}
async function patchSpace(id, change, undo) {
  try {
    const updated = await B.api.patch(`/admin/containers/${id}`, change);
    const i = data.containers.findIndex((x) => x.id === id);
    data.containers[i] = updated;
    B.toast(change.included === true ? 'Included. Broth reads it now.' : change.included === false ? 'Excluded. Its content is hidden now.' : 'Owner changed');
    draw();
    if (change.included !== undefined) { B.loadFacets(); B.refreshSetupProgress().then(() => B.renderSurfaces()); }
  } catch (error) {
    undo();
    B.toast(B.problem(error));
  }
}

/* ---- sync runs ---- */

/** Sets a slot's HTML only when it changed, so a live region is not announced again. */
function put(slot, html) {
  if (!slot || painted.get(slot) === html) return;
  slot.innerHTML = html;
  painted.set(slot, html);
}
const pages = (n) => `${n} ${n === 1 ? 'page' : 'pages'}`;
/** Escapes text and keeps each count with the word after it when the line wraps. */
const counts = (text) => esc(text).replace(/(\d) /g, '$1&nbsp;');
/** How long ago, inside a sentence ("Synced just now"). */
function ago(iso) {
  const text = B.ago(iso);
  return text === 'Just now' ? 'just now' : text;
}
const bar = (fraction, label) => `<div class="bar" role="progressbar" aria-label="${esc(label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(fraction * 100)}"><i style="width:${Math.round(fraction * 100)}%"></i></div>`;

/** Brings every connection and space on the page up to date with `data`. */
function paint() {
  data.connections.forEach(paintConnection);
  data.containers.forEach(paintSpace);
}
function paintConnection(c) {
  const card = $(`[data-conn="${c.id}"]`);
  if (!card) return;
  const st = STATUS[c.status] || [c.status, ''];
  put($('.cnstate', card), `<span class="tag ${st[1]}">${st[0]}</span>${c.system === 'confluence' && !c.authorized ? '<span class="tag warn">Not authorized</span>' : ''}${c.system === 'github_docs' && !c.authorized ? '<span class="tag warn">Not installed</span>' : ''}`);
  put($('.cnerrs', card), c.last_error ? `<div class="banner bad cnerr">${esc(c.last_error)}</div>` : '');
  const running = c.active_run && c.active_run.status === 'running' ? c.active_run : null;
  const run = running || c.last_run;
  const view = SYNC.runView(run);
  put($('.cnsync', card), statusHtml(c, run, view));
  put($('.cnbar', card), view && view.fraction !== null ? bar(view.fraction, `Syncing ${c.site}`) : '');
  paintFailures($('.cnfails', card), c, running ? null : c.last_run);
  const sync = $('[data-cact="sync"]', card);
  if (sync) { sync.disabled = !!running; sync.classList.toggle('running', !!running); }
}
/** The header status: the run's progress or outcome, or when the connection last synced. */
function statusHtml(c, run, view) {
  if (!view) return `<span>${c.last_sync_at ? 'Synced ' + B.when(c.last_sync_at, ago(c.last_sync_at)) : 'Not synced yet'}</span>`;
  if (view.busy) return `<span class="suspin" aria-hidden="true"></span><span>${esc(view.label)}</span>`;
  if (!view.tag) return `<span>${esc(view.label)}</span>`;
  const when = view.tag !== 'bad' && run.finished_at ? [B.when(run.finished_at, ago(run.finished_at))] : [];
  const rest = [...when, ...(view.detail ? [counts(view.detail)] : [])].join(' · ');
  return `<span class="tag ${view.tag}">${esc(view.label)}</span>${rest ? ` <span>${rest}</span>` : ''}`;
}
/** A space's own read: its progress, then its page count or the pages it could not read. */
function paintSpace(s) {
  const slot = $(`[data-space="${s.id}"] .cnsrun`);
  if (!slot) return;
  const run = s.active_run || (s.included ? s.last_run : null);
  const view = SYNC.runView(run);
  if (!view) { put(slot, ''); return; }
  const name = B.containerName(s.path);
  if (view.busy) { put(slot, `<span class="suspin" aria-hidden="true"></span><span>${esc(view.label)}</span>${view.fraction !== null ? bar(view.fraction, `Reading ${name}`) : ''}`); return; }
  if (view.tag === 'ok') { put(slot, `<span class="cnok">${ICON('check', 14)}</span><span>${esc(view.label)}</span>`); return; }
  if (view.tag === 'warn') { put(slot, `<span>${esc(view.detail || '')}</span> · <button type="button" class="link cnfl" data-failed="${run.id}">${esc(view.label)}</button>`); return; }
  put(slot, `<span class="tag ${view.tag || ''}">${esc(view.label)}</span>${view.detail ? ` <span>${esc(view.detail)}</span>` : ''}`);
}

/** Under the header: the finished run's failed pages, collapsed until opened (spec 3.1). */
function paintFailures(slot, c, run) {
  // A docs connection's run can also hold pages back from Public, which it does not count.
  const docs = c.system === 'github_docs' && !!run && run.status !== 'running';
  const key = run && (run.failing > 0 || docs) ? failuresKey(run) : '';
  if ((slot.dataset.run || '') === key) return;
  slot.dataset.run = key;
  if (!key) { slot.innerHTML = ''; return; }
  const what = docs ? 'failed and held-back pages' : 'failed pages';
  slot.innerHTML = `<details class="cnfail"><summary>${ICON('chevr', 14)}<span>Show ${what}</span></summary><div class="cnfbox"></div>${docs ? '<div class="cnnbox"></div>' : ''}</details>`;
  const details = $('details', slot);
  details.ontoggle = () => {
    $('summary span', details).textContent = `${details.open ? 'Hide' : 'Show'} ${what}`;
    if (!details.open) return;
    if (run.failing > 0) showFailures($('.cnfbox', details), run, c.system);
    if (docs) showNotices($('.cnnbox', details), run);
  };
}
/** The pages a docs run synced but kept out of Public, with why (docs source spec 5). */
async function showNotices(box, run) {
  box.innerHTML = B.loadingBlock('Loading held-back pages', 1, 'cnfsk');
  try {
    const page = await B.api.get(`/admin/sync-runs/${run.id}/notices`, { limit: 50 });
    box.innerHTML = page.items.length
      ? `<h3 class="cnnh">Kept out of Public</h3><ul class="cnflist">${page.items.map((n) => `<li><span class="cnft">${esc(n.title || n.external_id)}</span><span class="cnfr">${esc(n.notice)}</span>${n.url ? `<a class="cnfo" href="${esc(n.url)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${esc(n.title || n.external_id)} on the docs site">${ICON('ext', 14)}</a>` : ''}</li>`).join('')}</ul><p class="cndoc">${window.DOCS.link('docsProblems', 'What these mean')}</p>`
      : run.failing > 0 ? '' : '<p class="amute cnfnone">Every page synced, and none was kept out of Public.</p>';
  } catch (error) {
    box.innerHTML = `<p class="cnfe" role="alert">${esc(B.problem(error))}</p>`;
  }
}
function failedDrawer(space, runId) {
  const run = [space.active_run, space.last_run].find((r) => r && r.id === runId);
  if (!run) return;
  const name = B.containerName(space.path);
  const connection = data.connections.find((c) => c.id === space.connection_id);
  const system = connection ? connection.system : 'confluence';
  B.openDrawer(`<div class="sv" role="dialog" aria-label="Failed pages in ${esc(name)}"><div class="sv-top"><span class="sv-sys">${B.srcIcon(system, 20)}${esc(name)}</span><button type="button" class="xbtn2" data-close-drawer aria-label="Close">${ICON('x', 16)}</button></div><div class="sv-body">
    <h2>Failed pages</h2><p class="sub">Broth couldn't read these pages of the space. Sync now tries them again.</p><div class="cnfbox"></div></div></div>`);
  showFailures($('#drawer .cnfbox'), run, system);
}
/** A run's failed pages change only when a later run reads some of them (spec 3.4.1). */
const failuresKey = (run) => `${run.id}:${run.failing}`;
/** Fills `box` with a run's failed pages, loading the first page of them the first time. */
function showFailures(box, run, system) {
  const list = failedPages.get(failuresKey(run));
  if (list) { failuresHtml(box, run, list, system); return; }
  box.innerHTML = B.loadingBlock('Loading failed pages', 2, 'cnfsk');
  moreFailures(box, run, { items: [], next: null, done: false }, system);
}
async function moreFailures(box, run, list, system) {
  try {
    const page = await B.api.get(`/admin/sync-runs/${run.id}/failures`, { limit: 50, cursor: list.next });
    list.items.push(...page.items);
    list.next = page.next_cursor || null;
    list.done = !list.next;
    failedPages.set(failuresKey(run), list);
    failuresHtml(box, run, list, system);
  } catch (error) {
    if (list.items.length) { B.toast(B.problem(error)); return; }
    box.innerHTML = `<p class="cnfe" role="alert">${esc(B.problem(error))} <button type="button" class="link">Try again</button></p>`;
    $('button', box).onclick = () => showFailures(box, run, system);
  }
}
function failuresHtml(box, run, list, system) {
  const where = B.systemName(system);
  const rows = list.items.map((f) => {
    const title = f.title || f.external_id;
    // The reason is the server's; a page it has none for still reads as a failure.
    return `<li><span class="cnft">${esc(title)}</span><span class="cnfr">${esc(f.error || "Couldn't read this page")}</span>${f.url ? `<a class="cnfo" href="${esc(f.url)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${esc(title)} in ${esc(where)}">${ICON('ext', 14)}</a>` : ''}</li>`;
  }).join('');
  box.innerHTML = rows
    ? `<ul class="cnflist">${rows}</ul>${list.done ? '' : '<button type="button" class="btn sm cnfmore">Show more</button>'}`
    : '<p class="amute cnfnone">Every page has been read since.</p>';
  const more = $('.cnfmore', box);
  if (more) more.onclick = () => B.busy(more, () => moreFailures(box, run, list, system));
}

/** Starts a Sync now run, or picks up the one already running, and follows it. */
async function syncNow(button, id) {
  button.disabled = true;
  button.classList.add('running');
  try {
    const run = await B.api.post(`/admin/connections/${id}/sync`);
    const c = data.connections.find((x) => x.id === id);
    if (c && run) {
      if (run.status === 'running') c.active_run = run;
      else { c.active_run = null; c.last_run = run; }
    }
  } catch (error) {
    B.toast(B.problem(error));
  }
  paint();
  watch();
}
/** Follows the page's runs while any is running, repainting what they change. */
function watch() {
  stopWatching();
  let latest = data;
  stopWatching = SYNC.watchRuns({
    runs: runsOf(data.connections, data.containers),
    fetch: async () => {
      const [connections, containers] = await Promise.all([B.api.get('/admin/connections'), B.api.get('/admin/containers')]);
      latest = { ...data, connections: connections.items, containers: containers.items };
      return runsOf(latest.connections, latest.containers);
    },
    onUpdate: (runs, finished) => {
      data = latest;
      paint();
      finished.forEach(announce);
      // A finished space read can finish setup's first reads: the sidebar follows (spec 3.3).
      if (finished.some((run) => run.trigger === 'space_read')) B.refreshSetupProgress().then(() => B.renderSurfaces());
    },
  });
}
/** A toast when a Sync now run the page followed finishes (spec 3.1). */
function announce(run) {
  if (run.trigger !== 'manual') return;
  const c = data.connections.find((x) => x.id === run.connection_id);
  const site = c ? c.site : 'The connection';
  if (run.status === 'failed') { B.toast(`${site} could not be synced.`); return; }
  if (run.failing > 0) { B.toast(`${site} synced. ${pages(run.failing)} couldn't be read.`); return; }
  const view = SYNC.runView(run);
  B.toast(`${site} synced.${view && view.detail ? ` ${view.detail}.` : ''}`);
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
  const repo = space.kind === 'repo';
  const connection = data.connections.find((c) => c.id === space.connection_id);
  B.openDrawer(`<div class="sv" role="dialog" aria-label="Settings for ${esc(name)}"><div class="sv-top"><span class="sv-sys">${B.srcIcon(connection ? connection.system : 'confluence', 20)}${esc(name)}</span><button type="button" class="xbtn2" data-close-drawer aria-label="Close">${ICON('x', 16)}</button></div><form class="sv-body cnsettings" id="cnsf" novalidate>
    <h2>${repo ? 'Repository settings' : 'Space settings'}</h2><p class="sub">Every page in this ${repo ? 'repository' : 'space'} starts from these. A page's labels can only make it more cautious.</p><p class="cndoc">${window.DOCS.link(repo ? 'docsDeclaration' : 'spaceSettings')}</p>
    ${field('cnsowner', 'Owner', `<select id="cnsowner" aria-describedby="cnsownerh"><option value="">No owner</option>${options(people.map((u) => [u.id, u.name]), space.owner_user_id)}</select>`, SETTINGS_HELP.owner)}
    ${repo ? '<p class="suhint cnrepo">Published docs are approved. They are Internal until the repository is declared Public, then Public unless a page is labelled or holds a customer identifier.</p>' : `${field('cnsauth', 'Default authority', `<select id="cnsauth" aria-describedby="cnsauthh">${options(AUTHORITIES, authority)}</select>`, SETTINGS_HELP.authority)}
    ${field('cnssens', 'Default sensitivity', `<select id="cnssens" aria-describedby="cnssensh">${options(SENSITIVITIES, sensitivity)}</select>`, SETTINGS_HELP.sensitivity)}`}
    ${field('cnsdom', 'Default domain', `<select id="cnsdom" aria-describedby="cnsdomh"><option value="">No domain</option>${window.DOMAIN_TREE.optionTags(window.DOMAIN_TREE.tree(data.domains), { selected: space.default_domain_id })}</select>`, SETTINGS_HELP.domain)}
    ${field('cnsrev', 'Review interval in months', `<input id="cnsrev" class="eminp" type="number" inputmode="numeric" min="1" max="120" step="1" value="${space.review_interval_months}" aria-describedby="cnsrevh">`, SETTINGS_HELP.review)}
    <div class="hse" id="cnse" role="alert"></div>
    <div class="actions"><button type="submit" class="btn primary" id="cnsgo">Save</button><button type="button" class="btn" data-close-drawer>Cancel</button></div></form></div>`);
  $('#cnsf').onsubmit = (e) => {
    e.preventDefault();
    const months = Number($('#cnsrev').value);
    if (!Number.isInteger(months) || months < 1 || months > 120) { $('#cnse').textContent = 'The review interval is a whole number of months, from 1 to 120'; return; }
    const owner = $('#cnsowner').value || null;
    if (!owner && space.included) { $('#cnse').textContent = `An included ${repo ? 'repository' : 'space'} needs an owner`; return; }
    const wanted = {
      owner_user_id: owner,
      default_domain_id: $('#cnsdom').value || null,
      review_interval_months: months,
      ...(repo ? {} : { default_authority: $('#cnsauth').value, default_sensitivity: $('#cnssens').value }),
    };
    const current = { owner_user_id: space.owner_user_id || null, default_authority: authority, default_sensitivity: sensitivity, default_domain_id: space.default_domain_id || null, review_interval_months: space.review_interval_months };
    const change = Object.fromEntries(Object.entries(wanted).filter(([k, v]) => v !== current[k]));
    if (!Object.keys(change).length) { B.closeDrawer(); return; }
    B.busy($('#cnsgo'), async () => {
      const updated = await B.api.patch(`/admin/containers/${space.id}`, change);
      data.containers[data.containers.findIndex((x) => x.id === space.id)] = updated;
      B.closeDrawer();
      B.toast(updated.included ? 'Saved. Broth re-reads this space now.' : 'Saved');
      draw();
    }, (error) => { $('#cnse').textContent = (error && error.detail) || B.problem(error); });
  };
}

function githubAppForm() {
  const [title] = CREDENTIALS.github_app;
  B.openModal(`<div class="modal" role="dialog" aria-label="${esc(title)}"><div class="bar"><span>${esc(title)}</span><button type="button" class="link" data-close-modal>Close</button></div><div class="body"><h2>${esc(title)}</h2><p class="sub">The new app replaces the current one right away. The private key and webhook secret are never shown again. ${window.DOCS.link('docsPrivateKey', 'Getting the key')}</p><form id="credf" novalidate><label class="hsl" for="credapp">App ID</label><input id="credapp" class="eminp" inputmode="numeric" autocomplete="off" spellcheck="false"><label class="hsl" for="credkey">Private key</label><textarea id="credkey" class="eminp cnkey" rows="5" autocomplete="off" spellcheck="false" placeholder="-----BEGIN RSA PRIVATE KEY-----"></textarea><label class="hsl" for="credhook">Webhook secret</label><input id="credhook" class="eminp" type="password" autocomplete="off" spellcheck="false"><div class="hse" id="crede" role="alert"></div><div class="actions"><button type="submit" class="btn primary" id="credgo">Save</button><button type="button" class="btn" data-close-modal>Cancel</button></div></form></div></div>`);
  $('#credapp').focus();
  $('#credf').onsubmit = (e) => {
    e.preventDefault();
    const app_id = $('#credapp').value.trim(), private_key = $('#credkey').value.trim(), webhook_secret = $('#credhook').value.trim();
    if (!/^\d+$/.test(app_id)) { $('#crede').textContent = 'The App ID is a number, from the app\'s settings on GitHub'; return; }
    if (!private_key || !webhook_secret) { $('#crede').textContent = 'Enter the private key and the webhook secret'; return; }
    B.busy($('#credgo'), async () => {
      await B.api.put('/admin/credentials/github_app', { app_id, private_key, webhook_secret });
      B.closeModal();
      B.toast('Saved');
      await refresh();
    }, (error) => { $('#crede').textContent = B.problem(error); });
  };
}
function credentialForm(name) {
  if (name === 'github_app') { githubAppForm(); return; }
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

window.ADMIN.tabs.connectors = { label: 'Connectors', hint: 'Where Broth reads from. People still only see what they can already open.', roles: ['admin'], render };
})();
