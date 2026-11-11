/* app.js: the shell. In-memory server state, the router, the boot sequence (sandbox spec 4.2),
 * the sidebar with the chat history, and the helpers every surface uses (window.BRAIN).
 *
 * Browser storage keeps only the theme (brain-theme), the sidebar setting (brain-sbc) and the
 * tour flag (brain-tour). Everything else comes from the API and lives in memory; signing out
 * clears it. Surfaces register in window.SURFACES and render into #app.
 */
(() => {
'use strict';
const API = window.API;
/** @type {(s: string, r?: ParentNode) => any} */
const $ = (s, r = document) => r.querySelector(s);
/** @type {(s: string, r?: ParentNode) => any[]} */
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- storage: only the three keys the spec allows ---------- */
const KEEP = ['brain-theme', 'brain-sbc', 'brain-tour', 'brain-docs-audience', 'brain-libview'];
function cleanStorage() {
  try {
    const stale = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith('brain-') && !KEEP.includes(key)) stale.push(key);
    }
    stale.forEach((key) => localStorage.removeItem(key)); // brain-proto-v2 and its leftovers
  } catch (e) { /* storage unavailable: nothing to clean */ }
}

/* ---------- state ---------- */
const PAGE = 20;
const freshServerState = () => ({
  me: null,             // Me
  facets: null,         // Facets, for counts and filters
  setupDone: null,      // admin only: whether a Confluence connection is serving (null: unknown)
  chats: { items: [], next: null, loaded: false, loading: false, error: null },
  conv: null,           // the open conversation (ask.js)
  ask: null,            // Ask surface state (ask.js)
  lib: null,            // Library state (library.js)
  cache: {},            // per-surface data owned by the surfaces
});
const S = Object.assign({
  phase: 'boot',        // boot | error | setup (before sign-in) | signedout | app
  mode: 'sandbox',      // sandbox | workspace (GET /v1/setup/status answered 404)
  setup: null,          // SetupStatus
  bootError: null,
  route: { surface: 'ask', params: {}, path: '/' },
}, freshServerState());

function clearServerState() {
  Object.assign(S, freshServerState());
}

/* ---------- small helpers ---------- */
function haptic(kind) {
  try {
    if (!matchMedia('(pointer:coarse)').matches) return;
    const pattern = { light: 8, select: 6, medium: 16, heavy: 26, success: [10, 40, 14], warn: [22, 40, 22] }[kind || 'light'];
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch (e) { /* no haptics */ }
}
let toastTimer = 0;
function toast(message) {
  const t = $('#toast');
  t.textContent = message;
  t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('on'), 2600);
}
/** The title to show for an error: API problem titles are written for people. */
const problem = (error) => (error && error.title) || (error && error.message) || 'Something went wrong. Try again.';
const isAbort = (error) => error && error.name === 'AbortError';

const SYSTEMS = { confluence: 'Confluence', gdrive: 'Google Drive', github_docs: 'Docs repositories' };
const systemName = (s) => SYSTEMS[s] || s || '';
const srcIcon = (system, px) => (window.SRCLOGO && window.SRCLOGO.has(system) ? window.SRCLOGO(system, px) : window.SRCICON(systemName(system), px));
/* Confluence names a personal space after its owner, with a key like "~712020cc...". The server
   keeps the key in the stored name (the audit feed matches on it); people see "personal space". */
const PERSONAL_SPACE = /^(.*) \(~[^()]+\)$/;
const isPersonalSpace = (path) => PERSONAL_SPACE.test(path || '');
const containerName = (path) => (path || '').replace(PERSONAL_SPACE, '$1 (personal space)');
const ROLE_NAMES = { admin: 'Admin', compliance: 'Compliance', domain_owner: 'Domain owner', developer: 'Developer' };
const CLEARANCES = [['public', 'Public'], ['internal', 'Internal'], ['confidential', 'Confidential'], ['restricted', 'Restricted']];
const clearanceName = (c) => (CLEARANCES.find((x) => x[0] === c) || [c, c])[1];

const DAY = 864e5;
function fmtDate(iso, withYear) {
  if (!iso) return '';
  const d = new Date(iso);
  const n = new Date();
  return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: withYear || d.getFullYear() !== n.getFullYear() ? 'numeric' : undefined });
}
function fmtTime(iso) { return iso ? new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''; }
function ago(iso) {
  if (!iso) return '';
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return m + ' min ago';
  if (m < 1440) return Math.round(m / 60) + ' h ago';
  if (m < 10080) return Math.round(m / 1440) + ' d ago';
  return fmtDate(iso);
}
/** A rendered date or time, marked up as one so it is machine-readable. */
/** The rows of a list reply. A reply is not trusted to carry them: null, {} and a missing `items` all read as an empty list. */
const rows = (page) => (page && Array.isArray(page.items) ? page.items : []);
/** The cursor of a list reply, or null when there is no next page. */
const cursorOf = (page) => (page && typeof page.next_cursor === 'string' && page.next_cursor) || null;
/** A list field of a record (roles, owners, warnings), read as empty when null or absent. */
const arr = (v) => (Array.isArray(v) ? v : []);
/** A person as the pages read them: `roles` is always a list. */
const person = (u) => ({ ...u, roles: arr(u && u.roles) });
/** A domain as the pages read them: both owner lists are always lists. */
const domain = (d) => ({ ...d, owners: arr(d && d.owners), inherited_owners: arr(d && d.inherited_owners) });
/** A bot as the pages read them: sources, starters and products are always lists, and so are a product's sites. */
const bot = (b) => ({ ...b, sources: arr(b && b.sources), starters: arr(b && b.starters), products: arr(b && b.products).map((p) => ({ ...p, allowed_origins: arr(p && p.allowed_origins) })) });
function when(iso, text) { return iso ? `<time datetime="${esc(iso)}">${esc(text)}</time>` : ''; }
function dayLabel(iso, withTime) {
  const d = new Date(iso), n = new Date();
  const diff = Math.round((new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / DAY);
  const day = diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : diff < 7 ? d.toLocaleDateString([], { weekday: 'long' }) : fmtDate(iso);
  return withTime ? day + ', ' + fmtTime(iso) : day;
}

/* Loading, empty and error states, built from the existing styles. Skeleton rows keep the
   height of the rows they stand in for, so nothing moves when the data arrives. */
function skeletonRows(n, cls) {
  return Array.from({ length: n }, (_, i) => `<div class="${cls || 'actr'} skrow" aria-hidden="true"><i class="pvsk" style="width:${[46, 62, 38, 54, 44][i % 5]}%"></i><i class="pvsk sksub" style="width:${[22, 30, 18, 26, 20][i % 5]}%"></i></div>`).join('');
}
function loadingBlock(label, n, cls) {
  return `<div class="skwrap" role="status" aria-live="polite"><span class="sr">${esc(label || 'Loading')}</span>${skeletonRows(n || 4, cls)}</div>`;
}
function errorBlock(error, retryId) {
  return `<div class="empty errstate" role="alert"><h2>${esc(problem(error))}</h2><p>${error && error.status === 0 ? 'Check your connection.' : 'The rest of Broth still works.'}</p>${retryId ? `<button type="button" class="btn sm" id="${retryId}">Try again</button>` : ''}</div>`;
}
function emptyBlock(title, text, action) {
  return `<div class="empty"><h2>${esc(title)}</h2>${text ? `<p>${text}</p>` : ''}${action || ''}</div>`;
}
/** Disables a button while `task` runs; failures land in `onError` (or a toast). */
async function busy(button, task, onError) {
  if (button) { button.disabled = true; button.classList.add('busy'); button.setAttribute('aria-busy', 'true'); }
  try { return await task(); }
  catch (error) { if (!isAbort(error)) (onError || ((e) => toast(problem(e))))(error); return undefined; }
  finally { if (button && button.isConnected) { button.disabled = false; button.classList.remove('busy'); button.removeAttribute('aria-busy'); } }
}
/* A form's error is about what was entered: it goes as soon as the person changes that. */
document.addEventListener('input', (e) => {
  const scope = /** @type {any} */ (e.target).closest && /** @type {any} */ (e.target).closest('form, .modal, .fgroup');
  const slot = scope && scope.querySelector('.hse[role=alert]');
  if (slot && slot.textContent) slot.textContent = '';
});

/* ---------- roles ---------- */
const roles = () => (S.me ? arr(S.me.roles) : []);
const hasRole = (...wanted) => wanted.some((r) => roles().includes(r));
const isAdmin = () => hasRole('admin');
const sandbox = () => S.mode === 'sandbox';
const setupPending = () => isAdmin() && sandbox() && S.setupDone === false;

/* ---------- drawer and modal ---------- */
function openDrawer(html, wide) {
  const d = $('#drawer');
  d.innerHTML = html;
  d.classList.toggle('wide', !!wide);
  // In the Library a document, and on Sources a space's settings, open as their own shell beside the page (broth-library.css); elsewhere it stays a sheet.
  const shell = !wide && S.route && (S.route.surface === 'library' || (S.route.surface === 'admin' && ['connectors', 'sources'].includes(S.route.params.tab)));
  d.classList.toggle('shell', shell);
  document.body.classList.toggle('dsopen', shell);
  // A drawer opened from inside a dialog (a source's Settings) has to sit above that dialog.
  const over = $('#modal').classList.contains('on');
  d.classList.toggle('over', over);
  $('#scrim').classList.toggle('over', over);
  d.classList.add('on');
  $('#scrim').classList.add('on');
  d.setAttribute('aria-hidden', 'false');
  const close = $('[data-close-drawer]', d);
  if (close) close.onclick = closeDrawer;
}
function closeDrawer() {
  $('#drawer').classList.remove('on', 'wide');
  $('#scrim').classList.remove('on');
  setTimeout(() => { if (!$('#drawer').classList.contains('on')) { $('#drawer').classList.remove('over'); $('#scrim').classList.remove('over'); } }, 320);
  document.body.classList.remove('dsopen');
  // The shell keeps its class while it slides out.
  setTimeout(() => { if (!$('#drawer').classList.contains('on')) $('#drawer').classList.remove('shell'); }, 320);
}
/**
 * Exits. Every overlay leaves the way it came in, played backwards, and is only taken away
 * (or hidden) once that has finished. exitFx(el, to, ms, ease) freezes whatever is still playing
 * on el, animates it to `to` and resolves when it is over. It resolves at once for reduced motion,
 * an element that is not showing, or no WAAPI.
 */
function exitFx(el, to, ms, ease) {
  if (!el || !el.isConnected || !el.animate || calm() || !el.getClientRects().length) return { done: Promise.resolve(), cancel() {} };
  // Start from what is on screen now (an enter may still be playing), then drop what was playing.
  const cs = getComputedStyle(el);
  const from = { opacity: cs.opacity, transform: cs.transform === 'none' ? 'none' : cs.transform };
  el.getAnimations().forEach((a) => a.cancel());
  const a = el.animate([from, to], { duration: ms, easing: ease || 'cubic-bezier(.4,0,1,1)', fill: 'forwards' });
  return { done: a.finished.then(() => {}, () => {}), cancel() { a.cancel(); } };
}
/** Takes `el` out after its exit. Pointer events stop at once so a leaving menu cannot be clicked. */
function leaveFx(el, to, ms, ease) {
  if (!el || el.dataset.leaving) return;
  el.dataset.leaving = '1';
  el.style.pointerEvents = 'none';
  exitFx(el, to, ms, ease).done.then(() => el.remove());
}
let modalExit = null;
function openModal(html) {
  const m = $('#modal');
  const exiting = !!modalExit;
  if (exiting) { modalExit.cancel(); modalExit = null; }
  m.innerHTML = html;
  if (exiting) { m.classList.remove('on'); void m.offsetWidth; }
  m.classList.add('on');
  m.setAttribute('aria-hidden', 'false');
  $$('[data-close-modal]', m).forEach((b) => { b.onclick = closeModal; });
}
/**
 * Closing a modal plays the enter backwards: the card fades and eases down (scale .94, 24 px on a
 * desktop; off the bottom as a sheet on a phone) while the backdrop fades. `on` stays until it is
 * over, so focus returns to the opener after, and a second close or a reopen in the middle neither
 * stacks nor flashes.
 */
function closeModal() {
  const m = $('#modal');
  if (!m.classList.contains('on') || modalExit) return;
  const box = $('.modal', m);
  const hide = () => { m.classList.remove('on'); m.getAnimations().forEach((a) => a.cancel()); if (box) box.getAnimations().forEach((a) => a.cancel()); };
  // A swipe has already carried the sheet off the screen: nothing is left to play.
  if (!box || calm() || box.getBoundingClientRect().top >= innerHeight - 1) { hide(); return; }
  const sheet = getComputedStyle(m).alignItems === 'flex-end';
  const card = exitFx(box, sheet ? { opacity: 1, transform: 'translateY(100%)' } : { opacity: 0, transform: 'translateY(24px) scale(.94)' }, sheet ? 240 : 200);
  const back = exitFx(m, { opacity: 0 }, sheet ? 240 : 200, 'ease-in');
  const mine = { cancel() { card.cancel(); back.cancel(); } };
  modalExit = mine;
  Promise.all([card.done, back.done]).then(() => { if (modalExit !== mine) return; modalExit = null; hide(); });
}
$('#scrim').onclick = closeDrawer;
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeDrawer(); closeModal(); } });

/* ---------- router ---------- */
/** The address follows the label on the page. Old addresses keep working: the router rewrites them in place
 *  (no history entry) and keeps the query string and hash, because the Google, Atlassian and GitHub returns land on them. */
/** @type {[RegExp, string][]} */
const MOVED = [
  [/^\/admin\/connectors(\/.*)?$/, '/admin/sources$1'],
  [/^\/connectors$/, '/sources'],
  [/^\/docs(\/.*)?$/, '/help$1'],
  [/^\/agent(\/.*)?$/, '/support-agent$1'],
  [/^\/inbox$/, '/governance'],
  [/^\/admin\/sharing-requests$/, '/governance'],
  [/^\/account\/inbox$/, '/governance'],
];
/** The new address for an old one, or null. */
function movedTo(path) {
  for (const [re, to] of MOVED) if (re.test(path)) return path.replace(re, to);
  return null;
}
const ROUTES = [
  { re: /^\/$/, surface: 'ask' },
  { re: /^\/c\/([0-9a-f-]{36})$/i, surface: 'ask', keys: ['id'] },
  { re: /^\/chats$/, surface: 'chats' },
  { re: /^\/bookmarks$/, surface: 'bookmarks' },
  { re: /^\/library(?:\/([a-z0-9-]+))?$/, surface: 'library', keys: ['domain'] },
  { re: /^\/sources$/, surface: 'connectors' },
  { re: /^\/governance$/, surface: 'governance' },
  { re: /^\/account(?:\/(sessions))?$/, surface: 'account', keys: ['tab'] },
  { re: /^\/admin(?:\/(workspace|connectors|sources|people|domains|audit)(?:\/(confluence|docs-repositories|google-drive))?)?$/, surface: 'admin', keys: ['tab', 'source'], allow: () => hasRole('admin', 'compliance') },
  { re: /^\/support-agent(?:\/([0-9a-f-]{36})(?:\/(overview|knowledge|experience|products))?)?$/i, surface: 'bot', keys: ['bot', 'page'], allow: () => hasRole('admin') },
  { re: /^\/help(?:\/([a-z0-9-]+))?$/, surface: 'docs', keys: ['slug'] },
  { re: /^\/setup$/, surface: 'setup' },
  { re: /^\/signin$/, surface: 'signin' },
];
function match(path) {
  for (const r of ROUTES) {
    const m = path.match(r.re);
    if (m) {
      const params = {};
      (r.keys || []).forEach((k, i) => { if (m[i + 1]) params[k] = m[i + 1]; });
      return { surface: r.surface, params, allow: r.allow };
    }
  }
  return null;
}
/** Navigates inside the app. `replace` swaps the history entry instead of adding one. A hash
 *  is kept, so a link can open a section of a page (the docs). */
function go(path, opts) {
  const o = opts || {};
  const url = new URL(path, location.origin);
  const target = url.pathname + url.search + url.hash;
  if (target !== here() && !o.force && unsaved()) { askToLeave(() => go(path, { ...o, force: true })); return; }
  if (target !== here()) {
    history[o.replace ? 'replaceState' : 'pushState']({}, '', target);
  }
  route();
}
const here = () => location.pathname + location.search + location.hash;

/* A screen with unsaved changes registers a check (guardLeaving); moving away asks first, and
   closing the tab gets the browser's own warning. The check is dropped on every route. */
/** @type {(() => boolean) | null} */
let leaveGuard = null;
let shown = here();
const unsaved = () => !!leaveGuard && leaveGuard();
function guardLeaving(check) { leaveGuard = check; }
function askToLeave(leave) {
  openModal(`<div class="modal ppmodal" role="alertdialog" aria-modal="true" aria-labelledby="lvt" aria-describedby="lvd"><div class="body"><h2 id="lvt">Leave without saving?</h2><p class="sub" id="lvd">Your changes on this page will be lost.</p><div class="actions"><button type="button" class="btn primary" id="lvstay">Keep editing</button><button type="button" class="btn danger" id="lvgo">Leave</button></div></div></div>`);
  $('#lvstay').onclick = closeModal;
  $('#lvgo').onclick = () => { closeModal(); leaveGuard = null; leave(); };
  $('#lvstay').focus();
}
window.addEventListener('popstate', () => {
  if (unsaved()) {
    const target = here();
    history.pushState({}, '', shown); // stay put until they choose
    askToLeave(() => go(target, { force: true }));
    return;
  }
  route();
});
window.addEventListener('beforeunload', (e) => { if (unsaved()) { e.preventDefault(); e.returnValue = ''; } });
/* Links marked data-link navigate inside the app, wherever a screen, drawer or modal renders
   them; a modified click still opens a new tab. */
document.addEventListener('click', (e) => {
  const a = e.target instanceof Element ? e.target.closest('a[data-link]') : null;
  if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
  e.preventDefault();
  closeDrawer(); closeModal();
  go(a.getAttribute('href'));
});

let lastSurface = null;
/**
 * Page out. The router renders the next page in place, so what was on screen is copied first and
 * laid over the same spot; it eases out (140 ms, ease-in) while the new page eases in beneath it
 * (motion.js). Only the page area is copied: the rail, sidebar and top bar are never touched.
 * A copy of a page that is itself still easing in starts from how visible it was.
 */
let routeKey = null;
function pageGhost(key) {
  const first = routeKey === null;
  const same = routeKey === key;
  routeKey = key;
  const app = $('#app');
  if (first || same || S.phase !== 'app' || calm() || /** @type {any} */ (window).__entering || !app || !app.firstElementChild || !app.animate) return;
  if (document.body.classList.contains('noauth') || !app.getClientRects().length) return;
  const r = app.getBoundingClientRect();
  const g = document.createElement('div');
  g.setAttribute('aria-hidden', 'true');
  g.setAttribute('data-pgout', '1');
  g.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;overflow:hidden;pointer-events:none;z-index:10`;
  const copy = /** @type {HTMLElement} */ (app.cloneNode(true));
  copy.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
  copy.querySelectorAll('[autofocus],a,button,input,textarea').forEach((el) => el.setAttribute('tabindex', '-1'));
  copy.style.cssText = `position:absolute;left:0;top:0;width:${r.width}px;height:${r.height}px;overflow:hidden`;
  g.appendChild(copy);
  document.body.appendChild(g);
  copy.scrollTop = app.scrollTop;
  const from = Math.min(1, +getComputedStyle(app).opacity || 1);
  const gone = () => g.remove();
  g.animate([{ opacity: from }, { opacity: 0 }], { duration: 140, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' }).finished.then(gone, gone);
}
function route() {
  let path = location.pathname.replace(/\/+$/, '') || '/';
  const newPath = movedTo(path);
  if (newPath) { history.replaceState(history.state, '', newPath + location.search + location.hash); path = newPath; }
  if (S.phase === 'boot') { renderBoot(); return; }
  if (S.phase === 'error') { renderBootError(); return; }
  // The docs are public, so they open signed out and during setup as well.
  const docs = path === '/help' || path.startsWith('/help/');
  // The setup wizard is never offered: it opens only from its own address. Leaving it lands on sign-in.
  if (S.phase === 'setup' && path !== '/setup' && !docs) { S.phase = 'signedout'; go('/signin', { replace: true }); return; }
  if (S.phase === 'signedout' && path === '/setup') {
    if (S.setup && S.setup.needs_setup) S.phase = 'setup';
    else { S.route = { surface: 'setup', params: {}, path, from: null }; window.AUTH.alreadySetup(); return; }
  }
  if (S.phase === 'signedout' && path !== '/signin' && !docs) { go('/signin', { replace: true }); return; }
  if (S.phase === 'app' && path === '/signin') { go('/', { replace: true }); return; }
  // The Inbox is gone: Governance holds what needs a person. Old links land there.
  if (/^\/(?:account\/)?inbox$/.test(path)) { go('/governance', { replace: true }); return; }
  const found = match(path);
  if (!found || (found.allow && !found.allow())) { go('/', { replace: true }); return; }
  if (found.surface === 'setup' && S.phase === 'app' && !(isAdmin() && sandbox())) { go('/', { replace: true }); return; }
  pageGhost(found.surface + '|' + path);
  // `from` is the surface shown before this one, so a surface can tell arriving from moving within it.
  S.route = { surface: found.surface, params: found.params, path, from: lastSurface };
  leaveGuard = null;
  shown = here();
  const moved = lastSurface !== null && lastSurface !== found.surface;
  lastSurface = found.surface;
  closeDrawer(); closeModal();
  document.body.dataset.sf = found.surface;
  document.body.dataset.home = found.surface === 'ask' && !found.params.id ? '1' : '';
  const chrome = S.phase === 'app' && found.surface !== 'setup' && found.surface !== 'signin';
  document.body.classList.toggle('noauth', !chrome);
  if (chrome) {
    if (window.AUTH && window.AUTH.needsWelcome()) { window.AUTH.welcome(); return; }
    renderSurfaces();
    window.AUTH && window.AUTH.mountAccount();
  }
  const render = window.SURFACES[found.surface];
  document.title = 'Broth'; // the docs name their article; every other screen keeps this
  $('#app').className = '';
  if (render) render(found.params);
  setCrumb();
  mbTitle();
  document.body.classList.remove('navopen');
  if (moved && !document.querySelector('#modal.on,#drawer.on,#cmdk.on')) {
    const a = document.activeElement, m = $('#app');
    if (m && (!a || a === document.body || !document.contains(a) || (!m.contains(a) && !a.closest('.top')))) {
      m.setAttribute('tabindex', '-1');
      m.focus({ preventScroll: true });
    }
  }
}

/* ---------- boot (spec 4.2) ---------- */
function renderBoot() {
  document.body.classList.add('noauth');
  $('#app').className = 'siapp';
  $('#app').innerHTML = `<div class="bootsplash" role="status"><span class="pvk big" aria-hidden="true">K</span><span class="sr">Loading Broth</span></div>`;
}
function renderBootError() {
  window.AUTH.bootError(S.bootError, boot);
}
async function boot() {
  S.phase = 'boot';
  renderBoot();
  try {
    S.setup = await API.get('/setup/status', undefined, { auth: false });
    S.mode = 'sandbox';
  } catch (error) {
    if (error.status === 404) { S.setup = null; S.mode = 'workspace'; }
    else { S.bootError = error; S.phase = 'error'; route(); return; }
  }
  // A workspace that is not set up shows the sign-in with a calm line; the wizard opens only from /setup.
  if (S.setup && S.setup.needs_setup && location.pathname === '/setup') { S.phase = 'setup'; route(); return; }
  try {
    await API.refresh();
    await loadMe();
  } catch (error) {
    if (error.status === 401) { S.phase = 'signedout'; route(); return; }
    S.bootError = error; S.phase = 'error'; route(); return;
  }
  S.phase = 'app';
  if (isAdmin() && sandbox()) await refreshSetupProgress();
  loadFacets();
  loadChats(true);
  if (window.GOVBADGE) window.GOVBADGE.refresh();
  route();
  if (window.AUTH && window.AUTH.rise) window.AUTH.rise();
}
async function loadMe() {
  S.me = await API.get('/me');
  return S.me;
}
/* Sign-in, the Library and Admin read the facets, sometimes at once: each read settles with the
   one started last, so an earlier answer that lands later never replaces a newer one. */
/** The facets with every list present: a reply with null or missing lists reads as empty ones. */
const facetsOf = (f) => ({ ...(f && typeof f === 'object' ? f : {}), authorities: arr(f && f.authorities), domains: arr(f && f.domains), scopes: arr(f && f.scopes), systems: arr(f && f.systems) });
const readFacets = API.latest(async () => facetsOf(await API.get('/facets')));
async function loadFacets() {
  try { S.facets = await readFacets(); } catch (e) { S.facets = null; }
  if (window.ASK) window.ASK.refreshFeed();
  return S.facets;
}

/** Admin, sandbox: whether a Confluence connection is serving (spec 4.1 "Finish setup"). */
async function refreshSetupProgress() {
  if (!isAdmin() || !sandbox()) { S.setupDone = null; return null; }
  const before = S.setupDone;
  try {
    const progress = await window.SETUP.progress();
    S.setupDone = progress.step === 'done';
  } catch (e) { S.setupDone = null; }
  // Surfaces that show "Finish setup" outside the sidebar listen for this.
  if (S.setupDone !== before) document.dispatchEvent(new CustomEvent('brain:setupchange'));
  return S.setupDone;
}

async function signOut() {
  await API.logout();
  const out = () => { clearServerState(); S.phase = 'signedout'; go('/signin', { replace: true }); };
  if (window.AUTH && window.AUTH.leave) window.AUTH.leave(out); else out();
}
API.onSignedOut(() => {
  if (S.phase !== 'app') return;
  clearServerState();
  S.phase = 'signedout';
  toast('Your session ended. Sign in again.');
  go('/signin', { replace: true });
});

/* ---------- chat history (sidebar, chats page, palette) ---------- */
async function loadChats(reset) {
  const c = S.chats;
  if (c.loading || (!reset && c.loaded && !c.next)) return;
  c.loading = true;
  c.error = null;
  if (reset) renderChatList();
  try {
    const page = await API.get('/conversations', { limit: PAGE, cursor: reset ? null : c.next });
    c.items = reset ? page.items : c.items.concat(page.items.filter((x) => !c.items.some((y) => y.id === x.id))).sort(byActivity);
    c.next = page.next_cursor || null;
    c.loaded = true;
  } catch (error) {
    c.error = error;
  } finally {
    c.loading = false;
  }
  renderChatList();
  if (window.ASK) window.ASK.refreshRecent();
  if (S.route.surface === 'chats' && window.SURFACES.chats) window.SURFACES.chats.refresh();
}
/** The order of GET /v1/conversations: pinned first, then the latest activity, then id. */
function byActivity(a, b) {
  return Number(b.pinned) - Number(a.pinned) || Date.parse(b.updated_at) - Date.parse(a.updated_at) || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);
}
/** The chat list changed: keep the API's order, so a reload shows the same list, and redraw it. */
function chatsChanged() {
  S.chats.items.sort(byActivity);
  renderChatList();
  if (S.route.surface === 'chats' && window.SURFACES.chats) window.SURFACES.chats.refresh();
}
/** Inserts a conversation or updates it after activity. */
function touchChat(conv) {
  S.chats.items = [conv, ...S.chats.items.filter((x) => x.id !== conv.id)];
  chatsChanged();
}
function forgetChat(id) {
  S.chats.items = S.chats.items.filter((x) => x.id !== id);
  chatsChanged();
}
const chatTitle = (c) => (c && c.title) || 'Untitled chat';

/* Rename, subtly: the new title fades in and a thin brand line draws under it once, like a pen stroke. */
function renamedFx(title) {
  toast('Renamed');
  if (calm()) return;
  const t = String(title).trim().slice(0, 30);
  requestAnimationFrame(() => {
    const hits = [...document.querySelectorAll('.dtitle,#cxtitle,#surfaces .surf.chat,.chr .actt b')].filter((e) => e.textContent.trim().startsWith(t));
    hits.forEach((e) => {
      const txt = e.matches('.surf.chat') ? (e.querySelector('.chn') || e.querySelector('span') || e) : e;
      if (!txt.animate) return;
      txt.animate([{ opacity: 0.25 }, { opacity: 1 }], { duration: 320, easing: 'ease-out' });
      if (getComputedStyle(txt).position === 'static') /** @type {HTMLElement} */ (txt).style.position = 'relative';
      const ln = document.createElement('i');
      ln.setAttribute('aria-hidden', 'true');
      ln.style.cssText = 'position:absolute;left:0;right:0;bottom:-2px;height:1.5px;border-radius:1px;background:var(--brand,#5e6ad2);transform-origin:left center;pointer-events:none';
      txt.appendChild(ln);
      const gone = () => ln.remove();
      ln.animate([{ transform: 'scaleX(0)', opacity: 0.9 }, { transform: 'scaleX(1)', opacity: 0.9 }], { duration: 340, easing: 'cubic-bezier(.3,.7,.2,1)', fill: 'forwards' }).finished
        .then(() => ln.animate([{ opacity: 0.9 }, { opacity: 0 }], { duration: 360, easing: 'ease-out', fill: 'forwards' }).finished)
        .then(gone, gone);
    });
  });
}
async function renameChat(id, title) {
  const updated = await API.patch(`/conversations/${id}`, { title });
  replaceChat(updated);
  return updated;
}
async function pinChat(id, pinned) {
  const updated = await API.patch(`/conversations/${id}`, { pinned });
  replaceChat(updated);
  toast(pinned ? 'Pinned' : 'Unpinned');
  return updated;
}
/**
 * The delete animation from the prototype: the row sinks into a trash can that pops up, the can
 * wobbles, the row collapses, the can leaves. Returns { done, abort }; done resolves when it has
 * played out (immediately for no row or reduced motion), abort puts the row back untouched.
 */
function trashFx(rowEl) {
  if (!rowEl || !rowEl.animate || calm()) return { done: Promise.resolve(), abort() {} };
  rowEl.style.pointerEvents = 'none';
  const r = rowEl.getBoundingClientRect();
  const h = r.height;
  const prevOverflow = rowEl.style.overflow;
  rowEl.style.overflow = 'hidden';
  const can = document.createElement('div');
  can.className = 'trashfx';
  can.setAttribute('aria-hidden', 'true');
  can.innerHTML = ICON('trash', 22);
  can.style.left = (r.left + Math.min(r.width / 2, 60) - 18) + 'px';
  can.style.top = (r.top + h / 2 - 18) + 'px';
  document.body.appendChild(can);
  const anims = [];
  const run = (el, kf, o) => { const a = el.animate(kf, o); anims.push(a); return a; };
  run(can, [{ opacity: 0, transform: 'scale(.4) translateY(6px)' }, { opacity: 1, transform: 'scale(1) translateY(0)' }], { duration: 180, easing: 'cubic-bezier(.34,1.56,.64,1)', fill: 'forwards' });
  const sink = run(rowEl, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(' + (Math.min(r.width / 2, 60) - r.width / 2) + 'px) scale(.35)' }], { duration: 320, delay: 80, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
  let aborted = false;
  const done = sink.finished
    .then(() => {
      if (aborted) return null;
      run(can, [{ transform: 'rotate(0)' }, { transform: 'rotate(-12deg)' }, { transform: 'rotate(8deg)' }, { transform: 'rotate(0)' }], { duration: 220 });
      return run(rowEl, [{ height: h + 'px', opacity: 0 }, { height: '0px', opacity: 0, paddingTop: '0px', paddingBottom: '0px', marginTop: '0px', marginBottom: '0px' }], { duration: 200, easing: 'ease-out', fill: 'forwards' }).finished;
    })
    .then(() => (aborted ? null : run(can, [{ opacity: 1 }, { opacity: 0, transform: 'scale(.8)' }], { duration: 160, fill: 'forwards' }).finished))
    .then(() => { can.remove(); }, () => { can.remove(); });
  const abort = () => {
    aborted = true;
    anims.forEach((a) => { try { a.cancel(); } catch (e) { /* already finished */ } });
    can.remove();
    rowEl.style.pointerEvents = '';
    rowEl.style.overflow = prevOverflow;
  };
  return { done, abort };
}
async function deleteChat(id, rowEl) {
  const fx = trashFx(rowEl);
  try { await API.del(`/conversations/${id}`); } catch (error) { fx.abort(); throw error; }
  await fx.done;
  forgetChat(id);
  toast('Chat deleted');
  if (S.conv && S.conv.id === id) { S.conv = null; go('/', { replace: true }); }
}
function replaceChat(updated) {
  const i = S.chats.items.findIndex((x) => x.id === updated.id);
  if (i >= 0) S.chats.items[i] = updated;
  if (S.conv && S.conv.id === updated.id) Object.assign(S.conv, { title: updated.title, pinned: updated.pinned });
  chatsChanged();
}

/** Inline rename of a title element; `onDone` runs after saving or cancelling. */
function editTitle(el, conv, onDone) {
  const input = document.createElement('input');
  input.className = 'ttin';
  input.value = chatTitle(conv);
  input.maxLength = 200;
  input.setAttribute('aria-label', 'Chat title');
  const fit = el.classList && el.classList.contains('dtitle');
  el.replaceWith(input);
  if (fit) {
    const meter = document.createElement('span');
    meter.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;font:500 14px var(--font)';
    document.body.appendChild(meter);
    const size = () => { meter.textContent = input.value || ' '; input.style.width = Math.min(560, Math.max(48, Math.ceil(meter.getBoundingClientRect().width) + 22)) + 'px'; };
    size();
    input.addEventListener('input', size);
    input.addEventListener('blur', () => meter.remove());
    input.classList.add('ttfit');
  }
  input.focus();
  input.select();
  let finished = false;
  const end = async (save) => {
    if (finished) return;
    finished = true;
    const value = input.value.trim();
    if (save && value && value !== chatTitle(conv)) {
      try { await renameChat(conv.id, value); renamedFx(value); } catch (error) { toast(problem(error)); }
    }
    onDone();
  };
  input.onkeydown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); end(true); }
    else if (e.key === 'Escape') { e.preventDefault(); end(false); }
    e.stopPropagation();
  };
  input.onblur = () => end(true);
  input.onclick = (e) => e.stopPropagation();
}

/** The chat actions menu: rename, pin, copy link, delete (with a confirming second press). */
function chatMenu(anchor, conv, opts) {
  document.querySelectorAll('.cmenu').forEach((m) => m.remove());
  const m = document.createElement('div');
  m.className = 'cmenu';
  m.setAttribute('role', 'menu');
  m.innerHTML = `<button role="menuitem" data-a="ren">${ICON('compose', 15)}<span>Rename</span></button><button role="menuitem" data-a="pin">${ICON('pin', 15)}<span>${conv.pinned ? 'Unpin' : 'Pin to top'}</span></button><button role="menuitem" data-a="link">${ICON('link', 15)}<span>Copy link</span></button><div class="cm-sep"></div><button role="menuitem" class="cm-del" data-a="del">${ICON('x', 15)}<span>Delete chat</span></button>`;
  document.body.appendChild(m);
  const r = anchor.getBoundingClientRect();
  const w = m.offsetWidth;
  m.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.right - w)) + 'px';
  const below = r.bottom + m.offsetHeight + 10 < innerHeight;
  m.style.top = (below ? r.bottom + 6 : r.top - m.offsetHeight - 6) + 'px';
  if (m.animate && !calm()) m.animate([{ opacity: 0, transform: 'translateY(' + (below ? -4 : 4) + 'px) scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 150, easing: 'cubic-bezier(.2,.8,.2,1)' });
  const close = () => { leaveFx(m, { opacity: 0, transform: 'translateY(' + (below ? -4 : 4) + 'px) scale(.97)' }, 110); document.removeEventListener('mousedown', out, true); document.removeEventListener('keydown', key, true); };
  const out = (e) => { if (!m.contains(e.target)) close(); };
  const key = (e) => { if (e.key === 'Escape') { e.preventDefault(); close(); if (anchor.focus) anchor.focus(); } };
  document.addEventListener('mousedown', out, true);
  document.addEventListener('keydown', key, true);
  $('button', m).focus();
  m.onclick = async (e) => {
    const b = /** @type {any} */ (e.target).closest('[data-a]');
    if (!b) return;
    const a = b.dataset.a;
    if (a === 'del') { if (armPress(b, 'Confirm delete', () => { /* falls through below */ })) return; }
    close();
    const rowEl = anchor.closest('.surf,.chr,.lrow');
    try {
      if (a === 'ren') opts.rename();
      else if (a === 'pin') await pinChat(conv.id, !conv.pinned);
      else if (a === 'link') { try { await navigator.clipboard.writeText(location.origin + '/c/' + conv.id); } catch (err) { /* clipboard blocked */ } toast('Link copied'); }
      else if (a === 'del') await deleteChat(conv.id, rowEl);
    } catch (error) { toast(problem(error)); }
  };
}

/* ---------- sidebar ---------- */
const CARET = '<svg class="car" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 3.75L5 6.25l2.5-2.5"/></svg>';
function navItem(attr, icon, label, current, extra, cls) {
  return `<button type="button" class="surf ${cls || ''}" ${attr} aria-current="${current ? 'page' : 'false'}">${ICON(icon, 16)}<span>${label}</span>${extra || ''}</button>`;
}
function renderSurfaces() {
  const r = S.route;
  const atHome = r.surface === 'ask' && !r.params.id;
  let h = navItem('data-home="1"', 'compose', 'New chat', atHome, '', 'newchat-nav');
  h += navItem('data-search="1"', 'search', 'Search', false, '<kbd class="skbd">⌘K</kbd>');
  h += navItem('data-go="/library"', 'library', 'Library', r.surface === 'library');
  h += navItem('data-go="/bookmarks"', 'bookmark', 'Bookmarks', r.surface === 'bookmarks');
  const gw = window.GOVBADGE ? window.GOVBADGE.count() : 0;
  h += navItem(`data-go="/governance"${gw ? ` data-badge="${gw > 9 ? '9+' : gw}" data-waiting="${gw}"` : ''}`, 'shield', 'Governance', r.surface === 'governance', gw ? `<span class="lbadge">${gw > 9 ? '9+' : gw}</span>` : '');
  h += navItem('data-go="/help"', 'book', 'Help center', r.surface === 'docs');
  $('#surfaces').innerHTML = `<div class="snav">${h}</div><div class="srec" id="srec" role="list" aria-label="Chats"></div>`;
  // The chats shell belongs to the chat pages; the icon rail (rail.js) stands in for the places list.
  document.body.classList.toggle('nochats', r.surface !== 'ask' && r.surface !== 'chats');
  $$('#surfaces [data-go]').forEach((b) => { b.onclick = () => { go(b.dataset.go); window.scrollTo(0, 0); }; });
  $$('#surfaces [data-home]').forEach((b) => { b.onclick = newChat; });
  $$('#surfaces [data-search]').forEach((b) => { b.onclick = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true })); });
  renderChatList();
  const rec = $('#srec');
  if (window.BROTH_RAIL) window.BROTH_RAIL();
  rec.onscroll = () => { if (rec.scrollTop + rec.clientHeight > rec.scrollHeight - 120) loadChats(false); };
}
function chatGroup(c) {
  if (c.pinned) return 'Pinned';
  const now = new Date();
  const sod = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const t = new Date(c.updated_at).getTime();
  if (t >= sod) return 'Today';
  if (t >= sod - DAY) return 'Yesterday';
  if (t >= sod - 6 * DAY) return 'Previous 7 days';
  return 'Earlier';
}
const GROUPS = ['Pinned', 'Today', 'Yesterday', 'Previous 7 days', 'Earlier'];
function renderChatList() {
  const rec = $('#srec');
  if (!rec) return;
  const c = S.chats;
  const current = S.route.surface === 'ask' ? S.route.params.id : null;
  const top = rec.scrollTop; // the API lists pinned chats first, so pages only add below
  if (!c.loaded && c.loading) { rec.innerHTML = skeletonRows(6, 'surf chat skchat'); return; }
  if (c.error && !c.items.length) {
    rec.innerHTML = `<div class="sempty">${esc(problem(c.error))} <button type="button" class="link" id="chretry">Try again</button></div>`;
    $('#chretry').onclick = () => loadChats(true);
    return;
  }
  if (!c.items.length) { rec.innerHTML = '<div class="ds-empty sm"><p>Your chats show up here.</p></div>'; return; }
  const by = {};
  c.items.forEach((x) => { (by[chatGroup(x)] = by[chatGroup(x)] || []).push(x); });
  const row = (x) => `<button type="button" class="surf chat" data-chat="${x.id}" data-pinned="${x.pinned ? 1 : 0}" title="${esc(chatTitle(x))}" aria-current="${current === x.id ? 'page' : 'false'}"><span class="chn">${esc(chatTitle(x))}</span><span class="chedit" data-ren="${x.id}" role="button" tabindex="0" aria-label="Chat actions" aria-haspopup="menu">${ICON('more', 16)}</span></button>`;
  let h = GROUPS.filter((g) => by[g]).map((g) => `<div class="sgl">${g}</div>${by[g].map(row).join('')}`).join('');
  if (c.loading) h += skeletonRows(2, 'surf chat skchat');
  else if (c.error) h += `<div class="sempty">${esc(problem(c.error))} <button type="button" class="link" id="chmore">Try again</button></div>`;
  rec.innerHTML = h;
  rec.scrollTop = top;
  const more = $('#chmore');
  if (more) more.onclick = () => loadChats(false);
  $$('[data-chat]', rec).forEach((b) => {
    b.onclick = (e) => { if (e.target.closest('.ttin,.chedit') || b.dataset.editing) return; go('/c/' + b.dataset.chat); };
  });
  $$('[data-ren]', rec).forEach((p) => {
    const open = (e) => {
      e.stopPropagation(); e.preventDefault();
      const conv = c.items.find((x) => x.id === p.dataset.ren);
      const row = p.closest('.surf');
      chatMenu(p, conv, { rename: () => { row.dataset.editing = '1'; editTitle($('.chn', row), conv, () => renderChatList()); } });
    };
    p.onclick = open;
    p.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') open(e); };
  });
}
function newChat() {
  if (window.ASK) window.ASK.stop();
  S.conv = null;
  go('/');
}

/* ---------- breadcrumb and mobile title ---------- */
const CRUMB = { ask: ['Workspace', 'New chat'], chats: ['Workspace', 'Chats'], bookmarks: ['Workspace', 'Bookmarks'], library: ['Workspace', 'Library'], connectors: ['Workspace', 'Sources'], governance: ['Workspace', 'Governance'], docs: ['Workspace', 'Help center'], account: ['Account', ''], admin: ['Admin', ''], setup: ['Admin', 'Finish setup'], bot: ['Workspace', 'Support agent'] };
function setCrumb() {
  const c = CRUMB[S.route.surface] || ['Workspace', ''];
  const label = S.route.surface === 'ask' && S.conv && S.route.params.id ? chatTitle(S.conv) : c[1];
  // A bot's pages add its name (bot admin spec 4.1), once the Support agent has loaded it.
  const parts = S.route.surface === 'bot' && S.route.title ? [c[0], label, S.route.title] : [c[0], label];
  $('#crumb').innerHTML = `${parts.slice(0, -1).map((p) => `<span>${esc(p)}</span><i>›</i>`).join('')}<span class="cur">${esc(parts[parts.length - 1])}</span><span class="lsp"></span><button type="button" class="lib" id="ccopy" aria-label="Copy link">${ICON('link', 16)}</button>`;
  $('#ccopy').onclick = async () => { try { await navigator.clipboard.writeText(location.href); } catch (e) { /* blocked */ } toast('Link copied'); };
}
/** The phone top bar's title: what the surface names this screen (S.route.title, such as a
 *  Library folder), else the surface's own name. */
function mbTitle() {
  const t = $('#mbtitle');
  if (!t) return;
  const names = { library: 'Library', connectors: 'Sources', governance: 'Governance', docs: 'Help center', account: 'Account', chats: 'Chats', bookmarks: 'Bookmarks', admin: 'Admin', bot: 'Support agent', setup: 'Finish setup' };
  t.textContent = S.route.title || names[S.route.surface] || (S.route.params.id && S.conv ? chatTitle(S.conv) : 'New chat');
}

/* ---------- sidebar collapse and the phone menu ---------- */
{
  const setSidebar = (collapsed) => {
    document.body.classList.toggle('sbc', collapsed);
    try { localStorage.setItem('brain-sbc', collapsed ? '1' : '0'); } catch (e) { /* storage unavailable */ }
    const t = $('#sbtog');
    if (t) { t.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar'); t.title = collapsed ? 'Expand sidebar' : 'Collapse sidebar'; }
    const o = $('#sbopen');
    if (o && collapsed && o.animate) o.animate([{ opacity: 0, transform: 'scale(.7)' }, { opacity: 1, transform: 'none' }], { duration: 240, delay: 140, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
  };
  try { if (localStorage.getItem('brain-sbc') === '1') document.body.classList.add('sbc'); } catch (e) { /* storage unavailable */ }
  $('#sbtog').onclick = () => setSidebar(true);
  $('#sbcol').onclick = () => setSidebar(true);
  $('#sbopen').onclick = () => setSidebar(false);
  document.addEventListener('keydown', (e) => { if ((e.metaKey || e.ctrlKey) && e.key === '\\') { e.preventDefault(); setSidebar(!document.body.classList.contains('sbc')); } });
  const nav = (open) => { document.body.classList.toggle('navopen', open); const m = $('#mbmenu'); if (m) m.setAttribute('aria-expanded', String(open)); };
  $('#mbmenu').onclick = () => nav(!document.body.classList.contains('navopen'));
  $('#navscrim').onclick = () => nav(false);
  $('#mbclose').onclick = () => nav(false);
  $('#mbnew').onclick = () => { nav(false); newChat(); };
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') nav(false); });
  $('#navtog').onclick = () => { const o = document.body.classList.toggle('navopen'); $('#navtog').setAttribute('aria-expanded', String(o)); };
}

window.SURFACES = window.SURFACES || {};
/** Two presses for anything that cannot be undone (Delete chat, Sign out): the first arms the control, the label swaps
 *  to `confirmText` and it turns danger-styled; the second runs `run`. It disarms after 2.6 s or when focus leaves.
 *  Returns true when this press only armed it. Works for a button with a label span or a plain button. */
function armPress(btn, confirmText, run, ms = 2600) {
  const label = btn.querySelector('span') || btn;
  if (btn.dataset.arm) {
    disarm(btn);
    run();
    return false;
  }
  btn.dataset.arm = '1';
  btn._armWas = label.textContent;
  label.textContent = confirmText;
  btn.classList.add('danger');
  const live = document.getElementById('live');
  if (live) live.textContent = confirmText;
  const off = () => disarm(btn);
  btn._armTimer = setTimeout(off, ms);
  btn.addEventListener('focusout', off, { once: true });
  return true;
}
function disarm(btn) {
  if (!btn.dataset.arm) return;
  clearTimeout(btn._armTimer);
  delete btn.dataset.arm;
  const label = btn.querySelector('span') || btn;
  if (btn._armWas != null) label.textContent = btn._armWas;
  if (!btn.matches('.pm-i.danger, .btn.danger-fixed')) btn.classList.remove('danger');
}

window.BRAIN = {
  get S() { return S; },
  api: API, esc, toast, haptic, problem, isAbort, busy, ICON: window.ICON,
  go, route, boot, signOut, armPress, loadMe, loadFacets, readFacets, refreshSetupProgress, clearServerState,
  hasRole, isAdmin, sandbox, setupPending,
  openDrawer, closeDrawer, openModal, closeModal, exitFx, leaveFx,
  loadChats, touchChat, forgetChat, replaceChat, renameChat, pinChat, deleteChat, chatMenu, trashFx, editTitle, chatTitle, renderSurfaces, renderChatList, newChat,
  systemName, srcIcon, containerName, isPersonalSpace, SYSTEMS, ROLE_NAMES, CLEARANCES, clearanceName,
  fmtDate, fmtTime, ago, dayLabel, when, rows, cursorOf, arr, person, domain, bot,
  skeletonRows, loadingBlock, errorBlock, emptyBlock, CARET, setCrumb, mbTitle, guardLeaving, askToLeave,
  start() { cleanStorage(); boot(); },
};
})();
