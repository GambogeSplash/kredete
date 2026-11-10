/* sync.js: how a sync run reads in the UI (sync runs spec 3 and 7).
 *
 * A sync run is admin-started ingestion work: Sync now on a connection (`manual`) or the first
 * read of an included space (`space_read`). The Connectors page and the setup wizard both turn
 * a run (SyncRunOut) into what they show through runView, so the two never disagree.
 *
 * Loaded as a classic script (window.SYNC) and as a CommonJS module by the unit tests.
 */
(function (root, factory) {
  const exported = factory();
  if (typeof module === 'object' && module.exports) module.exports = exported;
  else root.SYNC = exported;
})(globalThis, function () {
  'use strict';

  /** @typedef {import('./types').components['schemas']['SyncRunOut']} SyncRun */
  /**
   * What a run looks like in the UI.
   * @typedef {object} RunView
   * @property {string} label the status text; inside a `.tag` of the `tag` tone when there is one
   * @property {'ok' | 'warn' | 'bad' | null} tag the outcome tone, or null for no tag
   * @property {string | null} detail secondary text shown after the label, such as the counts
   * @property {number | null} fraction progress from 0 to 1 for the bar, or null for no bar
   * @property {boolean} busy whether the run is still going (show a spinner)
   */
  /**
   * @typedef {object} RunContext
   * @property {string | null} [shownError] the connection error already shown above the run
   *   status (its red banner), so a run that error ended can point at it instead of repeating it
   */

  /**
   * @param {number} n
   * @param {string} one
   * @param {string} many
   */
  const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  /**
   * How a run reads, or null when there is no run.
   * @param {SyncRun | null | undefined} run
   * @param {RunContext} [context]
   * @returns {RunView | null}
   */
  function runView(run, context = {}) {
    if (!run) return null;
    const space = run.trigger === 'space_read';
    if (run.status === 'running') return running(run, space);
    if (run.status === 'failed') return failed(run, space, context.shownError);
    return space ? spaceRead(run) : synced(run);
  }

  /**
   * Until every feed task is done the page total is unknown, so there is no bar yet and it
   * never moves backwards (spec 3.1). A space read counts pages while it lists them (spec 3.2).
   * @param {SyncRun} run
   * @param {boolean} space
   * @returns {RunView}
   */
  function running(run, space) {
    const view = { tag: null, detail: null, fraction: null, busy: true };
    if (run.tasks_done < run.tasks_total || run.pages_total === 0) {
      if (!space) return { label: 'Checking for changes...', ...view };
      return { label: run.pages_total ? `Listing pages... ${run.pages_total} so far` : 'Listing pages...', ...view };
    }
    const processed = run.pages_done + run.pages_failed;
    const fraction = Math.min(1, processed / run.pages_total);
    if (space) return { label: `${processed} of ${run.pages_total}`, ...view, fraction };
    return { label: `Syncing ${processed} of ${count(run.pages_total, 'page', 'pages')}`, ...view, fraction };
  }

  /**
   * A finished manual run. Amber and its count follow `failing`, not `pages_failed`, so a
   * failure a later run fixed no longer shows (spec 3.4.1).
   * @param {SyncRun} run
   * @returns {RunView}
   */
  function synced(run) {
    const changes = [];
    if (run.updated) changes.push(`${count(run.updated, 'page', 'pages')} updated`);
    if (run.removed) changes.push(`${run.removed} removed`);
    const detail = changes.length ? changes.join(', ') : run.pages_total ? null : 'No changes';
    const warn = run.failing > 0;
    return { label: warn ? `Synced, ${run.failing} failed` : 'Synced', tag: warn ? 'warn' : 'ok', detail, fraction: null, busy: false };
  }

  /**
   * A finished space read: its page count, or how many of its pages are still failing.
   * @param {SyncRun} run
   * @returns {RunView}
   */
  function spaceRead(run) {
    const read = run.pages_total - run.failing;
    const pages = run.pages_total ? count(read, 'page', 'pages') : 'No pages';
    if (run.failing > 0) return { label: `${run.failing} failed`, tag: 'warn', detail: pages, fraction: null, busy: false };
    return { label: pages, tag: 'ok', detail: null, fraction: null, busy: false };
  }

  /**
   * A run ended by its connection failing points at the connection's error banner while that
   * banner shows the same error; otherwise it states its own error (spec 3.1).
   * @param {SyncRun} run
   * @param {boolean} space
   * @param {string | null | undefined} shownError
   * @returns {RunView}
   */
  function failed(run, space, shownError) {
    const view = { fraction: null, busy: false };
    if (run.error && run.error === shownError) return { label: 'Sync failed. See the error above.', tag: null, detail: null, ...view };
    return { label: space ? 'Read failed' : 'Sync failed', tag: 'bad', detail: run.error || null, ...view };
  }

  return { runView };
});
