import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join, sep } from 'node:path';

const REQUIRED_REPOSITORY = 'cyranoaladin/nexus-project_v0';
const ABSOLUTE_EXPIRY = Date.parse('2026-10-10T00:00:00Z');
const MAX_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const REQUIRED_REVOCATIONS = [
  'NEW_ADVISORY', 'RUNTIME_PRESENCE', 'PRODUCTION_DEPENDENCY',
  'DEPENDENCY_PATH_CHANGED', 'SEVERITY_ESCALATED',
  'COMPENSATING_CONTROL_FAILED', 'EXCEPTION_EXPIRED',
];
const REQUIRED_FINDINGS = [
  {
    id: 'GHSA-vfj7-8cjw-p6xm', package: 'braces', version: '3.0.3',
    severity: 'HIGH', lockPaths: ['node_modules/braces'],
    parentPaths: ['node_modules/micromatch'],
    cvssVectors: [
      'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H',
      'CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:N/VI:N/VA:H/SC:N/SI:N/SA:N',
    ],
  },
];

function assert(condition, code) {
  if (!condition) throw new Error(code);
}

function exactKeys(value, expected, code) {
  assert(value && typeof value === 'object' && !Array.isArray(value), code);
  const actual = Object.keys(value).sort();
  assert(JSON.stringify(actual) === JSON.stringify([...expected].sort()), code);
}

function sameValues(actual, expected) {
  return Array.isArray(actual) && actual.length === expected.length &&
    JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort());
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function readJson(path, code) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    throw new Error(code);
  }
}

function validatePolicy(policy, nowText) {
  exactKeys(policy, [
    'schemaVersion', 'policyId', 'repository', 'decision', 'approvedAt',
    'expiresAt', 'maximumExpiry', 'maximumDurationDays', 'lockfileSha256',
    'fullAuditImpactedPackageCount', 'fullAuditImpactSha256',
    'remediationIssue', 'advisories', 'revocationConditions',
  ], 'POLICY_SCHEMA_INVALID');
  assert(policy.schemaVersion === '2.0.0', 'POLICY_SCHEMA_INVALID');
  assert(policy.policyId === '2026-10-03-exact-osv-dev-tooling', 'POLICY_ID_CHANGED');
  assert(policy.repository === REQUIRED_REPOSITORY, 'POLICY_REPOSITORY_CHANGED');
  assert(policy.decision === 'TEMPORARY_DEV_TOOLING_EXCEPTION', 'POLICY_DECISION_INVALID');
  assert(policy.maximumExpiry === '2026-10-10T00:00:00Z', 'EXCEPTION_DURATION_INVALID');
  assert(policy.maximumDurationDays === 7, 'EXCEPTION_DURATION_INVALID');
  assert(/^https:\/\/github\.com\/cyranoaladin\/nexus-project_v0\/issues\/[1-9]\d*$/.test(policy.remediationIssue), 'REMEDIATION_ISSUE_MISSING');
  assert(sameValues(policy.revocationConditions, REQUIRED_REVOCATIONS), 'REVOCATION_CONDITIONS_CHANGED');

  const approvedAt = Date.parse(policy.approvedAt);
  const expiresAt = Date.parse(policy.expiresAt);
  const now = Date.parse(nowText);
  assert([approvedAt, expiresAt, now].every(Number.isFinite), 'EXCEPTION_DATE_INVALID');
  assert(approvedAt <= now && now < expiresAt, 'EXCEPTION_EXPIRED');
  assert(expiresAt > approvedAt && expiresAt - approvedAt <= MAX_DURATION_MS &&
    expiresAt <= ABSOLUTE_EXPIRY, 'EXCEPTION_DURATION_INVALID');
  assert(/^[0-9a-f]{64}$/.test(policy.lockfileSha256), 'LOCKFILE_DIGEST_INVALID');
  assert(Number.isSafeInteger(policy.fullAuditImpactedPackageCount) &&
    policy.fullAuditImpactedPackageCount > 0 &&
    /^[0-9a-f]{64}$/.test(policy.fullAuditImpactSha256), 'AUDIT_IMPACT_POLICY_INVALID');
  assert(Array.isArray(policy.advisories) && policy.advisories.length === REQUIRED_FINDINGS.length, 'ADDITIONAL_ADVISORY');
  for (const expected of REQUIRED_FINDINGS) {
    const matching = policy.advisories.filter((entry) => entry?.id === expected.id);
    assert(matching.length === 1, 'ADDITIONAL_ADVISORY');
    const entry = matching[0];
    exactKeys(entry, [
      'id', 'package', 'version', 'severity', 'cvssVectors',
      'lockPaths', 'parentPaths', 'integrity',
    ], 'POLICY_SCHEMA_INVALID');
    for (const field of ['package', 'version', 'severity']) {
      assert(entry[field] === expected[field], 'ADDITIONAL_ADVISORY');
    }
    assert(sameValues(entry.lockPaths, expected.lockPaths), 'DEPENDENCY_PATH_CHANGED');
    assert(sameValues(entry.parentPaths, expected.parentPaths), 'DEPENDENCY_PATH_CHANGED');
    assert(sameValues(entry.cvssVectors, expected.cvssVectors), 'SEVERITY_ESCALATED');
    assert(typeof entry.integrity === 'string' && entry.integrity.startsWith('sha512-'), 'PACKAGE_INTEGRITY_CHANGED');
  }
}

function validateOsvReport(report, policy) {
  assert(Array.isArray(report?.results) && report.results.length > 0 &&
    !report.error && (!report.errors ||
      (Array.isArray(report.errors) && report.errors.length === 0)), 'OSV_REPORT_INVALID');
  const findings = [];
  for (const result of report.results) {
    assert(result?.source?.type === 'lockfile' &&
      basename(result.source.path ?? '') === 'package-lock.json' &&
      Array.isArray(result.packages), 'OSV_REPORT_INVALID');
    for (const packageResult of result.packages) {
      const pkg = packageResult?.package;
      assert(pkg?.ecosystem === 'npm' && typeof pkg.name === 'string' &&
        typeof pkg.version === 'string' &&
        Array.isArray(packageResult.vulnerabilities), 'OSV_REPORT_INVALID');
      for (const vulnerability of packageResult.vulnerabilities) {
        assert(typeof vulnerability?.id === 'string' &&
          Array.isArray(vulnerability.aliases ?? []), 'OSV_REPORT_INVALID');
        assert(vulnerability.database_specific?.severity === 'HIGH', 'SEVERITY_ESCALATED');
        const expectedAdvisory = policy.advisories.find((entry) => entry.id === vulnerability.id);
        assert(expectedAdvisory, 'ADDITIONAL_ADVISORY');
        assert(Array.isArray(vulnerability.severity) &&
          vulnerability.severity.length === 2 &&
          vulnerability.severity.every((item) =>
            item?.type === (item.score?.startsWith('CVSS:3.1/') ? 'CVSS_V3' : 'CVSS_V4')) &&
          sameValues(vulnerability.severity.map((item) => item.score),
            expectedAdvisory.cvssVectors), 'SEVERITY_ESCALATED');
        assert(!(vulnerability.aliases ?? []).some((alias) =>
          alias.startsWith('GHSA-') && alias !== vulnerability.id), 'ADDITIONAL_ADVISORY');
        findings.push({ id: vulnerability.id, package: pkg.name, version: pkg.version });
      }
    }
  }
  const expected = policy.advisories.map(({ id, package: pkg, version }) =>
    `${id}:${pkg}@${version}`);
  const actual = findings.map(({ id, package: pkg, version }) =>
    `${id}:${pkg}@${version}`);
  assert(sameValues(actual, expected), 'ADDITIONAL_ADVISORY');
}

export function validateCleanOsvReport(report) {
  assert(Array.isArray(report?.results) && !report.error &&
    (!report.errors || (Array.isArray(report.errors) && report.errors.length === 0)),
  'OSV_REPORT_INVALID');
  for (const result of report.results) {
    assert(Array.isArray(result?.packages), 'OSV_REPORT_INVALID');
    for (const packageResult of result.packages) {
      assert(Array.isArray(packageResult?.vulnerabilities), 'OSV_REPORT_INVALID');
      assert(packageResult.vulnerabilities.length === 0, 'OSV_NOT_CLEAN');
    }
  }
}

function validateLockfile(lock, policy) {
  assert(lock?.lockfileVersion === 3 && lock.packages &&
    typeof lock.packages === 'object', 'LOCKFILE_INVALID');
  for (const advisory of policy.advisories) {
    const physicalPaths = Object.keys(lock.packages).filter((path) =>
      path === `node_modules/${advisory.package}` ||
      path.endsWith(`/node_modules/${advisory.package}`));
    assert(sameValues(physicalPaths, advisory.lockPaths), 'DEPENDENCY_PATH_CHANGED');
    for (const path of advisory.lockPaths) {
      const entry = lock.packages[path];
      assert(entry?.version === advisory.version, 'PACKAGE_VERSION_CHANGED');
      assert(entry?.integrity === advisory.integrity, 'PACKAGE_INTEGRITY_CHANGED');
      assert(entry?.dev === true, 'PRODUCTION_DEPENDENCY');
    }
    const parentPaths = Object.entries(lock.packages)
      .filter(([, entry]) => ['dependencies', 'devDependencies', 'optionalDependencies']
        .some((field) => entry?.[field]?.[advisory.package]))
      .map(([path]) => path);
    assert(sameValues(parentPaths, advisory.parentPaths), 'DEPENDENCY_PATH_CHANGED');
    for (const path of parentPaths) {
      assert(lock.packages[path]?.dev === true, 'PRODUCTION_DEPENDENCY');
    }
  }
}

function containsPackageInTree(node, packageName) {
  if (!node || typeof node !== 'object') return false;
  if (node.name === packageName) return true;
  for (const [name, dependency] of Object.entries(node.dependencies ?? {})) {
    if (name === packageName || containsPackageInTree(dependency, packageName)) return true;
  }
  return false;
}

function validateProductionTree(tree, packageNames) {
  assert(tree?.name === 'nexus-reussite-app' &&
    tree.dependencies && typeof tree.dependencies === 'object' &&
    !Array.isArray(tree.dependencies) &&
    Object.keys(tree.dependencies).length > 0, 'PRODUCTION_TREE_INVALID');
  // The same CI job validates all npm tree anomalies against its separately
  // versioned, exact exception list before publishing this production view.
  // Optional packages can be marked extraneous without being OSV packages.
  for (const packageName of packageNames) {
    assert(!containsPackageInTree(tree, packageName), 'PRODUCTION_DEPENDENCY');
  }
}

function validateProductionAudit(audit) {
  const counts = audit?.metadata?.vulnerabilities;
  assert(audit?.auditReportVersion === 2 && counts &&
    ['info', 'low', 'moderate', 'high', 'critical', 'total'].every((key) =>
      counts[key] === 0) &&
    Object.keys(audit.vulnerabilities ?? {}).length === 0,
  'PRODUCTION_AUDIT_NOT_GREEN');
}

export function validateCurrentNpmAudit(args, policy) {
  for (const key of ['current-sha', 'now', 'report', 'lockfile']) {
    assert(typeof args[key] === 'string' && args[key].length > 0, 'INVALID_ARGUMENTS');
  }
  assert(/^[0-9a-f]{40}$/.test(args['current-sha']), 'INVALID_HEAD_SHA');
  validatePolicy(policy, args.now);
  assert(sha256(args.lockfile) === policy.lockfileSha256, 'LOCKFILE_DIGEST_CHANGED');
  const lock = readJson(args.lockfile, 'LOCKFILE_INVALID');
  const audit = readJson(args.report, 'AUDIT_REPORT_INVALID');
  validateLockfile(lock, policy);
  const findings = audit?.vulnerabilities;
  const counts = audit?.metadata?.vulnerabilities;
  assert(audit?.auditReportVersion === 2 && findings &&
    typeof findings === 'object' && !Array.isArray(findings) &&
    !audit.error && (!audit.errors ||
      (Array.isArray(audit.errors) && audit.errors.length === 0)) &&
    Object.keys(findings).length > 0 && counts &&
    ['info', 'low', 'moderate', 'critical'].every((level) => counts[level] === 0) &&
    counts.high === Object.keys(findings).length &&
    counts.total === counts.high, 'AUDIT_REPORT_INVALID');
  const impacts = Object.entries(findings)
    .map(([name, item]) => [name, [...(item?.nodes ?? [])].sort()])
    .sort(([left], [right]) => left.localeCompare(right));
  const impactDigest = createHash('sha256')
    .update(JSON.stringify(impacts)).digest('hex');
  assert(Object.keys(findings).length === policy.fullAuditImpactedPackageCount &&
    impactDigest === policy.fullAuditImpactSha256, 'AUDIT_IMPACT_SET_CHANGED');

  const directFound = new Set();
  const checked = new Set();
  function visit(name, stack = new Set()) {
    assert(!stack.has(name), 'AUDIT_VIA_CYCLE');
    if (checked.has(name)) return;
    const item = findings[name];
    assert(item?.name === name && item.severity === 'high' &&
      Array.isArray(item.via) && item.via.length > 0 &&
      Array.isArray(item.nodes) && item.nodes.length > 0,
    'AUDIT_UNEXPECTED_FINDING');
    for (const path of item.nodes) {
      assert(typeof path === 'string' &&
        (path === `node_modules/${name}` || path.endsWith(`/node_modules/${name}`)) &&
        lock.packages[path]?.dev === true, 'PRODUCTION_DEPENDENCY');
    }
    const nextStack = new Set(stack);
    nextStack.add(name);
    for (const via of item.via) {
      if (typeof via === 'string') {
        visit(via, nextStack);
      } else {
        const expected = policy.advisories.find((entry) => entry.package === name);
        assert(expected && via?.name === expected.package &&
          via.dependency === expected.package &&
          via.url === `https://github.com/advisories/${expected.id}` &&
          via.severity === 'high' && via.range === `<=${expected.version}` &&
          via.cvss?.vectorString === expected.cvssVectors[0] &&
          via.cvss?.score === 7.5,
        'AUDIT_UNEXPECTED_FINDING');
        directFound.add(expected.id);
      }
    }
    checked.add(name);
  }
  for (const name of Object.keys(findings)) visit(name);
  assert(sameValues([...directFound], policy.advisories.map((entry) => entry.id)),
    'AUDIT_ADVISORY_MISSING');
  return { advisoryIds: [...directFound].sort(), impactedPackages: checked.size };
}

function validateRuntimeSbom(sbom, packageNames) {
  assert(sbom?.bomFormat === 'CycloneDX' && sbom.specVersion === '1.6' &&
    Array.isArray(sbom.components) && sbom.components.length > 0,
  'RUNTIME_SBOM_INVALID');
  const components = [...sbom.components];
  if (sbom.metadata?.component) components.push(sbom.metadata.component);
  while (components.length > 0) {
    const component = components.pop();
    assert(component && typeof component === 'object', 'RUNTIME_SBOM_INVALID');
    for (const packageName of packageNames) {
      assert(component.name !== packageName &&
        !component.purl?.includes(`/${packageName}@`) &&
        !component['bom-ref']?.includes(`/${packageName}@`), 'RUNTIME_PRESENCE');
    }
    if (component.components !== undefined) {
      assert(Array.isArray(component.components), 'RUNTIME_SBOM_INVALID');
      components.push(...component.components);
    }
  }
  for (const edge of sbom.dependencies ?? []) {
    for (const packageName of packageNames) {
      assert(!edge.ref?.includes(`/${packageName}@`) &&
        !(edge.dependsOn ?? []).some((ref) => ref.includes(`/${packageName}@`)),
      'RUNTIME_PRESENCE');
    }
  }
}

function validateStandalone(root, packageNames) {
  for (const required of ['server.js', '.next/BUILD_ID']) {
    let stats;
    try {
      stats = lstatSync(join(root, required));
    } catch {
      throw new Error('ARTIFACT_MISSING');
    }
    assert(stats.isFile(), 'ARTIFACT_MISSING');
  }
  const directories = [root];
  while (directories.length > 0) {
    const directory = directories.pop();
    for (const entry of readdirSync(directory)) {
      const path = join(directory, entry);
      const stat = lstatSync(path);
      assert(!stat.isSymbolicLink(), 'ARTIFACT_SYMLINK_UNSUPPORTED');
      const parts = path.slice(root.length).split(sep);
      if (parts.includes('node_modules') && packageNames.includes(entry)) {
        throw new Error('RUNTIME_PRESENCE');
      }
      if (stat.isDirectory()) directories.push(path);
    }
  }
}

export function validateCurrentException(args, policy) {
  for (const key of [
    'current-sha', 'now', 'report', 'lockfile', 'production-audit',
    'production-tree', 'runtime-sbom', 'artifact-root', 'artifact-manifest',
  ]) {
    assert(typeof args[key] === 'string' && args[key].length > 0, 'INVALID_ARGUMENTS');
  }
  assert(/^[0-9a-f]{40}$/.test(args['current-sha']), 'INVALID_HEAD_SHA');
  validatePolicy(policy, args.now);
  assert(sha256(args.lockfile) === policy.lockfileSha256, 'LOCKFILE_DIGEST_CHANGED');

  const lock = readJson(args.lockfile, 'LOCKFILE_INVALID');
  const osv = readJson(args.report, 'OSV_REPORT_INVALID');
  const productionAudit = readJson(args['production-audit'], 'PRODUCTION_AUDIT_INVALID');
  const productionTree = readJson(args['production-tree'], 'PRODUCTION_TREE_INVALID');
  const runtimeSbom = readJson(args['runtime-sbom'], 'RUNTIME_SBOM_INVALID');
  const manifest = readJson(args['artifact-manifest'], 'ARTIFACT_MANIFEST_INVALID');
  const packageNames = policy.advisories.map((entry) => entry.package);

  validateLockfile(lock, policy);
  validateOsvReport(osv, policy);
  validateProductionAudit(productionAudit);
  validateProductionTree(productionTree, packageNames);
  validateRuntimeSbom(runtimeSbom, packageNames);
  assert(manifest.RELEASE_SHA === args['current-sha'] &&
    manifest.PACKAGE_LOCK_SHA256 === policy.lockfileSha256 &&
    manifest.ARTIFACT_VERIFIED === true &&
    typeof manifest.BUILD_ID === 'string' && manifest.BUILD_ID.length > 0,
  'ARTIFACT_PROVENANCE_MISMATCH');
  validateStandalone(args['artifact-root'], packageNames);
  assert(readFileSync(join(args['artifact-root'], '.next/BUILD_ID'), 'utf8').trim() ===
    manifest.BUILD_ID, 'ARTIFACT_PROVENANCE_MISMATCH');
  return { advisoryIds: policy.advisories.map((entry) => entry.id).sort(),
    lockfileSha256: policy.lockfileSha256 };
}
