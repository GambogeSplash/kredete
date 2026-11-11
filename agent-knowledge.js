/* agent-knowledge.js: what a bot answers from (bot admin spec 6.1).
 *
 * The containers Broth reads, grouped by connection, each with how many of its pages are
 * Public: a bot only ever answers from those. Ticking a container and saving replaces the bot's
 * sources (PUT /v1/admin/bots/{id}/sources). "Open in Library" lists a container's pages, where
 * the drawer asks for a Public promotion. A chosen container Broth no longer serves (excluded,
 * or its connection disconnected) stays listed and ticked, so the admin can untick it.
 */
(() => {
'use strict';
const B = window.BRAIN;
const A = window.AGENT;
const F = window.BOT_FORM;
const esc = B.esc;
/** @type {(s: string, r?: ParentNode) => any} */
const $ = (s, r = document) => r.querySelector(s);
/** @type {(s: string, r?: ParentNode) => any[]} */
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

A.pages.knowledge = (el, ctx) => {
  let bot = ctx.bot;
  const connections = new Map(ctx.connections.map((c) => [c.id, c]));
  /** Whether Broth serves a container's pages at all (one rule for every screen). */
  const serves = (c) => F.serves(c, ctx.connections);
  /** A container's connection, or a stand-in when it is gone. */
  const connectionOf = (c) => connections.get(c.connection_id) || { system: '', status: 'disconnected' };
  /** Listed: every served container, and any chosen one that is not served any more. */
  const listed = (chosen) => ctx.containers.filter((c) => serves(c) || chosen.includes(c.id));
  let picked = new Set(bot.sources);
  const same = () => picked.size === bot.sources.length && bot.sources.every((id) => picked.has(id));

  const intro = `<p class="sub agintro">The bot answers only from Public pages in the sources you choose. Docs site pages are Public because they are published; any other page becomes Public when someone approves a Public promotion. ${window.DOCS.link('botSources')}</p>`;
  if (!listed(bot.sources).length) {
    el.innerHTML = `${intro}<div class="dt"><div class="dt-r dtempty">${B.emptyBlock('No sources to choose from', 'Connect Confluence, Google Drive or a docs repository, and include the spaces the bot should answer from.', '<a class="btn sm" href="/admin/connectors" data-link>Open Connectors</a>')}</div></div>`;
    return;
  }

  function row(c) {
    const used = serves(c);
    const conn = connectionOf(c);
    const name = B.containerName(c.path);
    const id = `ks-${c.id}`;
    const note = !used
      ? `<span class="agksn">${c.included ? 'Its connection is disconnected.' : 'Excluded in Connectors.'} Nothing from it is used.</span>`
      : c.public_documents
        ? `<span class="agksn">${A.count(c.public_documents, 'Public page')}</span>`
        : '<span class="tag warn">No Public pages</span>';
    return `<div class="dt-r agks${used ? '' : ' off'}"><label class="agksl" for="${id}"><input type="checkbox" id="${id}" data-source="${c.id}" ${picked.has(c.id) ? 'checked' : ''}><span class="agksp">${B.srcIcon(conn.system, 18)}<span>${esc(name)}</span></span></label><span class="agksc">${note}</span><span class="agkso">${used ? `<button type="button" class="btn sm" data-open="${c.id}" aria-label="Open ${esc(name)} in the Library">Open in Library</button>` : ''}</span></div>`;
  }

  function draw() {
    const shown = listed(bot.sources);
    const groups = [...new Set(shown.map((c) => c.connection_id))].map((id) => [connections.get(id), shown.filter((c) => c.connection_id === id)]);
    el.innerHTML = `${intro}<div class="agksg">${groups.map(([conn, list]) => `<section class="dt agksd" style="--cols:minmax(0,1fr) 170px 150px" aria-label="${esc(label(conn))}"><div class="dt-r dt-h"><span>${esc(label(conn))}</span><span>For the bot</span><span></span></div>${list.map(row).join('')}</section>`).join('')}</div><p class="agtotal" id="kstotal" role="status"></p>`;
    $$('[data-source]', el).forEach((box) => {
      box.onchange = () => { if (box.checked) picked.add(box.dataset.source); else picked.delete(box.dataset.source); totals(); bar.update(); };
    });
    $$('[data-open]', el).forEach((b) => {
      b.onclick = () => window.LIBRARY.showSource(ctx.containers.find((c) => c.id === b.dataset.open));
    });
    totals();
    bar = A.saveBar(el, { dirty: () => !same(), valid: () => true, save, discard });
  }
  const label = (conn) => (conn ? `${B.systemName(conn.system)} · ${conn.site}` : 'Sources');

  function totals() {
    const chosen = ctx.containers.filter((c) => picked.has(c.id) && serves(c));
    const pages = chosen.reduce((n, c) => n + c.public_documents, 0);
    $('#kstotal', el).textContent = pages
      ? `${A.count(chosen.length, 'source')} · ${A.count(pages, 'Public page')}`
      : chosen.length ? `${A.count(chosen.length, 'source')} · The bot can't answer anything yet.` : "No sources chosen. The bot can't answer anything yet.";
    $('#kstotal', el).classList.toggle('warn', !pages);
  }

  function save(button) {
    B.busy(button, async () => {
      const next = await B.api.put(`/admin/bots/${bot.id}/sources`, { container_ids: [...picked] });
      bot = next;
      picked = new Set(bot.sources);
      ctx.saved(bot);
      draw();
      B.toast('Saved. The bot answers from these sources from its next question.');
    }, (error) => bar.error(B.problem(error)));
  }
  function discard() { picked = new Set(bot.sources); draw(); }

  /** @type {any} */
  let bar;
  draw();
};
})();
