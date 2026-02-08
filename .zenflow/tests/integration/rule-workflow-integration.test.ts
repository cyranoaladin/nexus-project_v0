import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import yaml from 'js-yaml';
import { RuleEngine } from '../../core/rules/engine';
import { WorkflowEngine } from '../../core/workflows/engine';
import type { Rule, RuleEngineConfig } from '../../core/rules/types';
import type { Workflow, WorkflowEngineConfig } from '../../core/workflows/types';
import type { CommitEvent } from '../../core/events/types';

jest.mock('../../core/utils/logger', () => ({
  getLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    log: jest.fn(),
  })),
}));

jest.mock('../../core/git/client', () => ({
  GitClient: jest.fn().mockImplementation(() => ({
    getWorktree: jest.fn().mockResolvedValue({
      path: '/test/worktree',
      branch: 'refs/heads/feature-branch',
      commit_hash: 'abc123',
      locked: false,
      prunable: false,
    }),
  })),
}));

jest.mock('../../core/sync/conflicts', () => ({
  ConflictDetector: jest.fn().mockImplementation(() => ({
    quickCheck: jest.fn().mockResolvedValue({
      has_conflicts: false,
      conflicted_files: [],
      conflict_type: 'none',
    }),
  })),
}));

describe('Rule Engine + Workflow Engine Integration', () => {
  let tempDir: string;
  let rulesDir: string;
  let workflowsDir: string;
  let stateDir: string;
  let ruleEngine: RuleEngine;
  let workflowEngine: WorkflowEngine;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zenflow-integration-'));
    rulesDir = path.join(tempDir, 'rules');
    workflowsDir = path.join(tempDir, 'workflows');
    stateDir = path.join(tempDir, 'state');

    await fs.mkdir(rulesDir, { recursive: true });
    await fs.mkdir(workflowsDir, { recursive: true });
    await fs.mkdir(stateDir, { recursive: true });

    const ruleConfig: RuleEngineConfig = {
      rulesDirectory: rulesDir,
      autoLoad: false,
      validationStrict: false,
    };

    const workflowConfig: WorkflowEngineConfig = {
      workflowsDirectory: workflowsDir,
      stateDirectory: stateDir,
      maxConcurrent: 1,
    };

    ruleEngine = new RuleEngine(ruleConfig);
    workflowEngine = new WorkflowEngine(workflowConfig);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Rule triggers workflow execution', () => {
    it('should execute workflow when rule conditions are met', async () => {
      const workflow: Workflow = {
        name: 'test-workflow',
        version: '1.0.0',
        description: '',
        author: 'test',
        inputs: [
          {
            name: 'branch',
            type: 'string',
            required: true,
          },
        ],
        outputs: [],
        steps: [
          {
            id: 'step-1',
            name: 'Log message',
            type: 'shell',
            command: 'echo "Workflow executed for branch: {{ branch }}"',
            timeout: 30000,
          },
        ],
        error_handling: {
          strategy: 'abort',
        },
      };

      const rule: Rule = {
        name: 'trigger-workflow-rule',
        version: '1.0.0',
        description: 'Rule that triggers a workflow',
        author: 'Test',
        enabled: true,
        triggers: [
          {
            type: 'commit',
            branches: { pattern: 'feature-*' },
          },
        ],
        conditions: [],
        actions: [
          {
            type: 'run_workflow',
            workflow: 'test-workflow',
            inputs: {
              branch: '{{ event.branch }}',
            },
          },
        ],
        guards: {
          on_error: 'continue',
        max_retries: 3,
        timeout: 300,
        },
      };

      const workflowPath = path.join(workflowsDir, 'test-workflow.yaml');
      await fs.writeFile(workflowPath, yaml.dump(workflow), 'utf-8');

      const rulePath = path.join(rulesDir, 'trigger-workflow-rule.yaml');
      await fs.writeFile(rulePath, yaml.dump(rule), 'utf-8');

      await ruleEngine.loadRules();

      const event: CommitEvent = {
        type: 'commit',
        id: 'test-event-id',
        timestamp: new Date(),
        source: 'git',
        worktree: '/path/to/worktree',
        branch: 'feature-branch',
        commit_hash: 'abc123',
        commit_message: 'Test commit',
        author: 'Test Author',
      };

      const matchingRules = await ruleEngine.findMatchingRules(event);
      expect(matchingRules).toHaveLength(1);
      expect(matchingRules[0].name).toBe('trigger-workflow-rule');

      const execution = await workflowEngine.executeWorkflow('test-workflow', {
        branch: event.branch,
      });

      expect(execution.status).toBe('success');
      expect(execution.workflow_name).toBe('test-workflow');
    });

    it('should handle workflow failures in rule actions', async () => {
      const workflow: Workflow = {
        name: 'failing-workflow',
        version: '1.0.0',
        description: '',
        author: 'test',
        inputs: [],
        outputs: [],
        steps: [
          {
            id: 'failing-step',
            name: 'Failing step',
            type: 'shell',
            command: 'exit 1',
            timeout: 30000,
          },
        ],
        error_handling: {
          strategy: 'abort',
        },
      };

      const rule: Rule = {
        name: 'failing-workflow-rule',
        version: '1.0.0',
        description: 'Rule with failing workflow',
        author: 'Test',
        enabled: true,
        triggers: [
          {
            type: 'commit',
            branches: { pattern: '*' },
          },
        ],
        conditions: [],
        actions: [
          {
            type: 'run_workflow',
            workflow: 'failing-workflow',
            inputs: {},
          },
        ],
        guards: {
          on_error: 'continue',
        max_retries: 3,
        timeout: 300,
        },
      };

      const workflowPath = path.join(workflowsDir, 'failing-workflow.yaml');
      await fs.writeFile(workflowPath, yaml.dump(workflow), 'utf-8');

      const rulePath = path.join(rulesDir, 'failing-workflow-rule.yaml');
      await fs.writeFile(rulePath, yaml.dump(rule), 'utf-8');

      await ruleEngine.loadRules();

      const event: CommitEvent = {
        id: 'test-event-id',
        type: 'commit',
        timestamp: new Date(),
        source: 'git',
        worktree: '/path/to/worktree',
        branch: 'main',
        commit_hash: 'def456',
        commit_message: 'Test commit',
        author: 'Test Author',
      };

      const matchingRules = await ruleEngine.findMatchingRules(event);
      expect(matchingRules).toHaveLength(1);

      await expect(
        workflowEngine.executeWorkflow('failing-workflow', {})
      ).rejects.toThrow();
    });
  });

  describe('Multiple rules triggering workflows', () => {
    it('should execute multiple workflows when multiple rules match', async () => {
      const workflow1: Workflow = {
        name: 'workflow-1',
        version: '1.0.0',
        description: '',
        author: 'test',
        inputs: [],
        outputs: [],
        steps: [
          {
            id: 'step-1',
            name: 'Step 1',
            type: 'shell',
            command: 'echo "Workflow 1"',
            timeout: 30000,
          },
        ],
        error_handling: {
          strategy: 'abort',
        },
      };

      const workflow2: Workflow = {
        name: 'workflow-2',
        version: '1.0.0',
        description: '',
        author: 'test',
        inputs: [],
        outputs: [],
        steps: [
          {
            id: 'step-1',
            name: 'Step 1',
            type: 'shell',
            command: 'echo "Workflow 2"',
            timeout: 30000,
          },
        ],
        error_handling: {
          strategy: 'abort',
        },
      };

      const rule1: Rule = {
        name: 'rule-1',
        version: '1.0.0',
        description: 'First rule',
        author: 'Test',
        enabled: true,
        triggers: [
          {
            type: 'commit',
            branches: { pattern: '*' },
          },
        ],
        conditions: [],
        actions: [
          {
            type: 'run_workflow',
            workflow: 'workflow-1',
            inputs: {},
          },
        ],
        guards: {
          on_error: 'continue',
        max_retries: 3,
        timeout: 300,
        },
      };

      const rule2: Rule = {
        name: 'rule-2',
        version: '1.0.0',
        description: 'Second rule',
        author: 'Test',
        enabled: true,
        triggers: [
          {
            type: 'commit',
            branches: { pattern: '*' },
          },
        ],
        conditions: [],
        actions: [
          {
            type: 'run_workflow',
            workflow: 'workflow-2',
            inputs: {},
          },
        ],
        guards: {
          on_error: 'continue',
        max_retries: 3,
        timeout: 300,
        },
      };

      await fs.writeFile(
        path.join(workflowsDir, 'workflow-1.yaml'),
        yaml.dump(workflow1),
        'utf-8'
      );
      await fs.writeFile(
        path.join(workflowsDir, 'workflow-2.yaml'),
        yaml.dump(workflow2),
        'utf-8'
      );
      await fs.writeFile(path.join(rulesDir, 'rule-1.yaml'), yaml.dump(rule1), 'utf-8');
      await fs.writeFile(path.join(rulesDir, 'rule-2.yaml'), yaml.dump(rule2), 'utf-8');

      await ruleEngine.loadRules();

      const event: CommitEvent = {
        id: 'test-event-id',
        type: 'commit',
        timestamp: new Date(),
        source: 'git',
        worktree: '/path/to/worktree',
        branch: 'main',
        commit_hash: 'ghi789',
        commit_message: 'Test commit',
        author: 'Test Author',
      };

      const matchingRules = await ruleEngine.findMatchingRules(event);
      expect(matchingRules).toHaveLength(2);

      const execution1 = await workflowEngine.executeWorkflow('workflow-1', {});
      const execution2 = await workflowEngine.executeWorkflow('workflow-2', {});

      expect(execution1.status).toBe('success');
      expect(execution2.status).toBe('success');
    });
  });

  describe('Rule conditions with workflow execution', () => {
    it('should only execute workflow when rule conditions are satisfied', async () => {
      const workflow: Workflow = {
        name: 'conditional-workflow',
        version: '1.0.0',
        description: '',
        author: 'test',
        inputs: [],
        outputs: [],
        steps: [
          {
            id: 'step-1',
            name: 'Step 1',
            type: 'shell',
            command: 'echo "Conditional execution"',
            timeout: 30000,
          },
        ],
        error_handling: {
          strategy: 'abort',
        },
      };

      const rule: Rule = {
        name: 'conditional-rule',
        version: '1.0.0',
        description: 'Rule with conditions',
        author: 'Test',
        enabled: true,
        triggers: [
          {
            type: 'commit',
            branches: { pattern: '*' },
          },
        ],
        conditions: [
          {
            type: 'branch_check',
            branches: ['feature-*', 'develop'],
          },
        ],
        actions: [
          {
            type: 'run_workflow',
            workflow: 'conditional-workflow',
            inputs: {},
          },
        ],
        guards: {
          on_error: 'continue',
        max_retries: 3,
        timeout: 300,
        },
      };

      await fs.writeFile(
        path.join(workflowsDir, 'conditional-workflow.yaml'),
        yaml.dump(workflow),
        'utf-8'
      );
      await fs.writeFile(
        path.join(rulesDir, 'conditional-rule.yaml'),
        yaml.dump(rule),
        'utf-8'
      );

      await ruleEngine.loadRules();

      const matchingEvent: CommitEvent = {
        id: 'test-event-id',
        type: 'commit',
        timestamp: new Date(),
        source: 'git',
        worktree: '/path/to/worktree',
        branch: 'feature-test',
        commit_hash: 'abc123',
        commit_message: 'Test commit',
        author: 'Test Author',
      };

      const nonMatchingEvent: CommitEvent = {
        id: 'test-event-3',
        type: 'commit',
        timestamp: new Date(),
        source: 'git',
        worktree: '/path/to/worktree',
        branch: 'main',
        commit_hash: 'def456',
        commit_message: 'Test commit',
        author: 'Test Author',
      };

      const matchingRules = await ruleEngine.findMatchingRules(matchingEvent);
      expect(matchingRules).toHaveLength(1);

      const nonMatchingRules = await ruleEngine.findMatchingRules(nonMatchingEvent);
      expect(nonMatchingRules).toHaveLength(0);
    });
  });
});
