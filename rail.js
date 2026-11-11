/* The icon rail: the same places as the sidebar list, as large line icons down the far left (desktop). */
(() => {
const $ = (s, r = document) => r.querySelector(s);
const MENU = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M5 9h14M5 15h14"/></svg>';
const wide = matchMedia('(min-width:901px)');
let TR = null; /* the account block: kept by reference so a redraw of the rail never throws it away */
function placeAccount() {
  if (!TR || !TR.isConnected) TR = $('.top-right') || TR;
  const slot = $('#rlacct');
  if (!TR) return;
  if (wide.matches && slot) { if (TR.parentElement !== slot) slot.appendChild(TR); }
  else if (TR.parentElement !== $('.top')) $('.top').appendChild(TR);
}
wide.addEventListener('change', placeAccount);
window.BROTH_RAIL = () => {
  const src = [...document.querySelectorAll('#surfaces .snav .surf')];
  let rail = $('#rail');
  if (!rail) { rail = document.createElement('nav'); rail.id = 'rail'; rail.className = 'rail'; rail.setAttribute('aria-label', 'Main'); document.body.insertBefore(rail, $('.top')); }
  if (TR) $('.top').appendChild(TR);
  rail.innerHTML = '<button type="button" class="rl rl-menu" id="rlmenu" aria-label="Chats" data-tip="Chats">' + MENU + '</button><div class="rl-grp"></div><div class="rl-acct" id="rlacct"></div>';
  placeAccount();
  if (!$('#sbsearch')) {
    const sp = document.createElement('button');
    sp.type = 'button'; sp.id = 'sbsearch'; sp.className = 'sbsearch';
    sp.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg><span>Search</span><kbd>\u2318K</kbd>';
    sp.onclick = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }));
    $('.top').insertBefore(sp, $('#surfaces'));
  }
  const grp = $('.rl-grp', rail);
  src.forEach((s) => {
    const label = ($('span', s) || s).textContent.trim();
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'rl' + (s.classList.contains('finish') ? ' finish' : '');
    b.setAttribute('aria-label', label); b.dataset.tip = label; if (/search/i.test(label)) b.dataset.key = '\u2318K'; b.setAttribute('aria-current', s.getAttribute('aria-current') || 'false');
    const ic = $('svg', s); if (ic) { const c = ic.cloneNode(true); c.setAttribute('width', 22); c.setAttribute('height', 22); b.appendChild(c); }
    if (s.dataset.badge && s.dataset.badge !== '0') { const d = document.createElement('i'); d.className = 'rl-dot'; d.textContent = s.dataset.badge; b.appendChild(d); }
    b.onclick = () => s.click();
    grp.appendChild(b);
  });
  $('#rlmenu').onclick = () => { const t = document.body.classList.contains('sbc') ? $('#sbopen') : $('#sbtog'); if (t) t.click(); };
};

/* one shared tooltip for the rail: instant, beside the icon, with the shortcut when there is one */
const tip = document.createElement('div'); tip.id = 'rltip'; tip.className = 'rltip'; tip.setAttribute('role', 'tooltip');
(document.body || document.documentElement).appendChild(tip);
const tlabel = (el) => el.dataset.tip || el.getAttribute('aria-label') || '';
const show = (el) => { const t = tlabel(el); if (!t) return; tip.innerHTML = '<span></span>' + (el.dataset.key ? '<kbd>' + el.dataset.key + '</kbd>' : ''); tip.firstChild.textContent = t; const r = el.getBoundingClientRect(); tip.style.left = (r.right + 10) + 'px'; tip.style.top = (r.top + r.height / 2) + 'px'; tip.classList.add('on'); };
const hide = () => tip.classList.remove('on');
const TSEL = '.rail .rl, .rail .acct';
document.addEventListener('pointerover', (e) => { const el = e.target.closest && e.target.closest(TSEL); if (el) show(el); else hide(); });
document.addEventListener('focusin', (e) => { const el = e.target.closest && e.target.closest(TSEL); if (el && e.target.matches(':focus-visible')) show(el); });
document.addEventListener('focusout', hide);
document.addEventListener('pointerdown', hide);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
})();
