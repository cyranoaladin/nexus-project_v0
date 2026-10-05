import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = process.cwd();
const validator = join(root, 'scripts/security/validate-dev-tooling-exception.mjs');
const headSha = 'a'.repeat(40);

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'nexus-current-osv-exception-'));
  const standalone = join(directory, 'standalone');
  mkdirSync(join(standalone, '.next'), { recursive: true });
  writeFileSync(join(standalone, 'server.js'), '// synthetic standalone\n');
  writeFileSync(join(standalone, '.next/BUILD_ID'), 'synthetic-build\n');

  const lock = {
    name: 'nexus-reussite-app',
    lockfileVersion: 3,
    packages: {
      '': { name: 'nexus-reussite-app', version: '1.0.0' },
      'node_modules/braces': {
        version: '3.0.3', dev: true, integrity: 'sha512-braces-fixture',
      },
      'node_modules/micromatch': {
        version: '4.0.8', dev: true, dependencies: { braces: '^3.0.3' },
      },
    },
  };
  const lockText = JSON.stringify(lock);
  const lockfile = join(directory, 'package-lock.json');
  writeFileSync(lockfile, lockText);
  const digest = createHash('sha256').update(lockText).digest('hex');
  const policy = {
    schemaVersion: '2.0.0',
    policyId: '2026-10-03-exact-osv-dev-tooling',
    repository: 'cyranoaladin/nexus-project_v0',
    decision: 'TEMPORARY_DEV_TOOLING_EXCEPTION',
    approvedAt: '2026-10-03T00:00:00Z',
    expiresAt: '2026-10-10T00:00:00Z',
    maximumExpiry: '2026-10-10T00:00:00Z',
    maximumDurationDays: 7,
    fullAuditImpactedPackageCount: 2,
    fullAuditImpactSha256: createHash('sha256').update(JSON.stringify([
      ['braces', ['node_modules/braces']],
      ['micromatch', ['node_modules/micromatch']],
    ])).digest('hex'),
    lockfileSha256: digest,
    remediationIssue: 'https://github.com/cyranoaladin/nexus-project_v0/issues/1',
    advisories: [
      {
        id: 'GHSA-vfj7-8cjw-p6xm', package: 'braces', version: '3.0.3',
        severity: 'HIGH', lockPaths: ['node_modules/braces'],
        parentPaths: ['node_modules/micromatch'],
        cvssVectors: [
          'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H',
          'CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:N/VI:N/VA:H/SC:N/SI:N/SA:N',
        ],
        integrity: 'sha512-braces-fixture',
      },
    ],
    revocationConditions: [
      'NEW_ADVISORY', 'RUNTIME_PRESENCE', 'PRODUCTION_DEPENDENCY',
      'DEPENDENCY_PATH_CHANGED', 'SEVERITY_ESCALATED',
      'COMPENSATING_CONTROL_FAILED', 'EXCEPTION_EXPIRED',
    ],
  };
  const productionAudit = {
    auditReportVersion: 2,
    vulnerabilities: {},
    metadata: { vulnerabilities: {
      info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0,
    } },
  };
  const productionTree: {
    name: string;
    version: string;
    dependencies: Record<string, { name: string; version: string }>;
  } = {
    name: 'nexus-reussite-app', version: '1.0.0',
    dependencies: { next: { name: 'next', version: '15.5.21' } },
  };
  const runtimeSbom = {
    bomFormat: 'CycloneDX', specVersion: '1.6',
    components: [{ type: 'library', name: 'next', version: '15.5.21' }],
  };
  const osv = { results: [{
    source: { path: '/runner/repo/package-lock.json', type: 'lockfile' },
    packages: policy.advisories.map((advisory) => ({
      package: { name: advisory.package, version: advisory.version, ecosystem: 'npm' },
      vulnerabilities: [{ id: advisory.id, database_specific: { severity: 'HIGH' },
        severity: advisory.cvssVectors.map((score, index) => ({
          type: index === 0 ? 'CVSS_V3' : 'CVSS_V4', score,
        })) }],
    })),
  }] };
  const manifest = {
    RELEASE_SHA: headSha, BUILD_ID: 'synthetic-build',
    PACKAGE_LOCK_SHA256: digest, ARTIFACT_VERIFIED: true,
  };
  const files = {
    policy: join(directory, 'policy.json'), lockfile,
    report: join(directory, 'osv-report.json'),
    productionAudit: join(directory, 'npm-audit-production.json'),
    productionTree: join(directory, 'npm-tree-production.json'),
    runtimeSbom: join(directory, 'runtime.cdx.json'),
    manifest: join(directory, 'release-manifest.json'), standalone,
  };
  const data = { policy, lock, osv, productionAudit, productionTree, runtimeSbom, manifest };
  const save = () => {
    writeFileSync(files.policy, JSON.stringify(data.policy));
    writeFileSync(files.lockfile, JSON.stringify(data.lock));
    writeFileSync(files.report, JSON.stringify(data.osv));
    writeFileSync(files.productionAudit, JSON.stringify(data.productionAudit));
    writeFileSync(files.productionTree, JSON.stringify(data.productionTree));
    writeFileSync(files.runtimeSbom, JSON.stringify(data.runtimeSbom));
    writeFileSync(files.manifest, JSON.stringify(data.manifest));
  };
  const rebindLock = () => {
    const rebound = createHash('sha256')
      .update(JSON.stringify(data.lock)).digest('hex');
    data.policy.lockfileSha256 = rebound;
    data.manifest.PACKAGE_LOCK_SHA256 = rebound;
  };
  save();
  return { directory, files, data, save, rebindLock };
}

function run(current: ReturnType<typeof fixture>, now = '2026-10-03T08:00:00Z') {
  return spawnSync(process.execPath, [validator,
    '--mode', 'current-osv', '--policy', current.files.policy,
    '--current-sha', headSha, '--now', now,
    '--report', current.files.report,
    '--lockfile', current.files.lockfile,
    '--production-audit', current.files.productionAudit,
    '--production-tree', current.files.productionTree,
    '--runtime-sbom', current.files.runtimeSbom,
    '--artifact-root', current.files.standalone,
    '--artifact-manifest', current.files.manifest,
  ], { cwd: root, encoding: 'utf8' });
}

function runClean(report: string) {
  return spawnSync(process.execPath, [validator,
    '--mode', 'clean-osv', '--report', report,
  ], { cwd: root, encoding: 'utf8' });
}

function fullAuditFixture(current: ReturnType<typeof fixture>) {
  return {
    auditReportVersion: 2,
    metadata: { vulnerabilities: {
      info: 0, low: 0, moderate: 0, high: 2, critical: 0, total: 2,
    } },
    vulnerabilities: {
      braces: { name: 'braces', severity: 'high', via: [{
        name: 'braces', dependency: 'braces', severity: 'high',
        url: 'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm',
        range: '<=3.0.3', cvss: { score: 7.5,
          vectorString: current.data.policy.advisories[0].cvssVectors[0] },
      }], nodes: ['node_modules/braces'] },
      micromatch: { name: 'micromatch', severity: 'high', via: ['braces'],
        nodes: ['node_modules/micromatch'] },
    },
  };
}

function runFullAudit(current: ReturnType<typeof fixture>, report: object) {
  const path = join(current.directory, 'npm-audit-full.json');
  writeFileSync(path, JSON.stringify(report));
  return spawnSync(process.execPath, [validator,
    '--mode', 'current-npm-audit', '--policy', current.files.policy,
    '--current-sha', headSha, '--now', '2026-10-03T08:00:00Z',
    '--report', path, '--lockfile', current.files.lockfile,
  ], { cwd: root, encoding: 'utf8' });
}

describe('full npm audit transitive exception', () => {
  it('allows only dev-only transitive impacts of the exact single root advisory', () => {
    const current = fixture();
    try {
      expect(runFullAudit(current, fullAuditFixture(current)).status).toBe(0);
    } finally { rmSync(current.directory, { recursive: true, force: true }); }
  });

  for (const [name, mutate] of [
    ['new root advisory', (audit: any) => {
      audit.vulnerabilities.micromatch.via = [{ name: 'micromatch',
        url: 'https://github.com/advisories/GHSA-other', severity: 'high' }];
    }],
    ['production-marked node', (audit: any) => {
      audit.vulnerabilities.micromatch.nodes = ['node_modules/next'];
    }],
    ['mismatched dev-only node path', (audit: any) => {
      audit.vulnerabilities.micromatch.nodes = ['node_modules/braces'];
    }],
    ['critical severity', (audit: any) => {
      audit.vulnerabilities.braces.severity = 'critical';
    }],
    ['critical CVSS score despite HIGH label', (audit: any) => {
      audit.vulnerabilities.braces.via[0].cvss.score = 9.8;
    }],
    ['dangling via', (audit: any) => {
      audit.vulnerabilities.micromatch.via = ['missing-package'];
    }],
    ['resurrected advisory already fixed upstream (http-cache-semantics)', (audit: any) => {
      audit.vulnerabilities['http-cache-semantics'] = {
        name: 'http-cache-semantics', severity: 'high', via: [{
          name: 'http-cache-semantics', dependency: 'http-cache-semantics', severity: 'high',
          url: 'https://github.com/advisories/GHSA-ch52-4w7c-c8xp',
          range: '<=4.2.0', cvss: { score: 7.5,
            vectorString: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N' },
        }], nodes: ['node_modules/http-cache-semantics'] };
      audit.metadata.vulnerabilities.high = 3;
      audit.metadata.vulnerabilities.total = 3;
    }],
    ['truncated transitive impacts with coherent counters', (audit: any) => {
      delete audit.vulnerabilities.micromatch;
      audit.metadata.vulnerabilities.high = 1;
      audit.metadata.vulnerabilities.total = 1;
    }],
  ] as const) {
    it(`refuses ${name}`, () => {
      const current = fixture();
      try {
        const audit = fullAuditFixture(current);
        mutate(audit);
        expect(runFullAudit(current, audit).status).not.toBe(0);
      } finally { rmSync(current.directory, { recursive: true, force: true }); }
    });
  }
});

describe('clean OSV report proof', () => {
  it('accepts a well-formed report with zero findings', () => {
    const current = fixture();
    try {
      writeFileSync(current.files.report, JSON.stringify({ results: [] }));
      const result = runClean(current.files.report);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('OSV_CLEAN_REPORT_VALID');
    } finally {
      rmSync(current.directory, { recursive: true, force: true });
    }
  });

  it('rejects a missing report despite scanner exit zero', () => {
    const current = fixture();
    try {
      rmSync(current.files.report);
      const result = runClean(current.files.report);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('OSV_REPORT_INVALID');
    } finally {
      rmSync(current.directory, { recursive: true, force: true });
    }
  });

  it('rejects a reported vulnerability despite scanner exit zero', () => {
    const current = fixture();
    try {
      const result = runClean(current.files.report);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('OSV_NOT_CLEAN');
    } finally {
      rmSync(current.directory, { recursive: true, force: true });
    }
  });
});

describe('exact temporary OSV development-tooling exception', () => {
  it('accepts only the exact single advisory with three independent runtime absence proofs', () => {
    const current = fixture();
    try {
      const result = run(current);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('CURRENT_OSV_EXCEPTION_VALID');
    } finally {
      rmSync(current.directory, { recursive: true, force: true });
    }
  });

  it('refuses an empty production tree as insufficient absence evidence', () => {
    const current = fixture();
    try {
      current.data.productionTree.dependencies = {};
      current.save();
      const result = run(current);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('PRODUCTION_TREE_INVALID');
    } finally {
      rmSync(current.directory, { recursive: true, force: true });
    }
  });

  const refusals: Array<{
    name: string;
    mutate: (current: ReturnType<typeof fixture>) => void;
    code: string;
  }> = [
    {
      name: 'new OSV advisory', code: 'ADDITIONAL_ADVISORY',
      mutate: ({ data }) => { data.osv.results[0].packages.push({
        package: { name: 'other-package', version: '1.0.0', ecosystem: 'npm' },
        vulnerabilities: [{ id: 'GHSA-xxxx-yyyy-zzzz',
          database_specific: { severity: 'HIGH' }, severity: [] }],
      }); },
    },
    {
      name: 'partially failed OSV scan with expected findings', code: 'OSV_REPORT_INVALID',
      mutate: ({ data }) => {
        (data.osv as typeof data.osv & { error: string }).error = 'partial scan';
      },
    },
    {
      name: 'severity escalated to CRITICAL', code: 'SEVERITY_ESCALATED',
      mutate: ({ data }) => {
        data.osv.results[0].packages[0].vulnerabilities[0]
          .database_specific.severity = 'CRITICAL';
      },
    },
    {
      name: 'changed CVSS vector despite unchanged advisory severity',
      code: 'SEVERITY_ESCALATED',
      mutate: ({ data }) => {
        data.osv.results[0].packages[0].vulnerabilities[0]
          .severity[0].score = 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H';
      },
    },
    {
      name: 'changed advisory package version', code: 'ADDITIONAL_ADVISORY',
      mutate: ({ data }) => {
        data.osv.results[0].packages[0].package.version = '3.0.4';
      },
    },
    {
      name: 'changed lockfile package version', code: 'PACKAGE_VERSION_CHANGED',
      mutate: (current) => {
        current.data.lock.packages['node_modules/braces'].version = '3.0.4';
        current.rebindLock();
      },
    },
    {
      name: 'production-marked lockfile package', code: 'PRODUCTION_DEPENDENCY',
      mutate: (current) => {
        current.data.lock.packages['node_modules/braces'].dev = false;
        current.rebindLock();
      },
    },
    {
      name: 'changed dependency parent path', code: 'DEPENDENCY_PATH_CHANGED',
      mutate: (current) => {
        current.data.lock.packages['node_modules/micromatch'].dependencies.braces = '';
        current.rebindLock();
      },
    },
    {
      name: 'package in production npm tree', code: 'PRODUCTION_DEPENDENCY',
      mutate: ({ data }) => {
        data.productionTree.dependencies.braces = { name: 'braces', version: '3.0.3' };
      },
    },
    {
      name: 'package in runtime SBOM', code: 'RUNTIME_PRESENCE',
      mutate: ({ data }) => {
        data.runtimeSbom.components.push({ type: 'library', name: 'braces', version: '3.0.3' });
      },
    },
    {
      name: 'package nested in runtime SBOM metadata', code: 'RUNTIME_PRESENCE',
      mutate: ({ data }) => {
        (data.runtimeSbom as typeof data.runtimeSbom & {
          metadata: { component: { name: string; version: string } };
        }).metadata = { component: { name: 'braces', version: '3.0.3' } };
      },
    },
    {
      name: 'package physically present in standalone', code: 'RUNTIME_PRESENCE',
      mutate: ({ files }) => {
        mkdirSync(join(files.standalone, 'node_modules/braces'), { recursive: true });
      },
    },
    {
      name: 'OSV report resurrecting the fixed http-cache-semantics advisory',
      code: 'ADDITIONAL_ADVISORY',
      mutate: ({ data }) => { data.osv.results[0].packages.push({
        package: { name: 'http-cache-semantics', version: '4.2.0', ecosystem: 'npm' },
        vulnerabilities: [{ id: 'GHSA-ch52-4w7c-c8xp',
          database_specific: { severity: 'HIGH' }, severity: [] }],
      }); },
    },
    {
      name: 'artifact built for another SHA', code: 'ARTIFACT_PROVENANCE_MISMATCH',
      mutate: ({ data }) => { data.manifest.RELEASE_SHA = 'b'.repeat(40); },
    },
    {
      name: 'altered artifact BUILD_ID', code: 'ARTIFACT_PROVENANCE_MISMATCH',
      mutate: ({ data }) => { data.manifest.BUILD_ID = 'other-build'; },
    },
  ];

  for (const testCase of refusals) {
    it(`refuses ${testCase.name}`, () => {
      const current = fixture();
      try {
        testCase.mutate(current);
        current.save();
        const result = run(current);
        expect(result.status).not.toBe(0);
        expect(result.stderr).toContain(testCase.code);
      } finally {
        rmSync(current.directory, { recursive: true, force: true });
      }
    });
  }

  it('refuses an expired exception even when every runtime proof remains clean', () => {
    const current = fixture();
    try {
      const result = run(current, '2026-10-10T00:00:00Z');
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('EXCEPTION_EXPIRED');
    } finally {
      rmSync(current.directory, { recursive: true, force: true });
    }
  });

  it('refuses a missing standalone with a stable evidence error', () => {
    const current = fixture();
    try {
      rmSync(join(current.files.standalone, 'server.js'));
      const result = run(current);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('ARTIFACT_MISSING');
    } finally {
      rmSync(current.directory, { recursive: true, force: true });
    }
  });
});
