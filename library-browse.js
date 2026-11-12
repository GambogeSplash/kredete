/* library-browse.js: the Library's rules, with no DOM (nested domains spec 4.2; library
 * containers spec 2.2).
 *
 * The Library browses folders, which are domains, until someone searches or filters; then it is
 * a flat list, scoped to the folder they are in. Which of the two it is follows from its state
 * alone, and so does the documents query each needs. While browsing, the pages at a level sit
 * under the container they come from: a space, a repository or a shared drive.
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
  /** @typedef {import('./types').components['schemas']['DocumentOut']} DocumentOut */
  /** @typedef {import('./types').components['schemas']['ContainerRef']} ContainerRef */
  /**
   * The pages at one level that come from one container.
   * @typedef {object} ContainerGroup
   * @property {ContainerRef} container
   * @property {DocumentOut['system']} system its source
   * @property {DocumentOut[]} rows its pages here, without its home page
   */
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
   * @property {string} [source] one container's id (the Support agent's "Open in Library")
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
    return state.q || state.system || state.path || state.source || state.problems ? 'search' : 'browse';
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
    if (state.source) query.container_id = state.source;
    if (state.problems) query.label_problems = true;
    return query;
  }

  /**
   * The container groups at a browsing level: one per container with a page here, its home page
   * included, ordered by source as `systemOrder` lists them (sources it leaves out come after),
   * then by container name. The home page never becomes a row: the group's heading opens it.
   * Groups are rebuilt from every page loaded so far, so pages from "Show more" join theirs.
   * @param {DocumentOut[]} items
   * @param {string[]} systemOrder
   * @returns {ContainerGroup[]}
   */
  function groups(items, systemOrder) {
    /** @type {Map<string, ContainerGroup>} */
    const found = new Map();
    for (const item of items) {
      let group = found.get(item.container.id);
      if (!group) {
        group = { container: item.container, system: item.system, rows: [] };
        found.set(item.container.id, group);
      }
      if (item.id !== item.container.home_document_id) group.rows.push(item);
    }
    const rank = (/** @type {string} */ system) => {
      const at = systemOrder.indexOf(system);
      return at < 0 ? systemOrder.length : at;
    };
    return [...found.values()].sort(
      (a, b) => rank(a.system) - rank(b.system) || a.container.name.localeCompare(b.container.name) || a.container.id.localeCompare(b.container.id),
    );
  }

  /**
   * A page's place inside its container: its path without the container's name, when the path
   * is that name or starts with it and " / ". Otherwise the whole path, since a path comes from
   * the page's ancestors in the source and need not start with its container's name.
   * @param {string | null | undefined} path
   * @param {string} name the container's name, as the API gives it
   * @returns {string}
   */
  function withinContainer(path, name) {
    if (!path || path === name) return '';
    const lead = `${name} / `;
    return name && path.startsWith(lead) ? path.slice(lead.length) : path;
  }

  return { folders, mode, request, groups, withinContainer };
});
