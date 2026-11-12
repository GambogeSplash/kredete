/* capabilities.js: what the signed-in person may do and see (developer role spec 2.4).
 *
 * The server says what each person may do: /v1/me lists their capabilities, computed from
 * their roles by the one table in broth-service. The client never decides from a role name;
 * role names are only shown (People chips, the account page).
 *
 * This file is the one place that says which capability each screen needs, so the Admin
 * rail, the router and the tests read the same answer.
 *
 * Loaded as a classic script (window.CAPS) and as a CommonJS module by the unit tests.
 */
(function (root, factory) {
  const exported = factory();
  if (typeof module === 'object' && module.exports) module.exports = exported;
  else root.CAPS = exported;
})(globalThis, function () {
  'use strict';

  /** @typedef {import('./types').components['schemas']['Capability']} Capability */
  /** @typedef {{ capabilities?: readonly string[] | null, owned_domain_ids?: readonly string[] | null } | null | undefined} Me */

  /** Each Admin tab, in rail order, with the capabilities that open it (any of them). */
  const ADMIN_TABS = /** @type {const} */ ([
    // The workspace overview counts people, domains and sources: an admin's page.
    ['workspace', ['people.manage']],
    ['people', ['people.manage']],
    // A developer sees every source, and acts on docs repositories only (spec 3.5).
    ['connectors', ['sources.manage', 'docs_repos.connect']],
    ['domains', ['domains.manage']],
    ['audit', ['audit.read']],
  ]);

  /** Surfaces outside the Admin area that need a capability. */
  /** @type {Record<string, readonly string[]>} */
  const SURFACES = { bot: ['bots.manage'] };

  /**
   * Whether the person holds `capability`.
   * @param {Me} me
   * @param {string} capability
   */
  function can(me, capability) {
    return !!me && Array.isArray(me.capabilities) && me.capabilities.includes(capability);
  }

  /** @param {Me} me @param {readonly string[]} any */
  const canAny = (me, any) => any.some((c) => can(me, c));

  /**
   * The Admin tabs the person can open, in rail order.
   * @param {Me} me
   * @returns {string[]}
   */
  function adminTabs(me) {
    return ADMIN_TABS.filter(([, any]) => canAny(me, any)).map(([tab]) => tab);
  }

  /**
   * Whether the person can open a surface: `admin` with any Admin tab, or one in SURFACES.
   * @param {Me} me
   * @param {string} surface
   */
  function opens(me, surface) {
    if (surface === 'admin') return adminTabs(me).length > 0;
    const any = SURFACES[surface];
    return !any || canAny(me, any);
  }

  /**
   * Whether the person may act on a source of `system` (settings, Sync now, disconnecting,
   * connecting and finding): every source with `sources.manage`, a docs repository with
   * `docs_repos.connect`. Others see it read-only.
   * @param {Me} me
   * @param {string} system
   */
  function manages(me, system) {
    return can(me, 'sources.manage') || (system === 'github_docs' && can(me, 'docs_repos.connect'));
  }

  /**
   * Whether a help article's button shows: `need` is '' for nothing, else any of a
   * comma-separated list of capabilities and `owner` (owning a domain).
   * @param {Me} me
   * @param {string} need
   */
  function mayFollow(me, need) {
    if (!need) return true;
    const owns = !!me && Array.isArray(me.owned_domain_ids) && me.owned_domain_ids.length > 0;
    return need.split(',').some((n) => (n === 'owner' ? owns : can(me, n)));
  }

  /**
   * The line under a sync run's pages for those the reader cannot open (spec 3.3).
   * @param {number} hidden
   */
  function hiddenNote(hidden) {
    if (!hidden) return '';
    return `${hidden} ${hidden === 1 ? 'page' : 'pages'} you can't open`;
  }

  return { ADMIN_TABS, can, adminTabs, opens, manages, mayFollow, hiddenNote };
});
