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
 * authorization returns to /admin/connectors?connected=<id> (now /admin/sources, the old address redirects) or ?error=<reason>.
 */
(() => {
'use strict';
const B = window.BRAIN;
/** @type {(s: string, r?: ParentNode) => any} */
const $ = (s, r = document) => r.querySelector(s);
/** @type {(s: string, r?: ParentNode) => any[]} */
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = B.esc;

const STATUS = { healthy: ['Connected', 'ok'], degraded: ['Degraded', 'warn'], failing: ['Failing', 'bad'], disconnected: ['Disconnected', ''] };
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
/** The cards rise once per visit to the page, not on every repaint. */
let riseDone = false;
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
  return { connections: B.rows(connections), containers: B.rows(containers), credentials: B.rows(credentials), users: B.rows(users), domains: B.rows(domains) };
}
/** Every run the page shows: each connection's and each space's running and last run. */
const runsOf = (connections, containers) => [...connections, ...containers].flatMap((x) => [x.active_run, x.last_run]);

/** Handles the return from Atlassian, then drops the query so a reload starts clean. */
function readReturn() {
  const q = new URLSearchParams(location.search);
  if (!q.has('connected') && !q.has('error')) return;
  if (q.has('connected')) {
    banner = null;
    history.replaceState({}, '', BASE);
    connected = q.get('connected');
  } else {
    banner = OAUTH_ERRORS[q.get('error')] || 'The Confluence authorization did not finish. Authorize again.';
    history.replaceState({}, '', BASE);
  }
  return undefined;
}

/* Every source Broth can read now or will: the real ones show their state from the API; the rest
   are honest Coming soon cards. */
/** The address of a source's own page. */
const SLUG = { confluence: 'confluence', github: 'docs-repositories', gdrive: 'google-drive' };
/** The canonical address of Sources. The old /admin/connectors still works: the router sends it here, query string kept. */
const BASE = '/admin/sources';
const pagePath = (src) => `${BASE}/${SLUG[src.key]}`;
/** The source whose page is open, or null on the grid. */
let pageSrc = null;
const SOURCES = [
  { key: 'confluence', name: 'Confluence', logo: 'confluence', systems: ['confluence'], real: true, blurb: 'Read your wiki.' },
  { key: 'github', name: 'Docs repositories', logo: 'github', systems: ['github_docs'], real: true, blurb: 'Read docs from GitHub.' },
  { key: 'gdrive', name: 'Google Drive', logo: 'google-drive', systems: ['gdrive'], real: true, blurb: 'Read your shared drives.' },
  { key: 'notion', name: 'Notion', logo: 'notion', systems: [], real: false, blurb: 'Read your notes.' },
  { key: 'gcs', name: 'Google Cloud Storage', logo: 'google-cloud-storage', systems: [], real: false, blurb: 'Read your buckets.' },
  { key: 'slack', name: 'Slack', logo: 'slack', systems: [], real: false, blurb: 'Read your channels.' },
  { key: 'sharepoint', name: 'SharePoint', logo: 'sharepoint', systems: [], real: false, blurb: 'Read your sites.' },
  { key: 'creds', name: 'App credentials', logo: null, systems: [], real: false, blurb: 'The apps Broth uses in this sandbox.' },
];
const liveOf = (src) => data.connections.filter((c) => src.systems.includes(c.system) && c.status !== 'disconnected');
const needsAuth = (c) => (c.system === 'confluence' || c.system === 'github_docs') && !c.authorized;
const warned = (c) => Object.values(c.warnings || {}).some(Boolean);
/** The card's state: a tag, one short line, and a progress fraction while a read is running. */
function stateOf(src) {
  if (src.key === 'creds') { const todo = data.credentials.some((c) => !c.configured); return { tag: todo ? ['Needs setup', 'warn'] : ['Configured', 'ok'], line: src.blurb, fraction: null, conns: [] }; }
  const conns = liveOf(src);
  if (!conns.length) return src.real ? { tag: ['Not connected', ''], line: src.blurb, fraction: null, conns } : { tag: ['Soon', ''], line: 'Coming soon.', fraction: null, conns, soon: true };
  const running = conns.find((c) => c.active_run && c.active_run.status === 'running');
  const view = running ? SYNC.runView(running.active_run) : null;
  const sites = conns.map((c) => c.site).join(', ');
  const spaces = data.containers.filter((x) => conns.some((c) => c.id === x.connection_id) && x.included).length;
  const unit = src.key === 'github' ? 'repositories' : src.key === 'gdrive' ? 'drives' : 'spaces';
  const line = `${sites} · ${spaces} ${spaces === 1 ? unit.replace(/ies$/, 'y').replace(/s$/, '') : unit}`;
  let tag;
  if (conns.some(needsAuth)) tag = ['Needs authorising', 'warn'];
  else if (running) tag = ['Syncing', 'blue'];
  else if (conns.some((c) => c.status === 'failing')) tag = ['Failing', 'bad'];
  else if (conns.some((c) => c.status === 'degraded') || conns.some(warned)) tag = ['Warnings', 'warn'];
  else tag = ['Connected', 'ok'];
  return { tag, line, fraction: view && view.fraction !== null ? view.fraction : null, conns };
}
function sourceCard(src) {
  const st = stateOf(src);
  return `<button type="button" class="ds-card lift adsc srccard${st.soon ? ' soonc' : ''}" data-src="${src.key}" ${st.conns.length ? '' : ' aria-haspopup="dialog"'} aria-label="${st.conns.length ? 'Open ' : ''}${esc(src.name)}, ${esc(st.tag[0])}"><div class="adsch"><span class="adsl">${src.logo ? B.srcIcon(src.logo, 28) : ICON('lock', 20)}</span><div><b>${esc(src.name)}</b><small>${esc(st.line)}</small></div><span class="tag ${st.tag[1]}">${st.tag[0]}</span></div></button>`;
}
/** What a card opens: its setup section when it has one, its first step when it is not connected, or the Coming soon dialog. */
function sourcePop(anchor, src) {
  const st = stateOf(src);
  if (st.conns.length && SLUG[src.key]) { B.go(pagePath(src)); return; }
  if (src.key === 'creds' || src.key === 'gdrive') { if (openSection(src)) return; }
  if (src.real) { connectForm(src); return; }
  openModal(shell(src.name, soonStory(src), 480, B.srcIcon(src.logo, 22)));
}
/** A source's own page: the title with its logo and state, the section laid out as the page body. */
function showPage(body) {
  const st = stateOf(pageSrc);
  const key = SECTIONS[pageSrc.key];
  const sec = $(`#cnhold [data-sec="${key}"]`, body);
  if (!sec) return;
  const wrap = document.createElement('div');
  wrap.className = 'srcpage srcm';
  const link = $('.cnsec-h .dclink', sec);
  wrap.appendChild(sec);
  body.insertBefore(wrap, $('#cnpick', body));
  const hold = $('#cnhold', body);
  if (hold) hold.hidden = true;
  const head = $('.cnsec-h', sec);
  if (head) head.remove();
  window.ADMIN.setTitle(`<span class="srctl"><span class="adsl">${B.srcIcon(pageSrc.logo, 28)}</span><span>${esc(pageSrc.name)}</span>${st.conns.length > 1 || st.tag[1] !== 'ok' ? `<span class="tag ${st.tag[1]}">${st.tag[0]}</span>` : ''}</span>`, BASE, 'Sources');
  window.ADMIN.actions(link ? window.DOCS.link('docsInstall', 'How to connect').replace('class="dclink"', 'class="dclink btn sm"') : '');
}
/* Every dialog here is the prototype's: a centred .modal in the shared #modal host, a title bar with a
   Close link, a body. A source's setup (its section: connections, spaces, steps, credentials) is moved
   into the dialog while it is open and back into the page's holder when it closes, so its buttons, its
   run status and its polling stay the page's own code. */
const shell = (label, inner, width, lead) => `<div class="modal bt srcm" style="max-width:${width || 480}px" role="dialog" aria-label="${esc(label)}"><div class="bar"><span class="dmttl">${lead || ''}${esc(label)}</span><button type="button" class="link" data-close-modal>Close</button></div><div class="body">${inner}</div></div>`;
/** @type {{ sec: HTMLElement, key: string } | null} */
let secHome = null;
function restoreSec() {
  if (!secHome) return;
  const hold = $('#cnhold');
  if (hold && secHome.sec) hold.appendChild(secHome.sec);
  secHome = null;
}
/** Every dialog of this page goes through here, so an open section always goes home first. */
const openModal = (html) => { restoreSec(); B.openModal(html); };
new MutationObserver(() => { if (!$('#modal').classList.contains('on')) restoreSec(); }).observe($('#modal'), { attributes: true, attributeFilter: ['class'] });
const SECTIONS = { confluence: 'confluence', github: 'docs', gdrive: 'drive', creds: 'creds' };
function openSection(src) {
  const key = SECTIONS[src.key];
  const sec = key && $(`#cnhold [data-sec="${key}"]`);
  if (!sec) return false;
  openModal(shell(src.name, '<div id="srcbody"></div>', src.key === 'github' ? 720 : 640, src.logo ? B.srcIcon(src.logo, 22) : ICON('lock', 18)));
  const box = $('#srcbody');
  box.appendChild(sec);
  // The failed-pages link inside a section is handled by the page's delegated click.
  box.onclick = (e) => { const page = $('#cnbody'); if (page && page.onclick) page.onclick(e); };
  secHome = { sec, key };
  return true;
}
const missingApp = (name) => B.sandbox() && data && data.credentials.some((c) => c.name === name && !c.configured);
const row = (logo, name, line, action) => `<div class="srow"><span class="adsl">${logo}</span><span class="ltb"><b>${esc(name)}</b><small>${esc(line)}</small></span>${action}</div>`;
/** The sources not yet connected, in this order. A connected source has its card and is not offered again. */
const PICK_ORDER = ['confluence', 'github', 'gdrive', 'notion', 'gcs', 'slack', 'sharepoint'];
const offered = () => PICK_ORDER.map((k) => SOURCES.find((x) => x.key === k)).filter((src) => src && !stateOf(src).conns.length);
/* What a source that is not built yet will do, written in one place. Each entry has three blocks:
   read (what Broth will read), answers (how answers use it) and access (who can see what). A source
   without an entry gets the generic story. */
const SOURCE_STORIES = {
  notion: {
    read: 'Pages and databases in the workspaces you pick, with their properties such as status and owner. Nested pages will be read with the page they sit under.',
    answers: 'Wiki pages go stale quietly, so answers will show who owns a page and when it was last verified. Each answer will link back to the Notion page.',
    access: "Broth will check Notion's permissions on every question, so people only get answers from pages they can open. Admins pick the workspaces and name an owner for each.",
  },
  slack: {
    read: 'Public channels you choose, read one thread at a time. Private channels and direct messages will never be read.',
    answers: 'Decisions often sit buried in chat, so answers will cite the thread that holds one and link back to the message, with when it was last confirmed.',
    access: 'People only get answers from channels they can already join. Admins choose which channels to connect and who owns each one.',
  },
  sharepoint: {
    read: 'Sites and document libraries you choose, including Word, Excel and PowerPoint files and site pages.',
    answers: 'Answers will cite the file or page and link back to it in SharePoint, with the site owner and when it was last verified shown beside it.',
    access: 'Broth will respect Microsoft 365 permissions on every question, so people only get answers from items they can open. Admins pick the sites and the owner of each.',
  },
  gcs: {
    read: 'Buckets and folders you choose, with the PDFs and text files inside them.',
    answers: 'Files carry no author, so the owner of each bucket will be the person you assign, and answers will show that name. Each answer will link back to the file.',
    access: "Broth will follow the bucket's own access rules, so people only get answers from files they can open. Admins choose the buckets and who owns each.",
  },
};
const STORY_FALLBACK = (name) => ({
  read: `The content you pick in ${name}.`,
  answers: 'Answers will cite the original item with a link back, and show its owner and when it was last verified, as they do for other sources. Its content will appear in the Library under its own section.',
  access: `Broth will keep ${name}'s own access rules, so people only get answers from items they can already open there. Admins choose which parts to connect and who owns each.`,
});
/** The Coming soon dialog's body: three short blocks and an honest closing line. */
function soonStory(src) {
  const story = SOURCE_STORIES[src.key] || STORY_FALLBACK(src.name);
  const block = (icon, title, text) => `<div class="storyblk"><span class="storyic" aria-hidden="true">${ICON(icon, 16)}</span><div><b>${title}</b><p>${esc(text)}</p></div></div>`;
  return `<div class="dmbody"><div class="srcstate"><span class="tag">Coming soon</span></div><div class="story">${block('doc', 'What Broth will read', story.read)}${block('link', 'How answers use it', story.answers)}${block('lock', 'Who can see what', story.access)}</div><p class="storyend">Not available yet. Connecting will work like Confluence: authorise once, pick what to include, and Broth reads it on a schedule.</p><div class="actions"><span class="lsp"></span><button type="button" class="btn" data-close-modal>Close</button></div></div>`;
}
const soonRow = (src) => row(B.srcIcon(src.logo, 28), src.name, 'Coming soon.', '');
/** Add a source: a picker. Choosing a real source opens its own setup. */
function addSource() {
  const list = offered();
  const rows = list.map((src) => (src.real || src.key === 'gdrive'
    ? row(B.srcIcon(src.logo, 28), src.name, src.blurb, `<button type="button" class="btn sm primary" data-pickgo="${src.key}">${src.key === 'gdrive' ? 'Set up' : 'Connect'}</button>`)
    : soonRow(src))).join('');
  openModal(shell('Add a source', list.length ? `<div class="dmbody"><div class="slist">${rows}</div></div>` : '<div class="ds-empty"><b>Every source is connected</b></div>'));
  $$('[data-pickgo]', $('#modal')).forEach((b) => { b.onclick = () => { const src = SOURCES.find((x) => x.key === b.dataset.pickgo); sourcePop(null, src); }; });
}
/** A real source that is not connected yet: its first step (the app, or the site) in the dialog. */
function connectForm(src) {
  const github = src.key === 'github';
  const app = github ? 'github_app' : 'confluence_oauth';
  const lead = B.srcIcon(src.logo, 22);
  if (missingApp(app)) {
    openModal(shell(src.name, `<div class="dmbody"><div class="slist">${row(B.srcIcon(src.logo, 28), src.name, 'Add the app first, then connect.', `<button type="button" class="btn sm primary" id="srcapp">${github ? 'Add the GitHub App' : 'Add the Confluence app'}</button>`)}</div></div>`, 480, lead));
    $('#srcapp').onclick = () => { B.closeModal(); credentialForm(app); };
    return;
  }
  openModal(shell(src.name, github
    ? `<form id="ghadd" class="dmbody" novalidate><div><label class="dmlab" for="ghlogin">GitHub organization or user</label><div class="cnaddrow"><input id="ghlogin" class="eminp" placeholder="Organization or user, like kredete" autocomplete="off" spellcheck="false"><button type="submit" class="btn primary" id="ghaddgo">Connect</button></div><div class="hse ds-msg bad" id="ghadde" role="alert"></div></div></form>`
    : `<form id="cnadd" class="dmbody" novalidate><div><label class="dmlab" for="cnsite">Confluence site</label><div class="cnaddrow"><input id="cnsite" class="eminp" placeholder="yourteam.atlassian.net" autocomplete="off" spellcheck="false" inputmode="url"><button type="submit" class="btn primary" id="cnaddgo">Connect</button></div><div class="hse ds-msg bad" id="cnadde" role="alert"></div></div></form>`, 480, lead));
  const flag = (id, msg) => { const f = $(id === 'cn' ? '#cnsite' : '#ghlogin'); $(`#${id}adde`).textContent = msg; if (msg) f.setAttribute('aria-invalid', 'true'); else f.removeAttribute('aria-invalid'); };
  if (github) {
    setTimeout(() => $('#ghlogin').focus(), 80);
    $('#ghlogin').oninput = () => flag('gh', '');
    $('#ghadd').onsubmit = (e) => {
      e.preventDefault();
      const login = $('#ghlogin').value.trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\/.*$/, '');
      if (!GITHUB_LOGIN.test(login)) { flag('gh', 'Enter the GitHub organization or user name, like kredete'); return; }
      B.busy($('#ghaddgo'), async () => {
        const created = await B.api.post('/admin/connections', { system: 'github_docs', site: login });
        await install(created.id);
      }, (error) => { flag('gh', B.problem(error)); refresh(); });
    };
  } else {
    setTimeout(() => $('#cnsite').focus(), 80);
    $('#cnsite').oninput = () => flag('cn', '');
    $('#cnadd').onsubmit = (e) => {
      e.preventDefault();
      // SOURCES checks the address, creates the connection and sends the admin to Atlassian.
      B.busy($('#cnaddgo'), async () => {
        const id = await window.SOURCES.createConnection($('#cnsite').value);
        await window.SOURCES.authorize(id);
      }, (error) => { flag('cn', B.problem(error)); if (error && error.status) refresh(); });
    };
  }
}

async function render(el, params) {
  if (readReturn() === 'moved') return;
  pageSrc = params && params.source ? SOURCES.find((x) => SLUG[x.key] === params.source) || null : null;
  riseDone = false;
  stopReads();
  window.ADMIN.actions('');
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
    // A new connection lands on its own page.
    if (c) { B.go(c.system === 'github_docs' ? `${BASE}/docs-repositories` : c.system === 'gdrive' ? `${BASE}/google-drive` : `${BASE}/confluence`, { replace: true }); return; }
  }
  draw();
}
function draw() {
  const body = $('#cnbody');
  if (!body || !data) return;
  // A source's own page: only connected sources have one; anything else goes back to the grid.
  if (pageSrc && !stateOf(pageSrc).conns.length) { B.go(BASE, { replace: true }); return; }
  const open = pageSrc ? null : (secHome ? secHome.key : null);
  const confluence = data.connections.filter((c) => c.system === 'confluence' && c.status !== 'disconnected');
  const drive = data.connections.filter((c) => c.system === 'gdrive' && c.status !== 'disconnected');
  const conf = data.credentials.find((c) => c.name === 'confluence_oauth');
  const docs = data.connections.filter((c) => c.system === 'github_docs' && c.status !== 'disconnected');
  const app = data.credentials.find((c) => c.name === 'github_app');
  const conns = data.connections.filter((c) => c.status !== 'disconnected' && ['confluence', 'gdrive', 'github_docs'].includes(c.system));
  const cards = `<div class="ds-grid c3 cnover"><button type="button" class="ds-card add" id="cnaddcard"><span class="ds-ic adsti">${ICON('plus', 18)}</span><b>Add a source</b><small>Confluence, Docs repositories</small></button>${SOURCES.filter((src) => src.key !== 'creds' || B.sandbox()).map((src) => sourceCard(src)).join('')}</div>`;
  // Nothing connected yet (an admin right after setup): the framed header card, about sources in general.
  const none = !SOURCES.some((src) => liveOf(src).length);
  const first = none ? `<div class="ds-empty suempty cnfirst"><span class="ds-empty-ic">${ICON('plug', 20)}</span><b>Connect your first source</b><p>Broth reads the pages you connect.</p><button type="button" class="btn primary" id="cnfirst">Add a source</button></div>` : '';
  body.innerHTML = (pageSrc ? '' : first + cards) + '<div id="cnpick"></div><div id="cnhold"' + (pageSrc ? ' data-page' : ' hidden') + '>' + `<section class="cnsec" data-sec="confluence"><div class="cnsec-h">${B.srcIcon('confluence', 32)}<div><h2>Confluence</h2></div>${confluence.length ? '<span class="tag ok">Connected</span>' : '<span class="tag">Not connected</span>'}</div>
      ${B.sandbox() && conf && !conf.configured ? `<div class="notice low"><span>Add the Confluence app below before connecting a site.</span></div>` : ''}
      ${B.sandbox() && conf ? `<div class="fgroup cncreds">${credentialRow(conf)}</div>` : ''}
      ${confluence.map(connectionHtml).join('') || `<div class="ds-empty"><b>No Confluence site is connected</b><p>Use Add a source to connect one.</p></div>`}
</section>
    <section class="cnsec" data-sec="drive"><div class="cnsec-h">${B.srcIcon('gdrive', 32)}<div><h2>Google Drive</h2></div>${B.sandbox() ? '<span class="tag">Needs Google Workspace</span>' : drive.length ? '<span class="tag ok">Connected</span>' : '<span class="tag">Not connected</span>'}</div>
      ${B.sandbox() ? '<div class="notice none"><span>Google Drive needs a Google Workspace account: Broth reads Drive through domain-wide delegation, which a personal Google account does not have.</span></div>' : ''}
      <ol class="cncheck ${B.sandbox() ? 'off' : ''}"><li><b>Authorize Broth in the Google Admin console</b><span>Add Broth's client ID with the Drive and Admin SDK read scopes under domain-wide delegation.</span></li><li><b>Add the indexer to each shared drive</b><span>Invite broth-indexer@ as a viewer on every shared drive Broth should read.</span></li><li><b>Verify</b><span>Broth checks that it can see each shared drive, then you include them.</span></li></ol>
      ${drive.map(connectionHtml).join('')}</section>
    <section class="cnsec" data-sec="docs"><div class="cnsec-h">${B.srcIcon('github_docs', 32)}<div><h2>Docs repositories</h2>${window.DOCS.link('docsInstall', 'How to connect').replace('class="dclink"', 'class="dclink btn sm"')}</div>${docs.length ? '<span class="tag ok">Connected</span>' : '<span class="tag">Not connected</span>'}</div>
      ${B.sandbox() && app && !app.configured ? `<div class="notice low"><span>Add the GitHub App below before connecting an account.</span></div>` : ''}
      ${B.sandbox() && app ? `<div class="fgroup cncreds">${credentialRow(app)}</div>` : ''}
      ${docs.map(connectionHtml).join('') || `<div class="ds-empty"><b>No GitHub account is connected</b><p>Use Add a source to connect one.</p></div>`}
</section>
    ${B.sandbox() ? `<section class="cnsec" data-sec="creds"><div class="cnsec-h"><span class="cnsec-i">${ICON('lock', 18)}</span><div><h2>App credentials</h2></div></div><div class="fgroup cncreds">${data.credentials.filter((c) => c.name === 'google_oauth').map(credentialRow).join('')}</div></section>` : ''}</div>`;
  if (open) {
    const fresh = $(`#cnhold [data-sec="${open}"]`);
    const box = $('#srcbody');
    if (fresh && box) { box.replaceChildren(fresh); secHome = { sec: fresh, key: open }; } else secHome = null;
  }
  if (pageSrc) showPage(body);
  const addCard = $('#cnaddcard');
  if (addCard) addCard.onclick = addSource;
  const fb = $('#cnfirst');
  if (fb) fb.onclick = addSource;
  pickSpaces(body, conf);
  if (!riseDone && $('.cnover', body)) { riseDone = true; window.ADMIN.life($('.cnover', body)); }
  $$('[data-src]', body).forEach((b) => { b.onclick = () => sourcePop(b, SOURCES.find((x) => x.key === b.dataset.src)); });
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
  const cols = repos ? 'minmax(0,1.1fr) minmax(0,1.2fr) 124px 88px 72px' : 'minmax(0,1.4fr) minmax(0,1.1fr) 88px 72px';
  const needs = (c.system === 'confluence' || repos) && !c.authorized;
  const start = repos ? '<button type="button" class="btn sm primary" data-cact="install">Install on GitHub</button>' : '<button type="button" class="btn sm primary" data-cact="authorize">Authorize with Atlassian</button>';
  const find = repos ? 'Find repositories' : 'Find spaces';
  return `<div class="cnconn" data-conn="${c.id}"><div class="cnconn-h"><b>${esc(c.site)}</b><span class="cnstate"></span><span class="lsp"></span><span class="amute cnsync" role="status"></span></div>
    <div class="cnbar"></div><div class="cnfails"></div><div class="cnerrs"></div>
    ${warningsHtml(c.warnings || {})}
    <div class="cnacts">${needs ? start : `<button type="button" class="btn sm" data-cact="verify">${find}</button><button type="button" class="btn sm cnsyncb" data-cact="sync"><span class="suspin" aria-hidden="true"></span><span>Sync now</span></button>${c.system === 'confluence' ? '<button type="button" class="btn sm" data-cact="authorize">Re-authorize</button>' : ''}`}<span class="lsp"></span><button type="button" class="btn sm" data-cact="disconnect">Disconnect</button></div>
    ${c.authorized || c.system === 'gdrive' ? `<div class="cnspaces">${spaces.length ? `<div class="dt" style="--cols:${cols}"><div class="dt-r dt-h"><span>${unit}</span><span>Owner</span>${repos ? '<span>Bots</span>' : ''}<span>Settings</span><span class="cninc">Included</span></div>${spaces.map((s) => spaceRow(s, repos)).join('')}</div>` : `<div class="ds-empty cnnone"><b>No ${repos ? 'repositories' : 'spaces'} found yet</b><p>Use ${find}.</p></div>`}</div>` : ''}</div>`;
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
  return `<div class="dt-r" data-space="${s.id}"><span class="dtp"><span><b>${esc(name)}</b><span class="cnsrun" role="status"></span></span></span><span class="cnown"><select data-owner aria-label="Owner of ${esc(name)}"><option value="" ${s.owner_user_id ? '' : 'selected'}>No owner</option>${options}</select></span>${repos ? declarationCell(s) : ''}<span class="cnset"><button type="button" class="btn sm" data-settings aria-label="Settings for ${esc(name)}">Settings</button></span><span class="cninc"><input type="checkbox" class="sw" data-include ${s.included ? 'checked' : ''} aria-label="Include ${esc(name)}"></span></div>`;
}
function credentialRow(c) {
  const [title, sub] = CREDENTIALS[c.name] || [c.name, ''];
  return `<div class="frow cnc" data-cred="${c.name}"><div class="frl"><b>${title}</b><small>${sub}</small></div><div class="frv">${c.configured ? `<span class="amute">Configured · ${c.name === 'github_app' ? 'App ID' : 'Client ID'} ends in ${esc(c.client_id_last4 || '')}${c.updated_at ? ' · ' + B.when(c.updated_at, B.ago(c.updated_at)) : ''}</span>` : '<span class="tag warn">Not configured</span>'}</div><div class="fra"><button type="button" class="btn sm" data-cedit="${c.name}">${c.configured ? 'Replace' : 'Add'}</button></div></div>`;
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
        if (act === 'authorize') { await window.SOURCES.authorize(id); return; }
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
  $$('.dt-r[data-space]', body).forEach((row) => {
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
/* A Confluence site that is authorised but reads no space yet: the picker; while the first reads
   run: their progress. Both come from SOURCES, the same code the wizard used. */
let stopReads = () => {};
function pickSpaces(body, conf) {
  stopReads();
  if (pageSrc && pageSrc.key !== 'confluence') return;
  const c = data.connections.find((x) => x.system === 'confluence' && x.status !== 'disconnected' && x.authorized);
  const slot = $('#cnpick', body);
  if (!c || !slot) return;
  const S = window.SOURCES;
  const mine = () => data.containers.filter((x) => x.connection_id === c.id);
  const failing = S.failingHtml(mine());
  if (S.included(mine()).length) {
    // Reads running or done: progress while they run, and the unreadable pages notice after.
    const running = S.reads(mine()).some((r) => r && r.status === 'running');
    if (running) {
      slot.innerHTML = '<div class="ds-card susync" role="status"></div>';
      const box = $('.susync', slot);
      let shown = '';
      const state = { connection: c, containers: mine() };
      shown = S.paintReads(box, S.readsHtml(state.containers), shown);
      stopReads = S.watchReads(state, () => {
        shown = S.paintReads(box, S.readsHtml(state.containers), shown);
        if (!S.reads(state.containers).some((r) => r && r.status === 'running')) { stopReads(); refresh(); }
      });
    } else if (failing) slot.innerHTML = `<div class="notice low" role="status"><span>${failing}</span></div>`;
    return;
  }
  const containers = mine();
  slot.innerHTML = `<div class="ds-card cnpick"><h2>Pick the spaces Broth reads</h2><div id="supick"></div><div class="hse ds-msg bad" id="sue" role="alert"></div><div class="actions"><button type="button" class="btn" id="surefresh">Look again</button><span class="lsp"></span><button type="button" class="btn primary" id="sugo" disabled><span>Pick at least one space</span></button></div></div>`;
  const list = $('#supick', slot), go = $('#sugo', slot), err = $('#sue', slot);
  const ticked = new Map();
  const label = () => { const n = S.countPicked(slot); go.disabled = !n; $('span', go).textContent = n ? `Include ${n} ${n === 1 ? 'space' : 'spaces'}` : 'Pick at least one space'; };
  const draw = (items) => {
    $$('[data-space]', slot).forEach((x) => ticked.set(x.dataset.space, x.checked));
    list.innerHTML = items.length ? S.spacesTableHtml(items, ticked) : `<div class="ds-empty"><b>No spaces found</b><p>Broth found no spaces it can read on ${esc(c.site)}.</p></div>`;
    $$('[data-space]', slot).forEach((x) => { x.onchange = label; });
    label();
  };
  draw(containers);
  let known = containers;
  $('#surefresh', slot).onclick = () => B.busy($('#surefresh', slot), async () => {
    err.textContent = '';
    try { known = await S.refreshSpaces(c); }
    catch (error) { err.textContent = `Couldn't check Confluence for new spaces: ${(error && error.detail) || B.problem(error)}`; }
    draw(known);
  });
  $('.cnpick', slot).onsubmit = null;
  go.onclick = () => B.busy(go, async () => { await S.includeSpaces(S.pickedSpaces(slot)); await refresh(); }, (error) => { err.textContent = B.problem(error); });
}
/** Sends the admin to GitHub to install the app; GitHub returns to this page. */
async function install(id) {
  const started = await B.api.post(`/admin/connections/${id}/github/install`);
  location.assign(started.install_url);
}
function declarationForm(repo) {
  const name = B.containerName(repo.path);
  openModal(`<div class="modal" role="dialog" aria-label="Request public for ${esc(name)}"><div class="bar"><span>Request public</span><button type="button" class="link" data-close-modal>Close</button></div><div class="body"><h2>Make ${esc(name)} Public</h2><p class="sub">Every page this repository publishes becomes Public once another admin, or an owner of its domain, approves. Bots can then answer from it, and later changes need no new approval. ${window.DOCS.link('docsDeclaration')}</p><form id="declf" novalidate><label class="hsl" for="declwhy">Why</label><textarea id="declwhy" class="eminp" rows="3" maxlength="500" placeholder="Published at docs.kredete.com"></textarea><div class="hse" id="decle" role="alert"></div><div class="actions"><button type="submit" class="btn primary" id="declgo">Request</button><button type="button" class="btn" data-close-modal>Cancel</button></div></form></div></div>`);
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
  // A finished, healthy read is plain muted text ("Synced 7 h ago · No changes"); a tag marks only a problem.
  if (view.tag === 'ok') return `<span>${esc(view.label)}${rest ? ' ' + rest : ''}</span>`;
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
    const held = B.rows(page);
    box.innerHTML = held.length
      ? `<h3 class="cnnh">Kept out of Public</h3><ul class="cnflist">${held.map((n) => `<li><span class="cnft">${esc(n.title || n.external_id)}</span><span class="cnfr">${esc(n.notice)}</span>${n.url ? `<a class="cnfo" href="${esc(n.url)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${esc(n.title || n.external_id)} on the docs site">${ICON('ext', 14)}</a>` : ''}</li>`).join('')}</ul><p class="cndoc">${window.DOCS.link('docsProblems', 'What these mean')}</p>`
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
    list.items.push(...B.rows(page));
    list.next = B.cursorOf(page);
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
      latest = { ...data, connections: B.rows(connections), containers: B.rows(containers) };
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
  if (members) lines.push([`Only the indexer account should be in ${esc(members.group)}. Also in it: ${B.arr(members.members).map(esc).join(', ')}.`, 'indexerGroupMembers']);
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
  const system = connection ? connection.system : 'confluence';
  // The same right-hand shell as a document in the Library: source logo and name, X, a scrolling body and a footer.
  B.openDrawer(`<div class="sv" role="dialog" aria-modal="true" aria-label="${repo ? 'Repository settings' : 'Space settings'}, ${esc(name)}"><div class="sv-top"><span class="sv-sys">${B.srcIcon(system, 20)}${esc(B.systemName(system))}</span><button type="button" class="xbtn2" data-close-drawer aria-label="Close">${ICON('x', 16)}</button></div><form class="cnsform" id="cnsf" novalidate><div class="sv-body cnsettings">
    <h2>${esc(name)}</h2><p class="sub">${repo ? 'Repository settings' : 'Space settings'}. Every page in this ${repo ? 'repository' : 'space'} starts from these. A page's labels can only make it more cautious.</p><p class="cndoc">${window.DOCS.link(repo ? 'docsDeclaration' : 'spaceSettings')}</p>
    ${field('cnsowner', 'Owner', `<select id="cnsowner" aria-describedby="cnsownerh"><option value="">No owner</option>${options(people.map((u) => [u.id, u.name]), space.owner_user_id)}</select>`, SETTINGS_HELP.owner)}
    ${repo ? '<p class="suhint cnrepo">Published docs are approved. They are Internal until the repository is declared Public, then Public unless a page is labelled or holds a customer identifier.</p>' : `${field('cnsauth', 'Default authority', `<select id="cnsauth" aria-describedby="cnsauthh">${options(AUTHORITIES, authority)}</select>`, SETTINGS_HELP.authority)}
    ${field('cnssens', 'Default sensitivity', `<select id="cnssens" aria-describedby="cnssensh">${options(SENSITIVITIES, sensitivity)}</select>`, SETTINGS_HELP.sensitivity)}`}
    ${field('cnsdom', 'Default domain', `<select id="cnsdom" aria-describedby="cnsdomh"><option value="">No domain</option>${window.DOMAIN_TREE.optionTags(window.DOMAIN_TREE.tree(data.domains), { selected: space.default_domain_id })}</select>`, SETTINGS_HELP.domain)}
    ${field('cnsrev', 'Review interval in months', `<input id="cnsrev" class="eminp" type="number" inputmode="numeric" min="1" max="120" step="1" value="${space.review_interval_months}" aria-describedby="cnsrevh">`, SETTINGS_HELP.review)}
    <div class="hse" id="cnse" role="alert"></div></div>
    <div class="sv-act"><button type="submit" class="btn primary" id="cnsgo">Save</button><button type="button" class="btn" data-close-drawer>Cancel</button></div></form></div>`);
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
  openModal(`<div class="modal" role="dialog" aria-label="${esc(title)}"><div class="bar"><span>${esc(title)}</span><button type="button" class="link" data-close-modal>Close</button></div><div class="body"><h2>${esc(title)}</h2><p class="sub">The new app replaces the current one right away. The private key and webhook secret are never shown again. ${window.DOCS.link('docsPrivateKey', 'Getting the key')}</p><form id="credf" novalidate><label class="hsl" for="credapp">App ID</label><input id="credapp" class="eminp" inputmode="numeric" autocomplete="off" spellcheck="false"><label class="hsl" for="credkey">Private key</label><textarea id="credkey" class="eminp cnkey" rows="5" autocomplete="off" spellcheck="false" placeholder="-----BEGIN RSA PRIVATE KEY-----"></textarea><label class="hsl" for="credhook">Webhook secret</label><input id="credhook" class="eminp" type="password" autocomplete="off" spellcheck="false"><div class="hse" id="crede" role="alert"></div><div class="actions"><button type="submit" class="btn primary" id="credgo">Save</button><button type="button" class="btn" data-close-modal>Cancel</button></div></form></div></div>`);
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
  openModal(`<div class="modal" role="dialog" aria-label="${esc(title)}"><div class="bar"><span>${esc(title)}</span><button type="button" class="link" data-close-modal>Close</button></div><div class="body"><h2>${esc(title)}</h2><p class="sub">The new client replaces the current one right away.</p><form id="credf" novalidate><label class="hsl" for="credid">Client ID</label><input id="credid" class="eminp" autocomplete="off" spellcheck="false"><label class="hsl" for="credsecret">Client secret</label><input id="credsecret" class="eminp" type="password" autocomplete="off" spellcheck="false"><div class="hse" id="crede" role="alert"></div><div class="actions"><button type="submit" class="btn primary" id="credgo">Save</button><button type="button" class="btn" data-close-modal>Cancel</button></div></form></div></div>`);
  $('#credid').focus();
  $('#credf').onsubmit = (e) => {
    e.preventDefault();
    const client_id = $('#credid').value.trim(), client_secret = $('#credsecret').value.trim();
    if (!client_id || !client_secret) { $('#crede').textContent = 'Enter the client ID and the client secret'; return; }
    B.busy($('#credgo'), async () => {
      if (name === 'confluence_oauth') await window.SOURCES.saveConfluenceCredentials(client_id, client_secret);
      else await B.api.put(`/admin/credentials/${name}`, { client_id, client_secret });
      B.closeModal();
      B.toast('Saved');
      await refresh();
    }, (error) => { $('#crede').textContent = B.problem(error); });
  };
}
async function refresh() {
  try { data = await fetchAll(); draw(); } catch (error) { B.toast(B.problem(error)); }
}

window.ADMIN.tabs.connectors = { label: 'Sources', roles: ['admin'], render };
})();
