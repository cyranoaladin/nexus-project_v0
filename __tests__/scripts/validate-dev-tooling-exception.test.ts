import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const repositoryRoot = process.cwd();
const validatorPath = join(
  repositoryRoot,
  'scripts/security/validate-dev-tooling-exception.mjs',
);

const advisoryId = 'GHSA-mh99-v99m-4gvg';
const stageSha = 'a'.repeat(40);
const ciSha = 'b'.repeat(40);
const exactPaths = [
  'node_modules/brace-expansion',
  'node_modules/cacache/node_modules/brace-expansion',
];

type FixtureOptions = {
  extraAdvisory?: boolean;
  expired?: boolean;
  wrongSha?: boolean;
  runtimePresent?: boolean;
};

function npmVulnerability(
  name: string,
  via: Array<string | Record<string, unknown>>,
  nodes: string[] = [],
) {
  return {
    name,
    severity: 'high',
    isDirect: false,
    via,
    effects: [],
    range: '*',
    nodes,
    fixAvailable: false,
  };
}

function createFixture(options: FixtureOptions = {}) {
  const root = mkdtempSync(join(tmpdir(), 'nexus-dev-tooling-exception-'));
  const artifactRoot = join(root, 'standalone');
  mkdirSync(artifactRoot);

  const productionAudit = {
    auditReportVersion: 2,
    vulnerabilities: {},
    metadata: {
      vulnerabilities: {
        info: 0,
        low: 0,
        moderate: 0,
        high: 0,
        critical: 0,
        total: 0,
      },
    },
  };
  const fullAudit = {
    auditReportVersion: 2,
    vulnerabilities: {
      'brace-expansion': npmVulnerability(
        'brace-expansion',
        [
          {
            source: 999001,
            name: 'brace-expansion',
            dependency: 'brace-expansion',
            title: 'DoS via unbounded expansion length',
            url: `https://github.com/advisories/${advisoryId}`,
            severity: 'high',
            range: '<=5.0.7',
          },
        ],
        exactPaths,
      ),
      minimatch: npmVulnerability('minimatch', ['brace-expansion']),
      ...(options.extraAdvisory
        ? {
            'other-package': npmVulnerability('other-package', [
              {
                source: 999002,
                name: 'other-package',
                dependency: 'other-package',
                title: 'Unrelated vulnerability',
                url: 'https://github.com/advisories/GHSA-xxxx-yyyy-zzzz',
                severity: 'high',
                range: '*',
              },
            ]),
          }
        : {}),
    },
    metadata: {
      vulnerabilities: {
        info: 0,
        low: 0,
        moderate: 0,
        high: options.extraAdvisory ? 37 : 36,
        critical: 0,
        total: options.extraAdvisory ? 37 : 36,
      },
    },
  };
  const runtimeSbom = {
    bomFormat: 'CycloneDX',
    specVersion: '1.6',
    components: options.runtimePresent
      ? [{ type: 'library', name: 'brace-expansion', version: '1.1.16' }]
      : [{ type: 'library', name: 'next', version: '15.5.21' }],
  };
  const policy = {
    schemaVersion: '1.0.0',
    policyId: 'pre-rentree-2026-dev-tooling-ghsa-mh99',
    repository: 'cyranoaladin/nexus-project_v0',
    pullRequest: 79,
    advisoryId,
    severity: 'HIGH',
    affectedPackage: 'brace-expansion',
    affectedVersions: '<=5.0.7',
    maximumExpiry: '2026-08-31T23:59:59+01:00',
    maximumDurationDays: 14,
    expectedHighImpactCount: 36,
    requiredRuntimeExposure: 'ABSENT',
    remediationIssue:
      'https://github.com/cyranoaladin/nexus-project_v0/issues/83',
    requiredCompensatingControls: [
      'RAW_AUDIT_ARCHIVED',
      'RUNTIME_SBOM_VERIFIED',
      'STANDALONE_ARTIFACT_VERIFIED',
      'CI_JOB_HAS_NO_PRODUCTION_SECRETS',
    ],
    requiredRevocationConditions: [
      'OFFICIAL_FIX_AVAILABLE',
      'NPM_TREE_CHANGED',
      'BOUND_SHA_CHANGED',
      'ADDITIONAL_ADVISORY_DETECTED',
      'RUNTIME_PRESENCE_DETECTED',
      'CRITICAL_SEVERITY_DETECTED',
      'PUBLIC_INPUT_REACHABLE',
      'COMPENSATING_CONTROL_MISSING',
    ],
  };
  const decision = {
    schemaVersion: '1.1.0',
    decisionId: 'test-owner-decision',
    decision: 'APPROVE_TIME_BOUND_DEV_TOOLING_EXCEPTION',
    repository: policy.repository,
    pullRequest: policy.pullRequest,
    stageProductSha: stageSha,
    ciEvidenceSha: ciSha,
    advisoryId,
    severity: 'HIGH',
    affectedPackage: 'brace-expansion',
    affectedVersions: '<=5.0.7',
    exactDependencyPaths: exactPaths,
    runtimeExposure: 'ABSENT',
    runtimeSbomExposure: 'ABSENT',
    productionAuditResult: 'ZERO_HIGH_CRITICAL',
    fullAuditResult: '36_HIGH_NO_CRITICAL',
    publicInputReachability: 'NOT_REACHABLE',
    ciInputReachability: 'TRUSTED_REPOSITORY_INPUT_ONLY',
    compensatingControls: [
      'RAW_AUDIT_ARCHIVED',
      'RUNTIME_SBOM_VERIFIED',
      'STANDALONE_ARTIFACT_VERIFIED',
      'CI_JOB_HAS_NO_PRODUCTION_SECRETS',
    ],
    ownerName: 'Test Owner',
    securityApproverName: 'Test Owner',
    securityResponsibilityAssumption: true,
    approvedAt: '2026-07-26T19:00:00+01:00',
    expiresAt: options.expired
      ? '2026-07-26T19:30:00+01:00'
      : '2026-08-09T19:00:00+01:00',
    monitoringIssue: policy.remediationIssue,
    upstreamTracking: [
      'https://github.com/advisories/GHSA-mh99-v99m-4gvg',
      'https://www.npmjs.com/package/brace-expansion',
    ],
    automaticRevocationConditions: [
      'OFFICIAL_FIX_AVAILABLE',
      'NPM_TREE_CHANGED',
      'BOUND_SHA_CHANGED',
      'ADDITIONAL_ADVISORY_DETECTED',
      'RUNTIME_PRESENCE_DETECTED',
      'CRITICAL_SEVERITY_DETECTED',
      'PUBLIC_INPUT_REACHABLE',
      'COMPENSATING_CONTROL_MISSING',
    ],
    residualRiskAcknowledgement:
      'The owner accepts the temporary development-tooling availability risk.',
    signatureMethod: 'DECLARATIVE',
    signature: 'test-only declarative signature',
  };
  const osv = {
    results: [
      {
        source: { path: 'package-lock.json', type: 'lockfile' },
        packages: [
          {
            package: {
              name: 'brace-expansion',
              version: '1.1.16',
              ecosystem: 'npm',
            },
            vulnerabilities: [{ id: advisoryId }],
          },
          {
            package: {
              name: 'brace-expansion',
              version: '2.1.2',
              ecosystem: 'npm',
            },
            vulnerabilities: [{ id: advisoryId }],
          },
        ],
      },
    ],
  };

  const paths = {
    root,
    artifactRoot,
    productionAudit: join(root, 'production-audit.json'),
    fullAudit: join(root, 'full-audit.json'),
    runtimeSbom: join(root, 'runtime.cdx.json'),
    policy: join(root, 'policy.json'),
    osv: join(root, 'osv.json'),
  };
  writeFileSync(paths.productionAudit, JSON.stringify(productionAudit));
  writeFileSync(paths.fullAudit, JSON.stringify(fullAudit));
  writeFileSync(paths.runtimeSbom, JSON.stringify(runtimeSbom));
  writeFileSync(paths.policy, JSON.stringify(policy));
  writeFileSync(paths.osv, JSON.stringify(osv));

  return { paths, decision };
}

function runValidator(
  mode: 'npm' | 'osv' | 'artifact',
  options: FixtureOptions = {},
) {
  const fixture = createFixture(options);
  const currentSha = options.wrongSha ? 'c'.repeat(40) : ciSha;
  const args = [
    validatorPath,
    '--mode',
    mode,
    '--policy',
    fixture.paths.policy,
    '--current-sha',
    currentSha,
    '--now',
    '2026-07-27T00:00:00+01:00',
  ];
  if (mode === 'npm') {
    args.push(
      '--report',
      fixture.paths.fullAudit,
      '--production-audit',
      fixture.paths.productionAudit,
      '--runtime-sbom',
      fixture.paths.runtimeSbom,
    );
  }
  if (mode === 'osv') {
    args.push('--report', fixture.paths.osv);
  }
  if (mode === 'artifact') {
    args.push('--artifact-root', fixture.paths.artifactRoot);
    if (options.runtimePresent) {
      mkdirSync(join(fixture.paths.artifactRoot, 'node_modules/brace-expansion'), {
        recursive: true,
      });
    }
  }
  const result = spawnSync(process.execPath, args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      PRE_RENTREE_DEV_TOOLING_EXCEPTION_JSON: JSON.stringify(
        fixture.decision,
      ),
    },
  });
  rmSync(fixture.paths.root, { recursive: true, force: true });
  return result;
}

describe('time-bound development-tooling exception validator', () => {
  it('accepts the exact npm advisory when production and runtime are clean', () => {
    const result = runValidator('npm');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('EXCEPTION_VALID');
  });

  it('rejects an additional high advisory', () => {
    const result = runValidator('npm', { extraAdvisory: true });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('ADDITIONAL_ADVISORY');
  });

  it('rejects an expired exception', () => {
    const result = runValidator('npm', { expired: true });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('EXCEPTION_EXPIRED');
  });

  it('rejects a changed bound SHA', () => {
    const result = runValidator('npm', { wrongSha: true });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('BOUND_SHA_MISMATCH');
  });

  it('rejects runtime SBOM presence', () => {
    const result = runValidator('npm', { runtimePresent: true });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('RUNTIME_PRESENCE');
  });

  it('accepts OSV only when every finding is the exact advisory/package', () => {
    const result = runValidator('osv');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('EXCEPTION_VALID');
  });

  it('rejects the package in the standalone artifact', () => {
    const result = runValidator('artifact', { runtimePresent: true });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('RUNTIME_PRESENCE');
  });
});

describe('official compatible brace-expansion remediation', () => {
  it('resolves every dependency path natively to the fixed 5.x release', () => {
    const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
    const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
    const installedVersions = Object.entries(lock.packages)
      .filter(([packagePath]) => packagePath.endsWith('node_modules/brace-expansion'))
      .map(([, packageMetadata]) => (
        packageMetadata as { version: string }
      ).version);

    expect(installedVersions).toEqual(['5.0.8']);
    expect(manifest.overrides['brace-expansion']).toBeUndefined();
    expect(
      Object.entries(lock.packages)
        .filter(([packagePath]) => packagePath.endsWith('node_modules/minimatch'))
        .every(([, packageMetadata]) => Number(
          (packageMetadata as { version: string }).version.split('.')[0],
        ) >= 10),
    ).toBe(true);
  });
});
