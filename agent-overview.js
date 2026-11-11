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

A.pages.overview = (el, ctx) => {
  const { bot, containers } = ctx;
  const sites = F.liveSites(bot);
  const chosen = containers.filter((c) => bot.sources.includes(c.id));
  const served = chosen.filter((c) => c.included);
  const pages = F.publicPages(bot, containers);
  const answers = F.canAnswer(bot, containers);
  const live = bot.products.some((p) => p.status === 'live');
  const head = el.parentElement.querySelector('.aghd');
  head.insertAdjacentHTML('beforeend', sites ? `<span class="tag ok">Live on ${A.count(sites, 'site')}</span>` : '<span class="tag">Not live</span>');

  const step = (done, title, text, page, action) => `<li class="agck-i${done ? ' done' : ''}"><span class="agck-m" aria-hidden="true">${done ? window.ICON('check', 12) : ''}</span><span class="agck-t"><b>${esc(title)}</b><small>${esc(text)}</small></span>${done ? '<span class="sr">Done</span>' : `<button type="button" class="btn sm" data-go="${page}">${esc(action)}</button>`}</li>`;
  const checklist = answers && live ? '' : `<section class="acard agck" aria-labelledby="agckh"><h2 id="agckh">Getting it live</h2><ol>
    ${step(answers, 'Choose what it answers from', answers ? `${A.count(pages, 'Public page')} in ${A.count(served.length, 'source')}.` : 'Pick sources with Public pages for the bot to answer from.', 'knowledge', 'Go to Knowledge')}
    ${step(live, 'Put it on a site', live ? `Live on ${A.count(sites, 'site')}.` : 'Add a product for each site, then paste its snippet there.', 'products', 'Go to Products')}
  </ol></section>`;

  const card = (title, page, body) => `<section class="acard agcard" aria-labelledby="agc-${page}"><div class="agcard-h"><h2 id="agc-${page}">${title}</h2><button type="button" class="btn sm" data-go="${page}" aria-label="Edit ${title}">Edit</button></div>${body}</section>`;
  const row = (label, value) => `<div class="agkv"><dt>${esc(label)}</dt><dd>${value}</dd></div>`;
  const muted = (text) => `<span class="amute">${esc(text)}</span>`;
  /** A link shown as people read it: no scheme, no trailing slash. */
  const link = (url) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(url.replace(/^(https:\/\/|mailto:)/, '').replace(/\/$/, ''))}</a>`;
  const warn = (text) => `<p class="agwarn">${esc(text)}</p>`;

  const knowledge = card('Knowledge', 'knowledge', `<dl class="agkvs">${row('Sources', String(served.length))}${row('Public pages', String(pages))}</dl>${
    served.filter((c) => !c.public_documents).map((c) => warn(`${B.containerName(c.path)} has no Public pages.`)).join('')}${
    chosen.filter((c) => !c.included).map((c) => warn(`${B.containerName(c.path)} is excluded in Connectors, so nothing from it is used.`)).join('')}`);
  const experience = card('Experience', 'experience', `<dl class="agkvs">${row('Name', esc(bot.name))}${row('Greeting', bot.greeting ? esc(bot.greeting) : muted('None'))}${row('Contact', `${esc(bot.contact_label)}, ${link(bot.contact_url)}`)}${row('Privacy', link(bot.privacy_url))}${row('Daily limit', `${bot.daily_question_limit.toLocaleString('en-US')} questions`)}</dl>`);
  const ordered = [...bot.products].sort((a, b) => (a.status === b.status ? 0 : a.status === 'live' ? -1 : 1));
  const products = card('Products', 'products', ordered.length
    ? `<ul class="agprods">${ordered.map((p) => `<li${p.status === 'live' ? '' : ' class="off"'}><span class="agprod-n"><b>${esc(p.name)}</b><small>${p.allowed_origins.map(esc).join(', ')}</small></span>${p.status === 'live' ? '<span class="tag ok">Live</span>' : '<span class="tag">Revoked</span>'}</li>`).join('')}</ul>`
    : `<p class="agnote">${muted('No products yet.')}</p>`);

  el.innerHTML = `${checklist}<div class="agcards">${knowledge}${experience}${products}</div>`;
  $$('[data-go]', el).forEach((b) => { b.onclick = () => ctx.go(b.dataset.go); });
};
})();
