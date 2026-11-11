# Completeness: prototype vs real, for shell, nav, sign-in, first run, docs, wizard frame, motion, tokens

Status key: done = in the real app with real data or no data needed. browser-only = kept in this browser (localStorage), marked as such. needs-backend = skipped because it would fake server data; the endpoint wanted is named. open = not done in this pass.

| Prototype element or behaviour | Prototype file | In real? | Action | Status |
|---|---|---|---|---|
| Icon rail, items, squircles, tooltips, menu button | rail.js, components.css | yes | ported and metric-matched | done |
| Rail Inbox item and unread count | app.js | no | no inbox in the API | needs-backend: GET /v1/inbox (items and open count) |
| Rail Bookmarks item | app.js | no | the account branch adds /bookmarks, a browser-only feature | open (slot kept; merge from that branch) |
| Rail Search, Library, Governance, Admin, Docs | app.js | yes | real destinations kept | done |
| Account menu: Account settings, Admin settings, Support agent, Help center, Sign out | extras.js | yes | all present with role gating | done |
| Account menu theme item | extras.js | no | theme is in Account settings, as in the prototype's final menu | done |
| Chats shell, Search pill, history groups, pin and more menus, empty text | app.js, components.css | yes | real API data | done |
| Sidebar collapse state and shortcut | app.js | yes | | done |
| Crumb row | components.css | partly | hidden on ask home and Docs, kept elsewhere for Copy link | done |
| Mobile top bar, drawer, scrim | mobile.css | yes | existing real mobile shell | done |
| Palette: pages, recent chats, search, ask | motion.js | yes | real API search; pages extended | done |
| Keyboard: Cmd or Ctrl plus K, slash, Escape, arrows in menus | motion.js, extras.js | yes | | done |
| Haptics on menu and theme actions | app.js | yes | existing `B.haptic` | done |
| Home view: top-right Broth agent button and panel (activity, sources, memory) | app.js, extras.js | no | belongs to the ask agent's screen | needs-backend: agent activity and memory endpoints |
| Sign-in: picture frame, Broth with the dashboard card, wordmark, Google, passkey Coming soon, email, Create a workspace | extras.js | yes | static card; email adds login_hint | done |
| Sign-in: "Reading from 2 apps" count | extras.js | static text | count came from demo data | needs-backend: connected apps count before sign-in (public endpoint) |
| Sign-in: personalising greeting from the typed email | extras.js | yes | local part only, never stored | done |
| Sign-in: demo directory and "We could not find you" lookup | extras.js | no | Google supplies real users | needs-backend: email lookup (not wanted) |
| Sign-up (2 steps) and company logo lookup | extras.js | wizard claim step | Company row and logo square added to the claim step, kept in this browser; lookup on via t3.gstatic.com | browser-only |
| Sign-up step dots | extras.js | yes | dots exist on the wizard, not clickable | done |
| Wizard picture frame | extras.js | yes | checklist card inside the violet frame | done |
| First run: Is this you, Ask your first question | extras.js | yes | real profile; examples are generic static text; nickname saved through PATCH /me | done |
| First run: What Broth can read, How should it look | extras.js | removed | removed by the user | done |
| Sign-in to app transition and sign-out reverse | extras.js | yes | prototype springs and timings | done |
| Transition: Broth flight to the agent avatar | extras.js | no | real app has no agent avatar | open |
| Docs: search, six topic cards with picture and article count | docs.js | yes | topics map to real audiences; counts are real | done |
| Docs: article list beside the article | docs.js | yes | real articles and slugs | done |
| Docs: support banner ("Still stuck?") with Ask Broth | docs.js | yes | Ask Broth sends a real question | done |
| Docs: Email support button | docs.js | hidden | address was invented in the prototype | needs-backend: a support address setting (SUPPORT_EMAIL in docs.js) |
| Docs: status line "All systems normal" | docs.js | no | would fake server data | needs-backend: a public status endpoint |
| Docs: prototype's 31 hardcoded how-to articles | docs.js | no | real articles come from the server | needs-backend: more articles from GET /v1/docs |
| Docs: image FLIP from card to list, topic stagger, article swap fade | docs.js | no | real docs are routed pages | open |
| Docs: "Was this helpful" buttons | docs.js | no | no feedback endpoint | needs-backend: POST docs feedback |
| Toasts, empty and error states | app.js | yes | existing real blocks | done |
| Theme: dark by default, Appearance setting | extras.js | yes | unset means dark | done |
| Focus management: heading focus after screen change, menu focus return | app.js, extras.js | yes | | done |
| Radius and button tokens | tokens.css, styles.css | yes | copied; global | done |
| Motion guards (`__entering`, `.si-in` excluded) | motion.js, life.js | yes | copied | done |

Counts: 37 rows. done 26, browser-only 1, needs-backend 8, open 3.

Needs-backend list: GET /v1/inbox; agent activity and memory endpoints; connected apps count for the sign-in picture; support address setting; public status endpoint; more articles from GET /v1/docs; docs feedback POST; (email lookup is not wanted).
