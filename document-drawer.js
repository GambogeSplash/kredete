/* document-drawer.js: the document drawer, and how a document reads wherever it is listed.
 *
 * GET /v1/documents/{id} for the drawer. "Open in source" replaces "Request access": people ask
 * for access in Confluence or Drive. A document can be proposed for wider sharing (a promotion);
 * admins and compliance see its lineage. Labels that Broth ignored or adjusted show as Label
 * problems on the document (labelling spec 4.1). Its domain shows as a breadcrumb of Library
 * folders, and its Location (where it sits in the source) filters the whole Library (nested
 * domains spec 4.3). The Library, Ask, Governance and search all open the same drawer
 * (window.DOCUMENTS.openDocument).
 */
(() => {
'use strict';
const B = window.BRAIN;
/** @type {(s: string, r?: ParentNode) => any} */
const $ = (s, r = document) => r.querySelector(s);
/** @type {(s: string, r?: ParentNode) => any[]} */
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = B.esc;
const KIND_ICON = { confluence_page: 'doc', page: 'doc', blogpost: 'doc', gdoc: 'doc', sheet: 'analytics', slides: 'panel' };
const KIND_NAME = { confluence_page: 'Page', page: 'Page', blogpost: 'Post', gdoc: 'Doc', sheet: 'Sheet', slides: 'Slides', pdf: 'PDF', api_operation: 'API operation' };
const kindName = (k) => KIND_NAME[k] || (k ? k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, ' ') : 'Document');
const DOMAIN_COL = ['#5e6ad2', '#16a34a', '#f97316', '#0ea5a4', '#d946a8', '#3b82f6', '#e2a600'];
const domainCol = (slug) => DOMAIN_COL[[...String(slug)].reduce((a, c) => a + c.charCodeAt(0), 0) % DOMAIN_COL.length];
const SCOPE = { public: ['Public', 'ok'], internal: ['Everyone at Broth', 'blue'], granular: ['Limited access', ''] };
function authorityTag(d) {
  if (!d.authority) return '';
  if (d.authority === 'approved') {
    return d.review_due_at && new Date(d.review_due_at) < new Date() ? '<span class="tag warn">Past review date</span>' : '';
  }
  return `<span class="tag warn">${d.authority === 'draft' ? 'Draft' : 'Not approved'}</span>`;
}
/** The full path of a document's domain (nested domains spec 4.3): Payments / Payouts. */
const domainPath = (d) => (d.domain ? B.arr(d.domain.path).map((c) => c.name).join(' / ') : '');
/** A document's domain as a label: its own name, with the full path in the tooltip. */
const domainLabel = (d) => (d.domain ? `<span class="llab" title="${esc(domainPath(d))}"><i style="background:${domainCol(d.domain.slug)}"></i>${esc(d.domain.name)}</span>` : '');
/** A document's domain as a breadcrumb of folder links. */
const domainCrumbs = (d) => B.arr(d.domain.path).map((c) => `<a href="/library/${esc(c.slug)}" data-link>${esc(c.name)}</a>`).join('<i aria-hidden="true">/</i>');

/** What the source is called, and its mark; a read without a source says "Source" with a neutral mark. */
/** One short name per source for the footer button: the product people know, not the connector's own name. */
const FOOT_NAME = { confluence: 'Confluence', gdrive: 'Google Drive', github_docs: 'GitHub', notion: 'Notion' };
const openLabel = (d) => (d.system ? `Open in ${FOOT_NAME[d.system] || B.systemName(d.system)}` : 'Open in source');
const srcName = (d) => (d.system ? B.systemName(d.system) : '') || 'Source';
const srcMark = (d, px) => (d.system ? B.srcIcon(d.system, px) : `<span class="srcn" style="width:${px}px;height:${px}px">${ICON('stack', Math.round(px * 0.7))}</span>`);
/** A chip only when it has words. */
const chip = (text, cls) => (String(text || '').trim() ? `<span class="tag ${cls || ''}">${esc(text)}</span>` : '');
const docTitle = (d) => (d.title && String(d.title).trim()) || 'Untitled document';
/** An empty state sits in a frame where the list would be (the shared .ds-empty spec). */
const emptyFrame = (icon, title, text, action) => `<div class="ds-empty">${icon ? `<span class="ds-empty-ic">${ICON(icon, 20)}</span>` : ''}<b>${esc(title)}</b>${text ? `<p>${text}</p>` : ''}${action || ''}</div>`;
/** A failed read, framed, with the retry under it. */
const errorFrame = (error, retryId) => `<div class="ds-empty errstate" role="alert"><span class="ds-empty-ic">${ICON('refresh', 20)}</span><b>${esc(B.problem(error))}</b><p>${error && error.status === 0 ? 'Check your connection.' : 'The rest of Broth still works.'}</p>${retryId ? `<button type="button" class="btn sm" id="${retryId}">Try again</button>` : ''}</div>`;

/* ---------- the document drawer ---------- */
async function openDocument(id, opts) {
  const o = opts || {};
  const c = o.citation;
  B.openDrawer(`<div class="sv"><div class="sv-top"><span class="sv-sys">${c ? `${B.srcIcon(c.system, 20)}${esc(B.systemName(c.system))}` : '<i class="pvsk" style="width:90px"></i>'}</span><button type="button" class="xbtn2" data-close-drawer aria-label="Close">${ICON('x', 16)}</button></div><div class="sv-body" id="svbody">${c ? `<h2>${esc(c.title)}</h2>` : ''}<div class="skwrap" role="status"><span class="sr">Loading the document</span><i class="pvsk" style="width:80%;height:14px"></i><i class="pvsk" style="width:55%"></i><i class="pvsk" style="width:65%"></i></div></div></div>`);
  let d;
  try {
    d = await B.api.get('/documents/' + id);
    if (!d || !d.id) throw Object.assign(new Error('The document reply was empty'), { status: 404 }); // read like a document that is not there
  } catch (error) {
    const body = $('#svbody');
    const sys = $('#drawer .sv-sys');
    if (sys && !c) sys.textContent = 'Document'; // the name placeholder does not wait for an answer that is not coming
    if (body) body.innerHTML = error.status === 404 ? emptyFrame('lock', 'Not available', 'This document is not available to you. It may have moved, or its access changed.') : errorFrame(error, 'docretry');
    const r = $('#docretry');
    if (r) r.onclick = () => openDocument(id, o);
    return;
  }
  const drawer = $('#drawer');
  if (!drawer.classList.contains('on')) return;
  const scope = SCOPE[d.scope];
  const sens = d.sensitivity && d.sensitivity !== 'internal' && !(scope && scope[0] === B.clearanceName(d.sensitivity)) ? chip(B.clearanceName(d.sensitivity)) : '';
  const team = d.domain && d.domain.name ? `<span class="sv-team"><b>${esc(d.domain.name)}</b></span>` : '';
  const tags = team + authorityTag(d) + (scope ? chip(scope[0], scope[1]) : '') + sens;
  const owner = d.owner && d.owner.name
    ? `<div class="sv-own">${AVATAR(d.owner.name, 'lav', 40)}<div><b title="${esc(d.owner.name)}">${esc(d.owner.name)}</b><small title="${esc(d.owner.title || 'Owner')}">${esc(d.owner.title || 'Owner')}</small></div>${d.last_verified_at ? `<span class="sv-ver"><small>Verified</small>${B.when(d.last_verified_at, B.fmtDate(d.last_verified_at, true))}</span>` : ''}</div>`
    : '';
  const kv = [
    d.domain && d.domain.path && d.domain.path.length ? `<dt>Domain</dt><dd class="svcrumb">${domainCrumbs(d)}</dd>` : '',
    d.path ? `<dt>Location</dt><dd><button type="button" class="link" id="dlocation">${esc(d.path)}</button></dd>` : '',
    d.kind ? `<dt>Kind</dt><dd>${esc(kindName(d.kind))}</dd>` : '',
    d.review_due_at ? `<dt>Review due</dt><dd>${B.when(d.review_due_at, B.fmtDate(d.review_due_at, true))}</dd>` : '',
    !(d.owner && d.owner.name) && d.last_verified_at ? `<dt>Verified</dt><dd>${B.when(d.last_verified_at, B.fmtDate(d.last_verified_at, true))}</dd>` : '',
  ].join('');
  drawer.innerHTML = `<div class="sv"><div class="sv-top"><span class="sv-sys">${srcMark(d, 20)}<span class="sv-sysn" title="${esc(srcName(d))}">${esc(srcName(d))}</span></span><button type="button" class="xbtn2" data-close-drawer aria-label="Close">${ICON('x', 16)}</button></div>
    <div class="sv-body"><h2>${esc(docTitle(d))}</h2>
      ${tags ? `<div class="sv-tags">${tags}</div>` : ''}
      ${labelProblems(d)}
      ${c && c.quote ? `<blockquote class="sv-q">${esc(c.quote)}</blockquote>` : ''}
      ${owner}
      ${kv ? `<dl class="kv svkv">${kv}</dl>` : ''}
    </div>
    <div class="sv-act">${d.url ? `<a class="btn primary" id="dopen" href="${esc(d.url)}" target="_blank" rel="noopener noreferrer">${srcMark(d, 16)}<span class="lbl">${esc(openLabel(d))}</span>${ICON('ext', 14)}</a>` : `<button type="button" class="btn primary" id="dopen" disabled>${srcMark(d, 16)}<span class="lbl">${esc(openLabel(d))}</span></button>`}<button type="button" class="btn" id="ddet" aria-label="Details and lineage">Details<span class="dl"> and lineage</span></button></div></div>`;
  $('[data-close-drawer]', drawer).onclick = B.closeDrawer;
  const where = $('#dlocation');
  if (where) where.onclick = () => { B.closeDrawer(); window.LIBRARY.showLocation(d.path); };
  $('#ddet').onclick = () => detailsModal(d);
}

/** Labels Broth ignored or adjusted on this page, for its author to fix in the source. */
function labelProblems(d) {
  const warnings = d.label_warnings || [];
  if (!warnings.length) return '';
  return `<div class="svwarn" role="note"><b>Label problems</b><ul>${warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul><p>Fix the labels in ${esc(d.system ? B.systemName(d.system) : 'the source')}. Broth reads them again on its next sync.</p><p>${window.DOCS.link('labelProblems', 'What these mean')}</p></div>`;
}

function shareModal(d) {
  const options = [];
  if (d.scope === 'granular') options.push(['internal', 'Everyone at Broth', 'Every employee can find it and get answers from it.']);
  options.push(['public', 'Public', 'Customers can see it through the support agent. Only for content that is safe to publish.']);
  B.openModal(`<div class="modal" role="dialog" aria-label="Share more widely"><div class="bar"><span>Share more widely</span><button type="button" class="link" data-close-modal>Close</button></div><div class="body"><h2>${esc(docTitle(d))}</h2><p class="sub">An owner or admin approves the request. Until then, nothing changes.</p>
    <div class="obopts promopts" role="radiogroup" aria-label="Who can see it">${options.map(([k, l, t], i) => `<button type="button" class="obopt ${i ? '' : 'on'}" role="radio" aria-checked="${!i}" data-scope="${k}"><b>${l}</b><small>${t}</small></button>`).join('')}</div>
    <label class="hsl" for="preason">Why</label><textarea id="preason" class="eminp" rows="3" maxlength="500" placeholder="For example: every support agent needs this."></textarea><div class="hse" id="pre" role="alert"></div>
    <div class="actions"><button type="button" class="btn primary" id="psend">Send request</button><button type="button" class="btn" data-close-modal>Cancel</button></div></div></div>`);
  let scope = options[0][0];
  $$('[data-scope]').forEach((b) => {
    b.onclick = () => { scope = b.dataset.scope; $$('[data-scope]').forEach((x) => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-checked', String(on)); }); };
  });
  $('#psend').onclick = () => B.busy($('#psend'), async () => {
    await B.api.post(`/documents/${d.id}/promotions`, { to_scope: scope, reason: $('#preason').value.trim() || null });
    B.closeModal();
    B.toast('Request sent. Follow it in Governance.');
  }, (error) => { $('#pre').textContent = B.problem(error); });
}

const ACTIONS = { 'answer.served': 'Cited in an answer', 'promotion.requested': 'Wider sharing requested', 'promotion.approved': 'Sharing approved', 'promotion.rejected': 'Sharing rejected', 'promotion.revoked': 'Sharing revoked', 'promotion.needs_review': 'Sharing needs review' };
/** "Details and lineage", for everyone, as in the prototype: the document's tags and facts, then the
 *  answers that cited it and its sharing history. With `audit.read` the rows come from the audit
 *  search; with `lineage.read` alone from the anonymous lineage (developer role spec 3.4). Either way
 *  a row says when, what and through which channel, never who. */
async function detailsModal(d) {
  const scope = SCOPE[d.scope];
  const audit = B.can('audit.read');
  const lineage = audit || B.can('lineage.read');
  const tags = (d.authority === 'approved' && !authorityTag(d) ? chip('Approved', 'ok') : authorityTag(d)) + (d.system ? chip(srcName(d)) : '') + (d.domain && d.domain.name ? chip(d.domain.name, 'blue') : '');
  const rows = `${d.owner && d.owner.name ? `<dt>Owner</dt><dd>${PERSON(d.owner.name, 20)}${d.owner.title ? `, ${esc(d.owner.title)}` : ''}</dd>` : ''}${d.last_verified_at ? `<dt>Last verified</dt><dd>${B.when(d.last_verified_at, B.fmtDate(d.last_verified_at, true))}</dd>` : ''}${d.sensitivity ? `<dt>Sensitivity</dt><dd>${esc(B.clearanceName(d.sensitivity))}</dd>` : ''}${scope ? `<dt>Access</dt><dd>${esc(scope[0])}</dd><dt>External use</dt><dd>${d.scope === 'public' ? 'Approved' : 'Not approved'}</dd>` : ''}`;
  B.openModal(`<div class="modal lineage" role="dialog" aria-label="Details and lineage"><div class="bar"><span>${esc(docTitle(d))}</span><button type="button" class="link" data-close-modal>Close</button></div><div class="body">
    ${tags ? `<div class="sv-tags">${tags}</div>` : ''}
    ${rows ? `<dl class="kv">${rows}</dl>` : ''}
    <h4 class="dlh">Lineage: answers that cited this</h4><div id="lin">${lineage ? B.loadingBlock('Loading lineage', 3, 'actr') : '<p class="amute">Admins, compliance officers and developers see which answers cited this document.</p>'}</div>
    <div class="actions">${d.url ? `<a class="btn primary" href="${esc(d.url)}" target="_blank" rel="noopener noreferrer">${srcMark(d, 16)}<span class="lbl">${esc(openLabel(d))}</span>${ICON('ext', 14)}</a>` : ''}${d.scope && d.scope !== 'public' ? '<button type="button" class="btn" id="dshare">Share more widely</button>' : ''}</div></div></div>`);
  const share = $('#dshare');
  if (share) share.onclick = () => shareModal(d);
  if (!lineage) return;
  try {
    const page = audit ? await B.api.get('/admin/audit', { document_id: d.id, limit: 50 }) : await B.api.get(`/documents/${d.id}/lineage`, { limit: 50 });
    const box = $('#lin');
    if (!box) return;
    const events = B.rows(page);
    box.innerHTML = events.length
      ? `<div class="actl">${events.map((e) => `<div class="actr"><span class="actic">${ICON(e.action === 'answer.served' ? 'chat' : 'shield', 16)}</span><span class="actt"><b>${esc(ACTIONS[e.action] || e.action)}</b><small>${B.when(e.ts, B.dayLabel(e.ts, true))}${e.channel ? ' \u00b7 ' + esc(e.channel) : ''}${e.outcome && e.outcome !== 'ok' ? ' \u00b7 ' + esc(e.outcome.replace(/_/g, ' ')) : ''}</small></span></div>`).join('')}</div>${page.next_cursor ? `<p class="amute linmore">Showing the 50 most recent.${audit ? ' See all in Admin, Audit.' : ''}</p>` : ''}`
      : emptyFrame('chat', 'Nothing yet', 'Answers that cite this document appear here.');
  } catch (error) {
    const box = $('#lin');
    if (box) box.innerHTML = errorFrame(error);
  }
}

window.DOCUMENTS = { openDocument, authorityTag, domainLabel, domainCol, kindName, KIND_ICON, emptyFrame, errorFrame };
})();
