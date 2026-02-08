import { Command } from 'commander';
import { createOutput } from '../utils/output';
import { parseKeyValuePairs, ValidationError } from '../utils/validation';
import { WorkflowEngine } from '../../core/workflows/engine';
import { WorkflowLoader } from '../../core/workflows/loader';
import { loadConfig } from '../../core/config/loader';
import type { Workflow, WorkflowExecution, StepExecution } from '../../core/workflows/types';

function getWorkflowEngine(configPath?: string): WorkflowEngine {
  const config = loadConfig(configPath);
  const workflowsDirectory = config.workflows?.directory ?? '.zenflow/workflows';
  const stateDirectory = config.workflows?.state_directory ?? '.zenflow/state/executions';
  const maxConcurrent = config.workflows?.max_concurrent ?? 1;

  return new WorkflowEngine({
    workflowsDirectory,
    stateDirectory,
    maxConcurrent,
  });
}

function formatDate(date: Date): string {
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatDuration(start: Date, end?: Date): string {
  if (!end) return '-';
  const durationMs = end.getTime() - start.getTime();
  const seconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${seconds}s`;
}

function formatExecutionStatus(status: WorkflowExecution['status']): string {
  const statusColors: Record<WorkflowExecution['status'], string> = {
    pending: '⏳',
    running: '▶️ ',
    success: '✅',
    failure: '❌',
    rolled_back: '⏪',
  };
  return statusColors[status] || status;
}

function formatStepStatus(status: StepExecution['status']): string {
  const statusColors: Record<StepExecution['status'], string> = {
    pending: '⏳',
    running: '▶️ ',
    success: '✅',
    failure: '❌',
    skipped: '⏭️ ',
  };
  return statusColors[status] || status;
}

export function createWorkflowCommand(globalOptions: any): Command {
  const command = new Command('workflow');
  command.description('Manage Zenflow workflows');

  command
    .command('list')
    .description('List all workflows')
    .action(async () => {
      const output = createOutput(globalOptions);
      try {
        output.info('📋 Loading workflows...');
        output.newline();

        const engine = getWorkflowEngine(globalOptions.config);
        const workflows = await engine.loadWorkflows();

        if (workflows.length === 0) {
          output.info('No workflows found');
          return;
        }

        if (globalOptions.json) {
          output.json(workflows);
          return;
        }

        const tableData = workflows.map(workflow => ({
          Name: workflow.name,
          Version: workflow.version,
          Steps: workflow.steps.length.toString(),
          Inputs: workflow.inputs.length.toString(),
          Description: workflow.description.substring(0, 50) + (workflow.description.length > 50 ? '...' : ''),
        }));

        output.table(tableData, ['Name', 'Version', 'Steps', 'Inputs', 'Description']);
        
        output.newline();
        output.info(`Total: ${workflows.length} workflow(s)`);
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
        output.info(`📋 Loading workflow: ${workflowName}...`);
        output.newline();

        const engine = getWorkflowEngine(globalOptions.config);
        const workflow = await engine.loadWorkflow(workflowName);

        if (globalOptions.json) {
          output.json(workflow);
          return;
        }

        output.info('🔍 Workflow Details:');
        output.newline();

        const details = [
          `  Name:        ${workflow.name}`,
          `  Version:     ${workflow.version}`,
          `  Author:      ${workflow.author}`,
          `  Description: ${workflow.description}`,
        ];

        output.list(details, '');

        if (workflow.inputs.length > 0) {
          output.newline();
          output.info('📥 Inputs:');
          workflow.inputs.forEach((input, idx) => {
            const required = input.required ? '(required)' : '(optional)';
            const defaultVal = input.default !== undefined ? ` [default: ${input.default}]` : '';
            output.info(`  ${idx + 1}. ${input.name}: ${input.type} ${required}${defaultVal}`);
            if (input.description) {
              output.info(`     ${input.description}`);
            }
          });
        }

        output.newline();
        output.info('📝 Steps:');
        workflow.steps.forEach((step, idx) => {
          output.info(`  ${idx + 1}. ${step.name} (${step.type})`);
        });

        if (workflow.outputs.length > 0) {
          output.newline();
          output.info('📤 Outputs:');
          workflow.outputs.forEach((output_item, idx) => {
            output.info(`  ${idx + 1}. ${output_item.name}: ${output_item.type}`);
          });
        }

        output.newline();
        output.info('⚠️  Error Handling:');
        output.list([
          `  Strategy: ${workflow.error_handling.strategy}`,
        ], '');
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
        output.info(`▶️  Running workflow: ${workflowName}...`);
        output.newline();

        const inputs: Record<string, unknown> = {};
        if (options.input && options.input.length > 0) {
          const parsedInputs = parseKeyValuePairs(
            Array.isArray(options.input) ? options.input : [options.input]
          );
          Object.assign(inputs, parsedInputs);
          
          output.info('Inputs:');
          Object.entries(inputs).forEach(([key, value]) => {
            output.info(`  ${key}: ${JSON.stringify(value)}`);
          });
          output.newline();
        }

        const engine = getWorkflowEngine(globalOptions.config);
        const execution = await engine.executeWorkflow(workflowName, inputs);

        output.newline();
        output.info('📊 Execution Result:');
        output.newline();

        const details = [
          `  Execution ID: ${execution.id}`,
          `  Workflow:     ${execution.workflow_name}`,
          `  Status:       ${formatExecutionStatus(execution.status)} ${execution.status}`,
          `  Started:      ${formatDate(execution.started_at)}`,
        ];

        if (execution.completed_at) {
          details.push(`  Completed:    ${formatDate(execution.completed_at)}`);
          details.push(`  Duration:     ${formatDuration(execution.started_at, execution.completed_at)}`);
        }

        output.list(details, '');

        if (execution.steps.length > 0) {
          output.newline();
          output.info('Steps:');
          execution.steps.forEach((step, idx) => {
            const statusIcon = formatStepStatus(step.status);
            output.info(`  ${idx + 1}. ${statusIcon} ${step.step_id} - ${step.status}`);
          });
        }

        if (execution.error) {
          output.newline();
          output.error('❌ Error:');
          output.info(`  ${execution.error}`);
        }

        if (execution.status === 'success') {
          output.newline();
          output.success('✨ Workflow completed successfully!');
          
          if (Object.keys(execution.outputs).length > 0) {
            output.newline();
            output.info('Outputs:');
            Object.entries(execution.outputs).forEach(([key, value]) => {
              output.info(`  ${key}: ${JSON.stringify(value)}`);
            });
          }
        } else if (execution.status === 'failure') {
          output.newline();
          output.error('❌ Workflow execution failed');
          process.exit(1);
        } else if (execution.status === 'rolled_back') {
          output.newline();
          output.warning('⏪ Workflow was rolled back');
          process.exit(1);
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
        output.info(`🔍 Validating workflow file: ${file}...`);
        output.newline();

        const config = loadConfig(globalOptions.config);
        const workflowsDirectory = config.workflows?.directory ?? '.zenflow/workflows';
        const loader = new WorkflowLoader(workflowsDirectory);

        const workflow = await loader.loadWorkflowFromFile(file);
        const result = loader.validateWorkflow(workflow);

        if (result.valid) {
          output.success('✅ Workflow file is valid!');
          output.newline();
          
          output.info('Workflow details:');
          output.list([
            `  Name:    ${workflow.name}`,
            `  Version: ${workflow.version}`,
            `  Author:  ${workflow.author}`,
            `  Steps:   ${workflow.steps.length}`,
          ], '');
        } else {
          output.error('❌ Workflow validation failed:');
          output.newline();
          result.errors?.forEach(error => {
            output.error(`  - ${error}`);
          });
          process.exit(1);
        }
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
        output.info(`📋 Retrieving workflow execution: ${executionId}...`);
        output.newline();

        const engine = getWorkflowEngine(globalOptions.config);
        const execution = await engine.getExecutionStatus(executionId);

        if (globalOptions.json) {
          output.json(execution);
          return;
        }

        output.info('🔍 Execution Status:');
        output.newline();

        const details = [
          `  Execution ID: ${execution.id}`,
          `  Workflow:     ${execution.workflow_name}`,
          `  Status:       ${formatExecutionStatus(execution.status)} ${execution.status}`,
          `  Started:      ${formatDate(execution.started_at)}`,
        ];

        if (execution.completed_at) {
          details.push(`  Completed:    ${formatDate(execution.completed_at)}`);
          details.push(`  Duration:     ${formatDuration(execution.started_at, execution.completed_at)}`);
        }

        if (execution.current_step) {
          details.push(`  Current Step: ${execution.current_step}`);
        }

        output.list(details, '');

        if (execution.steps.length > 0) {
          output.newline();
          output.info('📝 Steps:');
          execution.steps.forEach((step, idx) => {
            const statusIcon = formatStepStatus(step.status);
            const duration = step.started_at && step.completed_at 
              ? ` (${formatDuration(step.started_at, step.completed_at)})`
              : '';
            output.info(`  ${idx + 1}. ${statusIcon} ${step.step_id} - ${step.status}${duration}`);
            if (step.error) {
              output.info(`     Error: ${step.error}`);
            }
          });
        }

        if (Object.keys(execution.outputs).length > 0) {
          output.newline();
          output.info('📤 Outputs:');
          Object.entries(execution.outputs).forEach(([key, value]) => {
            output.info(`  ${key}: ${JSON.stringify(value)}`);
          });
        }

        if (execution.error) {
          output.newline();
          output.error('❌ Error:');
          output.info(`  ${execution.error}`);
        }
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
        output.info(`📋 Retrieving workflow execution logs: ${executionId}...`);
        output.newline();

        const engine = getWorkflowEngine(globalOptions.config);
        const execution = await engine.getExecutionStatus(executionId);

        output.info('📜 Execution Logs:');
        output.newline();

        output.info(`Workflow: ${execution.workflow_name}`);
        output.info(`Status: ${formatExecutionStatus(execution.status)} ${execution.status}`);
        output.info(`Started: ${formatDate(execution.started_at)}`);
        if (execution.completed_at) {
          output.info(`Completed: ${formatDate(execution.completed_at)}`);
        }
        output.newline();

        if (execution.steps.length === 0) {
          output.info('No steps executed yet');
          return;
        }

        output.info('Step-by-Step Execution:');
        output.newline();

        execution.steps.forEach((step, idx) => {
          const statusIcon = formatStepStatus(step.status);
          output.info(`${idx + 1}. ${statusIcon} ${step.step_id}`);
          output.info(`   Status: ${step.status}`);
          
          if (step.started_at) {
            output.info(`   Started: ${formatDate(step.started_at)}`);
          }
          
          if (step.completed_at) {
            output.info(`   Completed: ${formatDate(step.completed_at)}`);
            output.info(`   Duration: ${formatDuration(step.started_at!, step.completed_at)}`);
          }
          
          if (step.outputs && Object.keys(step.outputs).length > 0) {
            output.info(`   Outputs:`);
            Object.entries(step.outputs).forEach(([key, value]) => {
              output.info(`     ${key}: ${JSON.stringify(value)}`);
            });
          }
          
          if (step.error) {
            output.error(`   Error: ${step.error}`);
          }
          
          output.newline();
        });

        if (execution.error) {
          output.error('Execution Error:');
          output.info(`  ${execution.error}`);
        }
      } catch (error) {
        output.error(`Failed to show workflow logs: ${executionId}`, error as Error);
        process.exit(1);
      }
    });

  return command;
}
