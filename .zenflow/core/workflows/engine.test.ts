/**
 * @jest-environment node
 */
import fs from 'fs';
import path from 'path';
import { WorkflowEngine } from './engine';
import { Workflow, WorkflowEngineConfig } from './types';
import { ValidationError, WorkflowExecutionError } from '../utils/errors';

const TEST_DIR = path.join(process.cwd(), '.zenflow-test-workflows');
const WORKFLOWS_DIR = path.join(TEST_DIR, 'workflows');
const STATE_DIR = path.join(TEST_DIR, 'state');

function setupTestDirectories() {
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(WORKFLOWS_DIR, { recursive: true });
  fs.mkdirSync(STATE_DIR, { recursive: true });
}

function cleanupTestDirectories() {
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  }
}

function createTestWorkflow(name: string, workflow: Workflow) {
  const yaml = require('js-yaml');
  const content = yaml.dump(workflow);
  fs.writeFileSync(path.join(WORKFLOWS_DIR, `${name}.yaml`), content, 'utf-8');
}

describe('WorkflowEngine', () => {
  let engine: WorkflowEngine;
  let config: WorkflowEngineConfig;

  beforeEach(() => {
    setupTestDirectories();
    config = {
      workflowsDirectory: WORKFLOWS_DIR,
      stateDirectory: STATE_DIR,
      maxConcurrent: 1,
    };
    engine = new WorkflowEngine(config);
  });

  afterEach(() => {
    cleanupTestDirectories();
  });

  describe('loadWorkflows', () => {
    it('should load all workflows from directory', async () => {
      const workflow1: Workflow = {
        name: 'test-workflow-1',
        version: '1.0.0',
        description: 'Test workflow 1',
        author: 'test',
        inputs: [],
        outputs: [],
        steps: [
          {
            id: 'step1',
            name: 'Test Step',
            type: 'shell',
            command: 'echo "hello"',
          },
        ],
        error_handling: {
          strategy: 'abort',
        },
      };

      const workflow2: Workflow = {
        name: 'test-workflow-2',
        version: '1.0.0',
        description: 'Test workflow 2',
        author: 'test',
        inputs: [],
        outputs: [],
        steps: [
          {
            id: 'step1',
            name: 'Test Step',
            type: 'shell',
            command: 'echo "world"',
          },
        ],
        error_handling: {
          strategy: 'abort',
        },
      };

      createTestWorkflow('workflow1', workflow1);
      createTestWorkflow('workflow2', workflow2);

      const workflows = await engine.loadWorkflows();
      expect(workflows).toHaveLength(2);
      expect(workflows.map(w => w.name)).toContain('test-workflow-1');
      expect(workflows.map(w => w.name)).toContain('test-workflow-2');
    });

    it('should return empty array if directory does not exist', async () => {
      cleanupTestDirectories();
      const workflows = await engine.loadWorkflows();
      expect(workflows).toEqual([]);
    });

    it('should skip invalid workflow files', async () => {
      const validWorkflow: Workflow = {
        name: 'valid-workflow',
        version: '1.0.0',
        description: 'Valid workflow',
        author: 'test',
        inputs: [],
        outputs: [],
        steps: [
          {
            id: 'step1',
            name: 'Test Step',
            type: 'shell',
            command: 'echo "hello"',
          },
        ],
        error_handling: {
          strategy: 'abort',
        },
      };

      createTestWorkflow('valid', validWorkflow);
      fs.writeFileSync(path.join(WORKFLOWS_DIR, 'invalid.yaml'), 'invalid: yaml: content:', 'utf-8');

      const workflows = await engine.loadWorkflows();
      expect(workflows).toHaveLength(1);
      expect(workflows[0].name).toBe('valid-workflow');
    });
  });

  describe('loadWorkflow', () => {
    it('should load workflow by name', async () => {
      const workflow: Workflow = {
        name: 'my-workflow',
        version: '1.0.0',
        description: 'My workflow',
        author: 'test',
        inputs: [],
        outputs: [],
        steps: [
          {
            id: 'step1',
            name: 'Test Step',
            type: 'shell',
            command: 'echo "hello"',
          },
        ],
        error_handling: {
          strategy: 'abort',
        },
      };

      createTestWorkflow('my-workflow', workflow);

      const loaded = await engine.loadWorkflow('my-workflow');
      expect(loaded.name).toBe('my-workflow');
      expect(loaded.version).toBe('1.0.0');
    });

    it('should throw error if workflow not found', async () => {
      await expect(engine.loadWorkflow('non-existent')).rejects.toThrow(ValidationError);
    });
  });

  describe('validateWorkflow', () => {
    it('should validate correct workflow', async () => {
      const workflow: Workflow = {
        name: 'test-workflow',
        version: '1.0.0',
        description: 'Test workflow',
        author: 'test',
        inputs: [],
        outputs: [],
        steps: [
          {
            id: 'step1',
            name: 'Test Step',
            type: 'shell',
            command: 'echo "hello"',
          },
        ],
        error_handling: {
          strategy: 'abort',
        },
      };

      const result = await engine.validateWorkflow(workflow);
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should reject workflow with missing required fields', async () => {
      const invalidWorkflow = {
        name: 'test',
        version: '1.0.0',
        steps: [],
      } as any;

      const result = await engine.validateWorkflow(invalidWorkflow);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });
  });

  describe('executeWorkflow', () => {
    it('should execute simple shell workflow', async () => {
      const workflow: Workflow = {
        name: 'simple-shell',
        version: '1.0.0',
        description: 'Simple shell workflow',
        author: 'test',
        inputs: [],
        outputs: [],
        steps: [
          {
            id: 'step1',
            name: 'Echo Hello',
            type: 'shell',
            command: 'echo "Hello World"',
          },
        ],
        error_handling: {
          strategy: 'abort',
        },
      };

      createTestWorkflow('simple-shell', workflow);

      const execution = await engine.executeWorkflow('simple-shell', {});
      expect(execution.status).toBe('success');
      expect(execution.steps).toHaveLength(1);
      expect(execution.steps[0].status).toBe('success');
    });

    it('should execute workflow with inputs', async () => {
      const workflow: Workflow = {
        name: 'with-inputs',
        version: '1.0.0',
        description: 'Workflow with inputs',
        author: 'test',
        inputs: [
          {
            name: 'message',
            type: 'string',
            required: true,
          },
        ],
        outputs: [],
        steps: [
          {
            id: 'step1',
            name: 'Echo Message',
            type: 'shell',
            command: 'echo "${message}"',
          },
        ],
        error_handling: {
          strategy: 'abort',
        },
      };

      createTestWorkflow('with-inputs', workflow);

      const execution = await engine.executeWorkflow('with-inputs', { message: 'Test Message' });
      expect(execution.status).toBe('success');
    });

    it('should validate required inputs', async () => {
      const workflow: Workflow = {
        name: 'required-inputs',
        version: '1.0.0',
        description: 'Workflow with required inputs',
        author: 'test',
        inputs: [
          {
            name: 'required_field',
            type: 'string',
            required: true,
          },
        ],
        outputs: [],
        steps: [
          {
            id: 'step1',
            name: 'Test Step',
            type: 'shell',
            command: 'echo "test"',
          },
        ],
        error_handling: {
          strategy: 'abort',
        },
      };

      createTestWorkflow('required-inputs', workflow);

      await expect(engine.executeWorkflow('required-inputs', {})).rejects.toThrow(ValidationError);
    });

    it('should use default input values', async () => {
      const workflow: Workflow = {
        name: 'default-inputs',
        version: '1.0.0',
        description: 'Workflow with default inputs',
        author: 'test',
        inputs: [
          {
            name: 'optional_field',
            type: 'string',
            required: true,
            default: 'default_value',
          },
        ],
        outputs: [],
        steps: [
          {
            id: 'step1',
            name: 'Test Step',
            type: 'shell',
            command: 'echo "test"',
          },
        ],
        error_handling: {
          strategy: 'abort',
        },
      };

      createTestWorkflow('default-inputs', workflow);

      const execution = await engine.executeWorkflow('default-inputs', {});
      expect(execution.status).toBe('success');
    });

    it('should handle step failure with abort strategy', async () => {
      const workflow: Workflow = {
        name: 'failing-workflow',
        version: '1.0.0',
        description: 'Failing workflow',
        author: 'test',
        inputs: [],
        outputs: [],
        steps: [
          {
            id: 'step1',
            name: 'Failing Step',
            type: 'shell',
            command: 'exit 1',
          },
        ],
        error_handling: {
          strategy: 'abort',
        },
      };

      createTestWorkflow('failing-workflow', workflow);

      await expect(engine.executeWorkflow('failing-workflow', {})).rejects.toThrow(
        WorkflowExecutionError
      );
    });

    it('should continue on error with continue strategy', async () => {
      const workflow: Workflow = {
        name: 'continue-on-error',
        version: '1.0.0',
        description: 'Continue on error workflow',
        author: 'test',
        inputs: [],
        outputs: [],
        steps: [
          {
            id: 'step1',
            name: 'Failing Step',
            type: 'shell',
            command: 'exit 1',
          },
          {
            id: 'step2',
            name: 'Success Step',
            type: 'shell',
            command: 'echo "success"',
          },
        ],
        error_handling: {
          strategy: 'continue',
        },
      };

      createTestWorkflow('continue-on-error', workflow);

      const execution = await engine.executeWorkflow('continue-on-error', {});
      expect(execution.status).toBe('success');
      expect(execution.steps[0].status).toBe('failure');
      expect(execution.steps[1].status).toBe('success');
    });

    it('should execute javascript steps', async () => {
      const workflow: Workflow = {
        name: 'javascript-workflow',
        version: '1.0.0',
        description: 'JavaScript workflow',
        author: 'test',
        inputs: [],
        outputs: [],
        steps: [
          {
            id: 'step1',
            name: 'JS Step',
            type: 'javascript',
            script: 'return { result: 42 };',
          },
        ],
        error_handling: {
          strategy: 'abort',
        },
      };

      createTestWorkflow('javascript-workflow', workflow);

      const execution = await engine.executeWorkflow('javascript-workflow', {});
      expect(execution.status).toBe('success');
      expect(execution.steps[0].status).toBe('success');
    });

    it('should skip steps with when condition', async () => {
      const workflow: Workflow = {
        name: 'conditional-workflow',
        version: '1.0.0',
        description: 'Conditional workflow',
        author: 'test',
        inputs: [
          {
            name: 'should_run',
            type: 'boolean',
            required: true,
          },
        ],
        outputs: [],
        steps: [
          {
            id: 'step1',
            name: 'Conditional Step',
            type: 'shell',
            command: 'echo "running"',
            when: 'should_run === true',
          },
        ],
        error_handling: {
          strategy: 'abort',
        },
      };

      createTestWorkflow('conditional-workflow', workflow);

      const execution = await engine.executeWorkflow('conditional-workflow', { should_run: false });
      expect(execution.status).toBe('success');
      expect(execution.steps[0].status).toBe('skipped');
    });

    it('should skip steps with unless condition', async () => {
      const workflow: Workflow = {
        name: 'unless-workflow',
        version: '1.0.0',
        description: 'Unless workflow',
        author: 'test',
        inputs: [
          {
            name: 'should_skip',
            type: 'boolean',
            required: true,
          },
        ],
        outputs: [],
        steps: [
          {
            id: 'step1',
            name: 'Unless Step',
            type: 'shell',
            command: 'echo "running"',
            unless: 'should_skip === true',
          },
        ],
        error_handling: {
          strategy: 'abort',
        },
      };

      createTestWorkflow('unless-workflow', workflow);

      const execution = await engine.executeWorkflow('unless-workflow', { should_skip: true });
      expect(execution.status).toBe('success');
      expect(execution.steps[0].status).toBe('skipped');
    });

    it.skip('should handle step timeout', async () => {
      const workflow: Workflow = {
        name: 'timeout-workflow',
        version: '1.0.0',
        description: 'Timeout workflow',
        author: 'test',
        inputs: [],
        outputs: [],
        steps: [
          {
            id: 'step1',
            name: 'Long Running Step',
            type: 'shell',
            command: 'sleep 10',
            timeout: 1,
          },
        ],
        error_handling: {
          strategy: 'abort',
        },
      };

      createTestWorkflow('timeout-workflow', workflow);

      await expect(engine.executeWorkflow('timeout-workflow', {})).rejects.toThrow();
    }, 15000);
  });

  describe('resumeWorkflow', () => {
    it.skip('should resume failed workflow from last successful step', async () => {
      const workflow: Workflow = {
        name: 'resume-workflow',
        version: '1.0.0',
        description: 'Resume workflow',
        author: 'test',
        inputs: [],
        outputs: [],
        steps: [
          {
            id: 'step1',
            name: 'Success Step',
            type: 'shell',
            command: 'echo "step1"',
          },
          {
            id: 'step2',
            name: 'Failing Step',
            type: 'shell',
            command: 'exit 1',
          },
          {
            id: 'step3',
            name: 'Final Step',
            type: 'shell',
            command: 'echo "step3"',
          },
        ],
        error_handling: {
          strategy: 'abort',
        },
      };

      createTestWorkflow('resume-workflow', workflow);

      let executionId: string;
      try {
        await engine.executeWorkflow('resume-workflow', {});
      } catch (error) {
        const executions = engine.listExecutions({ workflow: 'resume-workflow', limit: 1 });
        executionId = executions[0].id;
      }

      fs.writeFileSync(
        path.join(WORKFLOWS_DIR, 'resume-workflow.yaml'),
        require('js-yaml').dump({
          ...workflow,
          steps: [
            workflow.steps[0],
            { ...workflow.steps[1], command: 'echo "step2-fixed"' },
            workflow.steps[2],
          ],
        }),
        'utf-8'
      );

      const resumed = await engine.resumeWorkflow(executionId!);
      expect(resumed.status).toBe('success');
    });
  });

  describe('rollbackWorkflow', () => {
    it('should execute cleanup steps on rollback', async () => {
      const workflow: Workflow = {
        name: 'rollback-workflow',
        version: '1.0.0',
        description: 'Rollback workflow',
        author: 'test',
        inputs: [],
        outputs: [],
        steps: [
          {
            id: 'step1',
            name: 'Create Resource',
            type: 'shell',
            command: 'touch /tmp/test-resource',
          },
        ],
        error_handling: {
          strategy: 'rollback',
          cleanup_steps: [
            {
              id: 'cleanup1',
              name: 'Delete Resource',
              type: 'shell',
              command: 'rm -f /tmp/test-resource',
            },
          ],
        },
      };

      createTestWorkflow('rollback-workflow', workflow);

      const execution = await engine.executeWorkflow('rollback-workflow', {});
      await engine.rollbackWorkflow(execution.id);

      const updated = await engine.getExecutionStatus(execution.id);
      expect(updated.status).toBe('rolled_back');
    });
  });

  describe('getExecutionStatus', () => {
    it('should get execution status', async () => {
      const workflow: Workflow = {
        name: 'status-workflow',
        version: '1.0.0',
        description: 'Status workflow',
        author: 'test',
        inputs: [],
        outputs: [],
        steps: [
          {
            id: 'step1',
            name: 'Test Step',
            type: 'shell',
            command: 'echo "test"',
          },
        ],
        error_handling: {
          strategy: 'abort',
        },
      };

      createTestWorkflow('status-workflow', workflow);

      const execution = await engine.executeWorkflow('status-workflow', {});
      const status = await engine.getExecutionStatus(execution.id);

      expect(status.id).toBe(execution.id);
      expect(status.status).toBe('success');
    });
  });

  describe('listExecutions', () => {
    it('should list all executions', async () => {
      const workflow: Workflow = {
        name: 'list-workflow',
        version: '1.0.0',
        description: 'List workflow',
        author: 'test',
        inputs: [],
        outputs: [],
        steps: [
          {
            id: 'step1',
            name: 'Test Step',
            type: 'shell',
            command: 'echo "test"',
          },
        ],
        error_handling: {
          strategy: 'abort',
        },
      };

      createTestWorkflow('list-workflow', workflow);

      await engine.executeWorkflow('list-workflow', {});
      await engine.executeWorkflow('list-workflow', {});

      const executions = engine.listExecutions();
      expect(executions.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter executions by workflow name', async () => {
      const workflow1: Workflow = {
        name: 'workflow-a',
        version: '1.0.0',
        description: 'Workflow A',
        author: 'test',
        inputs: [],
        outputs: [],
        steps: [
          {
            id: 'step1',
            name: 'Test Step',
            type: 'shell',
            command: 'echo "a"',
          },
        ],
        error_handling: {
          strategy: 'abort',
        },
      };

      const workflow2: Workflow = {
        name: 'workflow-b',
        version: '1.0.0',
        description: 'Workflow B',
        author: 'test',
        inputs: [],
        outputs: [],
        steps: [
          {
            id: 'step1',
            name: 'Test Step',
            type: 'shell',
            command: 'echo "b"',
          },
        ],
        error_handling: {
          strategy: 'abort',
        },
      };

      createTestWorkflow('workflow-a', workflow1);
      createTestWorkflow('workflow-b', workflow2);

      await engine.executeWorkflow('workflow-a', {});
      await engine.executeWorkflow('workflow-b', {});

      const executions = engine.listExecutions({ workflow: 'workflow-a' });
      expect(executions.every(e => e.workflow_name === 'workflow-a')).toBe(true);
    });

    it('should filter executions by status', async () => {
      const successWorkflow: Workflow = {
        name: 'success-workflow',
        version: '1.0.0',
        description: 'Success workflow',
        author: 'test',
        inputs: [],
        outputs: [],
        steps: [
          {
            id: 'step1',
            name: 'Test Step',
            type: 'shell',
            command: 'echo "success"',
          },
        ],
        error_handling: {
          strategy: 'abort',
        },
      };

      createTestWorkflow('success-workflow', successWorkflow);

      await engine.executeWorkflow('success-workflow', {});

      const executions = engine.listExecutions({ status: 'success' });
      expect(executions.every(e => e.status === 'success')).toBe(true);
    });
  });
});
