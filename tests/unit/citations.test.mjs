// Unit tests for citations.js (broth docs spec 7): only a Broth Docs citation opens in the app.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';

const { opensInApp } = createRequire(import.meta.url)('../../citations.js');

describe('opensInApp', () => {
  it('opens a Broth Docs section or article in the app', () => {
    for (const url of ['/docs/labelling-pages#format', '/docs/how-broth-is-organised']) {
      assert.equal(opensInApp({ link_target: 'in_app_docs', url }), true, url);
    }
  });
  it('leaves every other link target to the document drawer', () => {
    for (const link_target of ['source', 'docs_site', undefined]) {
      assert.equal(opensInApp({ link_target, url: '/docs/labelling-pages#format' }), false, String(link_target));
    }
  });
  it('never navigates to a URL that is not an in-app Docs path', () => {
    for (const url of ['https://evil.test/docs/x', '//evil.test/docs/x', '/library/x', '/docs/', '/docs/../admin', 'javascript:alert(1)', '']) {
      assert.equal(opensInApp({ link_target: 'in_app_docs', url }), false, url);
    }
    assert.equal(opensInApp(null), false);
  });
});
