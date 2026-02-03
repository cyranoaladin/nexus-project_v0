import { Command } from 'commander';
import { createOutput } from '../utils/output';

export function createStatusCommand(globalOptions: any): Command {
  const command = new Command('status');
  command.description('Show Zenflow system status');

  command
    .description('Show overall system status')
    .action(async () => {
      const output = createOutput(globalOptions);
      try {
        output.info('System status - to be implemented');
      } catch (error) {
        output.error('Failed to get system status', error as Error);
        process.exit(1);
      }
    });

  command
    .command('worktrees')
    .description('List all worktrees with sync status')
    .action(async () => {
      const output = createOutput(globalOptions);
      try {
        output.info('Worktrees status - to be implemented');
      } catch (error) {
        output.error('Failed to get worktrees status', error as Error);
        process.exit(1);
      }
    });

  command
    .command('service')
    .description('Show daemon service status')
    .action(async () => {
      const output = createOutput(globalOptions);
      try {
        output.info('Service status - to be implemented');
      } catch (error) {
        output.error('Failed to get service status', error as Error);
        process.exit(1);
      }
    });

  return command;
}
