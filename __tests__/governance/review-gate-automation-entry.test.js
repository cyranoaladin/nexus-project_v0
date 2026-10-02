let automateAfterGate;
let validPostGateEvidence;
beforeAll(async () => {
  ({ automateAfterGate, validPostGateEvidence } = await import('../../scripts/github/review-gate/automation-entry.mjs'));
});

const HEAD = 'a'.repeat(40);
const BASE = 'b'.repeat(40);
const pr = () => ({ number: 42, state: 'open', draft: false, node_id: 'PR_42',
  base: { ref: 'main', sha: BASE }, head: { sha: HEAD }, mergeable: true,
  mergeable_state: 'clean' });
const check = () => ({ id: 12, name: 'Nexus Review Gate', head_sha: HEAD,
  status: 'completed', conclusion: 'success', app: { id: 5166727, slug: 'nexus-review-gate' } });
const args = () => ({ expectedHeadSha: HEAD, prNumber: 42, checkRunId: 12,
  readCheck: jest.fn(async () => check()), readPr: jest.fn(async () => pr()),
  compare: jest.fn(async () => ({ behind_by: 0 })),
  updateBranch: jest.fn(), armAutoMerge: jest.fn(async () => 'ARMED'),
  recheckEvidence: jest.fn(async () => true) });

describe('post-gate automation', () => {
  test('arms only a current App-owned success', async () => {
    const input = args();
    expect(await automateAfterGate(input)).toBe('ARMED');
    expect(input.armAutoMerge).toHaveBeenCalledWith(expect.objectContaining({
      expectedHeadSha: HEAD, gateConclusion: 'success' }));
  });

  test.each([
    ['wrong source', { app: { id: 15368, slug: 'github-actions' } }],
    ['stale SHA', { head_sha: BASE }],
    ['not completed', { status: 'in_progress', conclusion: null }],
    ['not successful', { conclusion: 'action_required' }],
  ])('refuses %s without mutation', async (_label, mutation) => {
    const input = args();
    input.readCheck.mockResolvedValueOnce({ ...check(), ...mutation });
    await expect(automateAfterGate(input)).rejects.toThrow('GATE_CHECK_UNQUALIFIED');
    expect(input.updateBranch).not.toHaveBeenCalled();
    expect(input.armAutoMerge).not.toHaveBeenCalled();
  });

  test('updates a clean but behind branch using the expected head, without arming old head', async () => {
    const input = args();
    input.readPr.mockResolvedValue({ ...pr(), mergeable_state: 'behind' });
    input.compare.mockResolvedValue({ behind_by: 1 });
    input.updateBranch.mockResolvedValue('UPDATED');
    expect(await automateAfterGate(input)).toBe('UPDATED');
    expect(input.updateBranch).toHaveBeenCalledWith(expect.objectContaining({
      expectedHeadSha: HEAD, observedBaseSha: BASE, behindBy: 1 }));
    expect(input.armAutoMerge).not.toHaveBeenCalled();
  });

  test('does not update or arm when the branch conflicts', async () => {
    const input = args();
    input.readPr.mockResolvedValue({ ...pr(), mergeable: false, mergeable_state: 'dirty' });
    input.compare.mockResolvedValue({ behind_by: 1 });
    expect(await automateAfterGate(input)).toBe('REFUSED_CONFLICT');
    expect(input.armAutoMerge).not.toHaveBeenCalled();
  });

  test('a review invalidated after App success blocks auto-merge', async () => {
    const input = args();
    input.recheckEvidence.mockResolvedValue(false);
    await expect(automateAfterGate(input)).rejects.toThrow('GATE_EVIDENCE_STALE');
    expect(input.armAutoMerge).not.toHaveBeenCalled();
  });

  test('fresh guard evidence refuses a revoked exact-head human exception', () => {
    const evidence = {
      prNumber: 42, pr: pr(), reviewedHeadSha: HEAD, currentHeadSha: HEAD,
      reviewedBaseSha: BASE, currentBaseSha: BASE, diffBaseSha: BASE, diffHeadSha: HEAD,
      requiredCheckTargetSha: HEAD, diffAvailable: true, diffComplete: true,
      effectiveRules: [{ type: 'required_status_checks', parameters: { required_status_checks: [
        { context: 'CI Success', integration_id: 15368 },
        { context: 'Nexus Review Gate', integration_id: 5166727 },
      ] } }], rulesComplete: true,
      checkRuns: [{ id: 5, name: 'CI Success', head_sha: HEAD, app: { id: 15368 },
        status: 'completed', conclusion: 'success', started_at: '2026-10-02T10:00:00Z',
        completed_at: '2026-10-02T10:01:00Z' }], checksComplete: true,
      statuses: [], statusesComplete: true,
      files: [{ filename: '.github/governance/main-ruleset.json', status: 'modified',
        patch: '@@ -1 +1 @@\n-old\n+new', additions: 1, deletions: 1, changes: 2 }],
      threadsComplete: true, reviewsComplete: true, unresolvedReviewThreads: 0,
      applicableChangesRequested: 0,
      reviews: [{ id: 1, user: { login: 'abenrhouma' }, state: 'APPROVED', commit_id: HEAD }],
    };
    const expected = { prNumber: 42, expectedHeadSha: HEAD, baseSha: BASE };
    expect(validPostGateEvidence(evidence, expected)).toBe(true);
    evidence.reviews[0].state = 'DISMISSED';
    expect(validPostGateEvidence(evidence, expected)).toBe(false);
    evidence.reviews[0].state = 'APPROVED';
    evidence.unresolvedReviewThreads = 1;
    expect(validPostGateEvidence(evidence, expected)).toBe(false);
  });
});
