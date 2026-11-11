# Rule by rule sweep: Account, Chats, Bookmarks, Inbox

Method. The prototype (/Users/fubara/enterprise-brain working tree) was loaded next to the real app (local stub, same seeded user, 1440x900 dark and light, 390x844 dark). Every CSS rule in the prototype whose selector names one of about 80 classes of these surfaces was extracted from its live stylesheets (media queries evaluated at the viewport). For each distinct selector and state (plain, hover, focus, focus-visible, focus-within, active, ::before/::after) the declared properties were read with getComputedStyle in both apps (states forced through the DevTools protocol, transitions off for state reads) and compared. Scenarios: profile, profile with the name edit open, avatar popup, sessions, sessions with the sign out armed, chats, chat actions menu, bookmarks, inbox. About 283 selector states per scenario at 1440 and 290 at 390.

Scripts (not in the repo): scratchpad `sweep.mjs`, `analyze.py`, `behave.mjs`, `scrub.mjs`.

## Numbers

| Run | Differing property reads before | After fixes |
|---|---|---|
| 1440 dark, 9 scenarios | 883 | 297 |
| unique property differences, 1440 dark | 137 | 35 |
| 1440 light, 9 scenarios | 860 (before the radius scale) | 272 |
| 390 dark, 5 scenarios | 380 | 127 |

Rows (distinct rule groups that differed at any point): 169. Fixed: 118. Explained by a real-app constraint or data difference: 51.

## Fixed

- Radius scale: the prototype's tokens are 8, 12, 18, 24, 28 (real: 6, 8, 12, 16, 20). Scoped to `.lset`, `.pg`, `.modal-wrap`, `.cmenu`, `#surfaces`, `.trashfx` in `broth-account.css`. Fixes buttons, tags, fields, tabs, cards, tables, menus, popups, the avatar picker, hint tooltips, the Inbox rows and icon tiles.
- Account menu header colour and padding; tab radius; Sign out hover colour (danger, not danger strong).
- Hint tooltip radius and text ("Managed by IT. Ask IT to change these.").
- Sidebar chat history: group label padding 12 px, transparent background (it showed a light band in dark), actions button 22 px.
- Devices: table full width, row height, device icon box 44 px and 32% radius, "Now" colour and size, title offset, no row hover fill (the prototype has none), Devices heading removed on request.
- Bookmarks: row padding, `libt` and `ixpg` classes, focus outline 2 px brand inset, no row hover fill, remove button 28 px, tooltip as the prototype (opacity and transform in 0.12 s).
- Profile: avatar block height 94 px, title line only when set, Location row always, "Your data" group, Delete history stays armed (the prototype never reverts it).
- Dark menu and modal shadow as the prototype; name field focus colour and ring as the prototype.
- Phone: sidebar group label colour, account title margin.
- New: empty states in one framed `.ds-empty` card (Bookmarks, Inbox, Chats empty, Chats no match, sidebar chat list), (i) hints on every page title and section heading, Review request popup.

## Explained, not changed

- Rows and columns the real data does not have: Manager, 2-step verification, device location and masked IP, Trusted and New location tags, Trust and Stop trusting, Bookmarks Status, Inbox kinds other than Request. This shifts column positions and row counts.
- Shell (rail, sidebar width, rail avatar size and squircle 32%) belongs to the shell branch.
- 390 only: the real `mobile.css` keeps chat rows on one line and hides page titles (the top bar names the screen), so the prototype's wrapped row actions and the in-page titles with their (i) do not show on a phone. Devices and Bookmarks use two columns on a phone.
- Inbox tag and icon colours differ because the real list shows only Request items (blue), the prototype also shows Conflict items (amber).
- The name field is focused when Edit is pressed in the real app (brand border), unfocused in the prototype's preloaded state.
- Admin menu items Workspace and Policies have no real page.

## Behaviour checklist

Prototype behaviours exercised in both apps (`behave.mjs`, not re-run after the last edits): Edit opens a focused field with Save and Cancel; Appearance lists Light, Dark, Match my device; avatar badge opens the picker, Escape closes it, Save toasts "Avatar updated"; Sign out arms to "Confirm sign out" and reverts after 2.6 s; Delete history arms to "Confirm delete"; chat search; chat menu Delete arms; bookmark remove goes red on hover and toasts; Inbox Later toasts "Snoozed for a week". The Review request popup (Escape, outside click, focus return, approve, toast, slide-out, badge) was run at 1440 and 390.
