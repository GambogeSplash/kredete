# Help center parity: prototype vs real (branch broth-ui-help)

Prototype: /Users/fubara/enterprise-brain (docs.js, working tree). Real: this worktree, based on broth-ui-port.

## Counts

| | Prototype | Real before | Real after |
|---|---|---|---|
| Topics | 6 | 6 | 6 |
| Articles | 30 (the commit message says 31; ids run a1 to a31 with a29 never present, so 30) | 6 (service articles, text not on this machine) | 36 (30 how-to + 6 service) |
| Topic images | 6 | 6 (byte-identical to the prototype's, cmp) | 6 |
| Card counts (start, ask, sources, owners, admin, trust) | 5,5,5,5,5,5 | per audience | 5,6,7,7,6,5 |

Topic images are still Cash App help screens from Mobbin used as placeholders (assets/CREDITS.md). Replace before any public release.

## Where the service's articles sit

asking-broth in Asking questions; labelling-pages and fixing-label-problems in Owners and conflicts; setting-up-spaces and connecting-docs-repositories in Sources and connectors; support-bots in Admin. An unknown slug goes to the first topic that shares its audience. The service's text could not be read here (broth-service is not on this machine), so overlaps with prototype articles (Asking Broth vs Ask your first question) were not compared; the service's article is kept as its own article and wins by being served from the API.

## Articles

| # | Article | Topic | Status | Real-app note |
|---|---|---|---|---|
| 1 | Ask your first question | Getting started | ported, text identical in crawl | FLAG: Names a "card on the right" with numbered sources (real: the sources panel) and a thumbs-down reason; the "no source fits" owner hint is prototype behaviour. |
| 2 | What Broth can and cannot do | Getting started | ported, text identical in crawl | FLAG: "Recommended" tag for the most recent source is prototype only. |
| 3 | Find your way around | Getting started | ported, text identical in crawl | FLAG: Describes Inbox, Bookmarks and a chat history that hides on other pages: Inbox and Bookmarks do not exist in the real app (real rail: New chat, Search, Library, Governance, Help center). |
| 4 | Read the Broth card | Getting started | ported, text identical in crawl | FLAG: The four-tab Broth card (Activity, Answer, Sources, Memory) does not exist; real has an answer sources panel only. |
| 5 | Set up your profile | Getting started | ported, text identical in crawl | FLAG: Avatar library and photo upload are not in real Profile (real has preferred name, appearance, tour replay). Action goes to /account. |
| 6 | Write questions that get good answers | Asking questions | ported, text identical in crawl | FLAG: "Choose what to ask" source/domain/date narrowing: real has filters in the sources panel; wording differs. |
| 7 | Read an answer and its sources | Asking questions | ported, text identical in crawl | FLAG: "Recommended" tag and "How I answered" do not exist in real. |
| 8 | Use the search palette | Asking questions | ported, text identical in crawl | FLAG: Real palette exists (Cmd+K); Enter-to-ask behaviour not checked. |
| 9 | Follow up on an answer | Asking questions | ported, text identical in crawl | FLAG: Suggested follow-ups chips are not confirmed in real. |
| 10 | Bookmark an answer | Asking questions | ported, text identical in crawl | FLAG: Bookmarks do not exist in real. No action button shown. |
| 11 | Connect a source | Sources and connectors | ported, text identical in crawl | FLAG: Real flow is Admin settings, Connectors (Confluence, Google Drive, Docs repositories); Notion is not a real connector. Action goes to /admin/connectors (admins). |
| 12 | Why an answer is out of date | Sources and connectors | ported, text identical in crawl | FLAG: "Ask owner in the Inbox" and the 30 minute schedule are prototype claims. |
| 13 | What Broth reads from each source | Sources and connectors | ported, text identical in crawl | FLAG: General claims; consistent with real. |
| 14 | Sync a source | Sources and connectors | ported, text identical in crawl | FLAG: Real has Sync now on Connectors; "Changed documents show up in Activity" is prototype only. |
| 15 | Browse the Library | Sources and connectors | ported, text identical in crawl | FLAG: Real Library has domain folders and a document drawer; List and Grid switch and lock icon are not confirmed. |
| 16 | Report a conflict to the owner | Owners and conflicts | ported, text identical in crawl | FLAG: Real has Report to owner on an answer; the Inbox does not exist. No action button shown. |
| 17 | Work through your Inbox | Owners and conflicts | ported, text identical in crawl | FLAG: Inbox does not exist in real. Article kept, no action button. |
| 18 | Keep documents verified | Owners and conflicts | ported, text identical in crawl | FLAG: Verify now and Stale items rely on the Inbox; real shows "Past review date" on a document only. |
| 19 | Request access to a document | Owners and conflicts | ported, text identical in crawl | FLAG: Real replaces Request access with Open in source (document-drawer.js header). Real fact differs. |
| 20 | Approve a sharing request | Owners and conflicts | ported, text identical in crawl | FLAG: Real equivalent is Governance (promotion requests). Action goes to /governance. Inbox mention is prototype only. |
| 21 | Invite people and set roles | Admin | ported, text identical in crawl | FLAG: Real roles and invites exist on Admin, People; "Content owner" role name and Resend are not confirmed. |
| 22 | Set policies | Admin | ported, text identical in crawl | FLAG: Policies screen does not exist in real. No action button shown. |
| 23 | Read the audit log | Admin | ported, text identical in crawl | FLAG: Real Audit has action and date filters; Export CSV does not exist. |
| 24 | Add and verify a domain | Admin | ported, text identical in crawl | FLAG: Real Domains tab exists; the TXT/DNS steps are not confirmed. |
| 25 | Remove someone | Admin | ported, text identical in crawl | FLAG: Real People tab supports suspend and sign out; "Remove" wording not confirmed. |
| 26 | Who can see my questions | Privacy and security | ported, text identical in crawl | FLAG: 90 day retention and delete-history are not confirmed in real. Action goes to /account. |
| 27 | How access levels work | Privacy and security | ported, text identical in crawl | FLAG: Real uses clearance levels; General/Internal/Confidential/Restricted names not confirmed. |
| 28 | What Broth remembers about you | Privacy and security | ported, text identical in crawl | FLAG: Memory tab does not exist in real. |
| 29 | Sign-in and devices | Privacy and security | ported, text identical in crawl | FLAG: Real Account has Sessions. Matches closely. Action goes to /account/sessions. |
| 30 | Download or delete your data | Privacy and security | ported, text identical in crawl | FLAG: Download my data and Delete my question history do not exist in real Profile. |
| 31 | asking-broth | see above | kept from real (service article) | none |
| 32 | labelling-pages | see above | kept from real (service article) | none |
| 33 | setting-up-spaces | see above | kept from real (service article) | none |
| 34 | connecting-docs-repositories | see above | kept from real (service article) | none |
| 35 | fixing-label-problems | see above | kept from real (service article) | none |
| 36 | support-bots | see above | kept from real (service article) | none |

Dashes: no em dashes, en dashes or spaced hyphens in any prototype article text (checked on the extracted data); nothing rewritten. No emoji or sparkles.

## Verified

See the report: crawl of both apps at 1440 and 390, light and dark; all 30 how-to articles compared field by field (summary, steps, tip, fix, related) and identical; search for sync, owner, audit, DNS, thumbs, verified: every prototype hit is present in the real app, which also finds matches in tip, fix, related and service text.

## Not done

The e2e spec docs.spec.mjs was already stale (it expects audience chips and four real article cards) and was not changed or run. "Was this helpful?" is not sent anywhere. Email support and the status line stay hidden (no address, no status endpoint).
