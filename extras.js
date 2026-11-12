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

const hint = (t) => `<span class="hint" tabindex="0" data-tip="${t}" aria-label="${t}">i</span>`;

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
    items = [...c.items]; // already in the API's order: pinned first, then the latest activity
    if (c.next || c.loading) {
      more.innerHTML = `<button type="button" class="btn sm" id="chload" ${c.loading ? 'disabled' : ''}>${c.loading ? 'Loading' : 'Show more'}</button>`;
      $('#chload').onclick = () => B.loadChats(false);
    }
  }
  list.className = items.length ? 'actl chl' : 'chl';
  list.innerHTML = items.length
    ? items.map((c, i) => `<div class="actr chr" data-o="${i}" role="button" tabindex="0"><span class="actic">${ICON('chat', 16)}</span><span class="actt"><b>${esc(B.chatTitle(c))}</b><small>${B.when(c.updated_at, B.ago(c.updated_at))}</small></span><span class="actb">${c.pinned ? `<span class="chpin" aria-label="Pinned">${ICON('pin', 13)}</span>` : ''}<button type="button" class="lib" data-m="${i}" aria-label="Chat actions" aria-haspopup="menu">${ICON('more', 16)}</button></span></div>`).join('')
    : `<div class="ds-empty"><span class="ds-empty-ic">${ICON(q ? 'search' : 'chat', 22)}</span><b>${q ? 'No chats match' : 'No chats yet'}</b><p>${q ? 'Try a different word.' : 'Ask Broth a question to start one.'}</p></div>`;
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
  const a = String(agent || '');
  const path = /iPhone|Android|Mobile/i.test(a)
    ? '<rect x="7.5" y="3" width="9" height="18" rx="2.2"/><path d="M11 18h2"/>'
    : /Windows|Linux/i.test(a)
      ? '<rect x="3.5" y="4.5" width="17" height="11" rx="1.8"/><path d="M9 20h6M12 15.5V20"/>'
      : '<rect x="5" y="5" width="14" height="10" rx="1.6"/><path d="M3 18.5h18"/>';
  return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}
const dframe = (label, small, action) => `<div class="frow"><div class="frl"><b>${label}</b>${small ? `<small>${small}</small>` : ''}</div><div class="frv"></div><div class="fra">${action}</div></div>`;
const frow = (label, value, action) => `<div class="frow"><div class="frl"><b>${label}</b></div><div class="frv">${value}</div><div class="fra">${action || ''}</div></div>`;

window.SURFACES.account = (params) => {
  const me = B.S.me;
  const tab = params.tab === 'sessions' ? 'sessions' : 'profile';
  $('#app').innerHTML = `<div class="lset">${window.SETTINGS.rail(tab)}<div class="lcont"><div class="ds-head lcont-head"><h1 class="lcont-t">${tab === 'profile' ? 'Profile' : 'Sessions'}</h1><div class="ds-act" id="acact"></div></div><div id="acpane"></div></div></div>`;
  window.SETTINGS.wire($('.lrail'));
  if (tab === 'profile') profile(me);
  else sessions();
};

function profile(me, editing) {
  const el = $('#acpane');
  const nick = me.nickname || String(me.name).split(' ')[0];
  const roles = me.roles.length ? me.roles.map((r) => `<span class="tag">${esc(B.ROLE_NAMES[r] || r.charAt(0).toUpperCase() + r.slice(1))}</span>`).join('') : '<span class="tag">Employee</span>';
  const from = B.sandbox() ? 'From your Google sign-in and your admin' : 'From your work account';
  el.innerHTML = `<div class="acid"><button type="button" class="avchg" id="avchg" aria-label="Change avatar" title="Change avatar">${AVATAR(me.name, 'avimg', 88)}<span class="avedit">${ICON('compose', 14)}</span></button><div class="acidt"><h2>${esc(me.name)}</h2>${me.title ? `<div>${esc(me.title)}</div>` : ''}<div class="amute">${esc(me.email)}</div></div></div>
   <div class="fgroup">${frow('Preferred name', editing ? `<input id="enick" class="eminp" value="${esc(nick)}" maxlength="60" aria-label="Preferred name" style="margin:0;max-width:260px"><div class="hse" id="enke" role="alert"></div>` : esc(nick), editing ? '<button type="button" class="btn sm primary" id="enks">Save</button><button type="button" class="btn sm" id="enkc">Cancel</button>' : '<button type="button" class="btn sm" id="enk">Edit</button>')}
   ${frow('Appearance', `<select id="etheme" aria-label="Appearance">${[['light', 'Light'], ['dark', 'Dark'], ['system', 'Match my device']].map(([k, l]) => `<option value="${k}" ${window.AUTH.THEME() === k ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}</div>
   <h3 class="ach">${from} ${hint('Managed by IT. Ask IT to change these.')}</h3><div class="fgroup">${me.team ? frow('Team', esc(me.team)) : ''}${frow('Location', esc(me.location || ''))}${frow('Roles', `<span class="acchips">${roles}</span>`)}${frow('Clearance', esc(B.clearanceName(me.clearance)))}</div>
   <h3 class="ach">Sign-in</h3><div class="fgroup"><div class="frow"><div class="frl"><b>Sign-in</b><small>Broth single sign-on</small></div><div class="frv"><span class="tag ok">Managed by IT</span></div><div class="fra"></div></div></div>
   <h3 class="ach">Your data</h3><div class="fgroup">${dframe('Download my data', 'Your profile and questions, as a file.', '<button type="button" class="btn sm" id="adl">Download</button>')}${dframe('Delete my question history', 'Only you can see it.', '<button type="button" class="btn sm danger-o" id="aclr">Delete</button>')}${dframe('Replay onboarding', '', '<button type="button" class="btn sm" id="atour">Replay</button>')}</div>`;
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
  $('#adl').onclick = () => dataDownload($('#adl'));
  $('#aclr').onclick = () => historyClear($('#aclr'));
}

/** Every page of a list endpoint. */
async function allPages(path, params) {
  const out = [];
  let cursor = null;
  do {
    const page = await B.api.get(path, { ...params, cursor });
    out.push(...B.rows(page));
    cursor = B.cursorOf(page);
  } while (cursor);
  return out;
}
/** Download my data: the profile and every question, built in the browser from the same reads the app makes. */
function dataDownload(btn) {
  B.busy(btn, async () => {
    const chats = await allPages('/conversations', { limit: 100 });
    const details = [];
    for (const c of chats.slice(0, 300)) details.push(await B.api.get('/conversations/' + c.id));
    const me = B.S.me;
    const data = { profile: { name: me.name, email: me.email, nickname: me.nickname, team: me.team, location: me.location, roles: me.roles }, chats: details.map((d) => ({ title: d.title, created_at: d.created_at, questions: d.turns.map((t) => t.question) })) };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    a.download = 'my-broth-data.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }, (error) => B.toast(B.problem(error)));
}
/** Delete my question history: every chat, after a second press. */
function historyClear(btn) {
  if (!btn.dataset.arm) {
    btn.dataset.arm = '1';
    btn.textContent = 'Confirm delete';
    return;
  }
  B.busy(btn, async () => {
    const chats = await allPages('/conversations', { limit: 100 });
    for (const c of chats) await B.api.del('/conversations/' + c.id);
    await B.loadChats(true);
    B.toast('Your history was deleted');
  }, (error) => B.toast(B.problem(error)));
}

const fade = (row) => {
  if (!row || !row.animate || matchMedia('(prefers-reduced-motion: reduce)').matches) return Promise.resolve();
  const done = () => {};
  return row.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.96)' }], { duration: 200, fill: 'forwards' }).finished.then(done, done);
};
async function sessions() {
  const el = $('#acpane');
  el.innerHTML = B.loadingBlock('Loading sessions', 3, 'dt-r');
  let list;
  try {
    list = B.rows(await B.api.get('/me/sessions'));
  } catch (error) {
    if (!el.isConnected) return;
    el.innerHTML = B.errorBlock(error, 'sesretry');
    $('#sesretry').onclick = sessions;
    return;
  }
  // The person may have left Sessions while the list loaded: this pane is no longer on the page.
  if (!el.isConnected) return;
  const others = list.filter((s) => !s.current);
  const row = (s) => `<div class="ds-tr dvcols" data-id="${s.id}" role="row"><span class="dmn"><span class="addvi dvic">${deviceIcon(s.user_agent)}</span><span class="ltb"><b>${esc(device(s.user_agent))}${s.current ? '<span class="tag blue dvme">This device</span>' : ''}</b></span></span><span class="amute dvm">${B.when(s.created_at, B.fmtDate(s.created_at))}</span><span class="amute dvm">${s.current ? '<span class="adok"><i></i>Now</span>' : B.when(s.last_used_at, B.ago(s.last_used_at))}</span><span class="dvact">${s.current ? '' : `<button type="button" class="btn sm" data-so="${s.id}">Sign out</button>`}</span></div>`;
  el.innerHTML = `
   <div class="ds-table sesdt" role="table" aria-label="Devices"><div class="ds-tr ds-th dvcols" role="row"><span>Device</span><span class="dvm">First seen</span><span class="dvm">Last active</span><span></span></div>${list.map(row).join('')}</div>`;
  $$('[data-so]', el).forEach((b) => {
    b.onclick = () => {
      B.armPress(b, 'Confirm sign out', () => signOutOne(b));
    };
  });
  function signOutOne(b) {
    B.busy(b, async () => {
      await B.api.del(`/me/sessions/${b.dataset.so}`);
      await fade(b.closest('.ds-tr'));
      B.toast('Device signed out');
      sessions();
    });
  }
  $('#acact').innerHTML = others.length ? '<button type="button" class="btn sm" id="soall">Sign out of all other devices</button>' : '';
  const all = $('#soall');
  if (all) {
    all.onclick = () => B.armPress(all, 'Confirm sign out of all', () => B.busy(all, async () => {
      for (const s of others) await B.api.del(`/me/sessions/${s.id}`);
      await Promise.all([...el.querySelectorAll('.ds-tr[data-id]')].filter((r) => !r.querySelector('.tag')).map(fade));
      B.toast('Signed out everywhere else');
      sessions();
    }));
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
  /** Something modal is open: the modal, or a drawer that is a sheet over the page (not docked beside it). */
  const modalOpen = () => !!document.querySelector('#modal.on') || (!!document.querySelector('#drawer.on') && !window.BRAIN.drawerDocked());
  /** The page is inert exactly while something modal covers it. */
  const syncInert = () => {
    const lock = modalOpen();
    bg().forEach((x) => x.toggleAttribute('inert', lock));
    const d = document.getElementById('drawer');
    if (d && d.classList.contains('on')) d.setAttribute('aria-modal', String(!window.BRAIN.drawerDocked()));
  };
  window.BRAIN.WIDE.addEventListener('change', syncInert);
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
        el.setAttribute('aria-hidden', 'false');
        setTimeout(() => { const f = /** @type {HTMLElement | null} */ (el.querySelector(FOC)); (f || el).focus(); }, 60);
      } else if (!on && el.dataset.open) {
        delete el.dataset.open;
        el.setAttribute('aria-hidden', 'true');
        if (opener && opener.focus && document.contains(opener)) opener.focus();
      }
      syncInert();
    }).observe(el, { attributes: true, attributeFilter: ['class'] });
    el.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Tab' || (el.id === 'drawer' && window.BRAIN.drawerDocked())) return; // a docked panel is not modal: Tab moves on to the page
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
