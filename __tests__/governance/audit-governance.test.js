const fs = require('fs');
const os = require('os');
const path = require('path');

const REAL_ROOT = path.resolve(__dirname, '../..');

describe('runOfflineAudit — the entrypoint CI actually runs', () => {
  let runOfflineAudit;

  beforeAll(async () => {
    ({ runOfflineAudit } = await import('../../scripts/github/audit-governance.mjs'));
  });

  test('the real repository governance state is clean', () => {
    const result = runOfflineAudit({ root: REAL_ROOT });
    expect(result.findings).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.checkedContexts).toBeGreaterThan(0);
  });

  test('a repo root with no CODEOWNERS fails closed with CODEOWNERS_MISSING', () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'governance-offline-'));
    try {
      fs.cpSync(path.join(REAL_ROOT, '.github', 'governance'), path.join(tmpRoot, '.github', 'governance'), {
        recursive: true,
      });
      fs.cpSync(path.join(REAL_ROOT, '.github', 'workflows'), path.join(tmpRoot, '.github', 'workflows'), {
        recursive: true,
      });
      const result = runOfflineAudit({ root: tmpRoot });
      expect(result.ok).toBe(false);
      expect(result.findings.some((f) => f.code === 'CODEOWNERS_MISSING')).toBe(true);
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  test('ARIA_CI_OFFLINE_AUDIT_FAILS_ON_WORKFLOW_DRIFT', () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'governance-aria-ci-'));
    try {
      fs.cpSync(path.join(REAL_ROOT, '.github'), path.join(tmpRoot, '.github'), { recursive: true });
      const workflowPath = path.join(tmpRoot, '.github', 'workflows', 'ci.yml');
      const workflow = fs.readFileSync(workflowPath, 'utf8');
      fs.writeFileSync(workflowPath, workflow.replace('\n  aria-static:\n', '\n  aria-static-disabled:\n'));

      const result = runOfflineAudit({ root: tmpRoot });
      expect(result.ok).toBe(false);
      expect(result.findings).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'ARIA_CI_JOB_MISSING', details: 'aria-static' }),
      ]));
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  test('ARIA_CI_REQUIRES_MATCHING_REGISTRY_PRODUCER', () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'governance-aria-registry-'));
    try {
      fs.cpSync(path.join(REAL_ROOT, '.github'), path.join(tmpRoot, '.github'), { recursive: true });
      const registryPath = path.join(tmpRoot, '.github', 'governance', 'checks-registry.json');
      const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
      registry.observedNotRequired = registry.observedNotRequired.filter(
        (entry) => entry.producer?.jobKey !== 'aria-static',
      );
      fs.writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`);

      const result = runOfflineAudit({ root: tmpRoot });
      expect(result.ok).toBe(false);
      expect(result.findings).toContainEqual({
        code: 'ARIA_CI_REGISTRY_PRODUCER_MISSING',
        details: 'aria-static',
      });
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});

describe('runLiveAudit — asserts the declared protections against a scripted live state', () => {
  let runLiveAudit;
  const { makeGh, ruleParams } = require('./fixtures/live-governance.js');

  beforeAll(async () => {
    ({ runLiveAudit } = await import('../../scripts/github/audit-governance.mjs'));
  });

  const codesOf = (result) => result.findings.map((f) => f.code);
  const fatalCodesOf = (result) => result.findings.filter((f) => f.fatal).map((f) => f.code);

  test('a live state matching the desired block passes, with no fatal finding', () => {
    const result = runLiveAudit({ root: REAL_ROOT, gh: makeGh() });
    expect(fatalCodesOf(result)).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.writeCalls).toBe(0);
    expect(result.classicBprPresent).toBe(false);
  });

  test('classic BPR matching main is reported, and stays non-fatal until it is removed', () => {
    const result = runLiveAudit({ root: REAL_ROOT, gh: makeGh({ classicBpr: true }) });
    const codes = codesOf(result);
    expect(codes).toContain('CLASSIC_BRANCH_PROTECTION_PRESENT');
    expect(codes).toContain('STALE_OR_LATENT_CLASSIC_BPR');
    expect(codes).toContain('DUPLICATED_PROTECTION_CONTROLS');
    expect(codes.filter((c) => c === 'ZOMBIE_REQUIRED_CHECK')).toHaveLength(3);
    expect(fatalCodesOf(result)).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.classicBprPresent).toBe(true);
  });

  test('no classic BPR matching main => none of its findings', () => {
    const codes = codesOf(runLiveAudit({ root: REAL_ROOT, gh: makeGh() }));
    expect(codes).not.toContain('STALE_OR_LATENT_CLASSIC_BPR');
    expect(codes).not.toContain('ZOMBIE_REQUIRED_CHECK');
  });

  // Each row weakens exactly one protection. Every one of them must be fatal:
  // this audit exists so that a weakening of `main` cannot land unnoticed.
  describe.each([
    ['enforcement disabled', (r) => { r.enforcement = 'disabled'; }, 'RULESET_ENFORCEMENT_MISMATCH'],
    ['ruleset renamed', (r) => { r.name = 'something-else'; }, 'RULESET_NAME_MISMATCH'],
    ['ruleset id swapped', (r) => { r.id = 999; }, 'RULESET_ID_MISMATCH'],
    ['a bypass actor added', (r) => { r.bypass_actors = [{ actor_id: 5, actor_type: 'Team' }]; }, 'RULESET_BYPASS_ACTORS_PRESENT'],
    ['main no longer covered', (r) => { r.conditions.ref_name.include = ['refs/heads/release']; }, 'RULESET_REF_INCLUDE_MISMATCH'],
    ['force-push re-enabled', (r) => { r.rules = r.rules.filter((rule) => rule.type !== 'non_fast_forward'); }, 'RULESET_RULE_MISSING'],
    ['branch deletion re-enabled', (r) => { r.rules = r.rules.filter((rule) => rule.type !== 'deletion'); }, 'RULESET_RULE_MISSING'],
    ['approvals dropped to zero', (r) => { ruleParams(r, 'pull_request').required_approving_review_count = 0; }, 'RULESET_PULL_REQUEST_MISMATCH'],
    ['stale approvals kept on push', (r) => { ruleParams(r, 'pull_request').dismiss_stale_reviews_on_push = false; }, 'RULESET_PULL_REQUEST_MISMATCH'],
    ['last-push approval dropped', (r) => { ruleParams(r, 'pull_request').require_last_push_approval = false; }, 'RULESET_PULL_REQUEST_MISMATCH'],
    ['unresolved threads allowed', (r) => { ruleParams(r, 'pull_request').required_review_thread_resolution = false; }, 'RULESET_PULL_REQUEST_MISMATCH'],
    ['squash and rebase re-allowed', (r) => { ruleParams(r, 'pull_request').allowed_merge_methods = ['merge', 'squash', 'rebase']; }, 'RULESET_MERGE_METHODS_MISMATCH'],
    ['strict up-to-date policy dropped', (r) => { ruleParams(r, 'required_status_checks').strict_required_status_checks_policy = false; }, 'RULESET_STRICT_POLICY_MISMATCH'],
    ['a required check removed', (r) => {
      const params = ruleParams(r, 'required_status_checks');
      params.required_status_checks = params.required_status_checks.filter((c) => c.context !== 'CI Success');
    }, 'MISSING_REQUIRED_CHECK'],
    ['a required check produced by another app', (r) => {
      const params = ruleParams(r, 'required_status_checks');
      params.required_status_checks.find((c) => c.context === 'Lint').integration_id = 1;
    }, 'REQUIRED_CHECK_PRODUCER_MISMATCH'],
  ])('weakening: %s', (_label, weaken, expectedCode) => {
    test(`is fatal and reports ${expectedCode}`, () => {
      const result = runLiveAudit({ root: REAL_ROOT, gh: makeGh({ weaken }) });
      expect(fatalCodesOf(result)).toContain(expectedCode);
      expect(result.ok).toBe(false);
    });
  });

  test('an extra required check is reported but is not a weakening', () => {
    const result = runLiveAudit({
      root: REAL_ROOT,
      gh: makeGh({
        weaken: (r) => {
          ruleParams(r, 'required_status_checks').required_status_checks.push({ context: 'Extra Gate', integration_id: 15368 });
        },
      }),
    });
    expect(codesOf(result)).toContain('UNDECLARED_REQUIRED_CHECK');
    expect(result.ok).toBe(true);
  });

  test('a CODEOWNERS principal without push access is fatal', () => {
    const result = runLiveAudit({
      root: REAL_ROOT,
      gh: makeGh({ collaborators: [{ login: 'abenrhouma', permissions: { push: true } }] }),
    });
    expect(fatalCodesOf(result)).toContain('CODEOWNERS_PRINCIPAL_INELIGIBLE');
    expect(result.ok).toBe(false);
  });

  test('a write call during the audit is fatal', () => {
    const result = runLiveAudit({ root: REAL_ROOT, gh: makeGh({ writeCalls: 1 }) });
    expect(fatalCodesOf(result)).toContain('API_WRITE_CALLS_PERFORMED');
    expect(result.ok).toBe(false);
  });

  test('a client that cannot report its writes cannot claim to be read-only', () => {
    const result = runLiveAudit({ root: REAL_ROOT, gh: makeGh({ writeCalls: null }) });
    expect(fatalCodesOf(result)).toContain('API_WRITE_CALLS_UNPROVABLE');
    expect(result.ok).toBe(false);
    expect(result.writeCalls).toBeNull();
  });
});
