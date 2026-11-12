# Workspace places: Support agent, Docs and Governance each have one home

## Problem

Three places were reachable from two menus, or hidden in the wrong one.

- Support agent, an important feature, was only in the profile menu.
  Its list page drew a sub-menu panel whose only entry was "All bots".
- Help center sat in the rail and again in the profile menu.
- Governance on the rail opened inside the Settings shell for anyone who could open Admin, where the Settings rail listed it as "Sharing requests".

## Design

Each place has exactly one entry point, the rail (the phone sidebar lists the same places).

1. **Support agent** is a rail place between Governance and Docs, shown only when `opens('bot')` allows it (admins and developers).
   It stays current on every `/support-agent/...` page.
   The profile menu no longer lists it.
2. **The bot list** has no sub-menu panel and uses the full width.
   A bot's own pages keep their sub-menu (All bots, the bot's name, Overview, Knowledge, Experience, Products): it has real entries there, and All bots is the way back.
3. **Help center is renamed Docs** everywhere the product names its own help area: the rail, the crumb, the page heading, the search box, the signed-out header and the window title (`Docs - Broth`, `<article> - Broth docs`).
   The address stays `/help`, so existing links keep working.
   The profile menu no longer lists it.
   "Help centre" as a customer's site (the bot form placeholder, the embed demo, the source system name) is unchanged.
4. **Governance is a page of its own**, titled Governance, the same plain page for everyone.
   The Settings rail (`settings-rail.js`) no longer lists "Sharing requests" in its Administration group.
   This supersedes that one placement in the unified settings spec; the rest of One Settings stands.
   `/admin/sharing-requests` still redirects to `/governance`.

The profile menu keeps to the account: the profile card, Settings and Sign out.

## Testing

- `agent.spec.mjs`: the rail item opens the list, the list has no Support agent navigation, a bot's pages keep it with the rail item current, and the profile menu holds only Settings and Sign out.
- `admin.spec.mjs`: employee and compliance have no Support agent place; a developer has the Support agent and Sources and no other admin screen; the Settings rail no longer lists Sharing requests; Governance renders without the Settings rail.
- Snapshots were re-recorded only where pixels changed (compared at zero tolerance, then checked by eye), because the rail's Support agent icon and the missing Sharing requests row each sit inside the usual 0.002 tolerance and would otherwise leave stale snapshots passing.
  `agent-add-product` and `document-docs-site` were left alone: they show the stack's own address, so they are recorded on the default stack only.
