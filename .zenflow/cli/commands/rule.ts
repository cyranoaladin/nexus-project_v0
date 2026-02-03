import { Command } from 'commander';
import { createOutput } from '../utils/output';

export function createRuleCommand(globalOptions: any): Command {
  const command = new Command('rule');
  command.description('Manage Zenflow rules');

  command
    .command('list')
    .description('List all rules')
    .option('--enabled', 'Show only enabled rules')
    .option('--disabled', 'Show only disabled rules')
    .action(async (options) => {
      const output = createOutput(globalOptions);
      try {
        output.info('List rules - to be implemented');
        if (options.enabled) {
          output.debug('Filter: enabled only');
        }
        if (options.disabled) {
          output.debug('Filter: disabled only');
        }
      } catch (error) {
        output.error('Failed to list rules', error as Error);
        process.exit(1);
      }
    });

  command
    .command('show <rule-name>')
    .description('Show details of a specific rule')
    .action(async (ruleName) => {
      const output = createOutput(globalOptions);
      try {
        output.info(`Show rule: ${ruleName} - to be implemented`);
      } catch (error) {
        output.error(`Failed to show rule: ${ruleName}`, error as Error);
        process.exit(1);
      }
    });

  command
    .command('validate <file>')
    .description('Validate a rule YAML file')
    .action(async (file) => {
      const output = createOutput(globalOptions);
      try {
        output.info(`Validate rule file: ${file} - to be implemented`);
      } catch (error) {
        output.error(`Failed to validate rule file: ${file}`, error as Error);
        process.exit(1);
      }
    });

  command
    .command('enable <rule-name>')
    .description('Enable a rule')
    .action(async (ruleName) => {
      const output = createOutput(globalOptions);
      try {
        output.info(`Enable rule: ${ruleName} - to be implemented`);
      } catch (error) {
        output.error(`Failed to enable rule: ${ruleName}`, error as Error);
        process.exit(1);
      }
    });

  command
    .command('disable <rule-name>')
    .description('Disable a rule')
    .action(async (ruleName) => {
      const output = createOutput(globalOptions);
      try {
        output.info(`Disable rule: ${ruleName} - to be implemented`);
      } catch (error) {
        output.error(`Failed to disable rule: ${ruleName}`, error as Error);
        process.exit(1);
      }
    });

  command
    .command('test <rule-name>')
    .description('Test a rule with an event')
    .option('--event <json>', 'Event JSON to test with')
    .action(async (ruleName, options) => {
      const output = createOutput(globalOptions);
      try {
        output.info(`Test rule: ${ruleName} - to be implemented`);
        if (options.event) {
          output.debug(`Event: ${options.event}`);
        }
      } catch (error) {
        output.error(`Failed to test rule: ${ruleName}`, error as Error);
        process.exit(1);
      }
    });

  return command;
}
