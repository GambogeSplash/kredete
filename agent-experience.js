/* agent-experience.js: what visitors see (bot admin spec 6.2).
 *
 * The bot's settings in four groups, checked as the admin types (bot-form.js), beside the real
 * widget in its preview mode (embed.js): every keystroke redraws it, in the app's own light or
 * dark, as one of the bot's products shows it. Save sends only the fields that changed.
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

const TEXT_FIELDS = ['name', 'greeting', 'contact_label', 'contact_url', 'notice', 'privacy_url', 'daily_question_limit'];
const DEFAULT_LOOK = { accent: '#5e6ad2', side: 'right' };

/** The form's values for a bot. */
const valuesOf = (bot) => ({
  name: bot.name, greeting: bot.greeting, starters: [...bot.starters], contact_label: bot.contact_label,
  contact_url: bot.contact_url, notice: bot.notice, privacy_url: bot.privacy_url, daily_question_limit: String(bot.daily_question_limit),
});
const scheme = () => (document.documentElement.dataset.mode === 'dark' ? 'dark' : 'light');

A.pages.experience = (el, ctx) => {
  let bot = ctx.bot;
  let form = valuesOf(bot);
  /** Fields whose error shows: those touched, and all of them after a Save. */
  const touched = new Set();
  const products = F.byStatus(/** @type {any[]} */ (bot.products));
  /** The product whose accent and side the preview shows. */
  let previewProduct = products[0] || null;
  let view = 'start';

  const f = (key, label, o) => A.field(key, label, { ...o, prefix: 'ex', value: form[key] });
  el.innerHTML = `<div class="agexp">
    <form class="agexf" id="exform" novalidate>
      <fieldset class="agfs"><legend>Conversation</legend>
        ${f('name', 'Name', { max: F.LENGTHS.name[1], hint: 'Shown in the chat header.' })}
        ${f('greeting', 'Greeting', { max: F.LENGTHS.greeting[1], rows: 2, hint: 'The first thing visitors read. Leave it empty to start with the starters.' })}
        <div class="agfield" data-field="starters"><div class="aglab"><span class="hsl" id="exst-l">Starters</span></div><p class="suhint agst-h">Up to ${F.MAX_STARTERS} questions visitors can ask with one click.</p><div class="agstarters" id="exstarters" role="group" aria-labelledby="exst-l"></div></div>
      </fieldset>
      <fieldset class="agfs"><legend>Getting help</legend><p class="suhint agfs-d">What visitors see when the bot can't answer. ${window.DOCS.link('botContact')}</p>
        ${f('contact_label', 'Contact label', { max: F.LENGTHS.contact_label[1], hint: "Shown whenever the bot can't answer." })}
        ${f('contact_url', 'Contact link', { hint: 'A web page, or mailto: and an email address.', placeholder: 'https://kredete.com/support' })}
      </fieldset>
      <fieldset class="agfs"><legend>Trust</legend>
        ${f('notice', 'Notice', { max: F.LENGTHS.notice[1], rows: 2, hint: 'Always shown under the bot\'s name.' })}
        ${f('privacy_url', 'Privacy link', { hint: 'Where visitors read how their questions are used.', placeholder: 'https://kredete.com/privacy' })}
      </fieldset>
      <fieldset class="agfs"><legend>Limit</legend>
        ${f('daily_question_limit', 'Daily question limit', { type: 'number', hint: "This is also its daily spend cap. Past it, the bot says it's unavailable until midnight UTC." })}
      </fieldset>
    </form>
    <aside class="agpv" aria-label="Preview">
      <div class="agpv-c">
        <div class="seg agpv-v" role="group" aria-label="Show"><button type="button" data-view="start" aria-pressed="true">Start</button><button type="button" data-view="no_answer" aria-pressed="false">Can't answer</button></div>
        ${products.length > 1 ? `<label class="agpv-as"><span>Preview as</span><select id="exas" class="eminp">${products.map((p) => `<option value="${p.id}">${esc(p.name)}${p.status === 'live' ? '' : ' (revoked)'}</option>`).join('')}</select></label>` : ''}
      </div>
      <div class="agpv-box"><div id="exhost"></div></div>
      <p class="agpv-n">Preview. Ask real questions on your site or the demo page.</p>
    </aside>
  </div>`;

  const root = $('#exform', el);
  A.counters(root);

  /* ---- starters: a row each, with add and remove ---- */
  function drawStarters() {
    const box = $('#exstarters', el);
    box.innerHTML = form.starters.map((q, i) => `<div class="agstr" data-field="starters.${i}"><div class="agstr-r"><input class="eminp" id="exst${i}" value="${esc(q)}" maxlength="${F.LENGTHS.starter[1]}" aria-label="Starter ${i + 1}" aria-describedby="exst${i}-e" placeholder="What is the daily transfer limit?"><button type="button" class="btn sm" data-drop="${i}" aria-label="Remove starter ${i + 1}">Remove</button></div><p class="agerr" id="exst${i}-e" role="alert"></p></div>`).join('')
      + (form.starters.length < F.MAX_STARTERS ? `<button type="button" class="btn sm agstr-add" id="exstadd">Add a starter</button>` : '');
    $$('.agstr input', box).forEach((input, i) => {
      input.oninput = () => { form.starters[i] = input.value; touched.add(`starters.${i}`); changed(); };
    });
    $$('[data-drop]', box).forEach((b) => {
      b.onclick = () => {
        const i = Number(b.dataset.drop);
        form.starters.splice(i, 1);
        drawStarters(); changed();
        const next = $(`#exst${Math.min(i, form.starters.length - 1)}`, box) || $('#exstadd', box);
        if (next) next.focus();
      };
    });
    const add = $('#exstadd', box);
    if (add) add.onclick = () => { form.starters.push(''); drawStarters(); changed(); $(`#exst${form.starters.length - 1}`, box).focus(); };
  }

  /* ---- checking ---- */
  /** Every field's error, by data-field key. */
  function errors() {
    /** @type {Record<string, string | null>} */
    const out = {};
    for (const k of TEXT_FIELDS) out[k] = F.fieldError(k, form[k]);
    form.starters.forEach((q, i) => { out[`starters.${i}`] = q.trim() ? F.fieldError('starter', q) : null; });
    return out;
  }
  function showErrors(all) {
    const found = errors();
    for (const [k, message] of Object.entries(found)) A.showError(el, k, all || touched.has(k) ? message : null);
  }
  const valid = () => Object.values(errors()).every((e) => !e);
  const dirty = () => Object.keys(F.changes(bot, form)).length > 0;

  /* ---- the preview ---- */
  let preview = null;
  const settings = () => ({
    ...form,
    starters: form.starters.map((s) => s.trim()).filter(Boolean),
    accent: (previewProduct || DEFAULT_LOOK).accent,
    side: (previewProduct || DEFAULT_LOOK).side,
  });
  function drawPreview(extra) {
    if (!window.BrothBot) return;
    if (!preview) preview = window.BrothBot.preview($('#exhost', el), settings(), { scheme: scheme(), view });
    else preview.update(settings(), extra || {});
  }
  // The preview follows the app's light or dark mode while this page shows.
  const modes = new MutationObserver(() => {
    if (!el.isConnected) { modes.disconnect(); return; }
    drawPreview({ scheme: scheme() });
  });
  modes.observe(document.documentElement, { attributes: true, attributeFilter: ['data-mode'] });
  $$('[data-view]', el).forEach((b) => {
    b.onclick = () => {
      view = b.dataset.view;
      $$('[data-view]', el).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      drawPreview({ view });
    };
  });
  const as = $('#exas', el);
  if (as) as.onchange = () => { previewProduct = products.find((p) => p.id === as.value) || null; drawPreview(); };

  function changed() {
    showErrors(false);
    bar.update();
    drawPreview();
  }

  for (const k of TEXT_FIELDS) {
    const input = $(`#ex${k}`, el);
    input.addEventListener('input', () => { form[k] = input.value; touched.add(k); changed(); });
  }

  /* ---- saving ---- */
  function save(button) {
    showErrors(true);
    if (!valid()) return;
    const body = F.changes(bot, form);
    B.busy(button, async () => {
      bot = await B.api.patch(`/admin/bots/${bot.id}`, body);
      ctx.saved(bot);
      reset();
      B.toast('Saved. Sites show the change within 5 minutes.');
    }, (error) => {
      if (!A.serverErrors(el, error, null)) bar.error(B.problem(error));
      else bar.error('Check the fields marked above.');
    });
  }
  /** Back to the saved bot: the form, the starters, the preview and the bar. */
  function reset() {
    form = valuesOf(bot);
    touched.clear();
    for (const k of TEXT_FIELDS) $(`#ex${k}`, el).value = form[k];
    A.counters(el);
    drawStarters();
    showErrors(false);
    bar.update();
    drawPreview();
  }

  // The bar floats under the form only, never over the preview beside it.
  const bar = A.saveBar(root, { dirty, valid, save, discard: reset });
  drawStarters();
  drawPreview();
};
})();
