#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fail, parseArguments } from './lib/args.mjs';
import { hasFullCoverage } from './lib/codeowners.mjs';
import { createGhClient } from './lib/gh.mjs';
import { scanWorkflowsForAmbiguousInvariants } from './lib/invariants.mjs';
import { mergeMethodAgreement } from './lib/merge-method.mjs';
import { proveAllCheckEntries } from './lib/registry.mjs';
import { loadJson, validateAgainstSchema } from './lib/schemas.mjs';
import { digest } from './lib/canonical.mjs';
import {
  ARIA_CI_QUALIFICATION_JOBS,
  inspectAriaCiWorkflow,
  loadWorkflow,
} from './lib/aria-ci-contract.mjs';

const scriptDir = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(scriptDir, '../..');
const govDir = join(repoRoot, '.github', 'governance');
const schemasDir = join(govDir, 'schemas');
const workflowsDir = join(repoRoot, '.github', 'workflows');

const GOVERNANCE_FILES = [
  ['repository-settings.schema.json', 'repository-settings.json'],
  ['main-ruleset.schema.json', 'main-ruleset.json'],
  ['review-policy.schema.json', 'review-policy.json'],
  ['checks-registry.schema.json', 'checks-registry.json'],
];

export function runOfflineAudit({ root = repoRoot } = {}) {
  const findings = [];
  const govDirLocal = join(root, '.github', 'governance');
  const schemasDirLocal = join(govDirLocal, 'schemas');
  const workflowsDirLocal = join(root, '.github', 'workflows');

  const loaded = {};
  for (const [schemaFile, dataFile] of GOVERNANCE_FILES) {
    const schemaPath = join(schemasDirLocal, schemaFile);
    const dataPath = join(govDirLocal, dataFile);
    if (!existsSync(schemaPath) || !existsSync(dataPath)) {
      findings.push({ code: 'GOVERNANCE_FILE_MISSING', details: dataFile });
      continue;
    }
    const result = validateAgainstSchema(schemaPath, dataPath);
    if (!result.ok) {
      findings.push({
        code: 'SCHEMA_VALIDATION_FAILED',
        details: `${dataFile}: ${result.errors.map((e) => `${e.instancePath || '/'} ${e.message}`).join('; ')}`,
      });
    }
    loaded[dataFile] = result.data;
  }

  if (findings.length > 0) {
    return { ok: false, findings, checkedContexts: 0 };
  }

  const registry = loaded['checks-registry.json'];
  const proofs = proveAllCheckEntries(root, registry);
  for (const proof of proofs) {
    if (!proof.ok) {
      findings.push({ code: proof.code, details: `${proof.context}: ${proof.details}` });
    }
  }
  const registeredWorkflowJobs = new Set([
    ...(registry.requiredChecks ?? []),
    ...(registry.observedNotRequired ?? []),
  ].map((entry) => entry.producer?.jobKey).filter(Boolean));
  for (const jobKey of ARIA_CI_QUALIFICATION_JOBS) {
    if (!registeredWorkflowJobs.has(jobKey)) {
      findings.push({ code: 'ARIA_CI_REGISTRY_PRODUCER_MISSING', details: jobKey });
    }
  }

  if (existsSync(workflowsDirLocal)) {
    const ambiguous = scanWorkflowsForAmbiguousInvariants(workflowsDirLocal);
    for (const finding of ambiguous) {
      findings.push({
        code: 'AMBIGUOUS_INVARIANT',
        details: `${finding.file} job "${finding.jobKey}" step "${finding.stepName}" is named as an invariant but is continue-on-error`,
      });
    }
  }

  const ariaCiWorkflowPath = join(workflowsDirLocal, 'ci.yml');
  if (!existsSync(ariaCiWorkflowPath)) {
    findings.push({ code: 'ARIA_CI_WORKFLOW_MISSING', details: '.github/workflows/ci.yml' });
  } else {
    const ariaCi = inspectAriaCiWorkflow(loadWorkflow(ariaCiWorkflowPath));
    for (const finding of ariaCi.findings) {
      const [code, ...details] = finding.split(':');
      findings.push({ code, details: details.join(':') || '.github/workflows/ci.yml' });
    }
  }

  const settings = loaded['repository-settings.json'];
  const ruleset = loaded['main-ruleset.json'];
  const agreement = mergeMethodAgreement(settings, ruleset);
  for (const tier of ['current', 'desired']) {
    if (!agreement[tier].agree) {
      findings.push({
        code: 'MERGE_METHOD_DIVERGENCE',
        details: `${tier}: repository-settings implies [${agreement[tier].fromSettings.join(',')}], ruleset allows [${agreement[tier].fromRuleset.join(',')}]`,
      });
    }
  }

  const codeownersPath = join(root, '.github', 'CODEOWNERS');
  if (!existsSync(codeownersPath)) {
    findings.push({ code: 'CODEOWNERS_MISSING', details: codeownersPath });
  } else {
    const coverage = hasFullCoverage(readFileSync(codeownersPath, 'utf8'));
    if (coverage.coverage !== 1) {
      findings.push({ code: 'CODEOWNERS_COVERAGE_INCOMPLETE', details: 'no catch-all (*) rule found' });
    }
    const reviewPolicy = loaded['review-policy.json'];
    const expectedPrincipals = [...(reviewPolicy?.codeowners?.principals ?? [])].sort();
    const actualOwners = [...(coverage.catchAll?.owners ?? [])].sort();
    if (JSON.stringify(expectedPrincipals) !== JSON.stringify(actualOwners)) {
      findings.push({
        code: 'CODEOWNERS_PRINCIPALS_MISMATCH',
        details: `CODEOWNERS has [${actualOwners.join(',')}], review-policy.json expects [${expectedPrincipals.join(',')}]`,
      });
    }
  }

  return { ok: findings.length === 0, findings, checkedContexts: proofs.length };
}

export function runLiveAudit({ root = repoRoot, gh = createGhClient() } = {}) {
  const findings = [];
  const registry = loadJson(join(root, '.github', 'governance', 'checks-registry.json'));
  const reviewPolicy = loadJson(join(root, '.github', 'governance', 'review-policy.json'));

  const rulesetId = loadJson(join(root, '.github', 'governance', 'main-ruleset.json')).rulesetId;
  const liveRuleset = gh.apiJson(`repos/cyranoaladin/nexus-project_v0/rulesets/${rulesetId}`);
  findings.push({ code: 'RULESET_PRESENT', details: `id=${rulesetId} enforcement=${liveRuleset.enforcement}` });

  const liveContexts = new Map(
    (liveRuleset.rules ?? [])
      .find((rule) => rule.type === 'required_status_checks')
      ?.parameters?.required_status_checks?.map((c) => [c.context, c.integration_id]) ?? [],
  );

  for (const entry of registry.requiredChecks) {
    const producer = entry.producer;
    const liveIntegrationId = liveContexts.get(entry.context);
    if (liveIntegrationId === undefined) {
      findings.push({ code: 'MISSING_REQUIRED_CHECK', details: `${entry.context} not present in live ruleset` });
      continue;
    }
    const expectedIntegrationId = producer.integrationId;
    if (expectedIntegrationId !== undefined && expectedIntegrationId !== liveIntegrationId) {
      findings.push({
        code: 'REQUIRED_CHECK_PRODUCER_MISMATCH',
        details: `${entry.context}: registry integrationId=${expectedIntegrationId}, live=${liveIntegrationId}`,
      });
    }
  }

  const classicBpr = gh.graphql(
    'query { repository(owner:"cyranoaladin",name:"nexus-project_v0"){ branchProtectionRules(first:10){ nodes{ id pattern matchingRefs(first:5){ totalCount nodes{ name prefix } } } } ref(qualifiedName:"refs/heads/main"){ branchProtectionRule{ id } } } }',
  );
  const rules = classicBpr?.data?.repository?.branchProtectionRules?.nodes ?? [];
  const mainMatch = rules.find((rule) =>
    (rule.matchingRefs?.nodes ?? []).some((ref) => ref.prefix === 'refs/heads/' && ref.name === 'main'),
  );
  if (mainMatch) {
    findings.push({ code: 'CLASSIC_BRANCH_PROTECTION_PRESENT', details: mainMatch.id });
    findings.push({
      code: 'STALE_OR_LATENT_CLASSIC_BPR',
      details:
        'coverage on refs/heads/main is proven via matchingRefs; merge-blocking applicability is EXPLICITLY_UNPROVEN — see docs/audits/2026-08-29-github-governance-inventory.md',
    });
    findings.push({ code: 'DUPLICATED_PROTECTION_CONTROLS', details: `${rulesetId} + ${mainMatch.id} both target refs/heads/main` });
    for (const zombieContext of registry.zombieClassicBprContexts ?? []) {
      findings.push({ code: 'ZOMBIE_REQUIRED_CHECK', details: `classic BPR context "${zombieContext}" has no producer on main` });
    }
  }

  const collaborators = gh.apiJson('repos/cyranoaladin/nexus-project_v0/collaborators?per_page=100&affiliation=all');
  const permissionByLogin = new Map(collaborators.map((c) => [c.login, c.permissions]));
  for (const principal of reviewPolicy.codeowners.principals) {
    const permissions = permissionByLogin.get(principal);
    if (!permissions?.push) {
      findings.push({ code: 'CODEOWNERS_PRINCIPAL_INELIGIBLE', details: `${principal} lacks write/push access` });
    }
  }

  return { ok: findings.every((f) => !['MISSING_REQUIRED_CHECK', 'REQUIRED_CHECK_PRODUCER_MISMATCH', 'CODEOWNERS_PRINCIPAL_INELIGIBLE'].includes(f.code)), findings };
}

function main() {
  const args = parseArguments(process.argv.slice(2));
  const mode = args.live ? 'live' : 'offline';

  const offline = runOfflineAudit({ root: repoRoot });
  for (const finding of offline.findings) {
    process.stderr.write(`${finding.code}: ${finding.details}\n`);
  }
  if (!offline.ok) {
    fail('GOVERNANCE_AUDIT_FAILED', `${offline.findings.length} offline finding(s)`);
  }

  const { sha256 } = digest({ mode: 'offline', checkedContexts: offline.checkedContexts });

  if (mode === 'offline') {
    process.stdout.write(`GOVERNANCE_AUDIT_OK mode=offline checks=${offline.checkedContexts} sha256=${sha256}\n`);
    return;
  }

  const live = runLiveAudit({ root: repoRoot });
  for (const finding of live.findings) {
    process.stdout.write(`${finding.code}: ${finding.details}\n`);
  }
  process.stdout.write(`GOVERNANCE_AUDIT_OK mode=live findings=${live.findings.length} sha256=${sha256}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
