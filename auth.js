/* auth.js: sign-in (sandbox spec 4.1), the boot error screen, the first-run welcome and the
 * account chrome (avatar button, profile menu, theme switch).
 *
 * Sign-in is a full-page navigation to GET /v1/auth/google/start. A refused sign-in comes
 * back to /signin?error=<reason> with a SignInFailure reason (identity/oidc.py).
 */
(() => {
'use strict';
const B = window.BRAIN;
/** @type {(s: string, r?: ParentNode) => any} */
const $ = (s, r = document) => r.querySelector(s);
/** @type {(s: string, r?: ParentNode) => any[]} */
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = B.esc;
const AUTH = {};

/** One message per SignInFailure reason, plus a fallback for anything new. */
const SIGNIN_ERRORS = {
  not_provisioned: ['You do not have access yet', 'Ask your Broth admin to invite the Google account you used.'],
  suspended: ['Your access is paused', 'Ask your Broth admin to restore it.'],
  wrong_domain: ['That is not a Broth account', 'Sign in with your Broth Google account.'],
  email_not_verified: ['Google has not verified that email address', 'Verify it in your Google account, then try again.'],
  invalid_state: ['That sign-in expired', 'It took too long or started in another browser. Try again.'],
  invalid_token: ['Google could not confirm who you are', 'Try again in a moment.'],
  provider_error: ['Google did not finish the sign-in', 'Try again. If you cancelled, nothing changed.'],
};
const FALLBACK_ERROR = ['Sign-in did not work', 'Try again. If it keeps happening, ask your Broth admin.'];
AUTH.signInError = (reason) => (reason ? SIGNIN_ERRORS[reason] || FALLBACK_ERROR : null);

/* ---------- the split shell: form on the left, a preview of the workspace on the right ---------- */
const brand = '<div class="si-brand"><span class="si-wm" role="img" aria-label="Broth"></span></div>';
const CLEARANCE_COL = { public: '#26a269', internal: '#3b82f6', confidential: '#e2a600', restricted: '#e5484d' };
function preview(person) {
  const sk = (w) => `<i class="pvsk" style="width:${w}px"></i>`;
  const systems = ((B.S.facets && B.S.facets.systems) || []).map((s) => s.value);
  const feed = systems.length
    ? `${systems.map((s) => B.srcIcon(s, 14)).join('')}<span>Reading from ${systems.length} connected ${systems.length === 1 ? 'app' : 'apps'}</span>`
    : `<span class="pvfsk">${sk(110)}</span>`;
  return `<div class="pvp" aria-hidden="true"><div class="pvw"><div class="pvs"><div class="pvws"><span class="pvk">K</span><b>Broth</b></div>${[['compose', 'New chat'], ['library', 'Library'], ['shield', 'Governance']].map(([i, l]) => `<div class="pvi">${ICON(i, 13)}<span>${l}</span></div>`).join('')}<div class="pvu">${person ? AVATAR(person.name, 'lav', 22) + `<span><b>${esc(person.name)}</b><small>${esc(person.team || '')}</small></span>` : `<i class="pvav"></i><span>${sk(70)}${sk(44)}</span>`}</div></div>
  <div class="pvm"><div class="pvg">${person ? `Hello, ${esc(person.first)}` : sk(120)}</div><div class="pvc"><span>Ask a question</span><i></i></div><div class="pvf">${feed}</div>${person ? `<div class="pvl"><i style="background:${CLEARANCE_COL[person.clearance] || CLEARANCE_COL.internal}"></i>${esc(B.clearanceName(person.clearance))} clearance</div>` : ''}</div></div><div class="pvcap">${person ? 'Your workspace' : 'Your workspace appears here'}</div></div>`;
}
AUTH.preview = preview;

/** Renders the split shell; keeps the right side when only the left changes. */
function shell(left, right, step) {
  document.body.classList.add('noauth');
  const app = $('#app');
  const dots = step ? `<div class="stp" role="img" aria-label="Step ${step[0]} of ${step[1]}">${Array.from({ length: step[1] }, (_, i) => `<i class="${i + 1 === step[0] ? 'on' : i + 1 < step[0] ? 'done' : ''}"></i>`).join('')}</div>` : '';
  if ($('.si.v2') && $('#sin')) {
    const c = $('#sin');
    c.innerHTML = dots + left;
    c.classList.remove('in'); void c.offsetWidth; c.classList.add('in');
    if (right != null) $('#sipv').innerHTML = right;
  } else {
    app.className = 'siapp';
    app.innerHTML = `<div class="si v2"><div class="si-l"><div class="si-in in" id="sin" aria-live="polite">${dots + left}</div></div><div class="si-r pv" id="sipv">${right || ''}</div></div>`;
  }
  const h = $('#sin h1');
  if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
}
AUTH.shell = shell;
AUTH.brand = brand;

/* ---------- sign-in ---------- */
window.SURFACES.signin = () => {
  const params = new URLSearchParams(location.search);
  const failure = AUTH.signInError(params.get('error'));
  // The account Google confirmed before Broth refused it; the server sends it in the fragment,
  // which never reaches a server or a log.
  const refused = failure ? new URLSearchParams(location.hash.slice(1)).get('email') : null;
  const unconfigured = B.S.setup && !B.S.setup.google_configured;
  const sub = B.sandbox()
    ? 'Continue with the Google account your Broth admin invited.'
    : 'Continue with your Broth Google account.';
  shell(`${brand}<h1>Sign in to Broth</h1><p class="sub">${sub}</p>
    ${failure ? `<div class="banner bad" role="alert" id="aerr"><b>${esc(failure[0])}.</b> ${esc(failure[1])}${refused ? `<span class="refused-as">Google account: ${esc(refused)}</span>` : ''}</div>` : ''}
    ${unconfigured ? `<div class="banner info" role="status"><b>Sign-in is not configured yet.</b> Your Broth admin finishes setup first.</div>` : ''}
    <a class="btn primary si-btn" id="gsignin" href="${B.api.signInUrl}" ${unconfigured ? 'aria-disabled="true" tabindex="-1"' : ''}><span class="spin" aria-hidden="true"></span><span>Continue with Google</span></a>
    <p class="disc">Broth answers from the documents you can already open.</p>`, preview(null));
  const button = $('#gsignin');
  button.onclick = (e) => {
    if (button.getAttribute('aria-disabled') === 'true') { e.preventDefault(); return; }
    button.classList.add('busy');
  };
  if (failure) history.replaceState({}, '', '/signin'); // the message stays; a reload starts clean, without the address
};

/* ---------- boot error ---------- */
AUTH.bootError = (error, retry) => {
  // Broth's own problem says what went wrong; without one, say what to do rather than repeat the heading.
  const head = error && error.reached ? 'Broth could not start' : 'Broth could not be reached';
  const body = error && error.reached ? B.problem(error) : 'Check your connection and try again. If it keeps happening, tell your Broth admin.';
  shell(`${brand}<h1>${head}</h1><p class="sub">${esc(body)}</p><button type="button" class="btn primary si-btn" id="bootretry"><span class="spin" aria-hidden="true"></span><span>Try again</span></button>`, preview(null));
  $('#bootretry').onclick = () => { $('#bootretry').classList.add('busy'); retry(); };
};

/* ---------- first-run welcome (the tour flag) ---------- */
const TOUR = 'brain-tour';
function toured() {
  try { return JSON.parse(localStorage.getItem(TOUR) || '[]'); } catch (e) { return []; }
}
function markToured(id) {
  try { localStorage.setItem(TOUR, JSON.stringify([...new Set([...toured(), id])])); } catch (e) { /* storage unavailable */ }
}
AUTH.needsWelcome = () => !!(B.S.me && !toured().includes(B.S.me.id));
AUTH.replayWelcome = () => {
  try { localStorage.setItem(TOUR, JSON.stringify(toured().filter((x) => x !== (B.S.me && B.S.me.id)))); } catch (e) { /* storage unavailable */ }
  B.go('/');
};
let ob = null;
AUTH.welcome = () => {
  const me = B.S.me;
  if (!ob || ob.id !== me.id) ob = { id: me.id, step: 1, nick: me.nickname || String(me.name).split(' ')[0], theme: THEME() };
  drawWelcome();
};
function drawWelcome() {
  const me = B.S.me, TOTAL = 3;
  const person = () => ({ name: me.name, first: ob.nick || me.name.split(' ')[0], team: me.team, clearance: me.clearance });
  const nav = (label) => `<div class="obnav"><button class="btn ob-back" id="obb" type="button" aria-label="Back" ${ob.step === 1 ? 'style="display:none"' : ''}><span class="flipx">${ICON('arrow', 18)}</span></button><button class="btn primary si-btn obgo" id="obn" type="button"><span class="spin" aria-hidden="true"></span><span>${label || 'Continue'}</span></button></div>`;
  let left = '';
  if (ob.step === 1) {
    left = `<h1>Is this you?</h1><div class="obid">${AVATAR(me.name, 'avimg', 56)}<div class="obidt"><b>${esc(me.name)}</b><span>${esc(me.title || me.email)}</span><small>${esc([me.team, me.location].filter(Boolean).join(' · '))}</small></div></div><label class="emlab" for="obnick">What should we call you?</label><input id="obnick" class="eminp" value="${esc(ob.nick)}" maxlength="60" autocomplete="off"><div class="hse" id="obe" role="alert"></div>${nav()}<button class="link obout" id="obout" type="button">Not you? Sign out</button>`;
  } else if (ob.step === 2) {
    left = `<h1>How should it look?</h1><div class="obopts" role="radiogroup" aria-label="Appearance">${[['light', 'Light'], ['dark', 'Dark'], ['system', 'Match my device']].map(([k, l]) => `<button class="obopt ${ob.theme === k ? 'on' : ''}" role="radio" aria-checked="${ob.theme === k}" data-th="${k}" type="button"><span class="obsw ${k}"></span><b>${l}</b></button>`).join('')}</div>${nav()}`;
  } else {
    const systems = (B.S.facets && B.S.facets.systems) || [];
    left = `<h1>What Broth can read for you</h1>${systems.length ? `<div class="obapps">${systems.map((s) => `<div class="obapp">${B.srcIcon(s.value, 26)}<b>${esc(B.systemName(s.value))}</b><span class="tag ok">${s.count} ${s.count === 1 ? 'document' : 'documents'}</span></div>`).join('')}</div><p class="sub obnote">Only what you can already open there.</p>` : `<p class="sub">Nothing is connected yet. Answers appear once your admin connects a source.</p>`}${nav('Start asking')}`;
  }
  shell(left, preview(person()), [ob.step, TOTAL]);
  const step = (d) => { ob.step = Math.max(1, Math.min(TOTAL, ob.step + d)); drawWelcome(); };
  $('#obb').onclick = () => step(-1);
  if (ob.step === 1) {
    const n = $('#obnick');
    n.oninput = () => { ob.nick = n.value.trim(); $('#sipv').innerHTML = preview(person()); };
    n.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); $('#obn').click(); } };
    n.focus();
    $('#obn').onclick = () => B.busy($('#obn'), async () => {
      const nickname = n.value.trim() || null;
      if (nickname !== (me.nickname || null) && nickname !== me.name.split(' ')[0]) {
        B.S.me = await B.api.patch('/me', { nickname });
      }
      step(1);
    }, (error) => { $('#obe').textContent = B.problem(error); });
    $('#obout').onclick = () => B.signOut();
  } else if (ob.step === 2) {
    $$('[data-th]').forEach((b) => {
      b.onclick = () => {
        ob.theme = b.dataset.th;
        applyTheme(ob.theme);
        $$('[data-th]').forEach((x) => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-checked', String(on)); });
      };
    });
    $('#obn').onclick = () => step(1);
  } else {
    $('#obn').onclick = () => { markToured(me.id); ob = null; B.go('/'); };
  }
}

/* ---------- theme ---------- */
const THEME = () => { try { return localStorage.getItem('brain-theme') || 'light'; } catch (e) { return 'light'; } };
const isDark = () => document.documentElement.dataset.mode === 'dark';
function applyTheme(mode) {
  try { localStorage.setItem('brain-theme', mode); } catch (e) { /* storage unavailable */ }
  const dark = mode === 'dark' || (mode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  if (dark) document.documentElement.dataset.mode = 'dark';
  else delete document.documentElement.dataset.mode;
  syncThemeButton();
}
function syncThemeButton() {
  const t = $('#thm');
  if (!t) return;
  const d = isDark();
  t.innerHTML = ICON(d ? 'sun' : 'moon', 18);
  t.setAttribute('aria-label', d ? 'Switch to light mode' : 'Switch to dark mode');
  t.title = d ? 'Light mode' : 'Dark mode';
}
AUTH.THEME = THEME;
AUTH.applyTheme = applyTheme;

/* ---------- account chrome ---------- */
AUTH.mountAccount = () => {
  const tr = $('.top-right');
  if (!$('#acct')) {
    const a = document.createElement('button');
    a.id = 'acct'; a.className = 'acct'; a.type = 'button';
    a.setAttribute('aria-label', 'Account'); a.setAttribute('aria-haspopup', 'menu'); a.setAttribute('aria-expanded', 'false');
    a.onclick = () => profileMenu(a);
    tr.append(a);
  }
  if (!$('#thm')) {
    const t = document.createElement('button');
    t.id = 'thm'; t.className = 'thm'; t.type = 'button';
    t.onclick = () => {
      applyTheme(isDark() ? 'light' : 'dark');
      B.haptic('select');
      if (t.animate && !matchMedia('(prefers-reduced-motion: reduce)').matches) t.animate([{ transform: 'rotate(-70deg) scale(.6)', opacity: 0.3 }, { transform: 'none', opacity: 1 }], { duration: 280, easing: 'cubic-bezier(.2,.8,.2,1)' });
    };
    tr.append(t);
  }
  syncThemeButton();
  const me = B.S.me;
  $('#acct').innerHTML = AVATAR(me.name, 'avimg', 28) + `<span class="acct-t"><b>${esc(me.name)}</b><small>${esc(me.team || me.email)}</small></span><svg class="acct-c" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7.5L6 4.5l3 3"/></svg>`;
};

let pm = null;
function closeMenu(refocus) {
  if (!pm) return;
  const { el, a } = pm;
  pm = null;
  el.remove();
  a.setAttribute('aria-expanded', 'false');
  document.removeEventListener('pointerdown', outside, true);
  window.removeEventListener('resize', onResize);
  if (refocus) a.focus({ preventScroll: true });
}
const outside = (e) => { if (pm && !pm.el.contains(e.target) && !pm.a.contains(e.target)) closeMenu(false); };
const onResize = () => closeMenu(false);
function profileMenu(a) {
  if (pm) { closeMenu(true); return; }
  const me = B.S.me;
  const current = B.S.route.surface;
  const item = (k, l, ic) => `<button type="button" class="pm-i" role="menuitem" data-pm="${k}" ${current === k ? 'aria-current="page"' : ''}>${ICON(ic, 18)}<span>${l}</span></button>`;
  let h = `<div class="pm-head"><button type="button" class="pm-who" role="menuitem" data-pm="account">${AVATAR(me.name, 'avimg', 40)}<span><b>${esc(me.name)}</b><small>${esc(me.email)}</small><em>${esc(me.team || '')}</em></span></button><span class="pm-go" data-pm="account" aria-hidden="true">${ICON('chevr', 16)}</span></div>`;
  h += '<div class="pm-s"></div>' + item('account', 'Account settings', 'user');
  if (B.hasRole('admin', 'compliance', 'developer')) h += item('bot', 'Support agent', 'headset');
  h += `<div class="pm-s"></div><button type="button" class="pm-i danger" role="menuitem" data-pm="out">${ICON('logout', 18)}<span>Sign out</span></button>`;
  const el = document.createElement('div');
  el.className = 'pmenu'; el.setAttribute('role', 'menu'); el.setAttribute('aria-label', 'Profile');
  el.innerHTML = h;
  document.body.appendChild(el);
  const r = a.getBoundingClientRect();
  el.style.left = Math.max(8, Math.min(r.left, innerWidth - el.offsetWidth - 8)) + 'px';
  el.style.bottom = innerHeight - r.top + 6 + 'px';
  el.style.maxHeight = Math.max(200, r.top - 16) + 'px';
  pm = { el, a };
  a.setAttribute('aria-expanded', 'true');
  const items = $$('.pm-i,.pm-who', el); // the chevron repeats the profile card: pointer only
  let cur = -1;
  const hi = (n) => { cur = n; items[n].focus({ preventScroll: true }); };
  el.setAttribute('tabindex', '-1');
  el.focus({ preventScroll: true });
  $$('[data-pm]', el).forEach((b) => {
    b.onclick = () => {
      const k = b.dataset.pm;
      closeMenu(false);
      B.haptic('light');
      if (k === 'out') { B.signOut(); return; }
      B.go(k === 'bot' ? '/agent' : '/account');
      window.scrollTo(0, 0);
    };
  });
  el.onkeydown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); hi((cur + 1) % items.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); hi((cur - 1 + items.length) % items.length); }
    else if (e.key === 'Home') { e.preventDefault(); hi(0); }
    else if (e.key === 'End') { e.preventDefault(); hi(items.length - 1); }
    else if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); closeMenu(true); }
  };
  document.addEventListener('pointerdown', outside, true);
  window.addEventListener('resize', onResize);
}

window.AUTH = AUTH;
})();
