# Broth UI port: shell, Ask, Library, Governance, Admin, Support agent, Account

Draft only. Not opened. Target: `integration` (confirm with the user, see MERGE-NOTES.md).

## What this changes

A visual and structural port of the Broth design onto the existing API-backed client. About 160 commits on top of the current `integration`. Screens:

- Shell: sidebar rail, command palette (Cmd or Ctrl+K, searches chats and documents through /v1/search and /v1/documents), dark and light themes, mobile layout, page transitions and motion.
- Sign-in, first-run welcome, setup wizard.
- Ask: home, streamed answers, sources panel with sliding tabs, feedback, report, history, bookmarks page.
- Library: list and grid, filters, document drawer with audit and Request public.
- Governance: sharing requests and docs repository requests, pending badge in the nav.
- Admin: Workspace, People (filter, invitations, account links), Domains, Sources (cards and modals for Confluence, GitHub docs, Google Drive; other sources say Coming soon), Audit log.
- Support agent: overview, knowledge, experience, products, widget preview.
- Help center and Account (profile, sessions, data).
- The Inbox page was removed; `/inbox` redirects to `/governance`. `inbox.js` is deleted.

## Browser-only (not stored by the server)

Bookmarks, avatar picture, setup wizard company name and logo, attached file chips in the composer, list or grid view, sidebar state, theme. The bookmarks page and avatar picker say "on this device only". Notify me on coming-soon sources was removed because nothing received it.

## Needs backend

| Need | Suggested endpoint |
|---|---|
| Bookmarks per user | `GET /v1/me/bookmarks`, `PUT` and `DELETE /v1/me/bookmarks/{turn_id}` |
| Avatar | `PUT /v1/me/avatar`, avatar url on Me and user lists |
| Company name and logo at setup, workspace name | `company_name` on `POST /v1/setup/claim`, `GET` and `PATCH /v1/admin/workspace` |
| File attachments in Ask | upload endpoint and `file_ids` on AskIn |
| Welcome flag | confirm that `me.onboarding.welcomed` is an accepted key (the client now writes it with PATCH /v1/me) |
| OAuth start and GitHub install responses | typed response models with `authorization_url` and `install_url` |
| Support widget API | `/v1/bot*` is called by embed.js and is not in types.d.ts; confirm the service and add it to the contract |
| Share a chat by link | share endpoint; today "Copy link" copies the page URL, which only works for the same signed-in person |
| Notify me for new sources | `POST /v1/me/interests` if wanted |

Full table of every call and its verdict: WIRING.md.

## What to test

1. Sign in, sign out, let the access token expire, reload (refresh cookie).
2. New account: welcome steps, nickname saved, welcome does not return on another browser.
3. Ask a question, stop it, regenerate, vote, report, rename, pin, delete.
4. Library filters and a document drawer, Request public, then see it in Governance and approve or reject it.
5. People: invite, revoke, roles, suspend. Domains: create, owners.
6. Sources: Confluence and GitHub docs connect, verify, sync, include a space or repository.
7. Support agent: create a bot, sources, a product, copy snippet, replace key, revoke, open the demo page.
8. Account: sessions, sign out of all other devices, delete history.
9. Phone width (390) and dark mode on each of the above.

Checks run here: `npm run check` and 168 unit tests pass; a stub API plus vercel.json headers served the main routes at 1440 and 390 in light and dark with no console errors and no CSP violations. The Playwright suite and the real backend were not run. See the e2e section below.

## Risks

- Large diff (about 90 non-test files, 11k lines added). Review by screen.
- Never run against the real backend from this machine. Field level checks are from types.d.ts only.
- Logo lookup in setup sends a guessed company domain and the email domain to Google's favicon service (CSP `img-src` allows t3.gstatic.com). Remove it if that is not acceptable.
- Playwright specs were updated by reading, not run.
- About 20 working notes (`COMPLETENESS-*.md`, `SWEEP-*.md`, `MOTION-*.md`, etc.) sit in the repository root; consider moving or dropping them before merge.
- Screenshot baselines in tests/e2e/__screenshots__ will differ.

## Rollout

Preview only until the user says go. A push to `integration` deploys production, so it must not be pushed without the user's explicit OK, and the pull request must not be merged without it. Backend teammate should review the needs-backend table first. No environment changes are needed.

## Screenshots

Existing baselines in tests/e2e/__screenshots__ (1440 and 390, light and dark; wizard; sync). Fresh screenshots for this PR have not been taken.

## e2e specs

Updated by reading only, since the suite needs the real backend: account, admin, agent, ask, docs, docs-source, history, library, signin and sync specs (selectors for the Sources cards and dialogs, the rail nav, the Help center topic cards, two-press sign out, the filter popover on the audit log, product cards, failed-answer alerts, and the PATCH /v1/me mock in the first-run welcome test). smoke, bot, wizard and fixtures were read and left alone.

Not verified: every updated spec (none was run); screenshot baselines are stale and need regenerating (connectors, docs, domains, people, governance, sessions, welcome); the ask sources panel now opens by default at 1200px or wider, so whether the citation click toggles it was not confirmed; docs-source "Request public" final assertion passes only because it reads a hidden element; the phone locations of the Account button and the library folder title.

Found while updating the specs and fixed: a drawer opened from inside the Sources dialog (a source's Settings, failed pages) sat behind the dialog on desktop. It now opens above it (`.drawer.over`). Checked in the browser at 1440.

