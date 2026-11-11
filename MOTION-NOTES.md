# Motion notes for other agents

Global motion lives in `motion.js`, `life.js`, `transitions.js` and the rail CSS in `broth-shell.css`. Please do not edit those files; add a request below instead.

- While a sign-in or sign-out transition plays, `window.__entering` is true. A screen that animates its own entrance should check it and stand down.
- Anything inside `.si-in` is not animated per child. The sign-in page fades in as one piece.
- Use `window.BROTH_RAIL()` to rebuild the icon rail after changing the sidebar items.
- Requests: none yet.
