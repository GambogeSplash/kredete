/* settings-rail.js: the one left rail of Settings (unified settings spec).
 *
 * Every settings page (Profile, Sessions, the admin tabs, and Sharing requests inside the shell)
 * draws this same rail, so what a person sees never depends on how they got there. The Account
 * group is everyone's; the Administration group shows the admin tabs the person's capabilities open.
 */
(() => {
'use strict';
const B = window.BRAIN;
/** @type {(s: string, r?: ParentNode) => any[]} */
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const href = (k) => (k === 'connectors' ? '/admin/sources' : '/admin/' + k);

/**
 * The rail's HTML.
 * @param {string} current 'profile', 'sessions', an admin tab key, or 'governance'
 */
function settingsRail(current) {
  const item = (to, label, key) => `<button type="button" class="tab" data-go="${to}" aria-current="${key === current ? 'page' : 'false'}">${label}</button>`;
  const account = `<div class="lrail-h">Account</div>${item('/account', 'Profile', 'profile')}${item('/account/sessions', 'Sessions', 'sessions')}`;
  let admin = '';
  // Whoever can open the Admin area (capabilities.js) gets its group.
  if (B.opens('admin')) {
    const { tabs, allowed } = window.ADMIN;
    const mine = allowed();
    const tab = (k) => item(href(k), tabs[k].label, k);
    // Workspace, People, Sources, then Sharing requests, Domains and Audit log, in the prototype's order.
    const late = ['domains', 'audit'];
    admin = `<div class="lrail-sep" role="separator"></div><div class="lrail-h">Administration</div>${mine.filter((k) => !late.includes(k)).map(tab).join('')}${item('/governance', 'Sharing requests', 'governance')}${mine.filter((k) => late.includes(k)).map(tab).join('')}`;
  }
  return `<nav class="lrail" aria-label="Settings">${account}${admin}<div class="lrail-f"><button type="button" class="tab out" data-out>Sign out</button></div></nav>`;
}

/** @param {HTMLElement | null} nav */
function wireSettingsRail(nav) {
  if (!nav) return;
  $$('[data-go]', nav).forEach((b) => { b.onclick = () => B.go(b.dataset.go); });
  const out = /** @type {HTMLElement | null} */ (nav.querySelector('[data-out]'));
  if (out) out.onclick = () => B.armPress(out, 'Confirm sign out', () => B.signOut());
}

window.SETTINGS = { rail: settingsRail, wire: wireSettingsRail };
})();
