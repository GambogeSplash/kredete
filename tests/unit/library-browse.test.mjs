// Unit tests for library-browse.js (nested domains spec 4.2): which mode the Library is in, and
// the documents query each state needs.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';

const { folders, mode, request } = createRequire(import.meta.url)('../../library-browse.js');

const blank = { folder: '', q: '', system: '', path: '', source: '', problems: '' };
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

describe('the Source filter (bot admin spec 9.2)', () => {
  it('lists one source as a flat list, wherever the Library was', () => {
    for (const folder of ['', 'payments']) assert.equal(mode(at({ folder, source: 'c1' })), 'search', folder);
  });
  it('asks for that container, with any other filter', () => {
    assert.deepEqual(request(at({ source: 'c1' })), { container_id: 'c1' });
    assert.deepEqual(request(at({ source: 'c1', q: 'fees', system: 'confluence' })), { q: 'fees', system: 'confluence', container_id: 'c1' });
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

// ---- Container groups (library containers spec 2.2) ----
// The held-out variants (plan LCW0.1), written before `groups` and `withinContainer` existed.
// Never edited afterwards except to remove the `todo` markers.
const browse = createRequire(import.meta.url)('../../library-browse.js');
const HELD_OUT = { todo: 'library containers plan LCW1.1' };
const box = (id, name, home = null) => ({ id, name, home_document_id: home });
const doc = (id, title, system, container, path = null) => ({ id, title, system, container, path });
const summary = (found) => found.map((g) => [g.container.name, g.system, g.rows.map((d) => d.title)]);

describe('groups', () => {
  const pay = box('c-pay', 'Payments (PAY)', 'd-pay-home');
  const cards = box('c-card', 'Cards (CARD)');
  const repo = box('c-repo', 'Proteensheykh/broth-docs-fixture');
  const items = [
    doc('d1', 'Create a card', 'github_docs', repo),
    doc('d2', 'Fees', 'confluence', pay),
    doc('d3', 'Lost cards', 'confluence', cards),
    doc('d-pay-home', 'Payments', 'confluence', pay),
    doc('d4', 'Refunds', 'confluence', pay),
  ];

  it('orders two spaces and a repository by source, then by container name', HELD_OUT, () => {
    assert.deepEqual(summary(browse.groups(items, ['confluence', 'github_docs'])), [
      ['Cards (CARD)', 'confluence', ['Lost cards']],
      ['Payments (PAY)', 'confluence', ['Fees', 'Refunds']],
      ['Proteensheykh/broth-docs-fixture', 'github_docs', ['Create a card']],
    ]);
    assert.deepEqual(summary(browse.groups(items, ['github_docs', 'confluence'])).map((g) => g[0]), ['Proteensheykh/broth-docs-fixture', 'Cards (CARD)', 'Payments (PAY)']);
  });

  it('puts a source the facets do not list after the ones they do', HELD_OUT, () => {
    const drive = box('c-fin', 'Finance');
    const found = browse.groups([doc('d9', 'Budget', 'gdrive', drive), ...items], ['confluence']);
    // Sources the facets do not list tie, so their containers follow by name.
    assert.deepEqual(found.map((g) => [g.system, g.container.name]), [
      ['confluence', 'Cards (CARD)'],
      ['confluence', 'Payments (PAY)'],
      ['gdrive', 'Finance'],
      ['github_docs', 'Proteensheykh/broth-docs-fixture'],
    ]);
  });

  it('keeps a space whose only page here is its home page, as a heading with no rows', HELD_OUT, () => {
    const eng = box('c-eng', 'Engineering (ENG)', 'd-eng');
    const found = browse.groups([doc('d-eng', 'Engineering handbook', 'confluence', eng)], ['confluence']);
    assert.equal(found.length, 1);
    assert.equal(found[0].container.id, 'c-eng');
    assert.equal(found[0].container.home_document_id, 'd-eng');
    assert.deepEqual(found[0].rows, []);
  });

  it('leaves a home page filed in a folder out of the rows, and its heading names it', HELD_OUT, () => {
    const ops = box('c-ops', 'Operations (OPS)', 'd-ops-home');
    const hr = box('c-hr', 'People (HR)');
    const folder = [doc('d-ops-home', 'Operations', 'confluence', ops, 'Operations (OPS)'), doc('d-leave', 'Leave policy', 'confluence', hr, 'People (HR) / Policies'), doc('d-rota', 'On-call rota', 'confluence', ops, 'Operations (OPS) / Rotas')];
    const found = browse.groups(folder, ['confluence']);
    assert.deepEqual(summary(found), [
      ['Operations (OPS)', 'confluence', ['On-call rota']],
      ['People (HR)', 'confluence', ['Leave policy']],
    ]);
    assert.equal(found[0].container.home_document_id, 'd-ops-home');
  });

  it('groups one folder with pages from two containers into two groups', HELD_OUT, () => {
    const drive = box('c-legal', 'Legal');
    const wiki = box('c-leg', 'Legal (LEG)');
    const found = browse.groups([doc('a', 'Contract A', 'gdrive', drive), doc('b', 'Contract B', 'confluence', wiki), doc('c', 'Contract C', 'gdrive', drive)], ['gdrive', 'confluence']);
    assert.deepEqual(summary(found), [
      ['Legal', 'gdrive', ['Contract A', 'Contract C']],
      ['Legal (LEG)', 'confluence', ['Contract B']],
    ]);
  });

  it('groups a personal space by its id and keeps its path as its name', HELD_OUT, () => {
    const mine = box('c-ada', 'Ada Lovelace (~ada)');
    const found = browse.groups([doc('n1', 'Notes', 'confluence', mine, 'Ada Lovelace (~ada) / Drafts')], ['confluence']);
    assert.deepEqual(summary(found), [['Ada Lovelace (~ada)', 'confluence', ['Notes']]]);
  });

  it('joins pages that arrive with "Show more" to their container group', HELD_OUT, () => {
    const pay2 = box('c-pay', 'Payments (PAY)', 'd-pay-home'); // the same container, a fresh object from the next page
    const first = items.slice(0, 3);
    const more = [doc('d5', 'Settlements', 'confluence', pay2), doc('d-pay-home', 'Payments', 'confluence', pay2)];
    assert.deepEqual(summary(browse.groups(first, ['confluence', 'github_docs'])).map((g) => g[2]), [['Lost cards'], ['Fees'], ['Create a card']]);
    assert.deepEqual(summary(browse.groups(first.concat(more), ['confluence', 'github_docs'])), [
      ['Cards (CARD)', 'confluence', ['Lost cards']],
      ['Payments (PAY)', 'confluence', ['Fees', 'Settlements']],
      ['Proteensheykh/broth-docs-fixture', 'github_docs', ['Create a card']],
    ]);
  });

  it('shows every page as a row when its container has no home page', HELD_OUT, () => {
    const found = browse.groups([doc('x', 'Payments', 'confluence', cards), doc('y', 'Cards', 'confluence', cards)], ['confluence']);
    assert.deepEqual(summary(found), [['Cards (CARD)', 'confluence', ['Payments', 'Cards']]]);
  });

  it('is empty with no pages', HELD_OUT, () => {
    assert.deepEqual(browse.groups([], ['confluence']), []);
  });
});

describe('withinContainer', () => {
  it('drops the container name when the path is exactly it', HELD_OUT, () => {
    assert.equal(browse.withinContainer('Proteensheykh/broth-docs-fixture', 'Proteensheykh/broth-docs-fixture'), '');
  });
  it('drops the leading container name followed by " / "', HELD_OUT, () => {
    assert.equal(browse.withinContainer('Payments (PAY) / Policies / Limits', 'Payments (PAY)'), 'Policies / Limits');
    assert.equal(browse.withinContainer('Ada Lovelace (~ada) / Drafts', 'Ada Lovelace (~ada)'), 'Drafts');
  });
  it('keeps the full path when the name is only a prefix of its first segment', HELD_OUT, () => {
    assert.equal(browse.withinContainer('Payments archive / X', 'Payments'), 'Payments archive / X');
    assert.equal(browse.withinContainer('Payments (PAY)/Old', 'Payments (PAY)'), 'Payments (PAY)/Old');
  });
  it('keeps a path that does not start with the container name', HELD_OUT, () => {
    assert.equal(browse.withinContainer('Team space / Runbooks', 'Engineering (ENG)'), 'Team space / Runbooks');
  });
  it('has nothing to show without a path', HELD_OUT, () => {
    assert.equal(browse.withinContainer(null, 'Cards (CARD)'), '');
    assert.equal(browse.withinContainer('', 'Cards (CARD)'), '');
  });
});

describe('searching does not group (should not change)', () => {
  it('stays one flat list in which a home page is an ordinary row', HELD_OUT, () => {
    const pay = box('c-pay', 'Payments (PAY)', 'd-pay-home');
    const results = [doc('d-pay-home', 'Payments', 'confluence', pay), doc('d2', 'Payments fees', 'confluence', pay)];
    for (const fields of [{ q: 'payments' }, { q: 'payments', folder: 'payments' }, { system: 'confluence' }, { source: 'c-pay' }]) {
      assert.equal(mode(at(fields)), 'search', JSON.stringify(fields));
    }
    // Grouping is a browsing rule only; it never takes the home page out of the results it is given.
    browse.groups(results, ['confluence']);
    assert.deepEqual(results.map((d) => d.id), ['d-pay-home', 'd2']);
  });
});
