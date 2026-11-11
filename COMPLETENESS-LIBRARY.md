# Library completeness against the prototype

Spec: `/Users/fubara/enterprise-brain` (branch `broth-port`), `library.js` plus the Library rules in `styles.css`, `components.css`, `life.js` and `openSource` in `app.js`.
Real: `library.js`, `library-browse.js`, `domain-tree.js`, `document-drawer.js`, `broth-library.css`.

Status words: done = present and measured against the prototype; browser-only = lives in this browser, no endpoint involved; needs-backend = the prototype shows it, the API has no field or endpoint for it.

| # | Prototype element or behaviour | Prototype file | In real? | Action | Status |
|---|---|---|---|---|---|
| 1 | Page title "Library" | library.js | yes | kept | done |
| 2 | Search box (icon, placeholder "Search the library") | library.js | yes, and the placeholder names the folder | kept, real search is server side (`q`) | done |
| 3 | Search matches title, path, owner, team | library.js | yes, by the API | none | done |
| 4 | Search empty state "Nothing matches" | library.js | yes | copy kept (real copy also says clear a filter) | done |
| 5 | Filter button and menu by source, count per source | library.js | yes | menu kept (adds Labels for admins) | done |
| 6 | Filter button shows the chosen source name | library.js | no | label now shows the source name | done |
| 7 | List/grid toggle (`.seg`) | library.js | yes | restyled | done |
| 8 | View choice remembered | library.js (state) | no | saved in `brain-libview` in this browser; added to the storage keep list in `app.js` (a display preference like `brain-sbc`) | browser-only |
| 9 | Root list grouped by source: a table per source with a caption row (icon, name, count) | library.js | no | root now groups loaded pages by source (`bySystem`), caption row per source | done |
| 10 | Folders sit inside their source's table | library.js | no | real folders are domains and span sources, so they get their own first table captioned "Folders" | done (adapted) |
| 11 | Source count in the caption | library.js | no | shows the pages loaded so far for that source (paging is 40) | done (count follows paging) |
| 12 | Search results grouped by source when no source filter | library.js | no | same grouping at the top level when there is a query and no source filter | done |
| 13 | Search with a source filter is one flat table | library.js | yes | flat | done |
| 14 | List table: header row Name, Team, Type, Owner, Updated, chevron | library.js | no | table with the same columns and proportions; "Team" is "Domain" | done |
| 15 | Row: source icon 22, title, path, team dot, type icon and name, owner avatar, date, chevron | library.js | no | same cells from real fields | done |
| 16 | Row click opens the document | library.js | yes | kept | done |
| 17 | Enter opens a row | library.js | yes | Enter and Space | done |
| 18 | Row hover and focus | (none in prototype) | no | background hover, focus ring (UI rule) | done (deliberate extra) |
| 19 | Folder row: folder drawing in its colour, name, count, "Folder" type | library.js | no | same drawing and columns | done |
| 20 | Folder row owners stack and newest date | library.js | no | cells left empty | needs-backend: folder owners and last-updated in `/v1/facets` domains (`DomainOut` has owners but is not the facets read) |
| 21 | Folder row "Team" dash | library.js | no | blank (no dashes in copy) | done |
| 22 | Folder click opens the folder (state in memory) | library.js | yes | URL based (`/library/<slug>`), back and forward work | done |
| 23 | Folder banner `.fhead`: back chevron, folder drawing 44, name, "N items in App" | library.js | no | banner with back chevron, folder drawing, name, "N pages" | done |
| 24 | Back chevron goes up one level | library.js | no | goes to the parent folder, or the Library at the top; label "Back to X" | done |
| 25 | Per-folder table, flat, no caption | library.js | no | flat table, child folders first | done |
| 26 | Grid view: group bars (`.lgrp`) per source | library.js | no | `.lgrp` bars for Folders and each source | done |
| 27 | Grid: page cards (tinted preview, source icon, kind chip, title, path, owner/team, date) | library.js | yes | footer shows the domain, as the prototype shows the team | done |
| 28 | Grid: rich folder card (back, sheets, frosted flap, count, hover lift and tilt) | library.js | no | `fcard` markup and the prototype's glass rules | done |
| 29 | Folder card subtitle "N owners, Updated date" | library.js | no | shows "N pages" | needs-backend: same as row 20 |
| 30 | Folder card app badge | library.js | no | folder icon (a folder has no source) | done (adapted) |
| 31 | Empty state "Nothing here yet / Connect an app" | library.js | yes | real copy is role aware | done |
| 32 | Loading state | library.js (none) | yes | skeleton rows inside the table, same height as rows | done |
| 33 | Error state with retry | (none) | yes | real error block kept | done |
| 34 | Pagination "Show more" and scroll load | (none) | yes | kept | done |
| 35 | Label problems filter, chips, "Clear all" | (none) | yes | kept (real feature) | done |
| 36 | Locked items hidden by permission | library.js (`canSee`) | yes | the API returns only what the person can open | done |
| 37 | Entrance: search box, banner, cards rise 12 px, 0.4 s, stagger 28 ms (`life.js`) | life.js | yes | same elements are in life.js's list; table rows are not, as in the prototype | done |
| 38 | Folder open: cards `fpop` 0.42 s, 32 ms stagger; search box and banner stay still | styles.css | no | `.fin` on folder open, `data-lf` on the stable parts | done |
| 39 | Toggle: page rebuild with the search box entrance | library.js | yes | same | done |
| 40 | Document opens in a right-docked shell, page makes room, no scrim | app.js | no | `.shell` and `body.dsopen`, 0.34 s, removed after 320 ms | done |
| 41 | Shell closes with the X, Escape | app.js | yes | kept | done |
| 42 | Drawer top: source icon and name, close | app.js | yes | kept | done |
| 43 | Drawer title | app.js | yes | kept | done |
| 44 | Drawer team label and member avatar stack | app.js | no | domain name shown | needs-backend: domain members on a document or `/v1/domains/{id}` members for non-admins |
| 45 | Drawer authority warning tag only when not approved | app.js | partly | "Approved" tag removed; scope and sensitivity tags kept (real access info) | done |
| 46 | Drawer excerpt block (`sv-q`) | app.js | no | shown for a cited quote (Ask) | needs-backend: document excerpt or text on `GET /v1/documents/{id}` |
| 47 | Drawer owner card (avatar, name, role, Verified date) | app.js | yes | kept | done |
| 48 | Drawer "Open in source" primary button | app.js | yes | opens the real source in a new tab | done |
| 49 | Drawer "Details and lineage" | app.js | yes | admins and compliance, label matches | done |
| 50 | Share more widely, Location link, domain breadcrumb, review due, label problems | (none) | yes | real features kept | done |
| 51 | Phone: shell becomes the existing sheet | app.js | yes | media query | done |
| 52 | Phone: table keeps Name and chevron | components.css | yes | same breakpoint rule | done |
| 53 | Phone: group bars rounded larger | mobile.css | yes | rule copied | done |
| 54 | Toasts in the Library | (none) | n/a | the prototype has none here | n/a |
| 55 | Row context menu or actions | (none) | n/a | the prototype has none | n/a |
| 56 | Sort control | (none) | n/a | the prototype has none; the API orders results | n/a |
| 57 | Reduced motion | styles.css | yes | entrance and shell transition off | done |
| 58 | Dark and light | components.css | yes | checked in both | done |

## Counts

Rows: 58. Done: 50 (rows 10, 30 adapted to real data). Browser-only: 1. Needs-backend: 4 (rows 20, 29, 44, 46). Not applicable: 3.

## Needs-backend list

1. Folder owners and newest-updated date on each folder in `GET /v1/facets` domains (rows 20, 29).
2. Domain members for the drawer's team stack (row 44).
3. A short excerpt or text snippet on `GET /v1/documents/{id}` for the drawer block (row 46).
4. Per-source page counts for the root (row 11): `GET /v1/facets` systems counts all pages, not only the ones at the root.

## Measured against the prototype

Same data names, 1440x900 and 390x844, device scale factor 1, dark and light. See the report for the numbers.
