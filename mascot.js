/* Mascot: Broth, the fuzzy indigo character with a steam crown. Used on the new chat page and as the agent avatar.
 * Idle bob, a drop-in landing, a squish on press, and a small tilt towards the pointer.
 * Built on the Motion library (motion.dev). Respects reduced motion: it then sits still. */
(() => {
const M = window.Motion;
const RM = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const FULL = 'assets/brand/mascot.png';
const HEAD = 'assets/brand/mascot-head.png';

function svg(kind) {
  return `<img class="bm-img" src="${kind === 'full' ? FULL : HEAD}" alt="Broth" draggable="false">`;
}

function mount(host) {
  if (!host || host.dataset.bm) return null;
  host.dataset.bm = '1';
  host.classList.add('bm');
  host.innerHTML = svg('full');
  const img = host.querySelector('img');
  const handle = { state: 'idle', stop() {}, set(s) { handle.state = s; host.dataset.state = s; } };
  if (!M || RM()) return handle;
  const { animate } = M;
  const stops = [];
  img.style.transformOrigin = '50% 100%';
  animate(host, { opacity: [0, 1] }, { duration: .25 });
  animate(img, { y: [-30, 0], scaleY: [1.1, 1], scaleX: [.95, 1] }, { type: 'spring', stiffness: 260, damping: 11 });
  stops.push(animate(img, { y: [0, -5] }, { duration: 2.1, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut', delay: .9 }));
  const look = (e) => {
    const r = host.getBoundingClientRect();
    const dx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / 360));
    animate(img, { rotate: dx * 4 }, { type: 'spring', stiffness: 160, damping: 20 });
  };
  document.addEventListener('pointermove', look, { passive: true });
  host.addEventListener('pointerdown', () => animate(img, { scaleY: .92, scaleX: 1.05 }, { duration: .1 }));
  const up = () => animate(img, { scaleY: 1, scaleX: 1 }, { type: 'spring', stiffness: 420, damping: 15 });
  host.addEventListener('pointerup', up); host.addEventListener('pointerleave', up);
  handle.stop = () => { document.removeEventListener('pointermove', look); stops.forEach((a) => a.stop && a.stop()); };
  const obs = new MutationObserver(() => { if (!host.isConnected) { handle.stop(); obs.disconnect(); } });
  obs.observe(document.body, { childList: true, subtree: true });
  return handle;
}

window.BROTH_MASCOT = { mount, svg: () => svg('head') };
/* mount on any .bm the app draws, wherever it draws it */
const scan = () => document.querySelectorAll('.bm:not([data-bm])').forEach((h) => mount(h));
new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
scan();
/* the logomark on the new chat page: lands softly, then floats */
const lmScan = () => document.querySelectorAll('.lm:not([data-lm])').forEach((h) => {
  h.dataset.lm = '1';
  const img = h.querySelector('svg') || h.querySelector('img'); if (!img || !M || RM()) return;
  M.animate(img, { y: [-24, 0], scale: [.9, 1], opacity: [0, 1] }, { type: 'spring', stiffness: 260, damping: 14 });
  M.animate(img, { y: [0, -4] }, { duration: 2.4, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut', delay: .8 });
});
new MutationObserver(lmScan).observe(document.documentElement, { childList: true, subtree: true });
lmScan();
})();
