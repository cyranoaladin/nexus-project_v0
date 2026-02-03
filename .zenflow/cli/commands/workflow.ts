import { Command } from 'commander';
import { createOutput } from '../utils/output';
import { parseKeyValuePairs } from '../utils/validation';

export function createWorkflowCommand(globalOptions: any): Command {
  const command = new Command('workflow');
  command.description('Manage Zenflow workflows');

  command
    .command('list')
    .description('List all workflows')
    .action(async () => {
      const output = createOutput(globalOptions);
      try {
        output.info('List workflows - to be implemented');
      } catch (error) {
        output.error('Failed to list workflows', error as Error);
        process.exit(1);
      }
    });

  command
    .command('show <workflow-name>')
    .description('Show details of a specific workflow')
    .action(async (workflowName) => {
      const output = createOutput(globalOptions);
      try {
        output.info(`Show workflow: ${workflowName} - to be implemented`);
      } catch (error) {
        output.error(`Failed to show workflow: ${workflowName}`, error as Error);
        process.exit(1);
      }
    });

  command
    .command('run <workflow-name>')
    .description('Run a workflow')
    .option('--input <key=value...>', 'Workflow input parameters', [])
    .action(async (workflowName, options) => {
      const output = createOutput(globalOptions);
      try {
        output.info(`Run workflow: ${workflowName} - to be implemented`);
        if (options.input && options.input.length > 0) {
          const inputs = parseKeyValuePairs(
            Array.isArray(options.input) ? options.input : [options.input]
          );
          output.debug(`Inputs: ${JSON.stringify(inputs)}`);
        }
      } catch (error) {
        output.error(`Failed to run workflow: ${workflowName}`, error as Error);
        process.exit(1);
      }
    });

  command
    .command('validate <file>')
    .description('Validate a workflow YAML file')
    .action(async (file) => {
      const output = createOutput(globalOptions);
      try {
        output.info(`Validate workflow file: ${file} - to be implemented`);
      } catch (error) {
        output.error(`Failed to validate workflow file: ${file}`, error as Error);
        process.exit(1);
      }
    });

  command
    .command('status <execution-id>')
    .description('Show status of a workflow execution')
    .action(async (executionId) => {
      const output = createOutput(globalOptions);
      try {
        output.info(`Show workflow execution status: ${executionId} - to be implemented`);
      } catch (error) {
        output.error(`Failed to show workflow status: ${executionId}`, error as Error);
        process.exit(1);
      }
    });

  command
    .command('logs <execution-id>')
    .description('Show logs of a workflow execution')
    .action(async (executionId) => {
      const output = createOutput(globalOptions);
      try {
        output.info(`Show workflow execution logs: ${executionId} - to be implemented`);
      } catch (error) {
        output.error(`Failed to show workflow logs: ${executionId}`, error as Error);
        process.exit(1);
      }
    });

  return command;
}
