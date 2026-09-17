describe('Post-merge branch drift guard', () => {
  let classifyPostMergeDrift;

  beforeAll(async () => {
    ({ classifyPostMergeDrift } = await import('../../scripts/github/check-post-merge-branch-drift.mjs'));
  });

  // fakeGitOps models one merged-then-drifted branch by SHA-keyed ancestry
  // and per-comparison cherry(+) results, without touching real git/gh.
  // Defaults currentRemoteHead to 'newhead' — override per test if needed.
  function fakeGitOps({ ancestors = [], cherry = {}, remoteHead = 'newhead' }) {
    const ancestorPairs = new Set(ancestors.map(([a, b]) => `${a}->${b}`));
    return {
      mergeCommitParents: () => {
        throw new Error('not used by classifyPostMergeDrift directly in these tests');
      },
      currentRemoteHead: () => remoteHead,
      isAncestor: (a, b) => ancestorPairs.has(`${a}->${b}`),
      cherryPlus: (base, tip) => cherry[`${base}->${tip}`] ?? [],
    };
  }

  const mergedPr = (number, headRefName, oid = `merge-${number}`) => ({
    number,
    headRefName,
    mergeCommit: { oid },
  });

  test('a branch untouched since merge produces no finding (UNCHANGED)', () => {
    const gitOps = fakeGitOps({ remoteHead: 'headsha' });
    // mergeCommitParents is called before the SHA-equality short-circuit, so
    // give it a real implementation for this one test.
    gitOps.mergeCommitParents = () => ['base', 'headsha'];
    const findings = classifyPostMergeDrift(
      [mergedPr(272, 'fix/nginx')],
      [{ number: 272, headRefName: 'fix/nginx', state: 'MERGED' }],
      gitOps,
    );
    expect(findings).toEqual([]);
  });

  test('a squash/rebase merge (no mergeCommit) is skipped, never a false positive', () => {
    const findings = classifyPostMergeDrift(
      [{ number: 100, headRefName: 'squashed', mergeCommit: null }],
      [{ number: 100, headRefName: 'squashed', state: 'MERGED' }],
      fakeGitOps({}),
    );
    expect(findings).toEqual([]);
  });

  test('fast-forward append with genuinely new, unreviewed content is UNIQUE_PATCH_UNREVIEWED (the #272 shape)', () => {
    const gitOps = fakeGitOps({
      ancestors: [['oldhead', 'newhead']],
      cherry: {
        'oldhead->newhead': ['newcommit1'],
        'origin/main->newhead': ['newcommit1'],
      },
    });
    gitOps.mergeCommitParents = () => ['base', 'oldhead'];
    const findings = classifyPostMergeDrift(
      [mergedPr(272, 'fix/nginx')],
      [{ number: 272, headRefName: 'fix/nginx', state: 'MERGED' }],
      gitOps,
    );
    expect(findings).toEqual([
      expect.objectContaining({
        number: 272,
        prMergedHead: 'oldhead',
        currentRemoteHead: 'newhead',
        classification: 'UNIQUE_PATCH_UNREVIEWED',
        requiredDelta: true,
        supersedingPr: null,
      }),
    ]);
  });

  test('rewind (force-push backwards) is REWOUND_AFTER_MERGE and never a required delta', () => {
    const gitOps = fakeGitOps({ ancestors: [['newhead', 'oldhead']] });
    gitOps.mergeCommitParents = () => ['base', 'oldhead'];
    const findings = classifyPostMergeDrift(
      [mergedPr(1, 'feat/x')],
      [{ number: 1, headRefName: 'feat/x', state: 'MERGED' }],
      gitOps,
    );
    expect(findings).toEqual([
      expect.objectContaining({ classification: 'REWOUND_AFTER_MERGE', requiredDelta: false }),
    ]);
  });

  test('force-push divergence with genuinely new unreviewed content is DIVERGED + UNIQUE_PATCH_UNREVIEWED (the #15 shape)', () => {
    const gitOps = fakeGitOps({
      // neither is an ancestor of the other: divergence
      cherry: {
        'oldhead->newhead': ['divergedcommit1', 'divergedcommit2'],
        'origin/main->newhead': ['divergedcommit1', 'divergedcommit2'],
      },
    });
    gitOps.mergeCommitParents = () => ['base', 'oldhead'];
    const findings = classifyPostMergeDrift(
      [mergedPr(15, 'split/audit-diagnostics')],
      [{ number: 15, headRefName: 'split/audit-diagnostics', state: 'MERGED' }],
      gitOps,
    );
    expect(findings).toEqual([
      expect.objectContaining({
        classification: 'UNIQUE_PATCH_UNREVIEWED',
        requiredDelta: true,
        supersedingPr: null,
      }),
    ]);
  });

  test('patch-equivalent cherry-pick (rebased, same content) is PATCH_EQUIVALENT, not required', () => {
    const gitOps = fakeGitOps({
      ancestors: [['oldhead', 'newhead']],
      cherry: { 'oldhead->newhead': [] }, // git cherry found no '+' — every commit is patch-equivalent
    });
    gitOps.mergeCommitParents = () => ['base', 'oldhead'];
    const findings = classifyPostMergeDrift(
      [mergedPr(2, 'feat/rebased')],
      [{ number: 2, headRefName: 'feat/rebased', state: 'MERGED' }],
      gitOps,
    );
    expect(findings).toEqual([
      expect.objectContaining({ classification: 'PATCH_EQUIVALENT', requiredDelta: false }),
    ]);
  });

  test('delta already on main under another SHA (independently re-landed/squashed) is UNIQUE_PATCH_ALREADY_IN_MAIN, not required', () => {
    const gitOps = fakeGitOps({
      ancestors: [['oldhead', 'newhead']],
      cherry: {
        'oldhead->newhead': ['relandedcommit'],
        // cherry against main finds an equivalent patch already there (marked '-'), so it's absent from the '+' list:
        'origin/main->newhead': [],
      },
    });
    gitOps.mergeCommitParents = () => ['base', 'oldhead'];
    const findings = classifyPostMergeDrift(
      [mergedPr(3, 'feat/relanded')],
      [{ number: 3, headRefName: 'feat/relanded', state: 'MERGED' }],
      gitOps,
    );
    expect(findings).toEqual([
      expect.objectContaining({ classification: 'UNIQUE_PATCH_ALREADY_IN_MAIN', requiredDelta: false }),
    ]);
  });

  test('delta reviewed in another PR (even closed/unmerged) is UNIQUE_PATCH_REVIEWED_ELSEWHERE, not required', () => {
    const gitOps = fakeGitOps({
      ancestors: [['oldhead', 'newhead']],
      cherry: {
        'oldhead->newhead': ['reviewedcommit'],
        'origin/main->newhead': ['reviewedcommit'],
      },
    });
    gitOps.mergeCommitParents = () => ['base', 'oldhead'];
    const findings = classifyPostMergeDrift(
      [mergedPr(203, 'feat/convergence')],
      [
        { number: 203, headRefName: 'feat/convergence', state: 'MERGED' },
        { number: 205, headRefName: 'feat/convergence', state: 'CLOSED' },
      ],
      gitOps,
    );
    expect(findings).toEqual([
      expect.objectContaining({
        classification: 'UNIQUE_PATCH_REVIEWED_ELSEWHERE',
        requiredDelta: false,
        supersedingPr: { number: 205, headRefName: 'feat/convergence', state: 'CLOSED' },
      }),
    ]);
  });

  test('the highest-numbered other PR on the branch is picked when several exist', () => {
    const gitOps = fakeGitOps({
      ancestors: [['oldhead', 'newhead']],
      cherry: {
        'oldhead->newhead': ['c'],
        'origin/main->newhead': ['c'],
      },
    });
    gitOps.mergeCommitParents = () => ['base', 'oldhead'];
    const findings = classifyPostMergeDrift(
      [mergedPr(170, 'feat/shared')],
      [
        { number: 170, headRefName: 'feat/shared', state: 'MERGED' },
        { number: 171, headRefName: 'feat/shared', state: 'MERGED' },
      ],
      gitOps,
    );
    expect(findings[0].supersedingPr.number).toBe(171);
  });

  test('a merge commit unreachable in this clone is skipped, not thrown', () => {
    const gitOps = {
      mergeCommitParents: () => {
        throw new Error('fatal: bad object');
      },
      isAncestor: () => false,
      cherryPlus: () => [],
    };
    const findings = classifyPostMergeDrift(
      [mergedPr(1, 'ancient/branch')],
      [{ number: 1, headRefName: 'ancient/branch', state: 'MERGED' }],
      gitOps,
    );
    expect(findings).toEqual([]);
  });

  test('a merge commit with more or fewer than two parents (octopus/root) is skipped', () => {
    const gitOps = fakeGitOps({});
    gitOps.mergeCommitParents = () => ['base', 'headA', 'headB'];
    const findings = classifyPostMergeDrift(
      [mergedPr(2, 'octopus')],
      [{ number: 2, headRefName: 'octopus', state: 'MERGED' }],
      gitOps,
    );
    expect(findings).toEqual([]);
  });

  test('a branch deleted post-merge (no remote head) is skipped, not flagged', () => {
    const gitOps = fakeGitOps({});
    gitOps.mergeCommitParents = () => ['base', 'oldhead'];
    gitOps.currentRemoteHead = () => '';
    const findings = classifyPostMergeDrift(
      [mergedPr(3, 'deleted-branch')],
      [{ number: 3, headRefName: 'deleted-branch', state: 'MERGED' }],
      gitOps,
    );
    expect(findings).toEqual([]);
  });

  test('an uncomputable patch comparison (e.g. shallow clone) falls back to the coarse shape label rather than guessing', () => {
    const gitOps = fakeGitOps({ ancestors: [['oldhead', 'newhead']] });
    gitOps.mergeCommitParents = () => ['base', 'oldhead'];
    gitOps.cherryPlus = () => null;
    const findings = classifyPostMergeDrift(
      [mergedPr(4, 'feat/shallow')],
      [{ number: 4, headRefName: 'feat/shallow', state: 'MERGED' }],
      gitOps,
    );
    expect(findings).toEqual([
      expect.objectContaining({ classification: 'FAST_FORWARD_ADVANCED_AFTER_MERGE', requiredDelta: false }),
    ]);
  });
});
