#!/usr/bin/env node

import {
  RUNTIME_COMPONENT_SET_SCHEMA,
  runtimeGraphDigest,
} from './runtime-sbom-digest.mjs';

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const EXPECTED_ADVISORY = 'GHSA-mh99-v99m-4gvg';
const EXPECTED_CVE = 'CVE-2026-14257';
const EXPECTED_PACKAGE = 'brace-expansion';
const EXPECTED_LOCK_SHA256 = 'c257141643ae551d6a286771dd4f9855964297b010593b1067d7e4bafcb9644f';
const EXPECTED_RUNTIME_GRAPH_DIGEST =
  '427e5577f280de60c27ab770c97d9dc5e46575a099934648ecd01a771eb8edff';
const EXPECTED_VALIDATOR = 'scripts/security/validate-brace-expansion-attestation.mjs';
const EXPECTED_OSV_SOURCE = 'https://api.osv.dev/v1/vulns/GHSA-mh99-v99m-4gvg';
const EXPECTED_OSV_MODIFIED = '2026-07-25T21:44:41.250545099Z';

const EXPECTED_PACKAGES = [
  {
    collection: 'backportedPackages',
    path: 'node_modules/brace-expansion',
    version: '1.1.18',
    integrity: 'sha512-Edep/X9fGqVNmzKBVsDYIOtD+z1tuezV70LBjdCst9Tqu76lsnvRiZ6oTic1n+/BIwX6QDGAO94PN4N2SADvtw==',
    sourcePath: 'node_modules/brace-expansion/index.js',
    sourceDigest: '1bb0239fdd42bc5c9778007575ecb2cbf23daa4512a82866f4c997dbd82345ef',
    sourceCommit: '27fbeed22b4fdf2c5f732f66bcf84d43f4a26c6e',
    fixCommits: [
      'cb4b9e47cc2ec777c14b2b4492fb431a56f6a031',
      '27fbeed22b4fdf2c5f732f66bcf84d43f4a26c6e',
    ],
  },
  {
    collection: 'backportedPackages',
    path: 'node_modules/cacache/node_modules/brace-expansion',
    version: '2.1.4',
    integrity: 'sha512-hGfVzPxthbf3+2yjg/RBs60cB0FhqBS/zvdV/4wn4/BmN0bNMMHPc4V/BbFieqf1TKAGGAHnY4eSjajCl0f2Xg==',
    sourcePath: 'node_modules/cacache/node_modules/brace-expansion/index.js',
    sourceDigest: 'b95a8e5575f0214261cd4e4b79028a9dd7c9814ea22671b6266d76de262da6b2',
    sourceCommit: 'b25213dff0446d622f97d736420b9830ee1abc32',
    fixCommits: [
      'd13ff455a58b0d56704f0111e3c2a0b16ceb06eb',
      '1e30c930238d7162802d88a94189182def178dac',
    ],
  },
  {
    collection: 'scannerRecognizedPackages',
    path: 'node_modules/@typescript-eslint/typescript-estree/node_modules/brace-expansion',
    version: '5.0.9',
    integrity: 'sha512-ScQ4IuvIEF1TMlP7Zt+vjJ//9zlPb2SDcxWxM3bk8s6t6GGdJ7KO1dCcTidOPJKePW30LE/2cT7wCyPho9/Wxg==',
    sourcePath: 'node_modules/@typescript-eslint/typescript-estree/node_modules/brace-expansion/dist/commonjs/index.js',
    sourceDigest: '8d1ea713e1dd03f52783bbceea9d85815a3587134d1936ea16257dea83884f15',
    sourceCommit: 'fbcf8ec75b88c79374b4aac06559b1a5288a1223',
    fixCommits: [
      'a1bd33999ea75262c4749fff3bbb0d1372bd07b5',
      '688a99eeaab02627c2b89ba8ba4821fecfa659cf',
    ],
  },
];

const EXPECTED_REVOCATIONS = [
  'LOCKFILE_DIGEST_CHANGED',
  'PACKAGE_VERSION_CHANGED',
  'PACKAGE_INTEGRITY_CHANGED',
  'DEPENDENCY_PATH_CHANGED',
  'RUNTIME_GRAPH_DIGEST_CHANGED',
  'RUNTIME_EXPOSURE_DETECTED',
  'ADDITIONAL_ADVISORY_DETECTED',
  'UPSTREAM_BACKPORT_RETRACTED',
  'UPSTREAM_SOURCE_DIGEST_CHANGED',
  'SCANNER_FINDING_SET_CHANGED',
  'SCANNER_METADATA_SOURCE_CHANGED',
  'SCANNER_METADATA_CORRECTED',
  'EXPIRY_REACHED',
];

function fail(code, details = '') {
  process.stderr.write(`${code}${details ? `: ${details}` : ''}\n`);
  process.exit(1);
}

function parseArguments(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || value === undefined) fail('INVALID_ARGUMENTS');
    args[key.slice(2)] = value;
  }
  return args;
}

function repositoryPath(path) {
  const absolute = resolve(repositoryRoot, path);
  if (absolute !== repositoryRoot && !absolute.startsWith(`${repositoryRoot}${sep}`)) {
    fail('PATH_OUTSIDE_REPOSITORY', path);
  }
  return absolute;
}

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    fail('INVALID_JSON', label);
  }
}

function sha256(path) {
  if (!existsSync(path)) fail('ARTIFACT_MISSING', path);
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function sorted(values) {
  return [...values].sort();
}

function equalSets(left, right) {
  return JSON.stringify(sorted(new Set(left))) === JSON.stringify(sorted(new Set(right)));
}

function requireEqual(actual, expected, code) {
  if (actual !== expected) fail(code, `expected=${expected} actual=${actual}`);
}

function containsPackage(value, packageName) {
  if (!value || typeof value !== 'object') return false;
  if (
    value.name === packageName ||
    value['bom-ref']?.includes(`/${packageName}@`) ||
    value.purl?.includes(`/${packageName}@`)
  ) return true;
  return Object.values(value).some((child) =>
    Array.isArray(child)
      ? child.some((entry) => containsPackage(entry, packageName))
      : containsPackage(child, packageName));
}

function validateAttestation(attestation, lock, lockfilePath, nowText) {
  requireEqual(attestation.status, 'ACTIVE', 'ATTESTATION_NOT_ACTIVE');
  requireEqual(attestation.activation?.wiredIntoCi, true, 'ATTESTATION_NOT_WIRED');
  requireEqual(attestation.activation?.validator, EXPECTED_VALIDATOR, 'VALIDATOR_MISMATCH');
  requireEqual(attestation.activation?.approvalRequired, true, 'APPROVAL_GUARD_MISSING');
  if (!attestation.activation?.approvalReference) fail('APPROVAL_REFERENCE_MISSING');

  requireEqual(attestation.advisory?.id, EXPECTED_ADVISORY, 'ADVISORY_MISMATCH');
  requireEqual(attestation.advisory?.cve, EXPECTED_CVE, 'CVE_MISMATCH');
  requireEqual(attestation.advisory?.scannerFirstPatchedVersion, '5.0.8', 'PATCH_FLOOR_MISMATCH');
  requireEqual(attestation.advisory?.scannerMetadataModifiedAt, EXPECTED_OSV_MODIFIED, 'SCANNER_METADATA_CHANGED');
  requireEqual(attestation.advisory?.scannerMetadataSource?.url, EXPECTED_OSV_SOURCE, 'SCANNER_METADATA_SOURCE_CHANGED');
  requireEqual(attestation.advisory?.scannerMetadataSource?.field, 'modified', 'SCANNER_METADATA_SOURCE_CHANGED');
  requireEqual(attestation.advisory?.scannerMetadataSource?.observedValue, EXPECTED_OSV_MODIFIED, 'SCANNER_METADATA_CHANGED');

  requireEqual(attestation.lockfileEvidence?.digest, EXPECTED_LOCK_SHA256, 'LOCKFILE_DIGEST_CHANGED');
  requireEqual(attestation.lockfileEvidence?.verification?.digestBeforeInstall, EXPECTED_LOCK_SHA256, 'LOCKFILE_DIGEST_CHANGED');
  requireEqual(attestation.lockfileEvidence?.verification?.digestAfterInstall, EXPECTED_LOCK_SHA256, 'LOCKFILE_DIGEST_CHANGED');
  requireEqual(attestation.lockfileEvidence?.verification?.unchanged, true, 'LOCKFILE_DIGEST_CHANGED');
  requireEqual(sha256(lockfilePath), EXPECTED_LOCK_SHA256, 'LOCKFILE_DIGEST_CHANGED');

  const bracePaths = Object.keys(lock.packages ?? {}).filter((path) =>
    path === 'node_modules/brace-expansion' || path.endsWith('/node_modules/brace-expansion'));
  if (!equalSets(bracePaths, EXPECTED_PACKAGES.map((entry) => entry.path))) {
    fail('NPM_TREE_CHANGED', bracePaths.join(','));
  }

  requireEqual(attestation.backportedPackages?.length, 2, 'PACKAGE_EVIDENCE_CHANGED');
  requireEqual(attestation.scannerRecognizedPackages?.length, 1, 'PACKAGE_EVIDENCE_CHANGED');
  for (const expected of EXPECTED_PACKAGES) {
    const evidence = attestation[expected.collection]?.find(
      (entry) => entry.lockfilePath === expected.path,
    );
    if (!evidence) fail('PACKAGE_EVIDENCE_MISSING', expected.path);
    requireEqual(evidence.name, EXPECTED_PACKAGE, 'PACKAGE_NAME_CHANGED');
    requireEqual(evidence.installedVersion, expected.version, 'PACKAGE_VERSION_CHANGED');
    requireEqual(evidence.integrity, expected.integrity, 'PACKAGE_INTEGRITY_CHANGED');
    requireEqual(evidence.developmentOnly, true, 'RUNTIME_EXPOSURE_DETECTED');

    const locked = lock.packages[expected.path];
    if (!locked) fail('PACKAGE_MISSING_FROM_LOCK', expected.path);
    requireEqual(locked.version, expected.version, 'PACKAGE_VERSION_CHANGED');
    requireEqual(locked.integrity, expected.integrity, 'PACKAGE_INTEGRITY_CHANGED');
    requireEqual(locked.dev, true, 'RUNTIME_EXPOSURE_DETECTED');

    const commits = evidence.upstreamFixCommits?.map((entry) => entry.commit) ?? [];
    if (!equalSets(commits, expected.fixCommits)) fail('UPSTREAM_FIX_COMMITS_CHANGED', expected.path);
    requireEqual(evidence.sourceVerification?.sourceCommit, expected.sourceCommit, 'UPSTREAM_SOURCE_COMMIT_CHANGED');
    const recordedDigest = evidence.sourceVerification.installedSourceDigest
      ?? evidence.sourceVerification.installedEntrypointDigest;
    requireEqual(recordedDigest, expected.sourceDigest, 'UPSTREAM_SOURCE_DIGEST_CHANGED');
    requireEqual(sha256(repositoryPath(expected.sourcePath)), expected.sourceDigest, 'UPSTREAM_SOURCE_DIGEST_CHANGED');
  }

  requireEqual(attestation.runtimeGraphEvidence?.schema, RUNTIME_COMPONENT_SET_SCHEMA, 'RUNTIME_GRAPH_SCHEMA_CHANGED');
  requireEqual(attestation.runtimeGraphEvidence?.digestAlgorithm, 'SHA-256', 'RUNTIME_GRAPH_DIGEST_CHANGED');
  requireEqual(attestation.runtimeGraphEvidence?.digest, EXPECTED_RUNTIME_GRAPH_DIGEST, 'RUNTIME_GRAPH_DIGEST_CHANGED');
  requireEqual(attestation.runtimeGraphEvidence?.componentCount, 550, 'RUNTIME_GRAPH_CHANGED');
  requireEqual(attestation.runtimeGraphEvidence?.braceExpansionComponentCount, 0, 'RUNTIME_EXPOSURE_DETECTED');
  requireEqual(attestation.runtimeGraphEvidence?.standaloneFilePresence, 0, 'RUNTIME_EXPOSURE_DETECTED');
  requireEqual(attestation.runtimeGraphEvidence?.standaloneContentReferences, 0, 'RUNTIME_EXPOSURE_DETECTED');

  const scanner = attestation.scannerEvidence;
  requireEqual(scanner?.osvScannerVersion, '1.9.0', 'SCANNER_VERSION_CHANGED');
  requireEqual(scanner?.osvScannerBinarySha256, 'd9c1deedc23372a25049458e1e2f2bb9ad4098e2e2038118b9fec42f28f93ffb', 'SCANNER_BINARY_CHANGED');
  requireEqual(scanner?.npmAuditHighImpactCount, 0, 'SCANNER_FINDING_SET_CHANGED');
  requireEqual(scanner?.mathliveFindings, 0, 'ADDITIONAL_ADVISORY');
  requireEqual(scanner?.unexpectedAdvisoriesAllowed, false, 'ADDITIONAL_ADVISORY');
  requireEqual(scanner?.allowedResidualAdvisories?.length, 1, 'ADDITIONAL_ADVISORY');
  const allowed = scanner.allowedResidualAdvisories[0];
  requireEqual(allowed.id, EXPECTED_ADVISORY, 'ADDITIONAL_ADVISORY');
  requireEqual(allowed.package, EXPECTED_PACKAGE, 'ADDITIONAL_ADVISORY');
  if (!equalSets(allowed.aliases ?? [], [EXPECTED_CVE])) fail('ADDITIONAL_ADVISORY');
  if (!equalSets(allowed.osvReportedVersions ?? [], ['1.1.18', '2.1.4'])) fail('SCANNER_FINDING_SET_CHANGED');
  if (!equalSets(scanner.remainingPackages ?? [], ['brace-expansion@1.1.18', 'brace-expansion@2.1.4'])) {
    fail('SCANNER_FINDING_SET_CHANGED');
  }

  const created = Date.parse(`${attestation.validity?.createdOn}T00:00:00Z`);
  const expires = Date.parse(`${attestation.validity?.expiresOn}T00:00:00Z`);
  const now = Date.parse(nowText);
  if ([created, expires, now].some(Number.isNaN)) fail('ATTESTATION_DATE_INVALID');
  if (now < created || now >= expires) fail('ATTESTATION_EXPIRED');
  if (expires - created > 14 * 24 * 60 * 60 * 1000) fail('ATTESTATION_DURATION_INVALID');
  if (!equalSets(attestation.validity.revocationConditions ?? [], EXPECTED_REVOCATIONS)) {
    fail('REVOCATION_CONDITIONS_CHANGED');
  }
}

function auditMetadata(report) {
  return report?.metadata?.vulnerabilities ?? {};
}

function validateNpmReport(report, productionAudit, runtimeSbom) {
  const production = auditMetadata(productionAudit);
  if ((production.total ?? 0) !== 0) fail('PRODUCTION_AUDIT_NOT_GREEN');

  const metadata = auditMetadata(report);
  const expected = { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 };
  for (const [key, value] of Object.entries(expected)) {
    requireEqual(metadata[key], value, 'SCANNER_FINDING_SET_CHANGED');
  }
  const vulnerabilityNames = Object.keys(report.vulnerabilities ?? {});
  if (vulnerabilityNames.length !== 0) {
    fail('ADDITIONAL_ADVISORY', vulnerabilityNames.join(','));
  }

  if (containsPackage(runtimeSbom, EXPECTED_PACKAGE)) fail('RUNTIME_EXPOSURE_DETECTED');
  const runtimeGraph = runtimeGraphDigest(runtimeSbom);
  requireEqual(runtimeGraph.schema, RUNTIME_COMPONENT_SET_SCHEMA, 'RUNTIME_GRAPH_SCHEMA_CHANGED');
  requireEqual(runtimeGraph.componentCount, 550, 'RUNTIME_GRAPH_CHANGED');
  requireEqual(runtimeGraph.digest, EXPECTED_RUNTIME_GRAPH_DIGEST, 'RUNTIME_GRAPH_DIGEST_CHANGED');
}

function validateOsvReport(report) {
  const findings = [];
  for (const result of report.results ?? []) {
    for (const packageResult of result.packages ?? []) {
      const packageName = packageResult.package?.name ?? packageResult.package?.package?.name;
      const version = packageResult.package?.version ?? packageResult.package?.package?.version;
      for (const vulnerability of packageResult.vulnerabilities ?? []) {
        findings.push({
          packageName,
          version,
          id: vulnerability.id,
          aliases: sorted(new Set(vulnerability.aliases ?? [])),
        });
      }
    }
  }
  const normalized = findings
    .map((finding) => `${finding.packageName}|${finding.version}|${finding.id}|${finding.aliases.join(',')}`)
    .sort();
  const expected = [
    `brace-expansion|1.1.18|${EXPECTED_ADVISORY}|${EXPECTED_CVE}`,
    `brace-expansion|2.1.4|${EXPECTED_ADVISORY}|${EXPECTED_CVE}`,
  ].sort();
  if (JSON.stringify(normalized) !== JSON.stringify(expected)) {
    fail('ADDITIONAL_ADVISORY', normalized.join(';'));
  }
}

const args = parseArguments(process.argv.slice(2));
for (const required of ['mode', 'attestation', 'lockfile', 'now', 'report']) {
  if (!args[required]) fail('INVALID_ARGUMENTS', `--${required}`);
}

const attestationPath = repositoryPath(args.attestation);
const lockfilePath = repositoryPath(args.lockfile);
const attestation = readJson(attestationPath, 'attestation');
const lock = readJson(lockfilePath, 'lockfile');
validateAttestation(attestation, lock, lockfilePath, args.now);

const report = readJson(repositoryPath(args.report), `${args.mode} report`);
if (args.mode === 'npm') {
  for (const required of ['production-audit', 'runtime-sbom']) {
    if (!args[required]) fail('INVALID_ARGUMENTS', `--${required}`);
  }
  const productionPath = repositoryPath(args['production-audit']);
  const runtimeSbomPath = repositoryPath(args['runtime-sbom']);
  validateNpmReport(
    report,
    readJson(productionPath, 'production audit'),
    readJson(runtimeSbomPath, 'runtime SBOM'),
  );
} else if (args.mode === 'osv') {
  validateOsvReport(report);
} else {
  fail('INVALID_MODE', args.mode);
}

process.stdout.write(`ATTESTATION_VALID mode=${args.mode} advisory=${EXPECTED_ADVISORY}\n`);
