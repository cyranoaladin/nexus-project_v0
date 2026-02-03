import { exec } from 'child_process';
import { promisify } from 'util';
import { WorkflowStep, WorkflowExecution } from './types';
import { WorkflowStateManager } from './state';
import { getLogger } from '../utils/logger';
import { WorkflowExecutionError, TimeoutError } from '../utils/errors';

const execAsync = promisify(exec);
const logger = getLogger();

export class StepOrchestrator {
  private stateManager: WorkflowStateManager;

  constructor(stateManager: WorkflowStateManager) {
    this.stateManager = stateManager;
  }

  async executeStep(
    execution: WorkflowExecution,
    step: WorkflowStep,
    context: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    logger.info('Executing workflow step', {
      executionId: execution.id,
      stepId: step.id,
      stepName: step.name,
      stepType: step.type,
    });

    if (!this.shouldExecuteStep(step, context)) {
      logger.info('Skipping step due to conditional', {
        executionId: execution.id,
        stepId: step.id,
      });
      this.stateManager.skipStep(execution.id, step.id);
      return {};
    }

    this.stateManager.startStep(execution.id, step.id);

    try {
      const outputs = await this.executeStepWithTimeout(step, context, execution);
      this.stateManager.completeStep(execution.id, step.id, outputs);
      
      logger.info('Step completed successfully', {
        executionId: execution.id,
        stepId: step.id,
      });

      return outputs;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.stateManager.failStep(execution.id, step.id, errorMessage);

      logger.error('Step execution failed', {
        executionId: execution.id,
        stepId: step.id,
        error: errorMessage,
      });

      if (step.continue_on_error) {
        logger.warn('Continuing despite error (continue_on_error=true)', {
          executionId: execution.id,
          stepId: step.id,
        });
        return {};
      }

      throw new WorkflowExecutionError(
        `Step ${step.id} failed: ${errorMessage}`,
        execution.workflow_name,
        step.id
      );
    }
  }

  private shouldExecuteStep(step: WorkflowStep, context: Record<string, unknown>): boolean {
    if (step.when) {
      const shouldExecute = this.evaluateCondition(step.when, context);
      logger.debug('Evaluated when condition', {
        stepId: step.id,
        condition: step.when,
        result: shouldExecute,
      });
      if (!shouldExecute) return false;
    }

    if (step.unless) {
      const shouldSkip = this.evaluateCondition(step.unless, context);
      logger.debug('Evaluated unless condition', {
        stepId: step.id,
        condition: step.unless,
        result: shouldSkip,
      });
      if (shouldSkip) return false;
    }

    return true;
  }

  private evaluateCondition(condition: string, context: Record<string, unknown>): boolean {
    try {
      const func = new Function(...Object.keys(context), `return ${condition};`);
      return func(...Object.values(context));
    } catch (error) {
      logger.error('Failed to evaluate condition', {
        condition,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  private async executeStepWithTimeout(
    step: WorkflowStep,
    context: Record<string, unknown>,
    execution: WorkflowExecution
  ): Promise<Record<string, unknown>> {
    const timeout = step.timeout || 300;

    return Promise.race([
      this.executeStepByType(step, context, execution),
      this.createTimeout(timeout, step.id),
    ]);
  }

  private createTimeout(seconds: number, stepId: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new TimeoutError(`Step ${stepId} timed out after ${seconds} seconds`, seconds));
      }, seconds * 1000);
    });
  }

  private async executeStepByType(
    step: WorkflowStep,
    context: Record<string, unknown>,
    execution: WorkflowExecution
  ): Promise<Record<string, unknown>> {
    switch (step.type) {
      case 'shell':
        return this.executeShellStep(step, context);
      case 'javascript':
        return this.executeJavaScriptStep(step, context);
      case 'workflow':
        return this.executeWorkflowStep(step, context, execution);
      default:
        throw new WorkflowExecutionError(
          `Unknown step type: ${(step as any).type}`,
          execution.workflow_name,
          step.id
        );
    }
  }

  private async executeShellStep(
    step: WorkflowStep,
    context: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    if (!step.command) {
      throw new Error('Shell step requires command field');
    }

    const command = this.interpolateVariables(step.command, context);
    
    logger.debug('Executing shell command', {
      stepId: step.id,
      command,
    });

    const { stdout, stderr } = await execAsync(command, {
      cwd: process.cwd(),
      env: { ...process.env },
    });

    const outputs: Record<string, unknown> = {
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      exit_code: 0,
    };

    if (step.outputs) {
      for (const [outputName, outputPath] of Object.entries(step.outputs)) {
        outputs[outputName] = this.extractOutput(stdout, outputPath);
      }
    }

    return outputs;
  }

  private async executeJavaScriptStep(
    step: WorkflowStep,
    context: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    if (!step.script) {
      throw new Error('JavaScript step requires script field');
    }

    logger.debug('Executing JavaScript script', {
      stepId: step.id,
    });

    const func = new Function(...Object.keys(context), step.script);
    const result = await func(...Object.values(context));

    return typeof result === 'object' && result !== null
      ? (result as Record<string, unknown>)
      : { result };
  }

  private async executeWorkflowStep(
    step: WorkflowStep,
    context: Record<string, unknown>,
    execution: WorkflowExecution
  ): Promise<Record<string, unknown>> {
    if (!step.workflow) {
      throw new Error('Workflow step requires workflow field');
    }

    logger.info('Executing nested workflow', {
      parentExecutionId: execution.id,
      nestedWorkflow: step.workflow,
    });

    const inputs = step.inputs || {};
    const interpolatedInputs: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(inputs)) {
      interpolatedInputs[key] = typeof value === 'string'
        ? this.interpolateVariables(value, context)
        : value;
    }

    return { nested_workflow: step.workflow, inputs: interpolatedInputs };
  }

  private interpolateVariables(template: string, context: Record<string, unknown>): string {
    return template.replace(/\$\{([^}]+)\}/g, (_, varName) => {
      const keys = varName.trim().split('.');
      let value: any = context;

      for (const key of keys) {
        value = value?.[key];
      }

      return value !== undefined ? String(value) : `\${${varName}}`;
    });
  }

  private extractOutput(output: string, path: string): unknown {
    if (path === 'stdout') {
      return output.trim();
    }

    try {
      const parsed = JSON.parse(output);
      const keys = path.split('.');
      let value: any = parsed;

      for (const key of keys) {
        value = value?.[key];
      }

      return value;
    } catch {
      return output.trim();
    }
  }

  async executeRollback(
    execution: WorkflowExecution,
    rollbackSteps: WorkflowStep[],
    context: Record<string, unknown>
  ): Promise<void> {
    logger.info('Executing rollback steps', {
      executionId: execution.id,
      stepCount: rollbackSteps.length,
    });

    for (const step of rollbackSteps) {
      try {
        await this.executeStep(execution, step, context);
      } catch (error) {
        logger.error('Rollback step failed', {
          executionId: execution.id,
          stepId: step.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    logger.info('Rollback completed', { executionId: execution.id });
  }

  async handleStepFailure(
    execution: WorkflowExecution,
    step: WorkflowStep,
    error: Error,
    allSteps: WorkflowStep[],
    context: Record<string, unknown>
  ): Promise<{ action: 'abort' | 'continue' | 'skip_to' | 'rollback'; targetStep?: string }> {
    const onFailure = step.on_failure || 'abort';

    logger.info('Handling step failure', {
      executionId: execution.id,
      stepId: step.id,
      strategy: onFailure,
    });

    switch (onFailure) {
      case 'abort':
        return { action: 'abort' };

      case 'continue':
        logger.warn('Continuing to next step despite failure', {
          executionId: execution.id,
          stepId: step.id,
        });
        return { action: 'continue' };

      case 'skip_to_step':
        logger.info('Skipping to specific step', {
          executionId: execution.id,
          currentStep: step.id,
        });
        return { action: 'skip_to' };

      case 'rollback_to_step':
        logger.info('Rolling back to specific step', {
          executionId: execution.id,
          currentStep: step.id,
        });
        return { action: 'rollback' };

      default:
        return { action: 'abort' };
    }
  }
}

export function createOrchestrator(stateManager: WorkflowStateManager): StepOrchestrator {
  return new StepOrchestrator(stateManager);
}
