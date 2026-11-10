// The support bot demo page (support bot plan W4.1): embed-demo.html?key=<bk_live_...>&api=<bot API>
// adds the same script tag a site pastes, with the key and API address from the query string.
(function () {
  'use strict';
  const params = new URLSearchParams(window.location.search);
  const key = params.get('key');
  const api = params.get('api');
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
