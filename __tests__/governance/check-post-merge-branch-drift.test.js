describe('Post-merge branch drift guard', () => {
  let classifyPostMergeDrift;

  beforeAll(async () => {
    ({ classifyPostMergeDrift } = await import('../../scripts/github/check-post-merge-branch-drift.mjs'));
  });

  function fakeGitOps({ parents, remoteHead, ancestorOfMain }) {
    return {
      mergeCommitParents: () => parents,
      currentRemoteHead: () => remoteHead,
      isAncestorOfMain: () => ancestorOfMain,
    };
  }

  const mergedPr = (number, headRefName, oid = `merge-${number}`) => ({
    number,
    headRefName,
    mergeCommit: { oid },
  });

  test('a branch untouched since merge produces no finding', () => {
    const findings = classifyPostMergeDrift(
      [mergedPr(272, 'fix/nginx')],
      [{ number: 272, headRefName: 'fix/nginx', state: 'MERGED' }],
      fakeGitOps({ parents: ['base', 'headsha'], remoteHead: 'headsha', ancestorOfMain: true }),
    );
    expect(findings).toEqual([]);
  });

  test('a squash/rebase merge (no mergeCommit) is skipped, never a false positive', () => {
    const findings = classifyPostMergeDrift(
      [{ number: 100, headRefName: 'squashed', mergeCommit: null }],
      [{ number: 100, headRefName: 'squashed', state: 'MERGED' }],
      fakeGitOps({ parents: [], remoteHead: 'irrelevant', ancestorOfMain: false }),
    );
    expect(findings).toEqual([]);
  });

  test('a branch pushed to after merge with no other PR is a silent, unreviewed drift (the #272 case)', () => {
    const findings = classifyPostMergeDrift(
      [mergedPr(272, 'fix/nginx')],
      [{ number: 272, headRefName: 'fix/nginx', state: 'MERGED' }],
      fakeGitOps({ parents: ['base', 'oldhead'], remoteHead: 'newhead', ancestorOfMain: false }),
    );
    expect(findings).toEqual([
      expect.objectContaining({
        number: 272,
        prMergedHead: 'oldhead',
        currentRemoteHead: 'newhead',
        mainContainsDelta: false,
        supersedingPr: null,
      }),
    ]);
  });

  test('drift whose current head is already an ancestor of main is not required (already re-landed)', () => {
    const findings = classifyPostMergeDrift(
      [mergedPr(1, 'feat/x')],
      [{ number: 1, headRefName: 'feat/x', state: 'MERGED' }],
      fakeGitOps({ parents: ['base', 'oldhead'], remoteHead: 'newhead', ancestorOfMain: true }),
    );
    expect(findings).toEqual([
      expect.objectContaining({ mainContainsDelta: true, supersedingPr: null }),
    ]);
  });

  test('a later PR (even closed/unmerged) reusing the same branch name is reported as a superseding PR', () => {
    const findings = classifyPostMergeDrift(
      [mergedPr(203, 'feat/convergence')],
      [
        { number: 203, headRefName: 'feat/convergence', state: 'MERGED' },
        { number: 205, headRefName: 'feat/convergence', state: 'CLOSED' },
      ],
      fakeGitOps({ parents: ['base', 'oldhead'], remoteHead: 'newhead', ancestorOfMain: false }),
    );
    expect(findings).toEqual([
      expect.objectContaining({
        supersedingPr: { number: 205, headRefName: 'feat/convergence', state: 'CLOSED' },
      }),
    ]);
  });

  test('the highest-numbered other PR on the branch is picked when several exist', () => {
    const findings = classifyPostMergeDrift(
      [mergedPr(170, 'feat/shared')],
      [
        { number: 170, headRefName: 'feat/shared', state: 'MERGED' },
        { number: 171, headRefName: 'feat/shared', state: 'MERGED' },
      ],
      fakeGitOps({ parents: ['base', 'oldhead'], remoteHead: 'newhead', ancestorOfMain: true }),
    );
    expect(findings[0].supersedingPr.number).toBe(171);
  });

  test('a merge commit unreachable in this clone is skipped, not thrown', () => {
    const gitOps = {
      mergeCommitParents: () => {
        throw new Error('fatal: bad object');
      },
      currentRemoteHead: () => 'irrelevant',
      isAncestorOfMain: () => false,
    };
    const findings = classifyPostMergeDrift(
      [mergedPr(1, 'ancient/branch')],
      [{ number: 1, headRefName: 'ancient/branch', state: 'MERGED' }],
      gitOps,
    );
    expect(findings).toEqual([]);
  });

  test('a merge commit with more or fewer than two parents (octopus/root) is skipped', () => {
    const findings = classifyPostMergeDrift(
      [mergedPr(2, 'octopus')],
      [{ number: 2, headRefName: 'octopus', state: 'MERGED' }],
      fakeGitOps({ parents: ['base', 'headA', 'headB'], remoteHead: 'newhead', ancestorOfMain: false }),
    );
    expect(findings).toEqual([]);
  });

  test('a branch deleted post-merge (no remote head) is skipped, not flagged', () => {
    const findings = classifyPostMergeDrift(
      [mergedPr(3, 'deleted-branch')],
      [{ number: 3, headRefName: 'deleted-branch', state: 'MERGED' }],
      fakeGitOps({ parents: ['base', 'oldhead'], remoteHead: '', ancestorOfMain: false }),
    );
    expect(findings).toEqual([]);
  });
});
