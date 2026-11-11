# Opening a document in the Library: prototype vs real

Measured at 1440 and 390, dark and light, on the real app (API stub) and the prototype's working tree. Numbers come from `getBoundingClientRect`, `getComputedStyle`, attributes and keyboard runs, not from looking.

Entry points opened: a folder row, a search result row, a row in a source section (root), Ask citation (`openDocument(id, { citation })`), Governance "Open document" (`openDocument(id)`), and the failed read (404) inside the shell.

| # | Whole-screen item | Prototype | Real, before | Real, now | Cause in code and status |
|---|---|---|---|---|---|
| 1 | Rail: active item | Library | Library | same | same |
| 2 | Sidebar on Library | none (nochats) | none | same | same |
| 3 | Top bar title on a phone | "Library" | the folder name ("Design") | "Library" | `library.js` set `S.route.title` to the folder name. Fixed: the folder name stays in the banner only. |
| 4 | Page title (`document.title`) | Broth | Broth | same | same |
| 5 | Back control | chevron in the folder banner | same | same | same |
| 6 | URL while open | none (no router) | `/library/<folder>`, document is a drawer | same | The prototype has no routes. Real keeps the folder in the URL, the document stays a drawer in both. |
| 7 | Browser back while open | leaves the app | goes to `/library`, drawer closed | same | Real is better here; nothing to change. |
| 8 | Shell frame | role dialog, aria-modal, label "Details panel", `.top` and `.mainpanel` inert, scrim hidden | same | same | same (`extras.js` wiring) |
| 9 | Geometry at 1440 | drawer 400 wide, right 8, page margin 416 | same | same | same |
| 10 | Focus on open | X button | X button | same | same (class vs id only) |
| 11 | Tab order | X, Open in, Details | X, Open in (a link), Share, Details... | X, Open in (a link), Details | Open in is a real external link in the real app. |
| 12 | Esc | closes, focus returns to the row | same | same | same (`focus.js`) |
| 13 | Header: source logo and name | yes | yes | same | same |
| 14 | Title | h2 | h2 | same | same |
| 15 | Team label with member avatars | name plus avatar stack | name only | same | **Needs backend:** domain members. |
| 16 | Tags | team, warning if not approved | team, warning, plus "Everyone at Broth" scope | same | The scope tag is real access information; kept. |
| 17 | Excerpt block | yes | no | no | **Needs backend:** a document excerpt on `GET /v1/documents/{id}`. A cited quote from Ask still shows. |
| 18 | Owner card | photo, name, role, Verified date | initials, name, role or "Owner", Verified date | same | Photo and role are data; the API gives name and title only. Date format follows the browser locale. |
| 19 | Domain, Location, Kind block | none | present | present | Real only: domain folders and the Location filter are real functions. |
| 20 | Footer actions | Open in X, Details and lineage | Open in X, Share more widely, Details and lineage (wrapped, 92 px tall) | Open in X, Details and lineage (54.5 px, same as the prototype) | Share more widely moved into the Details dialog. Footer rect now equal. |
| 21 | Details and lineage | dialog for everyone: tags, Owner, Last verified, Sensitivity, Access, External use, lineage, version history | admin and compliance only, lineage list only | everyone: tags, the same five facts, lineage, Share more widely, Open in X | Fixed in `document-drawer.js` (`detailsModal`). The lineage list is read by admins and compliance only (the audit API is theirs); everyone else sees one line saying so. |
| 22 | Version history | table | none | none | **Needs backend:** a versions endpoint. |
| 23 | Copy link, Ask about this | not in the prototype | none | none | Not in the prototype, not added. |
| 24 | Open in source | stand-in dialog | real link, new tab | same | Real. |
| 25 | Loading inside the shell | none | skeleton | same | Real only. |
| 26 | Failed or 404 inside the shell | none | framed card, but the source name stayed a skeleton | framed card, header says "Document" | Fixed: the name placeholder no longer waits for an answer that is not coming. |
| 27 | Opened from Governance or an Ask citation | sheet, not the shell (shell only in the Library) | same | same: x 1020, w 420, `dsopen` false; the citation quote shows | same rule as the prototype |
| 28 | Opened from Library rows, search, source sections, folder | shell | shell | shell: x 1032, w 400, `dsopen` true in all four runs | same |
| 29 | 390 px | full-width sheet | same | x 0, w 390 | same |
| 30 | Footer primary button width | 214.8 | 217.3 | 217.3 | The real button has the external-link icon. |
| 31 | Corner radius on buttons | 8 vs 6 | token | token | the 12/18 radius tokens are not in the base branch yet |

## Numbers after the fix (document open, folder list)

Compared element by element, 1440 and 390, dark and light: 4 remaining mismatches at 1440 and 5 at 390, all explained: tags row 26 vs 22 px (the member avatars, row 15), owner card y (no excerpt, row 17), primary button 2.5 px wider (icon, row 30), its radius (tokens), and at 390 the page behind is 844 vs 792 px tall because the prototype's own phone shell differs. Before the fix the footer was 92 px tall against 54.5 px.

## Needs backend

1. Domain members for the avatar stack.
2. A document excerpt.
3. Document versions.
4. Owner photo and role beyond the name and title the API returns.
