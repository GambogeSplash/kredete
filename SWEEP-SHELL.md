# Sweep: shell, sign-in, first run, docs (broth-ui-port)

Method. For each state, the prototype (`/Users/fubara/enterprise-brain` working tree, served on 5320) and the real app (stub API) are loaded at 1440x900, dark, reduced motion. Every visible element in scope is matched by tag, classes, label or text. For each pair the script compares every computed CSS property (about 330, minus logical duplicates, custom properties and background images) and the bounding box (1 px tolerance). Then, for every link, button, input and focusable element, it repeats the comparison with a real `hover` and a real `focus`. The scripts are `sweep.mjs` and `sweep.py` in the session scratchpad (`mine/`).

A second pass looked at the CSS itself: every class used by the prototype's added rules since `fd142d7` (372 classes) was searched for in the real CSS. 196 are absent. They fall into: admin and library classes (other agents), the agent card and home toggle (ask), the prototype's hardcoded docs article body (`dcsteps`, `dctip`, `dcrel`, `dchelp`, `dcgo`, `dcfix`, `dcmeta`, `dcnone`, `dcview`, `dctopic`, `dcbody`, `dcic`, `dch2`, `dch3`: the real articles are server HTML, so these have no element to style), the sign-up steps (`susel`, `suslug`, `suta`: no sign-up API), and old picture variants (`pvcr`, `pvdash`, `pvtitle`, `pvrail`...) that the prototype's final rules no longer use.

States swept (dark 1440): sign-in empty, sign-in with a typed email, sign-in with an invalid email, first run step 1, first run ask step (against the prototype's third step), docs list, shell home, command palette. The account menu sweep did not complete (timeout); it was compared by pixel diff and by eye instead. Light and 390 px were compared by pixel diff (see earlier reports), not by this property sweep.

## Mismatches before the sweep fixes (rows = mismatching property or box groups per element)

| State | Elements proto / real | Mismatch rows before |
|---|---|---|
| sign-in empty | 46 / 45 | 40 |
| sign-in typed email | 46 / 44 | 40 |
| sign-in invalid email | 49 / 46 | 62 |
| first run step 1 | 38 / 38 | 52 |
| first run step 2 (prototype shows its sources step here, so mostly not comparable) | 41 / 43 | 86 |
| docs list | 54 / 52 | 41 |
| shell home | 136 / 47 | 73 |
| palette | 60 / 62 | 33 |

## Fixed in this sweep

1. Sign-in: Google button content `text-align` (center). Passkey row: `pointer-events:auto`, default button padding (1 px 6 px), as in the prototype (it is a real `disabled` button; the `aria-disabled` rule now applies to the link only).
2. Sign-in: invalid or empty email now shows the prototype's banner in a slot above the providers: "Enter your work email. It looks like name@company.com." The input gets `aria-invalid` with border #d4543d. The extra inline message under the field is gone.
3. First run: Back button and every `.si-btn` use the 12 px radius (`--r-md`); the real `.btn` rule was giving them 8 px.
4. Docs: topic cards now have `letter-spacing:normal` and `text-align:left` (the prototype cards are buttons, mine are links), and the card title has the prototype's -0.012em tracking.
5. Rail: keyboard focus ring colour is the prototype's #d9dcf7 (was the brand line colour).
6. Earlier in this branch, found the same way: radius tokens, primary button gradient, rail group gap, account avatar size, white dim flash, per-child sign-in stagger.

## Explained (not changed)

- Hover and focus states for the Google button, the email field, the Continue button, the docs search input and the rail items matched the prototype in the sweep after the fixes above (no hover or focus rows remain for them).
- "Reading from your connected apps" versus "Reading from 2 apps": the prototype derives the count from demo data. The real app has no public count, so the text is static. The resulting width and icon positions differ.
- The picture's curved lines are a CSS background in the real app and an inline SVG in the prototype. Same pixels, different DOM.
- The "Is this you?" card shows the profile email where the prototype shows a job title, and has two lines where the prototype has three. Height follows the data.
- Docs: the prototype title is "Help center" and the counts are canned (5 each). Real: "Docs" and real counts.
- Home: the prototype's populated home view, agent button and agent panel belong to the ask branch (needs-backend items in COMPLETENESS.md).
- Palette: the box shadow differs because the real palette box carries its own shadow rule; the dark-mode inversion makes it near invisible in both.
- Rail: the real rail has six items (Search, Governance, Admin, Docs) where the prototype has five (Inbox, Bookmarks); the account button reports `justify-items` normal versus center with no visual effect.
- Step 2 of the first run in the prototype is the "What Broth can read" step, removed by the user. The real step 2 is the ask-first-question step, compared against the prototype's third step.

## Behaviours checked against the prototype

| Behaviour | Prototype | Real |
|---|---|---|
| Not you? Sign out | goes straight to sign-in with a soft fade, no overlay | done by another change on this branch (commit "Not you? Sign out: the form fades out and back in"); not re-verified here |
| Continue with an invalid email | banner above the providers, field marked invalid, no navigation | same |
| Continue with a valid email | start Google sign-in | same, adds `login_hint`; cannot be verified without Google |
| Typing a valid email | greeting changes in place | same |
| Enter in the email field | submits | same (form submit) |
| Cmd or Ctrl plus K, slash | opens the palette | same |
| Escape, arrows, Home, End in the account menu | move and close | same |
| Rail click | goes to the place | same |
| Card click in Docs | opens the topic | opens the topic's first real article |

## Not covered

- Light and 390 px were not run through the property sweep. Pixel diffs exist for sign-in (light 0.14 percent, 390 px 0.42 percent).
- The account menu property sweep timed out.
- The wizard frame has no prototype equivalent to sweep against.
- Loading, empty and error states of the real docs were seen only in the stubbed API's success case.
