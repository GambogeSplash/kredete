/* extras.js: the account page, the Chats page, and accessibility helpers for dialogs and
 * the answer live region. */
(() => {
'use strict';
const B = window.BRAIN;
/** @type {(s: string, r?: ParentNode) => any} */
const $ = (s, r = document) => r.querySelector(s);
/** @type {(s: string, r?: ParentNode) => any[]} */
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = B.esc;

/* ---------- Chats page ---------- */
let chatQuery = '';
let searchTimer = 0;
let searchSeq = 0;
function chatsPage() {
  $('#app').innerHTML = `<div class="pg"><h1>Chats</h1><div class="libbar"><div class="libs"><span class="libs-i">${ICON('search', 15)}</span><input id="chq" type="search" placeholder="Search chats" aria-label="Search chats" value="${esc(chatQuery)}" autocomplete="off"></div></div><div class="actl chl" id="chl"></div><div class="chmore" id="chmorebox"></div></div>`;
  $('#chq').oninput = (e) => {
    chatQuery = e.target.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(drawChats, 200);
  };
  drawChats();
}
async function drawChats() {
  const list = $('#chl');
  if (!list) return;
  const q = chatQuery.trim();
  const more = $('#chmorebox');
  more.innerHTML = '';
  let items;
  if (q) {
    const seq = ++searchSeq;
    list.innerHTML = B.skeletonRows(4);
    try {
      items = (await B.api.get('/search', { q })).conversations;
    } catch (error) {
      if (seq !== searchSeq) return;
      list.innerHTML = B.errorBlock(error, 'chretry2');
      $('#chretry2').onclick = drawChats;
      return;
    }
    if (seq !== searchSeq) return;
  } else {
    const c = B.S.chats;
    if (!c.loaded) {
      list.innerHTML = c.error ? B.errorBlock(c.error, 'chretry2') : B.skeletonRows(6);
      if (c.error) $('#chretry2').onclick = () => B.loadChats(true);
      return;
    }
    items = [...c.items].sort((a, b) => Number(b.pinned) - Number(a.pinned));
    if (c.next || c.loading) {
      more.innerHTML = `<button type="button" class="btn sm" id="chload" ${c.loading ? 'disabled' : ''}>${c.loading ? 'Loading' : 'Show more'}</button>`;
      $('#chload').onclick = () => B.loadChats(false);
    }
  }
  list.innerHTML = items.length
    ? items.map((c, i) => `<div class="actr chr" data-o="${i}" role="button" tabindex="0"><span class="actic">${ICON('chat', 16)}</span><span class="actt"><b>${esc(B.chatTitle(c))}</b><small>${esc(B.ago(c.updated_at))}</small></span><span class="actb">${c.pinned ? `<span class="chpin" aria-label="Pinned">${ICON('pin', 13)}</span>` : ''}<button type="button" class="lib" data-m="${i}" aria-label="Chat actions" aria-haspopup="menu">${ICON('more', 16)}</button></span></div>`).join('')
    : `<p class="actn">${q ? 'No chats match.' : 'No chats yet. Ask Brain a question to start one.'}</p>`;
  $$('[data-o]', list).forEach((r) => {
    const open = () => B.go('/c/' + items[+r.dataset.o].id);
    r.onclick = (e) => { if (!e.target.closest('[data-m]')) open(); };
    r.onkeydown = (e) => { if (e.key === 'Enter' && !e.target.closest('[data-m]')) open(); };
  });
  $$('[data-m]', list).forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      const conv = items[+b.dataset.m];
      const row = b.closest('.chr');
      B.chatMenu(b, conv, { rename: () => B.editTitle($('.actt b', row), conv, drawChats) });
    };
  });
}
window.SURFACES.chats = chatsPage;
window.SURFACES.chats.refresh = drawChats;

/* ---------- account ---------- */
function device(agent) {
  const a = String(agent || '');
  const browser = /Edg\//.test(a) ? 'Edge' : /Chrome\//.test(a) ? 'Chrome' : /Firefox\//.test(a) ? 'Firefox' : /Safari\//.test(a) ? 'Safari' : 'A browser';
  const os = /iPhone|iPad/.test(a) ? 'iOS' : /Android/.test(a) ? 'Android' : /Mac OS X/.test(a) ? 'macOS' : /Windows/.test(a) ? 'Windows' : /Linux/.test(a) ? 'Linux' : '';
  return os ? `${browser} on ${os}` : browser;
}
function deviceIcon(agent) {
  const path = /iPhone|Android|Mobile/i.test(agent || '')
    ? '<rect x="7.5" y="3" width="9" height="18" rx="2.2"/><path d="M11 18h2"/>'
    : '<rect x="5" y="5" width="14" height="10" rx="1.6"/><path d="M3 18.5h18"/>';
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}
const hint = (t) => `<span class="hint" tabindex="0" data-tip="${t}" aria-label="${t}">i</span>`;
const frow = (label, value, action) => `<div class="frow"><div class="frl"><b>${label}</b></div><div class="frv">${value}</div><div class="fra">${action || ''}</div></div>`;

window.SURFACES.account = (params) => {
  const me = B.S.me;
  const tab = params.tab === 'sessions' ? 'sessions' : 'profile';
  $('#app').innerHTML = `<div class="lset"><nav class="lrail" aria-label="Account"><button type="button" class="tab" data-at="/account" aria-current="${tab === 'profile' ? 'page' : 'false'}">Profile</button><button type="button" class="tab" data-at="/account/sessions" aria-current="${tab === 'sessions' ? 'page' : 'false'}">Sessions</button><div class="lrail-f"><button type="button" class="tab out" id="aout">Sign out</button></div></nav><div class="lcont"><h1 class="lcont-t">${tab === 'profile' ? 'Profile' : 'Sessions'}</h1><div id="acpane"></div></div></div>`;
  $$('[data-at]').forEach((b) => { b.onclick = () => B.go(b.dataset.at); });
  $('#aout').onclick = () => B.signOut();
  if (tab === 'profile') profile(me);
  else sessions();
};

function profile(me, editing) {
  const el = $('#acpane');
  const nick = me.nickname || String(me.name).split(' ')[0];
  const roles = me.roles.length ? me.roles.map((r) => `<span class="tag">${esc(B.ROLE_NAMES[r] || r)}</span>`).join('') : '<span class="tag">Employee</span>';
  const from = B.sandbox() ? 'From your Google sign-in and your admin' : 'From your work account';
  el.innerHTML = `<div class="acid"><span class="avchg static">${AVATAR(me.name, 'avimg', 88)}</span><div class="acidt"><h2>${esc(me.name)}</h2><div>${esc(me.title || '')}</div><div class="amute">${esc(me.email)}</div></div></div>
   <div class="fgroup">${frow('Preferred name', editing ? `<input id="enick" class="eminp" value="${esc(nick)}" maxlength="60" aria-label="Preferred name" style="margin:0;max-width:260px"><div class="hse" id="enke" role="alert"></div>` : esc(nick), editing ? '<button type="button" class="btn sm primary" id="enks">Save</button><button type="button" class="btn sm" id="enkc">Cancel</button>' : '<button type="button" class="btn sm" id="enk">Edit</button>')}
   ${frow('Appearance', `<select id="etheme" aria-label="Appearance">${[['light', 'Light'], ['dark', 'Dark'], ['system', 'Match my device']].map(([k, l]) => `<option value="${k}" ${window.AUTH.THEME() === k ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}
   ${frow('Welcome tour', '<span class="amute">The first-run introduction.</span>', '<button type="button" class="btn sm" id="atour">Replay</button>')}</div>
   <h3 class="ach">${from} ${hint('Your admin manages these.')}</h3><div class="fgroup">${me.team ? frow('Team', esc(me.team)) : ''}${me.location ? frow('Location', esc(me.location)) : ''}${frow('Roles', `<span class="acchips">${roles}</span>`)}${frow('Clearance', esc(B.clearanceName(me.clearance)))}</div>`;
  const edit = $('#enk');
  if (edit) edit.onclick = () => { profile(me, true); $('#enick').focus(); };
  const cancel = $('#enkc');
  if (cancel) cancel.onclick = () => profile(me);
  const save = $('#enks');
  if (save) {
    const submit = () => B.busy(save, async () => {
      const value = $('#enick').value.trim();
      B.S.me = await B.api.patch('/me', { nickname: value || null });
      B.toast('Saved');
      profile(B.S.me);
      window.AUTH.mountAccount();
    }, (error) => { $('#enke').textContent = B.problem(error); });
    save.onclick = submit;
    $('#enick').onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } };
  }
  $('#etheme').onchange = (e) => window.AUTH.applyTheme(e.target.value);
  $('#atour').onclick = () => window.AUTH.replayWelcome();
}

async function sessions() {
  const el = $('#acpane');
  el.innerHTML = B.loadingBlock('Loading sessions', 3, 'dt-r');
  let list;
  try {
    list = (await B.api.get('/me/sessions')).items;
  } catch (error) {
    el.innerHTML = B.errorBlock(error, 'sesretry');
    $('#sesretry').onclick = sessions;
    return;
  }
  const others = list.filter((s) => !s.current);
  el.innerHTML = `<div class="fgroup">${frow('Sign-in', 'Google', '<span class="tag ok">Single sign-on</span>')}</div>
   <h3 class="ach">Signed in on ${list.length} ${list.length === 1 ? 'device' : 'devices'}</h3><div class="dt sesdt" style="--cols:minmax(0,1.6fr) minmax(0,1fr) minmax(0,1fr) 110px"><div class="dt-r dt-h"><span>Device</span><span>Signed in</span><span>Last active</span><span></span></div>${list.map((s) => `<div class="dt-r"><span class="dtp"><i class="devic" aria-hidden="true">${deviceIcon(s.user_agent)}</i><b style="font-weight:500">${esc(device(s.user_agent))}</b>${s.current ? '<span class="tag ok">This device</span>' : ''}</span><span class="dtm">${esc(B.fmtDate(s.created_at))}</span><span class="dtm">${esc(B.ago(s.last_used_at))}</span><span>${s.current ? '' : `<button type="button" class="btn sm" data-so="${s.id}">Sign out</button>`}</span></div>`).join('')}</div>
   ${others.length ? '<div class="actions" style="margin-top:14px"><button type="button" class="btn" id="soall">Sign out of all other devices</button></div>' : ''}`;
  $$('[data-so]', el).forEach((b) => {
    b.onclick = () => B.busy(b, async () => {
      await B.api.del(`/me/sessions/${b.dataset.so}`);
      B.toast('Device signed out');
      sessions();
    });
  });
  const all = $('#soall');
  if (all) {
    all.onclick = () => B.busy(all, async () => {
      for (const s of others) await B.api.del(`/me/sessions/${s.id}`);
      B.toast('Signed out everywhere else');
      sessions();
    });
  }
}

/* ---------- accessibility: answers are announced when they finish ---------- */
const live = document.createElement('div');
live.setAttribute('aria-live', 'polite');
live.className = 'sr';
live.id = 'live';
document.body.appendChild(live);
new MutationObserver(() => {
  const t = $('.thread article:last-child .ans');
  if (t && !t.classList.contains('cursor') && !t.classList.contains('thinking')) live.textContent = t.textContent;
}).observe($('#app'), { childList: true, subtree: true });

/* ---------- dialogs: roles, focus trap, inert background, focus return ---------- */
(() => {
  const FOC = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea,[tabindex]:not([tabindex="-1"])';
  let opener = null;
  const bg = () => $$('.top,.mainpanel');
  const wire = (id, label) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', label);
    new MutationObserver(() => {
      const on = el.classList.contains('on');
      if (on && !el.dataset.open) {
        el.dataset.open = '1';
        opener = document.activeElement;
        bg().forEach((x) => x.setAttribute('inert', ''));
        el.setAttribute('aria-hidden', 'false');
        setTimeout(() => { const f = /** @type {HTMLElement | null} */ (el.querySelector(FOC)); (f || el).focus(); }, 60);
      } else if (!on && el.dataset.open) {
        delete el.dataset.open;
        el.setAttribute('aria-hidden', 'true');
        if (!document.querySelector('#modal.on,#drawer.on')) bg().forEach((x) => x.removeAttribute('inert'));
        if (opener && opener.focus && document.contains(opener)) opener.focus();
      }
    }).observe(el, { attributes: true, attributeFilter: ['class'] });
    el.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Tab') return;
      const f = $$(FOC, el).filter((x) => x.offsetParent !== null);
      if (!f.length) { ev.preventDefault(); return; }
      const first = f[0], last = f[f.length - 1];
      if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
      else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
    });
  };
  wire('modal', 'Dialog');
  wire('drawer', 'Details panel');
})();
})();
