describe('merge method agreement between repo settings and ruleset', () => {
  let mergeMethodAgreement;

  beforeAll(async () => {
    ({ mergeMethodAgreement } = await import('../../scripts/github/lib/merge-method.mjs'));
  });

  function settings(current, desired) {
    return { managedFields: { current, desired } };
  }

  function ruleset(currentMethods, desiredMethods) {
    return {
      current: { rules: { pullRequest: { allowedMergeMethods: currentMethods } } },
      desired: { rules: { pullRequest: { allowedMergeMethods: desiredMethods } } },
    };
  }

  test('agrees when both gates express the same method set', () => {
    const result = mergeMethodAgreement(
      settings(
        { allow_merge_commit: true, allow_squash_merge: false, allow_rebase_merge: false },
        { allow_merge_commit: true, allow_squash_merge: false, allow_rebase_merge: false },
      ),
      ruleset(['merge'], ['merge']),
    );
    expect(result.current.agree).toBe(true);
    expect(result.desired.agree).toBe(true);
  });

  test('detects divergence: repo settings allow squash but the ruleset does not', () => {
    const result = mergeMethodAgreement(
      settings(
        { allow_merge_commit: true, allow_squash_merge: true, allow_rebase_merge: false },
        { allow_merge_commit: true, allow_squash_merge: true, allow_rebase_merge: false },
      ),
      ruleset(['merge'], ['merge']),
    );
    expect(result.current.agree).toBe(false);
    expect(result.current.fromSettings).toEqual(['merge', 'squash']);
    expect(result.current.fromRuleset).toEqual(['merge']);
  });

  test('this repository real desired state agrees (MERGE_COMMIT_ONLY, both gates)', async () => {
    const path = require('path');
    const fs = require('fs');
    const repoRoot = path.resolve(__dirname, '../..');
    const repoSettings = JSON.parse(
      fs.readFileSync(path.join(repoRoot, '.github/governance/repository-settings.json'), 'utf8'),
    );
    const mainRuleset = JSON.parse(
      fs.readFileSync(path.join(repoRoot, '.github/governance/main-ruleset.json'), 'utf8'),
    );
    const result = mergeMethodAgreement(repoSettings, mainRuleset);
    expect(result.current.agree).toBe(true);
    expect(result.desired.agree).toBe(true);
    expect(result.desired.fromRuleset).toEqual(['merge']);
  });
});
