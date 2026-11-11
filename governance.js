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
  const tip = 'Requests to share a document, or a whole docs repository, more widely. Its owner, a domain owner of its domain, or an admin decides; nobody approves their own request.';
  const inner = `<div class="ds-head"><h1 class="lcont-t">Sharing requests<span class="hint" tabindex="0" data-tip="${esc(tip)}" aria-label="${esc(tip)}">i</span></h1></div>
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
  if (!p.can_decide) return '';
  const mine = p.requested_by === B.S.me.id;
  let h = '';
  if (OPEN.includes(p.status)) {
    if (!mine) h += `<button type="button" class="btn sm primary" data-act="approve" data-id="${p.id}">Approve</button>`;
    h += `<button type="button" class="btn sm" data-act="reject" data-id="${p.id}">Reject</button>`;
  } else if (p.status === 'approved') {
    h += `<button type="button" class="btn sm" data-act="revoke" data-id="${p.id}">Revoke</button>`;
  }
  return h;
}
/** A request to make a whole docs repository Public. Nobody approves their own; an approved
 * one stays listed so it can be revoked here. */
function repoActions(d) {
  if (!d.can_decide) return '';
  if (d.status === 'pending') {
    const approve = d.requested_by === B.S.me.id ? '' : `<button type="button" class="btn sm primary" data-ract="approve" data-id="${d.id}">Approve</button>`;
    return `${approve}<button type="button" class="btn sm" data-ract="reject" data-id="${d.id}">Reject</button>`;
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
    list.innerHTML = g.error ? B.errorBlock(g.error, 'govretry') : `<div class="skwrap" role="status"><span class="sr">Loading requests</span>${B.skeletonRows(4)}</div>`;
    const r = $('#govretry');
    if (r) r.onclick = () => load(true);
    more.innerHTML = '';
    return;
  }
  list.classList.toggle('isempty', !g.items.length && !g.repos.length);
  list.innerHTML = g.items.length || g.repos.length
    ? g.repos.map(repoRow).join('') + g.items.map((p) => { const tag = STATUS_TAG[p.status] || [p.status, '']; const acts = actions(p); return `<article class="adrq govr"><span class="adsl">${ICON('shield', 22)}</span><div class="adrqb"><div class="adrqt"><button type="button" class="link govdoc" data-doc="${p.document_id}">${esc(p.document_title || 'A document')}</button><span class="tag ${tag[1]}">${tag[0]}</span></div><p>Wants to share with <b>${esc(SCOPE[p.to_scope] || p.to_scope)}</b>${scopeTag(p.to_scope)}</p>${meta(p.requested_by, p.created_at, names)}${p.reason ? `<p class="adrqn govreason">${esc(p.reason)}</p>` : ''}</div><div class="adrqa">${acts}</div></article>`; }).join('')
    : `<div class="ixempty govempty"><b>${g.status ? 'Nothing here' : 'No requests yet'}</b><p>${g.status ? 'No requests have this status.' : 'Ask to share a document more widely from its details in the Library.'}</p></div>`;
  if (g.rise) { g.rise = false; window.ADMIN.life(list); }
  more.innerHTML = g.next ? `<button type="button" class="btn sm" id="govload" ${g.loading ? 'disabled' : ''}>${g.loading ? 'Loading' : 'Show more'}</button>` : '';
  const m = $('#govload');
  if (m) m.onclick = () => load(false);
  $$('[data-doc]', list).forEach((b) => { b.onclick = () => window.DOCUMENTS.openDocument(b.dataset.doc); });
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
window.SURFACES.governance = page;
})();
