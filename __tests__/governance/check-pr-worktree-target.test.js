describe('PR/worktree target-integrity preflight', () => {
  let checkPrWorktreeTarget;

  beforeAll(async () => {
    ({ checkPrWorktreeTarget } = await import('../../scripts/github/check-pr-worktree-target.mjs'));
  });

  test('matching branch/upstream/head is OK', () => {
    const result = checkPrWorktreeTarget({
      localBranch: 'fix/video-jitsi-security-and-room-identity',
      localHead: 'abc123',
      upstream: 'origin/fix/video-jitsi-security-and-room-identity',
      prHeadRef: 'fix/video-jitsi-security-and-room-identity',
      prHeadOid: 'abc123',
    });
    expect(result).toEqual({ ok: true, findings: [] });
  });

  test('the real PR #268 incident: local branch renamed away from the PR head ref is caught', () => {
    const result = checkPrWorktreeTarget({
      localBranch: 'fix/pr268-notification-gate-and-durability',
      localHead: 'f97dbbe19',
      upstream: 'origin/feat/aria-p7c-bilan-published-notification-20260912',
      prHeadRef: 'feat/aria-p7c-bilan-published-notification-20260912',
      prHeadOid: 'bdde6ad61',
    });
    expect(result.ok).toBe(false);
    expect(result.findings[0]).toMatch(/LOCAL_BRANCH.*!= PR_HEAD_REF/);
  });

  test('upstream pointing at the wrong branch name is caught even if LOCAL_BRANCH happens to match', () => {
    const result = checkPrWorktreeTarget({
      localBranch: 'feat/aria-p7c-bilan-published-notification-20260912',
      localHead: 'f97dbbe19',
      upstream: 'origin/fix/pr268-notification-gate-and-durability',
      prHeadRef: 'feat/aria-p7c-bilan-published-notification-20260912',
      prHeadOid: 'bdde6ad61',
    });
    expect(result.ok).toBe(false);
    expect(result.findings[0]).toMatch(/UPSTREAM.*!= "origin\/feat/);
  });

  test('missing upstream (NONE) is caught, not treated as vacuously fine', () => {
    const result = checkPrWorktreeTarget({
      localBranch: 'feat/x',
      localHead: 'abc',
      upstream: null,
      prHeadRef: 'feat/x',
      prHeadOid: 'abc',
    });
    expect(result.ok).toBe(false);
    expect(result.findings[0]).toMatch(/UPSTREAM \("NONE"\)/);
  });

  test('--after-push mode: a push that did not reach the remote branch is caught', () => {
    const result = checkPrWorktreeTarget(
      {
        localBranch: 'feat/x',
        localHead: 'newsha',
        upstream: 'origin/feat/x',
        prHeadRef: 'feat/x',
        prHeadOid: 'oldsha',
      },
      { afterPush: true, prNumber: 1, remoteHead: 'oldsha' },
    );
    expect(result.ok).toBe(false);
    expect(result.findings).toEqual([
      expect.stringMatching(/POST-PUSH: git ls-remote.*!= LOCAL_HEAD/),
      expect.stringMatching(/POST-PUSH: GitHub PR #1 head OID.*!= LOCAL_HEAD/),
    ]);
  });

  test('--after-push mode: a fully-propagated push is OK', () => {
    const result = checkPrWorktreeTarget(
      {
        localBranch: 'feat/x',
        localHead: 'newsha',
        upstream: 'origin/feat/x',
        prHeadRef: 'feat/x',
        prHeadOid: 'newsha',
      },
      { afterPush: true, prNumber: 1, remoteHead: 'newsha' },
    );
    expect(result).toEqual({ ok: true, findings: [] });
  });

  test('--after-push mode: remote branch updated but GitHub PR object still stale (propagation lag) is caught', () => {
    const result = checkPrWorktreeTarget(
      {
        localBranch: 'feat/x',
        localHead: 'newsha',
        upstream: 'origin/feat/x',
        prHeadRef: 'feat/x',
        prHeadOid: 'oldsha',
      },
      { afterPush: true, prNumber: 1, remoteHead: 'newsha' },
    );
    expect(result.ok).toBe(false);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]).toMatch(/GitHub PR #1 head OID/);
  });
});
