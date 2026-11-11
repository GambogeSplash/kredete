# Ask completeness (prototype enterprise-brain vs real client)

Status: done = present and matched in the real app with real data. browser-only = kept in the browser, no backend. needs-backend = the real API has nothing for it, not revived.

| Element or behaviour | Prototype source | In real? | Action | Status |
|---|---|---|---|---|
| Home Broth wordmark (B draws, then writes) | mascot.js, app.js renderAsk | yes (wordmark.js) | timing measured equal | done |
| Time-aware greeting with real first name | app.js renderAsk | yes (me.nickname or first name) | kept | done |
| Placeholder typewriter cycle | app.js renderAsk | yes | kept | done |
| Composer: up-arrow send, Enter sends, Shift+Enter newline, auto-grow | app.js composer | yes | tested | done |
| Home composer not focused on load | app.js | was autofocused | removed autofocus | done |
| Mic: dictate into the input (Web Speech API, hidden when unsupported), recording state | toggleMic | yes | ported, metrics equal | browser-only |
| Attach button and file chips (up to 5, 10 MB, remove, drop on composer) | addFiles, attCard | yes | ported; chips stay on this device, send ignores them with a toast | browser-only |
| Sending attached files to Broth, Library picker | attachMenu | no | the API has no file endpoint | needs-backend |
| Source count chip opens the panel (not a drawer) on desktop | #cxsrc | was a drawer | fixed | done |
| Four example cards with source icons | .lh-sug | yes | card lift on hover removed (prototype holds no lift) | done |
| Reading from N connected apps | .lh-feed | yes, from /v1/facets | kept | done |
| Panel closed by default on home, avatar button with green dot, X | .hometog, .cxclose | yes | kept | done |
| Panel tabs on home | renderPanel | missing | tabs added (Answer, Sources) | done |
| Activity tab, stats, waiting-for-you card | renderPanel | no | not built | needs-backend |
| Profile tab (access, memberships) | renderPanel | no | not built | needs-backend |
| Panel open by default in a chat from 1200 px | panelOn() | was closed | default open, closing persists in the session, new chat resets | done |
| Tab highlight slide, body slide | renderPanel | yes | kept | done |
| Thread header: rename with underline draw, more menu, sources toggle | cxtitle, cxmore, cxtog | yes | tested | done |
| User message slide-in, parts in order | life.js chat() | yes (shared life.js) | unchanged | done |
| Answer blocks, source pill, citations, copy, regenerate, thumbs, follow-ups | turnEl | yes | metrics equal | done |
| Bookmark button on an answer | fbHtml | no here | lives on branch broth-ui-account | browser-only |
| Edit and resend a question, version switcher | .uedit, .uver | no | API has no edit | needs-backend |
| Follow-up composer with caption | .cxcomp, .cxcap | yes | equal | done |
| Next-step card (.nxt), first-run guidance | app.js | first-run flow in auth.js | not part of Ask here | n/a |
| Thinking, streaming, stop, stopped, error, not found, conflict, low confidence | turnEl | yes, from the real stream | viewed | done |
| Retry link without underline | .link | underlined in notices | fixed | done |
| Mobile: sheet for the panel, round avatar | mobile.css | yes | avatar made round under 901 px | done |
| Ask motion (stagger, springs, focus scale) | life.js | yes | not edited | done |

Rows 28 | done 22 | browser-only 3 | needs-backend 3. Empty states are framed; no (i) hints in Ask.
