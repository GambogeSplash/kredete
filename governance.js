/* governance.js: promotion requests (sandbox spec 4.3, plan C7.2), and requests to make a
 * whole docs repository Public (docs source spec 8), listed first while pending.
 *
 * GET /v1/promotions lists requests for documents the reader can see. Approve, Reject and
 * Revoke appear only when PromotionOut.can_decide says the reader is an approver; nobody
 * approves their own request, only pending or needs-review requests are decided, and only
 * approved ones are revoked.
 */
(() => {
'use strict';
const B = window.BRAIN;
/** @type {(s: string, r?: ParentNode) => any} */
const $ = (s, r = document) => r.querySelector(s);
/** @type {(s: string, r?: ParentNode) => any[]} */
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = B.esc;

const STATUSES = [['', 'All'], ['pending', 'Pending'], ['needs_review', 'Needs review'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['revoked', 'Revoked']];
const STATUS_TAG = { pending: ['Pending', 'warn'], needs_review: ['Needs review', 'warn'], approved: ['Approved', 'ok'], rejected: ['Rejected', ''], revoked: ['Revoked', ''] };
const SCOPE = { internal: 'Everyone at Broth', public: 'Public' };
const OPEN = ['pending', 'needs_review'];

function state() {
  const c = B.S.cache;
  if (!c.gov) c.gov = { status: '', items: [], repos: [], next: null, loaded: false, loading: false, error: null, seq: 0 };
  return c.gov;
}
/** Names for requesters: admins can read the people list; everyone else sees "you" or a colleague. */
const people = () => window.ADMIN.names();
const who = (id, names) => (id === B.S.me.id ? 'you' : names[id] || 'a colleague');

function page() {
  const g = state();
  const inner = `<div class="ds-head"><h1 class="lcont-t">Sharing requests</h1></div>
    <div class="ixchips govtabs" role="tablist" aria-label="Status">${STATUSES.map(([k, l]) => `<button type="button" class="ixchip ${g.status === k ? 'on' : ''}" role="tab" aria-selected="${g.status === k}" data-st="${k}">${l}</button>`).join('')}</div>
    <div class="adreq govlist" id="govlist"></div><div class="chmore" id="govmore"></div>`;
  // Admins and compliance see the same left menu as the Admin screens; everyone else the plain page.
  const shell = B.hasRole('admin', 'compliance');
  $('#app').innerHTML = shell ? `<div class="lset gov">${window.ADMIN.railHtml('governance')}<div class="lcont">${inner}</div></div>` : `<div class="pg gov">${inner}</div>`;
  if (shell) window.ADMIN.wireRail($('.lrail'));
  $$('[data-st]').forEach((b) => { b.onclick = () => { g.status = b.dataset.st; page(); load(true); }; });
  g.rise = true;
  if (!g.loaded || g.error) load(true); else draw();
}
async function load(reset) {
  const g = state();
  if (!reset && (g.loading || !g.next)) return;
  const mine = ++g.seq;
  g.loading = true; g.error = null;
  if (reset) { g.items = []; g.next = null; g.loaded = false; }
  draw();
  try {
    // Repository requests have every status a promotion has, except Needs review.
    const repoStatus = g.status === 'needs_review' ? undefined : g.status || null;
    const [result, repos] = await Promise.all([
      B.api.get('/promotions', { status: g.status || null, limit: 30, cursor: reset ? null : g.next }),
      reset && repoStatus !== undefined ? B.api.get('/public-declarations', { status: repoStatus }) : Promise.resolve(null),
      people(),
    ]);
    if (mine !== g.seq) return;
    if (reset) g.repos = repos ? repos.items : [];
    g.items = reset ? result.items : g.items.concat(result.items);
    g.next = result.next_cursor || null;
    g.loaded = true;
  } catch (error) {
    if (mine !== g.seq) return;
    g.error = error;
  } finally {
    if (mine === g.seq) g.loading = false;
  }
  if (B.S.route.surface === 'governance' && mine === g.seq) draw();
}
function actions(p) {
  if (!p.can_decide) return p.status === 'rejected' || p.status === 'revoked' ? '<small class="amute">Closed</small>' : '';
  const mine = p.requested_by === B.S.me.id;
  let h = `<button type="button" class="btn sm" data-review="${p.id}">Review</button>`;
  if (OPEN.includes(p.status)) {
    if (mine) h += '<small class="amute">You cannot approve your own request</small>';
    if (!mine) h += `<button type="button" class="btn sm primary" data-act="approve" data-id="${p.id}">Approve</button>`;
    h += `<button type="button" class="btn sm" data-act="reject" data-id="${p.id}">Reject</button>`;
  } else if (p.status === 'approved') {
    h += `<button type="button" class="btn sm" data-act="revoke" data-id="${p.id}">Revoke</button>`;
  } else h += '<small class="amute">Closed</small>';
  return h;
}
/** A request to make a whole docs repository Public. Nobody approves their own; an approved
 * one stays listed so it can be revoked here. */
function repoActions(d) {
  if (!d.can_decide) return '';
  const review = `<button type="button" class="btn sm" data-review="${d.id}" data-repo>Review</button>`;
  if (d.status === 'pending') {
    const approve = d.requested_by === B.S.me.id ? '' : `<button type="button" class="btn sm primary" data-ract="approve" data-id="${d.id}">Approve</button>`;
    return `${review}${approve}<button type="button" class="btn sm" data-ract="reject" data-id="${d.id}">Reject</button>`;
  }
  return d.status === 'approved' ? `<button type="button" class="btn sm" data-ract="revoke" data-id="${d.id}">Revoke</button>` : '';
}
const scopeTag = (scope) => (scope === 'public' ? ' <span class="tag warn">Leaves the company</span>' : '');
const meta = (id, created, names) => `<div class="adrqm">${AVATAR(id === B.S.me.id ? 'You' : names[id] || 'A colleague', 'lav', 18)}<span>${esc(who(id, names))}</span>${created ? `<i></i><span>${B.when(created, B.ago(created))}</span>` : ''}</div>`;
function repoRow(d) {
  const names = B.S.cache.names || {};
  const tag = STATUS_TAG[d.status] || [d.status, ''];
  return `<article class="adrq govr govrepo"><span class="adsl">${B.srcIcon('github_docs', 26)}</span><div class="adrqb"><div class="adrqt"><b>${esc(B.containerName(d.container_path || 'A docs repository'))}</b><span class="tag ${tag[1]}">${tag[0]}</span></div><p>Whole repository, wants to share with <b>Public</b>${scopeTag('public')}</p>${meta(d.requested_by, d.created_at, names)}${d.reason ? `<p class="adrqn govreason">${esc(d.reason)}</p>` : ''}</div><div class="adrqa">${repoActions(d)}</div></article>`;
}
function draw() {
  const g = state();
  const list = $('#govlist'), more = $('#govmore');
  if (!list) return;
  const names = B.S.cache.names || {};
  if (!g.loaded) {
    list.innerHTML = g.error ? `<div class="ds-empty">${B.errorBlock(g.error, 'govretry')}</div>` : `<div class="skwrap" role="status"><span class="sr">Loading requests</span>${B.skeletonRows(4)}</div>`;
    const r = $('#govretry');
    if (r) r.onclick = () => load(true);
    more.innerHTML = '';
    return;
  }
  list.classList.toggle('isempty', !g.items.length && !g.repos.length);
  list.innerHTML = g.items.length || g.repos.length
    ? g.repos.map(repoRow).join('') + g.items.map((p) => { const tag = STATUS_TAG[p.status] || [p.status, '']; const acts = actions(p); return `<article class="adrq govr"><span class="adsl">${ICON('shield', 22)}</span><div class="adrqb"><div class="adrqt"><button type="button" class="link govdoc" data-doc="${p.document_id}">${esc(p.document_title || 'A document')}</button><span class="tag ${tag[1]}">${tag[0]}</span></div><p>Wants to share with <b>${esc(SCOPE[p.to_scope] || p.to_scope)}</b>${scopeTag(p.to_scope)}</p>${meta(p.requested_by, p.created_at, names)}${p.reason ? `<p class="adrqn govreason">${esc(p.reason)}</p>` : ''}</div><div class="adrqa">${acts}</div></article>`; }).join('')
    : `<div class="ds-empty govempty"><b>${g.status ? 'Nothing here' : 'No requests yet'}</b><p>${g.status ? 'No requests have this status.' : 'Ask to share a document more widely from its details in the Library.'}</p></div>`;
  if (g.rise) { g.rise = false; window.ADMIN.life(list); }
  more.innerHTML = g.next ? `<button type="button" class="btn sm" id="govload" ${g.loading ? 'disabled' : ''}>${g.loading ? 'Loading' : 'Show more'}</button>` : '';
  const m = $('#govload');
  if (m) m.onclick = () => load(false);
  $$('[data-doc]', list).forEach((b) => { b.onclick = () => window.DOCUMENTS.openDocument(b.dataset.doc); });
  $$('[data-review]', list).forEach((b) => {
    b.onclick = () => {
      const item = b.hasAttribute('data-repo') ? g.repos.find((x) => x.id === b.dataset.review) : g.items.find((x) => x.id === b.dataset.review);
      if (item) reviewPopup(item, b);
    };
  });
  $$('[data-ract]', list).forEach((b) => {
    b.onclick = () => {
      const act = b.dataset.ract;
      if (act !== 'approve' && !b.dataset.arm) { b.dataset.arm = '1'; b.textContent = act === 'reject' ? 'Confirm reject' : 'Confirm revoke'; b.classList.add('danger'); return; }
      B.busy(b, async () => {
        const updated = await B.api.post(`/public-declarations/${b.dataset.id}/${act}`, {});
        // A decision response carries no path: keep the listed one.
        g.repos = g.repos
          .map((d) => (d.id === updated.id ? Object.assign({}, d, { status: updated.status, approved_by: updated.approved_by, decided_at: updated.decided_at, can_decide: updated.can_decide }) : d))
          .filter((d) => !g.status || d.status === g.status);
        B.toast({ approve: 'Approved. The repository\'s published pages are Public now.', reject: 'Rejected', revoke: 'Revoked. The repository\'s pages are Internal again.' }[act]);
        draw();
      });
    };
  });
  $$('[data-act]', list).forEach((b) => {
    b.onclick = () => {
      const act = b.dataset.act;
      if (act !== 'approve' && !b.dataset.arm) { b.dataset.arm = '1'; b.textContent = act === 'reject' ? 'Confirm reject' : 'Confirm revoke'; b.classList.add('danger'); return; }
      B.busy(b, async () => {
        const updated = await B.api.post(`/promotions/${b.dataset.id}/${act}`, {});
        const i = g.items.findIndex((x) => x.id === updated.id);
        // Decision responses carry no title or dates: keep the listed ones.
        if (i >= 0) g.items[i] = Object.assign({}, g.items[i], { status: updated.status, approved_by: updated.approved_by, can_decide: updated.can_decide });
        if (g.status && updated.status !== g.status) g.items.splice(i, 1);
        B.toast({ approve: 'Approved. It is shared more widely now.', reject: 'Rejected', revoke: 'Revoked. Access is back to its source.' }[act]);
        draw();
      });
    };
  });
}
/* ---------- Review request: one popup for a promotion or a docs repository request ----------
 * window.GOV.reviewPopup(request, anchor, onDone) opens it under `anchor` (a bottom sheet on
 * phones). `request` is a PromotionOut, or a public declaration (it has container_path). Approve,
 * Decline and Revoke use the same endpoints and rules as the cards; a person who cannot decide
 * sees the details only. `onDone(updated)` runs after a decision. */
const REVIEW_SCOPE = (p) => SCOPE[p.to_scope] || p.to_scope;
function reviewPopup(request, anchor, onDone) {
  const repo = request.container_path !== undefined && request.document_id === undefined;
  const g = state();
  const names = B.S.cache.names || {};
  const tag = STATUS_TAG[request.status] || [request.status, ''];
  const mine = request.requested_by === B.S.me.id;
  const open = repo ? request.status === 'pending' : OPEN.includes(request.status);
  const who = (id) => (id === B.S.me.id ? 'You' : names[id] || 'A colleague');
  const from = repo ? 'Internal' : 'Its source access';
  const to = repo ? 'Public' : REVIEW_SCOPE(request);
  const title = repo ? B.containerName(request.container_path || 'A docs repository') : request.document_title || 'A document';
  const doc = repo
    ? `<div class="revdoc"><span class="adsl">${B.srcIcon('github_docs', 28)}</span><div><b>${esc(title)}</b><small>Whole repository</small></div></div>`
    : `<div class="revdoc"><span class="adsl" id="revlogo">${ICON('shield', 22)}</span><div><b>${esc(title)}</b><small id="revpath"></small></div><button type="button" class="link" id="revopen">Open document</button></div>`;
  let buttons = '';
  if (request.can_decide) {
    if (open) buttons = `<button type="button" class="btn" id="revno">Decline</button>${mine ? '' : '<button type="button" class="btn primary" id="revyes">Approve</button>'}`;
    else if (request.status === 'approved') buttons = '<button type="button" class="btn" id="revoke">Revoke</button>';
  }
  const note = !request.can_decide ? 'Only its owner, a domain owner or an admin can decide this.' : open && mine ? 'You cannot approve your own request.' : '';
  B.openModal(`<div class="modal bt" style="max-width:480px" role="dialog" aria-label="Review request"><div class="bar"><span>Review request</span><button type="button" class="link" data-close-modal>Close</button></div><div class="body"><div class="dmbody revpop"><div class="revh"><b>${esc(title)}</b><span class="tag ${tag[1]}">${tag[0]}</span></div>
    <div class="revwho">${AVATAR(who(request.requested_by), 'lav', 28)}<span><b>${esc(who(request.requested_by))}</b><small>${request.created_at ? B.when(request.created_at, B.ago(request.created_at)) : ''}</small></span></div>
    ${doc}
    <div class="revchg" role="group" aria-label="Access change"><span class="tag">${esc(from)}</span><i aria-hidden="true">${ICON('arrow', 14)}</i><span class="tag ${to === 'Public' ? 'warn' : 'blue'}">${esc(to)}</span></div>
    ${request.reason ? `<p class="revnote">${esc(request.reason)}</p>` : ''}
    ${note ? `<p class="ds-msg">${esc(note)}</p>` : ''}
    <div class="hse ds-msg bad" id="reve" role="alert"></div>
    ${buttons ? `<div class="actions"><span class="lsp"></span>${buttons}</div>` : ''}</div></div></div>`);
  const pop = $('#modal');
  if (!repo) {
    $('#revopen', pop).onclick = () => { B.closeModal(); window.DOCUMENTS.openDocument(request.document_id); };
    // The document's source and folder, when it can be read.
    B.api.get('/documents/' + request.document_id).then((d) => {
      if (!pop.classList.contains('on')) return;
      if (d.system) $('#revlogo', pop).innerHTML = B.srcIcon(d.system, 28);
      const path = d.domain && d.domain.path ? d.domain.path.map((c) => c.name).join(' / ') : '';
      $('#revpath', pop).textContent = path || B.systemName(d.system);
    }).catch(() => { if (pop.classList.contains('on')) $('#revpath', pop).textContent = ''; });
  }
  const fail = (error) => { $('#reve', pop).textContent = B.problem(error); };
  const decide = (act, button) => B.busy(button, async () => {
    const updated = await B.api.post(repo ? `/public-declarations/${request.id}/${act}` : `/promotions/${request.id}/${act}`, {});
    if (repo) {
      g.repos = g.repos.map((x) => (x.id === updated.id ? Object.assign({}, x, { status: updated.status, approved_by: updated.approved_by, decided_at: updated.decided_at, can_decide: updated.can_decide }) : x)).filter((x) => !g.status || x.status === g.status);
    } else {
      const i = g.items.findIndex((x) => x.id === updated.id);
      if (i >= 0) g.items[i] = Object.assign({}, g.items[i], { status: updated.status, approved_by: updated.approved_by, can_decide: updated.can_decide });
      if (g.status && updated.status !== g.status && i >= 0) g.items.splice(i, 1);
    }
    B.toast(repo
      ? { approve: 'Approved. The repository\'s published pages are Public now.', reject: 'Declined', revoke: 'Revoked. The repository\'s pages are Internal again.' }[act]
      : { approve: 'Approved. It is shared more widely now.', reject: 'Declined', revoke: 'Revoked. Access is back to its source.' }[act]);
    B.closeModal();
    if (onDone) onDone(updated);
    draw();
  }, fail);
  const yes = $('#revyes', pop), no = $('#revno', pop), rv = $('#revoke', pop);
  if (yes) yes.onclick = () => decide('approve', yes);
  if (no) no.onclick = () => { if (!no.dataset.arm) { no.dataset.arm = '1'; no.textContent = 'Confirm decline'; no.classList.add('danger'); return; } decide('reject', no); };
  if (rv) rv.onclick = () => { if (!rv.dataset.arm) { rv.dataset.arm = '1'; rv.textContent = 'Confirm revoke'; rv.classList.add('danger'); return; } decide('revoke', rv); };
}
window.GOV = { reviewPopup };
window.SURFACES.governance = page;
})();
