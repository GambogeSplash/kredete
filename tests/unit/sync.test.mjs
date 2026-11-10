// Unit tests for sync.js (sync runs spec 3.1, 3.2 and 3.4.1): how a run reads, and the poller.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';

const { runView } = createRequire(import.meta.url)('../../sync.js');

/** A SyncRunOut with every count at zero, overridden by `fields`. */
const run = (fields = {}) => ({
  id: 'run-1',
  trigger: 'manual',
  status: 'running',
  connection_id: 'conn-1',
  container_id: null,
  tasks_total: 2,
  tasks_done: 0,
  pages_total: 0,
  pages_done: 0,
  pages_failed: 0,
  failing: 0,
  updated: 0,
  removed: 0,
  started_at: '2026-11-10T09:00:00Z',
  finished_at: null,
  error: null,
  ...fields,
});
const finished = (fields) => run({ finished_at: '2026-11-10T09:05:00Z', tasks_done: 2, ...fields });
const space = (fields) => run({ trigger: 'space_read', container_id: 'space-1', tasks_total: 1, ...fields });
const spaceFinished = (fields) => space({ finished_at: '2026-11-10T09:05:00Z', tasks_done: 1, ...fields });

const idle = { busy: false, fraction: null };
const CASES = [
  // Manual runs: the connection card (spec 3.1).
  ['manual, checking for changes', run(), {}, { label: 'Checking for changes...', tag: null, detail: null, busy: true, fraction: null }],
  ['manual, one of two feeds done', run({ tasks_done: 1, pages_total: 7, pages_done: 3 }), {}, { label: 'Checking for changes...', tag: null, detail: null, busy: true, fraction: null }],
  ['manual, syncing pages', run({ tasks_done: 2, pages_total: 40, pages_done: 10, pages_failed: 2 }), {}, { label: 'Syncing 12 of 40 pages', tag: null, detail: null, busy: true, fraction: 0.3 }],
  ['manual, syncing one page', run({ tasks_done: 2, pages_total: 1 }), {}, { label: 'Syncing 0 of 1 page', tag: null, detail: null, busy: true, fraction: 0 }],
  ['manual, feeds done and nothing queued yet', run({ tasks_done: 2 }), {}, { label: 'Checking for changes...', tag: null, detail: null, busy: true, fraction: null }],
  ['manual, succeeded with changes', finished({ status: 'succeeded', pages_total: 40, pages_done: 40, updated: 40 }), {}, { label: 'Synced', tag: 'ok', detail: '40 pages updated', ...idle }],
  ['manual, succeeded with one change', finished({ status: 'succeeded', pages_total: 1, pages_done: 1, updated: 1 }), {}, { label: 'Synced', tag: 'ok', detail: '1 page updated', ...idle }],
  ['manual, succeeded without changes', finished({ status: 'succeeded' }), {}, { label: 'Synced', tag: 'ok', detail: 'No changes', ...idle }],
  ['manual, removed only', finished({ status: 'succeeded', pages_total: 2, pages_done: 2, removed: 2 }), {}, { label: 'Synced', tag: 'ok', detail: '2 removed', ...idle }],
  ['manual, updated and removed', finished({ status: 'succeeded', pages_total: 5, pages_done: 5, updated: 4, removed: 1 }), {}, { label: 'Synced', tag: 'ok', detail: '4 pages updated, 1 removed', ...idle }],
  ['manual, partial', finished({ status: 'partial', pages_total: 40, pages_done: 37, pages_failed: 3, failing: 3, updated: 37 }), {}, { label: 'Synced, 3 failed', tag: 'warn', detail: '37 pages updated', ...idle }],
  ['manual, partial with one failure fixed later', finished({ status: 'partial', pages_total: 40, pages_done: 37, pages_failed: 3, failing: 1, updated: 37 }), {}, { label: 'Synced, 1 failed', tag: 'warn', detail: '37 pages updated', ...idle }],
  ['manual, partial with every failure fixed later', finished({ status: 'partial', pages_total: 40, pages_done: 37, pages_failed: 3, failing: 0, updated: 37 }), {}, { label: 'Synced', tag: 'ok', detail: '37 pages updated', ...idle }],
  ['manual, partial where nothing was read', finished({ status: 'partial', pages_total: 2, pages_failed: 2, failing: 2 }), {}, { label: 'Synced, 2 failed', tag: 'warn', detail: null, ...idle }],
  ['manual, failed for its own reason', finished({ status: 'failed', tasks_done: 1, error: "Couldn't check for changes: The source did not respond" }), {}, { label: 'Sync failed', tag: 'bad', detail: "Couldn't check for changes: The source did not respond", ...idle }],
  ['manual, failed with no reason given', finished({ status: 'failed' }), {}, { label: 'Sync failed', tag: 'bad', detail: null, ...idle }],
  ['manual, failed by the connection, error shown above', finished({ status: 'failed', error: 'Confluence refused the token' }), { shownError: 'Confluence refused the token' }, { label: 'Sync failed. See the error above.', tag: null, detail: null, ...idle }],
  ['manual, failed by the connection, since recovered', finished({ status: 'failed', error: 'Confluence refused the token' }), { shownError: null }, { label: 'Sync failed', tag: 'bad', detail: 'Confluence refused the token', ...idle }],
  ['manual, failed while another error is shown', finished({ status: 'failed', error: 'Timed out' }), { shownError: 'Confluence refused the token' }, { label: 'Sync failed', tag: 'bad', detail: 'Timed out', ...idle }],

  // Space reads: the space rows (spec 3.2).
  ['space, listing started', space(), {}, { label: 'Listing pages...', tag: null, detail: null, busy: true, fraction: null }],
  ['space, listing', space({ pages_total: 30, pages_done: 4 }), {}, { label: 'Listing pages... 30 so far', tag: null, detail: null, busy: true, fraction: null }],
  ['space, re-read joined while listing', space({ tasks_total: 2, tasks_done: 1, pages_total: 50 }), {}, { label: 'Listing pages... 50 so far', tag: null, detail: null, busy: true, fraction: null }],
  ['space, reading', space({ tasks_done: 1, pages_total: 96, pages_done: 78, pages_failed: 2 }), {}, { label: '80 of 96', tag: null, detail: null, busy: true, fraction: 80 / 96 }],
  ['space, succeeded', spaceFinished({ status: 'succeeded', pages_total: 210, pages_done: 210, updated: 210 }), {}, { label: '210 pages', tag: 'ok', detail: null, ...idle }],
  ['space, succeeded with one page', spaceFinished({ status: 'succeeded', pages_total: 1, pages_done: 1, updated: 1 }), {}, { label: '1 page', tag: 'ok', detail: null, ...idle }],
  ['space, empty', spaceFinished({ status: 'succeeded' }), {}, { label: 'No pages', tag: 'ok', detail: null, ...idle }],
  ['space, partial', spaceFinished({ status: 'partial', pages_total: 96, pages_done: 94, pages_failed: 2, failing: 2 }), {}, { label: '2 failed', tag: 'warn', detail: '94 pages', ...idle }],
  ['space, partial with every failure fixed later', spaceFinished({ status: 'partial', pages_total: 96, pages_done: 94, pages_failed: 2, failing: 0 }), {}, { label: '96 pages', tag: 'ok', detail: null, ...idle }],
  ['space, partial with one failure fixed later', spaceFinished({ status: 'partial', pages_total: 96, pages_done: 94, pages_failed: 2, failing: 1 }), {}, { label: '1 failed', tag: 'warn', detail: '95 pages', ...idle }],
  ['space, failed to start', spaceFinished({ status: 'failed', tasks_done: 0, error: "Couldn't start reading this space. Try again." }), {}, { label: 'Read failed', tag: 'bad', detail: "Couldn't start reading this space. Try again.", ...idle }],
];

describe('runView', () => {
  for (const [name, input, context, expected] of CASES) {
    it(name, () => assert.deepEqual(runView(input, context), expected));
  }

  it('shows nothing without a run', () => {
    assert.equal(runView(null), null);
    assert.equal(runView(undefined), null);
  });

  it('never moves the bar backwards or past the end', () => {
    for (const [, input] of CASES) {
      const { fraction } = runView(input, {});
      if (fraction !== null) assert.ok(fraction >= 0 && fraction <= 1, `${fraction}`);
    }
  });
});
