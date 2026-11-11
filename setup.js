/* setup.js: the setup wizard (sandbox spec 4.1, plan C3).
 *
 * Steps: setup code and email; Google OAuth client; sign in with Google; Confluence OAuth
 * client; connect Confluence; pick spaces; first sync, which lasts until every included space
 * has been read (sync runs spec 3.3). The current step is always derived
 * from API state, never stored in the browser:
 * - before sign-in, from GET /v1/setup/status;
 * - after sign-in (an admin), from /v1/admin/credentials, /connections and /containers.
 * An admin can leave the wizard; Finish setup stays in the sidebar until a Confluence
 * connection is serving.
 */
(() => {
'use strict';
const B = window.BRAIN;
const A = () => window.AUTH;
/** @type {(s: string, r?: ParentNode) => any} */
const $ = (s, r = document) => r.querySelector(s);
/** @type {(s: string, r?: ParentNode) => any[]} */
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = B.esc;
const SYNC = window.SYNC;

const STEPS = [
  ['claim', 'Claim this workspace', 'Setup code and your email'],
  ['google', 'Connect Google sign-in', 'Your Google OAuth client'],
  ['signin', 'Sign in', 'As the first admin'],
  ['confluence', 'Add the Confluence app', 'Your Atlassian OAuth client'],
  ['connect', 'Connect Confluence', 'Authorize your site'],
  ['spaces', 'Pick spaces', 'What Broth reads'],
  ['sync', 'First sync', 'Broth reads the pages'],
];
const index = (key) => STEPS.findIndex((s) => s[0] === key);

const included = (containers) => containers.filter((c) => c.included);
/** Each included space's read: the one running, or else the last one finished. */
const reads = (containers) => included(containers).map((c) => c.active_run || c.last_run);

/** Where setup stands, from the API. */
async function progress() {
  if (B.S.phase === 'setup') {
    const status = await B.api.get('/setup/status', undefined, { auth: false });
    B.S.setup = status;
    if (!status.needs_setup) return { step: 'signin' };
    if (!status.setup_session) return { step: 'claim' };
    return { step: status.google_configured ? 'signin' : 'google' };
  }
  const [credentials, connections] = await Promise.all([
    B.api.get('/admin/credentials'),
    B.api.get('/admin/connections'),
  ]);
  const confluence = credentials.items.find((c) => c.name === 'confluence_oauth');
  if (!confluence || !confluence.configured) return { step: 'confluence', credentials: credentials.items };
  const sites = connections.items.filter((c) => c.system === 'confluence' && c.status !== 'disconnected');
  const connection = sites.find((c) => c.authorized) || sites[0] || null;
  if (!connection || !connection.authorized) return { step: 'connect', connection };
  const containers = (await B.api.get('/admin/containers', { connection_id: connection.id })).items;
  if (!containers.some((c) => c.included)) return { step: 'spaces', connection, containers };
  /* Each included space is read by its own run; setup is done once the first reads have finished. */
  if (SYNC.firstReadsRunning(containers)) return { step: 'sync', connection, containers };
  return { step: 'done', connection, containers };
}

/* ---------- the shell around every step ---------- */
function checklist(current) {
  const at = current === 'done' ? STEPS.length : index(current);
  return `<div class="pvp sup" aria-hidden="true"><div class="pvw sucard"><div class="suh">${ICON('check', 14)}<b>Set up Broth</b></div><ol class="sul">${STEPS.map(([k, title, sub], i) => `<li class="${i < at ? 'done' : i === at ? 'on' : ''}"><i>${i < at ? ICON('check', 12) : i + 1}</i><span><b>${esc(title)}</b><small>${esc(sub)}</small></span></li>`).join('')}</ol></div><div class="pvcap">${current === 'done' ? 'All set' : `Step ${at + 1} of ${STEPS.length}`}</div></div>`;
}
function render(step, left) {
  const leave = B.S.phase === 'app' && step !== 'done' && step !== 'sync' ? `<button type="button" class="link suleave" id="suleave">Leave setup for now</button>` : '';
  A().shell(`${left}${leave}`, A().frame(checklist(step)), step === 'done' ? null : [index(step) + 1, STEPS.length]);
  const l = $('#suleave');
  if (l) l.onclick = () => B.go('/');
}
const field = (id, label, attrs, hint) => `<label class="emlab" for="${id}">${label}</label><input id="${id}" class="eminp" ${attrs || ''}>${hint ? `<p class="suhint">${hint}</p>` : ''}`;
const errorSlot = '<div class="hse" id="sue" role="alert"></div>';
const primary = (id, label) => `<button type="submit" class="btn primary si-btn" id="${id}"><span class="spin" aria-hidden="true"></span><span>${label}</span></button>`;
function showError(error) {
  const e = $('#sue');
  if (!e) return;
  e.textContent = B.problem(error);
  const wait = error && error.retryAfter;
  const button = $('#sin .si-btn');
  if (wait && button) {
    let left = wait;
    button.disabled = true;
    const tick = () => {
      if (!button.isConnected) return;
      if (left <= 0) { button.disabled = false; e.textContent = ''; return; }
      e.textContent = `${B.problem(error)}. Try again in ${left} s.`;
      left -= 1;
      setTimeout(tick, 1000);
    };
    tick();
  }
}
function copyButton(text) {
  return `<span class="sucopy"><code>${esc(text)}</code><button type="button" class="lib" data-copy="${esc(text)}" aria-label="Copy ${esc(text)}">${ICON('copy', 14)}</button></span>`;
}
function wireCopies() {
  $$('[data-copy]').forEach((b) => {
    b.onclick = async () => {
      try { await navigator.clipboard.writeText(b.dataset.copy); B.toast('Copied'); } catch (e) { B.toast('Copy it by hand'); }
    };
  });
}

/* ---------- steps ---------- */
/** Company and its logo square. Kept in this browser only (logo.js); the API never sees it. */
const companyRow = () => `<label class="emlab" for="suco">Company</label><div class="colog"><button type="button" class="adlogo sm" id="sulogo" aria-label="Add company logo"></button><input id="suco" class="eminp" autocomplete="organization" placeholder="Acme Bank"><input type="file" id="sulf" accept="image/png,image/jpeg,image/svg+xml,image/webp" hidden></div><p class="logomiss" id="sumiss" hidden><span>No logo found.</span> <button type="button" class="link" id="sulu">Upload yours</button><span class="hint" tabindex="0" data-tip="Your logo stays in this browser." aria-label="Your logo stays in this browser.">i</span></p>`;
function claimStep() {
  render('claim', `<h1>Set up Broth</h1><p class="sub">You are the first person here, so you become its admin. Enter the setup code from the server, and the Google account you will sign in with.</p>
    <form id="suf" novalidate>${field('sucode', 'Setup code', 'autocomplete="off" spellcheck="false" autocapitalize="characters" placeholder="XXXX-XXXX-XXXX-XXXX" class="eminp mono"')}${field('suemail', 'Your Google account', 'type="email" inputmode="email" autocomplete="email" placeholder="you@example.com"')}${companyRow()}${errorSlot}${primary('sugo', 'Continue')}</form>
    <p class="disc">Lost the code, or it expired? Run <code>make sandbox-setup-code</code> on the server for a new one.</p>`);
  $('#sucode').focus();
  if (window.BROTH_LOGO) window.BROTH_LOGO.mount($('#suf'), { domain: () => $('#suemail').value, toast: B.toast });
  $('#suf').onsubmit = (e) => {
    e.preventDefault();
    const code = $('#sucode').value.trim(), email = $('#suemail').value.trim();
    if (!code || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showError({ title: !code ? 'Enter the setup code' : 'Enter the email of your Google account' });
      return;
    }
    B.busy($('#sugo'), async () => {
      await B.api.post('/setup/claim', { code, email }, { auth: false });
      await show();
    }, showError);
  };
}
function googleStep() {
  const redirect = `${location.origin}/v1/auth/google/callback`;
  render('google', `<h1>Connect Google sign-in</h1><p class="sub">Create an OAuth client (web application) in your Google Cloud project and add this redirect URI:</p>${copyButton(redirect)}
    <form id="suf" novalidate>${field('suid', 'Client ID', 'autocomplete="off" spellcheck="false" placeholder="1234.apps.googleusercontent.com"')}${field('susecret', 'Client secret', 'type="password" autocomplete="off" spellcheck="false"', 'Stored encrypted. It is never shown again.')}${errorSlot}${primary('sugo', 'Save')}</form>`);
  wireCopies();
  $('#suid').focus();
  $('#suf').onsubmit = (e) => {
    e.preventDefault();
    const client_id = $('#suid').value.trim(), client_secret = $('#susecret').value.trim();
    if (!client_id || !client_secret) { showError({ title: 'Enter the client ID and the client secret' }); return; }
    B.busy($('#sugo'), async () => {
      await B.api.put('/setup/credentials/google_oauth', { client_id, client_secret }, { auth: false });
      await show();
    }, showError);
  };
}
function signinStep() {
  render('signin', `<h1>Sign in as the first admin</h1><p class="sub">Use the Google account you entered with the setup code. Setup continues after you sign in.</p><a class="btn primary si-btn" id="sugoogle" href="${B.api.signInUrl}"><span class="spin" aria-hidden="true"></span><span>Continue with Google</span></a>`);
  const b = $('#sugoogle');
  b.onclick = () => b.classList.add('busy');
}
function confluenceStep() {
  const callback = `${location.origin}/v1/admin/connections/oauth/callback`;
  render('confluence', `<h1>Add the Confluence app</h1><p class="sub">Create an OAuth 2.0 (3LO) app in the Atlassian developer console with the Confluence read scopes and offline access, and this callback URL:</p>${copyButton(callback)}
    <form id="suf" novalidate>${field('suid', 'Client ID', 'autocomplete="off" spellcheck="false"')}${field('susecret', 'Secret', 'type="password" autocomplete="off" spellcheck="false"', 'Stored encrypted. It is never shown again.')}${errorSlot}${primary('sugo', 'Save')}</form>`);
  wireCopies();
  $('#suid').focus();
  $('#suf').onsubmit = (e) => {
    e.preventDefault();
    const client_id = $('#suid').value.trim(), client_secret = $('#susecret').value.trim();
    if (!client_id || !client_secret) { showError({ title: 'Enter the client ID and the secret' }); return; }
    B.busy($('#sugo'), async () => {
      await B.api.put('/admin/credentials/confluence_oauth', { client_id, client_secret });
      await show();
    }, showError);
  };
}
async function authorize(connectionId) {
  const started = await B.api.post(`/admin/connections/${connectionId}/oauth/start`);
  location.assign(started.authorization_url);
}
function connectStep(p) {
  const c = p.connection;
  render('connect', c
    ? `<h1>Authorize ${esc(c.site)}</h1><p class="sub">Atlassian asks you to allow Broth to read Confluence. You come back here afterwards.</p><p class="sudoc">Sign in to Atlassian as Broth's own indexer account, not your personal one. ${window.DOCS.link('indexerAccount', 'Why a dedicated account', true)}</p>${c.last_error ? `<div class="banner bad">${esc(c.last_error)}</div>` : ''}<form id="suf" novalidate>${errorSlot}${primary('sugo', 'Authorize with Atlassian')}</form><p class="disc">Wrong site? Remove it in Admin, Connectors.</p>`
    : `<h1>Connect your Confluence site</h1><p class="sub">The address of the Confluence site Broth reads.</p><form id="suf" novalidate>${field('susite', 'Site', 'autocomplete="off" spellcheck="false" inputmode="url" placeholder="yourteam.atlassian.net"')}${errorSlot}${primary('sugo', 'Continue to Atlassian')}</form>`);
  const site = $('#susite');
  if (site) site.focus();
  $('#suf').onsubmit = (e) => {
    e.preventDefault();
    B.busy($('#sugo'), async () => {
      let id = c && c.id;
      if (!id) {
        const value = site.value.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
        if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(value)) { showError({ title: 'Enter the site address, like yourteam.atlassian.net' }); return; }
        id = (await B.api.post('/admin/connections', { system: 'confluence', site: value })).id;
      }
      $('#sugo').classList.add('busy');
      await authorize(id);
    }, showError);
  };
}
async function spacesStep(p) {
  render('spaces', `<h1>Pick the spaces Broth reads</h1><p class="sub">People still only see the pages they can open in Confluence.</p><p class="sudoc">Restricted pages reach Broth only when their authors share them with the broth-indexer group. ${window.DOCS.link('indexerGroup', 'How sharing works', true)}</p><div id="suspaces">${B.skeletonRows(3, 'gsrc')}</div><p class="surefresh">Missing a space? <button type="button" class="link" id="surefresh">Look again</button></p><form id="suf" novalidate>${errorSlot}${primary('sugo', 'Include spaces')}</form><p class="disc">You own these spaces in Broth for now. Change owners in Admin, Connectors.</p>`);
  const list = $('#suspaces');
  const go = $('#sugo');
  go.disabled = true;
  const count = () => $$('[data-space]:checked').length;
  const label = () => { go.disabled = !count(); $('span:last-child', go).textContent = count() ? `Include ${count()} ${count() === 1 ? 'space' : 'spaces'}` : 'Pick at least one space'; };
  /* Ticks the person changed survive a refresh; new spaces start ticked unless personal. */
  const ticked = new Map();
  function draw(containers) {
    $$('[data-space]').forEach((c) => ticked.set(c.dataset.space, c.checked));
    if (!containers.length) {
      list.innerHTML = `<p class="sub">Broth found no spaces it can read on ${esc(p.connection.site)}.</p>`;
      label();
      return;
    }
    list.innerHTML = `<div class="glist suspaces">${containers.map((c) => {
      const name = B.containerName(c.path);
      const on = ticked.has(c.id) ? ticked.get(c.id) : !B.isPersonalSpace(c.path);
      return `<label class="gsrc">${B.srcIcon('confluence', 22)}<span class="gt"><span>${esc(name)}</span></span><input type="checkbox" class="gck" data-space="${c.id}" ${on ? 'checked' : ''} aria-label="Include ${esc(name)}"></label>`;
    }).join('')}</div>`;
    $$('[data-space]').forEach((c) => { c.onchange = label; });
    label();
  }
  const stored = () => B.api.get('/admin/containers', { connection_id: p.connection.id }).then((r) => r.items);
  /* Shows what Broth already knows, then asks Confluence, so spaces created after connecting
     appear; if Confluence cannot be reached, the known spaces stay usable. */
  async function load() {
    go.disabled = true;
    $('#sue').textContent = '';
    let containers = p.containers;
    if (containers.length) draw(containers);
    try {
      await B.api.post(`/admin/connections/${p.connection.id}/verify`);
      containers = await stored();
    } catch (error) {
      if (!containers.length) { list.innerHTML = ''; showError(error); return; }
      $('#sue').textContent = `Couldn't check Confluence for new spaces: ${(error && error.detail) || B.problem(error)}`;
    }
    p.containers = containers;
    draw(containers);
  }
  $('#surefresh').onclick = () => load();
  $('#suf').onsubmit = (e) => {
    e.preventDefault();
    const picked = $$('[data-space]:checked').map((c) => c.dataset.space);
    B.busy(go, async () => {
      for (const id of picked) await B.api.patch(`/admin/containers/${id}`, { included: true, owner_user_id: B.S.me.id });
      await show();
    }, showError);
  };
  await load();
}
/** Stops watching the sync step's reads; replaced whenever the step starts watching. */
let unwatch = () => {};
/** One space's read in the sync step: its name and how its run reads (sync.js). */
function readRow(container) {
  const view = SYNC.runView(container.active_run || container.last_run);
  let state = '';
  if (view && view.busy) state = `<span class="suspin" aria-hidden="true"></span><span>${esc(view.label)}</span>`;
  else if (view && view.tag === 'ok') state = `<span class="suok">${ICON('check', 14)}</span><span>${esc(view.label)}</span>`;
  else if (view) state = `<span class="tag ${view.tag || ''}">${esc(view.label)}</span>${view.detail ? `<span class="sumute">${esc(view.detail)}</span>` : ''}`;
  return `<li class="surun"><span class="surun-n">${esc(B.containerName(container.path))}</span><span class="surun-s">${state}</span></li>`;
}
/** The reads together, then a row per space (spec 3.3). */
function readsHtml(containers) {
  const view = SYNC.readsView(reads(containers));
  const head = view ? `<div class="susynch"><span class="suspin" aria-hidden="true"></span><span>${esc(view.label)}</span></div>` : '';
  const bar = view && view.fraction !== null
    ? `<div class="bar" role="progressbar" aria-label="Pages read" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(view.fraction * 100)}" aria-valuetext="${esc(view.label)}"><i style="width:${(view.fraction * 100).toFixed(1)}%"></i></div>`
    : '';
  return `${head}${bar}<ul class="suruns" aria-label="Spaces">${included(containers).map(readRow).join('')}</ul>`;
}
function syncStep(p) {
  render('sync', `<h1>Broth is reading your spaces</h1><p class="sub">You can leave this page; it carries on.</p><div class="susync" id="susync" role="status"></div>${p.connection.last_error ? `<div class="banner bad" id="suerr">${esc(p.connection.last_error)}</div>` : ''}<div class="obnav"><button type="button" class="btn si-btn" id="suback">Continue in the background</button></div>`);
  $('#suback').onclick = () => B.go('/');
  let shown = '';
  const draw = () => {
    const html = readsHtml(p.containers);
    const box = $('#susync');
    if (box && html !== shown) { box.innerHTML = html; shown = html; } // unchanged text is not announced again
  };
  draw();
  unwatch = SYNC.watchRuns({
    runs: reads(p.containers),
    fetch: async () => {
      p.containers = (await B.api.get('/admin/containers', { connection_id: p.connection.id })).items;
      return reads(p.containers);
    },
    onUpdate: (runs) => {
      if (runs.some((r) => r && r.status === 'running')) draw();
      else show();
    },
  });
}
async function doneStep(p) {
  await B.refreshSetupProgress();
  let n = 0;
  try { n = (await B.loadFacets()).systems.reduce((sum, s) => sum + s.count, 0); } catch (e) { /* counts are a nicety */ }
  /* Pages a space read gave up on, and no later run has read since (spec 3.4.1). */
  const failing = reads(p.containers || []).reduce((sum, r) => sum + ((r && r.failing) || 0), 0);
  const note = failing
    ? `<div class="notice low" id="sufailing"><span>${failing} ${failing === 1 ? 'page' : 'pages'} couldn't be read; <a class="link" href="/admin/connectors" id="suconn">see Connectors</a>.</span></div>`
    : '';
  render('done', `<h1>Broth is ready</h1><p class="sub">${n ? `${n} ${n === 1 ? 'page is' : 'pages are'} in the library. ` : ''}Invite the people who should use it; they sign in with Google.</p>${note}<div class="obnav"><button type="button" class="btn si-btn" id="supeople">Invite people</button><button type="button" class="btn primary si-btn" id="suask">Start asking</button></div>`);
  $('#supeople').onclick = () => B.go('/admin/people');
  $('#suask').onclick = () => B.go('/');
  const connectors = $('#suconn');
  if (connectors) connectors.onclick = (e) => { e.preventDefault(); B.go('/admin/connectors'); };
}

async function show(known) {
  unwatch();
  let p = known;
  if (!p) {
    try { p = await progress(); }
    catch (error) {
      render('claim', `<h1>Setup could not load</h1><p class="sub">${esc(B.problem(error))}</p><button type="button" class="btn primary si-btn" id="suretry">Try again</button>`);
      $('#suretry').onclick = () => show();
      return;
    }
  }
  if (B.S.route.surface !== 'setup') return;
  if (B.S.phase === 'setup' && B.S.setup && !B.S.setup.needs_setup) { B.boot(); return; }
  ({ claim: claimStep, google: googleStep, signin: signinStep, confluence: confluenceStep, connect: connectStep, spaces: spacesStep, sync: syncStep, done: doneStep })[p.step](p);
}

window.SURFACES.setup = () => {
  render(B.S.phase === 'setup' ? 'claim' : 'confluence', `<div class="skwrap" role="status"><span class="sr">Loading setup</span><i class="pvsk" style="width:60%;height:22px"></i><i class="pvsk" style="width:90%"></i><i class="pvsk" style="width:70%"></i></div>`);
  show();
};
window.SETUP = { progress, authorize };
})();
