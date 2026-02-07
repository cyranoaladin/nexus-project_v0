import { getLogger } from '../core/utils/logger';
import { loadConfig } from '../core/config/loader';
import { RuleEngine } from '../core/rules/engine';
import { WorkflowEngine } from '../core/workflows/engine';
import { getEventEmitter } from '../core/events/emitter';
import { TaskScheduler } from './scheduler';
import { HealthCheck } from './healthcheck';
import type { Event } from '../core/events/types';
import type { DaemonConfig } from './types';

export class DaemonServer {
  private logger = getLogger();
  private config: DaemonConfig;
  private ruleEngine: RuleEngine;
  private workflowEngine: WorkflowEngine;
  private eventEmitter = getEventEmitter();
  private scheduler: TaskScheduler;
  private healthCheck: HealthCheck;
  private running = false;
  private shutdownInProgress = false;

  constructor(config?: Partial<DaemonConfig>) {
    const settings = loadConfig();
    
    this.config = {
      eventProcessingInterval: config?.eventProcessingInterval ?? 1000,
      maxBatchSize: config?.maxBatchSize ?? 10,
      healthCheckPort: config?.healthCheckPort ?? 3030,
      schedulerEnabled: config?.schedulerEnabled ?? true,
      ...config,
    };

    this.ruleEngine = new RuleEngine({
      rulesDirectory: '.zenflow/rules',
      autoLoad: true,
    });

    this.workflowEngine = new WorkflowEngine({
      workflowsDirectory: '.zenflow/workflows',
      stateDirectory: '.zenflow/state/executions',
      maxConcurrent: 1,
    });

    this.scheduler = new TaskScheduler(this.workflowEngine);
    this.healthCheck = new HealthCheck({
      port: this.config.healthCheckPort,
      ruleEngine: this.ruleEngine,
      workflowEngine: this.workflowEngine,
      eventEmitter: this.eventEmitter,
    });

    this.setupSignalHandlers();
    
    this.logger.info('DaemonServer initialized', {
      config: this.config,
    });
  }

  async start(): Promise<void> {
    if (this.running) {
      this.logger.warn('Daemon is already running');
      return;
    }

    this.logger.info('Starting Zenflow daemon');

    try {
      await this.ruleEngine.loadRules();
      this.logger.info('Rules loaded successfully');

      this.eventEmitter.startProcessing(
        (event) => this.processEvent(event),
        {
          intervalMs: this.config.eventProcessingInterval,
          maxBatchSize: this.config.maxBatchSize,
        }
      );
      this.logger.info('Event processing started');

      if (this.config.schedulerEnabled) {
        await this.scheduler.start();
        this.logger.info('Scheduler started');
      }

      await this.healthCheck.start();
      this.logger.info('Health check service started', {
        port: this.config.healthCheckPort,
      });

      this.running = true;
      this.logger.info('Zenflow daemon is now running');

    } catch (error) {
      this.logger.error('Failed to start daemon', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.running || this.shutdownInProgress) {
      return;
    }

    this.shutdownInProgress = true;
    this.logger.info('Stopping Zenflow daemon');

    try {
      this.eventEmitter.stopProcessing();
      this.logger.info('Event processing stopped');

      if (this.config.schedulerEnabled) {
        this.scheduler.stop();
        this.logger.info('Scheduler stopped');
      }

      await this.healthCheck.stop();
      this.logger.info('Health check service stopped');

      const queueSize = this.eventEmitter.getQueueSize();
      if (queueSize > 0) {
        this.logger.warn(`Daemon stopped with ${queueSize} events still in queue`);
      }

      this.running = false;
      this.shutdownInProgress = false;
      this.logger.info('Zenflow daemon stopped successfully');

    } catch (error) {
      this.logger.error('Error during daemon shutdown', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async processEvent(event: Event): Promise<void> {
    this.logger.debug('Processing event', {
      id: event.id,
      type: event.type,
      source: event.source,
    });

    try {
      const matchingRules = await this.ruleEngine.evaluateEvent(event);

      if (matchingRules.length === 0) {
        this.logger.debug('No rules matched for event', { eventId: event.id });
        return;
      }

      this.logger.info('Rules matched for event', {
        eventId: event.id,
        ruleCount: matchingRules.length,
        ruleNames: matchingRules.map(r => r.name),
      });

      for (const rule of matchingRules) {
        if (!rule.enabled) {
          this.logger.debug('Skipping disabled rule', { ruleName: rule.name });
          continue;
        }

        try {
          this.logger.info('Executing workflow for rule', {
            ruleName: rule.name,
            workflowName: rule.action.workflow,
          });

          const inputs = this.buildWorkflowInputs(rule.action.inputs || {}, event);

          await this.workflowEngine.executeWorkflow(
            rule.action.workflow,
            inputs
          );

          this.logger.info('Workflow execution completed', {
            ruleName: rule.name,
            workflowName: rule.action.workflow,
          });

        } catch (error) {
          this.logger.error('Workflow execution failed', {
            ruleName: rule.name,
            workflowName: rule.action.workflow,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

    } catch (error) {
      this.logger.error('Error processing event', {
        eventId: event.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private buildWorkflowInputs(
    inputTemplate: Record<string, unknown>,
    event: Event
  ): Record<string, unknown> {
    const inputs: Record<string, unknown> = { ...inputTemplate };

    if ('branch' in event) {
      inputs.branch = (event as any).branch;
    }
    if ('worktree' in event) {
      inputs.worktree = (event as any).worktree;
    }

    inputs.event_id = event.id;
    inputs.event_type = event.type;
    inputs.event_timestamp = event.timestamp;

    return inputs;
  }

  private setupSignalHandlers(): void {
    const handleShutdown = async (signal: string) => {
      this.logger.info(`Received ${signal}, initiating graceful shutdown`);
      
      try {
        await this.stop();
        process.exit(0);
      } catch (error) {
        this.logger.error('Error during shutdown', {
          error: error instanceof Error ? error.message : String(error),
        });
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
    process.on('SIGINT', () => handleShutdown('SIGINT'));

    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught exception', {
        error: error.message,
        stack: error.stack,
      });
      handleShutdown('uncaughtException').catch(() => process.exit(1));
    });

    process.on('unhandledRejection', (reason) => {
      this.logger.error('Unhandled rejection', {
        reason: reason instanceof Error ? reason.message : String(reason),
      });
    });
  }

  getStatus(): {
    running: boolean;
    eventQueueSize: number;
    schedulerRunning: boolean;
    healthCheckRunning: boolean;
  } {
    return {
      running: this.running,
      eventQueueSize: this.eventEmitter.getQueueSize(),
      schedulerRunning: this.scheduler.isRunning(),
      healthCheckRunning: this.healthCheck.isRunning(),
    };
  }
}

let daemonInstance: DaemonServer | null = null;

export function getDaemonServer(config?: Partial<DaemonConfig>): DaemonServer {
  if (!daemonInstance) {
    daemonInstance = new DaemonServer(config);
  }
  return daemonInstance;
}

export async function startDaemon(config?: Partial<DaemonConfig>): Promise<DaemonServer> {
  const daemon = getDaemonServer(config);
  await daemon.start();
  return daemon;
}

export async function stopDaemon(): Promise<void> {
  if (daemonInstance) {
    await daemonInstance.stop();
    daemonInstance = null;
  }
}

if (require.main === module) {
  startDaemon()
    .then(() => {
      console.log('Zenflow daemon started successfully');
    })
    .catch((error) => {
      console.error('Failed to start daemon:', error);
      process.exit(1);
    });
}
