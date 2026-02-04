jest.mock('../utils/logger', () => ({
  getLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

import { StepOrchestrator, createOrchestrator } from './orchestrator';
import { WorkflowStateManager } from './state';
import { WorkflowExecution, WorkflowStep } from './types';
import path from 'path';
import fs from 'fs';

const TEST_STATE_DIR = path.join(process.cwd(), '.zenflow/state/test-orchestrator');

describe('StepOrchestrator', () => {
  let stateManager: WorkflowStateManager;
  let orchestrator: StepOrchestrator;
  let execution: WorkflowExecution;

  beforeEach(() => {
    if (fs.existsSync(TEST_STATE_DIR)) {
      fs.rmSync(TEST_STATE_DIR, { recursive: true, force: true });
    }
    stateManager = new WorkflowStateManager(TEST_STATE_DIR);
    orchestrator = new StepOrchestrator(stateManager);
    execution = stateManager.createExecution('test-workflow', {});
  });

  afterEach(() => {
    if (fs.existsSync(TEST_STATE_DIR)) {
      fs.rmSync(TEST_STATE_DIR, { recursive: true, force: true });
    }
  });

  describe('executeStep', () => {
    it('should execute shell step successfully', async () => {
      const step: WorkflowStep = {
        id: 'test-step',
        name: 'Test Step',
        type: 'shell',
        command: 'echo "Hello World"',
      };

      stateManager.addStepExecution(execution.id, step.id);
      
      const outputs = await orchestrator.executeStep(execution, step, {});
      
      expect(outputs.stdout).toContain('Hello World');
      expect(outputs.exit_code).toBe(0);
      
      const loaded = stateManager.loadExecution(execution.id);
      expect(loaded.steps[0].status).toBe('success');
    });

    it('should skip step when "when" condition is false', async () => {
      const step: WorkflowStep = {
        id: 'conditional-step',
        name: 'Conditional Step',
        type: 'shell',
        command: 'echo "Should not run"',
        when: 'false',
      };

      stateManager.addStepExecution(execution.id, step.id);
      
      const outputs = await orchestrator.executeStep(execution, step, {});
      
      expect(outputs).toEqual({});
      
      const loaded = stateManager.loadExecution(execution.id);
      expect(loaded.steps[0].status).toBe('skipped');
    });

    it('should skip step when "unless" condition is true', async () => {
      const step: WorkflowStep = {
        id: 'unless-step',
        name: 'Unless Step',
        type: 'shell',
        command: 'echo "Should not run"',
        unless: 'true',
      };

      stateManager.addStepExecution(execution.id, step.id);
      
      await orchestrator.executeStep(execution, step, {});
      
      const loaded = stateManager.loadExecution(execution.id);
      expect(loaded.steps[0].status).toBe('skipped');
    });

    it('should execute step when "when" condition is true', async () => {
      const step: WorkflowStep = {
        id: 'conditional-step',
        name: 'Conditional Step',
        type: 'shell',
        command: 'echo "Should run"',
        when: 'true',
      };

      stateManager.addStepExecution(execution.id, step.id);
      
      const outputs = await orchestrator.executeStep(execution, step, {});
      
      expect(outputs.stdout).toContain('Should run');
    });

    it('should evaluate conditions with context variables', async () => {
      const step: WorkflowStep = {
        id: 'context-step',
        name: 'Context Step',
        type: 'shell',
        command: 'echo "Running"',
        when: 'dryRun === false',
      };

      stateManager.addStepExecution(execution.id, step.id);
      
      const outputs = await orchestrator.executeStep(execution, step, { dryRun: false });
      
      expect(outputs.stdout).toContain('Running');
    });

    it('should handle step timeout', async () => {
      const step: WorkflowStep = {
        id: 'timeout-step',
        name: 'Timeout Step',
        type: 'shell',
        command: 'node -e "setTimeout(() => {}, 10000)"',
        timeout: 1,
      };

      stateManager.addStepExecution(execution.id, step.id);
      
      await expect(orchestrator.executeStep(execution, step, {})).rejects.toThrow('timed out');
      
      const loaded = stateManager.loadExecution(execution.id);
      expect(loaded.steps[0].status).toBe('failure');
    }, 3000);

    it('should continue on error if continue_on_error is true', async () => {
      const step: WorkflowStep = {
        id: 'failing-step',
        name: 'Failing Step',
        type: 'shell',
        command: 'exit 1',
        continue_on_error: true,
      };

      stateManager.addStepExecution(execution.id, step.id);
      
      const outputs = await orchestrator.executeStep(execution, step, {});
      
      expect(outputs).toEqual({});
      
      const loaded = stateManager.loadExecution(execution.id);
      expect(loaded.steps[0].status).toBe('failure');
    });

    it('should throw error if continue_on_error is false', async () => {
      const step: WorkflowStep = {
        id: 'failing-step',
        name: 'Failing Step',
        type: 'shell',
        command: 'exit 1',
      };

      stateManager.addStepExecution(execution.id, step.id);
      
      await expect(orchestrator.executeStep(execution, step, {})).rejects.toThrow();
    });

    it('should execute JavaScript step', async () => {
      const step: WorkflowStep = {
        id: 'js-step',
        name: 'JavaScript Step',
        type: 'javascript',
        script: 'return { result: "success", value: 42 };',
      };

      stateManager.addStepExecution(execution.id, step.id);
      
      const outputs = await orchestrator.executeStep(execution, step, {});
      
      expect(outputs.result).toBe('success');
      expect(outputs.value).toBe(42);
    });

    it('should pass context to JavaScript step', async () => {
      const step: WorkflowStep = {
        id: 'js-context-step',
        name: 'JavaScript Context Step',
        type: 'javascript',
        script: 'return { doubled: value * 2 };',
      };

      stateManager.addStepExecution(execution.id, step.id);
      
      const outputs = await orchestrator.executeStep(execution, step, { value: 21 });
      
      expect(outputs.doubled).toBe(42);
    });

    it('should handle workflow step', async () => {
      const step: WorkflowStep = {
        id: 'workflow-step',
        name: 'Nested Workflow',
        type: 'workflow',
        workflow: 'nested-workflow',
        inputs: {
          param1: 'value1',
        },
      };

      stateManager.addStepExecution(execution.id, step.id);
      
      const outputs = await orchestrator.executeStep(execution, step, {});
      
      expect(outputs.nested_workflow).toBe('nested-workflow');
      expect(outputs.inputs).toEqual({ param1: 'value1' });
    });

    it('should interpolate variables in workflow inputs', async () => {
      const step: WorkflowStep = {
        id: 'workflow-step',
        name: 'Nested Workflow',
        type: 'workflow',
        workflow: 'nested',
        inputs: {
          branch: '${branch}',
          count: 5,
        },
      };

      stateManager.addStepExecution(execution.id, step.id);
      
      const outputs = await orchestrator.executeStep(execution, step, { branch: 'main' });
      
      expect(outputs.inputs).toEqual({ branch: 'main', count: 5 });
    });

    it('should throw error for unknown step type', async () => {
      const step: any = {
        id: 'unknown-step',
        name: 'Unknown Step',
        type: 'unknown',
      };

      stateManager.addStepExecution(execution.id, step.id);
      
      await expect(orchestrator.executeStep(execution, step, {})).rejects.toThrow('Unknown step type');
    });
  });

  describe('variable interpolation', () => {
    it('should interpolate variables in shell commands', async () => {
      const step: WorkflowStep = {
        id: 'var-step',
        name: 'Variable Step',
        type: 'shell',
        command: 'echo "${message}"',
      };

      stateManager.addStepExecution(execution.id, step.id);
      
      const outputs = await orchestrator.executeStep(execution, step, { message: 'Hello' });
      
      expect(outputs.stdout).toContain('Hello');
    });

    it('should interpolate nested variables', async () => {
      const step: WorkflowStep = {
        id: 'nested-var-step',
        name: 'Nested Variable Step',
        type: 'shell',
        command: 'echo "${config.branch}"',
      };

      stateManager.addStepExecution(execution.id, step.id);
      
      const outputs = await orchestrator.executeStep(execution, step, {
        config: { branch: 'main' },
      });
      
      expect(outputs.stdout).toContain('main');
    });

    it('should leave undefined variables as-is', async () => {
      const step: WorkflowStep = {
        id: 'undefined-var-step',
        name: 'Undefined Variable Step',
        type: 'shell',
        command: 'echo \'${nonExistent}\'',
      };

      stateManager.addStepExecution(execution.id, step.id);
      
      const outputs = await orchestrator.executeStep(execution, step, {});
      
      expect(outputs.stdout).toContain('${nonExistent}');
    });
  });

  describe('output extraction', () => {
    it('should extract outputs from shell step', async () => {
      const step: WorkflowStep = {
        id: 'output-step',
        name: 'Output Step',
        type: 'shell',
        command: 'echo "result"',
        outputs: {
          result: 'stdout',
        },
      };

      stateManager.addStepExecution(execution.id, step.id);
      
      const outputs = await orchestrator.executeStep(execution, step, {});
      
      expect(outputs.result).toBe('result');
    });
  });

  describe('executeRollback', () => {
    it('should execute rollback steps', async () => {
      const rollbackSteps: WorkflowStep[] = [
        {
          id: 'rollback-1',
          name: 'Rollback Step 1',
          type: 'shell',
          command: 'echo "Rolling back 1"',
        },
        {
          id: 'rollback-2',
          name: 'Rollback Step 2',
          type: 'shell',
          command: 'echo "Rolling back 2"',
        },
      ];

      stateManager.addStepExecution(execution.id, 'rollback-1');
      stateManager.addStepExecution(execution.id, 'rollback-2');
      
      await orchestrator.executeRollback(execution, rollbackSteps, {});
      
      const loaded = stateManager.loadExecution(execution.id);
      expect(loaded.steps[0].status).toBe('success');
      expect(loaded.steps[1].status).toBe('success');
    });

    it('should continue rollback even if a step fails', async () => {
      const rollbackSteps: WorkflowStep[] = [
        {
          id: 'rollback-fail',
          name: 'Failing Rollback',
          type: 'shell',
          command: 'exit 1',
        },
        {
          id: 'rollback-success',
          name: 'Successful Rollback',
          type: 'shell',
          command: 'echo "success"',
        },
      ];

      stateManager.addStepExecution(execution.id, 'rollback-fail');
      stateManager.addStepExecution(execution.id, 'rollback-success');
      
      await orchestrator.executeRollback(execution, rollbackSteps, {});
      
      const loaded = stateManager.loadExecution(execution.id);
      expect(loaded.steps).toHaveLength(2);
    });
  });

  describe('handleStepFailure', () => {
    const allSteps: WorkflowStep[] = [];

    it('should return abort action by default', async () => {
      const step: WorkflowStep = {
        id: 'step',
        name: 'Step',
        type: 'shell',
        command: 'exit 1',
      };

      const result = await orchestrator.handleStepFailure(
        execution,
        step,
        new Error('Test error'),
        allSteps,
        {}
      );

      expect(result.action).toBe('abort');
    });

    it('should return continue action when on_failure is continue', async () => {
      const step: WorkflowStep = {
        id: 'step',
        name: 'Step',
        type: 'shell',
        command: 'exit 1',
        on_failure: 'continue',
      };

      const result = await orchestrator.handleStepFailure(
        execution,
        step,
        new Error('Test error'),
        allSteps,
        {}
      );

      expect(result.action).toBe('continue');
    });

    it('should return skip_to action when on_failure is skip_to_step', async () => {
      const step: WorkflowStep = {
        id: 'step',
        name: 'Step',
        type: 'shell',
        command: 'exit 1',
        on_failure: 'skip_to_step',
      };

      const result = await orchestrator.handleStepFailure(
        execution,
        step,
        new Error('Test error'),
        allSteps,
        {}
      );

      expect(result.action).toBe('skip_to');
    });

    it('should return rollback action when on_failure is rollback_to_step', async () => {
      const step: WorkflowStep = {
        id: 'step',
        name: 'Step',
        type: 'shell',
        command: 'exit 1',
        on_failure: 'rollback_to_step',
      };

      const result = await orchestrator.handleStepFailure(
        execution,
        step,
        new Error('Test error'),
        allSteps,
        {}
      );

      expect(result.action).toBe('rollback');
    });
  });

  describe('createOrchestrator', () => {
    it('should create orchestrator instance', () => {
      const orch = createOrchestrator(stateManager);
      expect(orch).toBeInstanceOf(StepOrchestrator);
    });
  });

  describe('error handling', () => {
    it('should handle shell command errors', async () => {
      const step: WorkflowStep = {
        id: 'error-step',
        name: 'Error Step',
        type: 'shell',
        command: 'invalid-command',
      };

      stateManager.addStepExecution(execution.id, step.id);
      
      await expect(orchestrator.executeStep(execution, step, {})).rejects.toThrow();
      
      const loaded = stateManager.loadExecution(execution.id);
      expect(loaded.steps[0].status).toBe('failure');
      expect(loaded.steps[0].error).toBeDefined();
    });

    it('should handle JavaScript runtime errors', async () => {
      const step: WorkflowStep = {
        id: 'js-error-step',
        name: 'JS Error Step',
        type: 'javascript',
        script: 'throw new Error("Runtime error");',
      };

      stateManager.addStepExecution(execution.id, step.id);
      
      await expect(orchestrator.executeStep(execution, step, {})).rejects.toThrow();
    });

    it('should handle missing required fields', async () => {
      const step: WorkflowStep = {
        id: 'missing-field-step',
        name: 'Missing Field Step',
        type: 'shell',
      } as any;

      stateManager.addStepExecution(execution.id, step.id);
      
      await expect(orchestrator.executeStep(execution, step, {})).rejects.toThrow('requires command field');
    });
  });

  describe('edge cases', () => {
    it('should handle empty context', async () => {
      const step: WorkflowStep = {
        id: 'empty-context',
        name: 'Empty Context',
        type: 'shell',
        command: 'echo "test"',
      };

      stateManager.addStepExecution(execution.id, step.id);
      
      await expect(orchestrator.executeStep(execution, step, {})).resolves.toBeDefined();
    });

    it('should handle condition evaluation errors gracefully', async () => {
      const step: WorkflowStep = {
        id: 'bad-condition',
        name: 'Bad Condition',
        type: 'shell',
        command: 'echo "test"',
        when: 'invalid syntax !!',
      };

      stateManager.addStepExecution(execution.id, step.id);
      
      const outputs = await orchestrator.executeStep(execution, step, {});
      
      expect(outputs).toEqual({});
    });

    it('should handle JavaScript step returning non-object', async () => {
      const step: WorkflowStep = {
        id: 'primitive-return',
        name: 'Primitive Return',
        type: 'javascript',
        script: 'return "simple string";',
      };

      stateManager.addStepExecution(execution.id, step.id);
      
      const outputs = await orchestrator.executeStep(execution, step, {});
      
      expect(outputs.result).toBe('simple string');
    });
  });
});
