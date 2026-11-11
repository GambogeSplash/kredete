# Shell and navigation audit: prototype vs real (broth-ui-port)

Prototype read from `/Users/fubara/enterprise-brain` (rail.js, layout.js, app.js, extras.js, components.css). "Before" is the state before this audit pass (after the earlier rail and shell port).

| Prototype element or behaviour | Before | After | Notes |
|---|---|---|---|
| 58 px floating icon rail, 42 px squircle items, 8 px gap | present | present | Metrics match the prototype (DOM table empty apart from item count). Legacy `.rail div` rule in styles.css was widening the gap to 12 px; fixed. |
| Rail items from the places list (New chat, Search, Library, destinations) | present | present | Real order: New chat, Search, Library, Governance, Admin (admin or compliance), Docs, Finish setup (hidden by the setup decision). The prototype's Inbox and Bookmarks have no real destination yet (see COMPLETENESS.md). |
| Rail icons | partly missing | present | 11 prototype icons were missing from icons.js (gear, bookmark, bulb, chartbar, clip, clock, image, memory, mic, quote, trash). Ported. Admin now uses the gear like the prototype. |
| Active item: round highlight (#ececef light, #e6e6e6 dark filter value) | present | present | |
| Unread dot or count on a rail item | present (code) | present (code) | `data-badge` on a nav item draws it; the real app has no source for a count yet. |
| Rail tooltip (instant, beside the icon, shortcut hint for Search) | present | present | |
| Menu button at the top of the rail toggles the chats shell | present | present | Hidden on pages that have no chats shell. |
| Chats shell (floating, joined to the main shell) with Search pill and shortcut hint | present | present | Pill is 36 px, matches. |
| "Your chats show up here." empty text | present | present | |
| Chat history groups (Pinned, Today, Yesterday, Previous 7 days, Earlier) with rows, pin and more menu | present | present | Real data from the API. |
| Sidebar collapsed state (`sbc`), saved in storage, Cmd or Ctrl plus backslash | present | present | |
| Account avatar at the foot of the rail | present | present | 36 px squircle in a 42 px column (matched). |
| Account menu: header card, Account settings | present | present | |
| Account menu: Admin settings | missing | added | For admin and compliance, goes to /admin. |
| Account menu: Support agent | present | present | Admin only, as before. |
| Account menu: Help center | missing | added | Goes to /docs. |
| Account menu: Sign out (danger) with the reverse transition | present | present | |
| Account menu keyboard: arrows, Home, End, Escape, Tab | present | present | |
| Account menu open motion | present | present | |
| Command palette (Cmd or Ctrl plus K, and the slash key) | present | present | Real palette also searches chats and documents through the API. |
| Palette page list | partial | extended | Added Docs, Domains and Support agent (admin) to "Go to". |
| Mobile top bar, hamburger, drawer, scrim, New chat button | present | present | Existing mobile.css. The prototype's mobile drawer styling was not copied. |
| Top crumb row | present | hidden on the ask home and Docs on desktop | The prototype shows no crumb. It is kept on every other real page because it holds the Copy link button. |
| Breadcrumb for the support agent and library folders | present | present | |
| Theme toggle in the rail | n/a | hidden on desktop (as in the prototype) | Appearance lives in Account. |
| Product-name wordmark in the shell | present | present | |
| Docs entry in the shell | present | present | Rail item plus account menu plus palette. |
| Setup wizard entry | present | removed from the shell | By decision; /setup still opens by URL. |
