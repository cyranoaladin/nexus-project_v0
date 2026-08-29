import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { listInvariantContinueOnErrorSteps, parseWorkflowFile } from './yaml-workflows.mjs';

// A step whose name contains "invariant" may never be continue-on-error —
// that combination is exactly what made data-invariants.yml a false
// assurance (see docs/audits/2026-08-29-github-governance-inventory.md).
export function scanWorkflowsForAmbiguousInvariants(workflowsDir) {
  const findings = [];
  for (const file of readdirSync(workflowsDir)) {
    if (!/\.ya?ml$/.test(file)) continue;
    const path = join(workflowsDir, file);
    const doc = parseWorkflowFile(path);
    for (const finding of listInvariantContinueOnErrorSteps(doc)) {
      findings.push({ file, ...finding });
    }
  }
  return findings;
}
