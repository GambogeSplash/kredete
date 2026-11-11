# Routes: the address follows the label on the page

The router is `ROUTES` in app.js. Old addresses are listed in `MOVED`: `route()` rewrites them in place with `history.replaceState` (no history entry), keeping the query string and the hash untouched, because the Google, Atlassian and GitHub returns land on them with `?code=&state=&installation_id=` and we cannot change those.

| Page and rail label | Route pattern now | Old address (kept as a redirect) | Notes |
|---|---|---|---|
| New chat | `/` and `/c/<id>` | none | |
| Chats | `/chats` | none | |
| Bookmarks | `/bookmarks` | none | |
| Library | `/library` and `/library/<domain>` | none | folders are domains, label matches |
| Sources (everyone, read only) | `/sources` | `/connectors` | for admins the router lands on `/admin/sources` |
| Governance | `/governance` | `/inbox`, `/account/inbox`, `/admin/sharing-requests` | the Admin menu entry "Sharing requests" still points here |
| Account, Sessions | `/account`, `/account/sessions` | none | |
| Admin: Workspace | `/admin` (shows `/admin/workspace`) | none | |
| Admin: Sources | `/admin/sources` and `/admin/sources/<confluence, docs-repositories, google-drive>` | `/admin/connectors` and `/admin/connectors/<x>` | OAuth returns `?connected=` land here |
| Admin: People and access | `/admin/people` | none | label and address agree closely enough; not renamed |
| Admin: Domains | `/admin/domains` | none | |
| Admin: Audit log | `/admin/audit` | none | "Audit log" versus `audit`: judged a short form, not a real mismatch; not renamed |
| Support agent | `/support-agent`, `/support-agent/<bot>/<overview, knowledge, experience, products>` | `/agent` and `/agent/<bot>/<page>` | |
| Help center | `/help` and `/help/<slug>` | `/docs` and `/docs/<slug>` | the API still serves the articles at `GET /v1/docs`; only the page address changed |
| Setup wizard | `/setup` | none | lands on `/admin/sources` afterwards |
| Sign in | `/signin` | none | |

Where the address is built or compared (all updated): the router patterns and `MOVED` (app.js), rail and sidebar `data-go` (app.js), the account menu (auth.js), the Admin menu (extras.js), docs links, cards and back links (docs.js), the Help center action buttons (help-content.js), Library's admin redirect (library.js), the setup landing path (setup.js), Support agent links and navigation (agent.js).

Not changed: `vercel.json`. Its SPA fallback `/((?!v1/)[^.]*)` sends every path without a dot, and not starting with `v1/`, to `/index.html`, so `/help`, `/sources`, `/support-agent` and their sub paths are covered, and the old ones too. No sitemap or robots file exists. `embed.js` and `embed-demo.html` build no docs or agent addresses.

Not touched, owned by the Admin agent: source-setup.js (one `href="/admin/connectors..."`, which redirects) and connectors.js, domains.js, people.js and admin.js internals.
