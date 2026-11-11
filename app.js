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
const KEEP = ['brain-theme', 'brain-sbc', 'brain-tour', 'brain-docs-audience'];
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
const srcIcon = (system, px) => window.SRCICON(systemName(system), px);
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
const roles = () => (S.me ? S.me.roles : []);
const hasRole = (...wanted) => wanted.some((r) => roles().includes(r));
const isAdmin = () => hasRole('admin');
const sandbox = () => S.mode === 'sandbox';
const setupPending = () => isAdmin() && sandbox() && S.setupDone === false;

/* ---------- drawer and modal ---------- */
function openDrawer(html, wide) {
  const d = $('#drawer');
  d.innerHTML = html;
  d.classList.toggle('wide', !!wide);
  d.classList.add('on');
  $('#scrim').classList.add('on');
  d.setAttribute('aria-hidden', 'false');
  const close = $('[data-close-drawer]', d);
  if (close) close.onclick = closeDrawer;
}
function closeDrawer() {
  $('#drawer').classList.remove('on', 'wide');
  $('#scrim').classList.remove('on');
}
function openModal(html) {
  const m = $('#modal');
  m.innerHTML = html;
  m.classList.add('on');
  m.setAttribute('aria-hidden', 'false');
  $$('[data-close-modal]', m).forEach((b) => { b.onclick = closeModal; });
}
function closeModal() { $('#modal').classList.remove('on'); }
$('#scrim').onclick = closeDrawer;
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeDrawer(); closeModal(); } });

/* ---------- router ---------- */
const ROUTES = [
  { re: /^\/$/, surface: 'ask' },
  { re: /^\/c\/([0-9a-f-]{36})$/i, surface: 'ask', keys: ['id'] },
  { re: /^\/chats$/, surface: 'chats' },
  { re: /^\/library(?:\/([a-z0-9-]+))?$/, surface: 'library', keys: ['domain'] },
  { re: /^\/governance$/, surface: 'governance' },
  { re: /^\/account(?:\/(sessions))?$/, surface: 'account', keys: ['tab'] },
  { re: /^\/admin(?:\/(connectors|people|domains|audit))?$/, surface: 'admin', keys: ['tab'], allow: () => hasRole('admin', 'compliance') },
  { re: /^\/agent(?:\/([0-9a-f-]{36})(?:\/(overview|knowledge|experience|products))?)?$/i, surface: 'bot', keys: ['bot', 'page'], allow: () => hasRole('admin') },
  { re: /^\/docs(?:\/([a-z0-9-]+))?$/, surface: 'docs', keys: ['slug'] },
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
function route() {
  const path = location.pathname.replace(/\/+$/, '') || '/';
  if (S.phase === 'boot') { renderBoot(); return; }
  if (S.phase === 'error') { renderBootError(); return; }
  // The docs are public, so they open signed out and during setup as well.
  const docs = path === '/docs' || path.startsWith('/docs/');
  if (S.phase === 'setup' && path !== '/setup' && !docs) { go('/setup', { replace: true }); return; }
  if (S.phase === 'signedout' && path !== '/signin' && !docs) { go('/signin', { replace: true }); return; }
  if (S.phase === 'app' && path === '/signin') { go('/', { replace: true }); return; }
  const found = match(path);
  if (!found || (found.allow && !found.allow())) { go('/', { replace: true }); return; }
  if (found.surface === 'setup' && S.phase === 'app' && !(isAdmin() && sandbox())) { go('/', { replace: true }); return; }
  // `from` is the surface shown before this one, so a surface can tell arriving from moving within it.
  S.route = { surface: found.surface, params: found.params, path, from: lastSurface };
  leaveGuard = null;
  shown = here();
  const moved = lastSurface !== null && lastSurface !== found.surface;
  lastSurface = found.surface;
  closeDrawer(); closeModal();
  document.body.dataset.sf = found.surface;
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
  if (S.setup && S.setup.needs_setup) { S.phase = 'setup'; route(); return; }
  try {
    await API.refresh();
    await loadMe();
  } catch (error) {
    if (error.status === 401) { S.phase = 'signedout'; route(); return; }
    S.bootError = error; S.phase = 'error'; route(); return;
  }
  S.phase = 'app';
  if (isAdmin() && sandbox()) await refreshSetupProgress();
  // The sign-in callback lands on "/": an admin with setup unfinished continues it there.
  if (setupPending() && location.pathname === '/') history.replaceState({}, '', '/setup');
  loadFacets();
  loadChats(true);
  route();
}
async function loadMe() {
  S.me = await API.get('/me');
  return S.me;
}
/* Sign-in, the Library and Admin read the facets, sometimes at once: each read settles with the
   one started last, so an earlier answer that lands later never replaces a newer one. */
const readFacets = API.latest(() => API.get('/facets'));
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
  clearServerState();
  S.phase = 'signedout';
  go('/signin', { replace: true });
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
async function deleteChat(id) {
  await API.del(`/conversations/${id}`);
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
      try { await renameChat(conv.id, value); toast('Renamed'); } catch (error) { toast(problem(error)); }
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
  const close = () => { m.remove(); document.removeEventListener('mousedown', out, true); document.removeEventListener('keydown', key, true); };
  const out = (e) => { if (!m.contains(e.target)) close(); };
  const key = (e) => { if (e.key === 'Escape') { e.preventDefault(); close(); if (anchor.focus) anchor.focus(); } };
  document.addEventListener('mousedown', out, true);
  document.addEventListener('keydown', key, true);
  $('button', m).focus();
  m.onclick = async (e) => {
    const b = /** @type {any} */ (e.target).closest('[data-a]');
    if (!b) return;
    const a = b.dataset.a;
    if (a === 'del' && !b.dataset.arm) { b.dataset.arm = '1'; $('span', b).textContent = 'Confirm delete'; return; }
    close();
    try {
      if (a === 'ren') opts.rename();
      else if (a === 'pin') await pinChat(conv.id, !conv.pinned);
      else if (a === 'link') { try { await navigator.clipboard.writeText(location.origin + '/c/' + conv.id); } catch (err) { /* clipboard blocked */ } toast('Link copied'); }
      else if (a === 'del') await deleteChat(conv.id);
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
  h += navItem('data-go="/governance"', 'shield', 'Governance', r.surface === 'governance');
  if (hasRole('admin', 'compliance')) h += navItem('data-go="/admin"', 'settings', 'Admin', r.surface === 'admin');
  h += navItem('data-go="/docs"', 'book', 'Docs', r.surface === 'docs');
  if (setupPending()) h += navItem('data-go="/setup"', 'check', 'Finish setup', r.surface === 'setup', '<span class="sdot" aria-hidden="true"></span>', 'finish');
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
  if (!c.items.length) { rec.innerHTML = '<p class="sempty">Your chats show up here.</p>'; return; }
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
const CRUMB = { ask: ['Workspace', 'New chat'], chats: ['Workspace', 'Chats'], library: ['Workspace', 'Library'], governance: ['Workspace', 'Governance'], docs: ['Workspace', 'Docs'], account: ['Account', ''], admin: ['Admin', ''], setup: ['Admin', 'Finish setup'], bot: ['Workspace', 'Support agent'] };
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
  const names = { library: 'Library', governance: 'Governance', docs: 'Docs', account: 'Account', chats: 'Chats', admin: 'Admin', bot: 'Support agent', setup: 'Finish setup' };
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
window.BRAIN = {
  get S() { return S; },
  api: API, esc, toast, haptic, problem, isAbort, busy, ICON: window.ICON,
  go, route, boot, signOut, loadMe, loadFacets, readFacets, refreshSetupProgress, clearServerState,
  hasRole, isAdmin, sandbox, setupPending,
  openDrawer, closeDrawer, openModal, closeModal,
  loadChats, touchChat, forgetChat, replaceChat, renameChat, pinChat, deleteChat, chatMenu, editTitle, chatTitle, renderSurfaces, renderChatList, newChat,
  systemName, srcIcon, containerName, isPersonalSpace, SYSTEMS, ROLE_NAMES, CLEARANCES, clearanceName,
  fmtDate, fmtTime, ago, dayLabel, when,
  skeletonRows, loadingBlock, errorBlock, emptyBlock, CARET, setCrumb, mbTitle, guardLeaving, askToLeave,
  start() { cleanStorage(); boot(); },
};
})();
