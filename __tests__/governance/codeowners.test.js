describe('CODEOWNERS parsing, coverage and eligibility', () => {
  let codeowners;

  beforeAll(async () => {
    codeowners = await import('../../scripts/github/lib/codeowners.mjs');
  });

  test('a bare catch-all line gives 100% coverage', () => {
    const result = codeowners.hasFullCoverage('* @abenrhouma @adammeg\n');
    expect(result.coverage).toBe(1);
    expect(result.catchAll.owners).toEqual(['abenrhouma', 'adammeg']);
  });

  test('no catch-all rule means coverage is 0, even with specific patterns', () => {
    const result = codeowners.hasFullCoverage('/app/** @abenrhouma\n/lib/** @adammeg\n');
    expect(result.coverage).toBe(0);
    expect(result.catchAll).toBeNull();
  });

  test('comments and blank lines are ignored', () => {
    const result = codeowners.hasFullCoverage('# comment\n\n* @abenrhouma @adammeg\n');
    expect(result.rules).toEqual([{ pattern: '*', owners: ['abenrhouma', 'adammeg'] }]);
  });

  test('the real repository CODEOWNERS is the catch-all abenrhouma+adammeg pair, cyranoaladin excluded', () => {
    const fs = require('fs');
    const path = require('path');
    const repoRoot = path.resolve(__dirname, '../..');
    const content = fs.readFileSync(path.join(repoRoot, '.github', 'CODEOWNERS'), 'utf8');
    const result = codeowners.hasFullCoverage(content);
    expect(result.coverage).toBe(1);
    expect(result.catchAll.owners.sort()).toEqual(['abenrhouma', 'adammeg']);
    expect(result.catchAll.owners).not.toContain('cyranoaladin');
  });
});

describe('CODEOWNERS live eligibility (via injected gh client, no real network)', () => {
  test('fails closed when a listed principal lacks push access', async () => {
    const { runLiveAudit } = await import('../../scripts/github/audit-governance.mjs');
    const fakeGh = {
      apiJson: (path) => {
        if (path.includes('rulesets/12801316')) {
          return {
            enforcement: 'active',
            rules: [
              {
                type: 'required_status_checks',
                parameters: { required_status_checks: [{ context: 'Lint', integration_id: 15368 }] },
              },
            ],
          };
        }
        if (path.includes('collaborators')) {
          return [
            { login: 'abenrhouma', permissions: { push: true } },
            { login: 'adammeg', permissions: { push: false } },
          ];
        }
        return {};
      },
      graphql: () => ({ data: { repository: { branchProtectionRules: { nodes: [] } } } }),
    };
    const result = runLiveAudit({ gh: fakeGh });
    const finding = result.findings.find((f) => f.code === 'CODEOWNERS_PRINCIPAL_INELIGIBLE');
    expect(finding).toBeDefined();
    expect(finding.details).toMatch(/adammeg/);
    expect(result.ok).toBe(false);
  });
});
