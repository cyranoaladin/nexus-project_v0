const { findMisplacedArchiveReports } = require('../../scripts/docs/check-archive-placement');

describe('docs archive placement guard', () => {
  test('flags historical report names created at docs root', () => {
    expect(
      findMisplacedArchiveReports([
        'docs/AUDIT_PROD_PATCH_2026-04-25.md',
        'docs/P0_DEPLOYMENT_PLAN_2026-04-29.md',
        'docs/P1_AUDITS_BRANCHES_2026-04-29.md',
        'docs/GO_LIVE_DECISION_FINAL_2026-04-29.md',
      ]),
    ).toEqual([
      'docs/AUDIT_PROD_PATCH_2026-04-25.md',
      'docs/P0_DEPLOYMENT_PLAN_2026-04-29.md',
      'docs/P1_AUDITS_BRANCHES_2026-04-29.md',
      'docs/GO_LIVE_DECISION_FINAL_2026-04-29.md',
    ]);
  });

  test('allows archived or active audit directories', () => {
    expect(
      findMisplacedArchiveReports([
        'docs/archive/audits/2026-04-root/AUDIT_PROD_PATCH_2026-04-25.md',
        'docs/archive/security/2026-05/P0_API_CLOSURE_AUDIT_2026-05-29.md',
        'docs/audits/2026-06-23-documentation-inventory-cleanup.md',
        'docs/audits/2026-06-22-parent-subscription-endpoints-audit.md',
        'docs/README.md',
      ]),
    ).toEqual([]);
  });
});
