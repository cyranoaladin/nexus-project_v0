const HEAD = 'a'.repeat(40);
const OLD_HEAD = 'b'.repeat(40);

let evaluateDeterministicGate;

beforeAll(async () => {
  ({ evaluateDeterministicGate } = await import('../../scripts/github/review-gate/policy.mjs'));
});

function evidence(overrides = {}) {
  return {
    pr: {
      number: 42,
      state: 'open',
      draft: false,
      base: { ref: 'main', sha: OLD_HEAD },
      head: { sha: HEAD },
      mergeable: true,
    },
    reviewedHeadSha: HEAD,
    currentHeadSha: HEAD,
    reviewedBaseSha: OLD_HEAD,
    currentBaseSha: OLD_HEAD,
    diffBaseSha: OLD_HEAD,
    diffHeadSha: HEAD,
    requiredCheckTargetSha: HEAD,
    effectiveRules: [{
        type: 'required_status_checks',
        parameters: { required_status_checks: [
          { context: 'CI Success', integration_id: 15368 },
          { context: 'GitGuardian Security Checks', integration_id: 46505 },
        ] },
      }],
    rulesComplete: true,
    checkRuns: [
      { id: 10, name: 'CI Success', head_sha: HEAD, app: { id: 15368 }, status: 'completed',
        conclusion: 'success', started_at: '2026-10-02T10:00:00Z', completed_at: '2026-10-02T10:01:00Z' },
      { id: 20, name: 'GitGuardian Security Checks', head_sha: HEAD, app: { id: 46505 },
        status: 'completed', conclusion: 'success', started_at: '2026-10-02T10:00:00Z',
        completed_at: '2026-10-02T10:01:00Z' },
    ],
    checksComplete: true,
    statuses: [],
    statusesComplete: true,
    diffAvailable: true,
    diffComplete: true,
    ...overrides,
  };
}

const verdict = (data) => evaluateDeterministicGate(evidence(data));

describe('Nexus Review Gate deterministic policy', () => {
  test('EXACT_HEAD_PASS reads required checks from the live ruleset', () => {
    expect(verdict({})).toEqual(expect.objectContaining({
      passed: true,
      reason: 'PASS',
      reviewedHeadSha: HEAD,
      requiredChecks: ['CI Success', 'GitGuardian Security Checks'],
    }));
  });

  test.each([
    ['closed PR', { pr: { ...evidence().pr, state: 'closed' } }, 'PR_NOT_OPEN'],
    ['draft PR', { pr: { ...evidence().pr, draft: true } }, 'PR_DRAFT'],
    ['wrong base', { pr: { ...evidence().pr, base: { ref: 'release', sha: OLD_HEAD } } }, 'BASE_BRANCH_INVALID'],
    ['missing base SHA', { pr: { ...evidence().pr, base: { ref: 'main' } } }, 'BASE_SHA_INVALID'],
    ['head changed before evaluation', { pr: { ...evidence().pr, head: { sha: OLD_HEAD } } }, 'STALE_HEAD'],
    ['head changed during review', { currentHeadSha: OLD_HEAD }, 'STALE_HEAD'],
    ['missing final head reread', { currentHeadSha: undefined }, 'STALE_HEAD'],
    ['merge conflict', { pr: { ...evidence().pr, mergeable: false } }, 'MERGE_CONFLICT'],
    ['unknown mergeability', { pr: { ...evidence().pr, mergeable: null } }, 'MERGEABILITY_UNKNOWN'],
    ['diff unavailable', { diffAvailable: false }, 'DIFF_UNAVAILABLE'],
    ['diff pagination incomplete', { diffComplete: false }, 'DIFF_INCOMPLETE'],
    ['diff from wrong base', { diffBaseSha: HEAD }, 'DIFF_SHA_MISMATCH'],
    ['diff from wrong head', { diffHeadSha: OLD_HEAD }, 'DIFF_SHA_MISMATCH'],
    ['diff lacks bound SHA', { diffHeadSha: undefined }, 'DIFF_SHA_MISMATCH'],
  ])('%s fails closed', (_label, changes, reason) => {
    expect(verdict(changes)).toEqual(expect.objectContaining({ passed: false, reason }));
  });

  test('SELF_REQUIRED_CHECK_NO_LOOP excludes only the App-owned Nexus check', () => {
    const effectiveRules = structuredClone(evidence().effectiveRules);
    effectiveRules[0].parameters.required_status_checks.push(
      { context: 'Nexus Review Gate', integration_id: 5166727 },
    );
    expect(verdict({ effectiveRules })).toEqual(expect.objectContaining({
      passed: true,
      requiredChecks: ['CI Success', 'GitGuardian Security Checks'],
      selfCheckExcluded: true,
    }));

    effectiveRules[0].parameters.required_status_checks.push(
      { context: 'Nexus Review Gate', integration_id: 15368 },
    );
    expect(verdict({ effectiveRules })).toEqual(expect.objectContaining({
      passed: false,
      reason: 'REQUIRED_CHECK_IDENTITY_AMBIGUOUS',
    }));
  });

  test('missing, incomplete, failed and non-successful checks never pass', () => {
    expect(verdict({ checkRuns: evidence().checkRuns.slice(0, 1) }).reason).toBe('REQUIRED_CHECK_MISSING');
    expect(verdict({ checksComplete: false }).reason).toBe('REQUIRED_CHECKS_INCOMPLETE');
    for (const [status, conclusion] of [
      ['in_progress', null], ['completed', 'failure'], ['completed', 'neutral'],
      ['completed', 'skipped'], ['completed', 'action_required'],
    ]) {
      const checkRuns = structuredClone(evidence().checkRuns);
      Object.assign(checkRuns[0], { status, conclusion });
      expect(verdict({ checkRuns }).passed).toBe(false);
    }
  });

  test('WRONG_APP_FAIL and GITHUB_ACTIONS_SAME_NAME_FAIL require App source', () => {
    const checkRuns = structuredClone(evidence().checkRuns);
    checkRuns[0].app.id = 5166727;
    expect(verdict({ checkRuns }).reason).toBe('REQUIRED_CHECK_WRONG_APP');
    checkRuns[0].app.id = 15368;
    checkRuns[1].app.id = 15368;
    expect(verdict({ checkRuns }).reason).toBe('REQUIRED_CHECK_WRONG_APP');
  });

  test('wrong-head and duplicate same-name checks cannot silently pass', () => {
    const checkRuns = structuredClone(evidence().checkRuns);
    checkRuns[0].head_sha = OLD_HEAD;
    expect(verdict({ checkRuns }).reason).toBe('REQUIRED_CHECK_MISSING');
    checkRuns[0].head_sha = HEAD;
    checkRuns.push({ ...checkRuns[0] });
    expect(verdict({ checkRuns }).reason).toBe('REQUIRED_CHECK_AMBIGUOUS');
  });

  test('a singleton Check Run still needs a valid ID and timestamps', () => {
    const checkRuns = structuredClone(evidence().checkRuns);
    delete checkRuns[0].id;
    expect(verdict({ checkRuns }).reason).toBe('REQUIRED_CHECK_AMBIGUOUS');
    checkRuns[0].id = 10;
    checkRuns[0].started_at = 'not-a-timestamp';
    expect(verdict({ checkRuns }).reason).toBe('REQUIRED_CHECK_AMBIGUOUS');
    checkRuns[0].started_at = '2026-10-02T10:00:00Z';
    checkRuns[0].completed_at = null;
    expect(verdict({ checkRuns }).reason).toBe('REQUIRED_CHECK_AMBIGUOUS');
  });

  test('missing or malformed live ruleset is not treated as zero required checks', () => {
    expect(verdict({ effectiveRules: [] }).reason).toBe('RULESET_INVALID');
    expect(verdict({ effectiveRules: [{ type: 'required_status_checks', parameters: { required_status_checks: [] } }] }).reason).toBe('RULESET_INVALID');
  });

  test('BASE_CHANGED_DURING_REVIEW_FAIL binds initial and final base to PR base', () => {
    expect(verdict({ reviewedBaseSha: HEAD })).toEqual(expect.objectContaining({
      passed: false, reason: 'STALE_BASE',
    }));
    expect(verdict({ currentBaseSha: HEAD })).toEqual(expect.objectContaining({
      passed: false, reason: 'STALE_BASE',
    }));
    expect(verdict({ currentBaseSha: undefined })).toEqual(expect.objectContaining({
      passed: false, reason: 'STALE_BASE',
    }));
  });

  test('an App-bound context cannot accept a legacy status without provable App identity', () => {
    const statuses = [{
      context: 'CI Success', sha: HEAD, state: 'failure', sourceAppId: 15368,
    }];
    expect(verdict({ statuses })).toEqual(expect.objectContaining({
      passed: false, reason: 'REQUIRED_STATUS_SOURCE_UNVERIFIABLE',
    }));
    expect(verdict({ statuses: [{ ...statuses[0], state: 'success' }] }).reason).toBe('REQUIRED_STATUS_SOURCE_UNVERIFIABLE');
    expect(verdict({ statuses: [{ context: 'CI Success', sha: HEAD, state: 'success' }] }).reason).toBe('REQUIRED_STATUS_SOURCE_UNVERIFIABLE');
    expect(verdict({ statusesComplete: false }).reason).toBe('REQUIRED_STATUSES_INCOMPLETE');
  });

  test('a legacy status without trusted source or on a different SHA cannot satisfy a requirement', () => {
    const noCheckRuns = evidence().checkRuns.slice(1);
    expect(verdict({
      checkRuns: noCheckRuns,
      statuses: [{ context: 'CI Success', sha: HEAD, state: 'success' }],
    }).reason).toBe('REQUIRED_STATUS_SOURCE_UNVERIFIABLE');
    expect(verdict({
      checkRuns: noCheckRuns,
      statuses: [{ context: 'CI Success', sha: HEAD, state: 'success', sourceAppId: 15368 }],
    }).reason).toBe('REQUIRED_STATUS_SOURCE_UNVERIFIABLE');
    expect(verdict({
      checkRuns: noCheckRuns,
      statuses: [{ context: 'CI Success', sha: OLD_HEAD, state: 'success', sourceAppId: 15368 }],
    }).reason).toBe('REQUIRED_CHECK_MISSING');
  });

  test('all active effective required-status-check rules are combined', () => {
    const effectiveRules = [
      { type: 'required_status_checks', parameters: { required_status_checks: [
        { context: 'CI Success', integration_id: 15368 },
      ] } },
      { type: 'required_status_checks', parameters: { required_status_checks: [
        { context: 'GitGuardian Security Checks', integration_id: 46505 },
      ] } },
    ];
    expect(verdict({ effectiveRules, rulesComplete: true })).toEqual(
      expect.objectContaining({ passed: true, requiredChecks: ['CI Success', 'GitGuardian Security Checks'] }),
    );
    expect(verdict({ effectiveRules, rulesComplete: false }).reason).toBe('RULESET_INCOMPLETE');
    effectiveRules[1].parameters.required_status_checks[0].integration_id = 46505;
    effectiveRules[1].parameters.required_status_checks[0].context = 'CI Success';
    expect(verdict({ effectiveRules, rulesComplete: true }).reason).toBe(
      'REQUIRED_CHECK_IDENTITY_AMBIGUOUS',
    );
  });

  test('the self-check alone is not sufficient evidence of CI', () => {
    const effectiveRules = [{ type: 'required_status_checks', parameters: {
      required_status_checks: [{ context: 'Nexus Review Gate', integration_id: 5166727 }],
    } }];
    expect(verdict({ effectiveRules }).reason).toBe('REQUIRED_CHECKS_EMPTY');
  });

  test('verified test-merge check target requires the exact parent pair', () => {
    const mergeSha = 'c'.repeat(40);
    const checkRuns = evidence().checkRuns.map((check) => ({ ...check, head_sha: mergeSha }));
    const testMergeCommit = { sha: mergeSha, parentShas: [OLD_HEAD, HEAD], verified: true };
    expect(verdict({ checkRuns, testMergeCommit, requiredCheckTargetSha: mergeSha }).passed).toBe(true);
    expect(verdict({ checkRuns, testMergeCommit, requiredCheckTargetSha: mergeSha,
      statuses: [{ context: 'CI Success', sha: HEAD, state: 'failure' }],
    }).reason).toBe('REQUIRED_STATUS_SOURCE_UNVERIFIABLE');
    expect(verdict({ checkRuns, testMergeCommit }).reason).toBe('CHECK_TARGET_MISMATCH');
    expect(verdict({ checkRuns, testMergeCommit: { ...testMergeCommit, parentShas: [HEAD, OLD_HEAD] },
      requiredCheckTargetSha: mergeSha }).reason).toBe('TEST_MERGE_INVALID');
    expect(verdict({ checkRuns, testMergeCommit: { ...testMergeCommit, verified: false },
      requiredCheckTargetSha: mergeSha }).reason).toBe('TEST_MERGE_INVALID');
    expect(verdict({ checkRuns, currentBaseSha: HEAD, testMergeCommit,
      requiredCheckTargetSha: mergeSha }).reason).toBe('STALE_BASE');
  });

  test('a safely identified latest same-App rerun controls the verdict', () => {
    const oldRun = { ...evidence().checkRuns[0], id: 100, started_at: '2026-10-02T10:00:00Z',
      completed_at: '2026-10-02T10:01:00Z', conclusion: 'failure' };
    const newRun = { ...oldRun, id: 101, started_at: '2026-10-02T10:02:00Z',
      completed_at: '2026-10-02T10:03:00Z', conclusion: 'success' };
    const checkRuns = [oldRun, newRun, evidence().checkRuns[1]];
    expect(verdict({ checkRuns }).passed).toBe(true);
    expect(verdict({ checkRuns: [newRun, { ...oldRun, id: 102 }, evidence().checkRuns[1]] }).passed).toBe(false);
    expect(verdict({ checkRuns: [oldRun, { ...newRun, app: { id: 5166727 } }, evidence().checkRuns[1]] }).passed).toBe(false);
  });
});
