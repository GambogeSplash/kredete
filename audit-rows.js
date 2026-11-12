/* audit-rows.js: how audit events read, wherever they are listed: the Admin audit log
 * (admin.js) and a person's activity (person.js). One place lists the actions with their
 * categories and names, picks each row's icon and tone, and draws its row, so the two lists
 * always agree (split search spec 3.3). ACTIONS entries are [category, action, name]. */
(() => {
'use strict';
const esc = (s) => window.BRAIN.esc(s);

const CATEGORIES = [['access', 'Access'], ['sources', 'Sources'], ['bots', 'Bots'], ['sign_ins', 'Sign-ins'], ['settings', 'Settings'], ['answers', 'Answers']];
const ACTIONS = [
  ['access', 'role.granted', 'Role granted'], ['access', 'role.revoked', 'Role removed'], ['access', 'clearance.changed', 'Clearance changed'],
  ['access', 'invitation.created', 'Invitation created'], ['access', 'invitation.revoked', 'Invitation revoked'], ['access', 'invitation.accepted', 'Invitation accepted'],
  ['access', 'user.suspended', 'Person suspended'], ['access', 'user.reactivated', 'Person reactivated'],
  ['access', 'alias.declared', 'All-staff group declared'], ['access', 'alias.removed', 'All-staff group removed'],
  ['sources', 'connection.created', 'Connection created'], ['sources', 'connection.disconnected', 'Connection removed'], ['sources', 'connection.warning_changed', 'Connection warning changed'],
  ['sources', 'connection.github_install_started', 'GitHub install started'], ['sources', 'connection.github_installed', 'GitHub installed'],
  ['sources', 'container.changed', 'Space changed'],
  ['sources', 'container.public_declaration.requested', 'Public space requested'], ['sources', 'container.public_declaration.approved', 'Public space approved'],
  ['sources', 'container.public_declaration.rejected', 'Public space rejected'], ['sources', 'container.public_declaration.revoked', 'Public space revoked'],
  ['sources', 'promotion.requested', 'Sharing requested'], ['sources', 'promotion.approved', 'Sharing approved'], ['sources', 'promotion.rejected', 'Sharing rejected'],
  ['sources', 'promotion.revoked', 'Sharing revoked'], ['sources', 'promotion.needs_review', 'Sharing needs review'],
  ['bots', 'bot.created', 'Bot created'], ['bots', 'bot.updated', 'Bot updated'], ['bots', 'bot.sources_changed', 'Bot sources changed'],
  ['bots', 'bot.paused', 'Bot paused'], ['bots', 'bot.resumed', 'Bot resumed'], ['bots', 'bot.archived', 'Bot archived'],
  ['bots', 'bot_product.created', 'Product created'], ['bots', 'bot_product.updated', 'Product updated'],
  ['bots', 'bot_product.key_replaced', 'Product key replaced'], ['bots', 'bot_product.revoked', 'Product revoked'],
  ['sign_ins', 'session.created', 'Signed in'], ['sign_ins', 'session.revoked', 'Signed out'],
  ['sign_ins', 'account.linked', 'Account linked'], ['sign_ins', 'account.unlinked', 'Account unlinked'],
  ['settings', 'domain.changed', 'Domain changed'], ['settings', 'credential.changed', 'Credentials changed'], ['settings', 'setup.claimed', 'Setup claimed'],
  ['answers', 'answer.served', 'Answer served'],
];
/** An action's name, as the lists read it. */
const actionName = (a) => (ACTIONS.find((x) => x[1] === a) || [null, a, String(a).replace(/[._]/g, ' ')])[2];
/* Each event comes with its category from the server; the icon is the category's. */
const ICONS = { answers: 'chat', access: 'user', sources: 'plug', bots: 'bot', sign_ins: 'lock', settings: 'settings' };
const categoryIcon = (c) => ICONS[c] || 'doc';
const outcomeTone = (o) => (o === 'ok' || o === 'answered' ? 'ok' : /denied|refused|failed|error|blocked|rejected/.test(String(o)) ? 'bad' : '');
const outcomeName = (o) => String(o).replace(/_/g, ' ');

/** What an event acted on, as the Resource column reads. */
function target(e) {
  if (e.action === 'answer.served') { const n = window.BRAIN.arr(e.sources).length; return `${n} ${n === 1 ? 'source' : 'sources'}`; }
  if (e.target_type) return esc(e.target_type.replace(/_/g, ' '));
  return '';
}

/** Who did it: their name linking to their page when known, else the start of their id. */
function actor(id, names) {
  if (!id) return '<span class="amute">System</span>';
  const n = (names || {})[id];
  const label = n ? `${window.AVATAR(n, 'lav', 18)} ${esc(n)}` : `<span class="mono" title="${esc(id)}">${esc(id.slice(0, 8))}</span>`;
  return `<a class="audwho-l" href="/people/${esc(id)}" data-link>${label}</a>`;
}

/** The header row. Without `withActor` the Actor column is left out (one person's activity). */
function head(withActor) {
  const cols = ['Timestamp', 'Event', ...(withActor ? ['Actor'] : []), 'Resource', 'Outcome'];
  return `<div class="aud-r aud-h${withActor ? '' : ' noactor'}" role="row">${cols.map((c) => `<span role="columnheader">${c}</span>`).join('')}</div>`;
}

/** One event's row. `names` maps user ids to names; null leaves the Actor column out. */
function row(e, names) {
  const B = window.BRAIN;
  const who = names === null ? '' : `<span class="audwho">${actor(e.actor, names)}</span>`;
  return `<div class="aud-r${names === null ? ' noactor' : ''}" role="row"><span class="amute">${B.when(e.ts, B.dayLabel(e.ts, true))}</span><span class="audw"><i class="audi">${window.ICON(categoryIcon(e.category), 14)}</i><b class="audact">${esc(actionName(e.action))}</b>${e.channel && e.channel !== 'employee' ? `<small class="amute"> · ${esc(e.channel)}</small>` : ''}</span>${who}<span>${target(e)}</span><span><span class="tag ${outcomeTone(e.outcome)}">${esc(outcomeName(e.outcome))}</span></span></div>`;
}

window.AUDIT_ROWS = { CATEGORIES, ACTIONS, actionName, outcomeName, head, row };
})();
