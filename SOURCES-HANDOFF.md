# Sources handoff (for the Admin agent, branch broth-ui-admin)

The setup wizard now stops after the first admin signs in (claim, Google client, sign in). Connecting a
source moved to Admin, Sources (`/admin/connectors`). The wizard's logic is kept, unchanged in behaviour, in
`source-setup.js`, loaded before `setup.js`, exposed as `window.SOURCES`. Branch: `broth-ui-setup` (worktree
/Users/fubara/kredete-wt/setup). Merge `source-setup.js`, its `<script>` line in `index.html` (before
`setup.js`) and `broth-setup.css` (the `.su*`, `.susp`, `.suspaces`, `.surun*`, `.susum`, `.sumsg`, `.sustat`,
`.suempty` rows/bars/tags; `.ds-table`, `.ds-tr`, `.tag`, `.bar` are the design system's).

## Exports (`window.SOURCES`)

State and API (all derived from the API, nothing stored in the browser):

| Function | API call | Notes |
|---|---|---|
| `progress()` | GET `/admin/credentials`, GET `/admin/connections`, GET `/admin/containers?connection_id=` | Returns `{step}`: `confluence` (no OAuth client), `connect` (no authorised site; `connection` may be set, with `last_error`: re-authorise), `spaces` (none included), `sync` (first reads running), `done`. Also `connection`, `containers`, `credentials`. |
| `saveConfluenceCredentials(client_id, client_secret)` | PUT `/admin/credentials/confluence_oauth` | Secret is stored encrypted, never shown again. Callback URL to show: `${location.origin}/v1/admin/connections/oauth/callback`. |
| `cleanSite(input)` | none | Returns the clean host or null. |
| `createConnection(input)` | POST `/admin/connections` `{system:'confluence', site}` | Returns the connection id. Throws `{title: 'Enter the site address, like yourteam.atlassian.net'}` for a bad address. |
| `authorize(id)` | POST `/admin/connections/{id}/oauth/start`, then `location.assign(authorization_url)` | Also the re-authorise path. `SETUP.authorize` still exists and calls this (connectors.js uses it). |
| `listSpaces(connection)` | GET `/admin/containers?connection_id=` | |
| `refreshSpaces(connection)` | POST `/admin/connections/{id}/verify`, then GET containers | "Look again". Throws when Confluence cannot be reached: keep showing the known spaces and say `Couldn't check Confluence for new spaces: ${error.detail || B.problem(error)}`. |
| `includeSpaces(ids)` | PATCH `/admin/containers/{id}` `{included:true, owner_user_id: me}` per id | Each include starts that space's first read. |
| `spaceName(c)`, `isPersonal(c)` | none | Personal spaces read "Name (personal space)" (via `BRAIN.containerName`); unticked by default. |
| `failingCount(containers)` | none | Pages a read gave up on that no later run has read. |

Presentation (return HTML strings; no page of their own):

| Function | Use |
|---|---|
| `spacesTableHtml(containers, tickedMap?)` | The space picker as a `.ds-table` with a checkbox per row (`input[data-space]`, aria-label `Include {name}`). |
| `pickedSpaces(root?)`, `countPicked(root?)` | Ticked container ids; updates the "N of M" header (`#suptot`) and returns N. Button label used by the wizard: `Include N space(s)` / `Pick at least one space` (disabled at 0). |
| `readsHtml(containers)` | Summary card (one line, one bar, role=progressbar "Pages read") plus a `ul[aria-label=Spaces]` table, a row per included space (tag, spinner, mini bar, failed reason on its own line). Render inside an element with `role="status"`. |
| `readRow(c)`, `readTableHtml(containers)` | One row / the finished table ("Spaces read"). |
| `failingHtml(containers)` | `N pages couldn't be read; see Sources.` notice, or ''. |
| `paintReads(box, html, shown)` | Puts reads markup in a box; bars glide from their last width; returns `html` (pass it back as `shown` to skip unchanged redraws). |
| `watchReads(state, onUpdate)` | `state = {connection, containers}`. Re-reads the spaces every 2 s while any run is running (`SYNC.watchRuns`); returns the stopper. Call it again on a route change; the Sources page should stop it when it leaves. |
| `emptyHtml()` | The calm empty state: title "Connect your first source" and one button `#susrc` ("Connect Confluence"). Wire the button to the first missing step (saved client, site, authorise). |

Sync run copy stays in `sync.js` (`SYNC.runView`, `SYNC.readsView`, `SYNC.firstReadsRunning`, `SYNC.watchRuns`); the status copy uses the ellipsis character on purpose.

## States the Sources page must cover

1. No OAuth client saved (`progress().step === 'confluence'`): Client ID and Secret fields, Callback URL copy row.
2. No site (`connect`, `connection` null): Site field, `createConnection`, then `authorize`.
3. Site not authorised (`connect`, `connection` set): "Authorize {site}" button; show `connection.last_error` as a bad banner; wrong site is removed in Sources.
4. Returning from Atlassian lands on `/admin/connectors?connected=...` or `?error=...` (connectors.js `readReturn`, unchanged). `BRAIN.setupPending()` is now always false for an admin, so it no longer redirects to `/setup`.
5. Spaces (`spaces`): picker, "Look again", verify failure message above, include button.
6. First reads (`sync`): reads card and table, polling, then done.
7. Done: spaces table, `failingHtml`.

## What changed outside the Sources page

- Wizard steps are `claim, google, signin`. After sign-in `SETUP.progress()` returns `{step:'done'}` and `/setup` redirects the admin to `/admin/connectors` (or `/` when a source is already serving). Nothing in the app treats a missing Confluence connection as "setup pending".
- Non-admins are unaffected. Old e2e scenarios for the wizard's connect, spaces, sync and done screens were removed from `tests/e2e/wizard.spec.mjs`; port them to the Sources page (the old specs are in branch broth-ui-port, tests/e2e/wizard.spec.mjs).
