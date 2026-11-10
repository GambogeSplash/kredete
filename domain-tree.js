/* domain-tree.js: how domains nest, for every screen that lists them (nested domains spec 4.4).
 *
 * A domain may sit inside another (its parent_id). Names are not unique across the tree, so
 * every list of domains shows the tree, never a flat list of names. The Library, Ask, People,
 * Connectors and Domains screens all build their lists here, from facets or from DomainOut.
 *
 * Writes on the server keep the tree acyclic, but nothing here relies on it: every walk stops
 * at a domain it has already seen, and a domain whose parent is missing shows at the top level.
 *
 * Loaded as a classic script (window.DOMAIN_TREE) and as a CommonJS module by the unit tests.
 */
(function (root, factory) {
  const exported = factory();
  if (typeof module === 'object' && module.exports) module.exports = exported;
  else root.DOMAIN_TREE = exported;
})(globalThis, function () {
  'use strict';

  /**
   * @template {{ id: string, parent_id: string | null, name: string }} T
   * @typedef {object} Tree
   * @property {Map<string, T>} items every domain by id
   * @property {Map<string | null, T[]>} kids each domain's children by name; null holds the top level
   */

  const byName = new Intl.Collator('en', { sensitivity: 'base', numeric: true });
  /**
   * @param {{ id: string, name: string }} a
   * @param {{ id: string, name: string }} b
   */
  const order = (a, b) => byName.compare(a.name, b.name) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

  /**
   * @template {{ id: string, parent_id: string | null, name: string }} T
   * @param {T[]} list
   * @returns {Tree<T>}
   */
  function tree(list) {
    /** @type {Map<string, T>} */
    const items = new Map(list.map((item) => [item.id, item]));
    /** @type {Map<string | null, T[]>} */
    const kids = new Map();
    for (const item of items.values()) {
      const parent = item.parent_id && items.has(item.parent_id) ? item.parent_id : null;
      const siblings = kids.get(parent) || [];
      siblings.push(item);
      kids.set(parent, siblings);
    }
    for (const siblings of kids.values()) siblings.sort(order);
    return { items, kids };
  }

  /**
   * A domain's children sorted by name, or the top-level domains for null.
   * @template {{ id: string, parent_id: string | null, name: string }} T
   * @param {Tree<T>} t
   * @param {string | null} id
   * @returns {T[]}
   */
  function children(t, id) {
    return t.kids.get(id) || [];
  }

  /**
   * From the top-level domain down to and including `id`; empty for an unknown domain.
   * @template {{ id: string, parent_id: string | null, name: string }} T
   * @param {Tree<T>} t
   * @param {string} id
   * @returns {T[]}
   */
  function path(t, id) {
    /** @type {T[]} */
    const up = [];
    const seen = new Set();
    let current = t.items.get(id);
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      up.push(current);
      current = current.parent_id ? t.items.get(current.parent_id) : undefined;
    }
    return up.reverse();
  }

  /**
   * The domain and everything under it, as ids; empty for an unknown domain.
   * @param {Tree<any>} t
   * @param {string} id
   * @returns {Set<string>}
   */
  function subtree(t, id) {
    /** @type {Set<string>} */
    const found = new Set();
    const stack = t.items.has(id) ? [id] : [];
    while (stack.length) {
      const current = /** @type {string} */ (stack.pop());
      if (found.has(current)) continue;
      found.add(current);
      for (const child of children(t, current)) stack.push(child.id);
    }
    return found;
  }

  /**
   * Every domain once, in tree order (each parent before its children, siblings by name), with
   * its depth from 0 at the top. `exclude` leaves out a domain and everything under it, as a
   * parent picker must for the domain being edited. Domains caught in a cycle, which no walk
   * from the top reaches, come last at depth 0 so that none goes missing.
   * @template {{ id: string, parent_id: string | null, name: string }} T
   * @param {Tree<T>} t
   * @param {{ exclude?: string | null }} [opts]
   * @returns {{ item: T, depth: number }[]}
   */
  function options(t, opts = {}) {
    const skip = opts.exclude ? subtree(t, opts.exclude) : new Set();
    /** @type {{ item: T, depth: number }[]} */
    const out = [];
    const seen = new Set(skip);
    /** @param {T} item @param {number} depth */
    const visit = (item, depth) => {
      if (seen.has(item.id)) return;
      seen.add(item.id);
      out.push({ item, depth });
      for (const child of children(t, item.id)) visit(child, depth + 1);
    };
    for (const top of children(t, null)) visit(top, 0);
    for (const item of [...t.items.values()].sort(order)) visit(item, 0);
    return out;
  }

  /** @param {string} text */
  const escape = (text) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

  /**
   * The <option>s of a domain select, in tree order. Each is indented by its depth in the open
   * list (data-depth) and shows its full path once chosen (data-label), since names repeat
   * across the tree. Values are ids unless `value` picks another field, such as the slug.
   * @template {{ id: string, parent_id: string | null, name: string }} T
   * @param {Tree<T>} t
   * @param {{ selected?: string | null, exclude?: string | null, value?: (item: T) => string }} [opts]
   * @returns {string}
   */
  function optionTags(t, opts = {}) {
    const value = opts.value || ((item) => item.id);
    return options(t, { exclude: opts.exclude })
      .map(({ item, depth }) => {
        const v = value(item);
        const full = path(t, item.id).map((n) => n.name).join(' / ');
        return `<option value="${escape(v)}" data-depth="${depth}" data-label="${escape(full)}"${v === opts.selected ? ' selected' : ''}>${escape(item.name)}</option>`;
      })
      .join('');
  }

  return { tree, children, path, subtree, options, optionTags };
});
