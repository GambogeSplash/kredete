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
/** A framed empty or failure state (the shared .ds-empty spec). */
const framed = (icon, title, line, action, alert) => `<div class="ds-empty${alert ? ' errstate' : ''}"${alert ? ' role="alert"' : ''}><span class="ds-empty-ic">${ICON(icon, 20)}</span><b>${esc(title)}</b>${line ? `<p>${esc(line)}</p>` : ''}${action || ''}</div>`;
const failed = (error, retryId) => framed('refresh', B.problem(error), error && error.status === 0 ? 'Check your connection.' : 'The rest of Broth still works.', `<button type="button" class="btn sm" id="${retryId}">Try again</button>`, true);

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
  botSources: 'support-bots#sources',
  botSnippet: 'support-bots#snippet',
  botKeys: 'support-bots#keys',
  botContact: 'support-bots#contact',
  docsInstall: 'connecting-docs-repositories#install',
  docsDeclaration: 'connecting-docs-repositories#public-declaration',
  docsProblems: 'connecting-docs-repositories#problems',
  docsPrivateKey: 'connecting-docs-repositories#private-key',
};
const AUDIENCE_NAME = { askers: 'Asking', authors: 'Writing pages', admins: 'Admin', compliance: 'Compliance' };
/** The six topic cards (the Broth help centre). Each one lists the real articles written for its audiences. */
const TOPICS = [
  { id: 'start', icon: 'compose', title: 'Getting started', blurb: 'Your first question, and what to expect.', audiences: ['askers'] },
  { id: 'ask', icon: 'search', title: 'Asking questions', blurb: 'Better questions, better answers.', audiences: ['askers'] },
  { id: 'sources', icon: 'grid', title: 'Sources and connectors', blurb: 'What Broth reads, and how it stays current.', audiences: ['admins', 'authors'] },
  { id: 'owners', icon: 'inbox', title: 'Owners and conflicts', blurb: 'Fixing what Broth finds wrong.', audiences: ['authors'] },
  { id: 'admin', icon: 'settings', title: 'Admin', blurb: 'People, policies, and the audit log.', audiences: ['admins'] },
  { id: 'trust', icon: 'shield', title: 'Privacy and security', blurb: 'Who can see what.', audiences: ['compliance'] },
];
const TOPIC_KEY = 'brain-docs-topic';
const topicOf = (id) => TOPICS.find((t) => t.id === id);
const inTopic = (a, t) => a.audiences.some((x) => t.audiences.includes(x));
const imageOf = (audiences) => ({ askers: 'ask', authors: 'sources', admins: 'admin', compliance: 'trust' }[(audiences || [])[0]] || 'start');
/** Where people write to a person. Left empty until Broth has an address for it, then the button shows. */
const SUPPORT_EMAIL = '';
let query = '';
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
  const attrs = newTab ? 'target="_blank" rel="noopener"' : 'data-link';
  return `<a class="dclink" href="/docs/${target}" ${attrs}>${ICON('book', 14)}<span>${esc(text || 'How this works')}</span></a>`;
}

/* ---------- the frame: inside the app, or on its own ---------- */
function frame(inner) {
  if (!standalone()) return inner;
  const back = B.S.phase === 'setup' ? ['/setup', 'Back to setup'] : ['/signin', 'Back to sign in'];
  return `<div class="dcsolo"><header class="dctop"><a class="dcbrand" href="/docs" data-link><span class="pvk" aria-hidden="true">K</span><b>Broth</b><span>Help center</span></a><span class="lsp"></span><a class="btn sm" href="${back[0]}" data-link>${back[1]}</a></header><div class="dcsolo-b">${inner}</div></div>`;
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
  document.title = title === 'Help center' ? 'Help center - Broth' : `${title} - Broth help center`;
}

/* ---------- contents ---------- */
async function contents() {
  const s = state();
  setTitle('Help center');
  const ask = !standalone() && window.ASK ? '<button type="button" class="btn primary" id="dcask">Ask Broth</button>' : '';
  const mail = SUPPORT_EMAIL ? `<a class="btn" href="mailto:${esc(SUPPORT_EMAIL)}">Email support</a>` : '';
  paint(`<div class="pg dc dcpg"><div class="dchero"><h1>Help center</h1><div class="dcsearch"><span>${ICON('search', 16)}</span><input id="dcq" type="search" placeholder="Search the help center" aria-label="Search the help center" value="${esc(query)}" autocomplete="off"></div></div><div class="dcbody" id="dcgrid"></div>${ask || mail ? `<div class="dcsupport"><div><b>Still stuck?</b><p>Ask Broth about Broth${mail ? ', or write to a person' : ''}.</p></div><div class="dcbtns">${ask}${mail}</div></div>` : ''}</div>`);
  $('#dcq').oninput = (e) => { query = e.target.value; drawCards(); };
  const askBtn = $('#dcask');
  if (askBtn) askBtn.onclick = () => { B.go('/'); setTimeout(() => window.ASK.askFresh('How do I connect a source?'), 350); };
  drawCards();
  if (s.index) return;
  await loadIndex();
  if (B.S.route.surface === 'docs' && !B.S.route.params.slug) drawCards();
}
async function loadIndex() {
  const s = state();
  s.loading = true; s.error = null;
  try { s.index = (await get('/docs')).items; } catch (error) { s.error = error; } finally { s.loading = false; }
}
function drawCards() {
  const s = state();
  const grid = $('#dcgrid');
  if (!grid) return;
  if (!s.index) {
    if (s.error) {
      grid.innerHTML = failed(s.error, 'dcretry');
      $('#dcretry').onclick = async () => { s.error = null; drawCards(); await loadIndex(); drawCards(); };
    } else {
      grid.innerHTML = B.loadingBlock('Loading the help center', 4, 'dccard dcsk');
    }
    return;
  }
  const q = query.toLowerCase().trim();
  if (q) {
    const hits = s.index.filter((a) => `${a.title} ${a.summary}`.toLowerCase().includes(q));
    grid.innerHTML = hits.length
      ? `<div class="dclist">${hits.map((a) => `<a class="dcrow" href="/docs/${esc(a.slug)}" data-link>${esc(a.title)}<small>${esc(a.audiences.map((x) => AUDIENCE_NAME[x] || x).join(', '))}</small><span>${ICON('chevr', 14)}</span></a>`).join('')}</div>`
      : framed('search', 'No articles match', 'Try fewer words.');
    return;
  }
  grid.innerHTML = `<div class="dcgrid">${TOPICS.map((t) => {
    const list = s.index.filter((a) => inTopic(a, t));
    const n = list.length;
    const open = list[0] ? `/docs/${esc(list[0].slug)}` : '/docs';
    return `<a class="dccard" href="${open}" data-link data-topic="${t.id}" ${n ? '' : 'aria-disabled="true"'}><span class="dcimg"><img src="/assets/help/${t.id}.jpg" alt="" loading="lazy" draggable="false"></span><b>${esc(t.title)}</b><p>${esc(t.blurb)}</p><small class="dccount">${n} ${n === 1 ? 'article' : 'articles'}</small></a>`;
  }).join('')}</div>`;
  $$('[data-topic]', grid).forEach((c) => {
    c.addEventListener('click', () => { try { localStorage.setItem(TOPIC_KEY, c.dataset.topic); } catch (e) { /* storage unavailable */ } });
  });
}

/* ---------- an article ---------- */
async function article(slug) {
  const s = state();
  const cached = s.articles[slug];
  if (cached && !cached.error) { drawArticle(cached); return; }
  setTitle('Help center');
  paint(`<div class="pg dc dcart">${backLink()}<div class="dcload">${B.loadingBlock('Loading the article', 6, 'dcskl')}</div></div>`);
  let result;
  try { result = await get(`/docs/${encodeURIComponent(slug)}`); } catch (error) { result = { error }; }
  s.articles[slug] = result;
  if (B.S.route.surface !== 'docs' || B.S.route.params.slug !== slug) return;
  if (result.error) drawFailure(slug, result.error); else drawArticle(result);
}
const backLink = () => `<a class="dcback" href="/docs" data-link>${ICON('chevr', 14)}<span>Help center</span></a>`;
function drawFailure(slug, error) {
  setTitle('Help center');
  if (error.status === 404) {
    paint(`<div class="pg dc dcart">${backLink()}${framed('book', "This article doesn't exist", 'It may have moved. The contents list every article.', '<a class="btn sm" href="/docs" data-link>See all help articles</a>')}</div>`);
    return;
  }
  paint(`<div class="pg dc dcart">${backLink()}${failed(error, 'dcretry')}</div>`);
  $('#dcretry').onclick = () => { delete state().articles[slug]; article(slug); };
}
/** The topic being read: the one opened from the contents, else the first whose audiences the article shares. */
function topicFor(a) {
  let stored = null;
  try { stored = localStorage.getItem(TOPIC_KEY); } catch (e) { /* storage unavailable */ }
  const t = topicOf(stored);
  return t && inTopic(a, t) ? t : TOPICS.find((x) => inTopic(a, x)) || null;
}
function navHtml(a) {
  const idx = state().index;
  const t = topicFor(a);
  if (!idx || !t) return '<nav class="dcnav" aria-label="Articles"></nav>';
  const list = idx.filter((x) => inTopic(x, t));
  return `<nav class="dcnav" aria-label="Articles"><span class="dcimg"><img src="/assets/help/${t.id}.jpg" alt="" draggable="false"></span><h2 class="dct">${esc(t.title)}</h2><div class="dcarts">${list.map((x) => `<a class="dcai${x.slug === a.slug ? ' on' : ''}" href="/docs/${esc(x.slug)}" data-link ${x.slug === a.slug ? 'aria-current="page"' : ''}>${esc(x.title)}</a>`).join('')}</div></nav>`;
}
function sectionList(a, cls) {
  return `<ul class="${cls}">${a.sections.map((x) => `<li class="l${x.level}"><a href="#${esc(x.anchor)}" data-sec="${esc(x.anchor)}">${esc(x.title)}</a></li>`).join('')}</ul>`;
}
function drawArticle(a) {
  setTitle(a.title);
  const tags = a.audiences.map((x) => `<span class="tag">${esc(AUDIENCE_NAME[x] || x)}</span>`).join('');
  const has = a.sections.length > 0;
  paint(`<div class="pg dc dcart">${backLink()}<div class="dclay">${navHtml(a)}<article class="dcdoc"><h1>${esc(a.title)}</h1><div class="dctags">${tags}</div>${has ? `<details class="dcsecm"><summary>Sections</summary>${sectionList(a, 'dctocl')}</details>` : ''}<div class="dcprose">${a.html}</div></article>${has ? `<aside class="dctoc" aria-label="On this page"><div class="dctoch">On this page</div>${sectionList(a, 'dctocl')}</aside>` : ''}</div></div>`);
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
  if (!state().index && !state().loading) loadIndex().then(() => { const nav = $('.dcnav'); if (nav && B.S.route.surface === 'docs' && B.S.route.params.slug === a.slug) nav.outerHTML = navHtml(a); });
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
