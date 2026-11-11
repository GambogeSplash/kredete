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
/** The wizard's picture side: the violet frame with the setup checklist card in it. */
AUTH.frame = (inner) => `<div class="pvbg" aria-hidden="true"><div class="pvbgi"></div></div><div class="pvsup">${inner}</div>`;
const brand = '<div class="si-brand"><div class="lm lmleft" role="img" aria-label="Broth"></div></div>';
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

/** The sign-in picture: a violet frame, Broth holding a dashboard card. Static markup, no data. */
function picture(first) {
  fitPicture();
  return `<div class="pvbg" aria-hidden="true"><div class="pvbgi"></div></div><div class="pvp" aria-hidden="true"><div class="pvlogo2"><div class="pvw pvfl pvmock"><div class="pvm pvsh"><div class="pvg">${first ? `Hello, ${esc(first)}` : `<i class="pvsk" style="width:120px"></i>`}</div><div class="pvc"><span>Ask a question</span><i>${ICON('send', 12)}</i></div><div class="pvf">${window.SRCICON('Confluence', 14)}${window.SRCICON('Google Drive', 14)}<span>Reading from your connected apps</span></div></div></div><img class="pvholder" src="/assets/crew/holder2.png" alt="" draggable="false"></div></div>`;
}
/** The card is drawn at a fixed size and scaled to the height of the screen. */
function fitPicture() {
  const st = document.documentElement.style;
  st.setProperty('--pvs', (0.663 * Math.max(420, innerHeight - 16) / 600).toFixed(4));
}
window.addEventListener('resize', () => { if ($('.si-r.pict')) fitPicture(); });

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
    $('#sipv').classList.toggle('pict', !!$('#sipv .pvbg'));
  } else {
    app.className = 'siapp';
    app.innerHTML = `<div class="si v2"><div class="si-l"><div class="si-in in" id="sin" aria-live="polite">${dots + left}</div></div><div class="si-r pv${right && right.includes('pvbg') ? ' pict' : ''}" id="sipv">${right || ''}</div></div>`;
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
  const needsSetup = !!(B.S.setup && B.S.setup.needs_setup);
  const blocked = needsSetup || !!(B.S.setup && !B.S.setup.google_configured);
  shell(`${brand}<h1 class="si-h1">Welcome back</h1>
    ${failure ? `<div class="banner bad" role="alert" id="aerr"><b>${esc(failure[0])}.</b> ${esc(failure[1])}${refused ? `<span class="refused-as">Google account: ${esc(refused)}</span>` : ''}</div>` : ''}
    ${needsSetup ? `<div class="banner info" role="status">This workspace is not set up yet. Ask your administrator to finish setup.</div>` : blocked ? `<div class="banner info" role="status"><b>Sign-in is not configured yet.</b> Your Broth admin finishes setup first.</div>` : ''}
    <div id="emerr" role="alert"></div>
    <div class="provs"><a class="prov si-btn" id="gsignin" href="${B.api.signInUrl}" ${blocked ? 'aria-disabled="true" tabindex="-1"' : ''}><span class="spin" aria-hidden="true"></span><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M23 12.3c0-.8-.1-1.5-.2-2.2H12v4.2h6.2a5.3 5.3 0 0 1-2.3 3.5v2.9h3.7c2.2-2 3.4-5 3.4-8.4z"/><path fill="#34A853" d="M12 23c3.1 0 5.7-1 7.6-2.8l-3.7-2.9c-1 .7-2.3 1.1-3.9 1.1-3 0-5.5-2-6.4-4.8H1.8v3A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.6 13.6a6.6 6.6 0 0 1 0-4.2v-3H1.8a11 11 0 0 0 0 10.2l3.8-3z"/><path fill="#EA4335" d="M12 5.4c1.7 0 3.2.6 4.4 1.7l3.3-3.3A11 11 0 0 0 1.8 6.4l3.8 3C6.5 6.5 9 5.4 12 5.4z"/></svg><span>Continue with Google</span></a>
    <button type="button" class="prov soon" disabled aria-disabled="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8.5" cy="9" r="3.5"/><path d="M11 11.5 20 20.5M16 16.5l2-2M18.5 19l1.5-1.5"/></svg><span>Continue with passkey</span><em class="provtag">Coming soon</em></button></div>
    <div class="orline"><span>or use your work email</span></div>
    <form id="emf" novalidate><div class="emw"><span class="emi">${ICON('user', 16)}</span><input id="em" class="eminp" type="email" inputmode="email" autocomplete="username" placeholder="name@company.com" aria-label="Work email" value=""></div><button class="btn primary si-btn" id="sso" type="submit"><span class="spin" aria-hidden="true"></span><span>Continue</span></button></form>
    <p class="si-alt">New to Broth? <a class="link" href="/setup" data-link>Create a workspace</a></p>`, picture());
  const button = $('#gsignin');
  button.onclick = (e) => {
    if (button.getAttribute('aria-disabled') === 'true') { e.preventDefault(); return; }
    button.classList.add('busy');
    if (AUTH.dive) { e.preventDefault(); AUTH.dive(() => location.assign(button.getAttribute('href'))); }
  };
  // The work email: it asks Google for that account (login_hint) and greets the person in the picture as they type.
  const em = $('#em'), err = $('#emerr'), form = $('#emf');
  const looksLikeEmail = (v) => /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(v);
  const firstName = (v) => {
    const part = v.split('@')[0].split(/[._+\-\d]+/).find(Boolean) || '';
    return part ? part[0].toUpperCase() + part.slice(1).toLowerCase() : '';
  };
  const greeting = $('#sipv .pvg');
  const skeleton = greeting ? greeting.innerHTML : '';
  em.oninput = () => {
    err.innerHTML = ''; em.removeAttribute('aria-invalid');
    const value = em.value.trim();
    const name = looksLikeEmail(value) ? firstName(value) : '';
    if (!greeting) return;
    const next = name ? `Hello, ${esc(name)}` : skeleton;
    if (greeting.innerHTML !== next) greeting.innerHTML = next; // only the greeting changes; the picture is not redrawn
  };
  form.onsubmit = (e) => {
    e.preventDefault();
    const value = em.value.trim();
    if (!looksLikeEmail(value)) {
      err.innerHTML = '<div class="banner bad"><b>Enter your work email.</b> It looks like name@company.com.</div>';
      em.setAttribute('aria-invalid', 'true');
      return;
    }
    if (blocked) return;
    $('#sso').classList.add('busy');
    const href = button.getAttribute('href') + (button.getAttribute('href').includes('?') ? '&' : '?') + 'login_hint=' + encodeURIComponent(value);
    if (AUTH.dive) AUTH.dive(() => location.assign(href)); else location.assign(href);
  };
  if (failure) history.replaceState({}, '', '/signin'); // the message stays; a reload starts clean, without the address
};

/** /setup opened while the workspace is already claimed: no wizard, a calm line and a way to sign in. */
AUTH.alreadySetup = () => {
  document.title = 'Broth';
  shell(`${brand}<div class="suhd"><h1 class="si-h1">This workspace is already set up</h1></div><div class="ds-empty"><span class="ds-empty-ic">${ICON('check', 20)}</span><b>Setup is finished</b><p>Sign in to continue.</p><a class="btn primary si-btn" href="/signin" data-link><span>Sign in to continue</span></a></div>`, picture());
};

/* ---------- boot error ---------- */
AUTH.bootError = (error, retry) => {
  // Broth's own problem says what went wrong; without one, say what to do rather than repeat the heading.
  const head = error && error.reached ? 'Broth could not start' : 'Broth could not be reached';
  const body = error && error.reached ? B.problem(error) : 'Check your connection and try again. If it keeps happening, tell your Broth admin.';
  shell(`${brand}<h1>${head}</h1><p class="sub">${esc(body)}</p><button type="button" class="btn primary si-btn" id="bootretry"><span class="spin" aria-hidden="true"></span><span>Try again</span></button>`, picture());
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
/** Starting points for the first question. Nothing is selected until the person chooses one. */
const FIRST_QUESTIONS = [['What changed in our policies recently?', 'shield'], ['Where do I find our brand guidelines?', 'search']];
AUTH.welcome = () => {
  const me = B.S.me;
  if (!ob || ob.id !== me.id) ob = { id: me.id, step: 1, nick: me.nickname || String(me.name).split(' ')[0], pick: null, own: '' };
  drawWelcome();
};
function drawWelcome() {
  const me = B.S.me, TOTAL = 2;
  const nav = (label) => `<div class="obnav"><button class="btn ob-back" id="obb" type="button" aria-label="Back" ${ob.step === 1 ? 'style="display:none"' : ''}><span class="flipx">${ICON('arrow', 18)}</span></button><button class="btn primary si-btn obgo" id="obn" type="button"><span class="spin" aria-hidden="true"></span><span>${label || 'Continue'}</span></button></div>`;
  let left = '';
  if (ob.step === 1) {
    left = `<h1>Is this you?</h1><div class="obid">${AVATAR(me.name, 'avimg', 46)}<div class="obidt"><div class="obnm"><b>${esc(me.name)}</b>${(me.roles || []).filter((r) => r !== 'employee').map((r) => `<span class="obrole">${esc(B.ROLE_NAMES[r] || r)}</span>`).join('')}</div><span>${esc(me.title || me.email)}</span></div></div><label class="emlab" for="obnick">What should we call you?</label><input id="obnick" class="eminp" value="${esc(ob.nick)}" maxlength="60" autocomplete="off"><div class="hse" id="obe" role="alert"></div>${nav()}<button class="link obout" id="obout" type="button">Not you? Sign out</button>`;
  } else {
    left = `<h1>Ask your first question</h1><div class="obcards" role="radiogroup" aria-label="First question">${FIRST_QUESTIONS.map(([q, icon], i) => `<button class="obcard ${ob.pick === i ? 'on' : ''}" role="radio" aria-checked="${ob.pick === i}" data-pk="${i}" type="button">${ICON(icon, 16)}<span>${esc(q)}</span></button>`).join('')}</div><input id="obq" class="eminp obq" type="text" placeholder="Or type your own question" aria-label="Type your own question" autocomplete="off" value="${esc(ob.own || '')}">${nav('Start asking')}<button class="link obout" id="obskip" type="button">Skip for now</button>`;
  }
  shell(left, picture(ob.nick || me.name.split(' ')[0]), [ob.step, TOTAL]);
  const step = (d) => { ob.step = Math.max(1, Math.min(TOTAL, ob.step + d)); drawWelcome(); };
  $('#obb').onclick = () => step(-1);
  if (ob.step === 1) {
    const n = $('#obnick');
    n.oninput = () => { ob.nick = n.value.trim(); const g = $('#sipv .pvg'); if (g) g.textContent = 'Hello, ' + (ob.nick || me.name.split(' ')[0]); };
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
  } else {
    const own = $('#obq');
    const finish = (question) => { markToured(me.id); ob = null; B.go('/'); if (question && window.ASK) setTimeout(() => window.ASK.askFresh(question), 120); };
    $$('[data-pk]').forEach((c) => {
      c.onclick = () => {
        ob.pick = ob.pick === +c.dataset.pk ? null : +c.dataset.pk;
        $$('[data-pk]').forEach((x) => { const on = +x.dataset.pk === ob.pick; x.classList.toggle('on', on); x.setAttribute('aria-checked', String(on)); });
      };
    });
    own.oninput = () => { ob.own = own.value; };
    own.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); $('#obn').click(); } };
    $('#obn').onclick = () => finish(ob.own.trim() || (ob.pick != null ? FIRST_QUESTIONS[ob.pick][0] : ''));
    $('#obskip').onclick = () => finish('');
  }
}

/* ---------- theme ---------- */
const THEME = () => { try { return localStorage.getItem('brain-theme') || 'dark'; } catch (e) { return 'dark'; } };
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
  let h = `<div class="pm-head"><button type="button" class="pm-who" role="menuitem" data-pm="account">${AVATAR(me.name, 'avimg', 40)}<span><b>${esc(me.name)}</b><small>${esc(me.email)}</small><em>${esc(me.team || '')}</em></span><i class="pm-ch">${ICON('chevr', 16)}</i></button></div>`;
  h += '<div class="pm-s"></div>' + item('account', 'Account settings', 'user');
  if (B.hasRole('admin', 'compliance')) h += item('admin', 'Admin settings', 'gear');
  if (B.hasRole('admin')) h += item('bot', 'Support agent', 'headset');
  h += item('docs', 'Help center', 'book');
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
      B.go({ bot: '/agent', admin: '/admin', docs: '/docs' }[k] || '/account');
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
