/* logo.js: the company logo square beside a Company field (the Broth prototype's sign-up row).
 *
 * The square shows the first letter of the company. Nothing is guessed: the company name is just a name, and the email
 * is never used. When the person types their company's website in the optional Company website field, and it looks like
 * a host, Google's favicon service (t3.gstatic.com, allowed by the CSP's img-src) is asked for that one host, once, about
 * 600 ms after typing stops; its logo is shown if it is bigger than 16 px. Otherwise "Upload yours" takes an image,
 * which is cut to a square and kept in a local library in this browser.
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

/** Loads one host's favicon; resolves with its width (0 when there is none). */
const probe = (d) => new Promise((resolve) => {
  const url = `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://${d}&size=128`;
  const im = new Image();
  im.referrerPolicy = 'no-referrer';
  const t = setTimeout(() => resolve({ w: 0, url }), 5000);
  im.onload = () => { clearTimeout(t); resolve({ w: im.naturalWidth, url }); };
  im.onerror = () => { clearTimeout(t); resolve({ w: 0, url }); };
  im.src = url;
});
/** Mailbox providers: a person's email on one of these says nothing about their company, so it never becomes a name or a logo lookup. */
const FREE = new Set(['gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'hotmail.co.uk', 'live.com', 'msn.com', 'yahoo.com', 'yahoo.co.uk', 'ymail.com', 'icloud.com', 'me.com', 'mac.com', 'proton.me', 'protonmail.com', 'pm.me', 'aol.com', 'gmx.com', 'gmx.net', 'zoho.com', 'yandex.com', 'yandex.ru', 'mail.com', 'fastmail.com', 'hey.com', 'tutanota.com', 'qq.com', '163.com']);
const isFree = (h) => FREE.has(String(h || '').toLowerCase());
/** The typed website as a bare host (scheme, path, query and port dropped), or '' when it does not look like one or is a mailbox provider. */
function host(value) {
  const h = String(value || '').trim().toLowerCase().replace(/^[a-z][a-z0-9+.-]*:\/\//, '').replace(/[/?#].*$/, '').replace(/:\d+$/, '');
  return /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(h) && !isFree(h) ? h : '';
}
/** What this browser saved for the workspace: { name, site, logo, kind }. */
const company = () => read(COMPANY_KEY, {});
/** A company name from an email's domain, or '' for a mailbox provider ("name@acme.co.uk" gives "Acme"). */
function derive(email) {
  const h = String(email || '').split('@')[1] || '';
  if (!h || isFree(h)) return '';
  const parts = h.toLowerCase().split('.');
  const label = parts.length >= 3 && ['co', 'com', 'org', 'net', 'ac', 'gov', 'edu'].includes(parts[parts.length - 2]) ? parts[parts.length - 3] : parts[parts.length - 2];
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : '';
}
/** The workspace name everywhere: the saved one, else one derived from a work email, else "Your workspace". */
const workspaceName = (email) => (company().name || '').trim() || derive(email) || 'Your workspace';
/** The workspace logo as an image address that is known to load, or '' (the saved upload, else the typed website's favicon when it is bigger than 16 px). */
async function workspaceLogo() {
  const c = company();
  if (c.logo) return c.logo;
  const h = host(c.site);
  if (!h || !LOGO_LOOKUP) return '';
  let hit = found.get(h);
  if (!hit) { hit = await probe(h); found.set(h, hit); }
  return hit.w > 16 ? hit.url : '';
}
/** The saved company as raw text, and a way to put it back: a dialog that is cancelled restores what was there. */
const snapshot = () => { try { return localStorage.getItem(COMPANY_KEY); } catch (e) { return null; } };
const restore = (raw) => { try { if (raw === null) localStorage.removeItem(COMPANY_KEY); else localStorage.setItem(COMPANY_KEY, raw); } catch (e) { /* storage unavailable */ } };
/** One answer per distinct host, kept for this page. */
const found = new Map();

/**
 * @param {ParentNode} root  holds #sulogo, #suco, #suweb, #sulf and #sumiss
 * @param {{ toast?: (m: string) => void }} [opts]
 */
function mount(root, opts = {}) {
  const lb = $('#sulogo', root), co = $('#suco', root), web = $('#suweb', root), lf = $('#sulf', root), miss = $('#sumiss', root), up = $('#sulu', root);
  if (!lb || !co) return;
  const saved = read(COMPANY_KEY, {});
  const st = { company: '', site: '', logo: null, kind: null, key: '', miss: false };
  if (saved.name) { co.value = saved.name; st.company = saved.name; if (saved.logo) { st.logo = saved.logo; st.kind = saved.kind || 'lib'; st.key = slug(saved.name); } }
  if (web && saved.site) { web.value = saved.site; st.site = saved.site; }
  let seq = 0, timer = 0;
  const paint = (busy) => {
    const ch = (st.company || '').trim().charAt(0).toUpperCase() || 'B';
    lb.className = 'adlogo sm' + (st.logo ? (st.kind === 'found' ? ' found' : ' has') : '') + (busy ? ' busy' : '');
    lb.innerHTML = (st.logo ? `<img src="${esc(st.logo)}" alt="" draggable="false" referrerpolicy="no-referrer">` : esc(ch)) + '<em class="adlogoe" aria-hidden="true">+</em>';
    lb.setAttribute('aria-label', st.logo ? 'Change company logo' : 'Add company logo');
    if (miss) miss.hidden = !(st.miss && !st.logo && !busy);
  };
  const remember = () => write(COMPANY_KEY, { name: st.company, site: st.site, logo: st.kind === 'found' ? null : st.logo, kind: st.kind });
  /** The name is only a name: it sets the letter and finds a logo the person uploaded before, nothing more. */
  const named = () => {
    st.company = co.value.trim();
    const key = slug(st.company);
    if (st.kind === 'upload' && st.key !== key) { st.logo = null; st.kind = null; }
    if (st.kind !== 'upload') {
      const lib = key ? read(LIB_KEY, {})[key] : null;
      if (lib) Object.assign(st, { logo: lib, kind: 'lib', key, miss: false });
      else if (st.kind === 'lib') { st.logo = null; st.kind = null; }
    }
    remember();
    paint();
  };
  /** Looks up the typed website, and only that. */
  const look = async () => {
    const h = host(st.site);
    const mine = ++seq;
    if (!h) {
      if (st.kind === 'found') { st.logo = null; st.kind = null; }
      st.miss = false;
      paint();
      return;
    }
    if (st.kind === 'upload' || st.kind === 'lib') { st.miss = false; paint(); return; }
    let hit = found.get(h);
    if (!hit) {
      paint(true);
      hit = await probe(h);
      found.set(h, hit);
      if (mine !== seq) return;
    }
    if (hit.w > 16) Object.assign(st, { logo: hit.url, kind: 'found', miss: false });
    else Object.assign(st, { logo: null, kind: null, miss: true });
    paint();
  };
  const sited = () => {
    st.site = web.value.trim();
    remember();
    clearTimeout(timer);
    if (!host(st.site)) { seq += 1; look(); return; }
    timer = window.setTimeout(look, 600);
  };
  co.addEventListener('input', named);
  if (web) web.addEventListener('input', sited);
  const pick = () => lf && lf.click();
  lb.onclick = pick;
  if (up) up.onclick = pick;
  if (lf) {
    lf.onchange = () => {
      const f = lf.files && lf.files[0];
      if (!f) return;
      const max = opts.maxBytes || 4 * 1024 * 1024;
      if (f.size > max) { if (opts.toast) opts.toast(`Pick an image under ${Math.round(max / 1048576)} MB`); return; }
      const reader = new FileReader();
      reader.onerror = () => { if (opts.toast) opts.toast('That file could not be read as an image'); };
      reader.onload = () => {
      const im = new Image();
      im.onload = () => {
        const n = 192, c = document.createElement('canvas');
        c.width = c.height = n;
        const r = Math.min(im.width, im.height) || 1;
        c.getContext('2d').drawImage(im, (im.width - r) / 2, (im.height - r) / 2, r, r, 0, 0, n, n);
        const data = c.toDataURL('image/png');
        Object.assign(st, { logo: data, kind: 'upload', key: slug(st.company), miss: false });
        const key = slug(st.company);
        if (key) { const lib = read(LIB_KEY, {}); lib[key] = data; write(LIB_KEY, lib); }
        remember();
        paint();
      };
      im.onerror = () => { if (opts.toast) opts.toast('That file could not be read as an image'); };
      im.src = String(reader.result);
      };
      reader.readAsDataURL(f);
    };
  }
  paint();
  if (host(st.site) && !st.logo) look();
}

window.BROTH_LOGO = { mount, LOGO_LOOKUP, host, isFree, company, derive, workspaceName, workspaceLogo, snapshot, restore };
})();
