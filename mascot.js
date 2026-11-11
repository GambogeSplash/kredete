/* Mascot: the Broth bowl. A small character for the home screen and the thinking state.
 * Idle bob, blink, rising steam, eyes that follow the pointer, a squish on press.
 * Built on the Motion library (motion.dev). Respects reduced motion: it then sits still. */
(() => {
const M = window.Motion;
const RM = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const NS = 'http://www.w3.org/2000/svg';

function svg(uid) {
  return `<svg class="bm-svg" viewBox="0 0 120 124" role="img" aria-label="Broth" focusable="false">
  <defs>
    <linearGradient id="bmb${uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8d97ee"/><stop offset="1" stop-color="#4f5bc4"/></linearGradient>
    <radialGradient id="bmr${uid}" cx=".5" cy=".5" r=".6"><stop offset="0" stop-color="#ffe3a3"/><stop offset="1" stop-color="#f6b93b"/></radialGradient>
  </defs>
  <ellipse class="bm-shadow" cx="60" cy="118" rx="30" ry="4" fill="#14172b" opacity=".12"/>
  <g class="bm-steam" fill="none" stroke="#b9c0f5" stroke-width="3.5" stroke-linecap="round">
    <path class="bm-s1" d="M44 38c-5-5 5-8 0-14"/>
    <path class="bm-s2" d="M60 34c-5-5 5-8 0-14"/>
    <path class="bm-s3" d="M76 38c-5-5 5-8 0-14"/>
  </g>
  <g class="bm-body">
    <path d="M10 56h100c0 34-20 56-50 56S10 90 10 56z" fill="url(#bmb${uid})"/>
    <ellipse cx="60" cy="56" rx="50" ry="11" fill="#eef0ff"/>
    <ellipse cx="60" cy="57" rx="43" ry="7.5" fill="url(#bmr${uid})"/>
    <ellipse cx="48" cy="55" rx="5" ry="1.8" fill="#fff" opacity=".55"/>
    <g class="bm-face">
      <ellipse class="bm-cheek" cx="35" cy="88" rx="7" ry="4.5" fill="#ff9bb3" opacity=".6"/>
      <ellipse class="bm-cheek" cx="85" cy="88" rx="7" ry="4.5" fill="#ff9bb3" opacity=".6"/>
      <g class="bm-eyes">
        <ellipse class="bm-eye" cx="46" cy="80" rx="4.6" ry="5.4" fill="#14172b"/>
        <ellipse class="bm-eye" cx="74" cy="80" rx="4.6" ry="5.4" fill="#14172b"/>
        <circle cx="47.6" cy="78" r="1.5" fill="#fff"/><circle cx="75.6" cy="78" r="1.5" fill="#fff"/>
      </g>
      <path class="bm-mouth" d="M53 90q7 7 14 0" fill="none" stroke="#14172b" stroke-width="3" stroke-linecap="round"/>
    </g>
  </g>
</svg>`;
}

let n = 0;
function mount(host, opts) {
  if (!host || host.dataset.bm) return null;
  host.dataset.bm = '1';
  const uid = ++n;
  host.classList.add('bm');
  if (opts && opts.size) host.style.width = host.style.height = opts.size + 'px';
  host.innerHTML = svg(uid);
  const $ = (s) => host.querySelector(s);
  const eyes = [...host.querySelectorAll('.bm-eye')];
  const handle = { state: 'idle', stop() {}, set(s) { handle.state = s; host.dataset.state = s; } };
  if (!M || RM()) return handle;
  const { animate } = M;
  const stops = [];
  const keep = (a) => { if (a && a.stop) stops.push(a); return a; };
  const body = $('.bm-body'), shadow = $('.bm-shadow'), mouth = $('.bm-mouth');
  body.style.transformOrigin = '60px 112px'; body.style.transformBox = 'view-box';
  shadow.style.transformOrigin = '60px 118px';
  const spring = { type: 'spring', stiffness: 420, damping: 15 };

  // entrance: drops in and lands
  animate(host, { opacity: [0, 1] }, { duration: .25 });
  animate(body, { y: [-26, 0], scaleY: [1.12, 1], scaleX: [.94, 1] }, { type: 'spring', stiffness: 260, damping: 11 });

  // idle: a slow bob with the shadow breathing underneath
  keep(animate(body, { y: [0, -4] }, { duration: 1.9, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut', delay: .9 }));
  keep(animate(shadow, { scaleX: [1, .86], opacity: [.12, .08] }, { duration: 1.9, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut', delay: .9 }));

  // steam: three wisps rise and fade, out of step
  ['.bm-s1', '.bm-s2', '.bm-s3'].forEach((s, i) => {
    const el = $(s);
    keep(animate(el, { y: [4, -9], opacity: [0, .9, 0] }, { duration: 2.4, repeat: Infinity, ease: 'easeOut', delay: i * .55 + .6 }));
  });

  // blink every few seconds, sometimes twice
  let blinkT = 0;
  const blink = () => {
    if (!host.isConnected) return;
    eyes.forEach((e) => { e.style.transformBox = 'fill-box'; e.style.transformOrigin = 'center'; });
    animate(eyes, { scaleY: [1, .1, 1] }, { duration: .16 });
    blinkT = setTimeout(blink, 2200 + Math.random() * 2600);
  };
  blinkT = setTimeout(blink, 1800);

  // eyes follow the pointer a few pixels, so it feels like it is looking at you
  const look = (e) => {
    const r = host.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height * .65;
    const dx = Math.max(-1, Math.min(1, (e.clientX - cx) / 260)), dy = Math.max(-1, Math.min(1, (e.clientY - cy) / 260));
    animate($('.bm-eyes'), { x: dx * 3.2, y: dy * 2.4 }, { type: 'spring', stiffness: 260, damping: 22 });
    animate($('.bm-mouth'), { x: dx * 1.6 }, { type: 'spring', stiffness: 260, damping: 22 });
  };
  document.addEventListener('pointermove', look, { passive: true });

  // press: squish and pop back; the mouth opens into a happy "o" for a moment
  host.addEventListener('pointerdown', () => {
    animate(body, { scaleY: .88, scaleX: 1.07 }, { duration: .1 });
    mouth.setAttribute('d', 'M54 89q6 9 12 0');
  });
  const up = () => { animate(body, { scaleY: 1, scaleX: 1 }, spring); mouth.setAttribute('d', 'M53 90q7 7 14 0'); };
  host.addEventListener('pointerup', up); host.addEventListener('pointerleave', up);

  // states: thinking makes the steam faster and the eyes look up
  handle.set = (s) => {
    handle.state = s; host.dataset.state = s;
    const up = s === 'thinking';
    animate($('.bm-eyes'), { y: up ? -4 : 0 }, { type: 'spring', stiffness: 300, damping: 20 });
    host.querySelectorAll('.bm-steam path').forEach((p) => { p.style.strokeWidth = up ? '4.5' : '3.5'; });
  };
  handle.stop = () => { clearTimeout(blinkT); document.removeEventListener('pointermove', look); stops.forEach((a) => a.stop()); };
  const obs = new MutationObserver(() => { if (!host.isConnected) { handle.stop(); obs.disconnect(); } });
  obs.observe(document.body, { childList: true, subtree: true });
  return handle;
}

window.BROTH_MASCOT = { mount, svg };
/* mount on any .bm the app draws, wherever it draws it */
const scan = () => document.querySelectorAll('.bm:not([data-bm])').forEach((h) => mount(h));
new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
scan();
})();
