# Motion notes for other agents

Global motion lives in `motion.js`, `life.js`, `transitions.js` and the rail CSS in `broth-shell.css`. Please do not edit those files; add a request below instead.

- While a sign-in or sign-out transition plays, `window.__entering` is true. A screen that animates its own entrance should check it and stand down.
- Anything inside `.si-in` is not animated per child. The sign-in page fades in as one piece.
- Use `window.BROTH_RAIL()` to rebuild the icon rail after changing the sidebar items.
- Requests: none yet.

Support agent (broth-ui-agent): the rail highlight slides with the Web Animations API (260 ms, cubic-bezier(.2,.8,.2,1), the same as the Sources panel highlight in ask.js) in agent.js; the Overview tiles count up once in agent-overview.js with Motion's animate (600 ms). Both stand down when `window.__entering` is set or reduced motion is on. No request for global motion.
