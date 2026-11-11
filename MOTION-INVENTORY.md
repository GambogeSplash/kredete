# Motion inventory: Broth prototype vs the real client

Prototype read from `/Users/fubara/enterprise-brain` (branch `broth-port`, working tree). "Real" is this branch.
Status key: SAME = constants copied and checked in code, MEASURED = sampled in a browser, OPEN = not yet matched.

| Animation | Trigger | Element and properties | Prototype | Real (now) | Status |
|---|---|---|---|---|---|
| Sign-in dive | Continue with Google, or the email Continue | dashboard card clone grows to the screen: translate and scale from 0 0, radius lerp(rad, 0, smooth(0, .8)), shadow off after x .15 | spring k 210, c 29, eps .006, delay 70 ms | same spring and constants in `transitions.js` (`A.dive`) | SAME |
| Dive: picture behind | same | `#sipv` scale 1 to 1.16, blur 0 to 14 px, opacity 1 to 0 | 520 ms, delay 70, cubic-bezier(.5,0,.2,1) | same | SAME |
| Dive: form column | same | `.si-l` opacity 1 to 0, translateX 0 to -22 px, scale .985, blur 4 px | 300 ms, cubic-bezier(.4,0,.2,1) | same | SAME |
| Enter (app rises) | first paint after the return | colour overlay opacity 1 to 0 | 460 ms, delay 60, ease-out | same | SAME |
| Enter: shells | same | `.top` translateX -26 px, `.mainpanel` translateY 12 px and scale .988, `#rail` translateX -12 px and opacity 0 | 680 / 680 / 520 ms; delays 40 / 90 / 0; cubic-bezier(.2,.8,.2,1) | same | SAME |
| Enter: inner groups | same | sidebar children, home hero, panel children fade and rise 8 to 12 px, stagger 30 to 55 ms | per-child | not ported: the real screens are not the prototype's home view; the page entrance system (motion.js, life.js) animates them instead, guarded by `window.__entering` | OPEN |
| Enter: Broth flight | same | holder image arcs to the agent avatar | spring k 240, c 27, eps .04, arc 64 px | not ported: the real app has no agent avatar | SKIPPED |
| Sign-out (leave) dim | sign out | overlay opacity 0 to 1, app shells scale .985 | 300 ms ease-out | overlay 300 ms ease-out (shell scale not applied) | PARTIAL |
| Leave: card shrinks into picture | after the swap | overlay box lerp from the screen to the card, radius smooth(.2, 1) | spring k 150, c 23, delay 50 | same | SAME |
| Leave: picture and form return | same | `#sipv` opacity 0 to 1, scale 1.14, blur 14 px; `.si-l` opacity | 560 ms delay 100; 300 ms delay 200 | same | SAME |
| Leave: Broth flight back | same | holder arcs from the agent avatar | spring k 150, c 21 | not ported (no avatar) | SKIPPED |
| Filter flash | any swap with the dark page filter | `html{transition:filter}` suppressed for two frames | `commitNT` | `still()` in `transitions.js` | SAME |
| Entrance guard | during a transition | `window.__entering` set for 1600 to 1800 ms; motion.js and life.js skip entrances; `.si-in` children excluded | yes | added to `motion.js` and `life.js`, set by `transitions.js` | SAME |
| Sign-in entrance | first render of the sign-in | one crossfade, no per-child stagger | `.si-in` excluded from the page entrance | one opacity fade of the page (`sifade` .35 s) and the per-child stagger in `life.js` `onboarding` is skipped for `#sin` | CHANGED on purpose (user asked for a single crossfade) |
| Holder bob | idle | `.pvholder` translateY -.6cqh | 4.2 s ease-in-out infinite | same | SAME |
| Holder drop-in | first render | opacity and scale from .94 | .8 s | removed (crossfade only) | CHANGED on purpose |
| Wordmark writes itself | first render | B drawn, rest stroked then filled | 900 ms view widen, 720 ms strokes, 520 ms fill | `wordmark.js` is the same code | SAME |
| Rail hover and press | pointer | `.rl` background .15 s, press scale .92 | tokens `--dur-fast` | same CSS | SAME |
| Rail tooltip | hover or focus | opacity and translate .12 s | .12 s | same CSS | SAME |
| Docs card hover | hover | translateY -2 px, image scale 1.04 | .22 s and .5 s | same CSS | SAME |
| Docs topic to article image FLIP | click a card | image travels from the card to the list head | 520 ms cubic-bezier(.2,.85,.2,1) | not ported: the real docs are routed pages and the audience cards lead to articles | OPEN |
| Docs topic stagger | return to the list | cards rise 12 px | 360 ms, 45 ms stagger | not ported | OPEN |
| Docs article swap | pick another article | fade out 90 ms, in 260 ms | yes | real docs navigate between routes | OPEN |
| Reduced motion | `prefers-reduced-motion` | all of the above off | `RM()` checks | transitions skip, CSS animations off, wordmark shows finished | SAME |

## Measured

- Sign-out brightness (dark, 1440 by 900, 40 screenshots about 60 ms apart): prototype peak 29.3, max frame-to-frame jump 2.4. Real, before the fix: peak 236 (a white flash, the overlay used the panel's pre-inversion colour). Real, after: peak 39.5, max jump 6.2.
- Not yet sampled frame by frame: the dive and rise curves (transform, opacity, filter series against the prototype). The spring constants are identical, so the curves should agree; this has not been verified numerically.
- Not measured: page entrance curves for app screens, docs animations, toast, popover, modal and drawer motion.
