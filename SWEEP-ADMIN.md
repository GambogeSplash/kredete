# Rule-by-rule sweep: Admin, Governance, Sources

Method: Playwright against the prototype's working tree (`/Users/fubara/enterprise-brain`, branch `broth-port`, uncommitted edits included)
and the real app (local stub API with sample data, `broth-ui-admin`). Scripts are in the session scratchpad
(`sweep.mjs`, `states.mjs`, `cmp.mjs`, `pix.mjs`, `motion.mjs`).

## 1. CSS rules (every rule that touches these screens)

`sweep.mjs` reads every `CSSStyleRule` of both pages (including `@media`, `:hover`, `:focus-visible`, `:active`, dark overrides)
whose selector names a class used by these screens.

| | count |
|---|---|
| Prototype rules in scope | 577 |
| Identical in the real app (selector and declarations) | 435 |
| Differ | 16 |
| Absent in the real app | 126 |

* Absent, 118 of 126: rules for screens that are not part of this area (Inbox `.ix*`, Policies `.swt`/`.adpc`/`.adpol`/`.audspark`,
  devices `.addv*`, Library `.libt`, sign-in `.adlogo.sm`, the prototype's dark-mode `filter: invert`). Explained: no such screen here, or the
  real app has its own dark theme.
* Absent and fixed: `.addom` (button reset), the field focus ring on `.eminp`, `.lrail-h` text transform. Added to `broth-admin.css`.
* Differ and fixed: primary button gradient and its hover (scoped to these screens), `.lrail .tab.out:hover` colour.
* Differ and explained (7): `.modal-wrap` z-index 60 (real app stacks dialogs above popovers), `.audt` `overflow: clip` and `.aud-h` sticky
  (sticky header requested), `.aud-r` phone columns `1fr auto`, `.audf2` margin, `.lcont-t` hidden off-screen instead of `display:none` (keeps the page heading for screen readers),
  `.lrail-g` colour (global token), unused `.audf`/`button.adlogo`.
* Global rules left to the owners of `styles.css`: `.btn.primary` gradient values and `.tag` radius selector list.

## 2. Elements, geometry and computed style (`cmp.mjs`, 1440 x 900)

Same element in both apps, width, height, position inside the content area, font, size, weight, line height, letter spacing, colours,
border, radius, shadow, padding, gap, display. Pages: left menu, Workspace, People, Audit, Domains, Sources, Sharing requests.
After the fixes every remaining difference is text or data: names and counts, the real app having no Policies item, no title and team line,
no Export position change (the Filter button sits right of where the prototype's does because Export CSV was added beside it), initial avatars instead of photos.

## 3. States with real pointer and keyboard (`states.mjs`)

29 checks: hover and keyboard focus on rows, row actions (after the row is hovered), chips, search field, Invite, Filter, view toggle,
Add a source card, source cards and their buttons, request cards and their buttons, Copy chip, menu items, Sign out.
25 identical. 4 differ and are intentional: keyboard focus on chips, the view toggle and the Add card draws a 2 px brand outline in the real app;
the prototype draws none (user rule: every interactive thing needs a focus state).

## 4. Motion (`motion.mjs`, every animation paused and scrubbed at 0, 33, 66, 100, 150, 200, 300, 400, 500, 700 ms)

People rows, clearance bars, request cards, source cards: duration, delay, easing, fill and keyframes identical;
opacity error 0.0000, transform error 0.0000. Domain cards identical in timing.

## 5. Behaviours (prototype click and key paths against the real app)

Checked in the stub: search types and filters; chips switch lists and replay the entrance; Invite opens under its button, Esc closes, outside press closes,
focus returns; email validation shows inline and clears on typing; row Edit appears on hover and on focus; pending Cancel asks to confirm;
Filter badge counts, Clear resets, Show results applies; Export CSV downloads; view toggle swaps grid and list without a reload of data;
Add a source opens the dialog, the empty state button opens it too; Sync now on a card triggers the connection's own sync; Manage scrolls to it;
Approve and Reject keep the real confirm step. Not run here: anything that needs the real API (invite, OAuth, sync), see COMPLETENESS-ADMIN.md.

## Fixes made by the sweep

1. `.addom` button reset (cards that are buttons).
2. Field focus ring as in the prototype.
3. Primary button gradient and hover as in the prototype.
4. Left menu group heading padding and colour.
5. Sign out hover colour.
6. "You cannot approve your own request" and "Closed" on request cards.
7. Google Cloud Storage coming-soon card.
