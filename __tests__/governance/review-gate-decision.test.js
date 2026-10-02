const HEAD = 'a'.repeat(40);
const BASE = 'b'.repeat(40);
const clean = JSON.stringify({ review_complete: true, blocking_findings: [], warnings: [] });

let decideOperationalGate;
beforeAll(async () => {
  ({ decideOperationalGate } = await import('../../scripts/github/review-gate/decision.mjs'));
});

function evidence(overrides = {}) {
  return {
    pr: { number: 42, state: 'open', draft: false, base: { ref: 'main', sha: BASE },
      head: { sha: HEAD }, mergeable: true },
    reviewedHeadSha: HEAD, currentHeadSha: HEAD, reviewedBaseSha: BASE, currentBaseSha: BASE,
    diffBaseSha: BASE, diffHeadSha: HEAD, requiredCheckTargetSha: HEAD,
    effectiveRules: [{ type: 'required_status_checks', parameters: { required_status_checks: [
      { context: 'CI Success', integration_id: 15368 },
      { context: 'Nexus Review Gate', integration_id: 5166727 },
    ] } }], rulesComplete: true,
    checkRuns: [{ id: 10, name: 'CI Success', head_sha: HEAD, app: { id: 15368 },
      status: 'completed', conclusion: 'success', started_at: '2026-10-02T10:00:00Z',
      completed_at: '2026-10-02T10:01:00Z' }], checksComplete: true,
    statuses: [], statusesComplete: true, diffAvailable: true, diffComplete: true,
    files: [{ filename: 'app/offres/page.tsx', status: 'modified',
      patch: '@@ -1 +1 @@\n-old\n+new', additions: 1, deletions: 1, changes: 2 }],
    reviews: [], reviewsComplete: true, threadsComplete: true,
    unresolvedReviewThreads: 0, applicableChangesRequested: 0,
    ...overrides,
  };
}

const outputs = { correctness: clean, security: clean, runtime: clean };

describe('operational decision requires deterministic and semantic review', () => {
  test('ordinary exact-head reviewed PR succeeds only with a qualified model', () => {
    expect(decideOperationalGate({ evidence: evidence(), qualifiedModel: true, outputs }))
      .toEqual(expect.objectContaining({ conclusion: 'success', reason: 'PASS',
        riskClass: 'NORMAL', humanExceptionRequired: false, reviewedHeadSha: HEAD }));
    expect(decideOperationalGate({ evidence: evidence(), qualifiedModel: false, outputs }).conclusion)
      .toBe('action_required');
  });

  test('missing CI, thread, CHANGES_REQUESTED, or head race cannot succeed', () => {
    for (const overrides of [
      { checkRuns: [] }, { unresolvedReviewThreads: 1 },
      { applicableChangesRequested: 1 }, { currentHeadSha: BASE },
      { threadsComplete: false }, { reviewsComplete: false },
    ]) {
      expect(decideOperationalGate({ evidence: evidence(overrides), qualifiedModel: true, outputs }).conclusion)
        .not.toBe('success');
    }
  });

  test('sensitive paths require exact-head authorized human approval', () => {
    const sensitive = evidence({ files: [{ filename: '.github/governance/main-ruleset.json',
      status: 'modified', patch: '@@ -1 +1 @@\n-old\n+new', additions: 1, deletions: 1, changes: 2 }] });
    expect(decideOperationalGate({ evidence: sensitive, qualifiedModel: true, outputs }))
      .toEqual(expect.objectContaining({ conclusion: 'action_required',
        reason: 'HUMAN_APPROVAL_REQUIRED', riskClass: 'SENSITIVE' }));
    sensitive.reviews = [{ id: 1, user: { login: 'abenrhouma' }, state: 'APPROVED', commit_id: BASE }];
    expect(decideOperationalGate({ evidence: sensitive, qualifiedModel: true, outputs }).conclusion)
      .not.toBe('success');
    sensitive.reviews[0].commit_id = HEAD;
    expect(decideOperationalGate({ evidence: sensitive, qualifiedModel: true, outputs }).conclusion)
      .toBe('success');
  });

  test('unclassified diff, malformed output and model blocker cannot succeed', () => {
    const unclassified = evidence({ files: [{ filename: 'app/page.tsx', status: 'modified',
      patch: undefined }] });
    expect(decideOperationalGate({ evidence: unclassified, qualifiedModel: true, outputs }).conclusion)
      .toBe('action_required');
    expect(decideOperationalGate({ evidence: evidence(), qualifiedModel: true,
      outputs: { ...outputs, runtime: 'not json' } }).conclusion).toBe('failure');
    const blocker = JSON.stringify({ review_complete: true,
      blocking_findings: [{ file: 'app/offres/page.tsx', reason: 'Synthetic regression', confidence: 0.9 }],
      warnings: [] });
    expect(decideOperationalGate({ evidence: evidence(), qualifiedModel: true,
      outputs: { ...outputs, correctness: blocker } }).conclusion).toBe('action_required');
  });
});
