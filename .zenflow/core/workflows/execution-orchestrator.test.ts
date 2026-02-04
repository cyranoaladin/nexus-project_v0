/**
 * @jest-environment node
 */

import { ExecutionOrchestrator, createExecutionOrchestrator } from './execution-orchestrator';
import { RuleEngine } from '../rules/engine';
import { WorkflowEngine } from './engine';
import { Event, CommitEvent } from '../events/types';
import { Rule } from '../rules/types';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('../utils/logger', () => ({
  getLogger: () => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    log: jest.fn(),
  }),
}));

jest.setTimeout(30000);

describe('ExecutionOrchestrator', () => {
  let orchestrator: ExecutionOrchestrator;
  let ruleEngine: RuleEngine;
  let workflowEngine: WorkflowEngine;
  let testDir: string;
  let rulesDir: string;
  let workflowsDir: string;

  beforeEach(() => {
    testDir = path.join(__dirname, '__test_orchestrator__');
    rulesDir = path.join(testDir, 'rules');
    workflowsDir = path.join(testDir, 'workflows');

    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }

    fs.mkdirSync(rulesDir, { recursive: true });
    fs.mkdirSync(workflowsDir, { recursive: true });

    ruleEngine = new RuleEngine({ rulesDirectory: rulesDir });
    workflowEngine = new WorkflowEngine({ workflowsDirectory: workflowsDir });

    orchestrator = new ExecutionOrchestrator(ruleEngine, workflowEngine, {
      maxConcurrentExecutions: 1,
      queueProcessInterval: 100,
      enableConcurrencyControl: true,
    });
  });

  afterEach(() => {
    orchestrator.cleanup();
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('handleEvent', () => {
    it('should handle event and queue matching rules', async () => {
      const rule: Rule = {
        name: 'test-rule',
        version: '1.0.0',
        description: 'Test rule',
        author: 'test',
        enabled: true,
        triggers: [{ type: 'commit' }],
        conditions: [],
        actions: [{ type: 'log', message: 'Test action' }],
        guards: {
          max_retries: 3,
          timeout: 300,
          on_error: 'abort',
        },
      };

      const ruleFile = path.join(rulesDir, 'test-rule.yaml');
      const yaml = require('js-yaml');
      fs.writeFileSync(ruleFile, yaml.dump(rule));

      await ruleEngine.loadRules();

      const event: CommitEvent = {
        id: 'event-1',
        type: 'commit',
        timestamp: new Date(),
        source: 'test',
        worktree: 'test-worktree',
        branch: 'feature/test',
        commit_hash: 'abc123',
        commit_message: 'Test commit',
        author: 'test@example.com',
      };

      await orchestrator.handleEvent(event);

      const status = orchestrator.getQueueStatus();
      expect(status.queued).toBeGreaterThan(0);
    });

    it('should skip disabled rules', async () => {
      const rule: Rule = {
        name: 'disabled-rule',
        version: '1.0.0',
        description: 'Disabled rule',
        author: 'test',
        enabled: false,
        triggers: [{ type: 'commit' }],
        conditions: [],
        actions: [{ type: 'log', message: 'Test action' }],
        guards: {
          max_retries: 3,
          timeout: 300,
          on_error: 'abort',
        },
      };

      const ruleFile = path.join(rulesDir, 'disabled-rule.yaml');
      const yaml = require('js-yaml');
      fs.writeFileSync(ruleFile, yaml.dump(rule));

      await ruleEngine.loadRules();

      const event: CommitEvent = {
        id: 'event-1',
        type: 'commit',
        timestamp: new Date(),
        source: 'test',
        worktree: 'test-worktree',
        branch: 'feature/test',
        commit_hash: 'abc123',
        commit_message: 'Test commit',
        author: 'test@example.com',
      };

      await orchestrator.handleEvent(event);

      const status = orchestrator.getQueueStatus();
      expect(status.queued).toBe(0);
    });

    it('should handle no matching rules', async () => {
      const event: CommitEvent = {
        id: 'event-1',
        type: 'commit',
        timestamp: new Date(),
        source: 'test',
        worktree: 'test-worktree',
        branch: 'feature/test',
        commit_hash: 'abc123',
        commit_message: 'Test commit',
        author: 'test@example.com',
      };

      await orchestrator.handleEvent(event);

      const status = orchestrator.getQueueStatus();
      expect(status.queued).toBe(0);
    });
  });

  describe('queue processing', () => {
    it('should start and stop queue processing', async () => {
      await orchestrator.startProcessing();
      
      expect(orchestrator['processing']).toBe(true);
      expect(orchestrator['processInterval']).toBeTruthy();
      
      orchestrator.stopProcessing();
      
      expect(orchestrator['processing']).toBe(false);
      expect(orchestrator['processInterval']).toBeNull();
    });

    it('should not start processing twice', async () => {
      await orchestrator.startProcessing();
      await orchestrator.startProcessing();
      
      expect(orchestrator['processing']).toBe(true);
    });

    it('should process queued executions', async () => {
      const rule: Rule = {
        name: 'test-rule',
        version: '1.0.0',
        description: 'Test rule',
        author: 'test',
        enabled: true,
        triggers: [{ type: 'commit' }],
        conditions: [],
        actions: [{ type: 'log', message: 'Test action', level: 'info' }],
        guards: {
          max_retries: 3,
          timeout: 300,
          on_error: 'abort',
        },
      };

      const ruleFile = path.join(rulesDir, 'test-rule.yaml');
      const yaml = require('js-yaml');
      fs.writeFileSync(ruleFile, yaml.dump(rule));

      await ruleEngine.loadRules();

      const event: CommitEvent = {
        id: 'event-1',
        type: 'commit',
        timestamp: new Date(),
        source: 'test',
        worktree: 'test-worktree',
        branch: 'feature/test',
        commit_hash: 'abc123',
        commit_message: 'Test commit',
        author: 'test@example.com',
      };

      await orchestrator.handleEvent(event);
      await orchestrator.startProcessing();

      await new Promise((resolve) => setTimeout(resolve, 500));

      const status = orchestrator.getQueueStatus();
      expect(status.running + status.completed).toBeGreaterThan(0);

      orchestrator.stopProcessing();
    });

    it('should respect max concurrent executions', async () => {
      const orchestrator2 = new ExecutionOrchestrator(ruleEngine, workflowEngine, {
        maxConcurrentExecutions: 2,
        queueProcessInterval: 100,
        enableConcurrencyControl: true,
      });

      const rule: Rule = {
        name: 'slow-rule',
        version: '1.0.0',
        description: 'Slow rule',
        author: 'test',
        enabled: true,
        triggers: [{ type: 'commit' }],
        conditions: [],
        actions: [{ type: 'log', message: 'Slow action' }],
        guards: {
          max_retries: 3,
          timeout: 300,
          on_error: 'abort',
        },
      };

      const ruleFile = path.join(rulesDir, 'slow-rule.yaml');
      const yaml = require('js-yaml');
      fs.writeFileSync(ruleFile, yaml.dump(rule));

      await ruleEngine.loadRules();

      for (let i = 0; i < 5; i++) {
        const event: CommitEvent = {
          id: `event-${i}`,
          type: 'commit',
          timestamp: new Date(),
          source: 'test',
          worktree: 'test-worktree',
          branch: 'feature/test',
          commit_hash: `abc${i}`,
          commit_message: 'Test commit',
          author: 'test@example.com',
        };
        await orchestrator2.handleEvent(event);
      }

      await orchestrator2.startProcessing();

      await new Promise((resolve) => setTimeout(resolve, 200));

      const status = orchestrator2.getQueueStatus();
      expect(status.running).toBeLessThanOrEqual(2);

      orchestrator2.cleanup();
    });
  });

  describe('concurrency control', () => {
    it('should use locks for sync operations', async () => {
      const rule: Rule = {
        name: 'sync-rule',
        version: '1.0.0',
        description: 'Sync rule',
        author: 'test',
        enabled: true,
        triggers: [{ type: 'commit' }],
        conditions: [],
        actions: [{ type: 'log', message: 'Sync action' }],
        guards: {
          max_retries: 3,
          timeout: 300,
          on_error: 'abort',
        },
      };

      const ruleFile = path.join(rulesDir, 'sync-rule.yaml');
      const yaml = require('js-yaml');
      fs.writeFileSync(ruleFile, yaml.dump(rule));

      await ruleEngine.loadRules();

      const event1: CommitEvent = {
        id: 'event-1',
        type: 'commit',
        timestamp: new Date(),
        source: 'test',
        worktree: 'test-worktree',
        branch: 'feature/test',
        commit_hash: 'abc123',
        commit_message: 'Test commit',
        author: 'test@example.com',
      };

      const event2: CommitEvent = {
        id: 'event-2',
        type: 'commit',
        timestamp: new Date(),
        source: 'test',
        worktree: 'test-worktree',
        branch: 'feature/test',
        commit_hash: 'def456',
        commit_message: 'Test commit 2',
        author: 'test@example.com',
      };

      await orchestrator.handleEvent(event1);
      await orchestrator.handleEvent(event2);
      await orchestrator.startProcessing();

      await new Promise((resolve) => setTimeout(resolve, 500));

      const status = orchestrator.getQueueStatus();
      expect(status.completed + status.failed + status.running).toBeGreaterThan(0);

      orchestrator.stopProcessing();
    });

    it('should work without concurrency control when disabled', async () => {
      const orchestrator2 = new ExecutionOrchestrator(ruleEngine, workflowEngine, {
        maxConcurrentExecutions: 5,
        queueProcessInterval: 100,
        enableConcurrencyControl: false,
      });

      const rule: Rule = {
        name: 'no-lock-rule',
        version: '1.0.0',
        description: 'No lock rule',
        author: 'test',
        enabled: true,
        triggers: [{ type: 'commit' }],
        conditions: [],
        actions: [{ type: 'log', message: 'No lock action' }],
        guards: {
          max_retries: 3,
          timeout: 300,
          on_error: 'abort',
        },
      };

      const ruleFile = path.join(rulesDir, 'no-lock-rule.yaml');
      const yaml = require('js-yaml');
      fs.writeFileSync(ruleFile, yaml.dump(rule));

      await ruleEngine.loadRules();

      const event: CommitEvent = {
        id: 'event-1',
        type: 'commit',
        timestamp: new Date(),
        source: 'test',
        worktree: 'test-worktree',
        branch: 'feature/test',
        commit_hash: 'abc123',
        commit_message: 'Test commit',
        author: 'test@example.com',
      };

      await orchestrator2.handleEvent(event);
      await orchestrator2.startProcessing();

      await new Promise((resolve) => setTimeout(resolve, 300));

      const status = orchestrator2.getQueueStatus();
      expect(status.completed + status.failed).toBeGreaterThan(0);

      orchestrator2.cleanup();
    });
  });

  describe('getQueueStatus', () => {
    it('should return queue status', () => {
      const status = orchestrator.getQueueStatus();
      
      expect(status).toHaveProperty('queued');
      expect(status).toHaveProperty('running');
      expect(status).toHaveProperty('completed');
      expect(status).toHaveProperty('failed');
      expect(status).toHaveProperty('total');
      expect(typeof status.queued).toBe('number');
    });
  });

  describe('getExecutionHistory', () => {
    it('should return execution history', () => {
      const history = orchestrator.getExecutionHistory();
      
      expect(Array.isArray(history)).toBe(true);
    });

    it('should respect limit parameter', () => {
      const history = orchestrator.getExecutionHistory(10);
      
      expect(history.length).toBeLessThanOrEqual(10);
    });
  });

  describe('cleanup', () => {
    it('should cleanup orchestrator', async () => {
      await orchestrator.startProcessing();
      
      orchestrator.cleanup();
      
      expect(orchestrator['processing']).toBe(false);
      expect(orchestrator['executionQueue'].length).toBe(0);
    });
  });

  describe('createExecutionOrchestrator', () => {
    it('should create an ExecutionOrchestrator instance', () => {
      const orch = createExecutionOrchestrator(ruleEngine, workflowEngine);
      
      expect(orch).toBeInstanceOf(ExecutionOrchestrator);
      
      orch.cleanup();
    });

    it('should accept custom config', () => {
      const orch = createExecutionOrchestrator(ruleEngine, workflowEngine, {
        maxConcurrentExecutions: 5,
        queueProcessInterval: 2000,
      });
      
      expect(orch).toBeInstanceOf(ExecutionOrchestrator);
      expect(orch['config'].maxConcurrentExecutions).toBe(5);
      expect(orch['config'].queueProcessInterval).toBe(2000);
      
      orch.cleanup();
    });
  });
});
