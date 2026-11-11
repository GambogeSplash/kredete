# Library sweep against the prototype

Truth: the prototype's working tree at `/Users/fubara/enterprise-brain` (branch `broth-port`), all stylesheets as they are now, not a snapshot.

## Method

1. **Rule by rule.** Every CSS rule in the prototype whose selector names a Library class (rows, table, caption, group bar, cards, folder cards, banner, back button, search, filter menu, view toggle, empty state, drawer shell and its blocks, avatars, tags, buttons: 85 class names), including media queries and dark overrides, is a checklist row. That came to 143 distinct rules at 1440 and 146 at 390.
2. **Each row is probed in both apps** with `getComputedStyle` on the first element that matches the same selector. Rules with `:hover`, `:focus-visible`, `:focus-within` or `:active` are probed with a real `hover()`, a keyboard-modality `focus()` and a real mouse down, after the transition has settled. Pseudo-elements use `getComputedStyle(el, '::before' | '::after')`.
3. **Eight states per run:** root list, filter menu open, root grid, folder list, folder grid, document open, search with results, search with no results. Four runs: dark 1440, light 1440, dark 390, light 390. The real app runs on a stub of the API; the prototype runs from its own files.
4. **Behaviours:** 31 interactions (typing, clearing, menu open, Escape, outside click, pick a source, toggle view, Enter and Space on rows, drawer open and close, folder open and back, hover lift on cards) run in both apps and compared.
5. **Hard states** the prototype does not have (loading, error, empty, folder not found) were reached with stubbed responses on the real app and checked for the same rules, no layout shift and no console errors.

## Totals

| Measure | Dark 1440 | Light 1440 | Dark 390 | Light 390 |
|---|---|---|---|---|
| Distinct rules checked | 143 | 140 | 146 | 143 |
| Probes (rule x state) | 2720 | 2720 | 2792 | 2792 |
| Equal | 619 | 595 | 721 | 697 |
| Different, all explained | 47 | 47 | 7 | 7 |
| Not in the real DOM in that state, all explained | 66 | 66 | 70 | 70 |
| Not rendered in that state in the prototype | the rest | the rest | the rest | the rest |

Before this sweep, dark 1440 was: equal 577, different 87, missing 68. Behaviours: 31 checks, 30 identical, 1 intentionally wider in the real app (Space opens a row as well as Enter). Unexplained rows: 0.

## What the differences are (every one explained)

| Difference | Rows | Why |
|---|---|---|
| Corner radius 12/18 vs the base branch's 8/12 (and 8 vs 6 on small chips) | 8 rules | The radius tokens are changed on another branch (uncommitted at the time). With them injected the Library matches; after merge nothing is left to do. |
| Avatar corner 32% vs 30%, rail avatar size | 10 | Shell, not Library. |
| Filter menu absent | 4 | The real menu is built when it opens; the sweep has a state with it open and it is equal. |
| `.llab`, `.libt .lfi` absent on root | 4 | Root pages have no domain, so no domain label; the folder icon class is on folder rows only. |
| `.avst` absent | 1 | Needs backend: folder owners. |
| `.sv-q`, `.sv-stack` absent | 4 | Needs backend: document excerpt and domain members. |
| `.lgrp.lgapp[data-app="Confluence"]` | 2 | The real source keys are `confluence` and `gdrive`; the rules are in `broth-library.css` under those keys. |
| Zero-width border colour on `.sv-own .lav` | 4 | Invisible. |
| `.empty`, `.empty h2` absent | 2 | Deliberate: empty states are now framed `.ds-empty` cards (user requirement). |
| Row hover background | n/a | The prototype has no hover on table rows. Kept (UI rule: every interactive thing has a hover). |

## Fixes made by this sweep

1. Filter menu: opening it keeps focus on the Filter button, as in the prototype (the real app used to move focus to the first option).
2. Search with no results: copy is "Try a different word." when only the search box is set; the longer line stays when a filter is set.
3. Domain column: the domain label is the grid cell itself, as in the prototype (its box and width are the column's now, not a wrapper's).
4. Dark mode: the document shell and the filter menu take the elevated shadow (`--e3`), as the prototype's dark override does.
5. Folder icon in rows carries the prototype's `lfi` class.
6. Loading: while the pages load, three skeleton rows (or cards) are held under the folders, so the table does not jump when they arrive. Skeleton text lines now render.
7. Empty, error and not-found states are framed `.ds-empty` cards, full content width, with an icon tile, title, line and the retry or link under them.

Earlier in the project (kept for the record): table list view with caption rows per source, folder banner and back button, rich folder cards, grid group bars, document shell, remembered view, `fpop` entrance on folder open with the search box and banner left still, drawer blocks.

## Behaviour checklist (prototype run vs real run)

| Behaviour | Result |
|---|---|
| Typing in the search filters rows | same |
| Empty search shows the empty state with the same title | same, framed |
| Clearing the search brings rows back | same |
| Filter button opens the menu, `aria-expanded` true | same |
| Escape inside the menu closes it, focus returns to the button | same |
| Click outside closes the menu | same |
| Picking a source filters, closes the menu, shows its name on the button | same |
| Picking All restores the label | same |
| Grid and list toggle, `aria-pressed`, grid drawn | same |
| Enter on a row opens the document shell and the page makes room | same |
| Escape closes it and the room returns | same |
| X closes it | same |
| Space on a row | the prototype does nothing; the real app opens it (keyboard standard) |
| Enter on a folder opens the banner and the folder name | same |
| Scroll is at the top after a folder opens | same |
| Back chevron removes the banner | same |
| Card hover lift (page card 1 px, folder card 2 px, flap tilt 3D matrix) | same, to the matrix value |

## Hard states (real only)

| State | Result |
|---|---|
| Error reading the documents | framed card, icon, message, Try again; folders still listed; no console errors |
| Folders failed to load | framed card with Try again (same helper; not rendered in the browser) |
| No documents at all | framed card "Nothing here yet" with the admin or member line |
| Empty folder | framed card "Nothing here yet" (same helper; not rendered in the browser) |
| Search with no results | framed card "Nothing matches" |
| Folder not found | framed card with the link back; 980 px wide at 1440, 358 px at 390 (the content width) |
| Loading with folders known | three skeleton rows held under the folders; the table top is at the same y before and after (151 px at 1440, 124 px at 390) and rows are 56 px in both |
| Document not available, document read failed, no lineage yet | framed cards inside the shell (same helper; not rendered in the browser) |

## Headings

The (i) hints added earlier were removed on request. The Library has plain titles and no subtitles, as in the prototype, which has no hints on these screens.

## Totals for this sweep

Rows checked: 143 distinct rules, 8 states, 4 viewport and theme runs. Behaviours: 31. Hard states: 10, of which 5 were rendered in the browser at both sizes (error, no documents, search with no results, folder not found, loading) and 5 share the same helper. Fixed: 7. Explained: 10 groups above. Open: 0.
