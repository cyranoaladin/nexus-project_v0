#!/usr/bin/env node

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArguments } from './lib/args.mjs';
import { createGhClient } from './lib/gh.mjs';
import { runLiveAudit, runOfflineAudit } from './audit-governance.mjs';

const scriptDir = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(scriptDir, '../..');

function section(title) {
  process.stdout.write(`\n== ${title} ==\n`);
}

function main() {
  const args = parseArguments(process.argv.slice(2));

  section('Offline governance audit');
  const offline = runOfflineAudit({ root: repoRoot });
  process.stdout.write(`checkedContexts=${offline.checkedContexts} findings=${offline.findings.length}\n`);
  for (const finding of offline.findings) {
    process.stdout.write(`  ${finding.code}: ${finding.details}\n`);
  }
  if (offline.findings.length === 0) {
    process.stdout.write('  (clean)\n');
  }

  if (!args.live) {
    process.stdout.write('\nRun with --live for a live-GitHub comparison (requires gh auth).\n');
    return;
  }

  section('Live governance audit');
  const live = runLiveAudit({ root: repoRoot, gh: createGhClient() });
  for (const finding of live.findings) {
    process.stdout.write(`  ${finding.code}: ${finding.details}\n`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
