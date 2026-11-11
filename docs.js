/* docs.js: the product user docs at /docs (user docs spec 4).
 *
 * GET /v1/docs lists the articles and GET /v1/docs/{slug} returns one, rendered by the
 * server; both are public, so the docs open signed out and during setup too. Signed in they
 * sit inside the app; otherwise they stand alone with a way back to sign-in or setup.
 * The server's HTML holds only markup it produced (no raw HTML is accepted in articles), so
 * it is inserted as it is. Links between articles stay in the app; a hash opens a section,
 * and an unknown one opens the article at the top.
 *
 * DOCS names every section a screen links to; docsLink renders one. Each target is listed in the service's
 * user-docs/anchors.txt, which the API refuses to start without, and the browser suite opens
 * every one against the real articles.
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

const DOCS = {
  labelProblems: 'labelling-pages#label-problems',
  restrictedPages: 'labelling-pages#restricted-pages',
  indexerAccount: 'setting-up-spaces#indexer-account',
  indexerGroup: 'setting-up-spaces#indexer-group',
  spaceSettings: 'setting-up-spaces#space-settings',
  domains: 'setting-up-spaces#domains',
  indexerGroupMissing: 'setting-up-spaces#warn-indexer-group-missing',
  indexerGroupMembers: 'setting-up-spaces#warn-indexer-group-members',
  findLabelProblems: 'fixing-label-problems#find-pages',
};
const AUDIENCES = [['', 'All'], ['askers', 'Asking'], ['authors', 'Writing pages'], ['admins', 'Admin'], ['compliance', 'Compliance']];
const AUDIENCE_NAME = Object.fromEntries(AUDIENCES.filter(([k]) => k));
const FILTER_KEY = 'brain-docs-audience';
const OFFSET = 96; // a heading this close to the top counts as the section being read

function state() {
  const c = B.S.cache;
  if (!c.docs) c.docs = { index: null, articles: {}, loading: false, error: null };
  return c.docs;
}
/** The docs need no session: requests never wait for, or trigger, a token refresh. */
const get = (path) => B.api.get(path, undefined, { auth: false });
const standalone = () => B.S.phase !== 'app';

/** A small "How this works" link to a section; `newTab` keeps a wizard's progress. */
function docsLink(name, text, newTab) {
  const target = DOCS[name];
  const attrs = newTab ? 'target="_blank" rel="noopener"' : 'data-docs-link';
  return `<a class="dclink" href="/docs/${target}" ${attrs}>${ICON('book', 14)}<span>${esc(text || 'How this works')}</span></a>`;
}
/* Links marked data-docs-link navigate inside the app, wherever a screen renders them. */
document.addEventListener('click', (e) => {
  const a = e.target instanceof Element ? e.target.closest('a[data-docs-link]') : null;
  if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
  e.preventDefault();
  B.closeDrawer(); B.closeModal();
  B.go(a.getAttribute('href'));
});

/* ---------- the audience filter ---------- */
function storedFilter() {
  let value = null;
  try { value = localStorage.getItem(FILTER_KEY); } catch (e) { return null; }
  return value === '' || (value !== null && value in AUDIENCE_NAME) ? value : null;
}
function defaultFilter() {
  const stored = storedFilter();
  if (stored !== null) return stored;
  if (standalone() || !B.S.me) return '';
  if (B.hasRole('admin')) return 'admins';
  if (B.hasRole('compliance')) return 'compliance';
  return '';
}
function remember(value) {
  try { localStorage.setItem(FILTER_KEY, value); } catch (e) { /* storage unavailable */ }
}

/* ---------- the frame: inside the app, or on its own ---------- */
function frame(inner) {
  if (!standalone()) return inner;
  const back = B.S.phase === 'setup' ? ['/setup', 'Back to setup'] : ['/signin', 'Back to sign in'];
  return `<div class="dcsolo"><header class="dctop"><a class="dcbrand" href="/docs" data-docs-link><span class="pvk" aria-hidden="true">K</span><b>Broth</b><span>Docs</span></a><span class="lsp"></span><a class="btn sm" href="${back[0]}" data-docs-link>${back[1]}</a></header><div class="dcsolo-b">${inner}</div></div>`;
}
function paint(inner) {
  const app = $('#app');
  app.className = standalone() ? 'dcapp' : '';
  app.innerHTML = frame(inner);
}
function setTitle(title) {
  const cur = $('#crumb .cur');
  if (cur) cur.textContent = title;
  const mb = $('#mbtitle');
  if (mb) mb.textContent = title;
  document.title = title === 'Docs' ? 'Docs - Broth' : `${title} - Broth docs`;
}

/* ---------- contents ---------- */
async function contents() {
  const s = state();
  setTitle('Docs');
  const filter = defaultFilter();
  const chips = AUDIENCES.map(([k, l]) => `<button type="button" class="lchip ${filter === k ? 'on' : ''}" aria-pressed="${filter === k}" data-aud="${k}">${l}</button>`).join('');
  paint(`<div class="pg dc"><h1>Docs</h1><p class="sub pgsub">How to ask Broth, describe pages with labels, and set Broth up for your team.</p><div class="libchips dcchips" role="group" aria-label="Who it is for">${chips}</div><div class="dcgrid" id="dcgrid"></div></div>`);
  $$('[data-aud]').forEach((b) => {
    b.onclick = () => {
      remember(b.dataset.aud);
      $$('[data-aud]').forEach((x) => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-pressed', String(on)); });
      drawCards(b.dataset.aud);
    };
  });
  drawCards(filter);
  if (s.index) return;
  await loadIndex();
  const chosen = $('.dcchips .lchip.on');
  if (B.S.route.surface === 'docs' && !B.S.route.params.slug && chosen) drawCards(chosen.dataset.aud);
}
async function loadIndex() {
  const s = state();
  s.loading = true; s.error = null;
  try { s.index = (await get('/docs')).items; } catch (error) { s.error = error; } finally { s.loading = false; }
}
function drawCards(filter) {
  const s = state();
  const grid = $('#dcgrid');
  if (!grid) return;
  if (!s.index) {
    if (s.error) {
      grid.innerHTML = B.errorBlock(s.error, 'dcretry');
      $('#dcretry').onclick = async () => { s.error = null; drawCards(filter); await loadIndex(); drawCards(filter); };
    } else {
      grid.innerHTML = B.loadingBlock('Loading the docs', 4, 'dccard dcsk');
    }
    return;
  }
  const items = s.index.filter((a) => !filter || a.audiences.includes(filter));
  grid.innerHTML = items.length
    ? items.map((a) => `<a class="dccard" href="/docs/${esc(a.slug)}" data-docs-link><b>${esc(a.title)}</b><p>${esc(a.summary)}</p><span class="dctags">${a.audiences.map((x) => `<span class="tag">${esc(AUDIENCE_NAME[x] || x)}</span>`).join('')}</span></a>`).join('')
    : B.emptyBlock('Nothing for this audience yet', 'Choose All to see every article.');
}

/* ---------- an article ---------- */
async function article(slug) {
  const s = state();
  const cached = s.articles[slug];
  if (cached && !cached.error) { drawArticle(cached); return; }
  setTitle('Docs');
  paint(`<div class="pg dc dcart">${backLink()}<div class="dcload">${B.loadingBlock('Loading the article', 6, 'dcskl')}</div></div>`);
  let result;
  try { result = await get(`/docs/${encodeURIComponent(slug)}`); } catch (error) { result = { error }; }
  s.articles[slug] = result;
  if (B.S.route.surface !== 'docs' || B.S.route.params.slug !== slug) return;
  if (result.error) drawFailure(slug, result.error); else drawArticle(result);
}
const backLink = () => `<a class="dcback" href="/docs" data-docs-link>${ICON('chevr', 14)}<span>All docs</span></a>`;
function drawFailure(slug, error) {
  setTitle('Docs');
  if (error.status === 404) {
    paint(`<div class="pg dc dcart">${backLink()}${B.emptyBlock("This article doesn't exist", 'It may have moved. The contents list every article.', '<a class="btn sm" href="/docs" data-docs-link>See all docs</a>')}</div>`);
    return;
  }
  paint(`<div class="pg dc dcart">${backLink()}${B.errorBlock(error, 'dcretry')}</div>`);
  $('#dcretry').onclick = () => { delete state().articles[slug]; article(slug); };
}
function sectionList(a, cls) {
  return `<ul class="${cls}">${a.sections.map((x) => `<li class="l${x.level}"><a href="#${esc(x.anchor)}" data-sec="${esc(x.anchor)}">${esc(x.title)}</a></li>`).join('')}</ul>`;
}
function drawArticle(a) {
  setTitle(a.title);
  const tags = a.audiences.map((x) => `<span class="tag">${esc(AUDIENCE_NAME[x] || x)}</span>`).join('');
  const has = a.sections.length > 0;
  paint(`<div class="pg dc dcart">${backLink()}<div class="dclay"><article class="dcdoc"><h1>${esc(a.title)}</h1><p class="sub dcsum">${esc(a.summary)}</p><div class="dctags">${tags}</div>${has ? `<details class="dcsecm"><summary>Sections</summary>${sectionList(a, 'dctocl')}</details>` : ''}<div class="dcprose">${a.html}</div></article>${has ? `<aside class="dctoc" aria-label="On this page"><div class="dctoch">On this page</div>${sectionList(a, 'dctocl')}</aside>` : ''}</div></div>`);
  const prose = $('.dcprose');
  // Links between articles navigate in the app; external ones already open a new tab.
  $$('a[href^="/docs"]', prose).forEach((link) => {
    link.onclick = (e) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return; e.preventDefault(); B.go(link.getAttribute('href')); };
  });
  $$('[data-sec]').forEach((link) => {
    link.onclick = (e) => {
      e.preventDefault();
      const details = link.closest('details');
      if (details) details.open = false;
      reveal(link.dataset.sec, true);
    };
  });
  reveal(decodeURIComponent(location.hash.slice(1)), false);
  markCurrent();
}
/** Scrolls to a section; an unknown or empty anchor shows the article from the top. */
function reveal(anchor, record) {
  const target = anchor ? document.getElementById(anchor) : null;
  if (target && target.closest('.dcprose')) {
    target.scrollIntoView({ block: 'start' });
    if (record) history.replaceState(history.state, '', `#${anchor}`);
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
    // Mark the section the link opened, so the eye finds it even when it sits low on the page.
    $$('.dcprose .dchit').forEach((h) => h.classList.remove('dchit'));
    void target.offsetWidth;
    target.classList.add('dchit');
  } else {
    const app = $('#app');
    app.scrollTop = 0;
    window.scrollTo(0, 0);
  }
  markCurrent();
}
/** Marks the section being read in "On this page": the last heading above the reading line. */
function markCurrent() {
  const toc = $('.dctoc');
  if (!toc) return;
  const headings = $$('.dcprose h2[id], .dcprose h3[id]');
  let current = headings.length ? headings[0].id : '';
  for (const h of headings) { if (h.getBoundingClientRect().top <= OFFSET + 1) current = h.id; else break; }
  // At the end of the page the last sections can never reach the reading line: the last one
  // in view is the one being read.
  const app = $('#app');
  const scroller = app.scrollHeight > app.clientHeight + 1 ? app : document.scrollingElement;
  if (scroller && scroller.scrollTop > 0 && scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2) {
    const shown = headings.filter((h) => h.getBoundingClientRect().top < innerHeight);
    if (shown.length) current = shown[shown.length - 1].id;
  }
  $$('[data-sec]', toc).forEach((link) => {
    const on = link.dataset.sec === current;
    link.classList.toggle('on', on);
    if (on) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current');
  });
}
let ticking = false;
const onScroll = () => {
  if (ticking || B.S.route.surface !== 'docs') return;
  ticking = true;
  requestAnimationFrame(() => { ticking = false; markCurrent(); });
};
$('#app').addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('scroll', onScroll, { passive: true });

window.SURFACES.docs = (params) => { if (params.slug) article(params.slug); else contents(); };
window.DOCS = { links: DOCS, link: docsLink };
})();
