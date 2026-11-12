/* person.js: a person's page, /people/<id> (split search spec 3.3). Reached from the people
 * in the search palette, the rows of Admin > People and the actors in the audit log.
 *
 * Anyone signed in sees who the person is and what they own that they can open
 * (GET /v1/people/{id}). Only people with audit.read see what the person has done in Broth
 * (GET /v1/admin/audit?actor=), with filters kept in the address so a filtered view can be
 * linked. Without audit.read, or when the server refuses, the Activity section is not drawn. */
(() => {
'use strict';
const B = window.BRAIN;
/** @type {(s: string, r?: ParentNode) => any} */
const $ = (s, r = document) => r.querySelector(s);
/** @type {(s: string, r?: ParentNode) => any[]} */
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = B.esc;
const PAGE = 25;

let seq = 0;
/** @type {{ id: string, person: any, error: any, items: any[], next: string | null, loading: boolean, failed: any, hidden: boolean, seq: number }} */
let act = { id: '', person: null, error: null, items: [], next: null, loading: false, failed: null, hidden: false, seq: 0 };

/** The activity filters, from the address: ?action=&from=&to= (dates as YYYY-MM-DD). */
function filters() {
  const p = new URLSearchParams(location.search);
  const date = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : '');
  const action = p.get('action') || '';
  return { action: window.AUDIT_ROWS.ACTIONS.some((x) => x[1] === action) ? action : '', from: date(p.get('from')), to: date(p.get('to')) };
}
function setFilters(f) {
  const p = new URLSearchParams();
  if (f.action) p.set('action', f.action);
  if (f.from) p.set('from', f.from);
  if (f.to) p.set('to', f.to);
  const q = p.toString();
  history.replaceState(history.state, '', location.pathname + (q ? '?' + q : ''));
}

async function page(params) {
  const id = params.id;
  const mine = ++seq;
  act = { id, person: null, error: null, items: [], next: null, loading: false, failed: null, hidden: !B.can('audit.read'), seq: 0 };
  $('#app').innerHTML = `<div class="pg pspg" id="pspg">${B.loadingBlock('Loading this person', 3)}</div>`;
  try {
    const person = await B.api.get('/people/' + id);
    if (mine !== seq) return;
    act.person = person;
  } catch (error) {
    if (mine !== seq) return;
    act.error = error;
  }
  B.S.route.title = act.person ? act.person.name : '';
  B.setCrumb(); B.mbTitle();
  draw();
  if (act.person && !act.hidden) loadActivity(true);
}

function draw() {
  const root = $('#pspg');
  if (!root) return;
  if (act.error) {
    root.innerHTML = act.error.status === 404
      ? `<div class="ds-empty"><span class="ds-empty-ic">${ICON('user', 22)}</span><b>Person not found</b><p>They may have left, or the link is wrong.</p></div>`
      : B.errorBlock(act.error, 'psretry');
    const retry = $('#psretry');
    if (retry) retry.onclick = () => page({ id: act.id });
    return;
  }
  const p = act.person;
  const sub = [p.title, p.team].filter(Boolean).map(esc).join(' · ');
  const manager = p.manager ? `<span>Reports to <a class="link" href="/people/${esc(p.manager.id)}" data-link>${esc(p.manager.name)}</a></span>` : '';
  root.innerHTML = `<header class="pshead">${window.AVATAR(p.name, 'lav', 56)}<div class="psid"><h1>${esc(p.name)}</h1>${sub ? `<p class="pssub">${sub}</p>` : ''}<p class="psmeta"><a class="link" href="mailto:${esc(p.email)}">${esc(p.email)}</a>${manager}</p></div></header>
    <section class="pssec" aria-labelledby="psowns"><h2 id="psowns">Owns</h2>${owns(p.owns)}</section>
    ${act.hidden ? '' : `<section class="pssec" aria-labelledby="psact"><div class="pssech"><h2 id="psact">Activity</h2><span class="lsp"></span>${filterBar()}</div><div class="audt" id="psaudt" role="table" aria-label="${esc(p.name)}'s activity"></div><div id="psmore"></div></section>`}`;
  $$('[data-doc]', root).forEach((b) => { b.onclick = () => window.DOCUMENTS.openDocument(b.dataset.doc); });
  if (!act.hidden) { wireFilters(); drawActivity(); }
}

function owns(o) {
  const domains = B.arr(o && o.domains), spaces = B.arr(o && o.spaces);
  const pages = (o && o.pages) || { total: 0, items: [] };
  if (!domains.length && !spaces.length && !pages.total) return '<p class="amute psnone">Doesn’t own anything in Broth yet.</p>';
  let h = '<div class="psowns">';
  if (domains.length) h += `<div class="psgrp"><p class="dmlab">Domains</p><div class="pschips">${domains.map((d) => `<a class="chip" href="/library/${esc(d.slug)}" data-link>${ICON('hash', 13)}${esc(d.name)}</a>`).join('')}</div></div>`;
  if (spaces.length) {
    h += `<div class="psgrp"><p class="dmlab">Spaces</p><div class="pslist">${spaces.map((s) => {
      const name = B.containerName ? B.containerName(s.name) : s.name;
      return s.home_document_id
        ? `<button type="button" class="psrow" data-doc="${esc(s.home_document_id)}">${ICON('folder', 15)}<span>${esc(name)}</span></button>`
        : `<span class="psrow off">${ICON('folder', 15)}<span>${esc(name)}</span></span>`;
    }).join('')}</div></div>`;
  }
  if (pages.total) {
    const rest = pages.total - pages.items.length;
    h += `<div class="psgrp"><p class="dmlab">Pages <span class="amute">${pages.total}</span></p><div class="pslist">${pages.items.map((d) => `<button type="button" class="psrow" data-doc="${esc(d.id)}">${ICON('doc', 15)}<span>${esc(d.title)}</span></button>`).join('')}${rest > 0 ? `<p class="amute psrest">and ${rest} more</p>` : ''}</div></div>`;
  }
  return h + '</div>';
}

/** The Action list, grouped by category as the Admin audit log groups it. */
function actionOptions(chosen) {
  const R = window.AUDIT_ROWS;
  return R.CATEGORIES.map(([cat, label]) => `<optgroup label="${esc(label)}">${R.ACTIONS.filter((x) => x[0] === cat).map(([, k, name]) => `<option value="${esc(k)}" ${chosen === k ? 'selected' : ''}>${esc(name)}</option>`).join('')}</optgroup>`).join('');
}
function filterBar() {
  const f = filters();
  return `<form class="psfilt" id="psfilt"><select id="psaction" aria-label="Action"><option value="">Any action</option>${actionOptions(f.action)}</select><label class="psdate"><span>From</span><input type="date" id="psfrom" class="eminp" value="${esc(f.from)}"></label><label class="psdate"><span>To</span><input type="date" id="psto" class="eminp" value="${esc(f.to)}"></label></form>`;
}
function wireFilters() {
  const change = () => {
    setFilters({ action: $('#psaction').value, from: $('#psfrom').value, to: $('#psto').value });
    loadActivity(true);
  };
  ['#psaction', '#psfrom', '#psto'].forEach((s) => { $(s).onchange = change; });
  $('#psfilt').onsubmit = (e) => { e.preventDefault(); change(); };
}

async function loadActivity(first) {
  if (!first && (!act.next || act.loading)) return;
  const mine = ++act.seq;
  const f = filters();
  if (first) { act.items = []; act.next = null; }
  act.loading = true; act.failed = null;
  drawActivity();
  try {
    const got = await B.api.get('/admin/audit', { actor: act.id, action: f.action || null, from: window.AUDIT_ROWS.day(f.from, false), to: window.AUDIT_ROWS.day(f.to, true), limit: PAGE, cursor: first ? null : act.next });
    if (mine !== act.seq) return;
    act.items = act.items.concat(B.rows(got));
    act.next = B.cursorOf(got);
  } catch (error) {
    if (mine !== act.seq) return;
    if (error.status === 403) { act.hidden = true; act.loading = false; draw(); return; }
    act.failed = error;
  }
  act.loading = false;
  drawActivity();
}

function drawActivity() {
  const t = $('#psaudt'), more = $('#psmore');
  if (!t) return;
  const R = window.AUDIT_ROWS;
  if (act.failed && !act.items.length) {
    t.classList.add('isempty');
    t.innerHTML = `<div class="ds-empty">${B.errorBlock(act.failed, 'psaretry')}</div>`;
    $('#psaretry').onclick = () => loadActivity(true);
    more.innerHTML = '';
    return;
  }
  if (!act.items.length && !act.loading) {
    t.classList.add('isempty');
    const f = filters();
    t.innerHTML = f.action || f.from || f.to
      ? '<div class="ds-empty"><b>No events match</b><p>Try a different action or dates.</p></div>'
      : '<div class="ds-empty"><b>No activity yet</b></div>';
    more.innerHTML = '';
    return;
  }
  t.classList.remove('isempty');
  t.innerHTML = R.head(false) + act.items.map((e) => R.row(e, null)).join('') + (act.loading ? B.skeletonRows(act.items.length ? 2 : 5, 'aud-r noactor') : '');
  more.innerHTML = act.next && !act.loading ? '<div class="pager"><span class="lsp"></span><button type="button" class="btn sm" id="psload">Show more</button></div>' : '';
  const load = $('#psload');
  if (load) load.onclick = () => loadActivity(false);
}

window.SURFACES.person = page;
})();
