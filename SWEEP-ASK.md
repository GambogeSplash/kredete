# Ask sweep (rule by rule against the prototype working tree)

Method (scripts kept in the session scratchpad, ask2/):
1. Every CSS rule added or changed in the prototype since fd142d7 (components.css, styles.css) that touches Ask: 102 selector rows after splitting lists. Each row is probed with Playwright in both apps in the states home, home with panel, conversation with panel (dark and light, 1440): real :hover, :focus-visible, :active, and getComputedStyle of the declared properties.
2. A class-by-class crawl of every element under #app (about 100 distinct tag.class pairs per state) comparing 37 computed properties, plus a hover pass on every interactive element. States: home, home with panel, conversation with panel, conversation default, thinking, in dark and light at 1440 and 390.
3. A behaviour script on the real app (16 checks: no autofocus, avatar open and X, sources chip, Shift+Enter, Enter sends, answer actions, cite pulse, tab slide, rename, more menu).

Result: 102 rule rows, 0 unexplained differences after the fixes below. Rows skipped because the element is not in these views: 55 to 80 per state (profile and activity panels, edit message, onboarding, sign-in).

## Fixes made
- The Sources chip on home opened a drawer; it now opens the panel like the prototype (drawer only on phones).
- Home composer was autofocused (purple ring on load); the prototype is not. Removed.
- Example cards lifted 2 px on hover; the prototype's entrance animation holds the resting transform so they never lift. Lift removed.
- Panel on home had no tabs; now Answer and Sources tabs like a chat.
- Panel tab height was 28 px; now 34 px like the prototype.
- In a chat the panel is open by default from 1200 px (prototype panelOn()), closing it sticks for the session, a new chat resets.
- Avatar card is a circle under 901 px and a squircle above (prototype media rule).
- Retry link in notices was underlined; now plain.
- Empty and error states are framed (.ds-empty): no sources, empty chat, failed answer with Try again, nothing connected, no sources match, sources load error, empty chat list in the sidebar.
- (i) hints added earlier were removed at the user's request.

## Explained differences (real-app constraints)
- First tab is Activity in the prototype and Answer in the real app (no activity feed in the API).
- Attach and mic buttons, edit and resend, version switcher, bookmark (other branch): not in the real app.
- Chat title width, message widths and answer heights follow the data.
- Real date chip uses a time element; the prototype uses text.
- Real title has position relative for the rename underline.

## Not verified
Streaming motion curves were not sampled frame by frame; e2e specs were not run (need broth-service). Specs that assume the panel is closed in a chat may need a look.
