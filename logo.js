/* logo.js: the company logo square beside a Company field (the Broth prototype's sign-up row).
 *
 * The square shows the first letter of the company at first. With LOGO_LOOKUP on, it then asks Google's favicon
 * service (t3.gstatic.com, allowed by the CSP's img-src) for a few domains guessed from the company name and the
 * email's domain, and shows the first real logo that comes back. Without one, "Upload yours" takes an image, which is
 * cut to a square and kept in a local library in this browser, checked first on the next lookup.
 * Nothing here is sent to Broth's API: the company and its logo stay in this browser (localStorage).
 */
(() => {
'use strict';
/** Turn the web lookup off to stop every request to the favicon service; the letter and the upload stay. */
const LOGO_LOOKUP = true;
const LIB_KEY = 'broth-logo-lib';
const COMPANY_KEY = 'broth-company';
/** @type {(s: string, r?: ParentNode) => any} */
const $ = (s, r = document) => r.querySelector(s);
const esc = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') || d; } catch (e) { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } };
const slug = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

/** Loads one candidate domain's favicon; resolves with its width (0 when there is none). */
const probe = (d) => new Promise((resolve) => {
  const url = `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://${d}&size=128`;
  const im = new Image();
  im.referrerPolicy = 'no-referrer';
  const t = setTimeout(() => resolve({ d, w: 0, url }), 5000);
  im.onload = () => { clearTimeout(t); resolve({ d, w: im.naturalWidth, url }); };
  im.onerror = () => { clearTimeout(t); resolve({ d, w: 0, url }); };
  im.src = url;
});

/**
 * @param {ParentNode} root  holds #sulogo, #suco, #sulf and #sumiss
 * @param {{ domain?: () => string, toast?: (m: string) => void }} [opts]
 */
function mount(root, opts = {}) {
  const lb = $('#sulogo', root), co = $('#suco', root), lf = $('#sulf', root), miss = $('#sumiss', root), up = $('#sulu', root);
  if (!lb || !co) return;
  const saved = read(COMPANY_KEY, {});
  const st = { company: '', logo: null, kind: null, key: '', miss: false };
  if (saved.name) { co.value = saved.name; st.company = saved.name; if (saved.logo) { st.logo = saved.logo; st.kind = saved.kind || 'lib'; st.key = slug(saved.name); } }
  let seq = 0, timer = 0;
  const paint = (busy) => {
    const ch = (st.company || '').trim().charAt(0).toUpperCase() || 'B';
    lb.className = 'adlogo sm' + (st.logo ? (st.kind === 'found' ? ' found' : ' has') : '') + (busy ? ' busy' : '');
    lb.innerHTML = (st.logo ? `<img src="${esc(st.logo)}" alt="" draggable="false" referrerpolicy="no-referrer">` : esc(ch)) + '<em class="adlogoe" aria-hidden="true">+</em>';
    lb.setAttribute('aria-label', st.logo ? 'Change company logo' : 'Add company logo');
    if (miss) miss.hidden = !(st.miss && !st.logo && !busy);
  };
  const remember = () => write(COMPANY_KEY, { name: st.company, logo: st.kind === 'found' ? null : st.logo, kind: st.kind });
  const find = async () => {
    const key = slug(st.company);
    const mine = ++seq;
    if (!key) { if (st.kind !== 'upload') { st.logo = null; st.kind = null; } st.miss = false; paint(); return; }
    if (st.kind === 'upload' && st.key === key) { st.miss = false; paint(); return; }
    const lib = read(LIB_KEY, {})[key];
    if (lib) { Object.assign(st, { logo: lib, kind: 'lib', key, miss: false }); paint(); return; }
    if (!LOGO_LOOKUP) { Object.assign(st, { logo: null, kind: null, key, miss: true }); paint(); return; }
    paint(true);
    const dom = ((opts.domain && opts.domain()) || '').split('@')[1] || '';
    const label = dom.split('.')[0].toLowerCase();
    const own = label && (label === key || key.includes(label) || label.includes(key)) ? [dom] : [];
    const cands = [...new Set([...own, `${key}.com`, `${key}.io`, `${key}.co`, `${key}.ai`, `${key}.app`, `${key}.so`])];
    const res = await Promise.all(cands.map(probe));
    if (mine !== seq) return;
    const hit = res.filter((x) => x.w > 16).sort((x, y) => (Number(y.w >= 64) - Number(x.w >= 64)) || cands.indexOf(x.d) - cands.indexOf(y.d))[0];
    if (hit) Object.assign(st, { logo: hit.url, kind: 'found', key, miss: false });
    else Object.assign(st, { logo: null, kind: null, key, miss: true });
    paint();
  };
  const changed = () => {
    st.company = co.value.trim();
    if (st.kind === 'upload' && st.key !== slug(st.company)) { st.logo = null; st.kind = null; }
    remember();
    if (!st.logo || st.kind !== 'upload') { paint(true); clearTimeout(timer); timer = window.setTimeout(find, 420); }
  };
  co.addEventListener('input', changed);
  const pick = () => lf && lf.click();
  lb.onclick = pick;
  if (up) up.onclick = pick;
  if (lf) {
    lf.onchange = () => {
      const f = lf.files && lf.files[0];
      if (!f) return;
      if (f.size > 4 * 1024 * 1024) { if (opts.toast) opts.toast('Pick an image under 4 MB'); return; }
      const url = URL.createObjectURL(f);
      const im = new Image();
      im.onload = () => {
        const n = 192, c = document.createElement('canvas');
        c.width = c.height = n;
        const r = Math.min(im.width, im.height) || 1;
        c.getContext('2d').drawImage(im, (im.width - r) / 2, (im.height - r) / 2, r, r, 0, 0, n, n);
        URL.revokeObjectURL(url);
        const data = c.toDataURL('image/png');
        Object.assign(st, { logo: data, kind: 'upload', key: slug(st.company), miss: false });
        const key = slug(st.company);
        if (key) { const lib = read(LIB_KEY, {}); lib[key] = data; write(LIB_KEY, lib); }
        remember();
        paint();
      };
      im.onerror = () => { URL.revokeObjectURL(url); if (opts.toast) opts.toast('That file could not be read as an image'); };
      im.src = url;
    };
  }
  paint();
  if (st.company && !st.logo) find();
}

window.BROTH_LOGO = { mount, LOGO_LOOKUP };
})();
