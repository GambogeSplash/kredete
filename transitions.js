/* transitions.js: the sign-in <-> app transition (ported from the Broth prototype).
 *
 * Continue with Google: the dashboard card in the sign-in picture grows until it fills the screen, then the
 * browser goes to Google. A flag in sessionStorage tells the app, when it paints after the return, to lift that
 * same colour away and let the shells settle in. Signing out plays it in reverse. Neither runs for people who
 * ask for reduced motion, on a phone, or when the picture is not on screen: they go straight there.
 */
(() => {
'use strict';
const A = window.AUTH;
if (!A) return;
const FLAG = 'broth-enter';
const EASE = 'cubic-bezier(.2,.8,.2,1)';
/** @type {(s: string, r?: ParentNode) => any} */
const $ = (s, r = document) => r.querySelector(s);
const html = document.documentElement;
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches || innerWidth < 900 || !document.body.animate;
const dark = () => html.dataset.mode === 'dark';
/** In dark mode the app sits under a page-wide inversion: this is the raw colour that shows as `v`. */
const raw = (v) => (dark() ? Math.round(Math.min(255, Math.max(0, ((0.93 - v / 255) / 0.86) * 255))) : v);
const rgb = (s) => (String(s).match(/\d+/g) || [255, 255, 255]).slice(0, 3).map(Number);
/** Runs `change` with the page's own filter transition off, so swapping screens never flashes. */
function still(change) {
  html.style.transition = 'none';
  change();
  requestAnimationFrame(() => requestAnimationFrame(() => { html.style.transition = ''; }));
}
function overlay() {
  const el = document.createElement('div');
  el.className = 'brx';
  el.setAttribute('aria-hidden', 'true');
  document.body.appendChild(el);
  return el;
}
const box = (r) => ({ left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
const FULL = () => ({ left: '0px', top: '0px', width: innerWidth + 'px', height: innerHeight + 'px' });
const keep = { fill: 'forwards', easing: EASE };

/** Sign-in: the card dives, then `go()` leaves for Google. Resolves after the dive. */
A.dive = (go) => {
  const frame = $('#sipv');
  const card = frame && $('.pvmock .pvm', frame);
  if (calm() || !card) { go(); return; }
  const r = card.getBoundingClientRect();
  const cs = getComputedStyle(card);
  const bg = rgb(cs.backgroundColor);
  try { sessionStorage.setItem(FLAG, JSON.stringify({ at: Date.now(), rgb: bg, dark: dark() })); } catch (e) { /* storage unavailable */ }
  const ov = overlay();
  const c = document.createElement('div');
  Object.assign(c.style, box(r), { position: 'absolute', boxSizing: 'border-box', background: cs.backgroundColor, border: '1px solid ' + cs.borderTopColor, borderRadius: cs.borderTopLeftRadius, boxShadow: cs.boxShadow });
  ov.appendChild(c);
  card.style.visibility = 'hidden';
  const sl = $('.si-l');
  if (sl) sl.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(-22px)' }], { duration: 300, ...keep });
  if (frame) frame.animate([{ opacity: 1, filter: 'blur(0)' }, { opacity: 0, filter: 'blur(12px)' }], { duration: 520, delay: 60, ...keep });
  const dive = c.animate([{ ...box(r), borderRadius: cs.borderTopLeftRadius }, { ...FULL(), borderRadius: '0px', boxShadow: 'none' }], { duration: 560, ...keep });
  const leave = () => go();
  dive.finished.then(leave, leave);
  // Back from Google out of the page cache: the dive is over, show the sign-in again.
  window.addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    ov.remove(); card.style.visibility = '';
    [sl, frame].forEach((n) => { if (n) n.getAnimations().forEach((a) => a.cancel()); });
    try { sessionStorage.removeItem(FLAG); } catch (err) { /* storage unavailable */ }
  }, { once: true });
};

/** The app's first paint after a sign-in: the card's colour lifts away, the shells settle in. */
A.rise = () => {
  let flag = null;
  try { flag = JSON.parse(sessionStorage.getItem(FLAG) || 'null'); sessionStorage.removeItem(FLAG); } catch (e) { /* storage unavailable */ }
  if (!flag || Date.now() - flag.at > 120000 || calm()) return;
  const ov = overlay();
  const c = document.createElement('div');
  const [r, g, b] = flag.rgb;
  Object.assign(c.style, FULL(), { position: 'absolute', background: `rgb(${raw(r)},${raw(g)},${raw(b)})` });
  ov.appendChild(c);
  const settle = (el, from, delay, dur) => { if (el && el.animate) el.animate([from, { transform: 'none', opacity: 1 }], { duration: dur, delay, easing: EASE, fill: 'backwards' }); };
  settle($('.top'), { transform: 'translateX(-26px)', opacity: 1 }, 40, 680);
  settle($('.mainpanel'), { transform: 'translateY(12px) scale(.988)', opacity: 1 }, 90, 680);
  settle($('#rail'), { transform: 'translateX(-12px)', opacity: 0 }, 0, 520);
  const out = c.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 460, delay: 60, easing: 'ease-out', fill: 'forwards' });
  const done = () => ov.remove();
  out.finished.then(done, done);
};

/** Signing out is the dive in reverse: the app dims, the sign-in is switched on beneath, the card shrinks into the picture. */
A.leave = (commit) => {
  if (calm()) { commit(); return; }
  const mp = $('.mainpanel');
  const [pr, pg, pb] = rgb(mp ? getComputedStyle(mp).backgroundColor : 'rgb(255,255,255)');
  const ov = overlay();
  const c = document.createElement('div');
  Object.assign(c.style, FULL(), { position: 'absolute', background: `rgb(${raw(pr)},${raw(pg)},${raw(pb)})`, opacity: '0' });
  ov.appendChild(c);
  const dim = c.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 280, easing: 'ease-out', fill: 'forwards' });
  const run = () => {
    still(commit);
    const frame = $('#sipv');
    const card = frame && $('.pvmock .pvm', frame);
    if (!card) { c.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' }).finished.then(() => ov.remove(), () => ov.remove()); return; }
    const r = card.getBoundingClientRect();
    const cs = getComputedStyle(card);
    c.getAnimations().forEach((a) => a.cancel());
    Object.assign(c.style, { opacity: '1', position: 'absolute', boxSizing: 'border-box', background: cs.backgroundColor });
    card.style.visibility = 'hidden';
    frame.animate([{ opacity: 0, transform: 'scale(1.1)', filter: 'blur(12px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }], { duration: 540, delay: 80, easing: EASE, fill: 'backwards' });
    const sl = $('.si-l');
    if (sl) sl.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320, delay: 200, easing: 'ease-out', fill: 'backwards' });
    const shrink = c.animate([{ ...FULL(), borderRadius: '0px' }, { ...box(r), borderRadius: cs.borderTopLeftRadius }], { duration: 520, ...keep });
    const end = () => { card.style.visibility = ''; ov.remove(); };
    shrink.finished.then(end, end);
  };
  dim.finished.then(run, run);
};
})();
