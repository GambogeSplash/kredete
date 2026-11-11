// The support bot demo page (support bot plan W4.1): embed-demo.html?key=<bk_live_...>&api=<bot API>
// adds the same script tag a site pastes, with the key and API address from the query string.
(function () {
  'use strict';
  const params = new URLSearchParams(window.location.search);
  const key = params.get('key');
  // An address pasted without its scheme ("api.example.com") would load as a path on this
  // site and the widget would never appear, so https:// is assumed.
  const raw = (params.get('api') || '').trim();
  const api = raw && !/^https?:\/\//i.test(raw) ? `https://${raw}` : raw;
  const help = document.getElementById('demo-help');
  if (!key || !api) {
    if (help) help.hidden = false;
    return;
  }
  const script = document.createElement('script');
  script.src = 'embed.js';
  script.async = true;
  script.dataset.key = key;
  script.dataset.api = api;
  document.body.appendChild(script);
})();
