# Admin, Governance and Sources: what the prototype has, what the real app has

Spec: `/Users/fubara/enterprise-brain` (branch `broth-port`), `P.*` in `extras.js` and `components.css`.
Real code: `admin.js`, `workspace.js`, `people.js`, `domains.js`, `connectors.js`, `governance.js`, `broth-admin.css`.

Status words: **done** (in the real app, real data), **browser-only** (works in the browser, no endpoint needed, says so),
**explained** (real app differs on purpose, reason given), **needs backend** (no endpoint exists; not faked).

| # | Prototype element or behaviour | Prototype file | In real app? | Action | Status |
|---|---|---|---|---|---|
| **Left menu** | | | | | |
| 1 | Groups "Account settings" (Profile, Sessions) and "Administrator settings", group headings, separator | extras.js account | yes | `railHtml` in admin.js, also on Governance | done |
| 2 | Items Workspace, People and access, Sources, Sharing requests, Domains, Audit log | extras.js | yes | same, real routes (`/admin/workspace` is new) | done |
| 3 | Policies item | extras.js | no | no page to open | needs backend |
| 4 | Sign out at the foot, danger hover | extras.js | yes | `data-out` calls `BRAIN.signOut` | done |
| 5 | Compliance sees only Audit (real rule) | n/a | yes | kept; menu lists only what the role may open | done |
| 6 | Phones: tabs scroll sideways, headings hidden | mobile.css | yes | `broth-admin.css` | done |
| **Page chrome** | | | | | |
| 7 | Title row, actions on the right | extras.js | yes | `.ds-head` + `#adact` | done |
| 8 | (i) hint instead of a subtitle (user rule; the prototype has none on these pages) | styles.css | yes | `hint()` | done |
| **Workspace** | | | | | |
| 9 | Hero card with logo square, name, radial glow | P.Workspace | yes | initial of the sign-in domain | done |
| 10 | Copy-address chip, "Copied" for 1.4 s | P.Workspace | yes | address is `location.host` | done |
| 11 | Chips: SSO, region, retention | P.Workspace | partly | "Google sign-in" and "Sandbox" are real; region and retention are not | done / needs backend (region, retention) |
| 12 | Edit name (Save, Cancel, Enter, Esc) | P.Workspace | no | | needs backend: `PATCH /v1/admin/workspace {name}` |
| 13 | Logo upload, 4 MB limit, square crop, remove | P.Workspace | no | | needs backend: `PUT /v1/admin/workspace/logo` |
| 14 | Settings rows: Plan, Single sign-on, Data region, Chat retention (+ Manage/Change toasts) | P.Workspace | partly | rows for Sign-in, Sources, People, Domains with real counts and Manage links | done; plan, region, retention need backend: `GET/PATCH /v1/admin/workspace` |
| **People and access** | | | | | |
| 15 | Search box (rounded, 260 px), live filter | P.People | yes | server `q`, 220 ms debounce | done |
| 16 | Role chips Everyone / Admins / Owners / Compliance | P.People | yes | filter the loaded page by role | done (client side over the loaded page) |
| 17 | Extra real chips: Invitations, Confluence accounts | n/a | yes | kept, in the prototype's chip style | done |
| 18 | Invite people panel with several emails in one box | P.People | partly | popover (`.ds-pop`) with one email, roles, clearance and inline validation; one invitation per call | explained: the API creates one invitation per request |
| 19 | Pending rows: ghost avatar, "Invited 2 days ago", Pending tag | P.People | yes | open invitations show under the people on "Everyone" | done |
| 20 | Pending row Cancel | P.People | yes | `DELETE /admin/invitations/{id}` with Confirm step | done |
| 21 | Pending row Resend ("Sent") | P.People | no | | needs backend: `POST /v1/admin/invitations/{id}/resend` |
| 22 | Person row: avatar, name, email line, role tags, clearance bars + name, hover actions | P.People | yes | `.adrow` markup and CSS copied | done |
| 23 | Subtitle "Title · Team" and photo avatars | P.People | no | email and initials instead | needs backend: `title`, `team`, `avatar_url` on `/admin/users` |
| 24 | "9 h ago" / "Active now" column | P.People | no | column holds the Suspended tag | needs backend: `last_seen_at` on `/admin/users` |
| 25 | Remove (Confirm remove, row slides out) | P.People | partly | Edit opens roles, clearance, Suspend and Reactivate (real behaviour kept) | explained |
| 26 | Empty state "No one matches" | P.People | yes | `.ixempty` | done |
| 27 | Loading skeleton, error with Try again | n/a | yes | kept | done |
| 28 | Stat cards (`stat()` is defined, never drawn) | P.People | n/a | not rendered by the prototype | n/a |
| **Domains** | | | | | |
| 29 | List / grid toggle (icons, aria-pressed), Add domain button | P.Domains | yes | `.seg`; list is the default because domains are a tree | done |
| 30 | "Add a domain" tile (grid) and row (list) | P.Domains | yes | opens the New domain dialog | done |
| 31 | Card: letter tile, name, sub line, status tag | P.Domains | yes | letter tile (no favicon fetch, CSP), pages count, "No owner" tag | done |
| 32 | List columns Domain / Status / Members / New people join as | P.Domains | partly | Domain / Label / Owners / Pages, with the real tree indent | explained: real domains are page subjects, not email domains |
| 33 | Add dialog: single field, validation messages, disabled until typed | P.Domains | yes | dialog with name, label, parent; messages inline | done |
| 34 | Verify dialog: TXT record, Copy, 3 steps, Verify / Try again | P.Domains | no | | needs backend: email-domain verification, `POST /v1/admin/email-domains`, `POST .../verify` |
| 35 | Members count, "New people join as" role chips, seats meter | P.Domains | no | | needs backend: same email-domain endpoints |
| 36 | Remove domain (Confirm: N lose sign-in) | P.Domains | no | | needs backend: `DELETE /v1/admin/domains/{id}` |
| 37 | Real: label copy, owners, parent move, owners inherited | n/a | yes | kept; Edit dialog holds the Copy label button | done |
| **Audit log** | | | | | |
| 38 | Columns Timestamp / Event / Actor / Resource / Outcome, tinted header | P.Audit | yes | `.audt` / `.aud-r` copied; header sticky | done |
| 39 | Event icon tile per type | P.Audit | yes | icon by action family | done |
| 40 | Actor with avatar, "System" muted | P.Audit | yes | | done |
| 41 | Outcome tags (ok, warn, neutral) | P.Audit | yes | green for ok and answered, red for denied or failed | done |
| 42 | Filter button with count badge, popover: Action, From, To, Clear, Show results | P.Audit | yes | `.ds-pop`, closes on outside press and Esc | done |
| 43 | Filter by Type chips (Answers, Access, Sources, Policies) | P.Audit | no | Action select covers it | needs backend: group filter on `/admin/audit` |
| 44 | Export CSV | P.Audit | yes | builds a CSV of the loaded events | browser-only (loaded events only) |
| 45 | Show more with "12 of 46" | P.Audit | partly | Show more; no total | needs backend: `total` on `/admin/audit` |
| 46 | New events slide in live (every 14 s) | P.Audit | no | | needs backend: audit stream |
| **Sources** | | | | | |
| 47 | Add a source tile and dialog | P.Sources | yes | dialog opens from the tile and from the first-source button | done |
| 48 | Source cards: logo, name, owner line, Sync now, Manage | P.Sources | yes | one card per real connection (site, health tag); Sync now runs the connection's own sync; Manage scrolls to its section | done |
| 49 | "Synced 8:02" line, spinner, green ring when done | P.Sources | partly | the connection section shows the real run status and progress | explained |
| 50 | Coming soon cards (Soon tag, dimmed) | P.Sources | yes | Google Cloud Storage, Slack, SharePoint, Notion | done |
| 51 | Notify me on a coming-soon source | P.Sources | no | | needs backend: `POST /v1/interest {source}` |
| 52 | Real: Confluence connect, authorize, re-authorize, disconnect | n/a | yes | kept, local `authorize`, OAuth return lands on Sources | done |
| 53 | Real: Atlassian app and GitHub App credentials | n/a | yes | "Add the app first" rows in the dialog open the credential forms | done |
| 54 | Real: pick spaces, include, owner, space settings, label problems, warnings, personal space names | n/a | yes | kept | done |
| 55 | Real: sync runs, failed pages, run summary | n/a | yes | kept (`sync.js`) | done |
| 56 | Real: Google Drive checklist, Docs repositories, Request public | n/a | yes | kept | done |
| 57 | First-time empty state "Connect your first source" | n/a | yes | one button; per-source sections wait | done |
| **Sharing requests** (Governance) | | | | | |
| 58 | Status chips with counts | P.Sharing | partly | chips; no counts | needs backend: counts per status |
| 59 | Request card: source icon, title, status tag, "Wants to share with", "Leaves the company" tag, requester, when, note | P.Sharing | yes | `.adrq` markup and CSS copied; shield icon (no source system on a request) | done |
| 60 | Approve, Reject, Revoke, "You cannot approve your own request", "Closed" | P.Sharing | yes | real can-decide rules, real endpoints | done |
| 61 | Docs repository requests | n/a | yes | kept, same card | done |
| 62 | Empty state | P.Sharing | yes | `.ixempty` | done |
| **Policies** | | | | | |
| 63 | Six toggles with effect notes | P.Policies | no | not built: a switch that changes nothing would mislead | needs backend: `GET/PUT /v1/admin/policies` |
| **Motion** | | | | | |
| 64 | Cards and rows rise 10 px and fade, 360 ms, 34 ms apart (first 12) | adLife | yes | `ADMIN.life` | done, measured identical |
| 65 | Clearance bars grow from 20 percent, 420 ms, 28 ms apart | adLife | yes | same | done, measured identical |
| 66 | Count-ups and fill bars | adLife | n/a | no admin page draws them | n/a |
| 67 | Popover spring-in, 140 ms | components.css | yes | same keyframes | done |
| 68 | Hover reveal of row actions, card lift | components.css | yes | rules copied | done |
| 69 | Reduced motion respected | adLife | yes | | done |
| **Popups and toasts** | | | | | |
| 70 | Invite, Filter, New domain, Add a source, Edit person, Edit domain, Space settings | | yes | popovers for Invite and Filter, dialogs for the rest | done |
| 71 | Toasts: Saved, Label copied, Invited, Revoked, Exported N events | | yes | `BRAIN.toast` | done |
| 72 | Focus returns to the control when a popover closes | n/a | yes | | done |

Counts: **72 rows**. done 50 (one of them with a needs-backend part, row 14), browser-only 1, explained 4, n/a 2, needs backend 15 (nine endpoint groups, listed below).

## Needs backend (endpoint wanted)

1. `PATCH /v1/admin/workspace` name, `PUT /v1/admin/workspace/logo`, plan, data region, retention (`GET /v1/admin/workspace`)
2. `POST /v1/admin/invitations/{id}/resend`
3. `/v1/admin/users`: `title`, `team`, `avatar_url`, `last_seen_at`
4. Email domains: `GET/POST/DELETE /v1/admin/email-domains`, `POST .../{id}/verify`, member counts, default role, seats
5. `DELETE /v1/admin/domains/{id}`
6. `/v1/admin/audit`: `total` count, group filter, a live stream
7. `POST /v1/interest {source}` (Notify me)
8. `/v1/promotions`: counts per status, source system of a document
9. `GET/PUT /v1/admin/policies`
