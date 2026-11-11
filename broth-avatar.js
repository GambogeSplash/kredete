/* Avatars, from the Broth prototype: a library of nine pictures, a default picked from the person's email,
 * and a picker (library, upload, or back to the default). The real app has no avatar endpoint, so the choice
 * is kept in this browser only (localStorage `broth-avatar:<user id>`). */
(() => {
'use strict';
const B = window.BRAIN;
/** @type {(s: string, r?: ParentNode) => any} */
const $ = (s, r = document) => r.querySelector(s);
const esc = B.esc;
const KEY = (id) => 'broth-avatar:' + id;

const LIB = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => ({ id: 'a' + n, src: '/assets/avatars/a' + n + '.png' }));
const srcOf = (av) => {
  if (!av) return '';
  if (av.kind === 'photo') return av.data || '';
  if (av.kind === 'lib') { const x = LIB.find((a) => a.id === av.id); return x ? x.src : ''; }
  return '';
};
const byKey = (key) => {
  let h = 0;
  String(key || '').toLowerCase().split('').forEach((c) => { h = (h * 31 + c.charCodeAt(0)) >>> 0; });
  return LIB[h % LIB.length].src;
};
function mine() {
  const me = B.S.me;
  if (!me) return null;
  try { return JSON.parse(localStorage.getItem(KEY(me.id)) || 'null'); } catch (e) { return null; }
}
function keep(av) {
  const me = B.S.me;
  if (!me) return;
  try { if (av) localStorage.setItem(KEY(me.id), JSON.stringify(av)); else localStorage.removeItem(KEY(me.id)); } catch (e) { /* storage unavailable */ }
}

/** The prototype's AVATAR: your own picture for you, a picture picked from the name for everyone else. */
window.AVATAR = (name, cls, px) => {
  const n = String(name || '').replace(/\(.*\)/, '').trim();
  const me = B.S.me;
  let src;
  if (me && n && n.toLowerCase() === String(me.name || '').toLowerCase()) src = srcOf(mine()) || byKey(me.email || me.name);
  else src = byKey(n);
  const size = px ? `width:${px}px;height:${px}px` : '';
  return `<img class="${cls || 'avimg'}" src="${src}" alt="${esc(n)}" title="${esc(n)}" width="${px || 24}" height="${px || 24}" style="${size}">`;
};

function picker() {
  const me = B.S.me;
  if (!me) return;
  const m = $('#modal');
  let sel = mine();
  const prev = () => {
    const el = $('#avprev');
    if (!el) return;
    el.innerHTML = `<img src="${srcOf(sel) || byKey(me.email || me.name)}" alt="">`;
  };
  const grid = () => {
    const g = $('#avgrid');
    g.innerHTML = `<button type="button" class="avt avup" id="avup" aria-label="Upload a photo"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg><span>Upload</span></button>`
      + (sel && sel.kind === 'photo' ? `<button type="button" class="avt on" data-av="photo" aria-pressed="true" aria-label="Your photo"><img src="${sel.data}" alt=""></button>` : '')
      + LIB.map((a) => { const on = sel && sel.kind === 'lib' && sel.id === a.id; return `<button type="button" class="avt ${on ? 'on' : ''}" data-av="${a.id}" aria-pressed="${on ? 'true' : 'false'}" aria-label="Avatar ${a.id.slice(1)}"><img src="${a.src}" alt=""></button>`; }).join('');
    $('#avup').onclick = () => $('#avfile').click();
    g.querySelectorAll('[data-av]').forEach((b) => {
      b.onclick = () => { if (b.dataset.av === 'photo') return; sel = { kind: 'lib', id: b.dataset.av }; B.haptic('select'); prev(); grid(); };
    });
  };
  m.innerHTML = `<div class="modal avpick" role="dialog" aria-modal="true" aria-label="Choose your avatar"><div class="bar"><span>Choose your avatar</span><button type="button" class="link" id="mclose">Close</button></div><div class="body avbody"><div class="avprev" id="avprev"></div><div class="avgrid" id="avgrid"></div><input type="file" id="avfile" accept="image/*" hidden><p class="suhint">Your picture is kept on this device only.</p><div class="actions"><button type="button" class="btn" id="avrm">Use the default</button><span class="lsp"></span><button type="button" class="btn primary" id="avsave">Save</button></div></div></div>`;
  m.classList.add('on');
  m.setAttribute('aria-hidden', 'false');
  $('#mclose').onclick = B.closeModal;
  prev();
  grid();
  $('#avrm').onclick = () => { sel = null; prev(); grid(); };
  $('#avfile').onchange = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    if (f.size > 4 * 1024 * 1024) { B.toast('Pick an image under 4 MB'); return; }
    const fr = new FileReader();
    fr.onload = () => {
      const im = new Image();
      im.onload = () => {
        const c = document.createElement('canvas');
        c.width = c.height = 256;
        const g = c.getContext('2d');
        const k = Math.min(im.width, im.height);
        g.drawImage(im, (im.width - k) / 2, (im.height - k) / 2, k, k, 0, 0, 256, 256);
        sel = { kind: 'photo', data: c.toDataURL('image/jpeg', 0.86) };
        prev();
        grid();
      };
      im.onerror = () => B.toast('That file could not be read as an image');
      im.src = String(fr.result);
    };
    fr.readAsDataURL(f);
  };
  $('#avsave').onclick = () => {
    keep(sel);
    B.closeModal();
    B.toast('Avatar saved on this device');
    B.haptic('success');
    if (window.AUTH && window.AUTH.mountAccount) window.AUTH.mountAccount();
    B.route();
  };
}
document.addEventListener('click', (e) => {
  const b = /** @type {any} */ (e.target).closest && /** @type {any} */ (e.target).closest('#avchg');
  if (b) { e.preventDefault(); picker(); }
});
})();
