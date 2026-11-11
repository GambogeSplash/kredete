/* governance.js: promotion requests (sandbox spec 4.3, plan C7.2).
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
const STATUS_TAG = { pending: ['Pending', 'blue'], needs_review: ['Needs review', 'warn'], approved: ['Approved', 'ok'], rejected: ['Rejected', ''], revoked: ['Revoked', ''] };
const SCOPE = { internal: 'Everyone at Broth', public: 'Public' };
const OPEN = ['pending', 'needs_review'];

function state() {
  const c = B.S.cache;
  if (!c.gov) c.gov = { status: '', items: [], next: null, loaded: false, loading: false, error: null, seq: 0 };
  return c.gov;
}
/** Names for requesters: admins can read the people list; everyone else sees "you" or a colleague. */
const people = () => window.ADMIN.names();
const who = (id, names) => (id === B.S.me.id ? 'you' : names[id] || 'a colleague');

function page() {
  const g = state();
  $('#app').innerHTML = `<div class="pg gov"><h1>Governance</h1><p class="sub pgsub">Requests to share a document more widely. A document's owner, a domain owner of its domain, or an admin decides; nobody approves their own request.</p>
    <div class="libchips govtabs" role="tablist" aria-label="Status">${STATUSES.map(([k, l]) => `<button type="button" class="lchip ${g.status === k ? 'on' : ''}" role="tab" aria-selected="${g.status === k}" data-st="${k}">${l}</button>`).join('')}</div>
    <div class="actl govlist" id="govlist"></div><div class="chmore" id="govmore"></div></div>`;
  $$('[data-st]').forEach((b) => { b.onclick = () => { g.status = b.dataset.st; page(); load(true); }; });
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
    const [result] = await Promise.all([B.api.get('/promotions', { status: g.status || null, limit: 30, cursor: reset ? null : g.next }), people()]);
    if (mine !== g.seq) return;
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
  list.classList.toggle('isempty', !g.items.length);
  list.innerHTML = g.items.length
    ? g.items.map((p) => { const tag = STATUS_TAG[p.status] || [p.status, '']; return `<div class="actr govr"><span class="actic">${ICON('shield', 16)}</span><span class="actt"><button type="button" class="link govdoc" data-doc="${p.document_id}">${esc(p.document_title || 'A document')}</button><small>${esc(SCOPE[p.to_scope] || p.to_scope)} · requested by ${esc(who(p.requested_by, names))}${p.created_at ? ' · ' + B.when(p.created_at, B.ago(p.created_at)) : ''}</small>${p.reason ? `<span class="govreason">${esc(p.reason)}</span>` : ''}</span><span class="actb"><span class="tag ${tag[1]}">${tag[0]}</span>${actions(p)}</span></div>`; }).join('')
    : `<div class="empty govempty"><h2>${g.status ? 'Nothing here' : 'No requests yet'}</h2><p>${g.status ? 'No requests have this status.' : 'Ask to share a document more widely from its details in the Library.'}</p></div>`;
  more.innerHTML = g.next ? `<button type="button" class="btn sm" id="govload" ${g.loading ? 'disabled' : ''}>${g.loading ? 'Loading' : 'Show more'}</button>` : '';
  const m = $('#govload');
  if (m) m.onclick = () => load(false);
  $$('[data-doc]', list).forEach((b) => { b.onclick = () => window.DOCUMENTS.openDocument(b.dataset.doc); });
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
