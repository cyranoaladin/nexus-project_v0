jest.mock('../utils/logger', () => ({
  getLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

import fs from 'fs';
import path from 'path';
import { WorkflowStateManager } from './state';
import { WorkflowExecution } from './types';

const TEST_STATE_DIR = path.join(process.cwd(), '.zenflow/state/test-executions');

describe('WorkflowStateManager', () => {
  let stateManager: WorkflowStateManager;

  beforeEach(() => {
    if (fs.existsSync(TEST_STATE_DIR)) {
      fs.rmSync(TEST_STATE_DIR, { recursive: true, force: true });
    }
    stateManager = new WorkflowStateManager(TEST_STATE_DIR);
  });

  afterEach(() => {
    if (fs.existsSync(TEST_STATE_DIR)) {
      fs.rmSync(TEST_STATE_DIR, { recursive: true, force: true });
    }
  });

  describe('constructor', () => {
    it('should create state directory if it does not exist', () => {
      expect(fs.existsSync(TEST_STATE_DIR)).toBe(true);
    });

    it('should use default directory if none provided', () => {
      const defaultManager = new WorkflowStateManager();
      expect(defaultManager).toBeInstanceOf(WorkflowStateManager);
    });
  });

  describe('createExecution', () => {
    it('should create new execution with correct properties', () => {
      const inputs = { branch: 'main', dryRun: false };
      const execution = stateManager.createExecution('sync-workflow', inputs);

      expect(execution.id).toBeDefined();
      expect(execution.workflow_name).toBe('sync-workflow');
      expect(execution.status).toBe('pending');
      expect(execution.started_at).toBeInstanceOf(Date);
      expect(execution.inputs).toEqual(inputs);
      expect(execution.outputs).toEqual({});
      expect(execution.steps).toEqual([]);
    });

    it('should generate unique execution IDs', () => {
      const ex1 = stateManager.createExecution('workflow1', {});
      const ex2 = stateManager.createExecution('workflow1', {});
      
      expect(ex1.id).not.toBe(ex2.id);
    });

    it('should persist execution to disk', () => {
      const execution = stateManager.createExecution('test-workflow', {});
      const filePath = path.join(TEST_STATE_DIR, `${execution.id}.json`);
      
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  describe('saveExecution', () => {
    it('should save execution state to JSON file', () => {
      const execution = stateManager.createExecution('test', {});
      execution.status = 'running';
      
      stateManager.saveExecution(execution);
      
      const filePath = path.join(TEST_STATE_DIR, `${execution.id}.json`);
      const content = fs.readFileSync(filePath, 'utf-8');
      const saved = JSON.parse(content);
      
      expect(saved.status).toBe('running');
    });

    it('should format JSON with proper indentation', () => {
      const execution = stateManager.createExecution('test', {});
      const filePath = path.join(TEST_STATE_DIR, `${execution.id}.json`);
      const content = fs.readFileSync(filePath, 'utf-8');
      
      expect(content).toContain('\n  ');
    });
  });

  describe('loadExecution', () => {
    it('should load execution from disk', () => {
      const created = stateManager.createExecution('test', { foo: 'bar' });
      const loaded = stateManager.loadExecution(created.id);
      
      expect(loaded.id).toBe(created.id);
      expect(loaded.workflow_name).toBe('test');
      expect(loaded.inputs).toEqual({ foo: 'bar' });
    });

    it('should convert date strings to Date objects', () => {
      const created = stateManager.createExecution('test', {});
      const loaded = stateManager.loadExecution(created.id);
      
      expect(loaded.started_at).toBeInstanceOf(Date);
    });

    it('should throw error for non-existent execution', () => {
      expect(() => {
        stateManager.loadExecution('non-existent-id');
      }).toThrow('Execution not found');
    });

    it('should parse step dates correctly', () => {
      const execution = stateManager.createExecution('test', {});
      stateManager.addStepExecution(execution.id, 'step1');
      stateManager.startStep(execution.id, 'step1');
      
      const loaded = stateManager.loadExecution(execution.id);
      expect(loaded.steps[0].started_at).toBeInstanceOf(Date);
    });
  });

  describe('updateExecutionStatus', () => {
    it('should update execution status', () => {
      const execution = stateManager.createExecution('test', {});
      stateManager.updateExecutionStatus(execution.id, 'running');
      
      const loaded = stateManager.loadExecution(execution.id);
      expect(loaded.status).toBe('running');
    });

    it('should set completed_at for terminal statuses', () => {
      const execution = stateManager.createExecution('test', {});
      
      stateManager.updateExecutionStatus(execution.id, 'success');
      const loaded = stateManager.loadExecution(execution.id);
      
      expect(loaded.completed_at).toBeInstanceOf(Date);
    });

    it('should store error if provided', () => {
      const execution = stateManager.createExecution('test', {});
      const error = new Error('Test error');
      
      stateManager.updateExecutionStatus(execution.id, 'failure', error);
      const loaded = stateManager.loadExecution(execution.id);
      
      expect(loaded.error).toBeDefined();
    });
  });

  describe('addStepExecution', () => {
    it('should add step to execution', () => {
      const execution = stateManager.createExecution('test', {});
      stateManager.addStepExecution(execution.id, 'step1');
      
      const loaded = stateManager.loadExecution(execution.id);
      expect(loaded.steps).toHaveLength(1);
      expect(loaded.steps[0].step_id).toBe('step1');
      expect(loaded.steps[0].status).toBe('pending');
    });

    it('should add multiple steps', () => {
      const execution = stateManager.createExecution('test', {});
      stateManager.addStepExecution(execution.id, 'step1');
      stateManager.addStepExecution(execution.id, 'step2');
      
      const loaded = stateManager.loadExecution(execution.id);
      expect(loaded.steps).toHaveLength(2);
    });
  });

  describe('updateStepExecution', () => {
    it('should update step properties', () => {
      const execution = stateManager.createExecution('test', {});
      stateManager.addStepExecution(execution.id, 'step1');
      
      stateManager.updateStepExecution(execution.id, 'step1', {
        status: 'running',
        started_at: new Date(),
      });
      
      const loaded = stateManager.loadExecution(execution.id);
      expect(loaded.steps[0].status).toBe('running');
      expect(loaded.steps[0].started_at).toBeInstanceOf(Date);
    });

    it('should set current_step', () => {
      const execution = stateManager.createExecution('test', {});
      stateManager.addStepExecution(execution.id, 'step1');
      stateManager.updateStepExecution(execution.id, 'step1', { status: 'running' });
      
      const loaded = stateManager.loadExecution(execution.id);
      expect(loaded.current_step).toBe('step1');
    });

    it('should throw error for non-existent step', () => {
      const execution = stateManager.createExecution('test', {});
      
      expect(() => {
        stateManager.updateStepExecution(execution.id, 'non-existent', {});
      }).toThrow('Step not found');
    });
  });

  describe('startStep', () => {
    it('should mark step as running with timestamp', () => {
      const execution = stateManager.createExecution('test', {});
      stateManager.addStepExecution(execution.id, 'step1');
      
      stateManager.startStep(execution.id, 'step1');
      
      const loaded = stateManager.loadExecution(execution.id);
      expect(loaded.steps[0].status).toBe('running');
      expect(loaded.steps[0].started_at).toBeInstanceOf(Date);
    });
  });

  describe('completeStep', () => {
    it('should mark step as success with timestamp', () => {
      const execution = stateManager.createExecution('test', {});
      stateManager.addStepExecution(execution.id, 'step1');
      stateManager.startStep(execution.id, 'step1');
      
      stateManager.completeStep(execution.id, 'step1', { result: 'success' });
      
      const loaded = stateManager.loadExecution(execution.id);
      expect(loaded.steps[0].status).toBe('success');
      expect(loaded.steps[0].completed_at).toBeInstanceOf(Date);
      expect(loaded.steps[0].outputs).toEqual({ result: 'success' });
    });

    it('should complete step without outputs', () => {
      const execution = stateManager.createExecution('test', {});
      stateManager.addStepExecution(execution.id, 'step1');
      stateManager.completeStep(execution.id, 'step1');
      
      const loaded = stateManager.loadExecution(execution.id);
      expect(loaded.steps[0].status).toBe('success');
    });
  });

  describe('failStep', () => {
    it('should mark step as failure with error message', () => {
      const execution = stateManager.createExecution('test', {});
      stateManager.addStepExecution(execution.id, 'step1');
      stateManager.startStep(execution.id, 'step1');
      
      stateManager.failStep(execution.id, 'step1', 'Step failed');
      
      const loaded = stateManager.loadExecution(execution.id);
      expect(loaded.steps[0].status).toBe('failure');
      expect(loaded.steps[0].error).toBe('Step failed');
      expect(loaded.steps[0].completed_at).toBeInstanceOf(Date);
    });
  });

  describe('skipStep', () => {
    it('should mark step as skipped', () => {
      const execution = stateManager.createExecution('test', {});
      stateManager.addStepExecution(execution.id, 'step1');
      
      stateManager.skipStep(execution.id, 'step1');
      
      const loaded = stateManager.loadExecution(execution.id);
      expect(loaded.steps[0].status).toBe('skipped');
      expect(loaded.steps[0].completed_at).toBeInstanceOf(Date);
    });
  });

  describe('setExecutionOutputs', () => {
    it('should set execution outputs', () => {
      const execution = stateManager.createExecution('test', {});
      
      stateManager.setExecutionOutputs(execution.id, { result: 'done' });
      
      const loaded = stateManager.loadExecution(execution.id);
      expect(loaded.outputs).toEqual({ result: 'done' });
    });

    it('should merge outputs', () => {
      const execution = stateManager.createExecution('test', {});
      
      stateManager.setExecutionOutputs(execution.id, { key1: 'value1' });
      stateManager.setExecutionOutputs(execution.id, { key2: 'value2' });
      
      const loaded = stateManager.loadExecution(execution.id);
      expect(loaded.outputs).toEqual({ key1: 'value1', key2: 'value2' });
    });
  });

  describe('listExecutions', () => {
    beforeEach(() => {
      stateManager.createExecution('workflow1', {});
      stateManager.createExecution('workflow2', {});
      stateManager.createExecution('workflow1', {});
    });

    it('should list all executions', () => {
      const executions = stateManager.listExecutions();
      expect(executions).toHaveLength(3);
    });

    it('should filter by workflow name', () => {
      const executions = stateManager.listExecutions({ workflow: 'workflow1' });
      expect(executions).toHaveLength(2);
      expect(executions.every(e => e.workflow_name === 'workflow1')).toBe(true);
    });

    it('should filter by status', () => {
      const ex1 = stateManager.createExecution('test', {});
      stateManager.updateExecutionStatus(ex1.id, 'success');
      
      const executions = stateManager.listExecutions({ status: 'success' });
      expect(executions.some(e => e.id === ex1.id)).toBe(true);
    });

    it('should filter by date', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const executions = stateManager.listExecutions({ since: yesterday });
      expect(executions.length).toBeGreaterThan(0);
    });

    it('should limit results', () => {
      const executions = stateManager.listExecutions({ limit: 2 });
      expect(executions).toHaveLength(2);
    });

    it('should sort by date descending', () => {
      const executions = stateManager.listExecutions();
      for (let i = 1; i < executions.length; i++) {
        expect(executions[i - 1].started_at.getTime()).toBeGreaterThanOrEqual(
          executions[i].started_at.getTime()
        );
      }
    });
  });

  describe('deleteExecution', () => {
    it('should delete execution file', () => {
      const execution = stateManager.createExecution('test', {});
      const filePath = path.join(TEST_STATE_DIR, `${execution.id}.json`);
      
      expect(fs.existsSync(filePath)).toBe(true);
      
      stateManager.deleteExecution(execution.id);
      
      expect(fs.existsSync(filePath)).toBe(false);
    });

    it('should not throw error if execution does not exist', () => {
      expect(() => {
        stateManager.deleteExecution('non-existent');
      }).not.toThrow();
    });
  });

  describe('cleanupOldExecutions', () => {
    it('should delete executions older than specified days', () => {
      const oldExecution = stateManager.createExecution('old', {});
      
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 35);
      
      const filePath = path.join(TEST_STATE_DIR, `${oldExecution.id}.json`);
      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      content.started_at = oldDate.toISOString();
      fs.writeFileSync(filePath, JSON.stringify(content));
      
      const deletedCount = stateManager.cleanupOldExecutions(30);
      
      expect(deletedCount).toBeGreaterThan(0);
      expect(fs.existsSync(filePath)).toBe(false);
    });

    it('should not delete recent executions', () => {
      const recentExecution = stateManager.createExecution('recent', {});
      
      stateManager.cleanupOldExecutions(30);
      
      const filePath = path.join(TEST_STATE_DIR, `${recentExecution.id}.json`);
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('should return count of deleted executions', () => {
      const count = stateManager.cleanupOldExecutions(30);
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  describe('edge cases', () => {
    it('should handle concurrent reads and writes', () => {
      const execution = stateManager.createExecution('test', {});
      
      stateManager.addStepExecution(execution.id, 'step1');
      const loaded1 = stateManager.loadExecution(execution.id);
      
      stateManager.startStep(execution.id, 'step1');
      const loaded2 = stateManager.loadExecution(execution.id);
      
      expect(loaded1.steps[0].status).toBe('pending');
      expect(loaded2.steps[0].status).toBe('running');
    });

    it('should handle empty inputs and outputs', () => {
      const execution = stateManager.createExecution('test', {});
      expect(execution.inputs).toEqual({});
      expect(execution.outputs).toEqual({});
    });

    it('should handle complex nested data in inputs/outputs', () => {
      const complexData = {
        array: [1, 2, 3],
        nested: { foo: { bar: 'baz' } },
        boolean: true,
        null: null,
      };
      
      const execution = stateManager.createExecution('test', complexData);
      const loaded = stateManager.loadExecution(execution.id);
      
      expect(loaded.inputs).toEqual(complexData);
    });
  });
});
