# A docked side panel leaves the page beside it usable

## Problem

Since the Library document and the Sources settings open as a panel docked beside the page (b107465), the page beside the panel stops responding until the panel closes.
Another document does not open, a folder does not open, and clicking the page does not close the panel.

Cause: the panel kept the plumbing of the old sheet, which covers the page.
`extras.js` makes `.top` and `.mainpanel` inert whenever `#drawer` is on, marks it `aria-modal` and traps Tab inside it.
The scrim that used to close the sheet is switched off for the docked panel, so nothing outside closes it either.

Class: a panel that sits beside the page is treated as one that sits over it.

## Design

The drawer has two kinds, decided in one place (`BRAIN.drawerDocked()`): docked (the `shell` class on a screen wider than 900 px) and sheet (everything else, including every phone).

- **Sheet**: unchanged. It is modal: the page is inert, `aria-modal="true"`, Tab is trapped, the scrim closes it.
- **Docked**: not modal. The page stays usable, `aria-modal="false"`, Tab is not trapped. Escape and the close button still close it.
  - A click on the page beside it (inside `.top` or `.mainpanel`) closes it, unless that same click opened a panel (another document switches the panel in place, with no slide out and in).
  - A docked panel that holds a form (Sources space or repository settings) does not close on a click outside, so unsaved edits are not lost. Close, Cancel, Save and Escape close it.
  - Clicks in a dialog, menu or toast opened from the panel are not on the page, so they leave it open.
- Whether the page is inert is recomputed from what is open whenever the drawer or the modal changes, and when the screen crosses 900 px.
  Closing a modal opened from a docked panel gives the page back.

## Tests (Playwright, `library.spec.mjs` and `admin.spec.mjs`)

With a Library document docked open on a desktop:

1. another document switches the panel to it;
2. a folder opens and the panel closes;
3. a click on empty page space closes it;
4. Escape closes it;
5. opening and closing Details and lineage leaves the panel open and the page usable;
6. on a phone the sheet still makes the page inert and the scrim closes it.

With Sources space settings docked open: the page beside it is usable, and a click on it does not close the settings.
