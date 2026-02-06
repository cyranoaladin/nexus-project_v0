import * as fs from 'fs/promises';
import * as path from 'path';
import yaml from 'js-yaml';
import { getLogger } from '../core/utils/logger';
import { WorkflowEngine } from '../core/workflows/engine';
import type { ScheduledTask } from './types';

export class TaskScheduler {
  private logger = getLogger();
  private workflowEngine: WorkflowEngine;
  private tasks: Map<string, ScheduledTask> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private running = false;
  private configPath: string;

  constructor(workflowEngine: WorkflowEngine, configPath = '.zenflow/scheduler.yaml') {
    this.workflowEngine = workflowEngine;
    this.configPath = configPath;
    this.logger.debug('TaskScheduler initialized');
  }

  async start(): Promise<void> {
    if (this.running) {
      this.logger.warn('Scheduler is already running');
      return;
    }

    this.logger.info('Starting task scheduler');

    try {
      await this.loadTasks();
      this.scheduleTasks();
      this.running = true;
      this.logger.info(`Scheduler started with ${this.tasks.size} tasks`);
    } catch (error) {
      this.logger.error('Failed to start scheduler', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  stop(): void {
    if (!this.running) {
      return;
    }

    this.logger.info('Stopping task scheduler');

    for (const [taskId, timer] of Array.from(this.timers.entries())) {
      clearInterval(timer);
      this.logger.debug('Cleared timer for task', { taskId });
    }

    this.timers.clear();
    this.running = false;
    this.logger.info('Scheduler stopped');
  }

  private async loadTasks(): Promise<void> {
    const configFile = path.resolve(process.cwd(), this.configPath);

    try {
      await fs.access(configFile);
    } catch {
      this.logger.info('No scheduler config file found, starting with empty schedule');
      return;
    }

    try {
      const content = await fs.readFile(configFile, 'utf-8');
      const config = yaml.load(content) as { tasks?: ScheduledTask[] };

      if (!config.tasks || !Array.isArray(config.tasks)) {
        this.logger.warn('Invalid scheduler config, expected tasks array');
        return;
      }

      this.tasks.clear();
      for (const task of config.tasks) {
        if (this.validateTask(task)) {
          this.tasks.set(task.id, task);
          this.logger.debug('Loaded scheduled task', {
            id: task.id,
            name: task.name,
            workflow: task.workflow,
          });
        }
      }

      this.logger.info(`Loaded ${this.tasks.size} scheduled tasks`);
    } catch (error) {
      this.logger.error('Failed to load scheduler config', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private validateTask(task: any): task is ScheduledTask {
    if (!task.id || typeof task.id !== 'string') {
      this.logger.warn('Task missing id field', { task });
      return false;
    }
    if (!task.name || typeof task.name !== 'string') {
      this.logger.warn('Task missing name field', { taskId: task.id });
      return false;
    }
    if (!task.workflow || typeof task.workflow !== 'string') {
      this.logger.warn('Task missing workflow field', { taskId: task.id });
      return false;
    }
    if (!task.cron || typeof task.cron !== 'string') {
      this.logger.warn('Task missing cron field', { taskId: task.id });
      return false;
    }
    return true;
  }

  private scheduleTasks(): void {
    for (const [taskId, task] of Array.from(this.tasks.entries())) {
      if (!task.enabled) {
        this.logger.debug('Skipping disabled task', { taskId });
        continue;
      }

      const intervalMs = this.parseCronToInterval(task.cron);
      if (intervalMs === null) {
        this.logger.warn('Invalid cron expression, skipping task', {
          taskId,
          cron: task.cron,
        });
        continue;
      }

      const timer = setInterval(async () => {
        await this.executeTask(task);
      }, intervalMs);

      this.timers.set(taskId, timer);

      this.logger.info('Scheduled task', {
        taskId,
        name: task.name,
        intervalMs,
      });
    }
  }

  private parseCronToInterval(cron: string): number | null {
    const patterns: Record<string, number> = {
      '@hourly': 60 * 60 * 1000,
      '@daily': 24 * 60 * 60 * 1000,
      '@weekly': 7 * 24 * 60 * 60 * 1000,
    };

    if (cron in patterns) {
      return patterns[cron];
    }

    const match = cron.match(/^(\d+)\s+(millisecond|second|minute|hour|day)s?$/i);
    if (match) {
      const value = parseInt(match[1], 10);
      const unit = match[2].toLowerCase();

      const multipliers: Record<string, number> = {
        millisecond: 1,
        second: 1000,
        minute: 60 * 1000,
        hour: 60 * 60 * 1000,
        day: 24 * 60 * 60 * 1000,
      };

      return value * multipliers[unit];
    }

    return null;
  }

  private async executeTask(task: ScheduledTask): Promise<void> {
    this.logger.info('Executing scheduled task', {
      taskId: task.id,
      name: task.name,
      workflow: task.workflow,
    });

    try {
      task.lastRun = new Date();

      await this.workflowEngine.executeWorkflow(
        task.workflow,
        task.inputs || {}
      );

      this.logger.info('Scheduled task completed successfully', {
        taskId: task.id,
        name: task.name,
      });
    } catch (error) {
      this.logger.error('Scheduled task failed', {
        taskId: task.id,
        name: task.name,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async addTask(task: ScheduledTask): Promise<void> {
    if (!this.validateTask(task)) {
      throw new Error('Invalid task configuration');
    }

    this.tasks.set(task.id, task);
    this.logger.info('Added new task to scheduler', {
      taskId: task.id,
      name: task.name,
    });

    if (this.running && task.enabled) {
      const intervalMs = this.parseCronToInterval(task.cron);
      if (intervalMs !== null) {
        const timer = setInterval(async () => {
          await this.executeTask(task);
        }, intervalMs);

        this.timers.set(task.id, timer);
        this.logger.info('Task scheduled', { taskId: task.id });
      }
    }

    await this.saveTasks();
  }

  async removeTask(taskId: string): Promise<void> {
    if (!this.tasks.has(taskId)) {
      throw new Error(`Task not found: ${taskId}`);
    }

    const timer = this.timers.get(taskId);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(taskId);
    }

    this.tasks.delete(taskId);
    this.logger.info('Removed task from scheduler', { taskId });

    await this.saveTasks();
  }

  async enableTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    task.enabled = true;
    this.logger.info('Task enabled', { taskId });

    if (this.running) {
      const intervalMs = this.parseCronToInterval(task.cron);
      if (intervalMs !== null) {
        const timer = setInterval(async () => {
          await this.executeTask(task);
        }, intervalMs);

        this.timers.set(taskId, timer);
      }
    }

    await this.saveTasks();
  }

  async disableTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    task.enabled = false;
    this.logger.info('Task disabled', { taskId });

    const timer = this.timers.get(taskId);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(taskId);
    }

    await this.saveTasks();
  }

  getTasks(): ScheduledTask[] {
    return Array.from(this.tasks.values());
  }

  getTask(taskId: string): ScheduledTask | undefined {
    return this.tasks.get(taskId);
  }

  isRunning(): boolean {
    return this.running;
  }

  private async saveTasks(): Promise<void> {
    try {
      const config = {
        tasks: Array.from(this.tasks.values()),
      };

      const content = yaml.dump(config, {
        indent: 2,
        lineWidth: 100,
      });

      const configFile = path.resolve(process.cwd(), this.configPath);
      const dir = path.dirname(configFile);

      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(configFile, content, 'utf-8');

      this.logger.debug('Saved scheduler config', { path: configFile });
    } catch (error) {
      this.logger.error('Failed to save scheduler config', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
