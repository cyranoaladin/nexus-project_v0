function methodsFromSettings(block) {
  const methods = [];
  if (block.allow_merge_commit) methods.push('merge');
  if (block.allow_squash_merge) methods.push('squash');
  if (block.allow_rebase_merge) methods.push('rebase');
  return methods.sort();
}

// The repo-settings toggles and the ruleset's allowedMergeMethods are two
// independent gates that must agree — GitHub does not reconcile them for
// you, so silent divergence is exactly the failure mode this guards.
export function mergeMethodAgreement(repositorySettings, mainRuleset) {
  const results = {};
  for (const tier of ['current', 'desired']) {
    const fromSettings = methodsFromSettings(repositorySettings.managedFields[tier]);
    const fromRuleset = [...mainRuleset[tier].rules.pullRequest.allowedMergeMethods].sort();
    results[tier] = {
      agree: JSON.stringify(fromSettings) === JSON.stringify(fromRuleset),
      fromSettings,
      fromRuleset,
    };
  }
  return results;
}
