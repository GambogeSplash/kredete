/* agent-overview.js: a bot's Overview (bot admin spec 5).
 *
 * Real setup state only, no numbers: whether it is live, what is still needed to get it live,
 * and a card each for Knowledge, Experience and Products. Insights (sub-project 4) add their
 * cards above these.
 */
(() => {
'use strict';
const B = window.BRAIN;
const F = window.BOT_FORM;
const A = window.AGENT;
const esc = B.esc;
/** @type {(s: string, r?: ParentNode) => any[]} */
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/** Numbers rise from 0 once (the entrance stagger runs on the tiles themselves); reduced motion shows them at once. */
function countUp(root) {
  const M = window.Motion;
  if (!M || /** @type {any} */ (window).__entering || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  $$('.agn', root).forEach((n) => {
    const to = Number(n.dataset.to);
    if (!(to > 1)) return;
    M.animate(0, to, { duration: 0.6, ease: [0.2, 0.8, 0.2, 1], onUpdate: (v) => { n.textContent = Math.round(v).toLocaleString('en-US'); } });
  });
}

const HELP = { knowledge: 'The sources the bot answers from, and how many of their pages are Public.', experience: 'What visitors see: name, greeting, contact and privacy links, and the daily limit.', products: 'The sites the bot runs on, each with its own key.' };

A.pages.overview = (el, ctx) => {
  const { bot, containers, connections } = ctx;
  const sites = F.liveSites(bot);
  const chosen = containers.filter((c) => bot.sources.includes(c.id));
  const served = F.served(bot, /** @type {any[]} */ (containers), connections);
  const pages = F.publicPages(bot, containers, connections);
  const answers = F.canAnswer(bot, containers, connections);
  const live = bot.products.some((p) => p.status === 'live');
  const head = el.parentElement.querySelector('.aghd .ds-act');
  head.insertAdjacentHTML('afterbegin', sites ? `<span class="tag ok">Live on ${A.count(sites, 'site')}</span>` : '<span class="tag warn">Needs setup</span>');
  /** The real numbers, one tile each; they count up once when the page opens. */
  const stat = (n, label) => `<div class="astat"><b class="agn" data-to="${n}">${n.toLocaleString('en-US')}</b><span>${esc(label)}</span></div>`;
  const stats = `<div class="agstats">${stat(served.length, served.length === 1 ? 'Source' : 'Sources')}${stat(pages, pages === 1 ? 'Public page' : 'Public pages')}${stat(sites, sites === 1 ? 'Live site' : 'Live sites')}${stat(bot.daily_question_limit, 'Questions a day')}</div>`;

  const step = (done, title, text, page, action) => `<li class="agck-i${done ? ' done' : ''}"><span class="agck-m" aria-hidden="true">${done ? window.ICON('check', 12) : ''}</span><span class="agck-t"><b>${esc(title)}</b><small>${esc(text)}</small></span>${done ? '<span class="sr">Done</span>' : `<button type="button" class="btn sm" data-go="${page}">${esc(action)}</button>`}</li>`;
  const checklist = answers && live ? '' : `<section class="ds-card agck" aria-labelledby="agckh"><h2 id="agckh">Getting it live${A.hint('Two steps before the bot answers visitors: choose its sources, then put it on a site.')}</h2><ol>
    ${step(answers, 'Choose what it answers from', answers ? `${A.count(pages, 'Public page')} in ${A.count(served.length, 'source')}.` : 'Pick sources with Public pages for the bot to answer from.', 'knowledge', 'Go to Knowledge')}
    ${step(live, 'Put it on a site', live ? `Live on ${A.count(sites, 'site')}.` : 'Add a product for each site, then paste its snippet there.', 'products', 'Go to Products')}
  </ol></section>`;

  const card = (title, page, body) => `<section class="ds-card agcard" aria-labelledby="agc-${page}"><div class="agcard-h"><h2 id="agc-${page}">${title}${A.hint(HELP[page])}</h2><button type="button" class="btn sm" data-go="${page}" aria-label="Edit ${title}">Edit</button></div>${body}</section>`;
  const row = (label, value) => `<div class="agkv"><dt>${esc(label)}</dt><dd>${value}</dd></div>`;
  const muted = (text) => `<span class="amute">${esc(text)}</span>`;
  /** A link shown as people read it: no scheme, no trailing slash. */
  const link = (url) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(url.replace(/^(https:\/\/|mailto:)/, '').replace(/\/$/, ''))}</a>`;
  const warn = (text) => `<p class="agwarn">${esc(text)}</p>`;

  const knowledge = card('Knowledge', 'knowledge', `<dl class="agkvs">${row('Sources', String(served.length))}${row('Public pages', String(pages))}</dl>${
    served.filter((c) => !c.public_documents).map((c) => warn(`${B.containerName(c.path)} has no Public pages.`)).join('')}${
    chosen.filter((c) => !served.includes(c)).map((c) => warn(`${B.containerName(c.path)} ${c.included ? 'is on a disconnected connection' : 'is excluded in Connectors'}, so nothing from it is used.`)).join('')}`);
  const experience = card('Experience', 'experience', `<dl class="agkvs">${row('Name', esc(bot.name))}${row('Greeting', bot.greeting ? esc(bot.greeting) : muted('None'))}${row('Contact', `${esc(bot.contact_label)}, ${link(bot.contact_url)}`)}${row('Privacy', link(bot.privacy_url))}${row('Daily limit', `${bot.daily_question_limit.toLocaleString('en-US')} questions`)}</dl>`);
  const ordered = F.byStatus(/** @type {any[]} */ (bot.products));
  const products = card('Products', 'products', ordered.length
    ? `<ul class="agprods">${ordered.map((p) => `<li${p.status === 'live' ? '' : ' class="off"'}><span class="agprod-n"><b>${esc(p.name)}</b><small>${p.allowed_origins.map(esc).join(', ')}</small></span>${p.status === 'live' ? '<span class="tag ok">Live</span>' : '<span class="tag">Revoked</span>'}</li>`).join('')}</ul>`
    : A.empty('No products yet', 'Add one for each site the bot should run on.', '', 'stack'));

  el.innerHTML = `${stats}${checklist}<div class="agcards">${knowledge}${experience}${products}</div>`;
  $$('[data-go]', el).forEach((b) => { b.onclick = () => ctx.go(b.dataset.go); });
  countUp(el);
};
})();
