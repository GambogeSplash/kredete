/* setup.js: the setup wizard (sandbox spec 4.1, plan C3).
 *
 * Three steps: setup code and email; Google OAuth client; sign in with Google as the first
 * admin. Then straight into the app: connecting a source (Confluence) happens on Admin,
 * Sources, with the functions in source-setup.js (window.SOURCES).
 * The current step is always derived from API state, never stored in the browser:
 * GET /v1/setup/status before sign-in; after sign-in setup is complete for these steps.
 */
(() => {
'use strict';
const B = window.BRAIN;
const A = () => window.AUTH;
/** @type {(s: string, r?: ParentNode) => any} */
const $ = (s, r = document) => r.querySelector(s);
/** @type {(s: string, r?: ParentNode) => any[]} */
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = B.esc;

const STEPS = [
  ['claim', 'Claim this workspace', 'Setup code and your email'],
  ['google', 'Connect Google sign-in', 'Your Google OAuth client'],
  ['signin', 'Sign in', 'As the first admin'],
];
const index = (key) => STEPS.findIndex((s) => s[0] === key);

/** Where setup stands, from the API. After sign-in an admin is past every step ('done'). */
async function progress() {
  if (B.S.phase === 'setup') {
    const status = await B.api.get('/setup/status', undefined, { auth: false });
    B.S.setup = status;
    if (!status.needs_setup) return { step: 'signin' };
    if (!status.setup_session) return { step: 'claim' };
    return { step: status.google_configured ? 'signin' : 'google' };
  }
  return { step: 'done' };
}

/* ---------- the shell around every step ---------- */
/** The checklist card: one table row per step, a tag on the finished and the current one. */
const rowTag = (state) => (state === 'done' ? '<em class="tag ok">Done</em>' : state === 'on' ? '<em class="tag blue">Now</em>' : '');
const rowState = (i, at) => (i < at ? 'done' : i === at ? 'on' : '');
const rowMark = (state, i) => (state === 'done' ? ICON('check', 12) : i + 1);
const progLabel = (current, at) => (current === 'done' ? 'All set' : `${at + 1} of ${STEPS.length}`);
function checklist(current, idle) {
  const at = current === 'done' ? STEPS.length : index(current);
  const rows = STEPS.map(([k, title, sub], i) => { const st = idle ? '' : rowState(i, at); return `<li data-k="${k}" class="${st}"><i>${rowMark(st, i)}</i><span><b>${esc(title)}</b><small>${esc(sub)}</small></span>${rowTag(st)}</li>`; }).join('');
  return `<div class="pvp sup" aria-hidden="true"><div class="pvw sucard"><div class="suh">${ICON('check', 14)}<b>Set up Broth</b><span class="suprog">${idle ? '' : progLabel(current, at)}</span></div><ol class="sul${idle ? ' idle' : ''}">${rows}</ol></div></div>`;
}
/** Moves the checklist on without redrawing it, so the violet frame stays put and a row that
 * just finished gets its tag once. */
function updateChecklist(current) {
  const list = $('.pvsup .sul');
  if (!list) return;
  const at = current === 'done' ? STEPS.length : index(current);
  const live = list.dataset.live === '1';
  $$('li', list).forEach((li, i) => {
    const st = rowState(i, at);
    const was = li.classList.contains('done') ? 'done' : li.classList.contains('on') ? 'on' : '';
    if (st === was) return;
    li.className = st;
    $('i', li).innerHTML = rowMark(st, i);
    const tag = $('.tag', li);
    if (tag) tag.remove();
    if (st) li.insertAdjacentHTML('beforeend', rowTag(st));
    if (live) { li.classList.add('pop'); li.addEventListener('animationend', () => li.classList.remove('pop'), { once: true }); }
  });
  list.classList.remove('idle');
  list.dataset.live = '1';
  const prog = $('.pvsup .suprog');
  if (prog) prog.textContent = progLabel(current, at);
}
/** A page title with its (i) hint; the hint carries what used to be a subtitle. */
const head = (title, hint) => `<div class="suhd"><h1>${esc(title)}</h1>${hint ? `<span class="hint" tabindex="0" data-tip="${esc(hint)}" aria-label="${esc(hint)}">i</span>` : ''}</div>`;
/** The step swap, as in the prototype: the old form fades out where it stood, the new one fades in
 * rising 5 px, and the picture is left alone. */
function swapIn(old) {
  const c = $('#sin');
  if (!c || !old || /** @type {any} */ (window).__entering || matchMedia('(prefers-reduced-motion: reduce)').matches || !c.animate) return;
  const cr = c.getBoundingClientRect();
  const ghost = document.createElement('div');
  ghost.setAttribute('aria-hidden', 'true');
  ghost.style.cssText = `position:fixed;pointer-events:none;z-index:5;left:${cr.left}px;top:${old.top}px;width:${cr.width}px`;
  old.nodes.forEach((n) => { n.removeAttribute('id'); $$('[id]', n).forEach((x) => x.removeAttribute('id')); ghost.appendChild(n); });
  document.body.appendChild(ghost);
  [...c.children].filter((el) => !el.classList.contains('stp')).forEach((el) => el.animate([{ opacity: 0, transform: 'translateY(5px)' }, { opacity: 1, transform: 'none' }], { duration: 240, delay: 30, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' }));
  const g = ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 170, easing: 'ease-out', fill: 'forwards' });
  g.onfinish = () => ghost.remove();
}
function render(step, left, idle) {
  const n = index(step) + 1;
  const count = step === 'done' ? '' : `<p class="sustepn" aria-hidden="true">Step ${n} of ${STEPS.length}</p>`;
  const framed = !!$('#sipv .pvsup');
  const c = $('#sin');
  const kids = c ? [...c.children].filter((el) => !el.classList.contains('stp')) : [];
  const old = kids.length ? { top: kids[0].getBoundingClientRect().top, nodes: kids.map((k) => k.cloneNode(true)) } : null;
  A().shell(`${count}${left}`, framed ? null : A().frame(checklist(step, idle)), step === 'done' ? null : [n, STEPS.length]);
  swapIn(old);
  if (!idle) updateChecklist(step);
}
const field = (id, label, attrs, hint) => `<label class="emlab" for="${id}">${label}</label><input id="${id}" class="eminp" ${attrs || ''}>${hint ? `<p class="suhint">${hint}</p>` : ''}`;
const errorSlot = '<div class="hse" id="sue" role="alert"></div>';
/** A refusal reads as the design system's bad banner; an empty message clears it. */
const setMessage = (e, text) => { e.innerHTML = text ? `<div class="banner bad">${esc(text)}</div>` : ''; };
/** Marks the fields a message is about (cleared as soon as the person types again). */
function markInvalid(ids) {
  ids.forEach((id) => { const f = $('#' + id); if (!f) return; f.setAttribute('aria-invalid', 'true'); f.addEventListener('input', () => f.removeAttribute('aria-invalid'), { once: true }); });
}
const primary = (id, label) => `<div class="obnav"><button type="submit" class="btn primary si-btn obgo" id="${id}"><span class="spin" aria-hidden="true"></span><span>${label}</span></button></div>`;
function showError(error) {
  const e = $('#sue');
  if (!e) return;
  setMessage(e, B.problem(error));
  const wait = error && error.retryAfter;
  const button = $('#sin .si-btn');
  if (wait && button) {
    let left = wait;
    button.disabled = true;
    const tick = () => {
      if (!button.isConnected) return;
      if (left <= 0) { button.disabled = false; setMessage(e, ''); return; }
      setMessage(e, `${B.problem(error)}. Try again in ${left} s.`);
      left -= 1;
      setTimeout(tick, 1000);
    };
    tick();
  }
}
function copyButton(text) {
  return `<span class="sucopy"><code>${esc(text)}</code><button type="button" class="lib" data-copy="${esc(text)}" aria-label="Copy ${esc(text)}">${ICON('copy', 14)}</button></span>`;
}
function wireCopies() {
  $$('[data-copy]').forEach((b) => {
    b.onclick = async () => {
      try { await navigator.clipboard.writeText(b.dataset.copy); B.toast('Copied'); } catch (e) { B.toast('Copy it by hand'); }
    };
  });
}

/* ---------- steps ---------- */
/** Company and its logo square. Kept in this browser only (logo.js); the API never sees it. */
const companyRow = () => `<label class="emlab" for="suco">Company</label><div class="colog"><button type="button" class="adlogo sm" id="sulogo" aria-label="Add company logo"></button><input id="suco" class="eminp" autocomplete="organization" placeholder="Acme Bank"><input type="file" id="sulf" accept="image/png,image/jpeg,image/svg+xml,image/webp" hidden></div><p class="logomiss" id="sumiss" hidden><span>No logo found.</span> <button type="button" class="link" id="sulu">Upload yours</button><span class="hint" tabindex="0" data-tip="Your logo stays in this browser." aria-label="Your logo stays in this browser.">i</span></p>`;
function claimStep() {
  render('claim', `${head('Set up Broth', 'You are the first person here, so you become its admin. Enter the setup code from the server, and the Google account you will sign in with.')}
    <form id="suf" novalidate>${errorSlot}${field('sucode', 'Setup code', 'autocomplete="off" spellcheck="false" autocapitalize="characters" placeholder="XXXX-XXXX-XXXX-XXXX" class="eminp mono"')}<label class="emlab" for="suemail">Your Google account</label><div class="emw"><span class="emi">${ICON('user', 16)}</span><input id="suemail" class="eminp" type="email" inputmode="email" autocomplete="email" placeholder="you@example.com"></div>${companyRow()}${primary('sugo', 'Continue')}</form>
    <p class="disc">Lost the code, or it expired? Run <code>make sandbox-setup-code</code> on the server for a new one.</p>`);
  $('#sucode').focus();
  if (window.BROTH_LOGO) window.BROTH_LOGO.mount($('#suf'), { domain: () => $('#suemail').value, toast: B.toast });
  $('#suf').onsubmit = (e) => {
    e.preventDefault();
    const code = $('#sucode').value.trim(), email = $('#suemail').value.trim();
    if (!code || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showError({ title: !code ? 'Enter the setup code' : 'Enter the email of your Google account' });
      markInvalid([!code ? 'sucode' : 'suemail']);
      return;
    }
    B.busy($('#sugo'), async () => {
      await B.api.post('/setup/claim', { code, email }, { auth: false });
      await show();
    }, showError);
  };
}
function googleStep() {
  const redirect = `${location.origin}/v1/auth/google/callback`;
  render('google', `${head('Connect Google sign-in', 'Create an OAuth client (web application) in your Google Cloud project and add this redirect URI.')}<p class="emlab sucl">Redirect URI</p>${copyButton(redirect)}
    <form id="suf" novalidate>${errorSlot}${field('suid', 'Client ID', 'autocomplete="off" spellcheck="false" placeholder="1234.apps.googleusercontent.com"')}${field('susecret', 'Client secret', 'type="password" autocomplete="off" spellcheck="false"', 'Stored encrypted. It is never shown again.')}${primary('sugo', 'Save')}</form>`);
  wireCopies();
  $('#suid').focus();
  $('#suf').onsubmit = (e) => {
    e.preventDefault();
    const client_id = $('#suid').value.trim(), client_secret = $('#susecret').value.trim();
    if (!client_id || !client_secret) { showError({ title: 'Enter the client ID and the client secret' }); markInvalid([!client_id ? 'suid' : 'susecret']); return; }
    B.busy($('#sugo'), async () => {
      await B.api.put('/setup/credentials/google_oauth', { client_id, client_secret }, { auth: false });
      await show();
    }, showError);
  };
}
function signinStep() {
  render('signin', `${head('Sign in as the first admin', 'Use the Google account you entered with the setup code. Setup continues after you sign in.')}<div class="obnav"><a class="btn primary si-btn obgo" id="sugoogle" href="${B.api.signInUrl}"><span class="spin" aria-hidden="true"></span><span>Continue with Google</span></a></div>`);
  const b = $('#sugoogle');
  b.onclick = () => b.classList.add('busy');
}
/** The first admin is signed in and the wizard is over: on to Sources, where a source is connected. */
async function finish() {
  let target = '/admin/connectors';
  try { if ((await window.SOURCES.progress()).step === 'done') target = '/'; } catch (e) { /* Sources shows its own state */ }
  B.go(target, { replace: true });
}
async function show(known) {
  let p = known;
  if (!p) {
    try { p = await progress(); }
    catch (error) {
      render('claim', `${head('Setup could not load', 'Broth could not reach the server. Nothing was changed.')}<div class="ds-empty" role="alert"><span class="ds-empty-ic">${ICON('refresh', 20)}</span><b>${esc(B.problem(error))}</b><p>Check your connection and try again.</p><button type="button" class="btn primary si-btn" id="suretry"><span>Try again</span></button></div>`);
      $('#suretry').onclick = () => show();
      return;
    }
  }
  if (B.S.route.surface !== 'setup') return;
  if (B.S.phase === 'setup' && B.S.setup && !B.S.setup.needs_setup) { B.boot(); return; }
  if (p.step === 'done') { finish(); return; }
  ({ claim: claimStep, google: googleStep, signin: signinStep })[p.step](p);
}

window.SURFACES.setup = () => {
  render('claim', `<div class="skwrap" role="status"><span class="sr">Loading setup</span><i class="pvsk" style="width:60%;height:22px"></i><i class="pvsk" style="width:90%"></i><i class="pvsk" style="width:70%"></i></div>`, true);
  show();
};
/* connectors.js still calls SETUP.authorize; it now lives in source-setup.js */
window.SETUP = { progress, authorize: (id) => window.SOURCES.authorize(id) };
})();
