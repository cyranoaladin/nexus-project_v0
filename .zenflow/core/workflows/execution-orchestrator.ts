import { Event } from '../events/types';
import { Rule } from '../rules/types';
import { RuleEngine } from '../rules/engine';
import { WorkflowEngine } from './engine';
import { FileLock } from '../utils/locks';
import { getLogger } from '../utils/logger';

const logger = getLogger();

export interface QueuedExecution {
  id: string;
  event: Event;
  rule: Rule;
  queuedAt: Date;
  status: 'queued' | 'running' | 'completed' | 'failed';
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

export interface OrchestratorConfig {
  maxConcurrentExecutions: number;
  queueProcessInterval: number;
  enableConcurrencyControl: boolean;
}

export class ExecutionOrchestrator {
  private ruleEngine: RuleEngine;
  private workflowEngine: WorkflowEngine;
  private lock: FileLock;
  private executionQueue: QueuedExecution[];
  private processing: boolean;
  private config: OrchestratorConfig;
  private processInterval: NodeJS.Timeout | null;

  constructor(
    ruleEngine: RuleEngine,
    workflowEngine: WorkflowEngine,
    config?: Partial<OrchestratorConfig>
  ) {
    this.ruleEngine = ruleEngine;
    this.workflowEngine = workflowEngine;
    this.lock = new FileLock();
    this.executionQueue = [];
    this.processing = false;
    this.processInterval = null;
    this.config = {
      maxConcurrentExecutions: 1,
      queueProcessInterval: 1000,
      enableConcurrencyControl: true,
      ...config,
    };
  }

  async handleEvent(event: Event): Promise<void> {
    logger.info('Handling event', {
      eventId: event.id,
      eventType: event.type,
      source: event.source,
    });

    const matchingRules = await this.matchRulesToEvent(event);

    if (matchingRules.length === 0) {
      logger.info('No matching rules for event', { eventId: event.id });
      return;
    }

    logger.info('Found matching rules', {
      eventId: event.id,
      ruleCount: matchingRules.length,
      rules: matchingRules.map((r) => r.name),
    });

    for (const rule of matchingRules) {
      await this.queueExecution(event, rule);
    }
  }

  private async matchRulesToEvent(event: Event): Promise<Rule[]> {
    const rules = this.ruleEngine.getRules();
    const matchingRules: Rule[] = [];

    for (const rule of rules) {
      if (!rule.enabled) {
        logger.debug('Skipping disabled rule', { ruleName: rule.name });
        continue;
      }

      const matches = await this.ruleEngine.evaluateRule(rule, event);

      if (matches) {
        matchingRules.push(rule);
        logger.debug('Rule matched event', {
          ruleName: rule.name,
          eventId: event.id,
        });
      }
    }

    return matchingRules;
  }

  private async queueExecution(event: Event, rule: Rule): Promise<void> {
    const queuedExecution: QueuedExecution = {
      id: this.generateExecutionId(),
      event,
      rule,
      queuedAt: new Date(),
      status: 'queued',
    };

    this.executionQueue.push(queuedExecution);

    logger.info('Execution queued', {
      executionId: queuedExecution.id,
      ruleName: rule.name,
      eventId: event.id,
      queuePosition: this.executionQueue.length,
    });
  }

  async startProcessing(): Promise<void> {
    if (this.processing) {
      logger.warn('Queue processing already started');
      return;
    }

    this.processing = true;
    logger.info('Starting queue processing', {
      queueProcessInterval: this.config.queueProcessInterval,
      maxConcurrentExecutions: this.config.maxConcurrentExecutions,
    });

    this.processInterval = setInterval(() => {
      this.processQueue().catch((error) => {
        logger.error('Error processing queue', {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }, this.config.queueProcessInterval);

    await this.processQueue();
  }

  stopProcessing(): void {
    if (!this.processing) {
      logger.warn('Queue processing already stopped');
      return;
    }

    this.processing = false;

    if (this.processInterval) {
      clearInterval(this.processInterval);
      this.processInterval = null;
    }

    logger.info('Stopped queue processing');
  }

  private async processQueue(): Promise<void> {
    if (!this.processing) {
      return;
    }

    const queuedExecutions = this.executionQueue.filter((e) => e.status === 'queued');
    const runningExecutions = this.executionQueue.filter((e) => e.status === 'running');

    if (queuedExecutions.length === 0) {
      return;
    }

    if (runningExecutions.length >= this.config.maxConcurrentExecutions) {
      logger.debug('Max concurrent executions reached', {
        running: runningExecutions.length,
        max: this.config.maxConcurrentExecutions,
      });
      return;
    }

    const slotsAvailable = this.config.maxConcurrentExecutions - runningExecutions.length;
    const executionsToStart = queuedExecutions.slice(0, slotsAvailable);

    for (const execution of executionsToStart) {
      this.executeRule(execution).catch((error) => {
        logger.error('Error executing rule', {
          executionId: execution.id,
          ruleName: execution.rule.name,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }
  }

  private async executeRule(execution: QueuedExecution): Promise<void> {
    execution.status = 'running';
    execution.startedAt = new Date();

    logger.info('Starting rule execution', {
      executionId: execution.id,
      ruleName: execution.rule.name,
      eventId: execution.event.id,
    });

    const lockResource = this.getLockResource(execution.rule);

    try {
      if (this.config.enableConcurrencyControl) {
        await this.lock.withLock(
          lockResource,
          async () => {
            await this.executeRuleActions(execution);
          },
          { timeout: execution.rule.guards.timeout * 1000 }
        );
      } else {
        await this.executeRuleActions(execution);
      }

      execution.status = 'completed';
      execution.completedAt = new Date();

      logger.info('Rule execution completed', {
        executionId: execution.id,
        ruleName: execution.rule.name,
        duration: this.getExecutionDuration(execution),
      });
    } catch (error: any) {
      execution.status = 'failed';
      execution.completedAt = new Date();
      execution.error = error.message;

      logger.error('Rule execution failed', {
        executionId: execution.id,
        ruleName: execution.rule.name,
        error: error.message,
        duration: this.getExecutionDuration(execution),
      });

      if (execution.rule.guards.on_error === 'abort') {
        this.cleanup();
        throw error;
      }
    } finally {
      this.cleanupCompletedExecutions();
    }
  }

  private async executeRuleActions(execution: QueuedExecution): Promise<void> {
    const { rule, event } = execution;

    for (const action of rule.actions) {
      logger.debug('Executing rule action', {
        executionId: execution.id,
        actionType: action.type,
      });

      switch (action.type) {
        case 'run_workflow':
          await this.executeWorkflowAction(action, event);
          break;

        case 'shell':
          await this.executeShellAction(action, event);
          break;

        case 'log':
          this.executeLogAction(action, event);
          break;

        case 'notify':
          this.executeNotifyAction(action, event);
          break;

        default:
          logger.warn('Unknown action type', {
            executionId: execution.id,
            actionType: (action as any).type,
          });
      }
    }
  }

  private async executeWorkflowAction(action: any, event: Event): Promise<void> {
    const workflowName = action.workflow;
    const inputs = this.buildWorkflowInputs(action, event);

    logger.info('Executing workflow action', {
      workflowName,
      eventId: event.id,
    });

    await this.workflowEngine.executeWorkflow(workflowName, inputs);
  }

  private async executeShellAction(action: any, event: Event): Promise<void> {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    const command = this.interpolateActionVariables(action.command, event);

    logger.info('Executing shell action', {
      command,
      eventId: event.id,
    });

    await execAsync(command);
  }

  private executeLogAction(action: any, event: Event): void {
    const message = this.interpolateActionVariables(action.message, event);
    const level = action.level || 'info';

    logger.log(level, message, { eventId: event.id });
  }

  private executeNotifyAction(action: any, event: Event): void {
    const message = this.interpolateActionVariables(action.message, event);

    logger.info('Notification action', {
      message,
      eventId: event.id,
      channel: action.channel,
    });
  }

  private buildWorkflowInputs(action: any, event: Event): Record<string, unknown> {
    const inputs = action.inputs || {};
    const eventData = this.extractEventData(event);

    return {
      ...inputs,
      event: eventData,
    };
  }

  private extractEventData(event: Event): Record<string, unknown> {
    return {
      id: event.id,
      type: event.type,
      timestamp: event.timestamp,
      source: event.source,
      ...event.metadata,
      ...(event.type === 'commit' && {
        worktree: (event as any).worktree,
        branch: (event as any).branch,
        commit_hash: (event as any).commit_hash,
        commit_message: (event as any).commit_message,
        author: (event as any).author,
      }),
      ...(event.type === 'file_change' && {
        worktree: (event as any).worktree,
        branch: (event as any).branch,
        files_changed: (event as any).files_changed,
        change_type: (event as any).change_type,
      }),
    };
  }

  private interpolateActionVariables(template: string, event: Event): string {
    const eventData = this.extractEventData(event);

    return template.replace(/\$\{event\.([^}]+)\}/g, (_, path) => {
      const keys = path.split('.');
      let value: any = eventData;

      for (const key of keys) {
        value = value?.[key];
      }

      return value !== undefined ? String(value) : `\${event.${path}}`;
    });
  }

  private getLockResource(rule: Rule): string {
    return `rule:${rule.name}`;
  }

  private getExecutionDuration(execution: QueuedExecution): number {
    if (!execution.startedAt || !execution.completedAt) {
      return 0;
    }

    return execution.completedAt.getTime() - execution.startedAt.getTime();
  }

  private cleanupCompletedExecutions(): void {
    const maxHistorySize = 100;
    const completedExecutions = this.executionQueue.filter(
      (e) => e.status === 'completed' || e.status === 'failed'
    );

    if (completedExecutions.length > maxHistorySize) {
      const toRemove = completedExecutions
        .sort((a, b) => (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0))
        .slice(maxHistorySize);

      this.executionQueue = this.executionQueue.filter((e) => !toRemove.includes(e));

      logger.debug('Cleaned up completed executions', {
        removed: toRemove.length,
      });
    }
  }

  private generateExecutionId(): string {
    return `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  getQueueStatus(): {
    queued: number;
    running: number;
    completed: number;
    failed: number;
    total: number;
  } {
    return {
      queued: this.executionQueue.filter((e) => e.status === 'queued').length,
      running: this.executionQueue.filter((e) => e.status === 'running').length,
      completed: this.executionQueue.filter((e) => e.status === 'completed').length,
      failed: this.executionQueue.filter((e) => e.status === 'failed').length,
      total: this.executionQueue.length,
    };
  }

  getExecutionHistory(limit: number = 50): QueuedExecution[] {
    return this.executionQueue
      .filter((e) => e.status === 'completed' || e.status === 'failed')
      .sort((a, b) => (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0))
      .slice(0, limit);
  }

  cleanup(): void {
    this.stopProcessing();
    this.lock.cleanup();
    this.executionQueue = [];
    logger.info('Orchestrator cleanup completed');
  }
}

export function createExecutionOrchestrator(
  ruleEngine: RuleEngine,
  workflowEngine: WorkflowEngine,
  config?: Partial<OrchestratorConfig>
): ExecutionOrchestrator {
  return new ExecutionOrchestrator(ruleEngine, workflowEngine, config);
}
