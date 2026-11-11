# Motion parity: Broth prototype vs the real client

Prototype = the user's live working tree at `/Users/fubara/enterprise-brain` (served on :5070, checked byte for byte
against the files read). Real = branch `broth-ui-motion`, cut from `broth-ui-port`.
Status: PORTED (this branch), PRESENT (already identical), NEW (the prototype has none, designed here),
ABSENT (the prototype effect belongs to a feature the real app does not have), OTHER BRANCH (built on another worktree, not on this base).

## Ported or added on this branch

| # | Effect | Trigger | Prototype | Real | Status |
|---|---|---|---|---|---|
| 1 | Delete chat: row sinks into a pop-up trash can, can wobbles, row collapses, can leaves, then the chat is removed | Delete chat in the chat menu, sidebar rows and Chats rows (`.surf,.chr,.lrow`) | app.js:139-141, components.css:671 | `trashFx` in app.js, `.trashfx` in components.css. Runs beside the DELETE call; a failed call puts the row back | PORTED |
| 2 | Rename: title fades in, a brand line draws under it once | Rename saved | app.js:121 | `renamedFx` in app.js | PORTED |
| 3 | Icon hover gestures (spin, wiggle, ring, bounce, nudge, fly...), 56 rules | hover on buttons, rows, tabs, cards | components.css:117-176 | restored in components.css (a later commit had dropped every rule but one) | PORTED |
| 4 | Route change: new page eases in | every route | motion.js `enter`, SEL list | `pageIn` in motion.js on every view change; view key now includes the path, so folders, articles, admin tabs and chat to chat count | PORTED |
| 5 | Route change: old page eases out | every route | none (cuts) | NEW: `pageGhost` in app.js copies the page area only, fades it 140 ms ease-in under the new page; shell never touched | NEW |
| 6 | Skeleton to content fades | data arrives | none | NEW: motion.js treats nodes that replace a skeleton as entrances | NEW |
| 7 | Help center: topic picture flies from its card into the article list, list and body rise in behind | click a topic card | docs.js:112-117 | docs.js `enter` | PORTED |
| 8 | Help center: another article fades in alone | pick an article | docs.js:104 | docs.js `enter(swap)` | PORTED |
| 9 | Help center: back fades the page out, the cards rise one by one | Help center link | docs.js:95, 146 | docs.js back handler and `drawCards` | PORTED |
| 10 | Modal exit | Escape, Close, any `B.closeModal()` | none (cut) | NEW: reverse of the enter, see below | NEW |
| 11 | Modal backdrop fades in on desktop | open | none | motion.js (phones already had it in CSS) | NEW |
| 12 | Command palette exit | Esc, close, backdrop, run | none | NEW motion.js | NEW |
| 13 | Chat actions menu exit | any close | none | NEW app.js `leaveFx` | NEW |
| 14 | Profile menu exit (desktop pop, phone sheet slides down) | any close | none | NEW auth.js | NEW |
| 15 | Select menu exit | choose, Escape, outside | none | NEW select.js | NEW |
| 16 | Citation hover card exit | pointer leaves | none | NEW motion.js | NEW |

Exit design: the enter played backwards. Desktop card to opacity 0, scale .94, 24 px down, 200 ms; backdrop 200 ms;
phone sheet slides to 100% in 240 ms (the swipe-dismiss duration), cubic-bezier(.4,0,1,1), reduced motion skips it.
`.on` stays until the exit ends, so focus returns to the opener afterwards, `#modal.on` stays true meanwhile, and a reopen in
the middle cancels the exit and replays the enter. The prototype has no modal exit; this one is designed, not copied.

## Already present and identical

Modal enter spring, drawer child stagger, toast spring, sliding tab and sidebar indicators, press and lift feel, count-ups,
cxpill sources tab slide, sidebar collapse button pop, chat menu enter, sign-in dive and return, wordmark, rail tooltip,
docs card hover, reduced-motion rules. Drawer, scrim, toast and rail tooltip already exit through CSS transitions
(measured `transition: .22s all ease`), so they were not changed.

## Not ported, and why

| Effect | Why |
|---|---|
| Next-step card, How I answered popover, answer version switch, edit-your-question, memory forget, attached file chip remove | the features do not exist in the real app (no API) |
| Bookmark remove, Inbox Later, approve, decline slide-out, sharing request flash, Inbox rail badge | no bookmarks or Inbox in this base |
| People remove and invite cancel, Sources sync pulse, admin count-ups, sparklines, card stagger, audit live ticker | admin pages are being rebuilt on `broth-ui-admin` (it has `adLife`); not touched here |
| Library OAuth overlay | the real app uses a real OAuth round trip |
| Library list and grid toggle, in-page filters | no route change, they re-render in place; only skeleton swaps fade |
| Overlap | `broth-ui-account` (and `live-view`) carry their own trash can in `broth-fx.js` and `.trashfx` in `broth-account.css`. The two will collide on merge: keep one |

Totals: 16 effects ported or added (9 copied from the prototype, 7 new because the prototype cuts), 8 groups present, 7 groups not ported with a reason.
