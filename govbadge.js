/* govbadge.js: how many requests are waiting on you, shown on the Governance rail item.
 * The same set the Inbox's "Waiting on you" held: open requests you can decide that you did not ask for.
 * One read of GET /v1/promotions; people who cannot decide anything see no badge. */
(() => {
'use strict';
const B = window.BRAIN;
const OPEN = ['pending', 'needs_review'];
let waiting = 0;
let loaded = false;
const countOf = (items) => items.filter((p) => OPEN.includes(p.status) && p.can_decide && p.requested_by !== B.S.me.id).length;
/** Reads the requests again and redraws the shell; the badge pops when the number changed. */
async function refresh() {
  if (!B.S.me) return;
  let items;
  try { items = B.rows(await B.api.get('/promotions', { limit: 50 })); } catch (e) { return; }
  const next = countOf(items);
  window.__govBadgeChanged = loaded && next !== waiting;
  waiting = next;
  loaded = true;
  B.renderSurfaces();
  window.__govBadgeChanged = false;
}
window.GOVBADGE = { count: () => (loaded ? waiting : 0), refresh };
})();
