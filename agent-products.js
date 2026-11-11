/* agent-products.js: where a bot runs (bot admin spec 7).
 *
 * A card per product, revoked ones last. A live product's settings (name, allowed sites,
 * colour, side) save with their own bar; its snippet copies as the server builds it; the sites
 * it runs on need the snippet's two origins in their Content Security Policy; and its key can
 * be replaced or revoked, neither of which can be undone. A revoked product is read only.
 */
(() => {
'use strict';
const B = window.BRAIN;
const F = window.BOT_FORM;
const A = window.AGENT;
const esc = B.esc;
/** @type {(s: string, r?: ParentNode) => any} */
const $ = (s, r = document) => r.querySelector(s);
/** @type {(s: string, r?: ParentNode) => any[]} */
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/** The accents offered first; any hex colour works. Each keeps white text readable. */
const SWATCHES = [['#5e6ad2', 'Indigo'], ['#5a0fc8', 'Kredete purple'], ['#1f7a4a', 'Green'], ['#1b1b1f', 'Graphite']];
/** The product shown on each bot's page, kept while moving between pages. */
const shown = new Map();


A.pages.products = (el, ctx) => {
  let bot = ctx.bot;

  function draw() {
    const products = F.byStatus(/** @type {any[]} */ (bot.products));
    const current = products.find((p) => p.id === shown.get(bot.id)) || products[0] || null;
    if (current) shown.set(bot.id, current.id);
    el.innerHTML = `<p class="sub agintro">Each site the bot runs on is a product, with its own key and the sites it may load on. ${window.DOCS.link('botSnippet')}</p>
      <div class="pgrid agpgrid">${products.map((p) => `<button type="button" class="pcard${p.status === 'live' ? '' : ' off'}${current && p.id === current.id ? ' on' : ''}" data-pid="${p.id}" aria-pressed="${current && p.id === current.id}"><span class="pico agpico" style="--c:${esc(p.accent)}" aria-hidden="true">${window.ICON('chat', 18)}</span><span class="pcn"><b>${esc(p.name)}</b><small>${esc(p.allowed_origins[0] || '')}${p.allowed_origins.length > 1 ? ` +${p.allowed_origins.length - 1} more` : ''}</small></span>${p.status === 'live' ? '<span class="tag ok">Live</span>' : '<span class="tag">Revoked</span>'}</button>`).join('')}<button type="button" class="pcard padd" id="agpadd"><span class="pico plus" aria-hidden="true">+</span><span class="pcn"><b>Add a product</b><small>A key for another site</small></span></button></div>
      <div id="agpdetail"></div>`;
    $$('[data-pid]', el).forEach((b) => { b.onclick = () => leave(() => { shown.set(bot.id, b.dataset.pid); draw(); }); });
    $('#agpadd', el).onclick = () => leave(addProduct);
    if (!current) {
      $('#agpdetail', el).innerHTML = `<div class="acard agpempty">${B.emptyBlock('No products yet', 'Add one for each site the bot should run on. Each gets its own snippet to paste there.')}</div>`;
      B.guardLeaving(() => false);
      return;
    }
    if (current.status === 'live') detail(current); else revoked(current);
  }

  /** Switching product drops unsaved settings only after asking, as leaving the page does. */
  let dirty = () => false;
  const leave = (then) => (dirty() ? B.askToLeave(() => { dirty = () => false; then(); }) : then());

  /** Puts the server's product into the bot, and tells the shell. */
  function stored(product) {
    bot = { ...bot, products: bot.products.some((p) => p.id === product.id) ? bot.products.map((p) => (p.id === product.id ? product : p)) : bot.products.concat(product) };
    ctx.saved(bot);
  }

  /* ---- a revoked product (spec 7.3) ---- */
  function revoked(p) {
    dirty = () => false;
    B.guardLeaving(() => false);
    $('#agpdetail', el).innerHTML = `<section class="acard agpd" aria-labelledby="agpdh"><div class="agcard-h"><h2 id="agpdh">${esc(p.name)}</h2><span class="tag">Revoked</span></div>
      <p class="sub agpd-sub">Revoked ${B.fmtDate(p.revoked_at)}. Its key no longer works, and it can't be restored. Add a new product to put the bot back on these sites.</p>
      <dl class="agkvs">${row('Sites', p.allowed_origins.map(esc).join('<br>'))}${row('Key', `<code class="agkey-v">${esc(F.maskKey(p.key))}</code>`)}</dl></section>`;
  }
  const row = (label, value) => `<div class="agkv"><dt>${esc(label)}</dt><dd>${value}</dd></div>`;

  /* ---- a live product (spec 7.2) ---- */
  function detail(p) {
    let form = { name: p.name, sites: [...p.allowed_origins], accent: p.accent, side: p.side };
    const touched = new Set();
    const origins = F.snippetOrigins(p.snippet);
    const demo = origins && p.allowed_origins.includes(location.origin)
      ? `/embed-demo.html?key=${encodeURIComponent(p.key)}&api=${encodeURIComponent(origins.api)}` : null;
    $('#agpdetail', el).innerHTML = `<section class="acard agpd" aria-labelledby="agpdh"><div class="agcard-h"><h2 id="agpdh">${esc(p.name)}</h2><span class="tag ok">Live</span></div>
      <h3 class="agpd-t">Snippet</h3>
      ${p.snippet
        ? `<p class="sub agpd-sub">Paste it into every page of these sites, just before <code>&lt;/body&gt;</code>.</p><div class="agsnip"><pre class="code" id="agsnip" tabindex="0" aria-label="Snippet">${esc(p.snippet)}</pre><button type="button" class="btn sm" id="agcopy">${window.ICON('copy', 14)}<span>Copy</span></button></div>`
        : '<p class="agwarn">The bot API address isn\'t configured yet, so there is no snippet to paste. Set BROTH_BOT_API_URL on the server.</p>'}
      ${origins ? `<p class="agpd-csp">If your site sets a Content Security Policy, allow <code>${esc(origins.client)}</code> in <code>script-src</code> and <code>${esc(origins.api)}</code> in <code>connect-src</code>.</p>` : ''}
      ${demo ? `<p class="agpd-demo"><a class="btn sm" href="${esc(demo)}" target="_blank" rel="noopener">${window.ICON('ext', 14)}<span>Open the demo page</span></a></p>` : ''}
      <h3 class="agpd-t">Settings</h3>
      <form id="agpf" class="agpf" novalidate>
        ${A.field('name', 'Name', { prefix: 'pd', value: form.name, max: F.LENGTHS.product_name[1] })}
        <div class="agfield" data-field="allowed_origins"><div class="aglab"><span class="hsl" id="pdsites-l">Sites it runs on</span></div><p class="suhint agst-h">Only the site: scheme, host and port, like https://help.kredete.com. Up to ${F.MAX_SITES}.</p><div class="agsites" id="pdsites" role="group" aria-labelledby="pdsites-l"></div><p class="agerr" role="alert"></p></div>
        <div class="agfield" data-field="accent"><span class="hsl" id="pdacc-l">Colour</span><div class="agacc" role="group" aria-labelledby="pdacc-l">${SWATCHES.map(([hex, label]) => `<button type="button" class="agsw" data-hex="${hex}" style="--c:${hex}" aria-label="${label}" aria-pressed="false"></button>`).join('')}<input id="pdaccent" class="eminp mono agaccx" aria-label="Colour as a hex value" maxlength="7" spellcheck="false"></div><p class="suhint" id="pdacc-h"></p><p class="agerr" role="alert"></p></div>
        <div class="agfield"><span class="hsl" id="pdside-l">Button side</span><div class="seg agside" role="group" aria-labelledby="pdside-l"><button type="button" data-side="left" aria-pressed="false">Left</button><button type="button" data-side="right" aria-pressed="false">Right</button></div></div>
      </form>
      <h3 class="agpd-t">Key</h3>
      <div class="agkey"><code class="agkey-v">${esc(F.maskKey(p.key))}</code><span class="lsp"></span><button type="button" class="btn sm" id="agreplace">Replace key</button><button type="button" class="btn sm danger-o" id="agrevoke">Revoke</button></div>
      <p class="suhint agkey-h">The key is in the page source, so it is not a secret. ${window.DOCS.link('botKeys', 'When to replace it')}</p>
    </section>`;
    const pf = $('#agpf', el);
    A.counters(pf);

    function sites() {
      const box = $('#pdsites', el);
      box.innerHTML = form.sites.map((s, i) => `<div class="agstr" data-field="allowed_origins.${i}"><div class="agstr-r"><input class="eminp" id="pdsite${i}" value="${esc(s)}" aria-label="Site ${i + 1}" aria-describedby="pdsite${i}-e" placeholder="https://help.kredete.com" spellcheck="false" autocomplete="off"><button type="button" class="btn sm" data-drop="${i}" aria-label="Remove site ${i + 1}"${form.sites.length === 1 ? ' disabled' : ''}>Remove</button></div><p class="agerr" id="pdsite${i}-e" role="alert"></p></div>`).join('')
        + (form.sites.length < F.MAX_SITES ? '<button type="button" class="btn sm agstr-add" id="pdsiteadd">Add a site</button>' : '');
      $$('.agstr input', box).forEach((input, i) => {
        input.oninput = () => { form.sites[i] = input.value; touched.add(`allowed_origins.${i}`); changed(); };
        input.onblur = () => { const n = F.normalizeOrigin(input.value); if (n.origin && n.origin !== input.value) { input.value = n.origin; form.sites[i] = n.origin; changed(); } };
      });
      $$('[data-drop]', box).forEach((b) => {
        b.onclick = () => { const i = Number(b.dataset.drop); form.sites.splice(i, 1); sites(); changed(); ($(`#pdsite${Math.min(i, form.sites.length - 1)}`, box) || $('#pdsiteadd', box)).focus(); };
      });
      const add = $('#pdsiteadd', box);
      if (add) add.onclick = () => { form.sites.push(''); sites(); changed(); $(`#pdsite${form.sites.length - 1}`, box).focus(); };
    }

    function errors() {
      /** @type {Record<string, string | null>} */
      const out = { name: F.fieldError('product_name', form.name), accent: F.fieldError('accent', form.accent) };
      form.sites.forEach((s, i) => { out[`allowed_origins.${i}`] = s.trim() ? (F.normalizeOrigin(s).error || null) : 'Required.'; });
      return out;
    }
    const valid = () => Object.values(errors()).every((e) => !e);
    const body = () => {
      /** @type {Record<string, any>} */
      const out = {};
      if (form.name.trim() !== p.name) out.name = form.name.trim();
      const next = form.sites.map((s) => F.normalizeOrigin(s).origin || s.trim());
      if (JSON.stringify(next) !== JSON.stringify(p.allowed_origins)) out.allowed_origins = next;
      if (form.accent.toLowerCase() !== p.accent.toLowerCase()) out.accent = form.accent.toLowerCase();
      if (form.side !== p.side) out.side = form.side;
      return out;
    };
    dirty = () => Object.keys(body()).length > 0;

    function look() {
      const hex = form.accent;
      $$('.agsw', el).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.hex.toLowerCase() === hex.toLowerCase())));
      $$('[data-side]', el).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.side === form.side)));
      const hint = $('#pdacc-h', el);
      hint.textContent = !F.fieldError('accent', hex) && F.whiteContrast(hex) < 4.5 ? 'White text is hard to read on this colour. The button and the visitor\'s questions use it.' : '';
    }
    function changed() {
      for (const [k, message] of Object.entries(errors())) A.showError(el, k, touched.has(k) ? message : null);
      look();
      bar.update();
    }

    $('#pdname', el).addEventListener('input', (e) => { form.name = e.target.value; touched.add('name'); changed(); });
    const hex = $('#pdaccent', el);
    hex.value = form.accent;
    hex.oninput = () => { form.accent = hex.value.trim(); touched.add('accent'); changed(); };
    $$('.agsw', el).forEach((b) => { b.onclick = () => { form.accent = b.dataset.hex; hex.value = b.dataset.hex; changed(); }; });
    $$('[data-side]', el).forEach((b) => { b.onclick = () => { form.side = b.dataset.side; changed(); }; });

    function save(button) {
      for (const k of Object.keys(errors())) touched.add(k);
      changed();
      if (!valid()) return;
      B.busy(button, async () => {
        const next = await B.api.patch(`/admin/products/${p.id}`, body());
        stored(next);
        draw();
        B.toast('Saved. Sites show the change within 5 minutes.');
      }, (error) => { if (!A.serverErrors(el, error, null)) bar.error(B.problem(error)); else bar.error('Check the fields marked above.'); });
    }
    function discard() {
      form = { name: p.name, sites: [...p.allowed_origins], accent: p.accent, side: p.side };
      touched.clear();
      $('#pdname', el).value = form.name;
      A.counters(pf);
      hex.value = form.accent;
      sites();
      changed();
    }

    const bar = A.saveBar(pf, { dirty, valid, save, discard });
    sites();
    look();

    const copy = $('#agcopy', el);
    if (copy) copy.onclick = async () => { try { await navigator.clipboard.writeText(p.snippet); B.toast('Snippet copied'); } catch (e) { B.toast('Select the snippet and copy it'); } };
    $('#agreplace', el).onclick = async () => {
      if (!await A.confirmAction({ title: 'Replace this key?', text: 'The old key stops working right away. Sites using it need the new snippet.', action: 'Replace key' })) return;
      await B.busy($('#agreplace', el), async () => { stored(await B.api.post(`/admin/products/${p.id}/replace-key`)); draw(); B.toast('Key replaced. Paste the new snippet on your sites.'); });
    };
    $('#agrevoke', el).onclick = async () => {
      if (!await A.confirmAction({ title: `Revoke ${p.name}?`, text: "This can't be undone. The bot disappears from these sites.", action: 'Revoke' })) return;
      await B.busy($('#agrevoke', el), async () => { stored(await B.api.post(`/admin/products/${p.id}/revoke`)); draw(); B.toast(`${p.name} is revoked.`); });
    };
  }

  /* ---- adding a product (spec 7.4) ---- */
  function addProduct() {
    B.openModal(`<div class="modal ppmodal" role="dialog" aria-label="Add a product"><div class="bar"><span>Add a product</span><button type="button" class="link" data-close-modal>Close</button></div><div class="body">
      <form id="apf" novalidate>
        ${A.field('name', 'Name', { prefix: 'ap', placeholder: 'Help centre', max: F.LENGTHS.product_name[1] })}
        ${A.field('allowed_origins.0', 'Site it runs on', { prefix: 'ap', placeholder: 'https://help.kredete.com', hint: 'Only the site. Add more sites after creating it.' })}
        <div class="agfield"><span class="hsl" id="apacc-l">Colour</span><div class="agacc" role="group" aria-labelledby="apacc-l">${SWATCHES.map(([hex, label], i) => `<button type="button" class="agsw" data-hex="${hex}" style="--c:${hex}" aria-label="${label}" aria-pressed="${i === 0}"></button>`).join('')}</div></div>
        <div class="agfield"><span class="hsl" id="apside-l">Button side</span><div class="seg agside" role="group" aria-labelledby="apside-l"><button type="button" data-side="left" aria-pressed="false">Left</button><button type="button" data-side="right" aria-pressed="true">Right</button></div></div>
        <div class="hse" id="ape" role="alert"></div>
        <div class="actions"><button type="submit" class="btn primary" id="apgo">Create key</button><button type="button" class="btn" data-close-modal>Cancel</button></div>
      </form></div></div>`);
    const form = $('#apf');
    A.counters(form);
    let accent = SWATCHES[0][0];
    let side = 'right';
    $$('.agsw', form).forEach((b) => { b.onclick = () => { accent = b.dataset.hex; $$('.agsw', form).forEach((x) => x.setAttribute('aria-pressed', String(x === b))); }; });
    $$('[data-side]', form).forEach((b) => { b.onclick = () => { side = b.dataset.side; $$('[data-side]', form).forEach((x) => x.setAttribute('aria-pressed', String(x === b))); }; });
    $('#apname').focus();
    form.onsubmit = (e) => {
      e.preventDefault();
      const name = $('#apname').value;
      const site = F.normalizeOrigin($('#apallowed_origins0').value);
      const nameError = F.fieldError('product_name', name);
      const siteError = $('#apallowed_origins0').value.trim() ? site.error || null : 'Required.';
      A.showError(form, 'name', nameError);
      A.showError(form, 'allowed_origins.0', siteError);
      if (nameError || siteError) { $(nameError ? '#apname' : '#apallowed_origins0').focus(); return; }
      B.busy($('#apgo'), async () => {
        const product = await B.api.post(`/admin/bots/${bot.id}/products`, { name: name.trim(), allowed_origins: [site.origin], accent, side });
        B.closeModal();
        stored(product);
        shown.set(bot.id, product.id);
        draw();
        B.toast('Paste the snippet on your site.');
      }, (error) => A.serverErrors(form, error, $('#ape')));
    };
  }

  draw();
};
})();
