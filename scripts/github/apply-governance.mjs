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

export function runValidateRestorePayload({ root = repoRoot, gh = createGhClient() } = {}) {
  const classicBpr = gh.graphql(
    'query { repository(owner:"cyranoaladin",name:"nexus-project_v0"){ branchProtectionRules(first:10){ nodes{ id pattern isAdminEnforced requiredApprovingReviewCount requiredStatusCheckContexts dismissesStaleReviews requiresConversationResolution allowsForcePushes allowsDeletions } } } }',
  );
  const rule = classicBpr?.data?.repository?.branchProtectionRules?.nodes?.[0];
  if (!rule) {
    fail('CLASSIC_BPR_NOT_FOUND');
  }
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
  const ok = validate(restorePayload);
  if (!ok) {
    fail(
      'CLASSIC_BPR_RESTORE_PAYLOAD_INVALID',
      (validate.errors ?? []).map((e) => `${e.instancePath || '/'} ${e.message}`).join('; '),
    );
  }

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
  const classicBpr = gh.graphql(
    'query { repository(owner:"cyranoaladin",name:"nexus-project_v0"){ branchProtectionRules(first:10){ nodes{ id } } } }',
  );
  const liveId = classicBpr?.data?.repository?.branchProtectionRules?.nodes?.[0]?.id;
  if (!args['node-id'] || args['node-id'] !== liveId) {
    fail('CLASSIC_BPR_DELETE_NODE_ID_MISMATCH', `expected exact node id, got "${args['node-id'] ?? '(none)'}"`);
  }
  return liveId;
}

function main() {
  const args = parseArguments(process.argv.slice(2));
  const gh = createGhClient();

  if (args['delete-classic-protection']) {
    // Never implied by bare --apply. Requires this flag AND an exact
    // matching node id AND is not reachable through any other code path.
    requireExactNodeId(args, gh);
    fail('CLASSIC_BPR_DELETION_NOT_IMPLEMENTED_IN_THIS_PR', 'requires separate operator authorization gate; see plan section 2 and 7');
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
