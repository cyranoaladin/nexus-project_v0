import { jest } from '@jest/globals';
import type { Workflow, WorkflowExecution } from '../../core/workflows/types';

jest.mock('../../core/utils/logger', () => ({
  getLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(),
  })),
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(),
  })),
}));

jest.mock('../../core/workflows/engine');
jest.mock('../../core/workflows/loader');
jest.mock('../../core/config/loader');

const mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined): never => {
  throw new Error(`process.exit called with ${code}`);
});

const mockLoadConfig = jest.fn();
const mockLoadWorkflows = jest.fn();
const mockLoadWorkflow = jest.fn();
const mockValidateWorkflow = jest.fn();
const mockExecuteWorkflow = jest.fn();
const mockGetExecutionStatus = jest.fn();
const mockLoadWorkflowFromFile = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  mockExit.mockClear();
  
  (require('../../core/config/loader') as any).loadConfig = mockLoadConfig;
  
  mockLoadConfig.mockReturnValue({
    workflows: {
      directory: '.zenflow/workflows',
      state_directory: '.zenflow/state/executions',
      max_concurrent: 1,
    },
  });

  (require('../../core/workflows/engine') as any).WorkflowEngine = jest.fn().mockImplementation(() => ({
    loadWorkflows: mockLoadWorkflows,
    loadWorkflow: mockLoadWorkflow,
    validateWorkflow: mockValidateWorkflow,
    executeWorkflow: mockExecuteWorkflow,
    getExecutionStatus: mockGetExecutionStatus,
  }));

  (require('../../core/workflows/loader') as any).WorkflowLoader = jest.fn().mockImplementation(() => ({
    loadWorkflowFromFile: mockLoadWorkflowFromFile,
    validateWorkflow: mockValidateWorkflow,
  }));
});

describe('Workflow CLI Commands', () => {
  const createMockWorkflow = (overrides: Partial<Workflow> = {}): Workflow => ({
    name: 'test-workflow',
    version: '1.0.0',
    description: 'Test workflow',
    author: 'Test Author',
    inputs: [
      {
        name: 'branch',
        type: 'string',
        required: true,
        description: 'Branch name',
      },
    ],
    outputs: [
      {
        name: 'result',
        type: 'string',
        description: 'Operation result',
      },
    ],
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
    ...overrides,
  });

  const createMockExecution = (overrides: Partial<WorkflowExecution> = {}): WorkflowExecution => ({
    id: 'test-execution-123',
    workflow_name: 'test-workflow',
    status: 'success',
    started_at: new Date('2024-01-01T10:00:00Z'),
    completed_at: new Date('2024-01-01T10:01:00Z'),
    inputs: { branch: 'main' },
    outputs: { result: 'success' },
    steps: [
      {
        step_id: 'step1',
        status: 'success',
        started_at: new Date('2024-01-01T10:00:00Z'),
        completed_at: new Date('2024-01-01T10:00:30Z'),
      },
    ],
    ...overrides,
  });

  describe('zenflow workflow list', () => {
    it('should list all workflows', async () => {
      const mockWorkflows = [
        createMockWorkflow({ name: 'workflow-1' }),
        createMockWorkflow({ name: 'workflow-2' }),
      ];
      
      mockLoadWorkflows.mockResolvedValue(mockWorkflows);

      const { createWorkflowCommand } = await import('./workflow');
      const command = createWorkflowCommand({});

      await command.parseAsync(['node', 'test', 'list']);

      expect(mockLoadWorkflows).toHaveBeenCalled();
    });

    it('should output JSON when --json flag is set', async () => {
      const mockWorkflows = [createMockWorkflow()];
      
      mockLoadWorkflows.mockResolvedValue(mockWorkflows);

      const { createWorkflowCommand } = await import('./workflow');
      const command = createWorkflowCommand({ json: true });

      await command.parseAsync(['node', 'test', 'list']);

      expect(mockLoadWorkflows).toHaveBeenCalled();
    });

    it('should handle no workflows found', async () => {
      mockLoadWorkflows.mockResolvedValue([]);

      const { createWorkflowCommand } = await import('./workflow');
      const command = createWorkflowCommand({});

      await command.parseAsync(['node', 'test', 'list']);

      expect(mockLoadWorkflows).toHaveBeenCalled();
    });
  });

  describe('zenflow workflow show', () => {
    it('should show workflow details', async () => {
      const mockWorkflow = createMockWorkflow({ name: 'test-workflow' });
      
      mockLoadWorkflow.mockResolvedValue(mockWorkflow);

      const { createWorkflowCommand } = await import('./workflow');
      const command = createWorkflowCommand({});

      await command.parseAsync(['node', 'test', 'show', 'test-workflow']);

      expect(mockLoadWorkflow).toHaveBeenCalledWith('test-workflow');
    });

    it('should output JSON when --json flag is set', async () => {
      const mockWorkflow = createMockWorkflow();
      
      mockLoadWorkflow.mockResolvedValue(mockWorkflow);

      const { createWorkflowCommand } = await import('./workflow');
      const command = createWorkflowCommand({ json: true });

      await command.parseAsync(['node', 'test', 'show', 'test-workflow']);

      expect(mockLoadWorkflow).toHaveBeenCalledWith('test-workflow');
    });

    it('should handle workflow not found', async () => {
      mockLoadWorkflow.mockRejectedValue(new Error('Workflow not found: non-existent'));

      const { createWorkflowCommand } = await import('./workflow');
      const command = createWorkflowCommand({});

      await expect(
        command.parseAsync(['node', 'test', 'show', 'non-existent'])
      ).rejects.toThrow();
    });
  });

  describe('zenflow workflow run', () => {
    it('should run workflow successfully', async () => {
      const mockExecution = createMockExecution();
      
      mockExecuteWorkflow.mockResolvedValue(mockExecution);

      const { createWorkflowCommand } = await import('./workflow');
      const command = createWorkflowCommand({});

      await command.parseAsync(['node', 'test', 'run', 'test-workflow']);

      expect(mockExecuteWorkflow).toHaveBeenCalledWith('test-workflow', {});
    });

    it('should run workflow with inputs', async () => {
      const mockExecution = createMockExecution();
      
      mockExecuteWorkflow.mockResolvedValue(mockExecution);

      const { createWorkflowCommand } = await import('./workflow');
      const command = createWorkflowCommand({});

      await command.parseAsync([
        'node',
        'test',
        'run',
        'test-workflow',
        '--input',
        'branch=main',
        '--input',
        'dry_run=true',
      ]);

      expect(mockExecuteWorkflow).toHaveBeenCalledWith('test-workflow', {
        branch: 'main',
        dry_run: 'true',
      });
    });

    it('should handle workflow execution failure', async () => {
      const mockExecution = createMockExecution({ 
        status: 'failure',
        error: new Error('Step failed'),
      });
      
      mockExecuteWorkflow.mockResolvedValue(mockExecution);

      const { createWorkflowCommand } = await import('./workflow');
      const command = createWorkflowCommand({});

      await expect(
        command.parseAsync(['node', 'test', 'run', 'test-workflow'])
      ).rejects.toThrow();
    });

    it('should handle workflow execution rollback', async () => {
      const mockExecution = createMockExecution({ 
        status: 'rolled_back',
        error: new Error('Rolled back'),
      });
      
      mockExecuteWorkflow.mockResolvedValue(mockExecution);

      const { createWorkflowCommand } = await import('./workflow');
      const command = createWorkflowCommand({});

      await expect(
        command.parseAsync(['node', 'test', 'run', 'test-workflow'])
      ).rejects.toThrow();
    });
  });

  describe('zenflow workflow validate', () => {
    it('should validate a valid workflow file', async () => {
      const mockWorkflow = createMockWorkflow();
      
      mockLoadWorkflowFromFile.mockResolvedValue(mockWorkflow);
      mockValidateWorkflow.mockReturnValue({ valid: true });

      const { createWorkflowCommand } = await import('./workflow');
      const command = createWorkflowCommand({});

      await command.parseAsync(['node', 'test', 'validate', 'test-workflow.yaml']);

      expect(mockLoadWorkflowFromFile).toHaveBeenCalledWith('test-workflow.yaml');
      expect(mockValidateWorkflow).toHaveBeenCalledWith(mockWorkflow);
    });

    it('should handle invalid workflow file', async () => {
      const mockWorkflow = createMockWorkflow();
      
      mockLoadWorkflowFromFile.mockResolvedValue(mockWorkflow);
      mockValidateWorkflow.mockReturnValue({
        valid: false,
        errors: ['name: Required', 'steps: Must have at least 1 step'],
      });

      const { createWorkflowCommand } = await import('./workflow');
      const command = createWorkflowCommand({});

      await expect(
        command.parseAsync(['node', 'test', 'validate', 'invalid-workflow.yaml'])
      ).rejects.toThrow();
    });
  });

  describe('zenflow workflow status', () => {
    it('should show execution status', async () => {
      const mockExecution = createMockExecution();
      
      mockGetExecutionStatus.mockResolvedValue(mockExecution);

      const { createWorkflowCommand } = await import('./workflow');
      const command = createWorkflowCommand({});

      await command.parseAsync(['node', 'test', 'status', 'test-execution-123']);

      expect(mockGetExecutionStatus).toHaveBeenCalledWith('test-execution-123');
    });

    it('should output JSON when --json flag is set', async () => {
      const mockExecution = createMockExecution();
      
      mockGetExecutionStatus.mockResolvedValue(mockExecution);

      const { createWorkflowCommand } = await import('./workflow');
      const command = createWorkflowCommand({ json: true });

      await command.parseAsync(['node', 'test', 'status', 'test-execution-123']);

      expect(mockGetExecutionStatus).toHaveBeenCalledWith('test-execution-123');
    });

    it('should handle execution not found', async () => {
      mockGetExecutionStatus.mockRejectedValue(new Error('Execution not found'));

      const { createWorkflowCommand } = await import('./workflow');
      const command = createWorkflowCommand({});

      await expect(
        command.parseAsync(['node', 'test', 'status', 'non-existent'])
      ).rejects.toThrow();
    });

    it('should show running execution with current step', async () => {
      const mockExecution = createMockExecution({
        status: 'running',
        completed_at: undefined,
        current_step: 'step2',
      });
      
      mockGetExecutionStatus.mockResolvedValue(mockExecution);

      const { createWorkflowCommand } = await import('./workflow');
      const command = createWorkflowCommand({});

      await command.parseAsync(['node', 'test', 'status', 'test-execution-123']);

      expect(mockGetExecutionStatus).toHaveBeenCalledWith('test-execution-123');
    });
  });

  describe('zenflow workflow logs', () => {
    it('should show execution logs', async () => {
      const mockExecution = createMockExecution({
        steps: [
          {
            step_id: 'step1',
            status: 'success',
            started_at: new Date('2024-01-01T10:00:00Z'),
            completed_at: new Date('2024-01-01T10:00:30Z'),
            outputs: { result: 'done' },
          },
          {
            step_id: 'step2',
            status: 'success',
            started_at: new Date('2024-01-01T10:00:30Z'),
            completed_at: new Date('2024-01-01T10:01:00Z'),
          },
        ],
      });
      
      mockGetExecutionStatus.mockResolvedValue(mockExecution);

      const { createWorkflowCommand } = await import('./workflow');
      const command = createWorkflowCommand({});

      await command.parseAsync(['node', 'test', 'logs', 'test-execution-123']);

      expect(mockGetExecutionStatus).toHaveBeenCalledWith('test-execution-123');
    });

    it('should handle execution with no steps', async () => {
      const mockExecution = createMockExecution({
        steps: [],
      });
      
      mockGetExecutionStatus.mockResolvedValue(mockExecution);

      const { createWorkflowCommand } = await import('./workflow');
      const command = createWorkflowCommand({});

      await command.parseAsync(['node', 'test', 'logs', 'test-execution-123']);

      expect(mockGetExecutionStatus).toHaveBeenCalledWith('test-execution-123');
    });

    it('should show step errors in logs', async () => {
      const mockExecution = createMockExecution({
        status: 'failure',
        steps: [
          {
            step_id: 'step1',
            status: 'failure',
            started_at: new Date('2024-01-01T10:00:00Z'),
            completed_at: new Date('2024-01-01T10:00:30Z'),
            error: 'Step failed: command not found',
          },
        ],
        error: new Error('Workflow failed at step step1'),
      });
      
      mockGetExecutionStatus.mockResolvedValue(mockExecution);

      const { createWorkflowCommand } = await import('./workflow');
      const command = createWorkflowCommand({});

      await command.parseAsync(['node', 'test', 'logs', 'test-execution-123']);

      expect(mockGetExecutionStatus).toHaveBeenCalledWith('test-execution-123');
    });
  });
});
