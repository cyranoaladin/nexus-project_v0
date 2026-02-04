/**
 * @jest-environment node
 */

import { ExecutionOrchestrator } from './execution-orchestrator';
import { RuleEngine } from '../rules/engine';
import { WorkflowEngine } from './engine';
import { CommitEvent } from '../events/types';
import { Rule } from '../rules/types';
import { Workflow } from './types';
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

describe('Orchestrator Integration Tests', () => {
  let orchestrator: ExecutionOrchestrator;
  let ruleEngine: RuleEngine;
  let workflowEngine: WorkflowEngine;
  let testDir: string;
  let rulesDir: string;
  let workflowsDir: string;
  let stateDir: string;

  beforeEach(() => {
    testDir = path.join(__dirname, '__test_integration__');
    rulesDir = path.join(testDir, 'rules');
    workflowsDir = path.join(testDir, 'workflows');
    stateDir = path.join(testDir, 'state');

    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }

    fs.mkdirSync(rulesDir, { recursive: true });
    fs.mkdirSync(workflowsDir, { recursive: true });
    fs.mkdirSync(stateDir, { recursive: true });

    ruleEngine = new RuleEngine({ rulesDirectory: rulesDir });
    workflowEngine = new WorkflowEngine({
      workflowsDirectory: workflowsDir,
      stateDirectory: stateDir,
    });

    orchestrator = new ExecutionOrchestrator(ruleEngine, workflowEngine, {
      maxConcurrentExecutions: 1,
      queueProcessInterval: 50,
      enableConcurrencyControl: true,
    });
  });

  afterEach(() => {
    orchestrator.cleanup();
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('End-to-End Workflow Execution', () => {
    it('should execute complete flow: event -> rule -> workflow', async () => {
      const workflow: Workflow = {
        name: 'test-sync-workflow',
        version: '1.0.0',
        description: 'Test sync workflow',
        author: 'test',
        inputs: {
          branch: { type: 'string', required: true },
          worktree: { type: 'string', required: true },
        },
        steps: [
          {
            id: 'step-1',
            name: 'Log sync start',
            type: 'shell',
            command: 'echo "Starting sync for ${branch}"',
          },
        ],
        error_handling: {
          on_failure: 'abort',
        },
      };

      const workflowFile = path.join(workflowsDir, 'test-sync-workflow.yaml');
      const yaml = require('js-yaml');
      fs.writeFileSync(workflowFile, yaml.dump(workflow));

      const rule: Rule = {
        name: 'auto-sync-rule',
        version: '1.0.0',
        description: 'Auto sync on commit',
        author: 'test',
        enabled: true,
        triggers: [
          {
            type: 'commit',
            branches: { pattern: 'feature/*' },
          },
        ],
        conditions: [
          {
            type: 'branch_check',
            pattern: 'feature/*',
          },
        ],
        actions: [
          {
            type: 'run_workflow',
            workflow: 'test-sync-workflow',
            inputs: {
              branch: '${event.branch}',
              worktree: '${event.worktree}',
            },
          },
        ],
        guards: {
          max_retries: 3,
          timeout: 300,
          on_error: 'abort',
        },
      };

      const ruleFile = path.join(rulesDir, 'auto-sync-rule.yaml');
      fs.writeFileSync(ruleFile, yaml.dump(rule));

      await ruleEngine.loadRules();

      const event: CommitEvent = {
        id: 'event-1',
        type: 'commit',
        timestamp: new Date(),
        source: 'git-hook',
        worktree: '/path/to/worktree',
        branch: 'feature/test-feature',
        commit_hash: 'abc123def456',
        commit_message: 'feat: add new feature',
        author: 'developer@example.com',
      };

      await orchestrator.handleEvent(event);
      
      const initialStatus = orchestrator.getQueueStatus();
      expect(initialStatus.queued).toBeGreaterThan(0);

      await orchestrator.startProcessing();

      await new Promise((resolve) => setTimeout(resolve, 1000));

      const finalStatus = orchestrator.getQueueStatus();
      expect(finalStatus.completed + finalStatus.failed).toBeGreaterThan(0);

      orchestrator.stopProcessing();
    });

    it('should enforce concurrency control for sync operations', async () => {
      const workflow: Workflow = {
        name: 'slow-sync-workflow',
        version: '1.0.0',
        description: 'Slow sync workflow',
        author: 'test',
        inputs: {
          branch: { type: 'string', required: true },
        },
        steps: [
          {
            id: 'step-1',
            name: 'Slow operation',
            type: 'shell',
            command: 'sleep 0.5',
            timeout: 10,
          },
        ],
        error_handling: {
          on_failure: 'abort',
        },
      };

      const workflowFile = path.join(workflowsDir, 'slow-sync-workflow.yaml');
      const yaml = require('js-yaml');
      fs.writeFileSync(workflowFile, yaml.dump(workflow));

      const rule: Rule = {
        name: 'sync-rule',
        version: '1.0.0',
        description: 'Sync rule',
        author: 'test',
        enabled: true,
        triggers: [{ type: 'commit' }],
        conditions: [],
        actions: [
          {
            type: 'run_workflow',
            workflow: 'slow-sync-workflow',
            inputs: {
              branch: '${event.branch}',
            },
          },
        ],
        guards: {
          max_retries: 3,
          timeout: 300,
          on_error: 'abort',
        },
      };

      const ruleFile = path.join(rulesDir, 'sync-rule.yaml');
      fs.writeFileSync(ruleFile, yaml.dump(rule));

      await ruleEngine.loadRules();

      const events: CommitEvent[] = [
        {
          id: 'event-1',
          type: 'commit',
          timestamp: new Date(),
          source: 'test',
          worktree: 'worktree-1',
          branch: 'feature/test-1',
          commit_hash: 'abc1',
          commit_message: 'Test 1',
          author: 'test@example.com',
        },
        {
          id: 'event-2',
          type: 'commit',
          timestamp: new Date(),
          source: 'test',
          worktree: 'worktree-2',
          branch: 'feature/test-2',
          commit_hash: 'abc2',
          commit_message: 'Test 2',
          author: 'test@example.com',
        },
        {
          id: 'event-3',
          type: 'commit',
          timestamp: new Date(),
          source: 'test',
          worktree: 'worktree-3',
          branch: 'feature/test-3',
          commit_hash: 'abc3',
          commit_message: 'Test 3',
          author: 'test@example.com',
        },
      ];

      for (const event of events) {
        await orchestrator.handleEvent(event);
      }

      await orchestrator.startProcessing();

      await new Promise((resolve) => setTimeout(resolve, 300));

      const midStatus = orchestrator.getQueueStatus();
      expect(midStatus.running).toBeLessThanOrEqual(1);

      await new Promise((resolve) => setTimeout(resolve, 2000));

      const finalStatus = orchestrator.getQueueStatus();
      expect(finalStatus.completed + finalStatus.failed).toBeGreaterThan(0);

      orchestrator.stopProcessing();
    });

    it('should handle multiple events for different branches', async () => {
      const workflow: Workflow = {
        name: 'multi-branch-workflow',
        version: '1.0.0',
        description: 'Multi branch workflow',
        author: 'test',
        inputs: {
          branch: { type: 'string', required: true },
        },
        steps: [
          {
            id: 'step-1',
            name: 'Process branch',
            type: 'shell',
            command: 'echo "Processing ${branch}"',
          },
        ],
        error_handling: {
          on_failure: 'abort',
        },
      };

      const workflowFile = path.join(workflowsDir, 'multi-branch-workflow.yaml');
      const yaml = require('js-yaml');
      fs.writeFileSync(workflowFile, yaml.dump(workflow));

      const rule: Rule = {
        name: 'multi-branch-rule',
        version: '1.0.0',
        description: 'Multi branch rule',
        author: 'test',
        enabled: true,
        triggers: [{ type: 'commit' }],
        conditions: [],
        actions: [
          {
            type: 'run_workflow',
            workflow: 'multi-branch-workflow',
            inputs: {
              branch: '${event.branch}',
            },
          },
        ],
        guards: {
          max_retries: 3,
          timeout: 300,
          on_error: 'abort',
        },
      };

      const ruleFile = path.join(rulesDir, 'multi-branch-rule.yaml');
      fs.writeFileSync(ruleFile, yaml.dump(rule));

      await ruleEngine.loadRules();

      const branches = ['feature/test-1', 'feature/test-2', 'bugfix/fix-1'];

      for (const branch of branches) {
        const event: CommitEvent = {
          id: `event-${branch}`,
          type: 'commit',
          timestamp: new Date(),
          source: 'test',
          worktree: `worktree-${branch}`,
          branch,
          commit_hash: `hash-${branch}`,
          commit_message: `Commit for ${branch}`,
          author: 'test@example.com',
        };
        await orchestrator.handleEvent(event);
      }

      await orchestrator.startProcessing();

      await new Promise((resolve) => setTimeout(resolve, 1500));

      const status = orchestrator.getQueueStatus();
      expect(status.completed + status.failed).toBeGreaterThan(0);

      orchestrator.stopProcessing();
    });

    it('should handle workflow execution errors gracefully', async () => {
      const workflow: Workflow = {
        name: 'failing-workflow',
        version: '1.0.0',
        description: 'Failing workflow',
        author: 'test',
        inputs: {},
        steps: [
          {
            id: 'step-1',
            name: 'Failing step',
            type: 'shell',
            command: 'exit 1',
          },
        ],
        error_handling: {
          on_failure: 'abort',
        },
      };

      const workflowFile = path.join(workflowsDir, 'failing-workflow.yaml');
      const yaml = require('js-yaml');
      fs.writeFileSync(workflowFile, yaml.dump(workflow));

      const rule: Rule = {
        name: 'failing-rule',
        version: '1.0.0',
        description: 'Failing rule',
        author: 'test',
        enabled: true,
        triggers: [{ type: 'commit' }],
        conditions: [],
        actions: [
          {
            type: 'run_workflow',
            workflow: 'failing-workflow',
          },
        ],
        guards: {
          max_retries: 1,
          timeout: 300,
          on_error: 'continue',
        },
      };

      const ruleFile = path.join(rulesDir, 'failing-rule.yaml');
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

      await new Promise((resolve) => setTimeout(resolve, 1000));

      const status = orchestrator.getQueueStatus();
      expect(status.failed).toBeGreaterThan(0);

      orchestrator.stopProcessing();
    });

    it('should provide execution history', async () => {
      const workflow: Workflow = {
        name: 'history-workflow',
        version: '1.0.0',
        description: 'History workflow',
        author: 'test',
        inputs: {},
        steps: [
          {
            id: 'step-1',
            name: 'Quick step',
            type: 'shell',
            command: 'echo "test"',
          },
        ],
        error_handling: {
          on_failure: 'abort',
        },
      };

      const workflowFile = path.join(workflowsDir, 'history-workflow.yaml');
      const yaml = require('js-yaml');
      fs.writeFileSync(workflowFile, yaml.dump(workflow));

      const rule: Rule = {
        name: 'history-rule',
        version: '1.0.0',
        description: 'History rule',
        author: 'test',
        enabled: true,
        triggers: [{ type: 'commit' }],
        conditions: [],
        actions: [
          {
            type: 'run_workflow',
            workflow: 'history-workflow',
          },
        ],
        guards: {
          max_retries: 3,
          timeout: 300,
          on_error: 'abort',
        },
      };

      const ruleFile = path.join(rulesDir, 'history-rule.yaml');
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

      await new Promise((resolve) => setTimeout(resolve, 1000));

      const history = orchestrator.getExecutionHistory(10);
      expect(history.length).toBeGreaterThan(0);

      const execution = history[0];
      expect(execution).toHaveProperty('id');
      expect(execution).toHaveProperty('event');
      expect(execution).toHaveProperty('rule');
      expect(execution).toHaveProperty('status');

      orchestrator.stopProcessing();
    });
  });
});
