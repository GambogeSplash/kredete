/* source-setup.js: connecting a source (Confluence) from inside the app.
 *
 * These steps used to be part of the setup wizard (setup.js). Sources are now set up in the app,
 * on Admin, Sources (connectors.js), so the wizard stops after the first admin signs in. This file
 * keeps the logic and the small pieces of presentation that were the wizard's, as plain functions
 * on window.SOURCES for the Sources page to call. Nothing here draws a page of its own and nothing
 * here changes an API call; see SOURCES-HANDOFF.md for how to use it.
 *
 * Source state is always derived from the API, never stored in the browser:
 * /admin/credentials, /admin/connections and /admin/containers.
 */
(() => {
'use strict';
const B = window.BRAIN;
const SYNC = window.SYNC;
/** @type {(s: string, r?: ParentNode) => any} */
const $ = (s, r = document) => r.querySelector(s);
/** @type {(s: string, r?: ParentNode) => any[]} */
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => B.esc(s);

const included = (containers) => containers.filter((c) => c.included);
/** Each included space's read: the one running, or else the last one finished. */
const reads = (containers) => included(containers).map((c) => c.active_run || c.last_run);
/** Pages a space read gave up on, and no later run has read since (sync runs spec 3.4.1). */
const failingCount = (containers) => reads(containers || []).reduce((sum, r) => sum + ((r && r.failing) || 0), 0);

/**
 * Where connecting a source stands, from the API (admin only).
 * step: 'confluence' (no OAuth client saved), 'connect' (no authorised site), 'spaces' (none
 * included yet), 'sync' (the first reads are running) or 'done'.
 */
async function progress() {
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
  if (SYNC.firstReadsRunning(containers)) return { step: 'sync', connection, containers };
  return { step: 'done', connection, containers };
}

/** Saves the Atlassian OAuth client (encrypted by the server, never shown again). */
const saveConfluenceCredentials = (client_id, client_secret) =>
  B.api.put('/admin/credentials/confluence_oauth', { client_id, client_secret });

/** The site address as the API wants it, or null when it is not an address. */
function cleanSite(input) {
  const value = String(input || '').trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(value) ? value : null;
}
/** Adds a Confluence site and returns its connection id. Throws a problem-shaped error for a bad address. */
async function createConnection(input) {
  const site = cleanSite(input);
  if (!site) throw { title: 'Enter the site address, like yourteam.atlassian.net' };
  return (await B.api.post('/admin/connections', { system: 'confluence', site })).id;
}

/** Starts the Atlassian authorisation (also the re-authorise path) and leaves for Atlassian. */
async function authorize(connectionId) {
  const started = await B.api.post(`/admin/connections/${connectionId}/oauth/start`);
  location.assign(started.authorization_url);
}

/** The spaces Broth already knows for a connection. */
const listSpaces = (connection) => B.api.get('/admin/containers', { connection_id: connection.id }).then((r) => r.items);
/** Asks Confluence for spaces created since, then returns the stored list. Throws when Confluence cannot be reached. */
async function refreshSpaces(connection) {
  await B.api.post(`/admin/connections/${connection.id}/verify`);
  return listSpaces(connection);
}
/** Includes the chosen spaces, owned by the person doing it; each include starts that space's first read. */
async function includeSpaces(ids) {
  for (const id of ids) await B.api.patch(`/admin/containers/${id}`, { included: true, owner_user_id: B.S.me.id });
}

/** Personal spaces read "Name (personal space)", never the raw key (app.js). New spaces start ticked unless personal. */
const spaceName = (container) => B.containerName(container.path);
const isPersonal = (container) => B.isPersonalSpace(container.path);

/**
 * The space picker as a table with a checkbox per row. Wire it with pickedSpaces().
 * @param {any[]} containers
 * @param {Map<string, boolean>} [ticked] ticks the person already changed, by container id
 */
function spacesTableHtml(containers, ticked) {
  const memory = ticked || new Map();
  return `<div class="ds-table suspaces" role="group" aria-label="Spaces"><div class="ds-tr ds-th susp" aria-hidden="true"><span>Space</span><span id="suptot"></span></div>${containers.map((c) => {
    const name = spaceName(c);
    const personal = isPersonal(c);
    const on = memory.has(c.id) ? memory.get(c.id) : !personal;
    return `<label class="ds-tr susp">${B.srcIcon('confluence', 22)}<span class="gt">${esc(name)}</span>${personal ? '<em class="tag">Personal</em>' : ''}<input type="checkbox" class="gck" data-space="${c.id}" ${on ? 'checked' : ''} aria-label="Include ${esc(name)}"></label>`;
  }).join('')}</div>`;
}
/** The ids ticked in a rendered picker. */
const pickedSpaces = (root = document) => $$('[data-space]:checked', root).map((c) => c.dataset.space);
/** Updates the "N of M" count in the picker's header; returns N. */
function countPicked(root = document) {
  const n = $$('[data-space]:checked', root).length;
  const total = $('#suptot', root);
  if (total) total.textContent = `${n} of ${$$('[data-space]', root).length}`;
  return n;
}

/** One space's read: its name and how its run reads (sync.js), with a small bar while it counts pages. */
function readRow(container) {
  const view = SYNC.runView(container.active_run || container.last_run);
  let state = '', mini = '';
  if (view && view.busy) state = `<span class="suspin" aria-hidden="true"></span><span>${esc(view.label)}</span>`;
  else if (view && view.tag === 'ok') state = `<span class="tag ok suok">${ICON('check', 12)}<span>${esc(view.label)}</span></span>`;
  else if (view) state = `<span class="tag ${view.tag || ''}">${esc(view.label)}</span>${view.detail && view.tag !== 'bad' ? `<span class="sumute">${esc(view.detail)}</span>` : ''}`;
  /* A failed read says why on a line of its own. */
  const why = view && view.tag === 'bad' && view.detail ? `<span class="sumsg">${esc(view.detail)}</span>` : '';
  if (view && view.busy && view.fraction !== null) mini = `<span class="bar sumini" aria-hidden="true"><i data-k="${container.id}" style="width:${(view.fraction * 100).toFixed(1)}%"></i></span>`;
  return `<li class="surun ds-tr"><span class="surun-n">${esc(spaceName(container))}</span>${mini}<span class="surun-s">${state}</span>${why}</li>`;
}
/** The reads together (one line and one bar), then a row per included space (sync runs spec 3.3). */
function readsHtml(containers) {
  const view = SYNC.readsView(reads(containers));
  const top = view ? `<div class="susynch"><span class="suspin" aria-hidden="true"></span><span>${esc(view.label)}</span></div>` : '';
  const bar = view && view.fraction !== null
    ? `<div class="bar" role="progressbar" aria-label="Pages read" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(view.fraction * 100)}" aria-valuetext="${esc(view.label)}"><i data-k="all" style="width:${(view.fraction * 100).toFixed(1)}%"></i></div>`
    : '';
  return `${view ? `<div class="susum">${top}${bar}</div>` : ''}<ul class="suruns ds-table" aria-label="Spaces">${included(containers).map(readRow).join('')}</ul>`;
}
/** Per-space rows alone, for a finished read ("Spaces read"). */
const readTableHtml = (containers) => {
  const spaces = included(containers || []);
  return spaces.length ? `<ul class="suruns ds-table" aria-label="Spaces read">${spaces.map(readRow).join('')}</ul>` : '';
};
/** The "pages couldn't be read" line with its link to Sources, or ''. */
function failingHtml(containers) {
  const n = failingCount(containers);
  return n ? `<div class="notice low" id="sufailing"><span>${n} ${n === 1 ? 'page' : 'pages'} couldn't be read; <a class="link" href="/admin/connectors" id="suconn">see Sources</a>.</span></div>` : '';
}
/**
 * Puts reads markup in a box. Bars start from where they were so they glide on and never replay;
 * the first draw grows from empty. Returns the html so a caller can skip an unchanged one
 * (unchanged text is not announced again).
 */
function paintReads(box, html, shown) {
  if (!box || html === shown) return shown;
  const before = new Map($$('i[data-k]', box).map((i) => [i.dataset.k, i.style.width]));
  box.innerHTML = html;
  $$('i[data-k]', box).forEach((i) => { const to = i.style.width; i.style.width = before.get(i.dataset.k) || '0%'; void i.offsetWidth; i.style.width = to; });
  return html;
}
/** Re-reads the spaces while any is running (sync.js watchRuns). Returns the function that stops it. */
function watchReads(state, onUpdate) {
  return SYNC.watchRuns({
    runs: reads(state.containers),
    fetch: async () => {
      state.containers = await listSpaces(state.connection);
      return reads(state.containers);
    },
    onUpdate,
  });
}

/** The calm empty state for a workspace with no source yet: one title, one button (the caller wires it). */
const emptyHtml = () => `<div class="empty suempty"><h2>Connect your first source</h2><button type="button" class="btn primary si-btn" id="susrc"><span>Connect Confluence</span></button></div>`;

window.SOURCES = {
  progress, saveConfluenceCredentials, cleanSite, createConnection, authorize,
  listSpaces, refreshSpaces, includeSpaces, spaceName, isPersonal,
  spacesTableHtml, pickedSpaces, countPicked,
  readRow, readsHtml, readTableHtml, failingHtml, failingCount, paintReads, watchReads,
  included, reads, emptyHtml,
};
})();
