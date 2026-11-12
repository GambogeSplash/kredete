// Held-out variants for capabilities in the client (developer role spec 2.4, 3.3 and 3.5;
// plan DRW0.1). Written before app.js changed, and never edited afterwards except to remove
// the `todo` marker: they test what each person may do and see, not how it is built.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';

const require = createRequire(import.meta.url);
/** @returns {any} */
function caps() {
  try { return require('../../capabilities.js'); } catch { return {}; }
}

const ALL = ['sources.manage', 'docs_repos.connect', 'sync_runs.read', 'bots.manage', 'people.manage', 'domains.manage', 'sharing.decide_any', 'labels.review_any', 'audit.read', 'lineage.read', 'sandbox.manage'];
const ME = {
  admin: { roles: ['admin'], capabilities: ALL, owned_domain_ids: [] },
  compliance: { roles: ['compliance'], capabilities: ['audit.read', 'lineage.read'], owned_domain_ids: [] },
  developer: { roles: ['developer'], capabilities: ['bots.manage', 'docs_repos.connect', 'lineage.read', 'sync_runs.read'], owned_domain_ids: [] },
  owner: { roles: ['domain_owner'], capabilities: [], owned_domain_ids: ['d1'] },
  employee: { roles: [], capabilities: [], owned_domain_ids: [] },
};

describe('can', () => {
  it('grants nothing without a session', () => {
    for (const capability of ALL) assert.equal(caps().can(null, capability), false);
  });
  it('reads only the capabilities the server sent, never role names', () => {
    assert.equal(caps().can({ roles: ['admin'], capabilities: [] }, 'sources.manage'), false);
    assert.equal(caps().can(ME.developer, 'bots.manage'), true);
    assert.equal(caps().can(ME.developer, 'sources.manage'), false);
    assert.equal(caps().can(ME.compliance, 'audit.read'), true);
  });
  it('holds whatever several roles add up to', () => {
    const both = { roles: ['compliance', 'developer'], capabilities: [...ME.compliance.capabilities, ...ME.developer.capabilities] };
    assert.equal(caps().can(both, 'audit.read'), true);
    assert.equal(caps().can(both, 'bots.manage'), true);
    assert.equal(caps().can(both, 'people.manage'), false);
  });
});

describe('the Admin area and Support agent', () => {
  const tabs = {
    admin: ['workspace', 'people', 'connectors', 'domains', 'audit'],
    compliance: ['audit'],
    developer: ['connectors'],
    owner: [],
    employee: [],
  };
  for (const [who, expected] of Object.entries(tabs)) {
    it(`shows ${who} the tabs they can use`, () => {
      assert.deepEqual(caps().adminTabs(ME[who]), expected);
      assert.equal(caps().opens(ME[who], 'admin'), expected.length > 0);
    });
  }
  it('opens Support agent to admins and developers only', () => {
    assert.deepEqual(Object.keys(ME).filter((who) => caps().opens(ME[who], 'bot')), ['admin', 'developer']);
  });
});

describe('what a person may do with a source', () => {
  it('lets a developer act on docs repositories only', () => {
    assert.equal(caps().manages(ME.developer, 'github_docs'), true);
    assert.equal(caps().manages(ME.developer, 'confluence'), false);
    assert.equal(caps().manages(ME.developer, 'gdrive'), false);
  });
  it('lets an admin act on every source and no one else on any', () => {
    for (const system of ['github_docs', 'confluence', 'gdrive']) {
      assert.equal(caps().manages(ME.admin, system), true);
      assert.equal(caps().manages(ME.compliance, system), false);
      assert.equal(caps().manages(ME.employee, system), false);
    }
  });
});

describe('a sync run hidden count', () => {
  it('says nothing when nothing is hidden', () => assert.equal(caps().hiddenNote(0), ''));
  it('names one page', () => assert.equal(caps().hiddenNote(1), "1 page you can't open"));
  it('names several pages', () => assert.equal(caps().hiddenNote(12), "12 pages you can't open"));
});

describe('a help article button', () => {
  it('follows to an owner-only screen when the person owns a domain', () => {
    assert.equal(caps().mayFollow(ME.owner, 'owner'), true);
    assert.equal(caps().mayFollow(ME.employee, 'owner'), false);
  });
  it('follows to a capability screen only with the capability', () => {
    assert.equal(caps().mayFollow(ME.admin, 'domains.manage'), true);
    assert.equal(caps().mayFollow(ME.developer, 'domains.manage'), false);
    assert.equal(caps().mayFollow(ME.developer, 'bots.manage'), true);
  });
  it('is shown to everyone when the article needs nothing', () => {
    assert.equal(caps().mayFollow(ME.employee, ''), true);
  });
});
