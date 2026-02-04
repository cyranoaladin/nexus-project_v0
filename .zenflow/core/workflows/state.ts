import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { WorkflowExecution, StepExecution } from './types';
import { getLogger } from '../utils/logger';
import { ValidationError } from '../utils/errors';

const logger = getLogger();

export class WorkflowStateManager {
  private stateDirectory: string;

  constructor(stateDirectory: string = '.zenflow/state/executions') {
    this.stateDirectory = path.resolve(process.cwd(), stateDirectory);
    this.ensureStateDirectory();
  }

  private ensureStateDirectory(): void {
    if (!fs.existsSync(this.stateDirectory)) {
      fs.mkdirSync(this.stateDirectory, { recursive: true, mode: 0o755 });
      logger.debug('Created state directory', { directory: this.stateDirectory });
    }
  }

  createExecution(
    workflowName: string,
    inputs: Record<string, unknown>
  ): WorkflowExecution {
    const execution: WorkflowExecution = {
      id: randomUUID(),
      workflow_name: workflowName,
      status: 'pending',
      started_at: new Date(),
      inputs,
      outputs: {},
      steps: [],
    };

    this.saveExecution(execution);
    logger.info('Created workflow execution', {
      id: execution.id,
      workflow: workflowName,
    });

    return execution;
  }

  saveExecution(execution: WorkflowExecution): void {
    const filePath = this.getExecutionFilePath(execution.id);
    const content = JSON.stringify(execution, null, 2);
    
    fs.writeFileSync(filePath, content, 'utf-8');
    logger.debug('Saved execution state', { id: execution.id });
  }

  loadExecution(executionId: string): WorkflowExecution {
    const filePath = this.getExecutionFilePath(executionId);

    if (!fs.existsSync(filePath)) {
      throw new ValidationError(`Execution not found: ${executionId}`);
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const execution = JSON.parse(content) as WorkflowExecution;

    execution.started_at = new Date(execution.started_at);
    if (execution.completed_at) {
      execution.completed_at = new Date(execution.completed_at);
    }

    execution.steps = execution.steps.map(step => ({
      ...step,
      started_at: step.started_at ? new Date(step.started_at) : undefined,
      completed_at: step.completed_at ? new Date(step.completed_at) : undefined,
    }));

    logger.debug('Loaded execution state', { id: executionId });
    return execution;
  }

  updateExecution(execution: WorkflowExecution): void {
    this.saveExecution(execution);
  }

  updateExecutionStatus(
    executionId: string,
    status: WorkflowExecution['status'],
    error?: Error
  ): void {
    const execution = this.loadExecution(executionId);
    execution.status = status;
    
    if (status === 'success' || status === 'failure' || status === 'rolled_back') {
      execution.completed_at = new Date();
    }
    
    if (error) {
      execution.error = error;
    }

    this.saveExecution(execution);
    logger.info('Updated execution status', {
      id: executionId,
      status,
      hasError: !!error,
    });
  }

  addStepExecution(executionId: string, stepId: string): void {
    const execution = this.loadExecution(executionId);
    
    const stepExecution: StepExecution = {
      step_id: stepId,
      status: 'pending',
    };

    execution.steps.push(stepExecution);
    this.saveExecution(execution);
    
    logger.debug('Added step execution', { executionId, stepId });
  }

  updateStepExecution(
    executionId: string,
    stepId: string,
    updates: Partial<StepExecution>
  ): void {
    const execution = this.loadExecution(executionId);
    const stepIndex = execution.steps.findIndex(s => s.step_id === stepId);

    if (stepIndex === -1) {
      throw new ValidationError(`Step not found in execution: ${stepId}`);
    }

    execution.steps[stepIndex] = {
      ...execution.steps[stepIndex],
      ...updates,
    };

    execution.current_step = stepId;
    this.saveExecution(execution);

    logger.debug('Updated step execution', {
      executionId,
      stepId,
      status: updates.status,
    });
  }

  startStep(executionId: string, stepId: string): void {
    this.updateStepExecution(executionId, stepId, {
      status: 'running',
      started_at: new Date(),
    });
  }

  completeStep(
    executionId: string,
    stepId: string,
    outputs?: Record<string, unknown>
  ): void {
    this.updateStepExecution(executionId, stepId, {
      status: 'success',
      completed_at: new Date(),
      outputs,
    });
  }

  failStep(executionId: string, stepId: string, error: string): void {
    this.updateStepExecution(executionId, stepId, {
      status: 'failure',
      completed_at: new Date(),
      error,
    });
  }

  skipStep(executionId: string, stepId: string): void {
    this.updateStepExecution(executionId, stepId, {
      status: 'skipped',
      completed_at: new Date(),
    });
  }

  setExecutionOutputs(
    executionId: string,
    outputs: Record<string, unknown>
  ): void {
    const execution = this.loadExecution(executionId);
    execution.outputs = { ...execution.outputs, ...outputs };
    this.saveExecution(execution);
    
    logger.debug('Set execution outputs', { executionId, outputKeys: Object.keys(outputs) });
  }

  listExecutions(filters?: {
    workflow?: string;
    status?: WorkflowExecution['status'];
    since?: Date;
    limit?: number;
  }): WorkflowExecution[] {
    const files = fs.readdirSync(this.stateDirectory).filter(f => f.endsWith('.json'));
    
    let executions = files.map(file => {
      const filePath = path.join(this.stateDirectory, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const execution = JSON.parse(content) as WorkflowExecution;
      
      execution.started_at = new Date(execution.started_at);
      if (execution.completed_at) {
        execution.completed_at = new Date(execution.completed_at);
      }
      
      return execution;
    });

    if (filters?.workflow) {
      executions = executions.filter(e => e.workflow_name === filters.workflow);
    }

    if (filters?.status) {
      executions = executions.filter(e => e.status === filters.status);
    }

    if (filters?.since) {
      executions = executions.filter(e => e.started_at >= filters.since!);
    }

    executions.sort((a, b) => b.started_at.getTime() - a.started_at.getTime());

    if (filters?.limit) {
      executions = executions.slice(0, filters.limit);
    }

    return executions;
  }

  deleteExecution(executionId: string): void {
    const filePath = this.getExecutionFilePath(executionId);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      logger.info('Deleted execution', { id: executionId });
    }
  }

  cleanupOldExecutions(daysToKeep: number = 30): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const files = fs.readdirSync(this.stateDirectory).filter(f => f.endsWith('.json'));
    let deletedCount = 0;

    for (const file of files) {
      const filePath = path.join(this.stateDirectory, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const execution = JSON.parse(content) as WorkflowExecution;
      
      const startedAt = new Date(execution.started_at);
      if (startedAt < cutoffDate) {
        fs.unlinkSync(filePath);
        deletedCount++;
      }
    }

    logger.info('Cleaned up old executions', { deletedCount, daysToKeep });
    return deletedCount;
  }

  private getExecutionFilePath(executionId: string): string {
    return path.join(this.stateDirectory, `${executionId}.json`);
  }
}

const defaultStateManager = new WorkflowStateManager();

export function createExecution(
  workflowName: string,
  inputs: Record<string, unknown>
): WorkflowExecution {
  return defaultStateManager.createExecution(workflowName, inputs);
}

export function loadExecution(executionId: string): WorkflowExecution {
  return defaultStateManager.loadExecution(executionId);
}

export function updateExecution(execution: WorkflowExecution): void {
  defaultStateManager.updateExecution(execution);
}

export function listExecutions(filters?: {
  workflow?: string;
  status?: WorkflowExecution['status'];
  since?: Date;
  limit?: number;
}): WorkflowExecution[] {
  return defaultStateManager.listExecutions(filters);
}
