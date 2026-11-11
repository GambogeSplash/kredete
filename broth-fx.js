/* Chat motion from the Broth prototype: the trash can a deleted row sinks into, and the thin
 * line that draws under a renamed title. Both are skipped when the visitor prefers reduced motion. */
(() => {
'use strict';
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const TRASH = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 7h15M9.5 7V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2M6.5 7l.8 11.2a1.5 1.5 0 0 0 1.5 1.3h6.4a1.5 1.5 0 0 0 1.5-1.3L17.5 7M10 11v5M14 11v5"/></svg>';

/** The row sinks into a small trash can, then its space closes. Resolves when it is done. */
function trashRow(row) {
  if (!row || !row.animate || calm()) return Promise.resolve();
  const r = row.getBoundingClientRect();
  const h = r.height;
  const cx = Math.min(r.width / 2, 60);
  row.style.pointerEvents = 'none';
  row.style.overflow = 'hidden';
  const can = document.createElement('div');
  can.className = 'trashfx';
  can.setAttribute('aria-hidden', 'true');
  can.innerHTML = TRASH;
  can.style.left = (r.left + cx - 18) + 'px';
  can.style.top = (r.top + h / 2 - 18) + 'px';
  document.body.appendChild(can);
  can.animate([{ opacity: 0, transform: 'scale(.4) translateY(6px)' }, { opacity: 1, transform: 'scale(1) translateY(0)' }], { duration: 180, easing: 'cubic-bezier(.34,1.56,.64,1)', fill: 'forwards' });
  const done = () => can.remove();
  return row.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${cx - r.width / 2}px) scale(.35)` }], { duration: 320, delay: 80, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' }).finished
    .then(() => {
      can.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(-12deg)' }, { transform: 'rotate(8deg)' }, { transform: 'rotate(0)' }], { duration: 220 });
      return row.animate([{ height: h + 'px', opacity: 0 }, { height: '0px', opacity: 0, paddingTop: '0px', paddingBottom: '0px', marginTop: '0px', marginBottom: '0px' }], { duration: 200, easing: 'ease-out', fill: 'forwards' }).finished;
    })
    .then(() => can.animate([{ opacity: 1 }, { opacity: 0, transform: 'scale(.8)' }], { duration: 160, fill: 'forwards' }).finished)
    .then(done, done);
}

/** A renamed title fades in and a thin line draws under it once. Call after the lists have redrawn. */
function renamed(title) {
  if (calm()) return;
  const t = String(title).trim().slice(0, 30);
  [...document.querySelectorAll('.dtitle,#surfaces .surf.chat .chn,.chr .actt b')].filter((e) => e.textContent.trim().startsWith(t)).forEach((txt) => {
    if (!txt.animate) return;
    txt.animate([{ opacity: 0.25 }, { opacity: 1 }], { duration: 320, easing: 'ease-out' });
    if (getComputedStyle(txt).position === 'static') txt.style.position = 'relative';
    const ln = document.createElement('i');
    ln.className = 'rnline';
    ln.setAttribute('aria-hidden', 'true');
    txt.appendChild(ln);
    const gone = () => ln.remove();
    ln.animate([{ transform: 'scaleX(0)', opacity: 0.9 }, { transform: 'scaleX(1)', opacity: 0.9 }], { duration: 340, easing: 'cubic-bezier(.3,.7,.2,1)', fill: 'forwards' }).finished
      .then(() => ln.animate([{ opacity: 0.9 }, { opacity: 0 }], { duration: 360, easing: 'ease-out', fill: 'forwards' }).finished)
      .then(gone, gone);
  });
}
window.BROTH_FX = { trashRow, renamed };
})();
