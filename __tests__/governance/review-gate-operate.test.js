const HEAD = 'a'.repeat(40);
const BASE = 'b'.repeat(40);
let runTrustedWorkflow;
beforeAll(async () => {
  ({ runTrustedWorkflow } = await import('../../scripts/github/review-gate/operate.mjs'));
});

function fixture() {
  const upstreamRun = { id: 123, run_attempt: 1, event: 'pull_request', workflow_id: 185409165,
    path: '.github/workflows/ci.yml', status: 'completed', conclusion: 'success',
    head_sha: HEAD, repository: { full_name: 'cyranoaladin/nexus-project_v0' } };
  const pr = { number: 42, state: 'open', draft: false, base: { ref: 'main', sha: BASE }, head: { sha: HEAD } };
  const publish = jest.fn(async ({ headSha, conclusion }) => ({ headSha, conclusion, appId: 5166727 }));
  const evaluate = jest.fn(async () => ({ reviewedHeadSha: HEAD, conclusion: 'action_required',
    reason: 'MODEL_UNQUALIFIED' }));
  return { upstreamRun, associatedPrs: [pr], runId: 123, attempt: 1, expectedSha: HEAD,
    publish, evaluate };
}

describe('trusted workflow orchestration', () => {
  test('unqualified model leaves App check action_required, not success', async () => {
    const args = fixture();
    const result = await runTrustedWorkflow(args);
    expect(result.conclusion).toBe('action_required');
    expect(args.publish).toHaveBeenCalledWith(expect.objectContaining({ headSha: HEAD,
      conclusion: 'action_required', reason: 'MODEL_UNQUALIFIED' }));
  });

  test('a failed CI run publishes failure and never runs reviewer', async () => {
    const args = fixture();
    args.upstreamRun.conclusion = 'failure';
    const result = await runTrustedWorkflow(args);
    expect(result.conclusion).toBe('failure');
    expect(args.evaluate).not.toHaveBeenCalled();
  });

  test('wrong or ambiguous run/PR refuses all publication', async () => {
    for (const change of [{ upstreamRun: { ...fixture().upstreamRun, workflow_id: 1 } },
      { associatedPrs: [] }, { associatedPrs: [fixture().associatedPrs[0],
        { ...fixture().associatedPrs[0], number: 43 }] }]) {
      const args = { ...fixture(), ...change };
      await expect(runTrustedWorkflow(args)).rejects.toThrow();
      expect(args.publish).not.toHaveBeenCalled();
    }
  });

  test('evaluator uncertainty still publishes failure, never success', async () => {
    const args = fixture();
    args.evaluate.mockRejectedValueOnce(new Error('API body must not leak'));
    const result = await runTrustedWorkflow(args);
    expect(result.conclusion).toBe('failure');
    expect(result.reason).toBe('EVALUATION_FAILED');
    expect(args.publish).toHaveBeenCalledWith(expect.objectContaining({ conclusion: 'failure' }));
  });

  test('a head changed after semantic evaluation cannot publish success', async () => {
    const args = fixture();
    args.evaluate.mockResolvedValueOnce({ reviewedHeadSha: HEAD, conclusion: 'success', reason: 'PASS' });
    args.rereadBeforePublish = jest.fn(async () => ({ head: { sha: 'c'.repeat(40) },
      base: { ref: 'main', sha: BASE }, state: 'open', draft: false }));
    const result = await runTrustedWorkflow(args);
    expect(result.conclusion).toBe('failure');
    expect(result.reason).toBe('STALE_HEAD');
    expect(args.publish).toHaveBeenCalledWith(expect.objectContaining({ conclusion: 'failure' }));
  });

  test('success requires one final exact-head reread immediately before publication', async () => {
    const args = fixture();
    args.evaluate.mockResolvedValueOnce({ reviewedHeadSha: HEAD, conclusion: 'success', reason: 'PASS' });
    args.rereadBeforePublish = jest.fn(async () => args.associatedPrs[0]);
    const result = await runTrustedWorkflow(args);
    expect(result.conclusion).toBe('success');
    expect(args.rereadBeforePublish).toHaveBeenCalledTimes(1);
  });
});
