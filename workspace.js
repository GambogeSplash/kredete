/* workspace.js: Admin, Workspace (the prototype's workspace page, with what the API can tell).
 *
 * The hero shows the workspace's address, with a Copy chip, and how people sign in. The settings
 * group counts what is connected, from /v1/admin/connections, /v1/admin/users and
 * /v1/admin/domains, and links to where each is managed. The name, logo, plan, data region and
 * retention of the prototype have no endpoint yet, so they are not shown (see COMPLETENESS-ADMIN.md).
 */
(() => {
'use strict';
const B = window.BRAIN;
/** @type {(s: string, r?: ParentNode) => any} */
const $ = (s, r = document) => r.querySelector(s);
/** @type {(s: string, r?: ParentNode) => any[]} */
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = B.esc;

const row = (label, note, value, action) => `<div class="frow"><div class="frl"><b>${label}</b>${note ? `<small>${note}</small>` : ''}</div><div class="frv">${value}</div><div class="fra">${action || ''}</div></div>`;
/** "1 connection", "3 connections"; a trailing plus when the list is longer than what was read. */
const count = (n, one, many, more) => `${n}${more ? '+' : ''} ${n === 1 && !more ? one : many}`;

async function render(el) {
  window.ADMIN.actions('');
  el.innerHTML = B.loadingBlock('Loading workspace', 3, 'actr');
  let connections, users, domains;
  try {
    [connections, users, domains] = await Promise.all([B.api.get('/admin/connections'), B.api.get('/admin/users', { limit: 200 }), B.api.get('/admin/domains')]);
  } catch (error) {
    el.innerHTML = `<div class="ds-empty">${B.errorBlock(error, 'wsretry')}</div>`;
    $('#wsretry').onclick = () => render(el);
    return;
  }
  const me = B.S.me;
  const host = location.host;
  const name = String(me.email || '').split('@')[1] || host;
  const live = B.rows(connections).filter((c) => c.status !== 'disconnected');
  const go = (path, label) => `<button type="button" class="btn sm" data-go="${path}">${label}</button>`;
  el.innerHTML = `<div class="adhero"><span class="adlogo" aria-hidden="true">${esc(name.charAt(0).toUpperCase())}</span><div class="adhd"><h2>${esc(name)}</h2><div class="adurl"><span>${esc(host)}</span><button type="button" class="adcopy" data-copy="${esc(host)}" aria-label="Copy address">${ICON('link', 14)}<em>Copy</em></button></div><div class="adchips"><span class="adch">${ICON('lock', 13)}Google sign-in</span>${B.sandbox() ? `<span class="adch">${ICON('globe', 13)}Sandbox</span>` : ''}</div></div></div>
   <h3 class="adh3">Settings</h3><div class="fgroup">${row('Sign-in', 'Members sign in with their Google account', 'Google', '')}${row('Sources', 'Spaces and repositories Broth reads', esc(count(live.length, 'connection', 'connections')), go('/admin/sources', 'Manage'))}${row('People', 'Everyone who has signed in', esc(count(B.rows(users).length, 'person', 'people', !!B.cursorOf(users))), go('/admin/people', 'Manage'))}${row('Domains', 'How pages are grouped by subject', esc(count(B.rows(domains).length, 'domain', 'domains')), go('/admin/domains', 'Manage'))}</div>`;
  $$('[data-go]', el).forEach((b) => { b.onclick = () => B.go(b.dataset.go); });
  $$('[data-copy]', el).forEach((b) => {
    b.onclick = async () => {
      try { await navigator.clipboard.writeText(b.dataset.copy); } catch (e) { /* clipboard blocked */ }
      const em = $('em', b);
      const was = em.textContent;
      em.textContent = 'Copied';
      b.classList.add('ok');
      setTimeout(() => { em.textContent = was; b.classList.remove('ok'); }, 1400);
    };
  });
  window.ADMIN.life(el);
}

window.ADMIN.tabs.workspace = { label: 'Workspace', roles: ['admin'], render };
})();
