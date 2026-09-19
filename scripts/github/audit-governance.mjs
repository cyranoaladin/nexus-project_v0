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

/**
 * The live contract, asserted against the running GitHub configuration.
 *
 * The expectation is `main-ruleset.json`'s **`desired`** block, never its
 * `current` block: `current` is a snapshot taken at `capturedFromBaseSha` and
 * drifts by design, so comparing live against it would report drift where
 * there is none and miss the drift that matters. `desired` is what the owner
 * wants to hold, so that is what a weakening must be measured against.
 */
function expectedFromDesired(ruleset) {
  const desired = ruleset.desired;
  return {
    rulesetId: ruleset.rulesetId,
    rulesetName: ruleset.rulesetName,
    enforcement: desired.enforcement,
    bypassActors: desired.bypassActors ?? [],
    refNameInclude: desired.conditions?.refNameInclude ?? [],
    refNameExclude: desired.conditions?.refNameExclude ?? [],
    pullRequest: desired.rules.pullRequest,
    strict: desired.rules.requiredStatusChecks.strict,
    contexts: desired.rules.requiredStatusChecks.contexts,
    nonFastForward: desired.rules.nonFastForward === true,
    deletion: desired.rules.deletion === true,
  };
}

function ruleParameters(liveRuleset, type) {
  return (liveRuleset.rules ?? []).find((rule) => rule.type === type)?.parameters ?? null;
}

function hasRule(liveRuleset, type) {
  return (liveRuleset.rules ?? []).some((rule) => rule.type === type);
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Every protection the owner declared, checked against the live ruleset.
 *
 * Each mismatch is fatal: this audit exists to make a weakening of `main`
 * impossible to introduce silently, and a finding that only prints is a
 * finding that protects nothing.
 */
function auditLiveRuleset(liveRuleset, expected, findings) {
  const fatal = (code, details) => findings.push({ code, details, fatal: true });

  if (liveRuleset.id !== expected.rulesetId) {
    fatal('RULESET_ID_MISMATCH', `declared ${expected.rulesetId}, live ${liveRuleset.id}`);
  }
  if (liveRuleset.name !== expected.rulesetName) {
    fatal('RULESET_NAME_MISMATCH', `declared "${expected.rulesetName}", live "${liveRuleset.name}"`);
  }
  if (liveRuleset.target !== 'branch') {
    fatal('RULESET_TARGET_MISMATCH', `expected "branch", live "${liveRuleset.target}"`);
  }
  if (liveRuleset.enforcement !== expected.enforcement) {
    fatal('RULESET_ENFORCEMENT_MISMATCH', `declared "${expected.enforcement}", live "${liveRuleset.enforcement}"`);
  }

  const liveBypass = liveRuleset.bypass_actors ?? [];
  if (liveBypass.length !== expected.bypassActors.length) {
    fatal('RULESET_BYPASS_ACTORS_PRESENT', `declared ${expected.bypassActors.length}, live ${liveBypass.length}`);
  }

  const include = liveRuleset.conditions?.ref_name?.include ?? [];
  const exclude = liveRuleset.conditions?.ref_name?.exclude ?? [];
  if (!same(include, expected.refNameInclude)) {
    fatal('RULESET_REF_INCLUDE_MISMATCH', `declared [${expected.refNameInclude}], live [${include}]`);
  }
  if (!same(exclude, expected.refNameExclude)) {
    fatal('RULESET_REF_EXCLUDE_MISMATCH', `declared [${expected.refNameExclude}], live [${exclude}]`);
  }

  if (expected.nonFastForward && !hasRule(liveRuleset, 'non_fast_forward')) {
    fatal('RULESET_RULE_MISSING', 'non_fast_forward');
  }
  if (expected.deletion && !hasRule(liveRuleset, 'deletion')) {
    fatal('RULESET_RULE_MISSING', 'deletion');
  }

  const pr = ruleParameters(liveRuleset, 'pull_request');
  if (pr === null) {
    fatal('RULESET_RULE_MISSING', 'pull_request');
  } else {
    const wanted = expected.pullRequest;
    const scalars = [
      ['required_approving_review_count', wanted.requiredApprovingReviewCount],
      ['dismiss_stale_reviews_on_push', wanted.dismissStaleReviewsOnPush],
      ['require_code_owner_review', wanted.requireCodeOwnerReview],
      ['require_last_push_approval', wanted.requireLastPushApproval],
      ['required_review_thread_resolution', wanted.requiredReviewThreadResolution],
      ['require_extra_approval_for_unattributed_changes', wanted.requireExtraApprovalForUnattributedChanges],
    ];
    for (const [key, want] of scalars) {
      if (want !== undefined && pr[key] !== want) {
        fatal('RULESET_PULL_REQUEST_MISMATCH', `${key}: declared ${want}, live ${pr[key]}`);
      }
    }
    if (!same([...(pr.allowed_merge_methods ?? [])].sort(), [...wanted.allowedMergeMethods].sort())) {
      fatal(
        'RULESET_MERGE_METHODS_MISMATCH',
        `declared [${wanted.allowedMergeMethods}], live [${pr.allowed_merge_methods ?? []}]`,
      );
    }
  }

  const checks = ruleParameters(liveRuleset, 'required_status_checks');
  if (checks === null) {
    fatal('RULESET_RULE_MISSING', 'required_status_checks');
    return new Map();
  }
  if (checks.strict_required_status_checks_policy !== expected.strict) {
    fatal(
      'RULESET_STRICT_POLICY_MISMATCH',
      `declared ${expected.strict}, live ${checks.strict_required_status_checks_policy}`,
    );
  }

  const liveContexts = new Map(
    (checks.required_status_checks ?? []).map((check) => [check.context, check.integration_id]),
  );
  for (const context of expected.contexts) {
    if (!liveContexts.has(context)) {
      fatal('MISSING_REQUIRED_CHECK', `${context} not present in live ruleset`);
    }
  }
  for (const context of liveContexts.keys()) {
    if (!expected.contexts.includes(context)) {
      // An extra required check cannot weaken `main`, but it is undeclared
      // governance: nothing in this repository says who produces it.
      findings.push({ code: 'UNDECLARED_REQUIRED_CHECK', details: context, fatal: false });
    }
  }
  return liveContexts;
}

export function runLiveAudit({ root = repoRoot, gh = createGhClient() } = {}) {
  const findings = [];
  const govDirLocal = join(root, '.github', 'governance');
  const registry = loadJson(join(govDirLocal, 'checks-registry.json'));
  const reviewPolicy = loadJson(join(govDirLocal, 'review-policy.json'));
  const ruleset = loadJson(join(govDirLocal, 'main-ruleset.json'));
  const expected = expectedFromDesired(ruleset);
  const repository = ruleset.repository;

  const liveRuleset = gh.apiJson(`repos/${repository}/rulesets/${expected.rulesetId}`);
  const liveContexts = auditLiveRuleset(liveRuleset, expected, findings);

  for (const entry of registry.requiredChecks) {
    const liveIntegrationId = liveContexts.get(entry.context);
    if (liveIntegrationId === undefined) {
      // Already reported as MISSING_REQUIRED_CHECK above when the context is
      // declared in the ruleset; a registry entry with no live context is the
      // same defect seen from the other side.
      findings.push({
        code: 'MISSING_REQUIRED_CHECK',
        details: `${entry.context} declared in checks-registry.json but absent from the live ruleset`,
        fatal: true,
      });
      continue;
    }
    const expectedIntegrationId = entry.producer?.integrationId;
    if (expectedIntegrationId !== undefined && expectedIntegrationId !== liveIntegrationId) {
      findings.push({
        code: 'REQUIRED_CHECK_PRODUCER_MISMATCH',
        details: `${entry.context}: registry integrationId=${expectedIntegrationId}, live=${liveIntegrationId}`,
        fatal: true,
      });
    }
  }

  const classicBpr = gh.graphql(
    `query { repository(owner:"${repository.split('/')[0]}",name:"${repository.split('/')[1]}"){ branchProtectionRules(first:10){ nodes{ id pattern matchingRefs(first:5){ totalCount nodes{ name prefix } } } } } }`,
  );
  const rules = classicBpr?.data?.repository?.branchProtectionRules?.nodes ?? [];
  const mainMatch = rules.find((rule) =>
    (rule.matchingRefs?.nodes ?? []).some((ref) => ref.prefix === 'refs/heads/' && ref.name === 'main'),
  );
  if (mainMatch) {
    // Not fatal yet: the rule has not been removed, and removing it is a
    // separate owner-authorized mutation. It becomes fatal once that removal
    // has happened, so it cannot be reintroduced unnoticed.
    findings.push({ code: 'CLASSIC_BRANCH_PROTECTION_PRESENT', details: mainMatch.id, fatal: false });
    findings.push({
      code: 'STALE_OR_LATENT_CLASSIC_BPR',
      details:
        'coverage on refs/heads/main is proven via matchingRefs; merge-blocking applicability is EXPLICITLY_UNPROVEN — see docs/audits/2026-08-29-github-governance-inventory.md',
      fatal: false,
    });
    findings.push({
      code: 'DUPLICATED_PROTECTION_CONTROLS',
      details: `${expected.rulesetId} + ${mainMatch.id} both target refs/heads/main`,
      fatal: false,
    });
    for (const zombieContext of registry.zombieClassicBprContexts ?? []) {
      findings.push({ code: 'ZOMBIE_REQUIRED_CHECK', details: `classic BPR context "${zombieContext}" has no producer on main`, fatal: false });
    }
  }

  const collaborators = gh.apiJson(`repos/${repository}/collaborators?per_page=100&affiliation=all`);
  const permissionByLogin = new Map(collaborators.map((c) => [c.login, c.permissions]));
  for (const principal of reviewPolicy.codeowners.principals) {
    const permissions = permissionByLogin.get(principal);
    if (!permissions?.push) {
      findings.push({ code: 'CODEOWNERS_PRINCIPAL_INELIGIBLE', details: `${principal} lacks write/push access`, fatal: true });
    }
  }

  // A client that cannot report its own write calls cannot prove this audit
  // was read-only, and an unprovable read-only claim is not a read-only claim.
  let writeCalls = null;
  if (typeof gh.writeCallCount !== 'function') {
    findings.push({ code: 'API_WRITE_CALLS_UNPROVABLE', details: 'gh client exposes no writeCallCount()', fatal: true });
  } else {
    writeCalls = gh.writeCallCount();
    if (writeCalls !== 0) {
      findings.push({ code: 'API_WRITE_CALLS_PERFORMED', details: `${writeCalls}`, fatal: true });
    }
  }

  return {
    ok: findings.every((finding) => !finding.fatal),
    findings,
    writeCalls,
    liveRuleset,
    classicBprPresent: Boolean(mainMatch),
  };
}

/** The observable facts this audit asserts, one per line, greppable. */
function liveEvidence(live, expected) {
  const pr = ruleParameters(live.liveRuleset, 'pull_request') ?? {};
  const checks = ruleParameters(live.liveRuleset, 'required_status_checks') ?? {};
  return [
    `RULESET_ID=${live.liveRuleset.id}`,
    `RULESET_NAME=${live.liveRuleset.name}`,
    `RULESET_TARGET=${live.liveRuleset.target}`,
    `RULESET_ENFORCEMENT=${live.liveRuleset.enforcement}`,
    `BYPASS_ACTORS=${(live.liveRuleset.bypass_actors ?? []).length}`,
    `REQUIRED_APPROVING_REVIEW_COUNT=${pr.required_approving_review_count}`,
    `DISMISS_STALE_REVIEWS_ON_PUSH=${pr.dismiss_stale_reviews_on_push}`,
    `REQUIRE_LAST_PUSH_APPROVAL=${pr.require_last_push_approval}`,
    `REQUIRED_REVIEW_THREAD_RESOLUTION=${pr.required_review_thread_resolution}`,
    `REQUIRE_CODE_OWNER_REVIEW=${pr.require_code_owner_review}`,
    `REQUIRE_EXTRA_APPROVAL_FOR_UNATTRIBUTED_CHANGES=${pr.require_extra_approval_for_unattributed_changes}`,
    `ALLOWED_MERGE_METHODS=${(pr.allowed_merge_methods ?? []).join(',')}`,
    `STRICT_REQUIRED_STATUS_CHECKS=${checks.strict_required_status_checks_policy}`,
    `REQUIRED_CHECKS=${(checks.required_status_checks ?? []).length}`,
    `REQUIRED_CHECKS_EXPECTED=${expected.contexts.length}`,
    `CLASSIC_BPR_PRESENT=${live.classicBprPresent ? 'YES' : 'NO'}`,
    `API_WRITE_CALLS=${live.writeCalls === null ? 'UNPROVABLE' : live.writeCalls}`,
  ];
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
  const expected = expectedFromDesired(loadJson(join(govDir, 'main-ruleset.json')));

  for (const line of liveEvidence(live, expected)) {
    process.stdout.write(`${line}\n`);
  }
  for (const finding of live.findings) {
    const stream = finding.fatal ? process.stderr : process.stdout;
    stream.write(`${finding.fatal ? 'FATAL ' : ''}${finding.code}: ${finding.details}\n`);
  }

  // The previous version computed `live.ok` and threw it away, so a
  // MISSING_REQUIRED_CHECK printed and the process still exited 0 — a live
  // audit that could not fail. It fails now.
  if (!live.ok) {
    const fatalCount = live.findings.filter((finding) => finding.fatal).length;
    fail('GOVERNANCE_LIVE_AUDIT_FAILED', `${fatalCount} fatal finding(s)`);
  }

  process.stdout.write(`GOVERNANCE_AUDIT_OK mode=live findings=${live.findings.length} sha256=${sha256}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
