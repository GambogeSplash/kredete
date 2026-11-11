/* The icon rail: the same places as the sidebar list, as large line icons down the far left (desktop). */
(() => {
const $ = (s, r = document) => r.querySelector(s);
const MENU = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M5 9h14M5 15h14"/></svg>';
window.BROTH_RAIL = () => {
  const src = [...document.querySelectorAll('#surfaces .snav .surf')];
  let rail = $('#rail');
  if (!rail) { rail = document.createElement('nav'); rail.id = 'rail'; rail.className = 'rail'; rail.setAttribute('aria-label', 'Main'); document.body.insertBefore(rail, $('.top')); }
  rail.innerHTML = '<div class="rl-grp"></div><button type="button" class="rl rl-menu" id="rlmenu" aria-label="Show or hide chats" title="Show or hide chats">' + MENU + '</button>';
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
    b.setAttribute('aria-label', label); b.title = label; b.setAttribute('aria-current', s.getAttribute('aria-current') || 'false');
    const ic = $('svg', s); if (ic) { const c = ic.cloneNode(true); c.setAttribute('width', 22); c.setAttribute('height', 22); b.appendChild(c); }
    b.onclick = () => s.click();
    grp.appendChild(b);
  });
  $('#rlmenu').onclick = () => { const t = document.body.classList.contains('sbc') ? $('#sbopen') : $('#sbtog'); if (t) t.click(); };
};
})();
