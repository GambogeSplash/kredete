/* library-browse.js: the Library's rules, with no DOM (nested domains spec 4.2).
 *
 * The Library browses folders, which are domains, until someone searches or filters; then it is
 * a flat list, scoped to the folder they are in. Which of the two it is follows from its state
 * alone, and so does the documents query each needs.
 *
 * Loaded as a classic script (window.LIBRARY_BROWSE) and as a CommonJS module by the unit tests.
 */
(function (root, factory) {
  const exported = factory();
  if (typeof module === 'object' && module.exports) module.exports = exported;
  else root.LIBRARY_BROWSE = exported;
})(globalThis, function () {
  'use strict';

  /** @typedef {import('./types').components['schemas']['Facets']} Facets */
  /**
   * A folder: a domain the person can open at least one page under.
   * @typedef {object} Folder
   * @property {string} id
   * @property {string | null} parent_id
   * @property {string} name
   * @property {string} slug
   * @property {number} count pages filed directly in it
   * @property {number} total pages in it and every folder under it
   */
  /**
   * What decides the Library's mode and query.
   * @typedef {object} LibraryState
   * @property {string} folder the current folder's slug; empty at the root
   * @property {string} q search text
   * @property {string} system a source filter
   * @property {string} path a source location filter (the drawer's Location)
   * @property {string} problems '1' to show label problems only
   */

  /**
   * The folders in facets, ready for DOMAIN_TREE.tree.
   * @param {Facets | null | undefined} facets
   * @returns {Folder[]}
   */
  function folders(facets) {
    return ((facets && facets.domains) || []).map((d) => ({
      id: d.id,
      parent_id: d.parent_id,
      name: d.label,
      slug: d.value,
      count: d.count,
      total: d.total,
    }));
  }

  /**
   * 'browse' shows folders; 'search' is the flat list of results.
   * @param {LibraryState} state
   * @returns {'browse' | 'search'}
   */
  function mode(state) {
    return state.q || state.system || state.path || state.problems ? 'search' : 'browse';
  }

  /**
   * The /v1/documents query for the state, before paging.
   * Browsing: the root lists pages with no domain, a folder its own pages. Searching: everything,
   * or everything in the folder and the folders under it.
   * @param {LibraryState} state
   * @returns {Record<string, string | boolean>}
   */
  function request(state) {
    /** @type {Record<string, string | boolean>} */
    const query = {};
    if (mode(state) === 'browse') {
      if (state.folder) {
        query.domain = state.folder;
        query.direct = true;
      } else query.no_domain = true;
      return query;
    }
    if (state.folder) query.domain = state.folder;
    if (state.q) query.q = state.q;
    if (state.system) query.system = state.system;
    if (state.path) query.path = state.path;
    if (state.problems) query.label_problems = true;
    return query;
  }

  return { folders, mode, request };
});
