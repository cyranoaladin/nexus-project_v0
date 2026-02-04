import { Workflow, WorkflowExecution, WorkflowEngineConfig, WorkflowInput } from './types';
import { WorkflowLoader } from './loader';
import { WorkflowStateManager } from './state';
import { StepOrchestrator } from './orchestrator';
import { getLogger } from '../utils/logger';
import { WorkflowExecutionError, ValidationError } from '../utils/errors';

const logger = getLogger();

export class WorkflowEngine {
  private loader: WorkflowLoader;
  private stateManager: WorkflowStateManager;
  private orchestrator: StepOrchestrator;
  private config: WorkflowEngineConfig;

  constructor(config: WorkflowEngineConfig) {
    this.config = config;
    this.loader = new WorkflowLoader(config.workflowsDirectory);
    this.stateManager = new WorkflowStateManager(config.stateDirectory);
    this.orchestrator = new StepOrchestrator(this.stateManager);

    logger.info('WorkflowEngine initialized', {
      workflowsDirectory: config.workflowsDirectory,
      stateDirectory: config.stateDirectory,
      maxConcurrent: config.maxConcurrent,
    });
  }

  async loadWorkflows(): Promise<Workflow[]> {
    return this.loader.loadWorkflows();
  }

  async loadWorkflow(name: string): Promise<Workflow> {
    return this.loader.loadWorkflow(name);
  }

  async validateWorkflow(workflow: Workflow): Promise<{ valid: boolean; errors?: string[] }> {
    return this.loader.validateWorkflow(workflow);
  }

  async executeWorkflow(
    name: string,
    inputs: Record<string, unknown>
  ): Promise<WorkflowExecution> {
    logger.info('Starting workflow execution', { workflowName: name, inputs });

    const workflow = await this.loadWorkflow(name);

    this.validateInputs(workflow, inputs);

    const execution = this.stateManager.createExecution(name, inputs);

    try {
      this.stateManager.updateExecutionStatus(execution.id, 'running');

      for (const step of workflow.steps) {
        this.stateManager.addStepExecution(execution.id, step.id);
      }

      const context = { ...inputs, execution_id: execution.id };
      const outputs: Record<string, unknown> = {};

      for (let i = 0; i < workflow.steps.length; i++) {
        const step = workflow.steps[i];

        try {
          const stepOutputs = await this.orchestrator.executeStep(execution, step, {
            ...context,
            ...outputs,
          });

          Object.assign(outputs, stepOutputs);
        } catch (error) {
          const errorObj = error instanceof Error ? error : new Error(String(error));

          const failureAction = await this.orchestrator.handleStepFailure(
            execution,
            step,
            errorObj,
            workflow.steps,
            { ...context, ...outputs }
          );

          if (workflow.error_handling.strategy === 'continue' || failureAction.action === 'continue') {
            logger.warn('Continuing workflow despite step failure', {
              executionId: execution.id,
              failedStep: step.id,
            });
            continue;
          } else if (workflow.error_handling.strategy === 'rollback' || failureAction.action === 'rollback') {
            logger.info('Initiating workflow rollback', { executionId: execution.id });

            if (workflow.error_handling.cleanup_steps) {
              await this.orchestrator.executeRollback(
                execution,
                workflow.error_handling.cleanup_steps,
                { ...context, ...outputs }
              );
            }

            this.stateManager.updateExecutionStatus(execution.id, 'rolled_back', errorObj);

            if (workflow.notifications?.on_failure) {
              await this.sendNotifications(workflow.notifications.on_failure, execution);
            }

            throw new WorkflowExecutionError(
              `Workflow ${name} failed and was rolled back`,
              name,
              step.id
            );
          } else {
            logger.error('Aborting workflow execution', {
              executionId: execution.id,
              failedStep: step.id,
            });

            this.stateManager.updateExecutionStatus(execution.id, 'failure', errorObj);

            if (workflow.notifications?.on_failure) {
              await this.sendNotifications(workflow.notifications.on_failure, execution);
            }

            throw new WorkflowExecutionError(
              `Workflow ${name} failed at step ${step.id}: ${errorObj.message}`,
              name,
              step.id
            );
          }
        }
      }

      this.stateManager.setExecutionOutputs(execution.id, outputs);
      this.stateManager.updateExecutionStatus(execution.id, 'success');

      if (workflow.notifications?.on_success) {
        await this.sendNotifications(workflow.notifications.on_success, execution);
      }

      logger.info('Workflow execution completed successfully', {
        executionId: execution.id,
        workflowName: name,
      });

      return this.stateManager.loadExecution(execution.id);
    } catch (error) {
      if (error instanceof WorkflowExecutionError) {
        throw error;
      }

      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.stateManager.updateExecutionStatus(execution.id, 'failure', errorObj);

      logger.error('Workflow execution failed with unexpected error', {
        executionId: execution.id,
        error: errorObj.message,
      });

      throw new WorkflowExecutionError(
        `Workflow ${name} failed: ${errorObj.message}`,
        name
      );
    }
  }

  async resumeWorkflow(executionId: string): Promise<WorkflowExecution> {
    logger.info('Resuming workflow execution', { executionId });

    const execution = this.stateManager.loadExecution(executionId);

    if (execution.status === 'success') {
      logger.warn('Cannot resume completed workflow', { executionId });
      return execution;
    }

    if (execution.status === 'rolled_back') {
      throw new WorkflowExecutionError(
        `Cannot resume rolled back workflow: ${executionId}`,
        execution.workflow_name
      );
    }

    const workflow = await this.loadWorkflow(execution.workflow_name);

    const lastCompletedStepIndex = execution.steps.findLastIndex(
      step => step.status === 'success'
    );

    const startIndex = lastCompletedStepIndex + 1;

    if (startIndex >= workflow.steps.length) {
      logger.info('All steps completed, marking as success', { executionId });
      this.stateManager.updateExecutionStatus(executionId, 'success');
      return execution;
    }

    logger.info('Resuming from step', {
      executionId,
      stepIndex: startIndex,
      stepId: workflow.steps[startIndex].id,
    });

    this.stateManager.updateExecutionStatus(executionId, 'running');

    const context = { ...execution.inputs, execution_id: executionId };
    const outputs = { ...execution.outputs };

    try {
      for (let i = startIndex; i < workflow.steps.length; i++) {
        const step = workflow.steps[i];

        const stepOutputs = await this.orchestrator.executeStep(execution, step, {
          ...context,
          ...outputs,
        });

        Object.assign(outputs, stepOutputs);
      }

      this.stateManager.setExecutionOutputs(executionId, outputs);
      this.stateManager.updateExecutionStatus(executionId, 'success');

      logger.info('Workflow resume completed successfully', { executionId });

      return this.stateManager.loadExecution(executionId);
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.stateManager.updateExecutionStatus(executionId, 'failure', errorObj);

      logger.error('Workflow resume failed', {
        executionId,
        error: errorObj.message,
      });

      throw error;
    }
  }

  async rollbackWorkflow(executionId: string): Promise<void> {
    logger.info('Rolling back workflow', { executionId });

    const execution = this.stateManager.loadExecution(executionId);
    const workflow = await this.loadWorkflow(execution.workflow_name);

    if (!workflow.error_handling.cleanup_steps || workflow.error_handling.cleanup_steps.length === 0) {
      throw new WorkflowExecutionError(
        `Workflow ${workflow.name} does not define cleanup steps for rollback`,
        workflow.name
      );
    }

    const context = { ...execution.inputs, execution_id: executionId };
    const outputs = { ...execution.outputs };

    await this.orchestrator.executeRollback(
      execution,
      workflow.error_handling.cleanup_steps,
      { ...context, ...outputs }
    );

    this.stateManager.updateExecutionStatus(executionId, 'rolled_back');

    logger.info('Workflow rollback completed', { executionId });
  }

  async getExecutionStatus(executionId: string): Promise<WorkflowExecution> {
    return this.stateManager.loadExecution(executionId);
  }

  listExecutions(filters?: {
    workflow?: string;
    status?: WorkflowExecution['status'];
    since?: Date;
    limit?: number;
  }): WorkflowExecution[] {
    return this.stateManager.listExecutions(filters);
  }

  private validateInputs(workflow: Workflow, inputs: Record<string, unknown>): void {
    const errors: string[] = [];

    for (const inputDef of workflow.inputs) {
      const value = inputs[inputDef.name];

      if (inputDef.required && value === undefined) {
        if (inputDef.default !== undefined) {
          inputs[inputDef.name] = inputDef.default;
        } else {
          errors.push(`Required input missing: ${inputDef.name}`);
        }
      }

      if (value !== undefined) {
        const actualType = Array.isArray(value) ? 'array' : typeof value;
        if (actualType !== inputDef.type && inputDef.type !== 'object') {
          errors.push(
            `Input ${inputDef.name} has wrong type: expected ${inputDef.type}, got ${actualType}`
          );
        }
      }
    }

    if (errors.length > 0) {
      throw new ValidationError(`Invalid workflow inputs:\n${errors.join('\n')}`, errors);
    }
  }

  private async sendNotifications(
    notifications: Array<{ type: string; [key: string]: unknown }>,
    execution: WorkflowExecution
  ): Promise<void> {
    for (const notification of notifications) {
      try {
        if (notification.type === 'log') {
          const level = (notification.level as string) || 'info';
          const message = (notification.message as string) || 'Workflow notification';
          
          logger.log(level, message, {
            executionId: execution.id,
            workflowName: execution.workflow_name,
            status: execution.status,
          });
        }
      } catch (error) {
        logger.error('Failed to send notification', {
          executionId: execution.id,
          notificationType: notification.type,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}

export function createWorkflowEngine(config: WorkflowEngineConfig): WorkflowEngine {
  return new WorkflowEngine(config);
}
