#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { createSyncCommand } from './commands/sync';
import { createRuleCommand } from './commands/rule';
import { createWorkflowCommand } from './commands/workflow';
import { createStatusCommand } from './commands/status';
import { createDaemonCommand } from './commands/daemon';
import { createOutput } from './utils/output';

const packageJsonPath = path.join(__dirname, '../../package.json');
let version = '0.1.0';

try {
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    version = packageJson.version || version;
  }
} catch (error) {
}

const program = new Command();

program
  .name('zenflow')
  .description('Zenflow - Automated worktree synchronization and workflow management')
  .version(version);

program
  .option('-v, --verbose', 'Enable verbose output')
  .option('-q, --quiet', 'Suppress non-essential output')
  .option('-c, --config <path>', 'Path to config file', '.zenflow/settings.json')
  .option('--json', 'Output in JSON format');

program.hook('preAction', (thisCommand) => {
  const opts = thisCommand.optsWithGlobals();
  
  if (opts.verbose && opts.quiet) {
    const output = createOutput();
    output.error('Cannot use --verbose and --quiet together');
    process.exit(1);
  }
});

const globalOptions = program.opts();

program.addCommand(createSyncCommand(globalOptions));
program.addCommand(createRuleCommand(globalOptions));
program.addCommand(createWorkflowCommand(globalOptions));
program.addCommand(createStatusCommand(globalOptions));
program.addCommand(createDaemonCommand(globalOptions));

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
