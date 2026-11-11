# Setup wizard sweep (rule by rule against the prototype)

Truth: the prototype working tree /Users/fubara/enterprise-brain (sign-up flow in extras.js `AUTH.signup`/`suRender`/`ashell`,
rules in styles.css and components.css). Two passes.

## Pass 1: static rule rows
Every rule row (selector, property, value) in the prototype's styles.css, components.css and tokens.css whose selector touches the
sign-up shell (.stp .obnav .ob-back .obout .obgo .colog .adlogo .logomiss .si-btn .si-in .eminp .emlab .emw .emi .si-alt .hint .si-l
.si-r .banner .disc .link and friends): 437 rows. 166 were not literally present in the real client. Reading them against the
computed pass: rows for other pages (.uedact, .oa-*, .domadd, .adedit, .exf, .obid: 38) are out of scope; rows that the real client
expresses with tokens or a different selector (.adlogo vs button.adlogo, .si-alt, .si-btn heights) were settled by pass 2; rows still
missing and fixed in `broth-setup.css`: `.si-in .link` cursor, color transition, hover ink, focus ring (also fixes the sign-in
"Create a workspace" hover, which was brand-strong instead of ink); `.obnav` margin-top 8 and stretch; `.eminp[aria-invalid]` border
#d4543d; mobile `.si-l` min-height 100dvh and `.si-in` 420 px centred; `.stp` radius 12 (a bug of mine made it 999 px); `.stp i` radius 4.
Explained: `.stp i[role=button]` (+ `::after`, hover, focus-visible) and `.stp i.lock` clickable dots: the wizard never goes back, its step is
derived from the API, so dots are not buttons; the not-yet-reached dots get the `.lock` opacity .45 look. `.ob-back` (hover, active,
transition): the wizard has no back step, nothing to attach it to.

## Pass 2: computed styles in a real browser
`sweep.mjs` (Playwright, getComputedStyle + getBoundingClientRect, real `hover()`, `focus({focusVisible})`, mouse down for active,
disabled, aria-invalid) compares the wizard (local stub of /v1) with the prototype's sign-up pages for 22 element probes across the
states rest, hover, focus, active, disabled, invalid, plus 4 layout gaps, at 1440 and 390, dark and light. 8,024 property rows.

| Run | Rows | Equal | Different |
|---|---|---|---|
| First run | 8,208 | 6,922 | 1,286 (includes a harness bug: the prototype's theme key is `broth-theme`, the client's `brain-theme`) |
| Second run (after fixes) | 8,024 | 7,780 | 244 |
| Final run | 8,024 | 7,851 | 173 |

The 173 final rows: 28 are dark colours (the prototype's dark is a page-wide invert filter over light values; the real sign-in scope
has its own dark palette, checked by screenshot instead); the other 145 are explained below.

### Fixed in this sweep
1. Step dots: radius 999 px became the prototype's 12 / 4 px; padding and bottom margin back to the prototype's 13 / 32 px; not-reached dots at opacity .45; dark palette only for colours.
2. Inputs: back to the prototype's 41 px box (padding 9), no hover border, no transition (I had added 40 px, a hover and a .15 s transition); invalid border #d4543d; email field uses `.emw` with the icon (padding-left 38 now correct).
3. Primary button now sits in `.obnav` with `.obgo`, as in the prototype: display flex, flex 1, margin 0 (a teammate rule `#suf .si-btn{margin-top}` doubled the gap).
4. Error: design system `.banner.bad` above the fields (prototype position), margin-bottom 16, `aria-invalid` on the field.
5. Labels: second label 14 px below the field, first label flush under the error slot.
6. Company row: 41 px logo square, field margin 12, focus ring offset 3 px without extra shadow, border `--line-strong`, "Upload yours" link in brand colour without an arrow, weight 450.
7. Title and hint: title margin 8, hint is the plain `.hint` (16 px) with the prototype tooltip placement on desktop; below the title on phones.
8. `.si-in .link` hover ink, focus ring and transition (sign-in link too); `.obnav` spacing; mobile layout rules.
9. Step swap uses the prototype's motion: old form fades out in place (170 ms), new one fades in rising 5 px (240 ms, 30 ms delay), picture untouched; none with reduced motion.
10. Framed `.ds-empty` for "Setup could not load" and "This workspace is already set up" (auth.js, markup only).

### Explained (kept different on purpose)
- Title width and height of the form: the title sits in a flex row with its (i) hint; the form is longer (code, email, company).
- Step dots width 68 vs 58: three steps, the prototype sign-up has two.
- Done dots (position, cursor, focus outline, hover fill): not clickable, the step is derived from the API.
- Hint `flex-shrink` 0 vs 1: a long title must not squash the hint; the hint's tooltip text differs by design.
- Logo square colour: the prototype's letter is white on a pale square (invisible in light mode), the wizard keeps ink.
- Error field border: the prototype's sign-up error does not mark the field, the wizard does (accessibility, superset).
- Gap company to button 20 vs 87.5: the prototype step has a workspace address line there.
- Mobile gap dots to title 45 vs 32: the wizard adds "Step N of 3" text because the picture is hidden at 390 px.
- Error banner height on phones: different message length.
- Disabled button transform 1.00007 vs 1.00001 and height 39.98: animation sampling noise.
- Colour differences in dark: see above.
