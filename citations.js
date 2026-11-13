/* citations.js: where a citation opens, with no DOM (broth docs spec 7; docs site link spec 4.1).
 *
 * A citation of Broth's own Docs is a page of this app (`/docs/<slug>#<section>`), opened in
 * place; every other citation opens the document drawer. Only an `in_app_docs` link whose URL
 * is an in-app Docs path opens in the app, so a citation can never navigate anywhere else.
 *
 * Loaded as a classic script (window.CITATIONS) and as a CommonJS module by the unit tests.
 */
(function (root, factory) {
  const exported = factory();
  if (typeof module === 'object' && module.exports) module.exports = exported;
  else root.CITATIONS = exported;
})(globalThis, function () {
  'use strict';
  const IN_APP_DOCS = /^\/docs\/[a-z0-9-]+(#[a-z0-9-]+)?$/;
  /** @param {{ link_target?: string, url?: string } | null | undefined} citation */
  function opensInApp(citation) {
    return !!citation && citation.link_target === 'in_app_docs' && IN_APP_DOCS.test(String(citation.url || ''));
  }
  return { opensInApp };
});
