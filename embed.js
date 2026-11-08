/* Kredete support agent widget. Paste one script tag; no dependencies. */
(function () {
  'use strict';
  var s = document.currentScript;
  if (!s || window.__kredeteWidget) return;
  var d = s.dataset || {};
  if (!/^bk_live_[A-Za-z0-9]+$/.test(d.key || '')) return;
  window.__kredeteWidget = true;

  var accent = /^#[0-9a-f]{3,8}$/i.test(d.accent || '') ? d.accent : '#5e6ad2';
  var name = (d.name || d.product || 'Assistant').slice(0, 32);
  var greeting = d.greeting || 'Hi, how can I help?';
  var tone = d.tone === 'concise' ? 'concise' : 'friendly';
  var side = d.side === 'left' ? 'left' : 'right';
  var handoff = d.handoff !== 'false';
  var unknown = d.unknown || 'I could not find that in our help content.';
  var sugg = [];
  var raw = (d.suggestions || '').trim();
  if (raw) {
    try { var j = JSON.parse(raw); if (Array.isArray(j)) sugg = j; } catch (e) { sugg = raw.split('|'); }
  }
  sugg = sugg.map(function (q) { return String(q).trim(); }).filter(Boolean).slice(0, 3);

  var base = (s.src || '').replace(/[^\/]*(\?.*)?$/, '');
  var kb = [];
  var kbReady = fetch(base + 'embed-kb.json').then(function (r) { return r.json(); })
    .then(function (a) { kb = Array.isArray(a) ? a : []; }).catch(function () { kb = []; });

  var STOP = /^(the|what|how|does|can|for|you|are|and|with|much)$/;
  function answer(q) {
    var ws = q.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/)
      .filter(function (w) { return w.length > 2 && !STOP.test(w); });
    var best = null, sc = 0;
    kb.forEach(function (doc) {
      var t = ((doc.title || '') + ' ' + (doc.text || '')).toLowerCase();
      var n = ws.reduce(function (a, w) { return a + (t.indexOf(w) > -1 ? 1 : 0); }, 0);
      if (n > sc) { sc = n; best = doc; }
    });
    if (!best) return { ok: false };
    var first = String(best.text).split(/(?<=\.)\s/)[0];
    return { ok: true, text: (tone === 'friendly' ? 'Happy to help! ' : '') + first, src: best.title };
  }

  var host = document.createElement('div');
  host.setAttribute('data-kredete-widget', '');
  var root = host.attachShadow({ mode: 'open' });
  var CSS = ':host{all:initial}*{box-sizing:border-box}' +
    '.w{--a:' + accent + ';font:14px/1.45 -apple-system,BlinkMacSystemFont,"Inter","Segoe UI",Roboto,sans-serif;color:#1b1b1f;position:fixed;bottom:20px;' + side + ':20px;z-index:2147483000}' +
    'button{font:inherit;color:inherit;cursor:pointer}' +
    'button:focus-visible,input:focus-visible{outline:2px solid var(--a);outline-offset:2px}' +
    '.l{width:52px;height:52px;border-radius:50%;border:0;background:var(--a);color:#fff;display:grid;place-items:center;box-shadow:0 1px 2px rgba(0,0,0,.16),0 6px 16px rgba(0,0,0,.18);transition:transform .15s ease,opacity .15s ease}' +
    '.l:hover{transform:scale(1.05)}.l:active{transform:scale(.97)}' +
    '.p{position:absolute;bottom:64px;' + side + ':0;width:360px;height:min(520px,calc(100vh - 110px));background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:16px;box-shadow:0 1px 2px rgba(0,0,0,.06),0 12px 32px rgba(0,0,0,.16);display:flex;flex-direction:column;overflow:hidden;opacity:0;transform:translateY(8px) scale(.98);transform-origin:bottom ' + side + ';visibility:hidden;pointer-events:none;transition:transform .2s ease,opacity .2s ease,visibility 0s .2s}' +
    '.w.o .p{opacity:1;transform:none;visibility:visible;pointer-events:auto;transition:transform .2s ease,opacity .2s ease}' +
    '.h{display:flex;align-items:center;gap:10px;padding:12px 12px 12px 16px;border-bottom:1px solid rgba(0,0,0,.07)}' +
    '.av{width:28px;height:28px;border-radius:50%;background:var(--a);color:#fff;display:grid;place-items:center;font-weight:600;font-size:13px;flex:none}' +
    '.h b{flex:1;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.x{width:32px;height:32px;border:0;background:none;border-radius:8px;display:grid;place-items:center;color:#6b6b76}.x:hover{background:rgba(0,0,0,.05)}' +
    '.m{flex:1;overflow:auto;padding:16px;display:flex;flex-direction:column;gap:8px}' +
    '.b{max-width:85%;padding:9px 12px;border-radius:14px;background:#f3f3f5;overflow-wrap:anywhere}' +
    '.b.me{align-self:flex-end;background:var(--a);color:#fff}' +
    '.b small{display:block;margin-top:4px;font-size:12px;color:#6b6b76}' +
    '.c{display:flex;flex-direction:column;align-items:flex-start;gap:6px}' +
    '.q{border:1px solid rgba(0,0,0,.12);background:#fff;border-radius:999px;padding:6px 12px;text-align:left;transition:background .15s ease}.q:hover{background:#f3f3f5}' +
    '.b .q{margin-top:8px;display:block}' +
    '.f{display:flex;gap:8px;padding:10px 12px;border-top:1px solid rgba(0,0,0,.07)}' +
    '.f input{flex:1;min-width:0;font:inherit;font-size:14px;border:1px solid rgba(0,0,0,.14);border-radius:10px;padding:9px 12px;background:#fff;color:inherit}' +
    '.f button{width:38px;border:0;border-radius:10px;background:var(--a);color:#fff;display:grid;place-items:center}' +
    '@media(max-width:559px){.w{bottom:16px;' + side + ':16px}.p{position:fixed;left:0;right:0;bottom:0;width:auto;height:min(80vh,560px);border-radius:16px 16px 0 0;border-width:1px 0 0}.f input{font-size:16px}.w.o .l{opacity:0;pointer-events:none}}' +
    '@media(prefers-reduced-motion:reduce){*{transition:none!important}}';

  var chat = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>';
  var close = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  var send = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

  root.innerHTML = '<style>' + CSS + '</style><div class="w">' +
    '<div class="p" role="dialog" aria-label="' + 'Chat' + '"><div class="h"><span class="av"></span><b></b><button type="button" class="x" aria-label="Close chat">' + close + '</button></div>' +
    '<div class="m" aria-live="polite"></div>' +
    '<form class="f"><input type="text" aria-label="Ask a question" placeholder="Ask a question" autocomplete="off"><button type="submit" aria-label="Send">' + send + '</button></form></div>' +
    '<button type="button" class="l" aria-label="Open chat" aria-expanded="false">' + chat + '</button></div>';

  var $ = function (q) { return root.querySelector(q); };
  var w = $('.w'), launcher = $('.l'), input = $('.f input'), msgs = $('.m'), panel = $('.p');
  $('.av').textContent = (name.trim().charAt(0) || 'K').toUpperCase();
  $('.h b').textContent = name;
  panel.setAttribute('aria-label', name);

  function el(cls, text) { var e = document.createElement('div'); e.className = cls; if (text) e.textContent = text; return e; }
  function scroll() { msgs.scrollTop = msgs.scrollHeight; }

  msgs.appendChild(el('b', greeting));
  if (sugg.length) {
    var chips = el('c');
    sugg.forEach(function (q) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'q'; b.textContent = q;
      b.onclick = function () { chips.remove(); ask(q); };
      chips.appendChild(b);
    });
    msgs.appendChild(chips);
  }

  function ask(q) {
    q = q.trim(); if (!q) return;
    msgs.appendChild(el('b me', q)); scroll();
    kbReady.then(function () {
      var r = answer(q), a = el('b');
      if (r.ok) {
        a.textContent = r.text;
        var sm = document.createElement('small'); sm.textContent = 'From ' + r.src; a.appendChild(sm);
      } else {
        a.textContent = unknown;
        if (handoff) {
          var h = document.createElement('button'); h.type = 'button'; h.className = 'q'; h.textContent = 'Talk to a person';
          h.onclick = function () { h.replaceWith(Object.assign(document.createElement('small'), { textContent: 'A person will pick this up.' })); scroll(); };
          a.appendChild(h);
        }
      }
      msgs.appendChild(a); scroll();
    });
  }

  function open() { w.classList.add('o'); launcher.setAttribute('aria-expanded', 'true'); setTimeout(function () { input.focus(); }, 30); }
  function shut() { w.classList.remove('o'); launcher.setAttribute('aria-expanded', 'false'); launcher.focus(); }
  launcher.onclick = function () { w.classList.contains('o') ? shut() : open(); };
  $('.x').onclick = shut;
  root.addEventListener('keydown', function (e) { if (e.key === 'Escape' && w.classList.contains('o')) shut(); });
  $('.f').onsubmit = function (e) { e.preventDefault(); var v = input.value; input.value = ''; ask(v); };

  function mount() { document.body.appendChild(host); }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();
