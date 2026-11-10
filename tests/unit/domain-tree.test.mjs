// Unit tests for domain-tree.js (nested domains spec 4.4), on the same held-out shapes as the
// server's tests: a single domain, a 6-level chain, a fan of 20, two trees, and a moved subtree.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';

const { tree, children, path, subtree, options } = createRequire(import.meta.url)('../../domain-tree.js');

/** Shapes map a slug to its parent's slug (null at the top). Names are the slugs, title-cased. */
const SINGLE = { solo: null };
const CHAIN = { l1: null, l2: 'l1', l3: 'l2', l4: 'l3', l5: 'l4', l6: 'l5' };
const FAN = { hub: null, ...Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`spoke-${String(i).padStart(2, '0')}`, 'hub'])) };
const TWO_TREES = { p: null, q: 'p', r: 'q', x: null, y: 'x' };
const MOVED = { p: null, x: null, y: 'x', q: 'y', r: 'q' };
const SHAPES = { SINGLE, CHAIN, FAN, TWO_TREES, MOVED };

/** Items in a scrambled order, so nothing depends on the order the API sends. */
const build = (shape) => tree(Object.entries(shape).reverse().map(([slug, parent]) => ({ id: `id-${slug}`, parent_id: parent && `id-${parent}`, name: slug.charAt(0).toUpperCase() + slug.slice(1) })));
const slugs = (items) => items.map((i) => i.id.slice(3));

describe('tree and children', () => {
  for (const [name, shape] of Object.entries(SHAPES)) {
    it(`gives every domain of ${name} under its parent, siblings by name`, () => {
      const t = build(shape);
      for (const [slug, parent] of Object.entries(shape)) {
        assert.ok(slugs(children(t, parent && `id-${parent}`)).includes(slug), slug);
      }
      for (const siblings of t.kids.values()) {
        const names = siblings.map((s) => s.name);
        assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b, 'en', { numeric: true })));
      }
    });
  }
  it('sorts names as people read them, not by code point', () => {
    const t = tree([{ id: 'a', parent_id: null, name: 'payments' }, { id: 'b', parent_id: null, name: 'Cards' }, { id: 'c', parent_id: null, name: 'Area 10' }, { id: 'd', parent_id: null, name: 'Area 9' }]);
    assert.deepEqual(children(t, null).map((i) => i.name), ['Area 9', 'Area 10', 'Cards', 'payments']);
  });
  it('puts a domain whose parent is missing at the top level', () => {
    const t = tree([{ id: 'orphan', parent_id: 'gone', name: 'Orphan' }, { id: 'top', parent_id: null, name: 'Top' }]);
    assert.deepEqual(children(t, null).map((i) => i.id), ['orphan', 'top']);
    assert.deepEqual(path(t, 'orphan').map((i) => i.id), ['orphan']);
  });
  it('keeps the items it was given, extra fields and all', () => {
    const t = tree([{ id: 'a', parent_id: null, name: 'A', total: 4 }]);
    assert.equal(children(t, null)[0].total, 4);
  });
});

describe('path', () => {
  const cases = [
    [SINGLE, 'solo', ['solo']],
    [CHAIN, 'l6', ['l1', 'l2', 'l3', 'l4', 'l5', 'l6']],
    [CHAIN, 'l1', ['l1']],
    [FAN, 'spoke-19', ['hub', 'spoke-19']],
    [TWO_TREES, 'r', ['p', 'q', 'r']],
    [MOVED, 'r', ['x', 'y', 'q', 'r']],
  ];
  for (const [shape, leaf, expected] of cases) {
    it(`runs from the top down to ${leaf}`, () => assert.deepEqual(slugs(path(build(shape), `id-${leaf}`)), expected));
  }
  it('is empty for an unknown domain', () => assert.deepEqual(path(build(TWO_TREES), 'nope'), []));
});

describe('subtree', () => {
  const cases = [
    [CHAIN, 'l4', ['l4', 'l5', 'l6']],
    [FAN, 'hub', Object.keys(FAN)],
    [FAN, 'spoke-03', ['spoke-03']],
    [TWO_TREES, 'p', ['p', 'q', 'r']],
    [MOVED, 'x', ['x', 'y', 'q', 'r']],
    [MOVED, 'p', ['p']],
  ];
  for (const [shape, top, expected] of cases) {
    it(`holds ${top} and everything under it`, () => assert.deepEqual(new Set([...subtree(build(shape), `id-${top}`)].map((i) => i.slice(3))), new Set(expected)));
  }
});

describe('options', () => {
  it('lists every domain once, each parent before its children, with depths', () => {
    const listed = options(build(TWO_TREES)).map(({ item, depth }) => `${item.id.slice(3)}:${depth}`);
    assert.deepEqual(listed, ['p:0', 'q:1', 'r:2', 'x:0', 'y:1']);
  });
  for (const [name, shape] of Object.entries(SHAPES)) {
    it(`lists all of ${name}, each depth one more than its parent's`, () => {
      const listed = options(build(shape));
      assert.equal(listed.length, Object.keys(shape).length);
      const depth = Object.fromEntries(listed.map(({ item, depth: d }) => [item.id, d]));
      for (const { item, depth: d } of listed) assert.equal(d, item.parent_id ? depth[item.parent_id] + 1 : 0);
      const seen = new Set();
      for (const { item } of listed) {
        if (item.parent_id) assert.ok(seen.has(item.parent_id), 'parent first');
        seen.add(item.id);
      }
    });
  }
  it('leaves out a domain and everything under it, as a parent picker must', () => {
    assert.deepEqual(options(build(CHAIN), { exclude: 'id-l3' }).map(({ item }) => item.id.slice(3)), ['l1', 'l2']);
    assert.deepEqual(options(build(TWO_TREES), { exclude: 'id-q' }).map(({ item }) => item.id.slice(3)), ['p', 'x', 'y']);
    assert.equal(options(build(FAN), { exclude: 'id-spoke-05' }).length, 20);
  });
});

describe('rows that contain a cycle', () => {
  const looped = tree([{ id: 'a', parent_id: 'c', name: 'A' }, { id: 'b', parent_id: 'a', name: 'B' }, { id: 'c', parent_id: 'b', name: 'C' }, { id: 'top', parent_id: null, name: 'Top' }]);
  it('still list every domain once, and every walk returns', () => {
    assert.deepEqual(options(looped).map(({ item }) => item.id).sort(), ['a', 'b', 'c', 'top']);
    assert.equal(path(looped, 'a').length, 3);
    assert.deepEqual([...subtree(looped, 'b')].sort(), ['a', 'b', 'c']);
    assert.deepEqual(options(looped, { exclude: 'a' }).map(({ item }) => item.id), ['top']);
  });
});
