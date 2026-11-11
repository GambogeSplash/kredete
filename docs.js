/* docs.js: the product user docs at /docs (user docs spec 4).
 *
 * GET /v1/docs lists the articles and GET /v1/docs/{slug} returns one, rendered by the
 * server; both are public, so the docs open signed out and during setup too. Signed in they
 * sit inside the app; otherwise they stand alone with a way back to sign-in or setup.
 * The server's HTML holds only markup it produced (no raw HTML is accepted in articles), so
 * it is inserted as it is. Links between articles stay in the app; a hash opens a section,
 * and an unknown one opens the article at the top.
 *
 * The how-to articles (help-content.js) are written for the app and live in the page; they are listed first in
 * their topic, and the service's articles follow. help-content.js must load before this file.
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
/* The six topic cards and the how-to articles written for them (help-content.js). The service's own articles
   (GET /v1/docs) are listed after them in the topic they belong to. */
const HELP = window.HELP || { topics: [], articles: [] };
const TOPICS = HELP.topics;
/** An article marked `hidden` stays in help-content.js but is not listed, searched, counted or linked (its screen is gone). */
const LOCAL = HELP.articles.filter((a) => !a.hidden);
const LOCAL_BY_SLUG = Object.fromEntries(LOCAL.map((a) => [a.slug, a]));
/** Where each article the service serves is listed; one it does not know goes to the first topic that shares its audience. */
const TOPIC_OF = {
  'asking-broth': 'ask',
  'labelling-pages': 'owners',
  'fixing-label-problems': 'owners',
  'setting-up-spaces': 'sources',
  'connecting-docs-repositories': 'sources',
  'support-bots': 'admin',
};
const UPDATED = 'Updated 11 Nov 2026';
const topicOf = (id) => TOPICS.find((t) => t.id === id);
/** The topic an article is listed in: its own for how-to articles, else the table above, else by audience. */
function topicIdOf(slug) {
  if (LOCAL_BY_SLUG[slug]) return LOCAL_BY_SLUG[slug].topic;
  if (TOPIC_OF[slug]) return TOPIC_OF[slug];
  const item = state().index && state().index.find((x) => x.slug === slug);
  const t = item && TOPICS.find((x) => item.audiences.some((a) => x.audiences.includes(a)));
  return t ? t.id : null;
}
/** The articles of a topic, in reading order: how-to articles first, then the service's. */
function itemsOf(t) {
  const local = LOCAL.filter((a) => a.topic === t.id).map((a) => ({ slug: a.slug, title: a.title }));
  const remote = (state().index || []).filter((a) => !LOCAL_BY_SLUG[a.slug] && topicIdOf(a.slug) === t.id).map((a) => ({ slug: a.slug, title: a.title }));
  return local.concat(remote);
}
/** Where people write to a person. Left empty until Broth has an address for it, then the button shows. */
const SUPPORT_EMAIL = '';
let query = '';
let fromRect = null; // the topic card's picture, so it can travel to the top of the list
const answered = {}; // "Was this helpful?" answers, by article
const OFFSET = 96; // a heading this close to the top counts as the section being read
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const text = (html) => { const d = document.createElement('div'); d.innerHTML = html; return d.textContent; };

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
  // Always a framed small button, never an underlined link; hovering or focusing it opens a preview of the article.
  return `<a class="dclink btn sm" href="/help/${target}" ${attrs} data-doc="${esc(name)}">${ICON('book', 14)}<span>${esc(text || 'How this works')}</span></a>`;
}

/* ---------- the preview card on a "How this works" button ---------- */
/** What the card shows, from what is already in the page: no request is made on hover. */
const SERVICE_TITLE = { 'labelling-pages': 'Labelling pages', 'setting-up-spaces': 'Setting up spaces', 'fixing-label-problems': 'Fixing label problems', 'support-bots': 'Support bots', 'connecting-docs-repositories': 'Connecting docs repositories' };
function previewFor(key) {
  const target = DOCS[key];
  if (!target) return null;
  const slug = target.split('#')[0];
  const local = LOCAL_BY_SLUG[slug];
  const st = state();
  const item = st.index && st.index.find((x) => x.slug === slug);
  const full = st.articles[slug] && !st.articles[slug].error ? st.articles[slug] : null;
  const topic = topicOf(topicIdOf(slug));
  const title = local ? local.title : (item && item.title) || (full && full.title) || SERVICE_TITLE[slug] || 'Help center';
  const sum = local ? local.sum : (item && item.summary) || (full && full.summary) || '';
  const steps = local ? local.steps.slice(0, 3).map((x) => x[0]) : ((full && full.sections) || []).filter((x) => x.level === 2).slice(0, 3).map((x) => x.title);
  return { slug, target, topic, title, sum, steps };
}
let cardTimer = 0, cardAnchor = null;
const cardOff = () => matchMedia('(hover:none), (max-width:900px)').matches;
function closeCard() {
  clearTimeout(cardTimer);
  if (cardAnchor) { cardAnchor.removeAttribute('aria-describedby'); cardAnchor = null; }
  if (B.hoverCard) B.hoverCard.close();
}
function openCard(a) {
  if (cardOff() || !B.hoverCard) return;
  const p = previewFor(a.dataset.doc);
  if (!p) return;
  closeCard();
  const html = `<div class="hc-top">${p.topic ? ICON(p.topic.icon, 16) : ICON('book', 16)}<span>${esc(p.topic ? p.topic.title : 'Help center')}</span></div><b class="hc-t">${esc(p.title)}</b>${p.sum ? `<p class="hc-s">${esc(p.sum)}</p>` : ''}${p.steps.length ? `<ol class="hc-st">${p.steps.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}<a class="btn sm hc-go" href="/help/${esc(p.target)}" data-link>Read the article${ICON('chevr', 14)}</a>`;
  const card = B.hoverCard.open(a, html, { cls: 'hcard', width: 320 });
  card.id = 'dchc';
  card.setAttribute('role', 'region');
  card.setAttribute('aria-label', p.title);
  a.setAttribute('aria-describedby', 'dchc');
  cardAnchor = a;
  card.addEventListener('mouseenter', () => clearTimeout(cardTimer));
  card.addEventListener('mouseleave', () => { cardTimer = setTimeout(closeCard, 140); });
  card.addEventListener('click', () => closeCard());
}
document.addEventListener('mouseover', (e) => {
  const a = e.target instanceof Element ? e.target.closest('.dclink[data-doc]') : null;
  if (!a || (e.relatedTarget instanceof Node && a.contains(e.relatedTarget)) || cardOff()) return;
  clearTimeout(cardTimer);
  cardTimer = setTimeout(() => openCard(a), 150);
});
document.addEventListener('mouseout', (e) => {
  const a = e.target instanceof Element ? e.target.closest('.dclink[data-doc]') : null;
  if (!a || (e.relatedTarget instanceof Node && a.contains(e.relatedTarget))) return;
  const card = document.getElementById('dchc');
  if (card && e.relatedTarget instanceof Node && card.contains(e.relatedTarget)) return;
  clearTimeout(cardTimer);
  cardTimer = setTimeout(closeCard, 140);
});
document.addEventListener('focusin', (e) => {
  const a = e.target instanceof Element ? e.target.closest('.dclink[data-doc]') : null;
  if (a) { clearTimeout(cardTimer); openCard(a); return; }
  const card = document.getElementById('dchc');
  if (card && !(e.target instanceof Element && card.contains(e.target))) closeCard();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && cardAnchor) closeCard(); });
document.addEventListener('click', (e) => { if (e.target instanceof Element && e.target.closest('.dclink[data-doc]')) closeCard(); }, true);

/* ---------- the frame: inside the app, or on its own ---------- */
function frame(inner) {
  if (!standalone()) return inner;
  const back = B.S.phase === 'setup' ? ['/setup', 'Back to setup'] : ['/signin', 'Back to sign in'];
  return `<div class="dcsolo"><header class="dctop"><a class="dcbrand" href="/help" data-link><span class="pvk" aria-hidden="true">K</span><b>Broth</b><span>Help center</span></a><span class="lsp"></span><a class="btn sm" href="${back[0]}" data-link>${back[1]}</a></header><div class="dcsolo-b">${inner}</div></div>`;
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
  const input = $('#dcq');
  input.oninput = (e) => { query = e.target.value; if (query.trim()) loadBodies(); drawCards(); };
  input.onkeydown = (e) => {
    if (e.key === 'Escape' && query) { e.preventDefault(); query = ''; input.value = ''; drawCards(); }
    if (e.key === 'Enter') { const first = $('#dcgrid .dcrow'); if (first) B.go(first.getAttribute('href')); }
  };
  const askBtn = $('#dcask');
  if (askBtn) askBtn.onclick = () => { B.go('/'); setTimeout(() => window.ASK.askFresh('How do I connect a source?'), 350); };
  if (fromRect === 'back' && !calm()) $$('#dcgrid .dccard').forEach((c, i) => c.animate([{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 360, delay: i * 45, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' }));
  fromRect = null;
  drawCards();
  if (query.trim()) loadBodies();
  if (s.index) return;
  await loadIndex();
  if (B.S.route.surface === 'docs' && !B.S.route.params.slug) drawCards();
}
async function loadIndex() {
  const s = state();
  s.loading = true; s.error = null;
  try { s.index = (await get('/docs')).items; } catch (error) { s.error = error; } finally { s.loading = false; }
}
/** Searching reads the text of the service's articles too, so each one is fetched once, quietly. */
async function loadBodies() {
  const s = state();
  if (!s.index) return;
  const todo = s.index.filter((a) => !s.articles[a.slug]);
  if (!todo.length) return;
  await Promise.all(todo.map(async (a) => { try { s.articles[a.slug] = await get(`/docs/${encodeURIComponent(a.slug)}`); } catch (error) { /* it opens, and fails visibly, on its own page */ } }));
  if (B.S.route.surface === 'docs' && !B.S.route.params.slug && query.trim()) drawCards();
}
/** Everything a search can match in an article: title, summary, steps, tip, fix, button, related titles; for the service's, its text. */
function haystack(item) {
  const a = LOCAL_BY_SLUG[item.slug];
  if (a) {
    const rel = (a.rel || []).map((r) => (LOCAL_BY_SLUG[r] || {}).title || '');
    return [a.title, a.sum, ...a.steps.map((x) => x.join(' ')), a.tip, a.fix, a.go && a.go[0], ...rel].filter(Boolean).join(' ').toLowerCase();
  }
  const full = state().articles[item.slug];
  return [item.title, item.summary, full && !full.error ? text(full.html) : ''].join(' ').toLowerCase();
}
function drawCards() {
  const s = state();
  const grid = $('#dcgrid');
  if (!grid) return;
  const q = query.toLowerCase().trim();
  if (q) {
    const pool = LOCAL.map((a) => ({ slug: a.slug, title: a.title })).concat((s.index || []).filter((a) => !LOCAL_BY_SLUG[a.slug]));
    const hits = pool.filter((a) => haystack(a).includes(q));
    grid.innerHTML = hits.length
      ? `<div class="dclist">${hits.map((a) => { const t = topicOf(topicIdOf(a.slug)); return `<a class="dcrow" href="/help/${esc(a.slug)}" data-link>${esc(a.title)}<small>${esc(t ? t.title : '')}</small><span>${ICON('chevr', 14)}</span></a>`; }).join('')}</div>`
      : framed('search', 'No articles match', 'Try fewer words.');
    return;
  }
  const note = s.error ? failed(s.error, 'dcretry') : '';
  grid.innerHTML = `<div class="dcgrid">${TOPICS.map((t) => {
    const list = itemsOf(t);
    const n = list.length;
    return `<a class="dccard" href="/help/${esc(list[0].slug)}" data-link data-topic="${t.id}"><span class="dcimg"><img src="/assets/help/${t.id}.jpg" alt="" loading="lazy" draggable="false"></span><b>${esc(t.title)}</b><p>${esc(t.blurb)}</p><small class="dccount">${n} ${n === 1 ? 'article' : 'articles'}</small></a>`;
  }).join('')}</div>${note}`;
  $$('[data-topic]', grid).forEach((c) => {
    c.addEventListener('click', () => { const r = $('.dcimg', c).getBoundingClientRect(); fromRect = { left: r.left, top: r.top, width: r.width, height: r.height }; });
  });
  const retry = $('#dcretry');
  if (retry) retry.onclick = async () => { s.error = null; drawCards(); await loadIndex(); drawCards(); };
}

/* ---------- an article ---------- */
/** Keeps the topic list when the next article is in the same topic, so only the text changes. */
const keepNav = (slug) => { const nav = $('.dcnav'); const id = topicIdOf(slug); return nav && id && nav.dataset.topic === id && $('.dclay .dcdoc') ? nav : null; };
async function article(slug) {
  const s = state();
  const local = LOCAL_BY_SLUG[slug];
  if (local) { drawLocal(local); return; }
  const cached = s.articles[slug];
  if (cached && !cached.error) { drawArticle(cached); return; }
  setTitle('Help center');
  if (keepNav(slug)) {
    $('.dcdoc').innerHTML = `<div class="dcload">${B.loadingBlock('Loading the article', 6, 'dcskl')}</div>`;
    const toc = $('.dctoc'); if (toc) toc.remove();
  } else {
    paint(`<div class="pg dc dcart">${backLink()}<div class="dcload">${B.loadingBlock('Loading the article', 6, 'dcskl')}</div></div>`);
  }
  let result;
  try { result = await get(`/docs/${encodeURIComponent(slug)}`); } catch (error) { result = { error }; }
  s.articles[slug] = result;
  if (B.S.route.surface !== 'docs' || B.S.route.params.slug !== slug) return;
  if (result.error) drawFailure(slug, result.error); else drawArticle(result);
}
const backLink = () => `<a class="dcback" href="/help" data-link data-back>${ICON('chevr', 14)}<span>Help center</span></a>`;
function drawFailure(slug, error) {
  setTitle('Help center');
  if (error.status === 404) {
    paint(`<div class="pg dc dcart">${backLink()}${framed('book', "This article doesn't exist", 'It may have moved. The contents list every article.', '<a class="btn sm" href="/help" data-link>See all help articles</a>')}</div>`);
    return;
  }
  paint(`<div class="pg dc dcart">${backLink()}${failed(error, 'dcretry')}</div>`);
  $('#dcretry').onclick = () => { delete state().articles[slug]; article(slug); };
}
function navHtml(slug) {
  const t = topicOf(topicIdOf(slug));
  if (!t) return '<nav class="dcnav" aria-label="Articles"></nav>';
  const list = itemsOf(t);
  return `<nav class="dcnav" aria-label="Articles" data-topic="${t.id}"><span class="dcimg" id="dcim"><img src="/assets/help/${t.id}.jpg" alt="" draggable="false"></span><h2 class="dct">${esc(t.title)}</h2><p class="dcbl">${esc(t.blurb)}</p><div class="dcarts">${list.map((x) => `<a class="dcai${x.slug === slug ? ' on' : ''}" href="/help/${esc(x.slug)}" data-link ${x.slug === slug ? 'aria-current="page"' : ''}>${esc(x.title)}</a>`).join('')}</div></nav>`;
}
function sectionList(a, cls) {
  return `<ul class="${cls}">${a.sections.map((x) => `<li class="l${x.level}"><a href="#${esc(x.anchor)}" data-sec="${esc(x.anchor)}">${esc(x.title)}</a></li>`).join('')}</ul>`;
}
/** "Was this helpful?": answered once per article; nothing is sent anywhere yet. */
function helpRow(slug, updated) {
  const stamp = updated ? `<span class="lsp"></span><small>${UPDATED}</small>` : '';
  return `<div class="dchelp" data-slug="${esc(slug)}" aria-live="polite">${answered[slug] ? '<span>Thanks. That helps us improve this page.</span>' : '<span>Was this helpful?</span><button type="button" class="btn sm" data-h="y">Yes</button><button type="button" class="btn sm" data-h="n">No</button>'}${stamp}</div>`;
}
/** A how-to article: summary, explained steps, tip, "if this does not work", one action, related articles. */
function localHtml(a) {
  const rel = (a.rel || []).map((r) => LOCAL_BY_SLUG[r]).filter(Boolean);
  const to = a.go && a.go[1] === 'docs:trust' ? `/help/${itemsOf(topicOf('trust'))[0].slug}` : a.go && a.go[1];
  const roles = a.go && a.go[2] ? a.go[2].split(',') : [];
  const go = to && (!roles.length || B.hasRole(...roles)) && !standalone() ? `<a class="btn primary dcgo" href="${esc(to)}" data-link>${esc(a.go[0])}</a>` : '';
  return `<h1>${esc(a.title)}</h1><p class="dcsum">${esc(a.sum)}</p>
  <ol class="dcsteps">${a.steps.map((x) => `<li><b>${esc(x[0])}</b><span>${esc(x[1])}</span></li>`).join('')}</ol>
  ${a.tip ? `<div class="dctip"><i>${ICON('bulb', 16)}</i><div><b>Tip</b><p>${esc(a.tip)}</p></div></div>` : ''}
  ${a.fix ? `<div class="dcfix"><h3>If this does not work</h3><p>${esc(a.fix)}</p></div>` : ''}
  ${go}
  ${rel.length ? `<h3 class="dch3">Related</h3><div class="dcrel">${rel.map((x) => `<a class="dcrl" href="/help/${esc(x.slug)}" data-link>${esc(x.title)}<span>${ICON('chevr', 14)}</span></a>`).join('')}</div>` : ''}
  ${helpRow(a.slug, true)}`;
}
function drawLocal(a) {
  setTitle(a.title);
  place(a.slug, `<article class="dcdoc dchow">${localHtml(a)}</article>`, '');
  wireHelp();
}
function drawArticle(a) {
  setTitle(a.title);
  const tags = a.audiences.map((x) => `<span class="tag">${esc(AUDIENCE_NAME[x] || x)}</span>`).join('');
  const has = a.sections.length > 0;
  place(a.slug, `<article class="dcdoc"><h1>${esc(a.title)}</h1><div class="dctags">${tags}</div>${has ? `<details class="dcsecm"><summary>Sections</summary>${sectionList(a, 'dctocl')}</details>` : ''}<div class="dcprose">${a.html}</div>${helpRow(a.slug, false)}</article>`, has ? `<aside class="dctoc" aria-label="On this page"><div class="dctoch">On this page</div>${sectionList(a, 'dctocl')}</aside>` : '');
  const prose = $('.dcprose');
  // Links between articles navigate in the app; external ones already open a new tab.
  $('a[href^="/help"]', prose).forEach((link) => {
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
  wireHelp();
  reveal(decodeURIComponent(location.hash.slice(1)), false);
  markCurrent();
}
/** Puts an article on the page: the whole page when arriving from the contents (the card's picture travels into place), only the text when moving within a topic. */
function place(slug, center, aside) {
  const nav = keepNav(slug);
  if (nav) {
    const old = $('.dcdoc');
    const toc = $('.dctoc'); if (toc) toc.remove();
    old.outerHTML = center;
    if (aside) $('.dclay').insertAdjacentHTML('beforeend', aside);
    $$('.dcai', nav).forEach((l) => { const on = l.getAttribute('href') === `/help/${slug}`; l.classList.toggle('on', on); if (on) l.setAttribute('aria-current', 'page'); else l.removeAttribute('aria-current'); });
    window.scrollTo(0, 0); $('#app').scrollTop = 0;
    if (!calm()) $('.dcdoc').animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)' });
    return;
  }
  paint(`<div class="pg dc dcart">${backLink()}<div class="dclay">${navHtml(slug)}${center}${aside}</div></div>`);
  enter();
  const s = state();
  if (!s.index && !s.loading) loadIndex().then(() => { const n = $('.dcnav'); if (n && B.S.route.surface === 'docs' && B.S.route.params.slug === slug) { n.outerHTML = navHtml(slug); } });
}
/** The card's picture travels to its place at the top of the list; the list and the text follow it. */
function enter() {
  const from = fromRect && fromRect !== 'back' ? fromRect : null;
  fromRect = null;
  if (calm()) return;
  const nav = $('.dcnav'); const doc = $('.dcdoc'); const im = $('#dcim');
  if (!nav || !doc) return;
  if (from && from.width && im && im.animate && im.offsetWidth) {
    const to = im.getBoundingClientRect();
    const dx = from.left - to.left, dy = from.top - to.top, sx = from.width / to.width, sy = from.height / to.height;
    im.style.transformOrigin = 'top left';
    im.animate([{ transform: `translate(${dx}px,${dy}px) scale(${sx},${sy})` }, { transform: 'none' }], { duration: 520, easing: 'cubic-bezier(.2,.85,.2,1)' });
    [...nav.children].filter((el) => el !== im).forEach((el, i) => el.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 380, delay: 200 + i * 40, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' }));
    doc.animate([{ opacity: 0, transform: 'translateX(18px)' }, { opacity: 1, transform: 'none' }], { duration: 440, delay: 260, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
  } else {
    [nav, doc].forEach((el, i) => el.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 300, delay: i * 70, easing: 'ease-out', fill: 'backwards' }));
  }
}
function wireHelp() {
  $$('.dchelp [data-h]').forEach((b) => {
    b.onclick = () => { const row = b.closest('.dchelp'); answered[row.dataset.slug] = b.dataset.h; row.innerHTML = '<span>Thanks. That helps us improve this page.</span>'; };
  });
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

/* "Help center" back link: the cards come back one after the other. */
document.addEventListener('click', (e) => { const b = e.target instanceof Element ? e.target.closest('a[data-back]') : null; if (b) fromRect = 'back'; });
window.SURFACES.docs = (params) => { if (params.slug) article(params.slug); else contents(); };
window.DOCS = { links: DOCS, link: docsLink };
})();
