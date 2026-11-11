/* transitions.js: the sign-in <-> app transition (ported from the Broth prototype), driven by motion.dev.
 *
 * Continue with Google: the dashboard card in the sign-in picture grows until it fills the screen, then the
 * browser goes to Google. A flag in sessionStorage tells the app, when it paints after the return, to lift that
 * same colour away and let the shells settle in. Signing out plays it in reverse. Neither runs for people who
 * ask for reduced motion, on a phone, or when the picture is not on screen: they go straight there.
 * Every animation here is Motion's `animate` (window.Motion, vendor/motion.js): timed tweens and springs.
 */
(() => {
'use strict';
const A = window.AUTH;
if (!A) return;
const FLAG = 'broth-enter';
const EASE = [0.2, 0.8, 0.2, 1];
/** @type {(s: string, r?: ParentNode) => any} */
const $ = (s, r = document) => r.querySelector(s);
const html = document.documentElement;
const motion = () => window.Motion && window.Motion.animate;
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches || innerWidth < 900 || !motion();
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
/** While a transition plays, the page's own entrance animations stand down (motion.js and life.js check this). */
function guard(ms) { window.__entering = true; setTimeout(() => { window.__entering = false; }, ms); }
function overlay() {
  const el = document.createElement('div');
  el.className = 'brx';
  el.setAttribute('aria-hidden', 'true');
  document.body.appendChild(el);
  return el;
}
const box = (r) => ({ left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
const FULL = () => ({ left: '0px', top: '0px', width: innerWidth + 'px', height: innerHeight + 'px' });
const lerp = (a, b, p) => a + (b - a) * p;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** A timed tween on an element: `ms` and `delay` in milliseconds, `ease` a bezier array or a Motion easing name. */
const tween = (el, props, ms, delay, ease) => window.Motion.animate(el, props, { duration: ms / 1000, delay: (delay || 0) / 1000, ease: ease || EASE });
/** The prototype's small spring, as a Motion spring from 0 to 1 (k stiffness, c damping). `on` gets the value each frame. */
const spring = (o) => window.Motion.animate(0, 1, { type: 'spring', stiffness: o.k || 150, damping: o.c || 18, mass: 1, delay: (o.delay || 0) / 1000, restDelta: o.eps || 0.0007, restSpeed: o.eps ? 0.6 : 0.01, onUpdate: o.on });
/** Motion leaves the last keyframe as an inline style: clear it so the element goes back to its stylesheet. */
const clear = (el, ...props) => { if (el) props.forEach((p) => { el.style[p] = ''; }); };

/** Sign-in: the card dives, then `go()` leaves for Google. */
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
  const ctl = [];
  if (sl) ctl.push(tween(sl, { opacity: [1, 0], transform: ['translateX(0px) scale(1)', 'translateX(-22px) scale(0.985)'], filter: ['blur(0px)', 'blur(4px)'] }, 300, 0, [0.4, 0, 0.2, 1]));
  if (frame) ctl.push(tween(frame, { transform: ['scale(1)', 'scale(1.16)'], filter: ['blur(0px)', 'blur(14px)'], opacity: [1, 0] }, 520, 70, [0.5, 0, 0.2, 1]));
  const rad = parseFloat(cs.borderTopLeftRadius) || 18;
  const sx = innerWidth / r.width, sy = innerHeight / r.height;
  Object.assign(c.style, { transformOrigin: '0 0', willChange: 'transform' });
  const dive = spring({ k: 210, c: 29, eps: 0.006, delay: 70, on: (x) => {
    c.style.transform = `translate(${-r.left * x}px,${-r.top * x}px) scale(${lerp(1, sx, x)},${lerp(1, sy, x)})`;
    c.style.borderRadius = lerp(rad, 0, smooth(0, 0.8, x)) + 'px';
    c.style.boxShadow = x < 0.15 ? cs.boxShadow : 'none';
  } });
  const leave = () => go();
  dive.finished.then(leave, leave);
  // Back from Google out of the page cache: the dive is over, show the sign-in again.
  window.addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    ov.remove(); card.style.visibility = '';
    ctl.concat([dive]).forEach((a) => { try { a.stop(); } catch (err) { /* already done */ } });
    clear(sl, 'opacity', 'transform', 'filter'); clear(frame, 'opacity', 'transform', 'filter');
    try { sessionStorage.removeItem(FLAG); } catch (err) { /* storage unavailable */ }
  }, { once: true });
};

/** The app's first paint after a sign-in: the card's colour lifts away, the shells settle in. */
A.rise = () => {
  let flag = null;
  try { flag = JSON.parse(sessionStorage.getItem(FLAG) || 'null'); sessionStorage.removeItem(FLAG); } catch (e) { /* storage unavailable */ }
  if (!flag || Date.now() - flag.at > 120000 || calm()) return;
  guard(1600);
  const ov = overlay();
  const c = document.createElement('div');
  const [r, g, b] = flag.rgb;
  Object.assign(c.style, FULL(), { position: 'absolute', background: `rgb(${raw(r)},${raw(g)},${raw(b)})` });
  ov.appendChild(c);
  /* each shell starts offset and settles; its inline transform/opacity is cleared after, so fixed children keep working */
  const settle = (el, from, to, delay, dur, fade) => {
    if (!el) return;
    el.style.transform = from;
    if (fade) el.style.opacity = '0';
    const props = { transform: [from, to] };
    if (fade) props.opacity = [0, 1];
    tween(el, props, dur, delay).finished.then(() => clear(el, 'transform', 'opacity'), () => clear(el, 'transform', 'opacity'));
  };
  settle($('.top'), 'translateX(-26px)', 'translateX(0px)', 40, 680, false);
  settle($('.mainpanel'), 'translateY(12px) scale(0.988)', 'translateY(0px) scale(1)', 90, 680, false);
  settle($('#rail'), 'translateX(-12px)', 'translateX(0px)', 0, 520, true);
  const done = () => ov.remove();
  tween(c, { opacity: [1, 0] }, 460, 60, 'easeOut').finished.then(done, done);
};

/** Signing out is the dive in reverse: the app dims, the sign-in is switched on beneath, the card shrinks into the picture. */
A.leave = (commit) => {
  if (calm()) { commit(); return; }
  /* Already on a picture screen (first-run welcome, setup wizard): there is no app to dim. The picture stays where it is; only the form column fades out, the sign-in is switched on, and its form fades back in (the page-level fade is held off for this swap so the picture does not blink). */
  if ($('#sipv')) {
    const hold = html.classList;
    const swap = () => {
      hold.add('keepframe');
      guard(1400);
      still(commit);
      const si = $('.si');
      if (si) si.setAttribute('data-nofade', '');
      const l = $('.si-l');
      if (l) { l.style.opacity = '0'; tween(l, { opacity: [0, 1], transform: ['translateY(8px)', 'translateY(0px)'] }, 360).finished.then(() => clear(l, 'opacity', 'transform')); }
      setTimeout(() => hold.remove('keepframe'), 800);
    };
    const sl = $('.si-l');
    if (sl) tween(sl, { opacity: [1, 0], transform: ['translateX(0px)', 'translateX(-12px)'] }, 200, 0, 'easeIn').finished.then(swap, swap);
    else swap();
    return;
  }
  const mp = $('.mainpanel');
  // In dark the panel's own colour is pre-inversion; what is on screen is the dark of the sign-in card.
  const [pr, pg, pb] = dark() ? [19, 19, 20] : rgb(mp ? getComputedStyle(mp).backgroundColor : 'rgb(255,255,255)');
  const ov = overlay();
  const c = document.createElement('div');
  Object.assign(c.style, FULL(), { position: 'absolute', background: `rgb(${raw(pr)},${raw(pg)},${raw(pb)})`, opacity: '0' });
  ov.appendChild(c);
  const dim = tween(c, { opacity: [0, 1] }, 300, 0, 'easeOut');
  const run = () => {
    guard(1800);
    still(commit);
    const frame = $('#sipv');
    const card = frame && $('.pvmock .pvm', frame);
    if (!card) { tween(c, { opacity: [1, 0] }, 300, 0, 'easeOut').finished.then(() => ov.remove(), () => ov.remove()); return; }
    const r = card.getBoundingClientRect();
    const cs = getComputedStyle(card);
    try { dim.stop(); } catch (e) { /* already done */ }
    Object.assign(c.style, { opacity: '1', position: 'absolute', boxSizing: 'border-box', background: cs.backgroundColor });
    card.style.visibility = 'hidden';
    frame.style.opacity = '0';
    tween(frame, { opacity: [0, 1], transform: ['scale(1.1)', 'scale(1)'], filter: ['blur(12px)', 'blur(0px)'] }, 560, 100).finished.then(() => clear(frame, 'opacity', 'transform', 'filter'));
    const sl = $('.si-l');
    if (sl) { sl.style.opacity = '0'; tween(sl, { opacity: [0, 1] }, 300, 200, 'easeOut').finished.then(() => clear(sl, 'opacity')); }
    const rad = parseFloat(cs.borderTopLeftRadius) || 18;
    const shrink = spring({ k: 150, c: 23, delay: 50, on: (x) => {
      Object.assign(c.style, { left: lerp(0, r.left, x) + 'px', top: lerp(0, r.top, x) + 'px', width: lerp(innerWidth, r.width, x) + 'px', height: lerp(innerHeight, r.height, x) + 'px', borderRadius: lerp(0, rad, smooth(0.2, 1, x)) + 'px', border: x > 0.7 ? '1px solid ' + cs.borderTopColor : '0' });
    } });
    const end = () => { card.style.visibility = ''; ov.remove(); };
    shrink.finished.then(end, end);
  };
  dim.finished.then(run, run);
};
})();
