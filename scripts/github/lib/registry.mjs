import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { findJobContext, parseWorkflowFile } from './yaml-workflows.mjs';

export function proveGithubActionsWorkflowProducer(repoRoot, producer) {
  const path = join(repoRoot, producer.workflowPath);
  if (!existsSync(path)) {
    return {
      ok: false,
      code: 'MISSING_REQUIRED_CHECK',
      details: `${producer.workflowPath} absent from repository`,
    };
  }
  let doc;
  try {
    doc = parseWorkflowFile(path);
  } catch (error) {
    return { ok: false, code: 'WORKFLOW_PARSE_ERROR', details: `${producer.workflowPath}: ${error.message}` };
  }
  const found = findJobContext(doc, producer.jobKey);
  if (!found) {
    return {
      ok: false,
      code: 'ZOMBIE_REQUIRED_CHECK',
      details: `job "${producer.jobKey}" absent from ${producer.workflowPath}`,
    };
  }
  if (found.context !== producer.expectedContext) {
    return {
      ok: false,
      code: 'ZOMBIE_REQUIRED_CHECK',
      details: `job "${producer.jobKey}" in ${producer.workflowPath} now produces context "${found.context}", registry expects "${producer.expectedContext}"`,
    };
  }
  return { ok: true };
}

export function validateExternalAppProducerStructure(producer) {
  if (typeof producer.appName !== 'string' || producer.appName.length === 0) {
    return { ok: false, code: 'UNMODELED_EXTERNAL_REQUIRED_CHECK', details: 'missing appName' };
  }
  if (!Number.isInteger(producer.integrationId) || producer.integrationId < 1) {
    return { ok: false, code: 'UNMODELED_EXTERNAL_REQUIRED_CHECK', details: 'missing or invalid integrationId' };
  }
  if (typeof producer.expectedContext !== 'string' || producer.expectedContext.length === 0) {
    return { ok: false, code: 'UNMODELED_EXTERNAL_REQUIRED_CHECK', details: 'missing expectedContext' };
  }
  return { ok: true };
}

export function validateDefaultSetupProducerStructure(producer) {
  if (typeof producer.mechanism !== 'string' || producer.mechanism.length === 0) {
    return { ok: false, code: 'UNMODELED_EXTERNAL_REQUIRED_CHECK', details: 'missing mechanism' };
  }
  if (!Array.isArray(producer.expectedContexts) || producer.expectedContexts.length === 0) {
    return { ok: false, code: 'UNMODELED_EXTERNAL_REQUIRED_CHECK', details: 'missing expectedContexts' };
  }
  return { ok: true };
}

// Offline audit proves GITHUB_ACTIONS_WORKFLOW producers against the real,
// parsed YAML on disk. EXTERNAL_APP / GITHUB_DEFAULT_SETUP producers are
// structurally validated only — their live state is never claimed proven
// here (see checks-registry.json#auditGuarantees.offline).
export function proveCheckEntry(repoRoot, entry) {
  const { producer } = entry;
  switch (producer?.kind) {
    case 'GITHUB_ACTIONS_WORKFLOW':
      return proveGithubActionsWorkflowProducer(repoRoot, producer);
    case 'EXTERNAL_APP':
      return validateExternalAppProducerStructure(producer);
    case 'GITHUB_DEFAULT_SETUP':
      return validateDefaultSetupProducerStructure(producer);
    default:
      return {
        ok: false,
        code: 'UNMODELED_EXTERNAL_REQUIRED_CHECK',
        details: `unknown producer.kind "${producer?.kind}"`,
      };
  }
}

export function proveAllCheckEntries(repoRoot, registry) {
  const results = [];
  for (const entry of registry.requiredChecks ?? []) {
    results.push({ context: entry.context, tier: 'required', ...proveCheckEntry(repoRoot, entry) });
  }
  for (const entry of registry.observedNotRequired ?? []) {
    results.push({ context: entry.context, tier: 'observed', ...proveCheckEntry(repoRoot, entry) });
  }
  return results;
}
