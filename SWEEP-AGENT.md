# Sweep: Support agent against the prototype

Method. (1) Every selector in the prototype's working tree CSS (tokens, styles, components) that applies to the components used here was compared with the real CSS, declaration by declaration (script: rule diff of 244 matching rules, 57 differing or absent). (2) 41 equivalent elements and states (rail, headings, tags, tiles, cards, product cards, buttons, tables, fields, segmented control, preview frame; idle, hover, focus) were measured with `getComputedStyle` and `getBoundingClientRect` in the prototype and the real app, at 1440 and 390, light and dark: 4 runs x 41 = 164 rows. Real hover and focus were driven with Playwright. Prototype files read-only.

Result: 164 rows, 75 equal, 89 differ and every difference is explained below, 0 unexplained.

## Fixed during the sweep (rows that differed and now match)
1. Rail group headings: padding 10/12/6, first heading 6, colour `--mute` (was `--mute-2`); "Build" is now a `.lrail-h` after a separator, as in the prototype (it was `.lrail-g`).
2. Rail tab: no colour transition (the prototype has none) and the shared focus ring (`2px surface + 4px brand`) instead of my own ring.
3. Highlight pill appended, not prepended, so `.lrail>.lrail-h:first-child` applies.
4. Product tile icon: the prototype's tinted squircle with an inset ring, not a solid disc; dark mode no longer re-inverts it.
5. Field inputs: the app's `input[type=text]` rule made them 13px; the prototype's untyped inputs are 14px, so the fields no longer carry `type="text"` (41px high, as the prototype).
6. Field label gap 6px (was 4px).
7. Field focus: brand border plus a 1px brand ring (prototype `.eminp:focus-visible`), scoped to the Support agent screens and its dialogs.
8. Plus on the add tile: `--mute-2`.
9. Danger button in confirm dialogs: `#c4352f` text and border.
10. Copy snippet is the primary button, as in the prototype.
11. Segmented buttons 30px, brand focus outline, no hover transition of my own.
12. Knowledge rows are not clickable in the prototype, so they no longer get a hover fill; focus uses the prototype's `outline: 2px solid brand; offset -2px` (via `:has(:focus-visible)`, not on mouse click).
13. Title row bottom margin left to the shared rule (12px on phones).
14. Stat tiles on phones keep the prototype's padding (two columns).

## Explained differences (not changed)
- Card padding 16 vs 14, gap, card/heading width and height: the real cards use the design system's `.ds-card` (the family the task asked for) in a three column grid; the prototype's `.acard` is full width with an `h3` margin. Same radius, border and fill.
- Table rows 56/40 high vs 58.5/38: real tables use `.ds-table .ds-tr .ds-th` (design system); the prototype's agent still draws `.dt-r`.
- Tag, button and label widths and colours: different text or state in the sample data (Live on 3 sites vs Live version 1, warning vs ok tag, Edit vs Add knowledge).
- Light palette neutrals (hover fills 239 vs 244, borders 233 vs 240): token values differ between the two apps' `--fill-2` and `--line2`; tokens belong to the base branch.
- Segmented hover: the real control highlights on hover for feedback; the prototype's `.exsb` has none. On phones the app's touch target rule makes the buttons 42px high.
- Preview frame: the real widget preview is 420x640 in a framed, striped box; the prototype's mock is 360x520 without a frame.
- Rail height on phones 69 vs 61: the app-wide 40px touch target.
- Field input bottom margin 0 vs 12: the real field wrapper owns the spacing.
- Dark mode: the real app darkens with a page filter, the prototype with native tokens, so dark colours were compared by geometry only; colours were compared in light.
- Not carried: prototype `.adspin` busy spinner (the real `B.busy` marks buttons disabled and `aria-busy`); `.ds-cap`, Library only rules.

## Shared-file note
The field focus ring and the danger colour are scoped inside `broth-agent.css`. They are global rules in the prototype, so the base branch (components.css) should take them once for every screen.
