const HEAD = 'a'.repeat(40);
const BASE = 'b'.repeat(40);
let safeUpdateBranch;
let safeArmAutoMerge;
beforeAll(async () => {
  ({ safeUpdateBranch, safeArmAutoMerge } = await import('../../scripts/github/review-gate/automation.mjs'));
});

const pr = (extra = {}) => ({ number: 42, state: 'open', draft: false, mergeable: true,
  mergeable_state: 'behind', base: { ref: 'main', sha: BASE }, head: { sha: HEAD }, ...extra });

describe('safe branch update and MERGE-only auto-merge', () => {
  test('updates only an observed behind, cleanly mergeable exact head', async () => {
    const readPr = jest.fn(async () => pr());
    const update = jest.fn(async () => ({ message: 'Updating pull request branch.' }));
    expect(await safeUpdateBranch({ expectedHeadSha: HEAD, observedBaseSha: BASE,
      behindBy: 2, readPr, update })).toBe('UPDATED');
    expect(update).toHaveBeenCalledWith(42, { expected_head_sha: HEAD });
  });

  test('stale head, conflict or unknown relation refuses without a write', async () => {
    const update = jest.fn();
    for (const [readPr, behindBy, expected] of [
      [async () => pr({ head: { sha: 'c'.repeat(40) } }), 2, 'ABORTED_STALE_HEAD'],
      [async () => pr({ mergeable: false, mergeable_state: 'dirty' }), 2, 'REFUSED_CONFLICT'],
      [async () => pr(), null, 'RELATION_UNKNOWN'],
      [async () => pr({ base: { ref: 'main', sha: 'c'.repeat(40) } }), 2, 'ABORTED_STALE_BASE'],
      [async () => pr({ mergeable: null }), 2, 'MERGEABILITY_UNKNOWN'],
    ]) {
      expect(await safeUpdateBranch({ expectedHeadSha: HEAD, observedBaseSha: BASE,
        behindBy, readPr, update })).toBe(expected);
    }
    expect(update).not.toHaveBeenCalled();
  });

  test('no force update if branch already current', async () => {
    const update = jest.fn();
    expect(await safeUpdateBranch({ expectedHeadSha: HEAD, observedBaseSha: BASE,
      behindBy: 0, readPr: async () => pr({ mergeable_state: 'clean' }), update }))
      .toBe('NOT_BEHIND');
    expect(update).not.toHaveBeenCalled();
  });

  test('auto-merge arms only exact current head and successful gate using MERGE', async () => {
    const graphql = jest.fn(async () => ({ data: { enablePullRequestAutoMerge: {
      pullRequest: { number: 42, autoMergeRequest: { mergeMethod: 'MERGE' } },
    } } }));
    const result = await safeArmAutoMerge({ expectedHeadSha: HEAD, gateConclusion: 'success',
      readPr: async () => ({ ...pr({ mergeable_state: 'clean' }), node_id: 'PR_123' }), graphql });
    expect(result).toBe('ARMED');
    expect(graphql.mock.calls[0][1]).toEqual({ pullRequestId: 'PR_123', expectedHeadOid: HEAD });
    expect(graphql.mock.calls[0][0]).toContain('mergeMethod: MERGE');
  });

  test('no auto-merge on stale head, sensitive approval missing or failed gate', async () => {
    const graphql = jest.fn();
    const base = { expectedHeadSha: HEAD, readPr: async () => ({ ...pr(), node_id: 'PR_123' }), graphql };
    expect(await safeArmAutoMerge({ ...base, gateConclusion: 'failure' })).toBe('GATE_NOT_SUCCESS');
    expect(await safeArmAutoMerge({ ...base, gateConclusion: 'success',
      humanExceptionRequired: true, humanExceptionSatisfied: false })).toBe('HUMAN_EXCEPTION_PENDING');
    expect(await safeArmAutoMerge({ ...base, gateConclusion: 'success',
      readPr: async () => ({ ...pr({ head: { sha: 'c'.repeat(40) } }), node_id: 'PR_123' }) }))
      .toBe('ABORTED_STALE_HEAD');
    expect(graphql).not.toHaveBeenCalled();
  });
});
