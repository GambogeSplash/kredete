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
   * Whether a running run is still finding its pages: until every feed task (or listing) is
   * done the page total is unknown, so there is no bar yet and it never moves backwards.
   * @param {SyncRun} run
   */
  const finding = (run) => run.tasks_done < run.tasks_total || run.pages_total === 0;
  /** @param {SyncRun} run */
  const processed = (run) => run.pages_done + run.pages_failed;
  /** @param {number} total pages listed so far */
  const listing = (total) => (total ? `Listing pages… ${total} so far` : 'Listing pages…');

  /**
   * A running run (spec 3.1). A space read counts pages while it lists them (spec 3.2).
   * @param {SyncRun} run
   * @param {boolean} space
   * @returns {RunView}
   */
  function running(run, space) {
    const view = { tag: null, detail: null, fraction: null, busy: true };
    if (finding(run)) return { label: space ? listing(run.pages_total) : 'Checking for changes…', ...view };
    const done = processed(run);
    const fraction = Math.min(1, done / run.pages_total);
    if (space) return { label: `${done} of ${run.pages_total}`, ...view, fraction };
    return { label: `Syncing ${done} of ${count(run.pages_total, 'page', 'pages')}`, ...view, fraction };
  }

  /**
   * Several space reads as one line, for the setup step (spec 3.3): "Reading N of M pages"
   * across them all once every running read has listed its pages, so the bar never moves
   * backwards; until then the pages found so far. Null once no read is running.
   * @param {Array<SyncRun | null | undefined>} runs
   * @returns {RunView | null}
   */
  function readsView(runs) {
    const reads = /** @type {SyncRun[]} */ (runs.filter(Boolean));
    if (!reads.some(isRunning)) return null;
    const total = reads.reduce((n, run) => n + run.pages_total, 0);
    const view = { tag: null, detail: null, fraction: null, busy: true };
    if (reads.some((run) => isRunning(run) && finding(run))) return { label: listing(total), ...view };
    const done = reads.reduce((n, run) => n + processed(run), 0);
    return { label: `Reading ${done} of ${count(total, 'page', 'pages')}`, ...view, fraction: Math.min(1, done / total) };
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

  /**
   * @typedef {object} WatchOptions
   * @property {Array<SyncRun | null | undefined>} runs the runs the page shows now
   * @property {() => Promise<Array<SyncRun | null | undefined>>} fetch reads the runs again
   * @property {(runs: Array<SyncRun | null | undefined>, finished: SyncRun[]) => void} onUpdate
   *   called after every successful read; `finished` holds the runs this watcher saw running
   *   that have since finished, each reported once (for completion toasts)
   * @property {() => unknown} [route] the page the watcher belongs to; it stops once this
   *   returns something else (default: the app's route path)
   * @property {number} [interval] milliseconds between reads (default 2000)
   * @property {number} [backoff] milliseconds between reads after 3 failed reads in a row
   *   (default 10000)
   */

  /** @param {SyncRun | null | undefined} run */
  const isRunning = (run) => !!run && run.status === 'running';

  /**
   * Re-reads runs while any of them is running, and stops once none is, when the page
   * changes, or when the returned function is called (spec 6). A read that fails is retried;
   * after 3 failures in a row the watcher slows down until a read succeeds again.
   * @param {WatchOptions} options
   * @returns {() => void} stops watching
   */
  function watchRuns({ runs, fetch, onUpdate, route = appRoute, interval = 2000, backoff = 10000 }) {
    const page = route();
    /** Ids of the runs seen running and not yet reported finished. */
    const seen = new Set(runs.filter(isRunning).map((run) => /** @type {SyncRun} */ (run).id));
    let stopped = seen.size === 0;
    /** @type {ReturnType<typeof setTimeout> | undefined} */
    let timer;
    let errors = 0;
    const live = () => !stopped && route() === page;
    /** @param {number} ms */
    const later = (ms) => { timer = setTimeout(tick, ms); };

    async function tick() {
      if (!live()) return;
      /** @type {Array<SyncRun | null | undefined>} */
      let latest;
      try {
        latest = await fetch();
      } catch (error) {
        if (!live()) return;
        errors += 1;
        later(errors >= 3 ? backoff : interval);
        return;
      }
      if (!live()) return;
      errors = 0;
      /** @type {SyncRun[]} */
      const finished = [];
      for (const run of latest) {
        if (!run) continue;
        if (isRunning(run)) seen.add(run.id);
        else if (seen.delete(run.id)) finished.push(run);
      }
      const more = latest.some(isRunning);
      if (!more) stopped = true;
      onUpdate(latest, finished);
      if (more) later(interval);
    }

    if (!stopped) later(interval);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }

  /** The app's current route path (app.js), or undefined outside the app. */
  function appRoute() {
    const app = /** @type {any} */ (globalThis).BRAIN;
    return app && app.S.route.path;
  }

  return { readsView, runView, watchRuns };
});
