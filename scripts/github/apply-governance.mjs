#!/usr/bin/env node

import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import { fail, parseArguments } from './lib/args.mjs';
import { digest } from './lib/canonical.mjs';
import { createGhClient } from './lib/gh.mjs';
import { appendJournalEntry, newJournalEntry } from './lib/journal.mjs';
import { writeRedactedSnapshot } from './lib/redact.mjs';
import { loadJson } from './lib/schemas.mjs';
import { captureGovernanceSnapshot } from './snapshot-governance.mjs';
import { runLiveAudit } from './audit-governance.mjs';

const scriptDir = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(scriptDir, '../..');
const REPO = 'cyranoaladin/nexus-project_v0';

// Only these fields are ever written — everything else on the live repo
// object is left untouched (no blind PUT of a hardcoded payload).
const REPO_SETTINGS_MANAGED_FIELDS = [
  'allow_merge_commit',
  'allow_squash_merge',
  'allow_rebase_merge',
  'allow_auto_merge',
  'allow_update_branch',
  'delete_branch_on_merge',
  'web_commit_signoff_required',
];

export function computeRepoSettingsDiff(liveRepository, desired) {
  const changes = {};
  for (const field of REPO_SETTINGS_MANAGED_FIELDS) {
    if (liveRepository[field] !== desired[field]) {
      changes[field] = { from: liveRepository[field], to: desired[field] };
    }
  }
  return changes;
}

export function computeRulesetDiff(liveRuleset, desiredMethods) {
  const pullRequestRule = (liveRuleset.rules ?? []).find((rule) => rule.type === 'pull_request');
  const liveMethods = [...(pullRequestRule?.parameters?.allowed_merge_methods ?? [])].sort();
  const wantMethods = [...desiredMethods].sort();
  if (JSON.stringify(liveMethods) === JSON.stringify(wantMethods)) {
    return null;
  }
  return { field: 'rules[pull_request].allowed_merge_methods', from: liveMethods, to: wantMethods };
}

export function buildManagedRepoPayload(diff) {
  const payload = {};
  for (const [field, change] of Object.entries(diff)) {
    payload[field] = change.to;
  }
  return payload;
}

function loadGovernanceDesiredState(root) {
  const settings = loadJson(join(root, '.github', 'governance', 'repository-settings.json'));
  const ruleset = loadJson(join(root, '.github', 'governance', 'main-ruleset.json'));
  return { settings, ruleset };
}

export function planApply({ root = repoRoot, gh = createGhClient() } = {}) {
  const { settings, ruleset } = loadGovernanceDesiredState(root);
  const liveRepository = gh.apiJson(`repos/${REPO}`);
  const liveRuleset = gh.apiJson(`repos/${REPO}/rulesets/${ruleset.rulesetId}`);

  const repoDiff = computeRepoSettingsDiff(liveRepository, settings.managedFields.desired);
  const rulesetDiff = computeRulesetDiff(liveRuleset, ruleset.desired.rules.pullRequest.allowedMergeMethods);

  return {
    liveRepository,
    liveRuleset,
    repoDiff,
    rulesetDiff,
    rulesetId: ruleset.rulesetId,
    hasChanges: Object.keys(repoDiff).length > 0 || rulesetDiff !== null,
  };
}

function printPlan(plan) {
  process.stdout.write('--- repository settings ---\n');
  if (Object.keys(plan.repoDiff).length === 0) {
    process.stdout.write('  (no change)\n');
  }
  for (const [field, change] of Object.entries(plan.repoDiff)) {
    process.stdout.write(`  ${field}: ${change.from} -> ${change.to}\n`);
  }
  process.stdout.write(`--- ruleset ${plan.rulesetId} ---\n`);
  if (!plan.rulesetDiff) {
    process.stdout.write('  (no change)\n');
  } else {
    process.stdout.write(`  ${plan.rulesetDiff.field}: [${plan.rulesetDiff.from}] -> [${plan.rulesetDiff.to}]\n`);
  }
}

function journalPath(root) {
  return join(root, '.artifacts', 'governance', 'apply-journal.ndjson');
}

export function runDryRun(root, gh) {
  const plan = planApply({ root, gh });
  printPlan(plan);
  process.stdout.write(
    `GOVERNANCE_APPLY_DRY_RUN changes=${plan.hasChanges ? 'PENDING' : 'NONE'} writeCalls=${gh.writeCallCount()}\n`,
  );
  return plan;
}

function attemptRollback(root, gh, prestate, plan) {
  const rollbackFields = [];
  for (const field of Object.keys(plan.repoDiff)) {
    rollbackFields.push([field, prestate.repository[field]]);
  }
  try {
    if (rollbackFields.length > 0) {
      gh.apiJson(`repos/${REPO}`, { method: 'PATCH', fields: rollbackFields });
    }
    if (plan.rulesetDiff) {
      const fresh = gh.apiJson(`repos/${REPO}/rulesets/${plan.rulesetId}`);
      const pullRequestRule = fresh.rules.find((rule) => rule.type === 'pull_request');
      pullRequestRule.parameters.allowed_merge_methods = plan.rulesetDiff.from;
      gh.apiJson(`repos/${REPO}/rulesets/${plan.rulesetId}`, {
        method: 'PUT',
        fields: [
          ['name', fresh.name],
          ['target', fresh.target],
          ['enforcement', fresh.enforcement],
          ['conditions', JSON.stringify(fresh.conditions)],
          ['rules', JSON.stringify(fresh.rules)],
        ],
      });
    }
  } catch {
    return false;
  }
  const reverifyPlan = planApply({ root, gh });
  const backToRepoOk = Object.keys(plan.repoDiff).every(
    (field) => reverifyPlan.liveRepository[field] === prestate.repository[field],
  );
  const backToRulesetOk = !plan.rulesetDiff || !reverifyPlan.rulesetDiff;
  return backToRepoOk && backToRulesetOk;
}

export function runApply(root, gh) {
  const snapshotDir = join(root, '.artifacts', 'governance', `apply-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  const prestate = captureGovernanceSnapshot({ gh });
  const prestateDigest = digest(prestate);
  writeRedactedSnapshot(join(snapshotDir, 'prestate.json'), prestate);

  const plan = planApply({ root, gh });
  if (!plan.hasChanges) {
    appendJournalEntry(
      journalPath(root),
      newJournalEntry({
        operation: 'apply-governance',
        prestateSha256: prestateDigest.sha256,
        intendedDiff: {},
        apiOperationAttempted: 'NONE',
        outcome: 'SUCCESS',
      }),
    );
    process.stdout.write('GOVERNANCE_APPLY_OK changes=NONE\n');
    return;
  }

  let apiOperationAttempted = 'NONE';
  try {
    if (Object.keys(plan.repoDiff).length > 0) {
      apiOperationAttempted = 'PATCH repos/' + REPO;
      const payload = buildManagedRepoPayload(plan.repoDiff);
      gh.apiJson(`repos/${REPO}`, {
        method: 'PATCH',
        fields: Object.entries(payload).map(([k, v]) => [k, v]),
      });
    }
    if (plan.rulesetDiff) {
      apiOperationAttempted = `PUT repos/${REPO}/rulesets/${plan.rulesetId}`;
      // Read-modify-write: fetch the live ruleset again and overlay only
      // the managed field, never a hardcoded full ruleset body.
      const fresh = gh.apiJson(`repos/${REPO}/rulesets/${plan.rulesetId}`);
      const pullRequestRule = fresh.rules.find((rule) => rule.type === 'pull_request');
      pullRequestRule.parameters.allowed_merge_methods = plan.rulesetDiff.to;
      gh.apiJson(`repos/${REPO}/rulesets/${plan.rulesetId}`, {
        method: 'PUT',
        fields: [
          ['name', fresh.name],
          ['target', fresh.target],
          ['enforcement', fresh.enforcement],
          ['conditions', JSON.stringify(fresh.conditions)],
          ['rules', JSON.stringify(fresh.rules)],
        ],
      });
    }
  } catch (error) {
    const poststate = captureGovernanceSnapshot({ gh });
    appendJournalEntry(
      journalPath(root),
      newJournalEntry({
        operation: 'apply-governance',
        prestateSha256: prestateDigest.sha256,
        intendedDiff: { repoDiff: plan.repoDiff, rulesetDiff: plan.rulesetDiff },
        apiOperationAttempted,
        poststateSha256: digest(poststate).sha256,
        rollback: 'NOT_ATTEMPTED',
        outcome: 'FAILED',
      }),
    );
    fail('GOVERNANCE_APPLY_FAILED', error.message);
  }

  const poststate = captureGovernanceSnapshot({ gh });
  const poststateDigest = digest(poststate);
  writeRedactedSnapshot(join(snapshotDir, 'poststate.json'), poststate);

  const verifyPlan = planApply({ root, gh });
  const verified = !verifyPlan.hasChanges;

  let rollbackState = 'NOT_ATTEMPTED';
  if (!verified) {
    // A partial or unverified mutation is never reported as SUCCESS. We
    // attempt to restore prestate; whether that succeeds or fails, the
    // outcome stays FAILED and is never hidden.
    const rolledBack = attemptRollback(root, gh, prestate, plan);
    rollbackState = rolledBack ? 'SUCCEEDED' : 'FAILED';
  }

  appendJournalEntry(
    journalPath(root),
    newJournalEntry({
      operation: 'apply-governance',
      prestateSha256: prestateDigest.sha256,
      intendedDiff: { repoDiff: plan.repoDiff, rulesetDiff: plan.rulesetDiff },
      apiOperationAttempted,
      poststateSha256: poststateDigest.sha256,
      rollback: rollbackState,
      outcome: verified ? 'SUCCESS' : 'FAILED',
    }),
  );

  if (!verified) {
    fail(
      'GOVERNANCE_APPLY_VERIFICATION_FAILED',
      `post-read did not match intended state; rollback=${rollbackState}`,
    );
  }
  process.stdout.write(`GOVERNANCE_APPLY_OK sha256=${poststateDigest.sha256}\n`);
}

/**
 * Every field GitHub lets us read back on a classic branch protection rule,
 * plus the refs it actually covers. `matchingRefs` is the only honest way to
 * ask "does this rule protect main?": `pattern` is a glob whose expansion is
 * GitHub's business, not ours.
 */
const CLASSIC_BPR_QUERY = `query {
  repository(owner:"cyranoaladin",name:"nexus-project_v0"){
    branchProtectionRules(first:50){
      nodes{
        id
        pattern
        isAdminEnforced
        requiredApprovingReviewCount
        requiredStatusCheckContexts
        dismissesStaleReviews
        requiresConversationResolution
        allowsForcePushes
        allowsDeletions
        matchingRefs(first:50){ totalCount nodes{ name prefix } }
      }
    }
  }
}`;

function coversMain(rule) {
  return (rule.matchingRefs?.nodes ?? []).some((ref) => ref.prefix === 'refs/heads/' && ref.name === 'main');
}

/**
 * The classic protection that really covers `main` — never `nodes[0]`.
 *
 * The previous code took the first rule GitHub happened to return, in both
 * `requireExactNodeId` and the restore-payload capture. With more than one
 * classic rule on this repository, the operator would have compared their
 * node id against the wrong rule, and the restore payload would have
 * described a rule other than the one deleted. That second defect is the
 * worse one: it only shows up when a restore is actually needed.
 *
 * Zero matches and several matches are both refused, by name. There is no
 * "pick the most likely" path here.
 */
export function selectClassicProtectionOnMain(gh) {
  const response = gh.graphql(CLASSIC_BPR_QUERY);
  const nodes = response?.data?.repository?.branchProtectionRules?.nodes ?? [];
  const covering = nodes.filter(coversMain);

  if (covering.length === 0) {
    fail(
      'CLASSIC_BPR_ON_MAIN_NOT_FOUND',
      `${nodes.length} classic rule(s) present, none whose matchingRefs include refs/heads/main`,
    );
  }
  if (covering.length > 1) {
    fail('CLASSIC_BPR_ON_MAIN_AMBIGUOUS', covering.map((rule) => `${rule.id} (${rule.pattern})`).join(', '));
  }
  return covering[0];
}

export function buildRestorePayload(rule) {
  const restorePayload = {
    pattern: rule.pattern,
    isAdminEnforced: rule.isAdminEnforced,
    requiredApprovingReviewCount: rule.requiredApprovingReviewCount,
    requiredStatusCheckContexts: rule.requiredStatusCheckContexts,
    dismissesStaleReviews: rule.dismissesStaleReviews,
    requiresConversationResolution: rule.requiresConversationResolution,
    allowsForcePushes: rule.allowsForcePushes,
    allowsDeletions: rule.allowsDeletions,
  };
  const schema = {
    type: 'object',
    additionalProperties: false,
    required: [
      'pattern',
      'isAdminEnforced',
      'requiredApprovingReviewCount',
      'requiredStatusCheckContexts',
      'dismissesStaleReviews',
      'requiresConversationResolution',
      'allowsForcePushes',
      'allowsDeletions',
    ],
    properties: {
      pattern: { type: 'string' },
      isAdminEnforced: { type: 'boolean' },
      requiredApprovingReviewCount: { type: 'integer' },
      requiredStatusCheckContexts: { type: 'array', items: { type: 'string' } },
      dismissesStaleReviews: { type: 'boolean' },
      requiresConversationResolution: { type: 'boolean' },
      allowsForcePushes: { type: 'boolean' },
      allowsDeletions: { type: 'boolean' },
    },
  };
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validate = ajv.compile(schema);
  if (!validate(restorePayload)) {
    fail(
      'CLASSIC_BPR_RESTORE_PAYLOAD_INVALID',
      (validate.errors ?? []).map((e) => `${e.instancePath || '/'} ${e.message}`).join('; '),
    );
  }
  return restorePayload;
}

export function runValidateRestorePayload({ root = repoRoot, gh = createGhClient() } = {}) {
  const rule = selectClassicProtectionOnMain(gh);
  const restorePayload = buildRestorePayload(rule);

  writeRedactedSnapshot(
    join(root, '.artifacts', 'governance', 'classic-bpr-restore-payload.json'),
    { validatedAt: new Date().toISOString(), sourceRuleId: rule.id, restorePayload },
  );

  // This proves the payload is well-formed and reconstructible from a live
  // snapshot. It does NOT execute createBranchProtectionRule and does NOT
  // prove a restore actually succeeds — see CLASSIC_BPR_RESTORE_PAYLOAD_VALIDATED
  // vs a claimed RESTORE_PROVEN in docs/audits/2026-08-29-github-governance-inventory.md.
  process.stdout.write('CLASSIC_BPR_RESTORE_PAYLOAD_VALIDATED=YES\n');
  return restorePayload;
}

export function requireExactNodeId(args, gh) {
  const rule = selectClassicProtectionOnMain(gh);
  if (!args['node-id'] || args['node-id'] !== rule.id) {
    fail('CLASSIC_BPR_DELETE_NODE_ID_MISMATCH', `expected the exact live node id of the rule covering main, got "${args['node-id'] ?? '(none)'}"`);
  }
  return rule;
}

/**
 * Two independent channels must agree before anything is deleted: a flag on
 * the command line, and an environment variable naming the exact node id.
 * A stray flag in a script, or a stray variable in a shell, authorizes
 * nothing on its own — the operator has to state the same target twice, by two
 * different means.
 */
export function requireOwnerAuthorization(args, rule, env = process.env) {
  if (args['owner-authorization'] !== 'DELETE_CLASSIC_BPR_ON_MAIN') {
    fail(
      'CLASSIC_BPR_OWNER_AUTHORIZATION_MISSING',
      'requires --owner-authorization=DELETE_CLASSIC_BPR_ON_MAIN',
    );
  }
  if (env.NEXUS_OWNER_MUTATION_AUTHORIZATION !== rule.id) {
    fail(
      'CLASSIC_BPR_OWNER_AUTHORIZATION_TARGET_MISMATCH',
      'NEXUS_OWNER_MUTATION_AUTHORIZATION must name the exact live node id of the rule covering main',
    );
  }
}

/** Every fact the post-verification will be compared against, read before the mutation. */
export function captureClassicBprPrestate(gh, rule) {
  const ruleset = gh.apiJson(`repos/${REPO}/rulesets/12801316`);
  const parameters = (type) => (ruleset.rules ?? []).find((r) => r.type === type)?.parameters ?? {};
  const pullRequest = parameters('pull_request');
  const checks = parameters('required_status_checks');
  return {
    capturedAt: new Date().toISOString(),
    classicRule: {
      id: rule.id,
      pattern: rule.pattern,
      matchingRefs: (rule.matchingRefs?.nodes ?? []).map((ref) => `${ref.prefix}${ref.name}`),
    },
    restorePayload: buildRestorePayload(rule),
    ruleset: {
      id: ruleset.id,
      name: ruleset.name,
      enforcement: ruleset.enforcement,
      bypassActors: (ruleset.bypass_actors ?? []).length,
      requiredChecks: (checks.required_status_checks ?? []).map((c) => c.context).sort(),
      strict: checks.strict_required_status_checks_policy,
      review: {
        requiredApprovingReviewCount: pullRequest.required_approving_review_count,
        dismissStaleReviewsOnPush: pullRequest.dismiss_stale_reviews_on_push,
        requireLastPushApproval: pullRequest.require_last_push_approval,
        requiredReviewThreadResolution: pullRequest.required_review_thread_resolution,
        requireCodeOwnerReview: pullRequest.require_code_owner_review,
        requireExtraApprovalForUnattributedChanges: pullRequest.require_extra_approval_for_unattributed_changes,
      },
      mergeMethods: [...(pullRequest.allowed_merge_methods ?? [])].sort(),
    },
  };
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * What must still be true after the classic rule is gone. Compared against the
 * prestate captured moments earlier — never against the declared files, which
 * would only prove the declaration agrees with itself.
 */
export function postVerifyDeletion(gh, prestate) {
  const after = captureClassicBprPrestate(gh, {
    id: prestate.classicRule.id,
    pattern: prestate.classicRule.pattern,
    matchingRefs: { nodes: [] },
    isAdminEnforced: prestate.restorePayload.isAdminEnforced,
    requiredApprovingReviewCount: prestate.restorePayload.requiredApprovingReviewCount,
    requiredStatusCheckContexts: prestate.restorePayload.requiredStatusCheckContexts,
    dismissesStaleReviews: prestate.restorePayload.dismissesStaleReviews,
    requiresConversationResolution: prestate.restorePayload.requiresConversationResolution,
    allowsForcePushes: prestate.restorePayload.allowsForcePushes,
    allowsDeletions: prestate.restorePayload.allowsDeletions,
  });

  const stillThere = (gh.graphql(CLASSIC_BPR_QUERY)?.data?.repository?.branchProtectionRules?.nodes ?? [])
    .filter(coversMain);

  const results = {
    CLASSIC_BPR_PRESENT: stillThere.length === 0 ? 'NO' : 'YES',
    MAIN_RULESET_PRESENT: after.ruleset.id === prestate.ruleset.id ? 'YES' : 'NO',
    MAIN_RULESET_ENFORCEMENT: after.ruleset.enforcement,
    REQUIRED_CHECKS_UNCHANGED: same(after.ruleset.requiredChecks, prestate.ruleset.requiredChecks) ? 'YES' : 'NO',
    REVIEW_REQUIREMENTS_UNCHANGED: same(after.ruleset.review, prestate.ruleset.review) ? 'YES' : 'NO',
    MERGE_METHODS_UNCHANGED: same(after.ruleset.mergeMethods, prestate.ruleset.mergeMethods) ? 'YES' : 'NO',
    BYPASS_ACTORS_UNCHANGED: after.ruleset.bypassActors === prestate.ruleset.bypassActors ? 'YES' : 'NO',
  };

  const expected = {
    CLASSIC_BPR_PRESENT: 'NO',
    MAIN_RULESET_PRESENT: 'YES',
    MAIN_RULESET_ENFORCEMENT: 'active',
    REQUIRED_CHECKS_UNCHANGED: 'YES',
    REVIEW_REQUIREMENTS_UNCHANGED: 'YES',
    MERGE_METHODS_UNCHANGED: 'YES',
    BYPASS_ACTORS_UNCHANGED: 'YES',
  };

  const failures = Object.entries(expected).filter(([key, want]) => results[key] !== want);
  return { results, failures: failures.map(([key, want]) => `${key}: expected ${want}, got ${results[key]}`) };
}

export function deleteClassicProtection(gh, nodeId) {
  return gh.graphql(
    `mutation { deleteBranchProtectionRule(input:{branchProtectionRuleId:"${nodeId}"}) { clientMutationId } }`,
  );
}

export function createClassicProtection(gh, repositoryId, restorePayload) {
  const contexts = restorePayload.requiredStatusCheckContexts.map((c) => `"${c}"`).join(',');
  return gh.graphql(
    `mutation { createBranchProtectionRule(input:{
      repositoryId:"${repositoryId}"
      pattern:"${restorePayload.pattern}"
      isAdminEnforced:${restorePayload.isAdminEnforced}
      requiredApprovingReviewCount:${restorePayload.requiredApprovingReviewCount}
      requiredStatusCheckContexts:[${contexts}]
      dismissesStaleReviews:${restorePayload.dismissesStaleReviews}
      requiresConversationResolution:${restorePayload.requiresConversationResolution}
      allowsForcePushes:${restorePayload.allowsForcePushes}
      allowsDeletions:${restorePayload.allowsDeletions}
    }) { branchProtectionRule { id } } }`,
  );
}

/**
 * The operator path, fail-closed at every step.
 *
 * Nothing here is reachable from `--apply`, and no step is skippable: the
 * order is select, authorize, audit, capture, validate, mutate, verify. The
 * mutation is the sixth of seven, never the first.
 */
export function runDeleteClassicProtection({ root = repoRoot, gh = createGhClient(), args }) {
  const rule = requireExactNodeId(args, gh);
  requireOwnerAuthorization(args, rule);

  // The ruleset must be provably healthy *before* the duplicate protection is
  // removed — otherwise a deletion could leave `main` with neither.
  const live = runLiveAudit({ root, gh });
  if (!live.ok) {
    const fatal = live.findings.filter((finding) => finding.fatal).map((finding) => finding.code);
    fail('CLASSIC_BPR_DELETE_REFUSED_RULESET_UNHEALTHY', fatal.join(', '));
  }
  if (!live.classicBprPresent) {
    fail('CLASSIC_BPR_DELETE_REFUSED_NOTHING_TO_DELETE', 'the live audit sees no classic protection on main');
  }

  const prestate = captureClassicBprPrestate(gh, rule);
  const prestatePath = join(root, '.artifacts', 'governance', 'classic-bpr-prestate.json');
  writeRedactedSnapshot(prestatePath, prestate);
  const { sha256: prestateSha256 } = digest(prestate);
  process.stdout.write(`CLASSIC_BPR_PRESTATE_CAPTURED=${prestatePath}\n`);
  process.stdout.write(`CLASSIC_BPR_PRESTATE_SHA256=${prestateSha256}\n`);
  process.stdout.write('CLASSIC_BPR_RESTORE_PAYLOAD_VALIDATED=YES\n');
  // Deliberately NOT "RESTORE_PROVEN": nothing here has executed a restore.
  process.stdout.write('CLASSIC_BPR_RESTORE_PROVEN=NO\n');

  if (args['dry-run'] !== false) {
    process.stdout.write('CLASSIC_BPR_DELETION=DRY_RUN\n');
    appendJournalEntry(
      join(root, '.artifacts', 'governance', 'journal.ndjson'),
      newJournalEntry({
        operation: 'DELETE_CLASSIC_BPR',
        prestateSha256,
        intendedDiff: { deleteBranchProtectionRuleId: rule.id },
        apiOperationAttempted: false,
        outcome: 'DRY_RUN',
      }),
    );
    return { prestate, deleted: false };
  }

  deleteClassicProtection(gh, rule.id);
  const verification = postVerifyDeletion(gh, prestate);
  for (const [key, value] of Object.entries(verification.results)) {
    process.stdout.write(`${key}=${value}\n`);
  }
  const { sha256: poststateSha256 } = digest(verification.results);
  appendJournalEntry(
    join(root, '.artifacts', 'governance', 'journal.ndjson'),
    newJournalEntry({
      operation: 'DELETE_CLASSIC_BPR',
      prestateSha256,
      intendedDiff: { deleteBranchProtectionRuleId: rule.id },
      apiOperationAttempted: true,
      poststateSha256,
      outcome: verification.failures.length === 0 ? 'SUCCESS' : 'FAILED',
    }),
  );
  if (verification.failures.length > 0) {
    fail('CLASSIC_BPR_POST_VERIFICATION_FAILED', verification.failures.join('; '));
  }
  return { prestate, deleted: true };
}

/**
 * Controlled restore from a prestate file, never implicit and never automatic.
 *
 * A rollback that runs by itself after a failed post-verification would mutate
 * `main`'s protections a second time on the strength of a state nobody has
 * read. The operator reads the prestate, then asks for this explicitly.
 */
export function runRestoreClassicProtection({ root = repoRoot, gh = createGhClient(), args }) {
  const prestatePath = args['prestate'] ?? join(root, '.artifacts', 'governance', 'classic-bpr-prestate.json');
  const prestate = loadJson(prestatePath);
  if (!prestate?.restorePayload || !prestate?.classicRule?.id) {
    fail('CLASSIC_BPR_RESTORE_PRESTATE_INVALID', prestatePath);
  }
  if (args['owner-authorization'] !== 'RESTORE_CLASSIC_BPR_ON_MAIN') {
    fail('CLASSIC_BPR_OWNER_AUTHORIZATION_MISSING', 'requires --owner-authorization=RESTORE_CLASSIC_BPR_ON_MAIN');
  }

  if (args['dry-run'] !== false) {
    process.stdout.write(`CLASSIC_BPR_RESTORE=DRY_RUN from=${prestatePath}\n`);
    return { restored: false };
  }

  const repository = gh.graphql('query { repository(owner:"cyranoaladin",name:"nexus-project_v0"){ id } }');
  const repositoryId = repository?.data?.repository?.id;
  if (!repositoryId) fail('CLASSIC_BPR_RESTORE_REPOSITORY_ID_UNREADABLE');

  createClassicProtection(gh, repositoryId, prestate.restorePayload);
  const restored = (gh.graphql(CLASSIC_BPR_QUERY)?.data?.repository?.branchProtectionRules?.nodes ?? [])
    .filter(coversMain);
  process.stdout.write(`CLASSIC_BPR_PRESENT=${restored.length === 0 ? 'NO' : 'YES'}\n`);
  process.stdout.write(`CLASSIC_BPR_RESTORE_PROVEN=${restored.length === 1 ? 'YES' : 'NO'}\n`);
  if (restored.length !== 1) {
    fail('CLASSIC_BPR_RESTORE_FAILED', `${restored.length} rule(s) cover main after the restore`);
  }
  return { restored: true };
}

function main() {
  const args = parseArguments(process.argv.slice(2));
  const gh = createGhClient();

  if (args['delete-classic-protection']) {
    runDeleteClassicProtection({ root: repoRoot, gh, args });
    return;
  }

  if (args['restore-classic-protection']) {
    runRestoreClassicProtection({ root: repoRoot, gh, args });
    return;
  }

  if (args['validate-restore-payload']) {
    runValidateRestorePayload({ gh });
    return;
  }

  if (args.apply) {
    runApply(repoRoot, gh);
    return;
  }

  runDryRun(repoRoot, gh);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
