# Setup wizard completeness

Scope after the user's change ("set up sources in app, not on the onboarding"): the wizard has three steps
(claim, Google, sign in) and then the app. The source steps moved out to `source-setup.js` (`window.SOURCES`),
for the Sources page (see `SOURCES-HANDOFF.md`). Status: done = restyled and checked in a screenshot or by
computed style; moved = logic kept as a function, presentation kept, no screen in the wizard any more;
n/a = the code has no such thing.

| # | Step / state / control | Current look (base branch) | Target look (prototype language) | Status |
|---|---|---|---|---|
| 1 | Frame: violet picture, checklist card | Plain card, step caption under it | Card with header and one `.ds-table` style row per step, `Done` / `Now` tags, "N of 3" in the header; frame stays put between steps | done |
| 2 | Checklist row finishing | Instant class swap | Row's number becomes a check and its tag arrives once (pop); not on first paint | done |
| 3 | Checklist while loading | Marked as step 1 | Neutral rows, no tags | done |
| 4 | Step dots | Tiny, grey | `.stp` pill, 22 px brand dot for the current step, brand 45% for done; not clickable (the step is derived from the API, the wizard never goes back) | done |
| 5 | Step count text | Only on the picture | Plain "Step N of 3" above the title when the picture is hidden (390 px) | done |
| 6 | Title | h1 plus a subtitle paragraph | h1 with an (i) hint holding the old subtitle (no subtitle under a title) | done |
| 7 | Step swap | Abrupt | Prototype swap: old form fades out in place (170 ms), new one fades in rising 5 px (240 ms), picture untouched; reduced motion: none | done |
| 8 | Claim: Setup code field | Plain input | 40 px, 12 px corners, thin brand ring on focus, hover border | done |
| 9 | Claim: Google account field | Plain input | `.emw` with the user icon, like the prototype's email field | done |
| 10 | Claim: Company + logo square | Base branch row | Prototype `.colog` row (logo square, field), "No logo found" line with Upload yours link and (i) | done |
| 11 | Claim: Continue button, loading | Spinner button | 40 px `.si-btn`, `.busy` spinner, disabled during the call | done |
| 12 | Claim: "Lost the code" note | Muted small text | Same note, muted | done |
| 13 | Claim: empty or malformed field | Red pill text | Design system `.banner.bad` inside the alert, field gets `aria-invalid` until typed in | done |
| 14 | Claim: refusal (wrong code) | Red pill text | `.banner.bad` with the server's title | done |
| 15 | Claim: rate limit (Retry-After) | Text with countdown | Same countdown inside the banner, button disabled until it ends | done |
| 16 | Google: redirect URI copy row | Grey box | "Redirect URI" label, `.sucopy` row (code, copy button with hover and focus ring), toast "Copied" | done |
| 17 | Google: Client ID, Client secret, hint | Plain | Same fields, hint "Stored encrypted..." muted | done |
| 18 | Google: empty field | Red pill | `.banner.bad` and `aria-invalid` on the empty field | done |
| 19 | Google: server refusal | Red pill | `.banner.bad` | done |
| 20 | Sign in: Continue with Google | Button link | 40 px primary link button, busy spinner on click | done |
| 21 | Setup could not load | Title and paragraph | Title with (i) hint and a framed `.ds-empty` card (icon tile, error title, line, Try again) | done |
| 22 | Already claimed (`/setup` after claiming) | Title and button floating | Title with (i) hint and a framed `.ds-empty` card with the button (markup change in auth.js) | done |
| 23 | After sign-in | Step 4 Add the Confluence app | Wizard over: admin goes to Admin, Sources (or `/` when a source already serves); no "setup pending" anywhere | done |
| 24 | Add the Confluence app (client id, secret, callback URL, errors) | Wizard step 4 | Moved to `SOURCES.saveConfluenceCredentials`; fields and copy row styles kept in `broth-setup.css` | moved |
| 25 | Connect Confluence: site field, bad address | Wizard step 5 | `SOURCES.createConnection` (throws the same message) | moved |
| 26 | Authorize site, re-authorise, last error banner | Wizard step 5 | `SOURCES.authorize`; `SETUP.authorize` still points to it (connectors.js uses it) | moved |
| 27 | Pick spaces: list, checkboxes, personal-space naming, Look again, verify failure, include count | Wizard step 6 | `SOURCES.spacesTableHtml` (`.ds-table`, 18 px brand checkboxes, "Personal" tag, "N of M" header), `refreshSpaces`, `includeSpaces`, `pickedSpaces`, `countPicked` | moved |
| 28 | Space settings, label problems, connection warnings | n/a | The wizard code never had them (only included + owner) | n/a |
| 29 | First sync: summary, bar, per-space rows (spinner, mini bar, tags, detail, failed reason), polling, "continue in background" | Wizard step 7 | `SOURCES.readsHtml`, `readRow`, `paintReads` (bars glide, no replay), `watchReads` | moved |
| 30 | Done screen: pages in library, spaces table, "N pages couldn't be read" | Wizard done | `SOURCES.readTableHtml`, `failingHtml` | moved |
| 31 | Sync run rows on Connectors | sync.js | `sync.js` untouched (copy and ellipsis kept); only shared CSS (`.tag`, `.bar`) | done |
| 32 | Sources empty state | n/a | `SOURCES.emptyHtml()`: "Connect your first source" and one button | moved |
