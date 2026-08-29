const path = require('path');

describe('AMBIGUOUS_INVARIANT detection', () => {
  let scanWorkflowsForAmbiguousInvariants;

  beforeAll(async () => {
    ({ scanWorkflowsForAmbiguousInvariants } = await import('../../scripts/github/lib/invariants.mjs'));
  });

  test('flags exactly the continue-on-error step whose name contains "invariant"', () => {
    const findings = scanWorkflowsForAmbiguousInvariants(path.join(__dirname, 'fixtures', 'workflows'));
    const fromFixture = findings.filter((f) => f.file === 'ambiguous-invariant.yml');
    expect(fromFixture).toEqual([
      { file: 'ambiguous-invariant.yml', jobKey: 'diagnostics', stepName: 'Check invariant on credit ledger' },
    ]);
  });

  test('the real repository workflows have zero ambiguous invariants (data-invariants.yml was deleted, not renamed)', () => {
    const repoRoot = path.resolve(__dirname, '../..');
    const findings = scanWorkflowsForAmbiguousInvariants(path.join(repoRoot, '.github', 'workflows'));
    expect(findings).toEqual([]);
  });
});
