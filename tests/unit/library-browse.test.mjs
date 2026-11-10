// Unit tests for library-browse.js (nested domains spec 4.2): which mode the Library is in, and
// the documents query each state needs.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';

const { folders, mode, request } = createRequire(import.meta.url)('../../library-browse.js');

const blank = { folder: '', q: '', system: '', path: '', problems: '' };
const at = (fields) => ({ ...blank, ...fields });

describe('mode', () => {
  it('browses with no search and no filter, at the root or in a folder at any depth', () => {
    for (const folder of ['', 'payments', 'cross-border', 'l6']) assert.equal(mode(at({ folder })), 'browse', folder);
  });
  it('searches once there is search text or any filter, wherever it is', () => {
    for (const folder of ['', 'payouts']) {
      for (const fields of [{ q: 'fees' }, { system: 'confluence' }, { path: 'Payments (PAY)' }, { problems: '1' }, { q: 'x', system: 'gdrive' }]) {
        assert.equal(mode(at({ folder, ...fields })), 'search', JSON.stringify(fields));
      }
    }
  });
});

describe('request', () => {
  it('lists the pages with no domain at the root', () => {
    assert.deepEqual(request(at({})), { no_domain: true });
  });
  it("lists a folder's own pages inside it", () => {
    for (const folder of ['payments', 'cross-border', 'spoke-07']) assert.deepEqual(request(at({ folder })), { domain: folder, direct: true });
  });
  it('searches the folder and everything under it, never direct', () => {
    assert.deepEqual(request(at({ folder: 'payouts', q: 'limits' })), { domain: 'payouts', q: 'limits' });
    assert.deepEqual(request(at({ folder: 'l2', problems: '1' })), { domain: 'l2', label_problems: true });
  });
  it('searches everything at the root, combining every filter', () => {
    assert.deepEqual(request(at({ q: 'fees', system: 'confluence', path: 'Cards (CARD)', problems: '1' })), { q: 'fees', system: 'confluence', path: 'Cards (CARD)', label_problems: true });
    assert.deepEqual(request(at({ system: 'gdrive' })), { system: 'gdrive' });
  });
});

describe('folders', () => {
  it('turns domain facets into folders for the tree', () => {
    const facets = { systems: [], authorities: [], scopes: [], domains: [{ value: 'payouts', label: 'Payouts', id: 'd2', parent_id: 'd1', count: 0, total: 3 }] };
    assert.deepEqual(folders(facets), [{ id: 'd2', parent_id: 'd1', name: 'Payouts', slug: 'payouts', count: 0, total: 3 }]);
  });
  it('is empty without facets', () => {
    assert.deepEqual(folders(null), []);
    assert.deepEqual(folders(undefined), []);
  });
});
