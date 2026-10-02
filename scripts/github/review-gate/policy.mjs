/** Pure deterministic verdict over evidence freshly read from GitHub. */
const SHA = /^[0-9a-f]{40}$/;
const SELF_CONTEXT = 'Nexus Review Gate';
const SELF_APP_ID = 5166727;

const fail = (reason) => ({ passed: false, reason });

function requiredChecksFrom(effectiveRules) {
  if (!Array.isArray(effectiveRules) || effectiveRules.length === 0) return null;
  const requiredRules = effectiveRules.filter((rule) => rule?.type === 'required_status_checks');
  if (requiredRules.length === 0) return null;
  const checks = requiredRules.flatMap((rule) => rule?.parameters?.required_status_checks ?? []);
  if (requiredRules.some((rule) => !Array.isArray(rule?.parameters?.required_status_checks)) ||
      checks.length === 0 || checks.some((check) =>
        typeof check?.context !== 'string' || check.context.length === 0 ||
        !Number.isSafeInteger(check.integration_id) || check.integration_id <= 0)) return null;
  return checks;
}

function validTestMergeCommit(testMergeCommit, reviewedBaseSha, reviewedHeadSha) {
  return testMergeCommit?.verified === true && SHA.test(testMergeCommit.sha ?? '') &&
    testMergeCommit.sha !== reviewedHeadSha && testMergeCommit.sha !== reviewedBaseSha &&
    Array.isArray(testMergeCommit.parentShas) && testMergeCommit.parentShas.length === 2 &&
    testMergeCommit.parentShas[0] === reviewedBaseSha &&
    testMergeCommit.parentShas[1] === reviewedHeadSha;
}

function latestRun(candidates) {
  const timestamp = (value) => typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value) &&
    Number.isFinite(Date.parse(value));
  if (candidates.some((check) => !Number.isSafeInteger(check.id) || check.id <= 0 ||
      !timestamp(check.started_at) ||
      (check.status === 'completed' &&
        (!timestamp(check.completed_at) ||
          Date.parse(check.completed_at) < Date.parse(check.started_at))))) {
    return null;
  }
  if (candidates.length === 1) return candidates[0];
  const sorted = [...candidates].sort((a, b) => a.id - b.id);
  if (new Set(sorted.map((check) => check.id)).size !== sorted.length) return null;
  if (sorted.some((check, index) => index > 0 &&
      Date.parse(check.started_at) <= Date.parse(sorted[index - 1].started_at))) return null;
  return sorted.at(-1);
}

export function evaluateDeterministicGate(evidence) {
  const { pr, reviewedHeadSha, currentHeadSha, reviewedBaseSha, currentBaseSha,
    effectiveRules, rulesComplete, checkRuns, checksComplete,
    statuses, statusesComplete, diffAvailable, diffComplete, diffBaseSha, diffHeadSha,
    testMergeCommit, requiredCheckTargetSha } = evidence ?? {};

  if (pr?.state !== 'open') return fail('PR_NOT_OPEN');
  if (pr.draft !== false) return fail('PR_DRAFT');
  if (pr.base?.ref !== 'main') return fail('BASE_BRANCH_INVALID');
  if (!SHA.test(pr.base.sha ?? '')) return fail('BASE_SHA_INVALID');
  if (!SHA.test(reviewedBaseSha ?? '') || !SHA.test(currentBaseSha ?? '') ||
      reviewedBaseSha !== pr.base.sha || currentBaseSha !== reviewedBaseSha) return fail('STALE_BASE');
  if (!SHA.test(reviewedHeadSha ?? '') || !SHA.test(pr.head?.sha ?? '') ||
      pr.head.sha !== reviewedHeadSha) return fail('STALE_HEAD');
  if (!SHA.test(currentHeadSha ?? '') || currentHeadSha !== reviewedHeadSha) return fail('STALE_HEAD');
  if (pr.mergeable === false) return fail('MERGE_CONFLICT');
  if (pr.mergeable !== true) return fail('MERGEABILITY_UNKNOWN');
  if (diffAvailable !== true) return fail('DIFF_UNAVAILABLE');
  if (diffComplete !== true) return fail('DIFF_INCOMPLETE');
  if (diffBaseSha !== reviewedBaseSha || diffHeadSha !== reviewedHeadSha) return fail('DIFF_SHA_MISMATCH');
  if (testMergeCommit !== undefined &&
      !validTestMergeCommit(testMergeCommit, reviewedBaseSha, reviewedHeadSha)) {
    return fail('TEST_MERGE_INVALID');
  }
  if (!SHA.test(requiredCheckTargetSha ?? '') || requiredCheckTargetSha !==
      (testMergeCommit === undefined ? reviewedHeadSha : testMergeCommit.sha)) {
    return fail('CHECK_TARGET_MISMATCH');
  }

  if (rulesComplete !== true) return fail('RULESET_INCOMPLETE');
  const required = requiredChecksFrom(effectiveRules);
  if (!required) return fail('RULESET_INVALID');
  const self = required.filter((check) => check.context === SELF_CONTEXT);
  if (self.some((check) => check.integration_id !== SELF_APP_ID)) {
    return fail('REQUIRED_CHECK_IDENTITY_AMBIGUOUS');
  }
  const allPrerequisites = required.filter((check) =>
    check.context !== SELF_CONTEXT || check.integration_id !== SELF_APP_ID);
  const prerequisites = [];
  for (const check of allPrerequisites) {
    const existing = prerequisites.find((item) => item.context === check.context);
    if (existing && existing.integration_id !== check.integration_id) {
      return fail('REQUIRED_CHECK_IDENTITY_AMBIGUOUS');
    }
    if (!existing) prerequisites.push(check);
  }
  if (prerequisites.length === 0) return fail('REQUIRED_CHECKS_EMPTY');
  if (checksComplete !== true || !Array.isArray(checkRuns)) return fail('REQUIRED_CHECKS_INCOMPLETE');
  if (statusesComplete !== true || !Array.isArray(statuses)) return fail('REQUIRED_STATUSES_INCOMPLETE');

  for (const requirement of prerequisites) {
    const matchingRuns = checkRuns.filter((check) =>
      check?.name === requirement.context && check.head_sha === requiredCheckTargetSha);
    const matchingStatuses = statuses.filter((status) =>
      status?.context === requirement.context &&
      (status.sha === reviewedHeadSha || status.sha === requiredCheckTargetSha));
    if (matchingRuns.length === 0 && matchingStatuses.length === 0) return fail('REQUIRED_CHECK_MISSING');
    if (matchingRuns.some((check) => check.app?.id !== requirement.integration_id)) {
      return fail('REQUIRED_CHECK_WRONG_APP');
    }
    // GitHub's legacy Status API cannot attest the producing App ID. A caller
    // supplied sourceAppId is not independent proof, even beside a Check Run.
    if (matchingStatuses.length > 0) {
      return fail('REQUIRED_STATUS_SOURCE_UNVERIFIABLE');
    }
    const check = latestRun(matchingRuns);
    if (!check) return fail('REQUIRED_CHECK_AMBIGUOUS');
    if (check.status !== 'completed') return fail('REQUIRED_CHECKS_INCOMPLETE');
    if (check.conclusion !== 'success') return fail('REQUIRED_CHECK_FAILED');
  }

  return {
    passed: true,
    reason: 'PASS',
    reviewedHeadSha,
    reviewedBaseSha,
    requiredCheckTargetSha,
    requiredChecks: prerequisites.map((check) => check.context),
    selfCheckExcluded: self.length > 0,
  };
}
