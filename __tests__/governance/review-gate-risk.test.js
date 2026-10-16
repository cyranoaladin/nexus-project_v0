const HEAD = 'a'.repeat(40);
const OLD_HEAD = 'b'.repeat(40);

let classifyRisk;
let applicableHumanApproval;
let riskConfig;

beforeAll(async () => {
  ({ classifyRisk, applicableHumanApproval, riskConfig } = await import('../../scripts/github/review-gate/risk.mjs'));
});

const changed = (filename, patch = '@@ -1 +1 @@\n-old\n+new', extra = {}) => {
  const lines = (patch ?? '').split('\n');
  const additions = lines.filter((line) => line.startsWith('+')).length;
  const deletions = lines.filter((line) => line.startsWith('-')).length;
  return { filename, status: 'modified', patch, additions, deletions,
    changes: additions + deletions, ...extra };
};

describe('versioned human-on-exception risk policy', () => {
  test('ordinary application, tests, and benign workflows remain normal', () => {
    expect(classifyRisk([
      changed('app/offres/page.tsx'),
      changed('__tests__/lib/pricing.test.ts'),
      changed('.github/workflows/docs-lint.yml', '@@ -1 +1 @@\n-# old explanation\n+# clearer explanation'),
    ])).toEqual({ classification: 'NORMAL', humanExceptionRequired: false, reasons: [] });
  });

  test.each([
    ['.github/CODEOWNERS', 'GOV_SELF_MODIFICATION'],
    ['.github/governance/main-ruleset.json', 'GOV_SELF_MODIFICATION'],
    ['scripts/github/arm-auto-merge.mjs', 'GOV_SELF_MODIFICATION'],
    ['__tests__/governance/review-gate-risk.test.js', 'GOV_SELF_MODIFICATION'],
    ['.github/workflows/nexus-review-gate-proof.yml', 'GOV_SELF_MODIFICATION'],
    ['.github/workflows/ci.yml', 'CI_PROTECTION_CHANGE'],
    ['.github/workflows/preview-artifact.yml', 'PRODUCTION_DEPLOY_ACCESS_CHANGE'],
    ['scripts/deploy-production-safe.sh', 'PRODUCTION_DEPLOY_ACCESS_CHANGE'],
    ['scripts/release/preview-artifact-builder-guards.js', 'PRODUCTION_DEPLOY_ACCESS_CHANGE'],
    ['scripts/audit-production-artifact.js', 'PRODUCTION_DEPLOY_ACCESS_CHANGE'],
    ['scripts/security/check-versioned-credentials.mjs', 'CREDENTIAL_SURFACE_CHANGE'],
    ['secrets/preview-runtime.env', 'CREDENTIAL_SURFACE_CHANGE'],
  ])('%s requires a human exception', (filename, reason) => {
    expect(classifyRisk([changed(filename)])).toEqual({
      classification: 'SENSITIVE', humanExceptionRequired: true, reasons: [reason],
    });
  });

  test('workflow permission or secret changes are sensitive, not every workflow edit', () => {
    const permissionChange = changed('.github/workflows/docs-lint.yml', '@@ -1 +1 @@\n-permissions: read-all\n+permissions: write-all');
    expect(classifyRisk([permissionChange])).toEqual({
      classification: 'SENSITIVE', humanExceptionRequired: true, reasons: ['PRIVILEGED_WORKFLOW_CHANGE'],
    });
    const secretChange = changed('.github/workflows/docs-lint.yml', '@@ -1 +1 @@\n-echo before\n+echo "${{ secrets.NEW_KEY }}"');
    expect(classifyRisk([secretChange]).classification).toBe('SENSITIVE');
    const executableChange = changed('.github/workflows/docs-lint.yml', '@@ -1 +1 @@\n-echo old\n+echo new');
    expect(classifyRisk([executableChange]).reasons).toContain('PRIVILEGED_WORKFLOW_CHANGE');
    const actionChange = changed('.github/workflows/docs-lint.yml', '@@ -1 +1 @@\n-uses: actions/checkout@old\n+uses: vendor/action@new');
    expect(classifyRisk([actionChange]).reasons).toContain('PRIVILEGED_WORKFLOW_CHANGE');
  });

  test('bypass changes and destructive migrations require a human, additive migration does not', () => {
    expect(classifyRisk([changed('docs/config.md', '@@ -1 +1 @@\n-bypass_actors: []\n+bypass_actors: [admin]')]).reasons)
      .toContain('NEW_GOVERNANCE_EXCEPTION_OR_BYPASS_ACTOR');
    expect(classifyRisk([changed('prisma/migrations/20261001_drop/migration.sql', '@@ -1 +1 @@\n-SELECT 1;\n+DROP TABLE "Student";')]).reasons)
      .toContain('DESTRUCTIVE_OR_IRREVERSIBLE_DATA_CHANGE');
    expect(classifyRisk([changed('prisma/migrations/20261001_add/migration.sql', '@@ -0,0 +1 @@\n+ALTER TABLE "Student" ADD COLUMN "label" text;')]).classification)
      .toBe('NORMAL');
  });

  test('a newly introduced credential value is sensitive even in an ordinary source path', () => {
    const result = classifyRisk([changed('lib/config.ts',
      "@@ -1 +1 @@\n-const value = null;\n+const OPENROUTER_API_KEY = 'synthetic-example-value';")]);
    expect(result.reasons).toContain('NEW_SECRET_VALUE');
    const removalOnly = classifyRisk([changed('lib/config.ts',
      "@@ -1 +1 @@\n-const OPENROUTER_API_KEY = 'synthetic-example-value';\n+const value = null;")]);
    expect(removalOnly.classification).toBe('NORMAL');
  });

  test('an unfamiliar provider credential name is never an ordinary change', () => {
    const result = classifyRisk([changed('lib/config.ts',
      '@@ -1 +1 @@\n-const value = null;\n+const STRIPE_SECRET_KEY = "sk_live_example123456789";')]);
    expect(result.classification).not.toBe('NORMAL');
  });

  test('destructive ORM operations outside SQL migrations require human review', () => {
    const result = classifyRisk([changed('scripts/migrate-students.ts',
      '@@ -0,0 +1 @@\n+await prisma.student.deleteMany();')]);
    expect(result.classification).not.toBe('NORMAL');
  });

  test('missing or inconsistent GitHub change counters and malformed hunks fail closed', () => {
    for (const file of [
      changed('app/page.tsx', undefined, { changes: 10_000, additions: 5_000, deletions: 5_000 }),
      changed('app/page.tsx', undefined, { changes: undefined }),
      changed('app/page.tsx', '@@ malformed @@\n-old\n+new'),
    ]) {
      expect(classifyRisk([file]).classification).toBe('UNCLASSIFIED');
    }
  });

  test('valid content beginning with three plus or minus signs is counted as diff data', () => {
    expect(classifyRisk([changed('app/page.tsx', '@@ -1 +1 @@\n---old\n+++new')]).classification)
      .toBe('NORMAL');
  });

  test('renaming a sensitive file cannot erase its previous-path classification', () => {
    expect(classifyRisk([changed('docs/new-name.md', '@@ -1 +1 @@\n-a\n+b', {
      status: 'renamed', previous_filename: '.github/CODEOWNERS',
    })]).reasons).toContain('GOV_SELF_MODIFICATION');
  });

  test.each([
    ['no files', []],
    ['missing patch', [changed('app/page.tsx', undefined, { patch: undefined })]],
    ['binary change', [changed('public/banner.png', undefined, { patch: undefined })]],
    ['unknown status', [changed('app/page.tsx', '@@ -1 +1 @@\n-a\n+b', { status: 'mystery' })]],
    ['missing previous filename for rename', [changed('app/page.tsx', '@@ -1 +1 @@\n-a\n+b', { status: 'renamed' })]],
    ['unsafe filename', [changed('../.github/CODEOWNERS')]],
    ['oversized patch', [changed('app/page.tsx', 'x'.repeat(200_001))]],
  ])('%s is unclassified and fails closed', (_label, files) => {
    const result = classifyRisk(files);
    expect(result.classification).toBe('UNCLASSIFIED');
    expect(result.humanExceptionRequired).toBe(true);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  test('multiple sensitive reasons are deduplicated and deterministic', () => {
    const result = classifyRisk([
      changed('scripts/github/a.mjs'),
      changed('.github/CODEOWNERS'),
      changed('scripts/deploy-production-safe.sh'),
    ]);
    expect(result.reasons).toEqual(['GOV_SELF_MODIFICATION', 'PRODUCTION_DEPLOY_ACCESS_CHANGE']);
  });

  test('human approver policy is explicit and versioned', () => {
    expect(riskConfig).toEqual(expect.objectContaining({
      schemaVersion: 1,
      humanApprovers: ['abenrhouma', 'adammeg'],
    }));
  });
});

describe('exact-head human exception approval', () => {
  const approved = (commitId = HEAD, extra = {}) => ({
    id: 10, user: { login: 'abenrhouma' }, state: 'APPROVED', commit_id: commitId, ...extra,
  });

  test('accepts an authorized approval only on the exact current head', () => {
    expect(applicableHumanApproval({ headSha: HEAD, reviewsComplete: true, reviews: [approved()] }))
      .toEqual({ approved: true, approver: 'abenrhouma', reason: 'APPLICABLE_APPROVAL' });
    expect(applicableHumanApproval({ headSha: HEAD, reviewsComplete: true, reviews: [approved(OLD_HEAD)] }).approved)
      .toBe(false);
  });

  test('does not accept other users, dismissed reviews, or incomplete evidence', () => {
    expect(applicableHumanApproval({ headSha: HEAD, reviewsComplete: true, reviews: [approved(HEAD, { user: { login: 'random' } })] }).approved)
      .toBe(false);
    expect(applicableHumanApproval({ headSha: HEAD, reviewsComplete: true, reviews: [approved(HEAD, { state: 'DISMISSED' })] }).approved)
      .toBe(false);
    expect(applicableHumanApproval({ headSha: HEAD, reviewsComplete: false, reviews: [approved()] }).approved)
      .toBe(false);
    expect(applicableHumanApproval({ headSha: HEAD, reviewsComplete: true, reviews: null }).approved)
      .toBe(false);
    expect(applicableHumanApproval({ headSha: HEAD, reviewsComplete: true,
      reviews: [approved(HEAD, { user: { login: 42 } })] }).approved).toBe(false);
    expect(applicableHumanApproval({ headSha: 'bad', reviewsComplete: true, reviews: [approved()] }).approved)
      .toBe(false);
  });

  test('a later decisive review by the same approver supersedes earlier approval', () => {
    const reviews = [approved(), approved(HEAD, { id: 11, state: 'CHANGES_REQUESTED' })];
    expect(applicableHumanApproval({ headSha: HEAD, reviewsComplete: true, reviews }).approved).toBe(false);
  });
});
