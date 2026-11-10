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
const KIND_NAME = { confluence_page: 'Page', page: 'Page', blogpost: 'Post', gdoc: 'Doc', sheet: 'Sheet', slides: 'Slides', pdf: 'PDF' };
const kindName = (k) => KIND_NAME[k] || (k ? k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, ' ') : 'Document');
const DOMAIN_COL = ['#5e6ad2', '#16a34a', '#f97316', '#0ea5a4', '#d946a8', '#3b82f6', '#e2a600'];
const domainCol = (slug) => DOMAIN_COL[[...String(slug)].reduce((a, c) => a + c.charCodeAt(0), 0) % DOMAIN_COL.length];
const SCOPE = { public: ['Public', 'ok'], internal: ['Everyone at Kredete', 'blue'], granular: ['Limited access', ''] };
function authorityTag(d) {
  if (d.authority === 'approved') {
    return d.review_due_at && new Date(d.review_due_at) < new Date() ? '<span class="tag warn">Past review date</span>' : '';
  }
  return `<span class="tag warn">${d.authority === 'draft' ? 'Draft' : 'Not approved'}</span>`;
}
/** The full path of a document's domain (nested domains spec 4.3): Payments / Payouts. */
const domainPath = (d) => (d.domain ? d.domain.path.map((c) => c.name).join(' / ') : '');
/** A document's domain as a label: its own name, with the full path in the tooltip. */
const domainLabel = (d) => (d.domain ? `<span class="llab" title="${esc(domainPath(d))}"><i style="background:${domainCol(d.domain.slug)}"></i>${esc(d.domain.name)}</span>` : '');
/** A document's domain as a breadcrumb of folder links. */
const domainCrumbs = (d) => d.domain.path.map((c) => `<a href="/library/${esc(c.slug)}" data-link>${esc(c.name)}</a>`).join('<i aria-hidden="true">/</i>');

/* ---------- the document drawer ---------- */
async function openDocument(id, opts) {
  const o = opts || {};
  const c = o.citation;
  B.openDrawer(`<div class="sv"><div class="sv-top"><span class="sv-sys">${c ? `${B.srcIcon(c.system, 20)}${esc(B.systemName(c.system))}` : '<i class="pvsk" style="width:90px"></i>'}</span><button type="button" class="xbtn2" data-close-drawer aria-label="Close">${ICON('x', 16)}</button></div><div class="sv-body" id="svbody">${c ? `<h2>${esc(c.title)}</h2>` : ''}<div class="skwrap" role="status"><span class="sr">Loading the document</span><i class="pvsk" style="width:80%;height:14px"></i><i class="pvsk" style="width:55%"></i><i class="pvsk" style="width:65%"></i></div></div></div>`);
  let d;
  try {
    d = await B.api.get('/documents/' + id);
  } catch (error) {
    const body = $('#svbody');
    if (body) body.innerHTML = error.status === 404 ? B.emptyBlock('Not available', 'This document is not available to you. It may have moved, or its access changed.') : B.errorBlock(error, 'docretry');
    const r = $('#docretry');
    if (r) r.onclick = () => openDocument(id, o);
    return;
  }
  const drawer = $('#drawer');
  if (!drawer.classList.contains('on')) return;
  const scope = SCOPE[d.scope] || SCOPE.granular;
  const lineage = B.hasRole('admin', 'compliance');
  const canWiden = d.scope !== 'public';
  drawer.innerHTML = `<div class="sv"><div class="sv-top"><span class="sv-sys">${B.srcIcon(d.system, 20)}${esc(B.systemName(d.system))}</span><button type="button" class="xbtn2" data-close-drawer aria-label="Close">${ICON('x', 16)}</button></div>
    <div class="sv-body"><h2>${esc(d.title)}</h2>
      <div class="sv-tags">${authorityTag(d) || '<span class="tag ok">Approved</span>'}<span class="tag ${scope[1]}">${esc(scope[0])}</span>${d.sensitivity !== 'internal' ? `<span class="tag">${esc(B.clearanceName(d.sensitivity))}</span>` : ''}</div>
      ${labelProblems(d)}
      ${c && c.quote ? `<blockquote class="sv-q">${esc(c.quote)}</blockquote>` : ''}
      ${d.owner ? `<div class="sv-own">${AVATAR(d.owner.name, 'lav', 40)}<div><b>${esc(d.owner.name)}</b><small>${esc(d.owner.title || 'Owner')}</small></div>${d.last_verified_at ? `<span class="sv-ver"><small>Verified</small>${B.when(d.last_verified_at, B.fmtDate(d.last_verified_at, true))}</span>` : ''}</div>` : ''}
      <dl class="kv svkv">${d.domain ? `<dt>Domain</dt><dd class="svcrumb">${domainCrumbs(d)}</dd>` : ''}${d.path ? `<dt>Location</dt><dd><button type="button" class="link" id="dlocation">${esc(d.path)}</button></dd>` : ''}<dt>Kind</dt><dd>${esc(kindName(d.kind))}</dd>${d.review_due_at ? `<dt>Review due</dt><dd>${B.when(d.review_due_at, B.fmtDate(d.review_due_at, true))}</dd>` : ''}${!d.owner && d.last_verified_at ? `<dt>Verified</dt><dd>${B.when(d.last_verified_at, B.fmtDate(d.last_verified_at, true))}</dd>` : ''}</dl>
    </div>
    <div class="sv-act"><a class="btn primary" id="dopen" href="${esc(d.url)}" target="_blank" rel="noopener noreferrer">${B.srcIcon(d.system, 16)}Open in ${esc(B.systemName(d.system))}${ICON('ext', 14)}</a>${canWiden ? '<button type="button" class="btn" id="dshare">Share more widely</button>' : ''}${lineage ? '<button type="button" class="btn" id="dlineage">Lineage</button>' : ''}</div></div>`;
  $('[data-close-drawer]', drawer).onclick = B.closeDrawer;
  const where = $('#dlocation');
  if (where) where.onclick = () => { B.closeDrawer(); window.LIBRARY.showLocation(d.path); };
  const share = $('#dshare');
  if (share) share.onclick = () => shareModal(d);
  const lin = $('#dlineage');
  if (lin) lin.onclick = () => lineageModal(d);
}

/** Labels Broth ignored or adjusted on this page, for its author to fix in the source. */
function labelProblems(d) {
  const warnings = d.label_warnings || [];
  if (!warnings.length) return '';
  return `<div class="svwarn" role="note"><b>Label problems</b><ul>${warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul><p>Fix the labels in ${esc(B.systemName(d.system))}. Broth reads them again on its next sync.</p><p>${window.DOCS.link('labelProblems', 'What these mean')}</p></div>`;
}

function shareModal(d) {
  const options = [];
  if (d.scope === 'granular') options.push(['internal', 'Everyone at Kredete', 'Every employee can find it and get answers from it.']);
  options.push(['public', 'Public', 'Customers can see it through the support agent. Only for content that is safe to publish.']);
  B.openModal(`<div class="modal" role="dialog" aria-label="Share more widely"><div class="bar"><span>Share more widely</span><button type="button" class="link" data-close-modal>Close</button></div><div class="body"><h2>${esc(d.title)}</h2><p class="sub">An owner or admin approves the request. Until then, nothing changes.</p>
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
async function lineageModal(d) {
  B.openModal(`<div class="modal lineage" role="dialog" aria-label="Lineage"><div class="bar"><span>Lineage</span><button type="button" class="link" data-close-modal>Close</button></div><div class="body"><h2>${esc(d.title)}</h2><p class="sub">Answers that cited this document, and changes to how widely it is shared. Only admins and compliance see this.</p><div id="lin">${B.loadingBlock('Loading lineage', 3, 'actr')}</div></div></div>`);
  try {
    const page = await B.api.get('/admin/audit', { document_id: d.id, limit: 50 });
    const box = $('#lin');
    if (!box) return;
    box.innerHTML = page.items.length
      ? `<div class="actl">${page.items.map((e) => `<div class="actr"><span class="actic">${ICON(e.action === 'answer.served' ? 'chat' : 'shield', 16)}</span><span class="actt"><b>${esc(ACTIONS[e.action] || e.action)}</b><small>${B.when(e.ts, B.dayLabel(e.ts, true))}${e.channel ? ' · ' + esc(e.channel) : ''}${e.outcome && e.outcome !== 'ok' ? ' · ' + esc(e.outcome.replace(/_/g, ' ')) : ''}</small></span></div>`).join('')}</div>${page.next_cursor ? '<p class="amute linmore">Showing the 50 most recent. See all in Admin, Audit.</p>' : ''}`
      : '<p class="actn">Nothing yet. Answers that cite this document appear here.</p>';
  } catch (error) {
    const box = $('#lin');
    if (box) box.innerHTML = B.errorBlock(error);
  }
}

window.DOCUMENTS = { openDocument, authorityTag, domainLabel, domainCol, kindName, KIND_ICON };
})();
