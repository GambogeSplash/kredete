# Wiring report

Scope: every network call in the client, read against `types.d.ts` (generated from the backend openapi, the contract). The backend is not on this machine, so nothing here was exercised against it; "wired" means the client calls a path, method, body and enum that exist in the contract and reads only fields the contract defines. Responses were checked by reading code, not by running it.

## Totals

| Item | Count |
|---|---|
| Calls inspected (two readers, rows below) | 115 (3 more were in the orphan inbox.js, now deleted) |
| Path and method exist in types.d.ts | 111 of 111 in-contract callers; automatic cross check of 105 literal call sites found 0 missing paths or methods |
| MATCH (body keys, enums, query params, response fields) | 108 |
| MISMATCH | 3, all minor, see below; 2 real bugs found elsewhere and fixed |
| NOT IN CONTRACT | 4, all in embed.js (the public bot widget API under `/v1/bot`) |
| Contract operations the client never calls | 11, see below |
| Browser-only features kept, labelled | 8 |
| Removed | Notify me (nothing received it), inbox.js (orphan) |

## Mismatches and bugs

- `source-setup.js:67` and `connectors.js:432`: the oauth start and github install responses are typed `unknown` in the contract; the client reads `authorization_url` and `install_url`. Works if the backend returns those, but the contract does not promise them. Backend: add a response model.
- `auth.js:177`: filters `r !== 'employee'` but `Role` has no `employee`. Harmless, left.
- Fixed: `extras.js` "Sign out of all other devices" called `.filter` on a single element and threw after the DELETEs had succeeded.
- Fixed: `governance.js` told a repository request from a promotion by `container_path`, which is optional; now `container_id`.
- Not verifiable from the contract: stream error codes and `TurnOut.error` values (free strings), `AskFilters.domains` slug versus id, `ConnectionOut.warnings` keys (untyped map).

## NOT IN CONTRACT

`embed.js` calls `${api}/v1/bot` (GET), `/v1/bot/conversations` (POST), `/v1/bot/conversations/{id}/turns` (POST, SSE) and `/v1/bot/turns/{id}/feedback` (PUT). The widget runs on other people's sites and is given its API base explicitly; the repo's e2e notes say it talks to a separate public service. These paths are not in types.d.ts and not behind the `/v1/*` rewrite in vercel.json. Needs the backend owner to confirm; cannot be verified here.

## Contract operations the client does not call

GET /v1/admin/bots/{bot_id}, GET /v1/admin/policies, GET /v1/admin/principal-aliases, PUT and DELETE /v1/admin/principal-aliases/{token} (the account links screen uses /v1/admin/account-links instead), GET /v1/admin/sync-runs/{run_id}, the two connection callbacks (browser redirects), GET /v1/auth/google/start and /callback (full page navigations), GET /v1/docs and /v1/docs/{slug} (called through a helper, counted as used).

## Browser-only features (not wired, kept, labelled in the UI or code)

| Feature | Where | Stored | Honest label | Backend endpoint it would need |
|---|---|---|---|---|
| Bookmarks | bookmarks.js | localStorage `broth-bookmarks` | page says "Kept on this device only", toast says "on this device" | `GET/PUT/DELETE /v1/me/bookmarks` (turn id) |
| Avatar | broth-avatar.js | localStorage per user id | picker says "kept on this device only" | `PUT /v1/me/avatar` plus avatar url on user objects |
| Company name and logo at setup | logo.js, setup.js | localStorage | comment only; field has no label saying so | `company_name`, logo on `POST /v1/setup/claim` and a workspace settings endpoint |
| Logo lookup | logo.js | none | sends a guessed company domain and the email domain to t3.gstatic.com (Google) | none; consider removing for privacy |
| Welcome tour done flag | auth.js | now `me.onboarding.welcomed` via PATCH /v1/me, localStorage kept as fallback | n/a | confirm key name with backend |
| Attached files and voice dictation chips | ask.js | memory | toast says files stay on this device | file upload endpoint |
| Library list or grid, sidebar collapsed, theme | library.js, app.js, auth.js | localStorage | display preferences, no label needed | none |
| Workspace name and logo | workspace.js | none | derived from the email domain; plan, region, retention not shown | `GET/PATCH /v1/admin/workspace` |

Not found: Later and Dismiss, recent searches, `?demo=1`, a data.js with sample companies, or hard-coded people or companies in shipped code (searched for Tunde, Northwind, acme, Ada Okafor). Static content that is not data: onboarding first-question suggestions, example question chips, the source catalogue in connectors.js (Notion, GCS, Slack, SharePoint show "Coming soon." with no button), and help-content.js articles (merged with `/v1/docs`).

## Security and ops checks

- vercel.json against origin/integration: no difference. Against origin/main: the `/v1` rewrite destination (main still has `tunnel.invalid`), the dark-theme script sha256, `img-src` adds `https://t3.gstatic.com`, and the `/embed-demo.html` rule that widens connect-src for that page only (already on integration). `connect-src 'self'` on the app is unchanged.
- Inline script hashes in index.html match the two hashes in the CSP (verified by `tools/check.mjs` and by hand).
- No `.env`, secrets or tokens in the diff; no `console.log` in shipped code (only two `console.warn` in embed.js); no inline handlers, `eval` or `new Function`; no external script, style or font hosts beyond Google Fonts already allowed.
- Every file referenced by index.html, embed-demo.html and design-system.html exists; every root JS and CSS file is referenced. Orphan removed: inbox.js. broth-fx.js was already gone.
- `npm run check` clean (types.d.ts drift check skipped: the openapi file is not here). Unit tests 168 of 168.
- design-system.html is a public page in the deployment (it is not linked from the app).

## Round trips (by reading code against the contract)

| Flow | Status |
|---|---|
| Sign in (navigation to /v1/auth/google/start), refresh, session expiry to sign-in, sign out | wired |
| First-run welcome: PATCH /me nickname, onboarding.welcomed | wired; key name `welcomed` is a client choice, confirm with backend |
| Setup wizard: status, claim, google credentials | wired (company field is browser-only) |
| Ask: create conversation, streamed turn, regenerate, feedback, report, rename, pin, delete | wired; share link copies the page URL, no server share object |
| Ask: bookmark | browser-only |
| Search and palette: /v1/search, /v1/documents | wired |
| Library: facets, documents list, document read, audit by document, promotion request | wired |
| Governance: promotions and public declarations list, approve, reject, revoke, request | wired |
| Admin people: list, invite, revoke invite, roles, clearance, suspend, account links | wired |
| Domains: CRUD, owners via role assignment | wired |
| Connectors: connections, containers, verify, sync, notices, failures, credentials, github install, public declaration | wired (oauth and install responses untyped) |
| Audit log with export | wired (export is built in the browser from the loaded page) |
| Docs: /v1/docs and /v1/docs/{slug} | wired |
| Support agent: bots, sources, products, replace key, revoke | wired; widget `/v1/bot` not in contract |
| Account: profile nickname, sessions list and revoke, data download and history delete (built from conversation calls) | wired; avatar browser-only |

## Appendix A: calls, audit A (app, auth, setup, ask, library, governance, docs)

Stream events (ask/regenerate) are typed in api.js (turn.started{turn_id}, status{stage,searched_documents}, answer.delta{text}, turn.completed=AnswerOut, error{code,message,retryable}); types.d.ts only says text/event-stream. Code reads exactly those fields.
bookmarks.js and library-browse.js make no network calls (localStorage / query builder only). inbox.js is ORPHAN (not in index.html; also staged as deleted in this worktree, read from HEAD).

| file:line | METHOD | path | request body / query keys sent | response fields the UI reads | schema | verdict |
|---|---|---|---|---|---|---|
| app.js:396 (also setup.js:29) | GET | /setup/status | none | needs_setup, google_configured, setup_session | SetupStatus | MATCH |
| app.js:405 (api.js:287) | POST | /auth/refresh | none | access_token | AccessTokenResponse | MATCH |
| app.js:420 | GET | /me | none | id, name, nickname, email, team, title, location, clearance, roles (Role[]) | Me | MATCH for the call. See note N1: auth.js:177 filters `r !== 'employee'`, a value not in Role |
| app.js:425 | GET | /facets | none | systems[].value/count, domains[].id/parent_id/label/value/count/total, label_problems | Facets | MATCH |
| app.js:446 (api.js:455) | POST | /auth/logout | none | none | (204) | MATCH |
| app.js:466 | GET | /conversations | query limit, cursor | items[].id/title/pinned/created_at/updated_at, next_cursor | Page_ConversationOut_ | MATCH |
| app.js:524 | PATCH | /conversations/{id} | title | id, title, pinned, updated_at | ConversationPatch / ConversationOut | MATCH |
| app.js:529 | PATCH | /conversations/{id} | pinned | id, title, pinned, updated_at | ConversationPatch / ConversationOut | MATCH |
| app.js:577 | DELETE | /conversations/{id} | none | none | (204) | MATCH |
| auth.js:192 | PATCH | /me | nickname (string or null) | whole Me replaces S.me (name, nickname, roles, email, team, title) | MePatch / Me | MATCH |
| setup.js:29 | GET | /setup/status | none (auth:false) | needs_setup, setup_session, google_configured | SetupStatus | MATCH |
| setup.js:157 | POST | /setup/claim | code, email (auth:false) | none (204; 400/409/429 handled as errors) | ClaimRequest | MATCH |
| setup.js:173 | PUT | /setup/credentials/google_oauth | client_id, client_secret (auth:false) | none (204) | CredentialsIn | MATCH |
| ask.js:150 | POST | /conversations | {} | id, title, pinned, created_at, updated_at (spread into S.conv, touchChat) | ConversationIn / ConversationOut | MATCH |
| ask.js:167 | POST (stream) | /conversations/{id}/turns | question; optional filters{systems[] (facet value, SourceSystem), domains[] (facet value used as slug), verified_within_days (90/365), exclude_document_ids[] (max 100)} | events: turn.started.turn_id, status.stage/searched_documents, answer.delta.text, turn.completed = AnswerOut: kind, text, citations[].n/document_id/system/title/quote/authority/owner.name/last_verified_at, access_limited, low_confidence_reason, follow_ups, conflict.summary/sides[].n/value, not_found.suggested_owner.name/team; error.code/message/retryable | AskIn / AskFilters / AnswerOut | MATCH (note N2: domains value is facet `value`, schema does not say slug vs id) |
| ask.js:174 | GET | /conversations/{id} | none | title, updated_at, pinned, created_at | ConversationDetail | MATCH |
| ask.js:196 | POST (stream) | /turns/{id}/regenerate | none | same events as above | (no body) / AnswerOut | MATCH |
| ask.js:197 | POST (stream) | /conversations/{id}/turns | question, filters as ask.js:167 | same events | AskIn | MATCH |
| ask.js:639 | POST | /turns/{id}/reports | {} (note omitted, optional) | none (ReportOut.id unused) | ReportIn / ReportOut | MATCH |
| ask.js:652 | PUT | /turns/{id}/feedback | vote ('up'/'down'), reason only when set ('wrong','outdated','incomplete','could_not_check') | none (204) | FeedbackIn | MATCH (all enum values valid) |
| ask.js:725 | GET | /documents | query q, limit, cursor | items[].id/title/system/path, next_cursor | Page_DocumentOut_ | MATCH |
| ask.js:841 | GET | /conversations/{id} | none | title, pinned, created_at, updated_at, turns[].id/question/created_at/answer/feedback.vote/reason/reported/status('failed','streaming','completed')/error | ConversationDetail / TurnOut | MATCH (note N3: TurnOut.error compared to 'cancelled' and mapped from 'model_unavailable','answer_refused','internal'; schema is free string, cannot verify) |
| document-drawer.js:50 (also governance.js:201, inbox.js:113) | GET | /documents/{id} | none | system, title, domain.name/slug/path[].name/slug, authority, scope (public/internal/granular), sensitivity, label_warnings, owner.name/title, last_verified_at, path, kind, review_due_at, url, id | DocumentOut | MATCH |
| document-drawer.js:98 | POST | /documents/{id}/promotions | to_scope ('internal' only if scope granular, else 'public'), reason (string or null) | none used | PromotionIn / PromotionOut | MATCH |
| document-drawer.js:121 | GET | /admin/audit | query document_id, limit | items[].action/ts/channel/outcome, next_cursor | Page_AuditOut_ | MATCH (action strings 'answer.served', 'promotion.*' are free text in schema) |
| library.js:213 | GET | /documents | query from LB.request: domain, direct, no_domain, q, system, path, container_id, label_problems; plus limit, cursor | items[].id/system/path/title/kind/authority/review_due_at/owner.name/last_verified_at/domain.name/slug, next_cursor | Page_DocumentOut_ | MATCH (every query name exists; system values come from facets) |
| extras.js:38 | GET | /search | query q | conversations[].id/title/pinned/updated_at | SearchOut | MATCH |
| extras.js:131 | PATCH | /me | nickname (string or null) | whole Me | MePatch / Me | MATCH |
| extras.js:160 (allPages) | GET | /conversations | limit 100, cursor | items[], next_cursor | Page_ConversationOut_ | MATCH |
| extras.js:161 | GET | /conversations/{id} | none | title, created_at, turns[].question | ConversationDetail | MATCH |
| extras.js:179 (allPages) | GET | /conversations | limit 100, cursor | items[].id, next_cursor | Page_ConversationOut_ | MATCH |
| extras.js:180 | DELETE | /conversations/{id} | none | none | (204) | MATCH |
| extras.js:196 | GET | /me/sessions | none | items[].id/current/user_agent/created_at/last_used_at | Page_SessionOut_ | MATCH |
| extras.js:213 | DELETE | /me/sessions/{id} | none | none | (204) | MATCH |
| extras.js:223 | DELETE | /me/sessions/{id} | none | none | (204) | MATCH for the call. See note N4: a runtime bug two lines later |
| motion.js:117 | GET | /search | query q | conversations[].id/title/pinned/updated_at, documents[].id/title/system/path | SearchOut | MATCH |
| motion.js:124 | GET | /documents | query limit 8 | items[].id/title/system/path | Page_DocumentOut_ | MATCH |
| govbadge.js:15 | GET | /promotions | query limit 50 | items[].status ('pending','needs_review'), can_decide, requested_by | Page_PromotionOut_ | MATCH |
| governance.js:56 | GET | /promotions | query status (''->omitted, else pending/needs_review/approved/rejected/revoked), limit 30, cursor | items[].id/document_id/document_title/status/to_scope/requested_by/created_at/reason/can_decide, next_cursor | Page_PromotionOut_ | MATCH |
| governance.js:57 | GET | /public-declarations | query status only when not needs_review (pending/approved/rejected/revoked) | items[].id/container_path/status/requested_by/created_at/reason/can_decide | Page_DeclarationOut_ | MATCH (operation takes only `status`; client sends no limit/cursor) |
| governance.js:136 | POST | /public-declarations/{id}/{approve,reject,revoke} | {} | id, status, approved_by, decided_at, can_decide | DeclarationDecisionIn / DeclarationOut | MATCH |
| governance.js:151 | POST | /promotions/{id}/{approve,reject,revoke} | {} | id, status, approved_by, can_decide | DecisionIn / PromotionOut | MATCH |
| governance.js:201 | GET | /documents/{id} | none | system, domain.path[].name, path | DocumentOut | MATCH |
| governance.js:210 | POST | /public-declarations/{id}/{act} or /promotions/{id}/{act} | {} | id, status, approved_by, decided_at, can_decide | DecisionIn / DeclarationDecisionIn | MATCH (see note N5 on how repo vs promotion is told apart) |
| docs.js:152 (get at :97, auth:false) | GET | /docs | none | items[].slug/title/summary/audiences | DocsIndexOut / ArticleSummaryOut | MATCH |
| docs.js:160 | GET | /docs/{slug} | none | html, title, slug, audiences, sections[].level/anchor/title | ArticleOut | MATCH |
| docs.js:216 | GET | /docs/{slug} | none | title, audiences, sections[], html | ArticleOut | MATCH (audience labels askers/authors/admins/compliance match the enum) |
| inbox.js:37 ORPHAN | GET | /promotions | query limit 50 | items[].id/status/can_decide/requested_by/approved_by/decided_at/created_at/document_id/document_title/to_scope/reason | Page_PromotionOut_ | MATCH (ORPHAN) |
| inbox.js:113 ORPHAN | GET | /documents/{id} | none | system, path, scope | DocumentOut | MATCH (ORPHAN) |
| inbox.js:123 ORPHAN | POST | /promotions/{id}/{approve,reject} | {} | none | DecisionIn / PromotionOut | MATCH (ORPHAN) |

## Notes and mismatches

- MISMATCH (minor) N1, auth.js:177: `(me.roles || []).filter((r) => r !== 'employee')`. `Role` is "admin" | "compliance" | "domain_owner" | "developer"; 'employee' never occurs. Fix: drop the filter. extras.js:115 has a matching 'Employee' fallback label for an empty roles list, which is fine (empty array).
- N2, ask.js:81-87: `filters.domains` is sent as the facet `value` (via DOMAIN_TREE `value: d.slug`, and library-browse maps slug = DomainFacet.value). The schema does not say slug or id. Consistent with the Library's `domain` query. No change needed unless the backend says domains wants ids.
- N3, ask.js:55-69, 99: TurnOut.error and stream error.code are free strings in the schema. 'cancelled', 'model_unavailable', 'answer_refused', 'internal' cannot be verified from types.d.ts.
- N4, extras.js:223 (not a contract issue, a runtime bug): `await Promise.all($('.ds-tr[data-id]', el).filter(...).map(fade))` uses `$` (querySelector, one element) where `$$` is needed, so "Sign out of all other devices" throws TypeError after the DELETEs. Fix: `$$('.ds-tr[data-id]', el)`.
- N5, governance.js:~176 reviewPopup: repo request detected by `request.container_path !== undefined && request.document_id === undefined`. `container_path` is optional (`?: string | null`) in DeclarationOut, so a declaration with it omitted would be treated as a promotion. Fix: use `request.container_id !== undefined` (required in DeclarationOut) or `request.document_id === undefined`.
- N6, auth.js:35-42 preview(person): reads `person.first`, which is not on Me. preview() is never called with a person anywhere (only exported as AUTH.preview), so dead code.
- library.js READ_APPS lists notion/gcs/slack/sharepoint, which are not SourceSystem values, but they only ever match facets or display "Soon"; the `data-lib` button is only rendered for facet hits, so no invalid `system` query is sent.


## Appendix B: calls, audit B (admin, people, domains, connectors, agent, embed)

Legend: Page = `{items, next_cursor?}`. "reads" = response fields the UI uses. All enums checked: Role (admin|compliance|domain_owner|developer), invitable roles (admin|compliance|developer), clearance (public|internal|confidential|restricted), UserStatus (active|suspended), SourceSystem (gdrive|confluence|github_docs), ConnectionStatus, Authority (approved|unapproved|draft), SyncRunStatus/Trigger, ProductSide (left|right), BotProductStatus (live|revoked), DeclarationStatus.

| file:line | METHOD | path | body keys sent | response fields read | schema | verdict |
|---|---|---|---|---|---|---|
| admin.js:188 | GET | /admin/users?limit | (query limit) | items[].id,name | Page_AdminUser_ | MATCH |
| admin.js:244 | GET | /admin/audit?action,from,to,limit,cursor | (query) | items[].ts,action,actor,channel,outcome,sources,target_type; next_cursor | Page_AuditOut_ | MATCH (all 5 query params exist) |
| people.js:95 | GET | /admin/domains | - | items[].id,name,parent_id | Page_DomainOut_ | MATCH |
| people.js:118 | GET | /admin/users?q,limit,cursor | (query) | items[].id,name,email,roles[].role/domain_id,clearance,status; next_cursor | Page_AdminUser_ | MATCH |
| people.js:139 | DELETE | /admin/invitations/{id} | - | none (204) | - | MATCH |
| people.js:216 | PUT | /admin/users/{id}/roles | roles[{role,domain_id}] | whole AdminUser stored (id,name,email,roles,clearance,status) | RolesUpdate -> AdminUser | MATCH (role values admin/compliance/developer/domain_owner valid) |
| people.js:218 | PUT | /admin/users/{id}/clearance | clearance | AdminUser | ClearanceUpdate -> AdminUser | MATCH |
| people.js:230 | PUT | /admin/users/{id}/status | status ('suspended'/'active') | status | StatusUpdate -> StatusOut | MATCH |
| people.js:254 | GET | /admin/invitations?limit,cursor | (query) | items[].id,email,roles (string[]),clearance,status ('open'),created_at; next_cursor | Page_InvitationOut_ | MATCH |
| people.js:283 | POST | /admin/invitations | email, roles[], clearance | created.email + whole InvitationOut | InvitationIn -> InvitationOut | MATCH |
| people.js:301 | GET | /admin/account-links | - | linked[].account_id,display_name,user_name,user_email; unlinked[].account_id,display_name,last_seen_at | AccountLinks | MATCH |
| people.js:312 | GET | /admin/users?limit | (query) | items[].status,id,name,email | Page_AdminUser_ | MATCH |
| people.js:328 | PUT | /admin/account-links/{account_id} | user_id | none (204) | LinkIn | MATCH |
| people.js:330 | GET | /admin/account-links | - | as 301 | AccountLinks | MATCH |
| people.js:339 | DELETE | /admin/account-links/{account_id} | - | none (204) | - | MATCH |
| people.js:341 | GET | /admin/account-links | - | as 301 | AccountLinks | MATCH |
| domains.js:60 | GET | /admin/domains | - | items[].id,name,slug,parent_id,document_count,total_count,owners[].name,inherited_owners[].name,user_id,from_domain.name | Page_DomainOut_ | MATCH |
| domains.js:138 | POST | /admin/domains | name, slug, parent_id | created.slug + DomainOut (owners, inherited_owners) | DomainIn -> DomainOut | MATCH |
| domains.js:151 | GET | /admin/users?limit | (query) | items[].status,id,name,roles[].role/domain_id | Page_AdminUser_ | MATCH |
| domains.js:171 | PATCH | /admin/domains/{id} | name and/or parent_id | updated.id | DomainPatch -> DomainOut | MATCH |
| domains.js:179 | PUT | /admin/users/{id}/roles | roles[{role,domain_id}] | none | RolesUpdate | MATCH |
| domains.js:182 | GET | /admin/domains | - | items | Page_DomainOut_ | MATCH |
| workspace.js:26 | GET | /admin/connections | - | items[].status | Page_ConnectionOut_ | MATCH |
| workspace.js:26 | GET | /admin/users?limit | (query) | items.length, next_cursor | Page_AdminUser_ | MATCH |
| workspace.js:26 | GET | /admin/domains | - | items.length | Page_DomainOut_ | MATCH |
| source-setup.js:35 | GET | /admin/credentials | - | items[].name ('confluence_oauth'), configured | CredentialList | MATCH |
| source-setup.js:36 | GET | /admin/connections | - | items[].system,status,authorized | Page_ConnectionOut_ | MATCH |
| source-setup.js:43 | GET | /admin/containers?connection_id | (query) | items[].included,active_run,last_run | Page_ContainerOut_ | MATCH |
| source-setup.js:51 | PUT | /admin/credentials/confluence_oauth | client_id, client_secret | none (204) | CredentialsIn | MATCH |
| source-setup.js:62 | POST | /admin/connections | system:'confluence', site | id | ConnectionIn -> ConnectionOut | MATCH |
| source-setup.js:67 | POST | /admin/connections/{id}/oauth/start | - | `authorization_url` | response is `unknown` (oauth_start op) | MISMATCH (untyped): field `authorization_url` is not in any schema |
| source-setup.js:72 | GET | /admin/containers?connection_id | (query) | items | Page_ContainerOut_ | MATCH |
| source-setup.js:75 | POST | /admin/connections/{id}/verify | - | none read | VerifyOut | MATCH |
| source-setup.js:80 | PATCH | /admin/containers/{id} | included, owner_user_id | none | ContainerPatch -> ContainerOut | MATCH |
| agent.js:45 | GET | /admin/bots | - | items[].id,name,products[].status,allowed_origins,sources | Page_BotOut_ | MATCH |
| agent.js:46 | GET | /admin/containers | - | items[] (path,included,connection_id,public_documents) | Page_ContainerOut_ | MATCH |
| agent.js:47 | GET | /admin/connections | - | items[].id,system,site,status | Page_ConnectionOut_ | MATCH |
| agent.js:178 | POST | /admin/bots | name, contact_url, privacy_url (others default) | whole BotOut (id,name) | BotSettings -> BotOut | MATCH (required name/contact_url/privacy_url all sent) |
| agent-knowledge.js:77 | PUT | /admin/bots/{id}/sources | container_ids | BotOut (sources) | SourcesIn -> BotOut | MATCH |
| agent-experience.js:154 | PATCH | /admin/bots/{id} | subset of name, greeting, starters, contact_label, contact_url, notice, privacy_url, daily_question_limit (number) | BotOut (name, greeting, starters, contact_label, contact_url, notice, privacy_url, daily_question_limit, products) | BotChanges -> BotOut | MATCH |
| agent-products.js:154 | PATCH | /admin/products/{id} | subset of name, allowed_origins, accent, side | ProductOut | ProductChanges -> ProductOut | MATCH |
| agent-products.js:178 | POST | /admin/products/{id}/replace-key | - | ProductOut (key, snippet, ...) | ProductOut | MATCH |
| agent-products.js:182 | POST | /admin/products/{id}/revoke | - | ProductOut | ProductOut | MATCH |
| agent-products.js:214 | POST | /admin/bots/{id}/products | name, allowed_origins, accent, side | ProductOut (id,name,status,accent,side,allowed_origins,key,snippet,revoked_at) | ProductFields -> ProductOut | MATCH |
| connectors.js:67 | GET | /admin/connections | - | items[].id,system,site,status,authorized,warnings,last_error,last_sync_at,active_run,last_run | Page_ConnectionOut_ | MATCH (note: `warnings.indexer_group_missing.group` and `indexer_group_members.{group,members}` are inside an untyped `{[k]:unknown}` map) |
| connectors.js:68 | GET | /admin/containers | - | items[].id,connection_id,path,kind,included,owner_user_id,default_authority,default_sensitivity,default_domain_id,review_interval_months,public_declaration.status,active_run,last_run | Page_ContainerOut_ | MATCH |
| connectors.js:69 | GET | /admin/credentials (sandbox only) | - | items[].name,configured,client_id_last4,updated_at | CredentialList | MATCH |
| connectors.js:70 | GET | /admin/users?limit | (query) | items[].id,name,status | Page_AdminUser_ | MATCH |
| connectors.js:71 | GET | /admin/domains | - | items | Page_DomainOut_ | MATCH |
| connectors.js:217 | POST | /admin/connections | system:'github_docs', site | id | ConnectionIn -> ConnectionOut | MATCH |
| connectors.js:345 | POST | /admin/connections/{id}/verify | - | containers | VerifyOut | MATCH |
| connectors.js:350 | DELETE | /admin/connections/{id} | - | none (204) | - | MATCH |
| connectors.js:432 | POST | /admin/connections/{id}/github/install | - | `install_url` | response is `unknown` (github_install op) | MISMATCH (untyped): field `install_url` is not in any schema |
| connectors.js:443 | POST | /admin/containers/{id}/public-declaration | reason | DeclarationOut (stored whole; status 'pending'/'approved' read) | DeclarationIn -> DeclarationOut | MATCH |
| connectors.js:453 | PATCH | /admin/containers/{id} | included, owner_user_id | ContainerOut (stored whole) | ContainerPatch -> ContainerOut | MATCH |
| connectors.js:548 | GET | /admin/sync-runs/{run_id}/notices?limit | (query) | items[].title,external_id,notice,url | Page_SyncRunNoticeOut_ | MATCH |
| connectors.js:577 | GET | /admin/sync-runs/{run_id}/failures?limit,cursor | (query) | items[].title,external_id,error,url; next_cursor | Page_SyncRunFailureOut_ | MATCH |
| connectors.js:608 | POST | /admin/connections/{id}/sync | - | SyncRunOut (status, id, ...) | SyncRunOut | MATCH |
| connectors.js:627 | GET | /admin/connections | - | items | Page_ConnectionOut_ | MATCH |
| connectors.js:627 | GET | /admin/containers | - | items | Page_ContainerOut_ | MATCH |
| connectors.js:694 | PATCH | /admin/containers/{id} | owner_user_id, default_domain_id, review_interval_months, default_authority, default_sensitivity (internal/confidential/restricted; approved/unapproved/draft) | ContainerOut (included) | ContainerPatch -> ContainerOut | MATCH |
| connectors.js:713 | PUT | /admin/credentials/github_app | app_id, private_key, webhook_secret | none (204) | GitHubAppIn | MATCH |
| connectors.js:731 | PUT | /admin/credentials/{name} (google_oauth) | client_id, client_secret | none (204) | CredentialsIn | MATCH |
| embed.js:168 | GET | {api}/v1/bot | Authorization: Bearer product key | name, greeting, starters, accent, side, notice, privacy_url, contact_url, contact_label | none | NOT IN CONTRACT (would be e.g. GET /v1/bot -> a BotWidgetSettings) |
| embed.js:173 | POST | {api}/v1/bot/conversations | - (Bearer key) | conversation_id, visitor_token | none | NOT IN CONTRACT (POST /v1/bot/conversations -> {conversation_id, visitor_token}) |
| embed.js:187 | POST | {api}/v1/bot/conversations/{id}/turns | question; header Broth-Visitor | SSE: turn.started{turn_id,question?}, status{stage}, turn.completed{kind,sentences[{text}],sources[{n,title,url}],personal_data_warning,account_note}, error{code,retryable} | none | NOT IN CONTRACT (bot answer shape differs from AnswerOut: sentences/sources/account_note/personal_data_warning) |
| embed.js:228 | PUT | {api}/v1/bot/turns/{id}/feedback | vote ('up'/'down'), reason? | none (ok only) | none (app's /v1/turns/{id}/feedback is FeedbackIn but a different path/auth) | NOT IN CONTRACT (PUT /v1/bot/turns/{turn_id}/feedback, body FeedbackIn-like) |

No network calls: sync.js (the `fetch` there is an injected polling callback; it only reads SyncRunOut fields status, trigger, tasks_done/total, pages_total/done/failed, updated, removed, failing, error, started_at, finished_at, id, all valid), bot-form.js, agent-overview.js, embed-demo.js (only injects the script tag).

## Counts
Rows: 67 (63 client B.api calls + 4 embed fetches). MATCH 61. MISMATCH 2 (untyped responses). NOT IN CONTRACT 4.

## Unused endpoints (not called by any client file)
- GET /v1/admin/bots/{bot_id}
- GET /v1/admin/policies
- GET /v1/admin/principal-aliases, PUT and DELETE /v1/admin/principal-aliases/{token}
- GET /v1/admin/sync-runs/{run_id}
(Also never called by fetch: /connections/github/callback and /connections/oauth/callback, which are browser redirects.)
