// Unit tests for bot-form.js (bot admin spec 6.2 and 7.2): the API's field rules, allowed
// sites, what changed in a form, and the bot's status.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';

import { ORIGINS } from './bot-origins.fixture.mjs';

const F = createRequire(import.meta.url)('../../bot-form.js');

describe('normalizeOrigin, on the held-out sites', () => {
  it('agrees with the server on every one', () => {
    const wrong = ORIGINS.filter((c) => {
      const got = F.normalizeOrigin(c.input);
      return c.origin ? got.origin !== c.origin : !got.error;
    });
    assert.deepEqual(wrong.map((c) => c.input), [], `${ORIGINS.length - wrong.length} of ${ORIGINS.length} agree`);
  });
  it('gives a reason people can act on, never the server wording', () => {
    for (const c of ORIGINS.filter((x) => x.error)) {
      const { error } = F.normalizeOrigin(c.input);
      assert.match(error, /^[A-Z].*\.$/, c.input);
    }
    assert.equal(F.normalizeOrigin('https://help.kredete.com/docs').error, 'Use only the site, like https://help.kredete.com.');
  });
});

describe('fieldError', () => {
  const ok = (field, value) => assert.equal(F.fieldError(field, value), null, `${field}: ${JSON.stringify(value)}`);
  const bad = (field, value) => assert.ok(F.fieldError(field, value), `${field}: ${JSON.stringify(value)}`);

  it('holds each text field to the API lengths, counted after trimming', () => {
    for (const [field, min, max] of [['name', 1, 32], ['greeting', 0, 120], ['contact_label', 1, 32], ['notice', 1, 160], ['starter', 1, 60], ['product_name', 1, 60]]) {
      ok(field, 'x'.repeat(max));
      ok(field, `  ${'x'.repeat(max)}  `);
      bad(field, 'x'.repeat(max + 1));
      if (min) { bad(field, ''); bad(field, '   '); } else ok(field, '');
    }
  });
  it('takes an https link or one mailto address for contact, and https only for privacy', () => {
    for (const v of ['https://kredete.com/help', 'mailto:help@kredete.com']) ok('contact_url', v);
    for (const v of ['http://kredete.com', 'mailto:', 'mailto:a@b', 'mailto:a@b.com,c@d.com', 'help@kredete.com', 'https://', '']) bad('contact_url', v);
    ok('privacy_url', 'https://kredete.com/privacy');
    for (const v of ['mailto:privacy@kredete.com', 'http://kredete.com/privacy', 'kredete.com/privacy', '']) bad('privacy_url', v);
  });
  it('takes a whole daily limit from 1 to 1,000,000', () => {
    for (const v of ['1', '2000', '1000000', 2000]) ok('daily_question_limit', v);
    for (const v of ['0', '1000001', '2.5', '-1', '', 'lots', '1e3']) bad('daily_question_limit', v);
  });
  it('says a required field is required before saying how to fill it', () => {
    for (const f of ['name', 'contact_label', 'notice', 'contact_url', 'privacy_url', 'daily_question_limit', 'accent']) assert.equal(F.fieldError(f, '  '), 'Required.', f);
  });
  it('takes a six-digit hex accent', () => {
    for (const v of ['#5e6ad2', '#5E6AD2']) ok('accent', v);
    for (const v of ['5e6ad2', '#5e6', '#5e6ad2ff', 'indigo']) bad('accent', v);
  });
});

describe('changes', () => {
  const saved = { name: 'Help', greeting: 'Hi', starters: ['A?', 'B?'], contact_label: 'Contact support', contact_url: 'https://k.com', notice: 'N', privacy_url: 'https://k.com/p', daily_question_limit: 2000 };
  it('is empty for an untouched form, and for one that differs only by spaces', () => {
    assert.deepEqual(F.changes(saved, { ...saved }), {});
    assert.deepEqual(F.changes(saved, { ...saved, name: ' Help ', starters: ['A?', ' B? ', ''] }), {});
  });
  it('carries only the fields that changed, trimmed, with empty starters dropped', () => {
    assert.deepEqual(F.changes(saved, { ...saved, name: ' Helper ', daily_question_limit: '500', starters: ['', 'B?', 'C?'] }), { name: 'Helper', daily_question_limit: 500, starters: ['B?', 'C?'] });
  });
});

describe('status', () => {
  const product = (status, origins) => ({ status, allowed_origins: origins });
  it('counts distinct sites over live products only', () => {
    const bot = { products: [product('live', ['https://a.com', 'https://b.com']), product('live', ['https://b.com']), product('revoked', ['https://c.com'])] };
    assert.equal(F.liveSites(bot), 2);
    assert.equal(F.liveSites({ products: [product('revoked', ['https://c.com'])] }), 0);
  });
  it('is ready to answer when a chosen source has a Public page', () => {
    const connections = [{ id: 'k1', status: 'healthy' }, { id: 'k2', status: 'disconnected' }];
    const containers = [
      { id: 'a', connection_id: 'k1', public_documents: 0, included: true },
      { id: 'b', connection_id: 'k1', public_documents: 3, included: true },
      { id: 'c', connection_id: 'k1', public_documents: 5, included: false },
      { id: 'd', connection_id: 'k2', public_documents: 7, included: true },
    ];
    assert.equal(F.canAnswer({ sources: ['a'] }, containers, connections), false);
    assert.equal(F.canAnswer({ sources: ['c'] }, containers, connections), false);
    assert.equal(F.canAnswer({ sources: ['d'] }, containers, connections), false); // its connection is gone
    assert.equal(F.canAnswer({ sources: ['a', 'b'] }, containers, connections), true);
    assert.equal(F.publicPages({ sources: ['a', 'b', 'c', 'd', 'gone'] }, containers, connections), 3);
    assert.deepEqual(F.served({ sources: ['b', 'c', 'd'] }, containers, connections).map((c) => c.id), ['b']);
  });
  it('lists live products before revoked ones, keeping their order', () => {
    const ps = [{ id: 1, status: 'revoked' }, { id: 2, status: 'live' }, { id: 3, status: 'revoked' }, { id: 4, status: 'live' }];
    assert.deepEqual(F.byStatus(ps).map((p) => p.id), [2, 4, 1, 3]);
  });
  it('masks a key to its first 12 and last 4 characters', () => {
    assert.equal(F.maskKey('bk_live_abcd0123456789012345678901234wxyz'), 'bk_live_abcd••••wxyz');
  });
  it('reads the two origins a site must allow from a snippet', () => {
    assert.deepEqual(F.snippetOrigins('<script src="https://app.kredete.com/embed.js" data-key="bk_live_x" data-api="https://bot.kredete.com" async></script>'), { client: 'https://app.kredete.com', api: 'https://bot.kredete.com' });
    assert.equal(F.snippetOrigins(null), null);
  });
});

describe('whiteContrast', () => {
  it('measures white text on an accent, as the launcher and contact button draw it', () => {
    assert.ok(Math.abs(F.whiteContrast('#000000') - 21) < 0.01);
    assert.ok(Math.abs(F.whiteContrast('#ffffff') - 1) < 0.01);
    for (const ok of ['#5e6ad2', '#5a0fc8', '#1f7a4a', '#1b1b1f']) assert.ok(F.whiteContrast(ok) >= 4.5, ok);
    for (const weak of ['#26a269', '#f5a623', '#e5e5e5']) assert.ok(F.whiteContrast(weak) < 4.5, weak);
  });
});
