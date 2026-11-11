/* workspace.js: Admin, Workspace (the prototype's workspace page, with what the API can tell).
 *
 * The hero shows the workspace's address, with a Copy chip, and how people sign in. The settings
 * group counts what is connected, from /v1/admin/connections, /v1/admin/users and
 * /v1/admin/domains, and links to where each is managed. The name, logo, plan, data region and
 * retention of the prototype have no endpoint yet, so they are not shown (see COMPLETENESS-ADMIN.md).
 */
(() => {
'use strict';
const B = window.BRAIN;
/** @type {(s: string, r?: ParentNode) => any} */
const $ = (s, r = document) => r.querySelector(s);
/** @type {(s: string, r?: ParentNode) => any[]} */
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = B.esc;

const row = (label, note, value, action) => `<div class="frow"><div class="frl"><b>${label}</b>${note ? `<small>${note}</small>` : ''}</div><div class="frv">${value}</div><div class="fra">${action || ''}</div></div>`;
/** "1 connection", "3 connections"; a trailing plus when the list is longer than what was read. */
const count = (n, one, many, more) => `${n}${more ? '+' : ''} ${n === 1 && !more ? one : many}`;

async function render(el) {
  window.ADMIN.actions('');
  el.innerHTML = B.loadingBlock('Loading workspace', 3, 'actr');
  let connections, users, domains;
  try {
    [connections, users, domains] = await Promise.all([B.api.get('/admin/connections'), B.api.get('/admin/users', { limit: 200 }), B.api.get('/admin/domains')]);
  } catch (error) {
    el.innerHTML = `<div class="ds-empty">${B.errorBlock(error, 'wsretry')}</div>`;
    $('#wsretry').onclick = () => render(el);
    return;
  }
  const me = B.S.me;
  const host = location.host;
  // One helper names the workspace everywhere: what was saved on this device, else a work email's company, never a mailbox provider.
  const name = window.BROTH_LOGO.workspaceName(me.email);
  const live = B.rows(connections).filter((c) => c.status !== 'disconnected');
  const go = (path, label) => `<button type="button" class="btn sm" data-go="${path}">${label}</button>`;
  const G = '<svg class="wsg" width="16" height="16" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';
  const systems = [...new Set(live.map((c) => c.system))];
  const stack = systems.length ? `<span class="wsstack">${systems.map((s) => B.srcIcon(s, 16)).join('')}</span>` : '';
  el.innerHTML = `<div class="adhero"><span class="wslogo letter" id="wslogo" aria-hidden="true">${esc(name.charAt(0).toUpperCase())}</span><div class="adhd"><h2>${esc(name)}</h2><div class="adurl"><span>${esc(host)}</span><button type="button" class="adcopy" data-copy="${esc(host)}" aria-label="Copy address">${ICON('link', 14)}<em>Copy</em></button></div><div class="adchips"><span class="adch">${G}Google sign-in</span>${B.sandbox() ? `<span class="adch">${ICON('globe', 13)}Sandbox</span>` : ''}</div></div><button type="button" class="btn sm wsedit" id="wsedit" aria-haspopup="dialog">Edit</button></div>
   <h3 class="adh3">Settings</h3><div class="fgroup">${row('Sign-in', 'Members sign in with their Google account', `<span class="wsval">${G}Google</span>`, '')}${row('Sources', 'Spaces and repositories Broth reads', `<span class="wsval">${stack}${esc(count(live.length, 'connection', 'connections'))}</span>`, go('/admin/sources', 'Manage'))}${row('People', 'Everyone who has signed in', esc(count(B.rows(users).length, 'person', 'people', !!B.cursorOf(users))), go('/admin/people', 'Manage'))}${row('Domains', 'How pages are grouped by subject', esc(count(B.rows(domains).length, 'domain', 'domains')), go('/admin/domains', 'Manage'))}</div>`;
  // The saved or looked up logo, only once it is known to load: never a broken image.
  window.BROTH_LOGO.workspaceLogo().then((url) => {
    const tile = $('#wslogo');
    if (!url || !tile || !tile.isConnected) return;
    const img = new Image();
    img.referrerPolicy = 'no-referrer';
    img.alt = '';
    img.onload = () => { tile.classList.remove('letter'); tile.innerHTML = ''; tile.appendChild(img); requestAnimationFrame(() => img.classList.add('on')); };
    img.src = url;
  });
  $('#wsedit').onclick = () => editWorkspace(el);
  $$('[data-go]', el).forEach((b) => { b.onclick = () => B.go(b.dataset.go); });
  $$('[data-copy]', el).forEach((b) => {
    b.onclick = async () => {
      try { await navigator.clipboard.writeText(b.dataset.copy); } catch (e) { /* clipboard blocked */ }
      const em = $('em', b);
      const was = em.textContent;
      em.textContent = 'Copied';
      b.classList.add('ok');
      setTimeout(() => { em.textContent = was; b.classList.remove('ok'); }, 1400);
    };
  });
  window.ADMIN.life(el);
}

/** The name and logo of this workspace. There is no endpoint for them yet, so they are kept in this browser, in the keys the setup used. */
function editWorkspace(el) {
  const before = window.BROTH_LOGO.snapshot();
  const saved = window.BROTH_LOGO.company();
  B.openModal(`<div class="modal bt" style="max-width:480px" role="dialog" aria-label="Edit workspace"><div class="bar"><span>Edit workspace</span><button type="button" class="link" data-close-modal>Close</button></div><div class="body"><form id="suf" class="dmbody" novalidate>
    <div><label class="dmlab" for="suco">Workspace name</label><div class="colog"><button type="button" class="adlogo sm" id="sulogo" aria-label="Add company logo"></button><input id="suco" class="eminp" autocomplete="organization" maxlength="40" placeholder="Your company"><input type="file" id="sulf" accept="image/png,image/jpeg,image/svg+xml,image/webp" hidden></div></div>
    <div><label class="dmlab" for="suweb">Company website</label><div class="emw suweb"><span class="supre" aria-hidden="true">https://</span><input id="suweb" class="eminp" type="text" inputmode="url" autocomplete="url" spellcheck="false" placeholder="company.com"></div><p class="logomiss" id="sumiss" hidden><span>No logo found.</span> <button type="button" class="link" id="sulu">Upload yours</button></p></div>
    <p class="ds-msg">Saved on this device only.</p>
    <div class="actions"><button type="button" class="btn" id="wsc">Cancel</button><span class="lsp"></span><button type="submit" class="btn primary" id="wss">Save</button></div></form></div></div>`);
  window.BROTH_LOGO.mount($('#suf'), { toast: B.toast, maxBytes: 1048576 });
  setTimeout(() => { const f = $('#suco'); if (f) f.focus(); }, 80);
  let kept = false;
  $('#wsc').onclick = () => { window.BROTH_LOGO.restore(before); B.closeModal(); };
  $('#suf').onsubmit = (e) => {
    e.preventDefault();
    if (!$('#suco').value.trim() && !saved.name) { $('#suco').setAttribute('aria-invalid', 'true'); return; }
    kept = true;
    B.closeModal();
    B.toast('Saved');
    render(el);
  };
  // Closing any other way (Close, Escape, outside) leaves what was there before.
  new MutationObserver((_, obs) => { if (!$('#modal').classList.contains('on')) { obs.disconnect(); if (!kept) window.BROTH_LOGO.restore(before); } }).observe($('#modal'), { attributes: true, attributeFilter: ['class'] });
}

window.ADMIN.tabs.workspace = { label: 'Workspace', roles: ['admin'], render };
})();
