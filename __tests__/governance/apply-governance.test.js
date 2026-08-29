const path = require('path');
const fs = require('fs');
const os = require('os');
const { installExitTrap, ProcessExitError } = require('./helpers/process-exit');

const REAL_ROOT = path.resolve(__dirname, '../..');

function baseLiveRepository(overrides = {}) {
  return {
    allow_merge_commit: true,
    allow_squash_merge: true,
    allow_rebase_merge: true,
    allow_auto_merge: false,
    allow_update_branch: false,
    delete_branch_on_merge: false,
    web_commit_signoff_required: false,
    // Unmanaged / read-only-ish fields that must never be touched.
    visibility: 'public',
    default_branch: 'main',
    id: 999888777,
    ...overrides,
  };
}

function baseLiveRuleset(methods = ['merge', 'squash', 'rebase'], overrides = {}) {
  return {
    id: 12801316,
    name: 'main-protection',
    target: 'branch',
    enforcement: 'active',
    node_id: 'RRS_someNodeId',
    created_at: '2026-02-13T22:31:04.968+01:00',
    updated_at: '2026-08-29T07:47:31.701+01:00',
    _links: { self: { href: 'https://api.github.com/x' } },
    conditions: { ref_name: { include: ['refs/heads/main'], exclude: [] } },
    rules: [
      { type: 'non_fast_forward' },
      { type: 'deletion' },
      {
        type: 'pull_request',
        parameters: {
          required_approving_review_count: 1,
          allowed_merge_methods: methods,
        },
      },
    ],
    ...overrides,
  };
}

// A minimal stateful fake gh client: PATCH/PUT calls mutate an in-memory
// live object, so plan/apply/re-verify see a consistent world — this is
// what lets us test idempotency and rollback without a real repository.
function makeStatefulFakeGh({ repository, ruleset, failRulesetWrite = false, driftAfterWrite = null }) {
  const calls = [];
  let writeCallCount = 0;
  return {
    calls,
    writeCallCount: () => writeCallCount,
    apiJson(pathArg, opts = {}) {
      calls.push({ path: pathArg, opts });
      const method = opts.method ?? 'GET';
      if (method !== 'GET') writeCallCount += 1;

      if (pathArg === 'repos/cyranoaladin/nexus-project_v0') {
        if (method === 'PATCH') {
          for (const [k, v] of opts.fields) repository[k] = v;
          if (driftAfterWrite?.repository) Object.assign(repository, driftAfterWrite.repository);
          return { ...repository };
        }
        return { ...repository };
      }
      if (pathArg.startsWith('repos/cyranoaladin/nexus-project_v0/rulesets/12801316')) {
        if (method === 'PUT') {
          if (failRulesetWrite) throw new Error('simulated API failure on ruleset PUT');
          const fieldMap = Object.fromEntries(opts.fields);
          const rules = JSON.parse(fieldMap.rules);
          ruleset.rules = rules;
          if (driftAfterWrite?.ruleset) ruleset.rules = driftAfterWrite.ruleset;
          return { ...ruleset };
        }
        return JSON.parse(JSON.stringify(ruleset));
      }
      // Every other call below is made only by captureGovernanceSnapshot's
      // (pre/post-state) sweep; returning realistic-shaped empty defaults
      // keeps that sweep working without a real gh binary.
      if (pathArg === 'repos/cyranoaladin/nexus-project_v0/rulesets') {
        return [{ id: ruleset.id }];
      }
      if (pathArg.includes('collaborators')) return [];
      if (pathArg === 'repos/cyranoaladin/nexus-project_v0/hooks') return [];
      if (pathArg === 'repos/cyranoaladin/nexus-project_v0/keys') return [];
      if (pathArg === 'repos/cyranoaladin/nexus-project_v0/environments') return { environments: [] };
      if (pathArg.includes('actions/secrets')) return { secrets: [] };
      if (pathArg.includes('actions/variables')) return { variables: [] };
      if (pathArg === 'repos/cyranoaladin/nexus-project_v0/actions/permissions') {
        return { enabled: true, allowed_actions: 'all' };
      }
      if (pathArg.includes('actions/workflows')) return { workflows: [] };
      throw new Error(`unexpected apiJson path in test fake: ${pathArg}`);
    },
    graphql() {
      return { data: {} };
    },
  };
}

describe('apply-governance — planning is pure and read-only', () => {
  let mod;

  beforeAll(async () => {
    mod = await import('../../scripts/github/apply-governance.mjs');
  });

  test('computeRepoSettingsDiff only ever considers managed fields, never touches unmanaged ones', () => {
    const live = baseLiveRepository({ allow_squash_merge: true, allow_rebase_merge: true });
    const desired = {
      allow_merge_commit: true,
      allow_squash_merge: false,
      allow_rebase_merge: false,
      allow_auto_merge: true,
      allow_update_branch: true,
      delete_branch_on_merge: false,
      web_commit_signoff_required: false,
    };
    const diff = mod.computeRepoSettingsDiff(live, desired);
    expect(Object.keys(diff).sort()).toEqual(
      ['allow_squash_merge', 'allow_rebase_merge', 'allow_auto_merge', 'allow_update_branch'].sort(),
    );
    expect(diff.visibility).toBeUndefined();
    expect(diff.id).toBeUndefined();
  });

  test('buildManagedRepoPayload emits only the changed managed fields', () => {
    const diff = { allow_squash_merge: { from: true, to: false } };
    expect(mod.buildManagedRepoPayload(diff)).toEqual({ allow_squash_merge: false });
  });

  test('computeRulesetDiff is null when the live methods already match desired', () => {
    const live = baseLiveRuleset(['merge']);
    expect(mod.computeRulesetDiff(live, ['merge'])).toBeNull();
  });

  test('computeRulesetDiff reports the change when live methods differ from desired', () => {
    const live = baseLiveRuleset(['merge', 'squash', 'rebase']);
    const diff = mod.computeRulesetDiff(live, ['merge']);
    expect(diff.from).toEqual(['merge', 'rebase', 'squash']);
    expect(diff.to).toEqual(['merge']);
  });

  test('planApply against the real repository governance files matches the documented diff', () => {
    const gh = {
      apiJson: (pathArg) => {
        if (pathArg === 'repos/cyranoaladin/nexus-project_v0') return baseLiveRepository();
        if (pathArg.includes('rulesets/12801316')) return baseLiveRuleset(['merge', 'squash', 'rebase']);
        throw new Error(`unexpected ${pathArg}`);
      },
    };
    const plan = mod.planApply({ root: REAL_ROOT, gh });
    expect(plan.repoDiff.allow_squash_merge).toEqual({ from: true, to: false });
    expect(plan.repoDiff.allow_rebase_merge).toEqual({ from: true, to: false });
    expect(plan.repoDiff.allow_auto_merge).toEqual({ from: false, to: true });
    expect(plan.repoDiff.allow_update_branch).toEqual({ from: false, to: true });
    expect(plan.rulesetDiff.to).toEqual(['merge']);
  });
});

describe('apply-governance — dry run makes zero write calls', () => {
  let runDryRun;

  beforeAll(async () => {
    ({ runDryRun } = await import('../../scripts/github/apply-governance.mjs'));
  });

  test('writeCallCount stays 0 even when a real diff is pending', () => {
    const gh = makeStatefulFakeGh({
      repository: baseLiveRepository({ allow_squash_merge: true, allow_rebase_merge: true }),
      ruleset: baseLiveRuleset(['merge', 'squash', 'rebase']),
    });
    const plan = runDryRun(REAL_ROOT, gh);
    expect(plan.hasChanges).toBe(true);
    expect(gh.writeCallCount()).toBe(0);
  });
});

describe('apply-governance — --apply behaviour (fully mocked, no real gh)', () => {
  let runApply;
  let tmpRoot;

  beforeAll(async () => {
    ({ runApply } = await import('../../scripts/github/apply-governance.mjs'));
  });

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'governance-apply-'));
    fs.mkdirSync(path.join(tmpRoot, '.github', 'governance'), { recursive: true });
    fs.copyFileSync(
      path.join(REAL_ROOT, '.github/governance/repository-settings.json'),
      path.join(tmpRoot, '.github/governance/repository-settings.json'),
    );
    fs.copyFileSync(
      path.join(REAL_ROOT, '.github/governance/main-ruleset.json'),
      path.join(tmpRoot, '.github/governance/main-ruleset.json'),
    );
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  test('applies the managed-field overlay and leaves unmanaged fields untouched', () => {
    const repository = baseLiveRepository({ allow_squash_merge: true, allow_rebase_merge: true });
    const gh = makeStatefulFakeGh({ repository, ruleset: baseLiveRuleset(['merge', 'squash', 'rebase']) });
    runApply(tmpRoot, gh);
    expect(repository.allow_squash_merge).toBe(false);
    expect(repository.allow_rebase_merge).toBe(false);
    expect(repository.allow_auto_merge).toBe(true);
    expect(repository.visibility).toBe('public');
    expect(repository.id).toBe(999888777);
  });

  test('the ruleset PUT payload excludes read-only server fields (id, node_id, created_at, updated_at, _links)', () => {
    const gh = makeStatefulFakeGh({
      repository: baseLiveRepository(),
      ruleset: baseLiveRuleset(['merge', 'squash', 'rebase']),
    });
    runApply(tmpRoot, gh);
    const putCall = gh.calls.find((c) => c.path.includes('rulesets/12801316') && c.opts.method === 'PUT');
    const sentKeys = putCall.opts.fields.map(([k]) => k).sort();
    expect(sentKeys).toEqual(['conditions', 'enforcement', 'name', 'rules', 'target']);
    expect(sentKeys).not.toContain('id');
    expect(sentKeys).not.toContain('node_id');
    expect(sentKeys).not.toContain('created_at');
    expect(sentKeys).not.toContain('updated_at');
    expect(sentKeys).not.toContain('_links');
  });

  test('is idempotent: a second apply with no remaining diff makes zero write calls', () => {
    const repository = baseLiveRepository({ allow_squash_merge: true, allow_rebase_merge: true });
    const ruleset = baseLiveRuleset(['merge', 'squash', 'rebase']);
    const gh1 = makeStatefulFakeGh({ repository, ruleset });
    runApply(tmpRoot, gh1);
    expect(gh1.writeCallCount()).toBeGreaterThan(0);

    const gh2 = makeStatefulFakeGh({ repository, ruleset });
    runApply(tmpRoot, gh2);
    expect(gh2.writeCallCount()).toBe(0);
  });

  test('post-read mismatch triggers a rollback attempt, and a failed operation is never reported as SUCCESS', () => {
    const exitSpy = installExitTrap();
    try {
      const repository = baseLiveRepository({ allow_squash_merge: true, allow_rebase_merge: true });
      const ruleset = baseLiveRuleset(['merge', 'squash', 'rebase']);
      // Simulate something else concurrently re-drifting the repo right
      // after our write, so post-read verification fails.
      const gh = makeStatefulFakeGh({
        repository,
        ruleset,
        driftAfterWrite: { repository: { allow_squash_merge: true } },
      });
      expect(() => runApply(tmpRoot, gh)).toThrow(ProcessExitError);

      const journalPath = path.join(tmpRoot, '.artifacts', 'governance', 'apply-journal.ndjson');
      const lastLine = fs.readFileSync(journalPath, 'utf8').trim().split('\n').pop();
      const entry = JSON.parse(lastLine);
      expect(entry.outcome).toBe('FAILED');
      expect(['SUCCEEDED', 'FAILED']).toContain(entry.rollback);
      expect(entry.rollback).not.toBe('NOT_ATTEMPTED');
    } finally {
      exitSpy.mockRestore();
    }
  });

  test('rollback failure is surfaced as an explicit hard failure, never hidden', () => {
    const exitSpy = installExitTrap();
    try {
      const repository = baseLiveRepository({ allow_squash_merge: true, allow_rebase_merge: true });
      const ruleset = baseLiveRuleset(['merge', 'squash', 'rebase']);
      const gh = makeStatefulFakeGh({
        repository,
        ruleset,
        driftAfterWrite: { repository: { allow_squash_merge: true } },
      });
      // Rollback itself also PATCHes repos/...; force every write to drift
      // back to the bad state so the rollback re-verification also fails.
      const originalApiJson = gh.apiJson.bind(gh);
      let patchCount = 0;
      gh.apiJson = (p, opts) => {
        const result = originalApiJson(p, opts);
        if (p === 'repos/cyranoaladin/nexus-project_v0' && opts?.method === 'PATCH') {
          patchCount += 1;
          if (patchCount >= 2) repository.allow_squash_merge = true;
        }
        return result;
      };

      let threw = false;
      try {
        runApply(tmpRoot, gh);
      } catch (error) {
        threw = true;
        expect(error).toBeInstanceOf(ProcessExitError);
      }
      expect(threw).toBe(true);

      const journalPath = path.join(tmpRoot, '.artifacts', 'governance', 'apply-journal.ndjson');
      const lastLine = fs.readFileSync(journalPath, 'utf8').trim().split('\n').pop();
      const entry = JSON.parse(lastLine);
      expect(entry.outcome).toBe('FAILED');
      expect(entry.rollback).toBe('FAILED');
    } finally {
      exitSpy.mockRestore();
    }
  });

  test('an API failure mid-apply is journaled as FAILED, not SUCCESS, and exits non-zero', () => {
    const exitSpy = installExitTrap();
    try {
      const gh = makeStatefulFakeGh({
        repository: baseLiveRepository({ allow_squash_merge: true, allow_rebase_merge: true }),
        ruleset: baseLiveRuleset(['merge', 'squash', 'rebase']),
        failRulesetWrite: true,
      });
      expect(() => runApply(tmpRoot, gh)).toThrow(ProcessExitError);
      const journalPath = path.join(tmpRoot, '.artifacts', 'governance', 'apply-journal.ndjson');
      const lastLine = fs.readFileSync(journalPath, 'utf8').trim().split('\n').pop();
      const entry = JSON.parse(lastLine);
      expect(entry.outcome).toBe('FAILED');
    } finally {
      exitSpy.mockRestore();
    }
  });
});

describe('apply-governance — classic BPR deletion gate', () => {
  let apply;
  let exitSpy;

  beforeAll(async () => {
    apply = await import('../../scripts/github/apply-governance.mjs');
  });

  beforeEach(() => {
    exitSpy = installExitTrap();
  });

  afterEach(() => {
    exitSpy.mockRestore();
  });

  test('--validate-restore-payload validates structurally and never claims a proven restore', () => {
    const gh = {
      graphql: () => ({
        data: {
          repository: {
            branchProtectionRules: {
              nodes: [
                {
                  id: 'BPR_kwDOPXufyc4EGsZG',
                  pattern: 'main',
                  isAdminEnforced: true,
                  requiredApprovingReviewCount: 1,
                  requiredStatusCheckContexts: ['E2E (Playwright) / Playwright E2E (chromium)'],
                  dismissesStaleReviews: true,
                  requiresConversationResolution: true,
                  allowsForcePushes: false,
                  allowsDeletions: false,
                },
              ],
            },
          },
        },
      }),
    };
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'governance-restore-'));
    try {
      const payload = apply.runValidateRestorePayload({ root: tmpRoot, gh });
      expect(payload.pattern).toBe('main');
      const written = JSON.parse(
        fs.readFileSync(path.join(tmpRoot, '.artifacts', 'governance', 'classic-bpr-restore-payload.json'), 'utf8'),
      );
      expect(written.restorePayload.pattern).toBe('main');
      expect(JSON.stringify(written)).not.toMatch(/RESTORE_PROVEN/);
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});

describe('apply-governance — classic BPR deletion is unreachable without flag + exact node id', () => {
  let requireExactNodeId;
  let exitSpy;

  beforeAll(async () => {
    ({ requireExactNodeId } = await import('../../scripts/github/apply-governance.mjs'));
  });

  beforeEach(() => {
    exitSpy = installExitTrap();
  });

  afterEach(() => {
    exitSpy.mockRestore();
  });

  function fakeGhWithLiveId(liveId) {
    return {
      graphql: () => ({
        data: { repository: { branchProtectionRules: { nodes: [{ id: liveId }] } } },
      }),
    };
  }

  test('no --node-id at all fails closed', () => {
    expect(() => requireExactNodeId({}, fakeGhWithLiveId('BPR_real'))).toThrow(ProcessExitError);
  });

  test('a wrong --node-id fails closed', () => {
    expect(() => requireExactNodeId({ 'node-id': 'BPR_wrong' }, fakeGhWithLiveId('BPR_real'))).toThrow(
      ProcessExitError,
    );
  });

  test('the exact live node id succeeds (does not itself perform any deletion)', () => {
    const id = requireExactNodeId({ 'node-id': 'BPR_real' }, fakeGhWithLiveId('BPR_real'));
    expect(id).toBe('BPR_real');
  });

  test('bare --apply (no delete-classic-protection flag at all) never reaches deletion logic: runApply never issues a delete-shaped GraphQL mutation', async () => {
    const { runApply } = await import('../../scripts/github/apply-governance.mjs');
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'governance-no-delete-'));
    fs.mkdirSync(path.join(tmpRoot, '.github', 'governance'), { recursive: true });
    fs.copyFileSync(
      path.join(REAL_ROOT, '.github/governance/repository-settings.json'),
      path.join(tmpRoot, '.github/governance/repository-settings.json'),
    );
    fs.copyFileSync(
      path.join(REAL_ROOT, '.github/governance/main-ruleset.json'),
      path.join(tmpRoot, '.github/governance/main-ruleset.json'),
    );
    try {
      const gh = makeStatefulFakeGh({
        repository: baseLiveRepository(),
        ruleset: baseLiveRuleset(['merge']),
      });
      const graphqlQueries = [];
      gh.graphql = (query) => {
        graphqlQueries.push(query);
        return { data: { repository: { branchProtectionRules: { nodes: [] } } } };
      };
      // runApply legitimately makes a read-only GraphQL call (classic BPR
      // state) as part of its snapshot sweep — what must never happen is a
      // delete-shaped mutation, with or without --delete-classic-protection.
      runApply(tmpRoot, gh);
      expect(graphqlQueries.some((q) => /deleteBranchProtectionRule/i.test(q))).toBe(false);
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});

describe('no bypass actor is ever introduced by any governed JSON', () => {
  test('main-ruleset.json bypassActors is empty in both current and desired', () => {
    const data = JSON.parse(
      fs.readFileSync(path.join(REAL_ROOT, '.github/governance/main-ruleset.json'), 'utf8'),
    );
    expect(data.current.bypassActors).toEqual([]);
    expect(data.desired.bypassActors).toEqual([]);
  });
});
