# Unified settings

## Problem

The profile menu offers "Account settings" (`/account`) and, for admins and compliance, "Admin settings" (`/admin`).
Both open the same two-pane screen with the same left rail: an account group (Profile, Sessions) and an administrator group (Workspace or Finish setup, People and access, Sources, Sharing requests, Domains, Audit log).
The rail is built twice and the copies have drifted:

- `extras.js` builds the Account rail inline, with a hardcoded admin link list that lacks Workspace and Finish setup and ignores tab permissions.
- `admin.js` `railHtml` builds the Admin and Governance rail from the admin tab registry.

The header crumb also names the same screen "Account" on one route and "Admin" on the other.

The failure class: one settings destination is exposed through two entry points with independently maintained navigation, so what a user sees depends on which entry they clicked.

## Goal

One "Settings" entry and one rail implementation.
The rail is identical on every settings page for a given user; only the current item differs.

## Non-goals

- No route changes. `/account`, `/account/sessions`, `/admin/*` and `/governance` keep working as they do now.
- No change to the content of any settings page.
- No visual redesign of the rail.

## Design

### Profile menu (`auth.js`)

- "Account settings" and "Admin settings" are replaced by a single "Settings" item, shown to every user, which opens `/account`.
- The item is marked current when the route surface is `account` or `admin`.
  Governance is also a place in the main rail, which marks it there, so the menu does not.
- The profile card at the top of the menu still opens `/account`.

### Settings rail (`settings-rail.js`, new)

A small module with one job: render and wire the settings rail.

- `settingsRail(current)` returns the rail HTML.
  `current` is a key: `profile`, `sessions`, an admin tab key (`workspace`, `people`, `connectors`, `domains`, `audit`) or `governance`.
- `wireSettingsRail(nav)` wires navigation and the two-press Sign out.
- Groups:
  - "Account": Profile, Sessions. Always present.
  - "Administration": present only for users with the admin or compliance role.
    Items come from the admin tab registry filtered by each tab's roles, in today's order: admin tabs except Domains and Audit log, then Sharing requests, then Domains and Audit log.
- Sign out at the foot.
- Nothing in the rail depends on setup state (Finish setup left the rail in e79dab9), so the old `brain:setupchange` re-render in `admin.js` is dead code and is removed, not moved.
- At phone width the rail is a chip strip and its Sign out is hidden by existing CSS; Sign out stays in the profile menu there.
- The rail exposes `aria-label="Settings"` and marks the current item with `aria-current="page"`.

The module reads the admin tab registry through `window.ADMIN.tabs` and an `allowed()` helper exported from `admin.js`, so it does not duplicate tab labels or role rules.

### Consumers

- `extras.js` Account surface: uses `settingsRail('profile' | 'sessions')`; the inline rail and hardcoded admin list are deleted.
- `admin.js`: uses `settingsRail(tab)`; `railHtml`, `wireRail` and the local setup listener are deleted, and `allowed` is exported.
- `governance.js`: uses `settingsRail('governance')`.

### Header crumb (`app.js`)

- `account` and `admin` crumbs start with "Settings", followed by the current page name (for example "Settings / Profile", "Settings / People and access").
  The page name is read from the rail's current item, so the crumb and the rail cannot disagree.
- Governance keeps its "Workspace / Governance" crumb, since it is also a main-rail place.
- The phone top bar title reads "Settings" on these pages.
- The document title stays "Broth", as on every screen except the help center.

### Help content (`help-content.js`)

Steps that say "Account settings, then X", "Admin settings, then X" or "Account menu, Admin settings" are reworded to "Settings, then X".
The "Your account" overview line lists "settings" once.

### Load order (`index.html`)

`settings-rail.js` loads after `admin.js` and before `extras.js` and `governance.js`.

## Error handling

The rail renders from in-memory role and setup state only; there is no network call and no new failure mode.
A user with no admin tabs allowed gets no Administration group, never an empty header.

## Testing

E2E (Playwright, `tests/e2e`):

- A regular employee's profile menu shows one "Settings" item and no "Admin settings" item; the rail has no Administration group.
- An admin's profile menu shows one "Settings" item; the rail on `/account`, `/account/sessions`, `/admin/people` and `/governance` lists the same items in the same order, with only the current item differing.
- A compliance user sees only the admin tabs their role allows.
- Moving quickly between settings pages raises no page errors (this exposed a Sessions race: its list could land after the person had left, writing into the next page; the loader now drops a result whose pane is gone).
- Existing account and admin specs updated for the new menu label and crumb.
- Affected screenshots refreshed with `=changed` and reviewed at 1440 and 390, light and dark.

Lint and type checks pass.
