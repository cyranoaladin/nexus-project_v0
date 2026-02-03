/**
 * @jest-environment node
 */
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { WorkflowLoader } from './loader';
import { Workflow } from './types';
import { ValidationError } from '../utils/errors';

const TEST_DIR = path.join(process.cwd(), '.zenflow-test-loader');

function setupTestDirectory() {
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(TEST_DIR, { recursive: true });
}

function cleanupTestDirectory() {
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  }
}

function createWorkflowFile(name: string, content: Workflow | any) {
  const filePath = path.join(TEST_DIR, `${name}.yaml`);
  fs.writeFileSync(filePath, yaml.dump(content), 'utf-8');
  return filePath;
}

describe('WorkflowLoader', () => {
  let loader: WorkflowLoader;

  beforeEach(() => {
    setupTestDirectory();
    loader = new WorkflowLoader(TEST_DIR);
  });

  afterEach(() => {
    cleanupTestDirectory();
  });

  describe('loadWorkflows', () => {
    it('should load all valid workflows', async () => {
      const workflow1: Workflow = {
        name: 'workflow-1',
        version: '1.0.0',
        description: 'First workflow',
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

      const workflow2: Workflow = {
        name: 'workflow-2',
        version: '2.0.0',
        description: 'Second workflow',
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
          strategy: 'continue',
        },
      };

      createWorkflowFile('workflow1', workflow1);
      createWorkflowFile('workflow2', workflow2);

      const workflows = await loader.loadWorkflows();

      expect(workflows).toHaveLength(2);
      expect(workflows.map(w => w.name)).toContain('workflow-1');
      expect(workflows.map(w => w.name)).toContain('workflow-2');
    });

    it('should return empty array if directory does not exist', async () => {
      cleanupTestDirectory();
      const workflows = await loader.loadWorkflows();
      expect(workflows).toEqual([]);
    });

    it('should skip invalid workflow files', async () => {
      const validWorkflow: Workflow = {
        name: 'valid',
        version: '1.0.0',
        description: 'Valid',
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

      createWorkflowFile('valid', validWorkflow);
      fs.writeFileSync(path.join(TEST_DIR, 'invalid.yaml'), 'invalid: yaml: :', 'utf-8');

      const workflows = await loader.loadWorkflows();
      expect(workflows).toHaveLength(1);
      expect(workflows[0].name).toBe('valid');
    });

    it('should cache loaded workflows', async () => {
      const workflow: Workflow = {
        name: 'cached-workflow',
        version: '1.0.0',
        description: 'Cached workflow',
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

      createWorkflowFile('cached', workflow);
      await loader.loadWorkflows();

      const cached = loader.getCachedWorkflows();
      expect(cached).toHaveLength(1);
      expect(cached[0].name).toBe('cached-workflow');
    });
  });

  describe('loadWorkflow', () => {
    it('should load workflow by name', async () => {
      const workflow: Workflow = {
        name: 'my-workflow',
        version: '1.0.0',
        description: 'My workflow',
        author: 'test',
        inputs: [
          {
            name: 'input1',
            type: 'string',
            required: true,
          },
        ],
        outputs: [
          {
            name: 'output1',
            type: 'string',
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
      };

      createWorkflowFile('my-workflow', workflow);

      const loaded = await loader.loadWorkflow('my-workflow');
      expect(loaded.name).toBe('my-workflow');
      expect(loaded.version).toBe('1.0.0');
      expect(loaded.inputs).toHaveLength(1);
      expect(loaded.outputs).toHaveLength(1);
    });

    it('should return cached workflow if available', async () => {
      const workflow: Workflow = {
        name: 'cached-workflow',
        version: '1.0.0',
        description: 'Cached workflow',
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

      createWorkflowFile('cached', workflow);

      await loader.loadWorkflow('cached-workflow');
      const loaded = await loader.loadWorkflow('cached-workflow');

      expect(loaded.name).toBe('cached-workflow');
    });

    it('should throw error if workflow not found', async () => {
      await expect(loader.loadWorkflow('non-existent')).rejects.toThrow(ValidationError);
      await expect(loader.loadWorkflow('non-existent')).rejects.toThrow('Workflow not found');
    });
  });

  describe('loadWorkflowFromFile', () => {
    it('should load workflow from specific file', async () => {
      const workflow: Workflow = {
        name: 'file-workflow',
        version: '1.0.0',
        description: 'File workflow',
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

      const filePath = createWorkflowFile('file-workflow', workflow);
      const loaded = await loader.loadWorkflowFromFile(filePath);

      expect(loaded.name).toBe('file-workflow');
    });

    it('should throw error if file does not exist', async () => {
      await expect(
        loader.loadWorkflowFromFile('/non/existent/file.yaml')
      ).rejects.toThrow(ValidationError);
    });

    it('should throw error for invalid YAML', async () => {
      const filePath = path.join(TEST_DIR, 'invalid.yaml');
      fs.writeFileSync(filePath, 'invalid: yaml: :', 'utf-8');

      await expect(loader.loadWorkflowFromFile(filePath)).rejects.toThrow(ValidationError);
      await expect(loader.loadWorkflowFromFile(filePath)).rejects.toThrow('Failed to parse YAML');
    });

    it('should validate workflow schema', async () => {
      const invalidWorkflow = {
        name: 'invalid',
        version: 'not-semver',
        steps: [],
      };

      const filePath = createWorkflowFile('invalid', invalidWorkflow);

      await expect(loader.loadWorkflowFromFile(filePath)).rejects.toThrow(ValidationError);
    });
  });

  describe('validateWorkflow', () => {
    it('should validate correct workflow', () => {
      const workflow: Workflow = {
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
            command: 'echo "test"',
          },
        ],
        error_handling: {
          strategy: 'abort',
        },
      };

      const result = loader.validateWorkflow(workflow);
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should reject workflow with missing name', () => {
      const workflow = {
        version: '1.0.0',
        description: 'Invalid workflow',
        author: 'test',
        inputs: [],
        outputs: [],
        steps: [],
        error_handling: {
          strategy: 'abort',
        },
      } as any;

      const result = loader.validateWorkflow(workflow);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.some(e => e.includes('name'))).toBe(true);
    });

    it('should reject workflow with invalid version', () => {
      const workflow: any = {
        name: 'test',
        version: 'not-semver',
        description: 'Invalid workflow',
        author: 'test',
        inputs: [],
        outputs: [],
        steps: [],
        error_handling: {
          strategy: 'abort',
        },
      };

      const result = loader.validateWorkflow(workflow);
      expect(result.valid).toBe(false);
      expect(result.errors!.some(e => e.includes('version'))).toBe(true);
    });

    it('should reject workflow with no steps', () => {
      const workflow: any = {
        name: 'test',
        version: '1.0.0',
        description: 'Invalid workflow',
        author: 'test',
        inputs: [],
        outputs: [],
        steps: [],
        error_handling: {
          strategy: 'abort',
        },
      };

      const result = loader.validateWorkflow(workflow);
      expect(result.valid).toBe(false);
      expect(result.errors!.some(e => e.includes('steps'))).toBe(true);
    });

    it('should reject step without required command for shell type', () => {
      const workflow: any = {
        name: 'test',
        version: '1.0.0',
        description: 'Invalid workflow',
        author: 'test',
        inputs: [],
        outputs: [],
        steps: [
          {
            id: 'step1',
            name: 'Invalid Step',
            type: 'shell',
          },
        ],
        error_handling: {
          strategy: 'abort',
        },
      };

      const result = loader.validateWorkflow(workflow);
      expect(result.valid).toBe(false);
    });
  });

  describe('clearCache', () => {
    it('should clear cached workflows', async () => {
      const workflow: Workflow = {
        name: 'cached-workflow',
        version: '1.0.0',
        description: 'Cached workflow',
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

      createWorkflowFile('cached', workflow);
      await loader.loadWorkflows();

      expect(loader.getCachedWorkflows()).toHaveLength(1);

      loader.clearCache();

      expect(loader.getCachedWorkflows()).toHaveLength(0);
    });
  });
});
