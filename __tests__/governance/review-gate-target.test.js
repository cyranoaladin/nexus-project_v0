const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');

describe('pending App-bound governance target', () => {
  test('preserves every current required check and adds only App 5166727', () => {
    const current = JSON.parse(fs.readFileSync(path.join(root, '.github/governance/main-ruleset.json')));
    const registry = JSON.parse(fs.readFileSync(path.join(root, '.github/governance/checks-registry.json')));
    const target = JSON.parse(fs.readFileSync(path.join(root, '.github/governance/review-gate-target.json')));
    const desired = target.desired;
    expect(target.activation).toBe('PENDING_QUALIFICATION');
    expect(current.desired.rules.pullRequest.requiredApprovingReviewCount).toBe(1);
    expect(desired.pullRequest).toEqual(expect.objectContaining({ requiredApprovingReviewCount: 0,
      requireLastPushApproval: false, dismissStaleReviewsOnPush: true,
      requiredReviewThreadResolution: true, requireCodeOwnerReview: false }));
    expect(desired.bypassActors).toEqual([]);
    const checks = desired.requiredStatusChecks;
    expect(checks).toHaveLength(registry.requiredChecks.length + 1);
    for (const entry of registry.requiredChecks) {
      expect(checks).toContainEqual({ context: entry.context, integrationId: entry.producer.integrationId });
    }
    expect(checks).toContainEqual({ context: 'Nexus Review Gate', integrationId: 5166727 });
    expect(new Set(checks.map((check) => check.context)).size).toBe(checks.length);
    expect(target.prerequisites).toEqual(expect.arrayContaining([
      'SEMANTIC_REVIEWER_QUALIFIED', 'CANARY_EXACT_HEAD_PASS', 'HUMAN_EXCEPTION_PATH_PASS',
      'APP_SOURCE_BINDING_PASS',
    ]));
  });

  test('target is not silently loaded by the current apply operator', async () => {
    const { planApply } = await import('../../scripts/github/apply-governance.mjs');
    const source = fs.readFileSync(path.join(root, 'scripts/github/apply-governance.mjs'), 'utf8');
    expect(typeof planApply).toBe('function');
    expect(source).not.toContain('review-gate-target.json');
  });
});
