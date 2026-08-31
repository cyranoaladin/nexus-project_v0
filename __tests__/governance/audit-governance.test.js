const fs = require('fs');
const os = require('os');
const path = require('path');

const REAL_ROOT = path.resolve(__dirname, '../..');

describe('runOfflineAudit — the entrypoint CI actually runs', () => {
  let runOfflineAudit;

  beforeAll(async () => {
    ({ runOfflineAudit } = await import('../../scripts/github/audit-governance.mjs'));
  });

  test('the real repository governance state is clean', () => {
    const result = runOfflineAudit({ root: REAL_ROOT });
    expect(result.findings).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.checkedContexts).toBeGreaterThan(0);
  });

  test('a repo root with no CODEOWNERS fails closed with CODEOWNERS_MISSING', () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'governance-offline-'));
    try {
      fs.cpSync(path.join(REAL_ROOT, '.github', 'governance'), path.join(tmpRoot, '.github', 'governance'), {
        recursive: true,
      });
      fs.cpSync(path.join(REAL_ROOT, '.github', 'workflows'), path.join(tmpRoot, '.github', 'workflows'), {
        recursive: true,
      });
      const result = runOfflineAudit({ root: tmpRoot });
      expect(result.ok).toBe(false);
      expect(result.findings.some((f) => f.code === 'CODEOWNERS_MISSING')).toBe(true);
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  test('ARIA_CI_OFFLINE_AUDIT_FAILS_ON_WORKFLOW_DRIFT', () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'governance-aria-ci-'));
    try {
      fs.cpSync(path.join(REAL_ROOT, '.github'), path.join(tmpRoot, '.github'), { recursive: true });
      const workflowPath = path.join(tmpRoot, '.github', 'workflows', 'ci.yml');
      const workflow = fs.readFileSync(workflowPath, 'utf8');
      fs.writeFileSync(workflowPath, workflow.replace('\n  aria-static:\n', '\n  aria-static-disabled:\n'));

      const result = runOfflineAudit({ root: tmpRoot });
      expect(result.ok).toBe(false);
      expect(result.findings).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'ARIA_CI_JOB_MISSING', details: 'aria-static' }),
      ]));
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  test('ARIA_CI_REQUIRES_MATCHING_REGISTRY_PRODUCER', () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'governance-aria-registry-'));
    try {
      fs.cpSync(path.join(REAL_ROOT, '.github'), path.join(tmpRoot, '.github'), { recursive: true });
      const registryPath = path.join(tmpRoot, '.github', 'governance', 'checks-registry.json');
      const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
      registry.observedNotRequired = registry.observedNotRequired.filter(
        (entry) => entry.producer?.jobKey !== 'aria-static',
      );
      fs.writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`);

      const result = runOfflineAudit({ root: tmpRoot });
      expect(result.ok).toBe(false);
      expect(result.findings).toContainEqual({
        code: 'ARIA_CI_REGISTRY_PRODUCER_MISSING',
        details: 'aria-static',
      });
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});

describe('runLiveAudit — reproduces the documented findings against a scripted live state', () => {
  let runLiveAudit;

  beforeAll(async () => {
    ({ runLiveAudit } = await import('../../scripts/github/audit-governance.mjs'));
  });

  test('classic BPR present + matching main => STALE_OR_LATENT_CLASSIC_BPR and 3 ZOMBIE_REQUIRED_CHECK', () => {
    const gh = {
      apiJson: (p) => {
        if (p.includes('rulesets/12801316')) {
          return {
            enforcement: 'active',
            rules: [
              {
                type: 'required_status_checks',
                parameters: {
                  required_status_checks: [
                    { context: 'Lint', integration_id: 15368 },
                    { context: 'GitGuardian Security Checks', integration_id: 46505 },
                  ],
                },
              },
            ],
          };
        }
        if (p.includes('collaborators')) {
          return [
            { login: 'abenrhouma', permissions: { push: true } },
            { login: 'adammeg', permissions: { push: true } },
          ];
        }
        return {};
      },
      graphql: () => ({
        data: {
          repository: {
            branchProtectionRules: {
              nodes: [
                {
                  id: 'BPR_x',
                  pattern: 'main',
                  matchingRefs: { totalCount: 1, nodes: [{ name: 'main', prefix: 'refs/heads/' }] },
                },
              ],
            },
          },
        },
      }),
    };
    const result = runLiveAudit({ root: REAL_ROOT, gh });
    const codes = result.findings.map((f) => f.code);
    expect(codes).toContain('CLASSIC_BRANCH_PROTECTION_PRESENT');
    expect(codes).toContain('STALE_OR_LATENT_CLASSIC_BPR');
    expect(codes).toContain('DUPLICATED_PROTECTION_CONTROLS');
    expect(codes.filter((c) => c === 'ZOMBIE_REQUIRED_CHECK')).toHaveLength(3);
  });

  test('no classic BPR matching main => no STALE_OR_LATENT_CLASSIC_BPR finding', () => {
    const gh = {
      apiJson: (p) => {
        if (p.includes('rulesets/12801316')) {
          return {
            enforcement: 'active',
            rules: [
              {
                type: 'required_status_checks',
                parameters: {
                  required_status_checks: [
                    { context: 'Lint', integration_id: 15368 },
                    { context: 'GitGuardian Security Checks', integration_id: 46505 },
                  ],
                },
              },
            ],
          };
        }
        if (p.includes('collaborators')) {
          return [
            { login: 'abenrhouma', permissions: { push: true } },
            { login: 'adammeg', permissions: { push: true } },
          ];
        }
        return {};
      },
      graphql: () => ({ data: { repository: { branchProtectionRules: { nodes: [] } } } }),
    };
    const result = runLiveAudit({ root: REAL_ROOT, gh });
    const codes = result.findings.map((f) => f.code);
    expect(codes).not.toContain('STALE_OR_LATENT_CLASSIC_BPR');
    expect(codes).not.toContain('ZOMBIE_REQUIRED_CHECK');
  });
});
