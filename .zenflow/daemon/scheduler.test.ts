import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { TaskScheduler } from './scheduler';
import { WorkflowEngine } from '../core/workflows/engine';
import type { ScheduledTask } from './types';

jest.mock('../core/utils/logger', () => ({
  getLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

jest.mock('../core/workflows/engine');

describe('TaskScheduler', () => {
  let tempDir: string;
  let scheduler: TaskScheduler;
  let mockWorkflowEngine: jest.Mocked<WorkflowEngine>;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scheduler-test-'));
    
    mockWorkflowEngine = {
      executeWorkflow: jest.fn().mockResolvedValue({}),
    } as any;

    scheduler = new TaskScheduler(
      mockWorkflowEngine,
      path.join(tempDir, 'scheduler.yaml')
    );
  });

  afterEach(async () => {
    if (scheduler) {
      scheduler.stop();
    }
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Initialization', () => {
    it('should create scheduler instance', () => {
      expect(scheduler).toBeDefined();
      expect(scheduler.isRunning()).toBe(false);
    });
  });

  describe('Start/Stop', () => {
    it('should start scheduler with no tasks', async () => {
      await scheduler.start();
      expect(scheduler.isRunning()).toBe(true);
    });

    it('should stop scheduler', async () => {
      await scheduler.start();
      scheduler.stop();
      expect(scheduler.isRunning()).toBe(false);
    });

    it('should not start twice', async () => {
      await scheduler.start();
      await scheduler.start();
      expect(scheduler.isRunning()).toBe(true);
    });

    it('should handle stop when not running', () => {
      expect(() => scheduler.stop()).not.toThrow();
    });
  });

  describe('Task Management', () => {
    const validTask: ScheduledTask = {
      id: 'test-task',
      name: 'Test Task',
      workflow: 'test-workflow',
      cron: '@hourly',
      enabled: true,
      inputs: { test: 'value' },
    };

    it('should add a task', async () => {
      await scheduler.addTask(validTask);

      const tasks = scheduler.getTasks();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe('test-task');
    });

    it('should get a task by id', async () => {
      await scheduler.addTask(validTask);

      const task = scheduler.getTask('test-task');
      expect(task).toBeDefined();
      expect(task?.name).toBe('Test Task');
    });

    it('should remove a task', async () => {
      await scheduler.addTask(validTask);
      expect(scheduler.getTasks()).toHaveLength(1);

      await scheduler.removeTask('test-task');
      expect(scheduler.getTasks()).toHaveLength(0);
    });

    it('should throw when removing non-existent task', async () => {
      await expect(scheduler.removeTask('non-existent')).rejects.toThrow();
    });

    it('should enable a task', async () => {
      const disabledTask = { ...validTask, enabled: false };
      await scheduler.addTask(disabledTask);

      await scheduler.enableTask('test-task');

      const task = scheduler.getTask('test-task');
      expect(task?.enabled).toBe(true);
    });

    it('should disable a task', async () => {
      await scheduler.addTask(validTask);

      await scheduler.disableTask('test-task');

      const task = scheduler.getTask('test-task');
      expect(task?.enabled).toBe(false);
    });

    it('should throw when enabling non-existent task', async () => {
      await expect(scheduler.enableTask('non-existent')).rejects.toThrow();
    });

    it('should throw when disabling non-existent task', async () => {
      await expect(scheduler.disableTask('non-existent')).rejects.toThrow();
    });
  });

  describe('Task Validation', () => {
    it('should reject task without id', async () => {
      const invalidTask = {
        name: 'Test',
        workflow: 'test',
        cron: '@hourly',
        enabled: true,
      } as any;

      await expect(scheduler.addTask(invalidTask)).rejects.toThrow();
    });

    it('should reject task without name', async () => {
      const invalidTask = {
        id: 'test',
        workflow: 'test',
        cron: '@hourly',
        enabled: true,
      } as any;

      await expect(scheduler.addTask(invalidTask)).rejects.toThrow();
    });

    it('should reject task without workflow', async () => {
      const invalidTask = {
        id: 'test',
        name: 'Test',
        cron: '@hourly',
        enabled: true,
      } as any;

      await expect(scheduler.addTask(invalidTask)).rejects.toThrow();
    });

    it('should reject task without cron', async () => {
      const invalidTask = {
        id: 'test',
        name: 'Test',
        workflow: 'test',
        enabled: true,
      } as any;

      await expect(scheduler.addTask(invalidTask)).rejects.toThrow();
    });
  });

  describe('Cron Parsing', () => {
    it('should parse @hourly expression', async () => {
      const task: ScheduledTask = {
        id: 'hourly-task',
        name: 'Hourly Task',
        workflow: 'test-workflow',
        cron: '@hourly',
        enabled: true,
      };

      await scheduler.addTask(task);
      await scheduler.start();

      expect(scheduler.isRunning()).toBe(true);
    });

    it('should parse @daily expression', async () => {
      const task: ScheduledTask = {
        id: 'daily-task',
        name: 'Daily Task',
        workflow: 'test-workflow',
        cron: '@daily',
        enabled: true,
      };

      await scheduler.addTask(task);
      await scheduler.start();

      expect(scheduler.isRunning()).toBe(true);
    });

    it('should parse interval expressions', async () => {
      const task: ScheduledTask = {
        id: 'interval-task',
        name: 'Interval Task',
        workflow: 'test-workflow',
        cron: '5 minutes',
        enabled: true,
      };

      await scheduler.addTask(task);
      await scheduler.start();

      expect(scheduler.isRunning()).toBe(true);
    });

    it('should skip tasks with invalid cron', async () => {
      const task: ScheduledTask = {
        id: 'invalid-task',
        name: 'Invalid Task',
        workflow: 'test-workflow',
        cron: 'invalid-cron',
        enabled: true,
      };

      await scheduler.addTask(task);
      await scheduler.start();

      expect(scheduler.isRunning()).toBe(true);
    });
  });

  describe('Task Execution', () => {
    it('should execute scheduled task', async () => {
      const task: ScheduledTask = {
        id: 'exec-task',
        name: 'Execution Task',
        workflow: 'test-workflow',
        cron: '100 minute',
        enabled: true,
        inputs: { test: 'value' },
      };

      await scheduler.addTask(task);
      await scheduler.start();

      await new Promise(resolve => setTimeout(resolve, 150));

      expect(mockWorkflowEngine.executeWorkflow).toHaveBeenCalledWith(
        'test-workflow',
        { test: 'value' }
      );
    });

    it('should not execute disabled tasks', async () => {
      const task: ScheduledTask = {
        id: 'disabled-task',
        name: 'Disabled Task',
        workflow: 'test-workflow',
        cron: '100 minute',
        enabled: false,
      };

      await scheduler.addTask(task);
      await scheduler.start();

      await new Promise(resolve => setTimeout(resolve, 150));

      expect(mockWorkflowEngine.executeWorkflow).not.toHaveBeenCalled();
    });

    it('should handle workflow execution errors', async () => {
      mockWorkflowEngine.executeWorkflow.mockRejectedValueOnce(
        new Error('Workflow failed')
      );

      const task: ScheduledTask = {
        id: 'error-task',
        name: 'Error Task',
        workflow: 'test-workflow',
        cron: '100 minute',
        enabled: true,
      };

      await scheduler.addTask(task);
      await scheduler.start();

      await new Promise(resolve => setTimeout(resolve, 150));

      expect(scheduler.isRunning()).toBe(true);
    });
  });

  describe('Persistence', () => {
    it('should load tasks from config file', async () => {
      const configPath = path.join(tempDir, 'scheduler.yaml');
      const config = {
        tasks: [
          {
            id: 'loaded-task',
            name: 'Loaded Task',
            workflow: 'test-workflow',
            cron: '@hourly',
            enabled: true,
          },
        ],
      };

      await fs.writeFile(configPath, JSON.stringify(config));

      const newScheduler = new TaskScheduler(mockWorkflowEngine, configPath);
      await newScheduler.start();

      const tasks = newScheduler.getTasks();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe('loaded-task');

      newScheduler.stop();
    });

    it('should handle missing config file', async () => {
      const nonExistentPath = path.join(tempDir, 'non-existent.yaml');
      const newScheduler = new TaskScheduler(mockWorkflowEngine, nonExistentPath);

      await expect(newScheduler.start()).resolves.not.toThrow();
      expect(newScheduler.getTasks()).toHaveLength(0);

      newScheduler.stop();
    });
  });
});
