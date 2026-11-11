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
const keep = { fill: 'forwards', easing: EASE };
const lerp = (a, b, p) => a + (b - a) * p;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** The prototype's small spring: eases to 1 with a little overshoot, stepped frame by frame (k stiffness, c damping). */
const spring = (o) => new Promise((resolve) => {
  let x = 0, v = 0, last = performance.now();
  const t0 = last, kk = o.k || 150, cc = o.c || 18;
  const tick = (now) => {
    const dt = Math.min(0.032, (now - last) / 1000);
    last = now;
    if (now - t0 >= (o.delay || 0)) {
      const n = Math.max(1, Math.ceil(dt / 0.004)), h = dt / n;
      for (let i = 0; i < n; i += 1) { v += (-kk * (x - 1) - cc * v) * h; x += v * h; }
      o.on(x);
      if (Math.abs(x - 1) < (o.eps || 0.0007) && Math.abs(v) < (o.eps ? 0.6 : 0.01)) { o.on(1); resolve(); return; }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});

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
  if (sl) sl.animate([{ opacity: 1, transform: 'none', filter: 'blur(0)' }, { opacity: 0, transform: 'translateX(-22px) scale(.985)', filter: 'blur(4px)' }], { duration: 300, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
  if (frame) frame.animate([{ transform: 'scale(1)', filter: 'blur(0px)', opacity: 1 }, { transform: 'scale(1.16)', filter: 'blur(14px)', opacity: 0 }], { duration: 520, delay: 70, easing: 'cubic-bezier(.5,0,.2,1)', fill: 'forwards' });
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
    [sl, frame].forEach((n) => { if (n) n.getAnimations().forEach((a) => a.cancel()); });
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
  /* Already on a picture screen (first-run welcome, setup wizard): there is no app to dim. The picture stays where it is; only the form column fades out, the sign-in is switched on, and its form fades back in (the page-level fade is held off for this swap so the picture does not blink). */
  if ($('#sipv')) {
    const hold = document.documentElement.classList;
    const M = window.Motion;
    const ease = [0.2, 0.8, 0.2, 1];
    const swap = () => {
      hold.add('keepframe');
      still(commit);
      const l = $('.si-l');
      if (l && M && M.animate) { l.style.opacity = '0'; M.animate(l, { opacity: [0, 1], transform: ['translateY(8px)', 'translateY(0px)'] }, { duration: 0.36, ease }).finished.then(() => { l.style.opacity = ''; l.style.transform = ''; }); }
      setTimeout(() => hold.remove('keepframe'), 800);
    };
    const sl = $('.si-l');
    if (sl && M && M.animate) M.animate(sl, { opacity: [1, 0], transform: ['translateX(0px)', 'translateX(-12px)'] }, { duration: 0.2, ease: 'easeIn' }).finished.then(swap, swap);
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
  const dim = c.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: 'ease-out', fill: 'forwards' });
  const run = () => {
    guard(1800);
    still(commit);
    const frame = $('#sipv');
    const card = frame && $('.pvmock .pvm', frame);
    if (!card) { c.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' }).finished.then(() => ov.remove(), () => ov.remove()); return; }
    const r = card.getBoundingClientRect();
    const cs = getComputedStyle(card);
    c.getAnimations().forEach((a) => a.cancel());
    Object.assign(c.style, { opacity: '1', position: 'absolute', boxSizing: 'border-box', background: cs.backgroundColor });
    card.style.visibility = 'hidden';
    frame.animate([{ opacity: 0, transform: 'scale(1.1)', filter: 'blur(12px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }], { duration: 560, delay: 100, easing: EASE, fill: 'backwards' });
    const sl = $('.si-l');
    if (sl) sl.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: 200, easing: 'ease-out', fill: 'backwards' });
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
