# Completeness: Account, Chats, Bookmarks, Inbox, Search

Prototype: /Users/fubara/enterprise-brain (branch broth-port). Status values: done (real data), browser-only (kept in this browser, marked), needs-backend (no real endpoint or field), present (already in the real app).

| # | Prototype element or behaviour | Prototype file | In real? | Action | Status |
|---|---|---|---|---|---|
| 1 | Account menu, group "Account settings" (Profile, Sessions) | extras.js | yes | header added | done |
| 2 | Account menu, group "Administrator settings" for admins | extras.js | no | added: Sources, People and access, Sharing requests, Domains, Audit log link to the real /admin and /governance pages | done |
| 3 | Admin items "Workspace" and "Policies" | extras.js | no | no real page | needs-backend: workspace settings and policies pages |
| 4 | Menu "Sign out" | extras.js | yes | kept | present |
| 5 | Avatar with change badge | extras.js | no | added | browser-only |
| 6 | Avatar popup: preview, nine pictures, Upload (square crop), Use the default, Save, Close, toast | extras.js | no | added (`broth-avatar.js`), copied pictures to assets/avatars | browser-only |
| 7 | Default avatar picked from the email, picture for every person | icons.js | no | AVATAR replaced by the prototype logic (demo people jpgs not copied) | done |
| 8 | Name, title (only when set), email header | extras.js | yes | title line only when present | done |
| 9 | Preferred name: Edit, inline input, Save, Cancel, Enter | extras.js | yes | kept, PATCH /v1/me | done |
| 10 | Appearance select (Light, Dark, Match my device), `brain-theme` | extras.js | yes | kept, app Select | done |
| 11 | "From your work account" group with (i) hint | extras.js | yes | Team, Location (row always shown), Roles, plus real Clearance | done |
| 12 | Manager row | extras.js | no | no field on /v1/me | needs-backend: `manager` on GET /v1/me |
| 13 | Sign-in group: "Sign-in, Broth single sign-on, Managed by IT" | extras.js | no | added with the prototype copy | done |
| 14 | 2-step verification row ("Required") | extras.js | no | no field | needs-backend: `mfa` on GET /v1/me |
| 15 | Download my data | extras.js | no | built in the browser from GET /v1/me, /v1/conversations and each conversation | done |
| 16 | Delete my question history, two presses | extras.js | no | DELETE /v1/conversations/{id} for every chat, then reload list | done |
| 17 | Replay onboarding | extras.js | yes | moved into "Your data" | done |
| 18 | Devices title and `.ds-table` | extras.js | yes | kept | done |
| 19 | Device icon by type (phone, desktop, laptop) | extras.js | partial | desktop icon added, 44 px box | done |
| 20 | Device name from user agent, "This device" tag, pulsing "Now" | extras.js | yes | kept | done |
| 21 | First seen, Last active columns | extras.js | yes | from created_at and last_used_at | done |
| 22 | Location and masked IP under the device name | extras.js | no | not in SessionOut | needs-backend: `ip_masked`, `location` on GET /v1/me/sessions |
| 23 | Status tag Trusted / New location, Trust / Stop trusting | extras.js | no | not in SessionOut | needs-backend: `trusted`, `new_location`, trust endpoint |
| 24 | Sign out per row with two-press confirm (2.6 s) | extras.js | no | added; fade out 200 ms | done |
| 25 | Sign out of all other devices | extras.js | yes | kept | done |
| 26 | Chats page title and search field | extras.js | yes | kept, GET /v1/search | present |
| 27 | Chat rows: icon, title, time, pin marker, actions button | extras.js | yes | kept | present |
| 28 | Sidebar history groups (Pinned, Today, earlier) | app.js | yes | kept | present |
| 29 | Row menu: Rename, Pin, Copy link, Delete (second press) | app.js | yes | kept | present |
| 30 | Delete motion: trash can, row sinks, collapse | app.js | no | added, scrubbed against the prototype | done |
| 31 | Rename motion: toast, line draws | app.js | no | added, scrubbed against the prototype | done |
| 32 | Empty state "No chats yet" | extras.js | yes | kept | present |
| 33 | Bookmarks table: question and answer, Sources with name tooltip, date, remove | inbox.js | no | added from localStorage | browser-only |
| 34 | Bookmarks Status column (Current / Changed) | inbox.js | no | no change tracking | needs-backend: answer change tracking |
| 35 | Remove button turns red on hover | inbox.js | no | added | browser-only |
| 36 | Row click opens the answer | inbox.js | no | opens the saved conversation (prototype re-asks) | browser-only |
| 37 | Bookmark button on each answer | app.js | no | added next to Copy and Regenerate | browser-only |
| 38 | Bookmarks empty state with icon | inbox.js | no | added, without the change claim | done |
| 39 | Title hint "Saved in this browser only." | n/a | no | added | done |
| 40 | Inbox page, chips, rows, empty state "All caught up" | inbox.js | no | added (`inbox.js`) | done |
| 41 | Inbox "Request" items | inbox.js | partial | from GET /v1/promotions (pending, needs review, can decide) | done |
| 42 | Inbox "Review request" | inbox.js | no | opens /governance | done |
| 43 | Inbox "Later" snooze, slide-out motion | inbox.js | no | week, this browser; motion scrubbed | browser-only |
| 44 | Inbox kinds Conflict, Gap, Stale, Feedback with their actions | inbox.js | no | no endpoint | needs-backend: inbox feed with conflicts, gaps, stale sources, feedback |
| 45 | Inbox repository requests | inbox.js | no | not included | needs-backend: `can_decide` on GET /v1/public-declarations |
| 46 | Rail and sidebar Inbox item with count badge | app.js | no | added | done |
| 47 | Rail and sidebar "Bookmarks" item | app.js | no | added | done |
| 48 | Search overlay (command palette), conversations and documents | motion.js | yes | not changed here (shared file) | present, not compared |
| 49 | Sidebar Search button with the command key hint | app.js | yes | kept | present |

Counts: 49 rows. Done 26, present 8 (rows 4, 26 to 29, 32, 48, 49), browser-only 7 (rows 5, 6, 33, 35, 36, 37, 43), needs-backend 8 (rows 3, 12, 14, 22, 23, 34, 44, 45).

## Inbox as a personal feed (update)

Real, from GET /v1/promotions: "Waiting on you" (open requests you can decide, not your own), "Your requests" (open, approved, declined, revoked, with who approved), "You approved" (requests you approved). Grouped Today and Earlier, unread dot, Later (a week) and Dismiss kept in this browser, rail count of unread items only, "See all requests" goes to Governance, Review request opens the shared modal.

Needs backend, not faked: Conflict items (GET /v1/conflicts or an inbox feed with sources that disagree), Gap items (unanswered questions, for example GET /v1/questions/unanswered), Stale items (documents you own that are overdue for review: GET /v1/documents with owner and review_due filters, and a verify action), Feedback items (answers marked wrong), Decisions you declined (promotions carry approved_by but no decided_by), requester names for people who are not admins (people list is admin only).
