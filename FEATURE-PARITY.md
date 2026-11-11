# Feature parity: prototype (live working tree, http://localhost:5070/?r=22) vs real app

Base note. The branch started at broth-ui-port, but the integration view (live-view) had silently lost the Account branch's app.js changes (Inbox and Bookmarks routes, rail items, trash and rename effects). This branch therefore merges broth-ui-account, ask, library, agent, setup and admin properly (real merges, conflicts in index.html and app.js resolved, no content dropped) before the sweep. After the merge `npm run check` and the 168 unit tests pass.

Status: identical = same behaviour seen in both; different = present, differs (see notes); MISSING = not in real; needs-backend = real API has no endpoint or field (not faked); n/a = not applicable to a client of a real API.

Method: crawled the prototype (every route, 10 surfaces, click-by-click effects, keyboard) and the real app against a stub /v1 with the same crawler; read the prototype source (app.js, extras.js, inbox.js, library.js, docs.js, agent.js, motion.js, rail.js, focus.js, select.js, gestures.js); diffed 1,100+ prototype copy strings against the real source; cross-read the six COMPLETENESS-*.md tables (about 330 rows from the sibling branches) and re-checked their claims where the crawl could test them.

| # | Feature / control | Prototype | Real app | Status | Notes |
|---|---|---|---|---|---|
| 1 | Icon rail with tooltips, Search, Library, Inbox, Bookmarks, account | rail.js:1-55 | rail.js | identical | Inbox and Bookmarks exist only after the merge fix |
| 2 | Sidebar: New chat, Search with Cmd+K hint | app.js:471 | app.js | identical | crawl: same items |
| 3 | Sidebar history groups Pinned, Today, Yesterday, Previous 7 days, Earlier | app.js:477 | app.js | identical | |
| 4 | Sidebar row menu: Rename, Pin to top, Copy link, Delete chat (second press confirms) | app.js:123-141 | app.js | identical | crawl shows Rename, Unpin, Copy link, Delete chat |
| 5 | Delete: trash can, row sinks | app.js:137-141 | broth-fx.js | identical (after merge) | motion agent owns the timing |
| 6 | Rename: toast and drawn line | app.js:121 | broth-fx.js | identical (after merge) | |
| 7 | Sidebar collapse button and Cmd+\ | app.js:526-530 | app.js | identical | tested: Ctrl+\ toggles body.sbc |
| 8 | "/" opens search, Cmd+K toggles, Escape closes | motion.js:125 | motion.js | identical | tested "/" opens and Escape closes |
| 9 | Palette: Go to pages, recent chats, Ask "text" | motion.js:96-125 | motion.js | identical | real has Ask Broth: text, also Connectors, People, Domains, Audit for admins |
| 10 | Palette: Library group of documents (empty and typed) | motion.js:100-111 | none | MISSING | real searches GET /v1/search for conversations and documents; stub returned none, so not exercised. Empty-state document group not in real |
| 11 | Breadcrumb row with Copy link | app.js:497 | app.js | identical | |
| 12 | Mobile top bar, drawer nav, scrim, new chat button | app.js:532-537 | mobile.css, app.js | identical | 390 px: no horizontal page scroll on 16 routes, dark and light (measured scrollWidth 390) |
| 13 | Ask home: greeting by time of day | app.js:108 | ask.js | identical | |
| 14 | Ask home: example question cards | app.js:175 | ask.js | different | real examples are generic; prototype has Show me the product tour (needs the tour content) |
| 15 | Ask home: Reading from N connected apps | app.js | ask.js | identical | N from facets |
| 16 | Ask home: Broth activity panel (Activity, Answer, Sources, Memory) | app.js:268-290 | ask.js (Answer, Sources) | needs-backend | activity feed, waiting-for-you, Memory need an agent endpoint |
| 17 | Composer: Attach menu (Upload a file, From the Library), file chips, drop | app.js:143-160 | ask.js | different | chips and menu present; files are not sent (API has no file input) |
| 18 | Composer: Dictate with SpeechRecognition and toast | app.js:160 | ask.js | identical | toast text matches |
| 19 | Composer: Enter sends, Shift+Enter newline, autogrow to 160 px | app.js:204 | ask.js | identical | |
| 20 | Sources button with count opens the source filter drawer (source, domain, date, select all) | app.js:150-ff | ask.js | identical | real adds source type, domain and date filters from facets |
| 21 | What-next card (one role-aware onboarding step on home) | extras.js:268-277 | none | needs-backend | steps rate and follow-up need per-turn data on the list endpoint; Pick up where you left off exists on home instead |
| 22 | Conversation head: title click or F2 renames, more menu | app.js:211 | ask.js | identical | tested F2 and click open the inline input |
| 23 | Answer: numbered citations with source cards, drawer on click | app.js | ask.js | identical | |
| 24 | Answer: conflict card with both sides, Recommended tag, Report to owner | app.js | ask.js | identical | wired to the API conflict field |
| 25 | Answer: low confidence reason, access limited, not found | app.js | ask.js | identical | |
| 26 | Answer: Copy, Regenerate | n/a in prototype | ask.js | extra in real | |
| 27 | Answer: Bookmark this answer | app.js | ask.js | identical (browser-only) | key broth-bookmarks |
| 28 | Answer: Helpful, Not helpful with reasons Wrong, Outdated, Incomplete, Could not check | app.js | ask.js | identical | |
| 29 | Answer: Edit question and version switch | app.js:386-407 | none | needs-backend | the API has no edit endpoint |
| 30 | Follow-up suggestion chips | app.js | ask.js | identical | |
| 31 | Answer footnote Broth can be inaccurate | app.js | ask.js | identical | |
| 32 | Chats page: search, rows with time, pin marker, actions | extras.js:283 | extras.js | identical | |
| 33 | Chats empty state | extras.js | extras.js | identical | framed .ds-empty |
| 34 | Bookmarks table, remove, open, empty state | inbox.js:62-80 | bookmarks.js | identical (browser-only) | Status column Current or Changed needs answer change tracking: needs-backend |
| 35 | Inbox chips and rows, Review request, Later snooze, All caught up | inbox.js:36-60 | inbox.js | identical for Requests | Conflict, Gap, Stale, Feedback items need an inbox endpoint: needs-backend |
| 36 | Rail Inbox count badge | app.js:468 | app.js | identical | |
| 37 | Library: Filter chips by source, list and grid, folder open with back, search | library.js | library.js | identical | real filters come from facets |
| 38 | Library: document drawer, Open in source, Details and lineage | library.js, app.js | document-drawer.js | identical | adds Share more widely |
| 39 | Library: owners and last updated in folder rows | library.js | library.js | needs-backend | not in the facets read |
| 40 | Connectors page for everyone (cards Connected, Not connected, Admin only, Soon) | library.js | admin Sources page only | different | non-admins have no page; see port P1 |
| 41 | Connect modal with simulated OAuth consent | library.js:80-110 | admin source setup | n/a | the real flow authorises at the provider |
| 42 | Help center: search, six topic cards, article list, support banner | docs.js | docs.js | identical | articles come from GET /v1/docs |
| 43 | Help center: 31 hardcoded articles, Was this helpful, status line | docs.js | none | needs-backend | content and feedback endpoints |
| 44 | Account: avatar picker, preferred name, Appearance, work-account block | extras.js | extras.js, broth-avatar.js | identical | |
| 45 | Account: Manager row, 2-step verification | extras.js | none | needs-backend | fields missing on /v1/me |
| 46 | Account: Devices table, sign out per row, sign out others | extras.js | extras.js | identical | location, trusted tags need session fields: needs-backend |
| 47 | Account: Download my data, Delete history, Replay onboarding | extras.js | extras.js | identical | built from real endpoints |
| 48 | Account menu groups with Administrator settings | extras.js | extras.js | identical | Workspace and Policies pages: needs-backend |
| 49 | Sign-in, sign-up, first-run welcome, transitions | extras.js | auth.js, setup.js, transitions.js | identical | see COMPLETENESS.md rows |
| 50 | Support agent: tabs Overview, Knowledge, Experience, products, widget | agent.js | agent-*.js | identical | live bots from API; stats charts need analytics: needs-backend |
| 51 | Embed widget | embed.js | embed.js | identical | |
| 52 | Governance and admin screens | inbox.js, extras.js | governance.js, admin.js | identical | 72-row COMPLETENESS-ADMIN.md |
| 53 | Custom select, never native | select.js | select.js | identical | |
| 54 | Focus return on popovers and overlays | focus.js | focus.js | identical | |
| 55 | Reduced motion respected | motion.js | motion.js | identical | |
