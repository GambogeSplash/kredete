# Merge notes

Branch `broth-ui-final` was cut from `broth-ui-all` and prepared for a pull request. Nothing was merged into `integration` or `main`.

## Which branch is the target

Evidence from the repository (GambogeSplash/kredete):

- The default branch is `main`.
- Pull request history: #1 integration to main (merged), #2 port-broth-animations to main (merged), #3 port-broth-animations-2 to integration (merged), #4 broth-port to main (open).
- `origin/integration` has 64 commits that `main` does not (the teammate's backend wiring work). `main` has 3 that `integration` does not (#1 merge commit, #2 and its commit `350fcec`).
- `broth-ui-all` already contained the tip of `integration` (merge base equals `origin/integration` at 87c169a), so nothing from the teammate on `integration` was missing.
- Per the user, a push to `integration` deploys production, so the pull request goes into `integration`. Branch history shows both targets have been used, so the user should confirm before opening it.

## Merges done

1. `origin/main` into `broth-ui-final`. One conflict.
2. `origin/broth-ui-all` (newer tip, commit 38bc84d, Help center Inbox mentions) into `broth-ui-final`. No conflict.
3. Re-merge of `broth-ui-all` and `origin/main` at the end, see the last section.

## Conflicts

| File | Conflict | Decision |
|---|---|---|
| ask.js (sources panel tab slide, `renderPanel`) | `main` commit 350fcec added the pill and body slide using `window._cxPrev` and a local `calm` constant. This branch already had the same animation, using a module variable `pillAt` and a `calm()` helper. Same behaviour, same easing, same durations. | Kept this branch's version (module variable, no window global). Nothing of the teammate's or main's behaviour is dropped. `node --check` and the unit tests pass. |

index.html did not conflict. Its script and link cache-bust versions are the highest of both sides (nothing on main touched it).

## vercel.json

Identical to `origin/integration`. Against `origin/main` it differs by: the `/v1` rewrite points at the Railway API (main still has `tunnel.invalid`), the dark-theme script hash, `img-src` adds `https://t3.gstatic.com`, and the `/embed-demo.html` header rule. These are already on `integration`.
