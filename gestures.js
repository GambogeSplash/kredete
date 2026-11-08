/* Touch gestures and haptics for the phone layout (900px and below).
   - Swipe from the left edge to open the menu, drag it closed again (it follows your finger)
   - Drag any bottom sheet down to dismiss it
   - Long-press a chat in the menu for its actions
   - Light haptic ticks on taps and at gesture thresholds
   Nothing here runs on desktop. */
(() => {
const B = window.BRAIN; if (!B) return;
const mq = matchMedia('(max-width:900px)'); const calm = matchMedia('(prefers-reduced-motion: reduce)');
const $ = (s, r = document) => r.querySelector(s);
const hap = k => { try { B.haptic(k); } catch (e) {} };
const body = document.body;
const drawer = () => $('header.top'); const scrim = () => $('#navscrim');
const W = () => Math.min(innerWidth * 0.86, 320);

/* ---------- drawer: edge swipe in, drag out ---------- */
let g = null; // active gesture
/* a horizontally scrolling area (tab strip, attachment row, code block) that is scrolled away from its start keeps its own swipes */
const hScroller = el => { for (let n = el; n && n !== document.body; n = n.parentElement) { if (n.scrollWidth > n.clientWidth + 1 && /auto|scroll/.test(getComputedStyle(n).overflowX) && n.scrollLeft > 0) return n; } return null; };
const setDrawer = (px, anim) => { const d = drawer(); if (!d) return; d.style.transition = anim ? '' : 'none'; d.style.transform = 'translateX(' + (px - W()) + 'px)'; const s = scrim(); if (s) { s.style.transition = anim ? '' : 'none'; s.style.opacity = String(Math.max(0, Math.min(1, px / W()))); s.style.pointerEvents = px > 8 ? 'auto' : 'none'; } body.style.setProperty('--dx', Math.max(0, Math.min(1, px / W())).toFixed(3)); };
const clearDrawer = () => { const d = drawer(), s = scrim(); if (d) { d.style.transition = ''; d.style.transform = ''; } if (s) { s.style.transition = ''; s.style.opacity = ''; s.style.pointerEvents = ''; } body.style.removeProperty('--dx'); };
const setOpen = o => { clearDrawer(); body.classList.toggle('navopen', o); const m = $('#mbmenu'); if (m) m.setAttribute('aria-expanded', o); };

document.addEventListener('touchstart', e => {
  if (!mq.matches || e.touches.length !== 1) return; const t = e.touches[0]; const open = body.classList.contains('navopen');
  const inSheet = e.target.closest('.cxside, .modal-wrap .modal, .pmenu');
  const hs = hScroller(e.target);
  if (!open && t.clientX <= 22 && !hs && !e.target.closest('input,textarea,select')) g = { kind: 'drawer-in', x: t.clientX, y: t.clientY, t0: performance.now(), dx: 0, moved: false, tick: false };
  else if (open && (e.target.closest('header.top') || e.target.closest('#navscrim'))) g = { kind: 'drawer-out', x: t.clientX, y: t.clientY, t0: performance.now(), dx: 0, moved: false, tick: false };
  else if (inSheet) { const sh = e.target.closest('.cxside') || e.target.closest('.modal') || e.target.closest('.pmenu'); const r = sh.getBoundingClientRect(); const handleZone = t.clientY - r.top < 64 && !hs; if (handleZone) g = { kind: 'sheet', el: sh, x: t.clientX, y: t.clientY, t0: performance.now(), dy: 0, moved: false, tick: false }; }
}, { passive: true });

document.addEventListener('touchmove', e => {
  if (!g) return; const t = e.touches[0]; const dx = t.clientX - g.x, dy = t.clientY - g.y;
  if (!g.moved) { if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return; const horiz = Math.abs(dx) > Math.abs(dy) * 1.2; if ((g.kind === 'sheet') ? !(dy > 0 && !horiz) : !horiz) { g = null; return; } g.moved = true; if (g.kind === 'sheet') g.el.style.setProperty('animation', 'none', 'important'); }
  if (g.kind === 'drawer-in') { g.dx = Math.max(0, Math.min(W(), dx)); setDrawer(g.dx, false); if (!g.tick && g.dx > W() * 0.45) { g.tick = true; hap('select'); } }
  else if (g.kind === 'drawer-out') { g.dx = Math.max(-W(), Math.min(0, dx)); setDrawer(W() + g.dx, false); if (!g.tick && -g.dx > W() * 0.4) { g.tick = true; hap('select'); } }
  else if (g.kind === 'sheet') { g.dy = Math.max(0, dy); g.el.style.transition = 'none'; g.el.style.transform = 'translateY(' + g.dy + 'px)'; if (!g.tick && g.dy > 90) { g.tick = true; hap('select'); } }
}, { passive: true });

const end = () => { if (!g) return; const v = (performance.now() - g.t0) || 1; const cur = g; g = null; if (!cur.moved) return;
  if (cur.kind === 'drawer-in') { const open = cur.dx > W() * 0.4 || (cur.dx > 64 && cur.dx / v > 0.45); if (open) { hap('light'); } setOpen(open); if (open) { /* re-run slide to rest */ } }
  else if (cur.kind === 'drawer-out') { const close = -cur.dx > W() * 0.35 || (-cur.dx > 56 && -cur.dx / v > 0.45); if (close) hap('light'); setOpen(!close); }
  else if (cur.kind === 'sheet') { const dismiss = cur.dy > 110 || cur.dy / v > 0.6; const el = cur.el; if (dismiss && el.classList.contains('pmenu')) { hap('light'); el.style.transition = calm.matches ? 'none' : 'transform .24s cubic-bezier(.4,0,1,1)'; el.style.transform = 'translateY(110%)'; setTimeout(() => { document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); if (el.isConnected) el.remove(); }, calm.matches ? 0 : 220); } else if (dismiss) { hap('light'); el.style.transition = calm.matches ? 'none' : 'transform .24s cubic-bezier(.4,0,1,1)'; el.style.transform = 'translateY(110%)'; setTimeout(() => { el.style.transition = ''; el.style.transform = ''; el.style.removeProperty('animation'); if (el.classList.contains('cxside')) { const x = $('#cxclose'); if (x) x.click(); } else B.closeModal(); }, 220); } else { el.style.transition = 'transform .28s cubic-bezier(.2,.8,.2,1)'; el.style.transform = ''; setTimeout(() => { el.style.transition = ''; el.style.removeProperty('animation'); }, 300); } } };
document.addEventListener('touchend', end, { passive: true }); document.addEventListener('touchcancel', end, { passive: true });

/* tapping the dimmed area behind the sources sheet closes it */
document.addEventListener('click', e => { if (!mq.matches) return; const cx = e.target; if (cx.classList && cx.classList.contains('cx') && !cx.classList.contains('closed')) { const x = $('#cxclose'); if (x) x.click(); hap('light'); } });

/* ---------- long-press a chat for its actions ---------- */
let lp = null;
document.addEventListener('touchstart', e => { if (!mq.matches) return; const row = e.target.closest('.surf.chat'); if (!row || e.target.closest('.chedit')) return; const t = e.touches[0]; lp = { row, x: t.clientX, y: t.clientY, id: setTimeout(() => { const b = row.querySelector('.chedit'); if (b) { hap('medium'); row.dataset.lp = '1'; b.click(); } lp = null; }, 460) }; }, { passive: true });
document.addEventListener('touchmove', e => { if (!lp) return; const t = e.touches[0]; if (Math.hypot(t.clientX - lp.x, t.clientY - lp.y) > 8) { clearTimeout(lp.id); lp = null; } }, { passive: true });
document.addEventListener('touchend', () => { if (lp) { clearTimeout(lp.id); lp = null; } }, { passive: true });
document.addEventListener('click', e => { const r = e.target.closest('.surf.chat'); if (r && r.dataset.lp) { delete r.dataset.lp; e.stopPropagation(); e.preventDefault(); } }, true);

/* tapping outside the account sheet closes it; do not let that same tap hit the page underneath */
let eat = 0;
document.addEventListener('pointerdown', e => { if (!mq.matches) return; const m = $('.pmenu'); if (m && !m.contains(e.target) && !e.target.closest('.acct') && e.isTrusted) eat = performance.now() + 450; }, true);
document.addEventListener('click', e => { if (eat && performance.now() < eat) { e.stopPropagation(); e.preventDefault(); } eat = 0; }, true);

/* ---------- haptic ticks on taps ---------- */
const TICK = '.mbbtn,.surf,.dsend,.atab,.segb,.lchip,.gic,.gpill,.lh-sug,.att,.cxs,.kr,.pm-i,.pm-card,.avt,.cfrow,.gm-sug,.hrel,.btn,.fbtn,.fopt,.cmenu button,.tab';
document.addEventListener('pointerdown', e => { if (e.pointerType !== 'touch') return; if (e.target.closest(TICK)) hap('light'); }, { passive: true });

/* keep the chat scroll area padded by the floating composer's real height */
const syncComp = () => { const c = $('.cxcomp'), cx = $('.cx'); if (c && cx) cx.style.setProperty('--comp-h', c.offsetHeight + 'px'); };
if (window.ResizeObserver) { const ro = new ResizeObserver(syncComp); const watch = () => { const c = $('.cxcomp'); if (c) { ro.disconnect(); ro.observe(c); syncComp(); } }; new MutationObserver(watch).observe($('#app'), { childList: true }); watch(); }

/* menu button and drawer open/close also tick; keep the page content behind in sync */
const mm = $('#mbmenu'); if (mm) mm.addEventListener('click', () => hap('light'));
})();
