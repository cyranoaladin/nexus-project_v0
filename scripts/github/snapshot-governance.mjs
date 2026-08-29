#!/usr/bin/env node

import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fail, parseArguments } from './lib/args.mjs';
import { digest } from './lib/canonical.mjs';
import { createGhClient } from './lib/gh.mjs';
import { writeRedactedSnapshot } from './lib/redact.mjs';

const scriptDir = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(scriptDir, '../..');
const REPO = 'cyranoaladin/nexus-project_v0';

const CLASSIC_BPR_QUERY = `query {
  repository(owner:"cyranoaladin",name:"nexus-project_v0") {
    branchProtectionRules(first: 10) {
      nodes {
        id
        pattern
        isAdminEnforced
        requiredApprovingReviewCount
        requiredStatusCheckContexts
        matchingRefs(first: 10) { totalCount nodes { name prefix } }
      }
    }
  }
}`;

// Live capture only. Read-only: no write-method gh calls are made here.
// Secret and Dependabot secret listings are names only (the API itself
// never returns values); redact.mjs additionally strips any credential-
// shaped string and any *token/*secret/*password/*authorization key.
export function captureGovernanceSnapshot({ gh = createGhClient() } = {}) {
  const repository = gh.apiJson(`repos/${REPO}`);
  const rulesets = gh.apiJson(`repos/${REPO}/rulesets`);
  const rulesetDetails = rulesets.map((r) => gh.apiJson(`repos/${REPO}/rulesets/${r.id}`));
  const classicBpr = gh.graphql(CLASSIC_BPR_QUERY);
  const collaborators = gh.apiJson(`repos/${REPO}/collaborators?per_page=100&affiliation=all`);
  const webhooks = gh.apiJson(`repos/${REPO}/hooks`);
  const deployKeys = gh.apiJson(`repos/${REPO}/keys`);
  const environments = gh.apiJson(`repos/${REPO}/environments`);
  const secretNames = gh.apiJson(`repos/${REPO}/actions/secrets?per_page=100`).secrets.map((s) => s.name);
  const variableNames = gh.apiJson(`repos/${REPO}/actions/variables?per_page=100`).variables.map((v) => v.name);
  const actionsPermissions = gh.apiJson(`repos/${REPO}/actions/permissions`);
  const workflows = gh.apiJson(`repos/${REPO}/actions/workflows?per_page=100`).workflows.map((w) => ({
    id: w.id,
    name: w.name,
    path: w.path,
    state: w.state,
  }));

  return {
    capturedAt: new Date().toISOString(),
    repository: {
      allow_merge_commit: repository.allow_merge_commit,
      allow_squash_merge: repository.allow_squash_merge,
      allow_rebase_merge: repository.allow_rebase_merge,
      allow_auto_merge: repository.allow_auto_merge,
      allow_update_branch: repository.allow_update_branch,
      delete_branch_on_merge: repository.delete_branch_on_merge,
      web_commit_signoff_required: repository.web_commit_signoff_required,
      default_branch: repository.default_branch,
    },
    rulesets: rulesetDetails,
    classicBranchProtection: classicBpr,
    collaborators: collaborators.map((c) => ({ login: c.login, role_name: c.role_name, permissions: c.permissions })),
    webhooks: webhooks.map((h) => ({ id: h.id, active: h.active, events: h.events })),
    deployKeys: deployKeys.map((k) => ({ id: k.id, title: k.title, read_only: k.read_only, last_used: k.last_used })),
    environments: environments.environments?.map((e) => ({ name: e.name, protection_rules: e.protection_rules })) ?? [],
    secretNames,
    variableNames,
    actionsPermissions,
    workflows,
  };
}

function main() {
  const args = parseArguments(process.argv.slice(2));
  const outDir = args.out ?? join(repoRoot, '.artifacts', 'governance', new Date().toISOString().replace(/[:.]/g, '-'));

  let snapshot;
  try {
    snapshot = captureGovernanceSnapshot();
  } catch (error) {
    fail('SNAPSHOT_CAPTURE_FAILED', error.message);
  }

  const outPath = join(outDir, 'snapshot.json');
  writeRedactedSnapshot(outPath, snapshot);

  const { sha256 } = digest(snapshot);
  writeRedactedSnapshot(join(outDir, 'snapshot.sha256'), { sha256 });

  process.stdout.write(`GOVERNANCE_SNAPSHOT_OK path=${outPath} sha256=${sha256}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
