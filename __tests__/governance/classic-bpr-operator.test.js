const path = require('path');
const fs = require('fs');
const os = require('os');
const { installExitTrap, ProcessExitError } = require('./helpers/process-exit');
const { makeGh, conformingRuleset } = require('./fixtures/live-governance.js');

const REAL_ROOT = path.resolve(__dirname, '../..');

const RULE_ON_MAIN = {
  id: 'BPR_kwDOPXufyc4EGsZG',
  pattern: 'main',
  isAdminEnforced: false,
  requiredApprovingReviewCount: 1,
  requiredStatusCheckContexts: ['E2E (Playwright) / Playwright E2E (chromium)'],
  dismissesStaleReviews: true,
  requiresConversationResolution: false,
  allowsForcePushes: false,
  allowsDeletions: false,
  matchingRefs: { totalCount: 1, nodes: [{ name: 'main', prefix: 'refs/heads/' }] },
};

const RULE_ON_RELEASE = {
  ...RULE_ON_MAIN,
  id: 'BPR_release',
  pattern: 'release/*',
  matchingRefs: { totalCount: 1, nodes: [{ name: 'release/2026', prefix: 'refs/heads/' }] },
};

/**
 * A gh double whose GraphQL side answers the classic-protection query with a
 * scripted node list, and whose REST side returns a conforming ruleset. Every
 * call is recorded so a test can prove a mutation did or did not happen.
 */
function makeOperatorGh({ nodes = [RULE_ON_MAIN], ruleset, afterDelete = [], collaborators } = {}) {
  const state = { nodes: [...nodes], calls: [], mutations: [] };
  const live = ruleset ?? conformingRuleset();
  const base = makeGh({ collaborators });
  return {
    state,
    apiJson: base.apiJson,
    writeCallCount: () => state.mutations.length,
    graphql: (query) => {
      state.calls.push(query);
      if (/^\s*mutation/.test(query)) {
        state.mutations.push(query);
        if (query.includes('deleteBranchProtectionRule')) {
          state.nodes = afterDelete;
          return { data: { deleteBranchProtectionRule: { clientMutationId: null } } };
        }
        state.nodes = [RULE_ON_MAIN];
        return { data: { createBranchProtectionRule: { branchProtectionRule: { id: RULE_ON_MAIN.id } } } };
      }
      if (query.includes('branchProtectionRules')) {
        return { data: { repository: { branchProtectionRules: { nodes: state.nodes } } } };
      }
      return { data: { repository: { id: 'R_repo' } } };
    },
    _live: live,
  };
}

describe('classic branch-protection operator — selection never guesses', () => {
  let mod;
  let exitSpy;

  beforeAll(async () => {
    mod = await import('../../scripts/github/apply-governance.mjs');
  });
  beforeEach(() => { exitSpy = installExitTrap(); });
  afterEach(() => { exitSpy.mockRestore(); });

  test('returns the single rule whose matchingRefs include refs/heads/main', () => {
    const gh = makeOperatorGh({ nodes: [RULE_ON_RELEASE, RULE_ON_MAIN] });
    expect(mod.selectClassicProtectionOnMain(gh).id).toBe(RULE_ON_MAIN.id);
  });

  // The defect this replaces: the previous code took nodes[0] blindly, in both
  // the node-id check and the restore-payload capture.
  test('never returns nodes[0] when nodes[0] does not cover main', () => {
    const gh = makeOperatorGh({ nodes: [RULE_ON_RELEASE, RULE_ON_MAIN] });
    const selected = mod.selectClassicProtectionOnMain(gh);
    expect(selected.id).not.toBe(RULE_ON_RELEASE.id);
  });

  test('refuses when no classic rule covers main', () => {
    const gh = makeOperatorGh({ nodes: [RULE_ON_RELEASE] });
    expect(() => mod.selectClassicProtectionOnMain(gh)).toThrow(ProcessExitError);
  });

  test('refuses when several classic rules cover main, instead of picking one', () => {
    const gh = makeOperatorGh({ nodes: [RULE_ON_MAIN, { ...RULE_ON_MAIN, id: 'BPR_second' }] });
    expect(() => mod.selectClassicProtectionOnMain(gh)).toThrow(ProcessExitError);
  });
});

describe('classic branch-protection operator — every gate refuses on its own', () => {
  let mod;
  let exitSpy;
  const AUTHORIZED = { 'delete-classic-protection': true, 'node-id': RULE_ON_MAIN.id, 'owner-authorization': 'DELETE_CLASSIC_BPR_ON_MAIN' };

  beforeAll(async () => { mod = await import('../../scripts/github/apply-governance.mjs'); });
  beforeEach(() => { exitSpy = installExitTrap(); });
  afterEach(() => { exitSpy.mockRestore(); });

  const run = (args, gh, env) => mod.runDeleteClassicProtection({ root: REAL_ROOT, gh, args, env });

  test('a missing node id refuses', () => {
    const gh = makeOperatorGh();
    expect(() => run({ ...AUTHORIZED, 'node-id': undefined }, gh)).toThrow(ProcessExitError);
    expect(gh.state.mutations).toHaveLength(0);
  });

  test('a node id that is not the live one refuses', () => {
    const gh = makeOperatorGh();
    expect(() => run({ ...AUTHORIZED, 'node-id': 'BPR_wrong' }, gh)).toThrow(ProcessExitError);
    expect(gh.state.mutations).toHaveLength(0);
  });

  test('the owner authorization flag alone is not enough', () => {
    const gh = makeOperatorGh();
    process.env.NEXUS_OWNER_MUTATION_AUTHORIZATION = '';
    expect(() => run(AUTHORIZED, gh)).toThrow(ProcessExitError);
    expect(gh.state.mutations).toHaveLength(0);
  });

  test('the environment variable naming another rule refuses', () => {
    const gh = makeOperatorGh();
    process.env.NEXUS_OWNER_MUTATION_AUTHORIZATION = 'BPR_release';
    expect(() => run(AUTHORIZED, gh)).toThrow(ProcessExitError);
    expect(gh.state.mutations).toHaveLength(0);
    delete process.env.NEXUS_OWNER_MUTATION_AUTHORIZATION;
  });

  test('requireOwnerAuthorization refuses a missing flag even with the right environment', () => {
    expect(() => mod.requireOwnerAuthorization({}, RULE_ON_MAIN, { NEXUS_OWNER_MUTATION_AUTHORIZATION: RULE_ON_MAIN.id }))
      .toThrow(ProcessExitError);
  });

  test('requireOwnerAuthorization accepts only when both channels name the same rule', () => {
    expect(() => mod.requireOwnerAuthorization(
      { 'owner-authorization': 'DELETE_CLASSIC_BPR_ON_MAIN' },
      RULE_ON_MAIN,
      { NEXUS_OWNER_MUTATION_AUTHORIZATION: RULE_ON_MAIN.id },
    )).not.toThrow();
  });
});

describe('classic branch-protection operator — post-verification compares against the prestate', () => {
  let mod;
  let exitSpy;

  beforeAll(async () => { mod = await import('../../scripts/github/apply-governance.mjs'); });
  beforeEach(() => { exitSpy = installExitTrap(); });
  afterEach(() => { exitSpy.mockRestore(); });

  const prestateOf = (gh) => mod.captureClassicBprPrestate(gh, RULE_ON_MAIN);

  test('all seven tokens hold when only the classic rule disappeared', () => {
    const gh = makeOperatorGh({ afterDelete: [] });
    const prestate = prestateOf(gh);
    mod.deleteClassicProtection(gh, RULE_ON_MAIN.id);
    const { results, failures } = mod.postVerifyDeletion(gh, prestate);
    expect(results).toEqual({
      CLASSIC_BPR_PRESENT: 'NO',
      MAIN_RULESET_PRESENT: 'YES',
      MAIN_RULESET_ENFORCEMENT: 'active',
      REQUIRED_CHECKS_UNCHANGED: 'YES',
      REVIEW_REQUIREMENTS_UNCHANGED: 'YES',
      MERGE_METHODS_UNCHANGED: 'YES',
      BYPASS_ACTORS_UNCHANGED: 'YES',
    });
    expect(failures).toEqual([]);
  });

  test('a classic rule still covering main is reported, not glossed over', () => {
    const gh = makeOperatorGh({ afterDelete: [RULE_ON_MAIN] });
    const prestate = prestateOf(gh);
    mod.deleteClassicProtection(gh, RULE_ON_MAIN.id);
    const { results, failures } = mod.postVerifyDeletion(gh, prestate);
    expect(results.CLASSIC_BPR_PRESENT).toBe('YES');
    expect(failures.join(' ')).toContain('CLASSIC_BPR_PRESENT');
  });
});

describe('classic branch-protection operator — nothing mutates without an explicit --execute', () => {
  let mod;
  let exitSpy;
  let tmpRoot;

  beforeAll(async () => { mod = await import('../../scripts/github/apply-governance.mjs'); });
  beforeEach(() => {
    exitSpy = installExitTrap();
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bpr-operator-'));
    fs.mkdirSync(path.join(tmpRoot, '.artifacts', 'governance'), { recursive: true });
    // The operator runs the live audit before mutating, and that reads the
    // declared governance files. Copy them rather than pointing at the real
    // repository root, so no test ever writes a prestate or a journal entry
    // into the working tree.
    fs.cpSync(path.join(REAL_ROOT, '.github', 'governance'), path.join(tmpRoot, '.github', 'governance'), {
      recursive: true,
    });
  });
  afterEach(() => {
    exitSpy.mockRestore();
    delete process.env.NEXUS_OWNER_MUTATION_AUTHORIZATION;
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  // The gate was first written as `--dry-run=false`. `parseArguments` only
  // accepts `--key value` pairs, so that yielded the string "false" and the
  // execution branch was unreachable: every refusal was tested, the success
  // never was. These two tests are the ones that were missing.
  test('the deletion is a dry run by default, and touches nothing', () => {
    const gh = makeOperatorGh();
    process.env.NEXUS_OWNER_MUTATION_AUTHORIZATION = RULE_ON_MAIN.id;
    const result = mod.runDeleteClassicProtection({
      root: tmpRoot,
      gh,
      args: { 'delete-classic-protection': true, 'node-id': RULE_ON_MAIN.id, 'owner-authorization': 'DELETE_CLASSIC_BPR_ON_MAIN' },
    });
    expect(result.deleted).toBe(false);
    expect(gh.state.mutations).toHaveLength(0);
  });

  test('--execute reaches the mutation, and the seven post-checks hold', () => {
    const gh = makeOperatorGh({ afterDelete: [] });
    process.env.NEXUS_OWNER_MUTATION_AUTHORIZATION = RULE_ON_MAIN.id;
    const result = mod.runDeleteClassicProtection({
      root: tmpRoot,
      gh,
      args: {
        'delete-classic-protection': true,
        'node-id': RULE_ON_MAIN.id,
        'owner-authorization': 'DELETE_CLASSIC_BPR_ON_MAIN',
        execute: true,
      },
    });
    expect(result.deleted).toBe(true);
    expect(gh.state.mutations).toHaveLength(1);
    expect(gh.state.mutations[0]).toContain('deleteBranchProtectionRule');
  });

  test('a restore refuses without its own explicit authorization', () => {
    const gh = makeOperatorGh();
    const prestatePath = path.join(tmpRoot, 'prestate.json');
    fs.writeFileSync(prestatePath, JSON.stringify({ classicRule: { id: RULE_ON_MAIN.id }, restorePayload: {} }));
    expect(() => mod.runRestoreClassicProtection({ root: tmpRoot, gh, args: { 'restore-classic-protection': true, prestate: prestatePath } }))
      .toThrow(ProcessExitError);
    expect(gh.state.mutations).toHaveLength(0);
  });

  test('a restore is a dry run unless --execute, and claims nothing', () => {
    const gh = makeOperatorGh();
    const prestatePath = path.join(tmpRoot, 'prestate.json');
    fs.writeFileSync(prestatePath, JSON.stringify({ classicRule: { id: RULE_ON_MAIN.id }, restorePayload: {} }));
    const result = mod.runRestoreClassicProtection({
      root: tmpRoot,
      gh,
      args: { 'restore-classic-protection': true, prestate: prestatePath, 'owner-authorization': 'RESTORE_CLASSIC_BPR_ON_MAIN' },
    });
    expect(result.restored).toBe(false);
    expect(gh.state.mutations).toHaveLength(0);
  });
});
