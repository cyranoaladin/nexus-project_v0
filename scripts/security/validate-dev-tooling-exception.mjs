#!/usr/bin/env node

import { createHash } from 'node:crypto';
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
} from 'node:fs';
import { basename, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

const scriptDirectory = fileURLToPath(new URL('.', import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '../..');
const schemaPath = join(
  repositoryRoot,
  'security/pre-rentree-2026-dev-tooling-exception.schema.json',
);

function fail(code, details = '') {
  const suffix = details ? `: ${details}` : '';
  process.stderr.write(`${code}${suffix}\n`);
  process.exit(1);
}

function parseArguments(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || value === undefined) {
      fail('INVALID_ARGUMENTS');
    }
    parsed[key.slice(2)] = value;
  }
  return parsed;
}

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    fail('INVALID_JSON', label);
  }
}

function sortedUnique(values) {
  return [...new Set(values)].sort();
}

function equalSets(left, right) {
  return JSON.stringify(sortedUnique(left)) === JSON.stringify(sortedUnique(right));
}

function validateDecision(policy, currentSha, nowText) {
  const rawDecision = process.env.PRE_RENTREE_DEV_TOOLING_EXCEPTION_JSON;
  if (!rawDecision) {
    fail('EXCEPTION_INPUT_MISSING');
  }

  let decision;
  try {
    decision = JSON.parse(rawDecision);
  } catch {
    fail('EXCEPTION_INPUT_INVALID_JSON');
  }

  const schema = readJson(schemaPath, 'exception schema');
  const ajv = new Ajv2020({
    allErrors: true,
    strict: true,
  });
  const validate = ajv.compile(schema);
  if (!validate(decision)) {
    const summary = (validate.errors ?? [])
      .map((error) => `${error.instancePath || '/'} ${error.message}`)
      .join('; ');
    fail('EXCEPTION_SCHEMA_INVALID', summary);
  }

  const scalarBindings = [
    'repository',
    'pullRequest',
    'advisoryId',
    'severity',
    'affectedPackage',
    'affectedVersions',
  ];
  for (const key of scalarBindings) {
    if (decision[key] !== policy[key]) {
      fail('POLICY_BINDING_MISMATCH', key);
    }
  }

  if (
    currentSha !== decision.stageProductSha &&
    currentSha !== decision.ciEvidenceSha
  ) {
    fail('BOUND_SHA_MISMATCH');
  }

  const approvedAt = Date.parse(decision.approvedAt);
  const expiresAt = Date.parse(decision.expiresAt);
  const now = Date.parse(nowText);
  const maximumExpiry = Date.parse(policy.maximumExpiry);
  if ([approvedAt, expiresAt, now, maximumExpiry].some(Number.isNaN)) {
    fail('EXCEPTION_DATE_INVALID');
  }
  if (approvedAt > now || expiresAt <= now) {
    fail('EXCEPTION_EXPIRED');
  }
  const maximumDurationMilliseconds =
    policy.maximumDurationDays * 24 * 60 * 60 * 1000;
  if (
    expiresAt <= approvedAt ||
    expiresAt - approvedAt > maximumDurationMilliseconds ||
    expiresAt > maximumExpiry
  ) {
    fail('EXCEPTION_DURATION_INVALID');
  }

  if (
    !equalSets(
      decision.compensatingControls,
      policy.requiredCompensatingControls,
    )
  ) {
    fail('COMPENSATING_CONTROL_MISSING');
  }
  if (
    !equalSets(
      decision.automaticRevocationConditions,
      policy.requiredRevocationConditions,
    )
  ) {
    fail('REVOCATION_CONDITION_MISSING');
  }
  if (decision.monitoringIssue !== policy.remediationIssue) {
    fail('REMEDIATION_ISSUE_MISMATCH');
  }

  return {
    decision,
    checksum: createHash('sha256').update(rawDecision).digest('hex'),
  };
}

function auditMetadata(report) {
  return report?.metadata?.vulnerabilities ?? {};
}

function validateProductionAudit(report) {
  const metadata = auditMetadata(report);
  if (metadata.high !== 0 || metadata.critical !== 0) {
    fail('PRODUCTION_AUDIT_NOT_GREEN');
  }
}

function collectAuditAdvisories(report) {
  const vulnerabilities = report?.vulnerabilities ?? {};
  const advisoryObjects = [];
  const visiting = new Set();

  function visit(name) {
    if (visiting.has(name)) {
      return;
    }
    const vulnerability = vulnerabilities[name];
    if (!vulnerability) {
      fail('ADDITIONAL_ADVISORY', `unresolved dependency ${name}`);
    }
    visiting.add(name);
    for (const via of vulnerability.via ?? []) {
      if (typeof via === 'string') {
        visit(via);
      } else if (via && typeof via === 'object') {
        advisoryObjects.push(via);
      } else {
        fail('ADDITIONAL_ADVISORY', name);
      }
    }
    visiting.delete(name);
  }

  for (const name of Object.keys(vulnerabilities)) {
    visit(name);
  }
  return advisoryObjects;
}

function containsPackage(component, packageName) {
  if (!component || typeof component !== 'object') {
    return false;
  }
  if (
    component.name === packageName ||
    component['bom-ref']?.includes(`/${packageName}@`) ||
    component.purl?.includes(`/${packageName}@`)
  ) {
    return true;
  }
  return Object.values(component).some((value) => {
    if (Array.isArray(value)) {
      return value.some((entry) => containsPackage(entry, packageName));
    }
    return value && typeof value === 'object'
      ? containsPackage(value, packageName)
      : false;
  });
}

function validateNpmMode(args, policy, decision) {
  const report = readJson(args.report, 'full npm audit');
  const productionAudit = readJson(
    args['production-audit'],
    'production npm audit',
  );
  const runtimeSbom = readJson(args['runtime-sbom'], 'runtime SBOM');

  validateProductionAudit(productionAudit);

  const metadata = auditMetadata(report);
  if (
    metadata.high !== policy.expectedHighImpactCount ||
    metadata.critical !== 0
  ) {
    fail('ADDITIONAL_ADVISORY', 'unexpected severity totals');
  }

  const advisoryObjects = collectAuditAdvisories(report);
  if (advisoryObjects.length === 0) {
    fail('ADDITIONAL_ADVISORY', 'no exact advisory leaf');
  }
  for (const advisory of advisoryObjects) {
    const advisoryId = basename(new URL(advisory.url).pathname);
    if (
      advisoryId !== policy.advisoryId ||
      advisory.name !== policy.affectedPackage ||
      advisory.severity?.toUpperCase() !== policy.severity
    ) {
      fail('ADDITIONAL_ADVISORY', advisoryId);
    }
  }

  const vulnerablePackage = report.vulnerabilities?.[policy.affectedPackage];
  if (
    !vulnerablePackage ||
    !equalSets(vulnerablePackage.nodes ?? [], decision.exactDependencyPaths)
  ) {
    fail('NPM_TREE_CHANGED');
  }

  if (containsPackage(runtimeSbom, policy.affectedPackage)) {
    fail('RUNTIME_PRESENCE');
  }
}

function validateOsvMode(args, policy) {
  const report = readJson(args.report, 'OSV report');
  let findingCount = 0;
  for (const result of report.results ?? []) {
    for (const packageResult of result.packages ?? []) {
      const packageName =
        packageResult.package?.name ?? packageResult.package?.package?.name;
      for (const vulnerability of packageResult.vulnerabilities ?? []) {
        findingCount += 1;
        const ids = sortedUnique([
          vulnerability.id,
          ...(vulnerability.aliases ?? []),
        ].filter(Boolean));
        if (
          packageName !== policy.affectedPackage ||
          !ids.includes(policy.advisoryId) ||
          ids.some(
            (identifier) =>
              identifier.startsWith('GHSA-') &&
              identifier !== policy.advisoryId,
          )
        ) {
          fail('ADDITIONAL_ADVISORY', ids.join(','));
        }
      }
    }
  }
  if (findingCount === 0) {
    fail('OSV_FINDING_MISSING');
  }
}

function findPackageDirectories(root, packageName) {
  if (!existsSync(root)) {
    fail('ARTIFACT_MISSING');
  }
  const matches = [];
  const queue = [root];
  while (queue.length > 0) {
    const directory = queue.pop();
    for (const entry of readdirSync(directory)) {
      const path = join(directory, entry);
      const stats = statSync(path);
      if (!stats.isDirectory()) {
        continue;
      }
      if (
        entry === packageName &&
        path.split(sep).includes('node_modules')
      ) {
        matches.push(path);
      } else {
        queue.push(path);
      }
    }
  }
  return matches;
}

function validateArtifactMode(args, policy) {
  const matches = findPackageDirectories(
    resolve(args['artifact-root']),
    policy.affectedPackage,
  );
  if (matches.length > 0) {
    fail('RUNTIME_PRESENCE', `${matches.length} package director${matches.length === 1 ? 'y' : 'ies'}`);
  }
}

const args = parseArguments(process.argv.slice(2));
const required = ['mode', 'policy', 'current-sha', 'now'];
for (const argument of required) {
  if (!args[argument]) {
    fail('INVALID_ARGUMENTS', `--${argument}`);
  }
}

const policy = readJson(args.policy, 'policy');
const { decision, checksum } = validateDecision(
  policy,
  args['current-sha'],
  args.now,
);

if (args.mode === 'npm') {
  for (const argument of ['report', 'production-audit', 'runtime-sbom']) {
    if (!args[argument]) {
      fail('INVALID_ARGUMENTS', `--${argument}`);
    }
  }
  validateNpmMode(args, policy, decision);
} else if (args.mode === 'osv') {
  if (!args.report) {
    fail('INVALID_ARGUMENTS', '--report');
  }
  validateOsvMode(args, policy);
} else if (args.mode === 'artifact') {
  if (!args['artifact-root']) {
    fail('INVALID_ARGUMENTS', '--artifact-root');
  }
  validateArtifactMode(args, policy);
} else {
  fail('INVALID_MODE');
}

process.stdout.write(
  `EXCEPTION_VALID mode=${args.mode} decision_sha256=${checksum}\n`,
);
