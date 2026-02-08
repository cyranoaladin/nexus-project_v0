import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

jest.mock('../../core/utils/logger', () => ({
  getLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    log: jest.fn(),
  })),
}));

describe('CLI + Core Engines Integration', () => {
  let tempDir: string;
  let repoPath: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zenflow-cli-integration-'));
    repoPath = path.join(tempDir, 'repo');

    await fs.mkdir(repoPath, { recursive: true });

    await execAsync('git init', { cwd: repoPath });
    await execAsync('git config user.email "test@example.com"', { cwd: repoPath });
    await execAsync('git config user.name "Test User"', { cwd: repoPath });

    await fs.writeFile(path.join(repoPath, 'README.md'), '# Test Repo\n', 'utf-8');
    await execAsync('git add .', { cwd: repoPath });
    await execAsync('git commit -m "Initial commit"', { cwd: repoPath });

    await fs.mkdir(path.join(repoPath, '.zenflow', 'rules'), { recursive: true });
    await fs.mkdir(path.join(repoPath, '.zenflow', 'workflows'), { recursive: true });
    await fs.mkdir(path.join(repoPath, '.zenflow', 'state', 'sync'), { recursive: true });

    const settings = {
      version: '1.0.0',
      project: {
        name: 'test-project',
        root: repoPath,
      },
      sync: {
        autoPush: false,
        verificationCommands: [],
        conflictStrategy: 'abort',
        excludedBranches: [],
        excludedPaths: [],
      },
      rules: {
        directory: '.zenflow/rules',
        autoLoad: true,
      },
      workflows: {
        directory: '.zenflow/workflows',
        stateDirectory: '.zenflow/state',
        maxConcurrent: 1,
      },
      logging: {
        level: 'info',
        directory: '.zenflow/logs',
        maxFiles: 30,
        maxSize: '100m',
      },
      git: {
        defaultRemote: 'origin',
        defaultBranch: 'main',
      },
    };

    await fs.writeFile(
      path.join(repoPath, '.zenflow', 'settings.json'),
      JSON.stringify(settings, null, 2),
      'utf-8'
    );
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Rule validation through CLI simulation', () => {
    it('should validate a correct rule file', async () => {
      const { RuleEngine } = await import('../../core/rules/engine');
      const { RuleEngineConfig } = await import('../../core/rules/types');

      const rule = {
        name: 'test-rule',
        version: '1.0.0',
        description: 'Test rule',
        author: 'Test Author',
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
            type: 'log',
            message: 'Test action',
          },
        ],
        guards: {
          on_error: 'continue',
        },
      };

      const rulePath = path.join(repoPath, '.zenflow', 'rules', 'test-rule.yaml');
      await fs.writeFile(rulePath, JSON.stringify(rule), 'utf-8');

      const config: RuleEngineConfig = {
        rulesDirectory: path.join(repoPath, '.zenflow', 'rules'),
        autoLoad: false,
        validationStrict: false,
        autoLoad: false,
      };

      const engine = new RuleEngine(config);
      const validationResult = await engine.validateRule(rule as any);

      expect(validationResult.valid).toBe(true);
    });

    it('should detect invalid rule configuration', async () => {
      const { RuleEngine } = await import('../../core/rules/engine');

      const invalidRule = {
        name: 'invalid-rule',
        version: '1.0.0',
        triggers: [],
        actions: [],
      };

      const config = {
        rulesDirectory: path.join(repoPath, '.zenflow', 'rules'),
        autoLoad: false,
        validationStrict: false,
        autoLoad: false,
      };

      const engine = new RuleEngine(config);
      const validationResult = await engine.validateRule(invalidRule as any);

      expect(validationResult.valid).toBe(false);
      expect(validationResult.errors).toBeDefined();
      expect(validationResult.errors!.length).toBeGreaterThan(0);
    });
  });

  describe('Workflow execution through CLI simulation', () => {
    it('should execute a simple workflow', async () => {
      const { WorkflowEngine } = await import('../../core/workflows/engine');

      const workflow = {
        name: 'simple-workflow',
        version: '1.0.0',
        description: 'Simple test workflow',
        inputs: [],
        steps: [
          {
            id: 'step-1',
            name: 'Echo test',
            type: 'shell',
            command: 'echo "Hello from workflow"',
            timeout: 30000,
          },
        ],
        error_handling: {
          strategy: 'abort',
        },
      };

      const workflowPath = path.join(
        repoPath,
        '.zenflow',
        'workflows',
        'simple-workflow.yaml'
      );
      await fs.writeFile(workflowPath, JSON.stringify(workflow), 'utf-8');

      const config = {
        workflowsDirectory: path.join(repoPath, '.zenflow', 'workflows'),
        stateDirectory: path.join(repoPath, '.zenflow', 'state'),
        maxConcurrent: 1,
      };

      const engine = new WorkflowEngine(config);
      const execution = await engine.executeWorkflow('simple-workflow', {});

      expect(execution.status).toBe('success');
      expect(execution.workflow_name).toBe('simple-workflow');
    });

    it('should handle workflow with inputs', async () => {
      const { WorkflowEngine } = await import('../../core/workflows/engine');

      const workflow = {
        name: 'input-workflow',
        version: '1.0.0',
        description: 'Workflow with inputs',
        inputs: [
          {
            name: 'message',
            type: 'string',
            required: true,
          },
        ],
        steps: [
          {
            id: 'step-1',
            name: 'Echo message',
            type: 'shell',
            command: 'echo "{{ message }}"',
            timeout: 30000,
          },
        ],
        error_handling: {
          strategy: 'abort',
        },
      };

      const workflowPath = path.join(
        repoPath,
        '.zenflow',
        'workflows',
        'input-workflow.yaml'
      );
      await fs.writeFile(workflowPath, JSON.stringify(workflow), 'utf-8');

      const config = {
        workflowsDirectory: path.join(repoPath, '.zenflow', 'workflows'),
        stateDirectory: path.join(repoPath, '.zenflow', 'state'),
        maxConcurrent: 1,
      };

      const engine = new WorkflowEngine(config);
      const execution = await engine.executeWorkflow('input-workflow', {
        message: 'Test message',
      });

      expect(execution.status).toBe('success');
      expect(execution.inputs.message).toBe('Test message');
    });
  });

  describe('Config management through CLI simulation', () => {
    it('should load configuration correctly', async () => {
      const { ConfigLoader } = await import('../../core/config/loader');

      const loader = new ConfigLoader(repoPath);
      const settings = await loader.load();

      expect(settings.project.name).toBe('test-project');
      expect(settings.sync.autoPush).toBe(false);
      expect(settings.rules.directory).toBe('.zenflow/rules');
    });

    it('should validate loaded configuration', async () => {
      const { ConfigLoader } = await import('../../core/config/loader');
      const { ConfigValidator } = await import('../../core/config/validator');

      const loader = new ConfigLoader(repoPath);
      const validator = new ConfigValidator();

      const settings = await loader.load();
      const validationResult = validator.validateSettings(settings);

      expect(validationResult.valid).toBe(true);
    });
  });

  describe('Sync operations through CLI simulation', () => {
    it('should list sync history', async () => {
      const { SyncManager } = await import('../../core/sync/manager');
      const { ConfigLoader } = await import('../../core/config/loader');

      const loader = new ConfigLoader(repoPath);
      const settings = await loader.load();

      const syncManager = new SyncManager(repoPath, settings.sync);

      await execAsync('git checkout -b feature-branch', { cwd: repoPath });
      await fs.writeFile(path.join(repoPath, 'feature.txt'), 'Feature\n', 'utf-8');
      await execAsync('git add feature.txt', { cwd: repoPath });
      await execAsync('git commit -m "Add feature"', { cwd: repoPath });
      await execAsync('git checkout main', { cwd: repoPath });

      await syncManager.syncWorktree('feature-branch', { dryRun: false, force: false });

      const history = await syncManager.getSyncHistory();
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].worktree_branch).toBe('feature-branch');
    });

    it('should perform dry-run sync', async () => {
      const { SyncManager } = await import('../../core/sync/manager');
      const { ConfigLoader } = await import('../../core/config/loader');

      const loader = new ConfigLoader(repoPath);
      const settings = await loader.load();

      const syncManager = new SyncManager(repoPath, settings.sync);

      await execAsync('git checkout -b dry-run-branch', { cwd: repoPath });
      await fs.writeFile(path.join(repoPath, 'dry-run.txt'), 'Dry run\n', 'utf-8');
      await execAsync('git add dry-run.txt', { cwd: repoPath });
      await execAsync('git commit -m "Dry run commit"', { cwd: repoPath });
      await execAsync('git checkout main', { cwd: repoPath });

      const syncOperation = await syncManager.syncWorktree('dry-run-branch', {
        dryRun: true,
        force: false,
      });

      expect(syncOperation.status).toBe('success');
      expect(syncOperation.diff_summary?.files_changed).toBeGreaterThan(0);

      const fileExists = await fs
        .access(path.join(repoPath, 'dry-run.txt'))
        .then(() => true)
        .catch(() => false);

      expect(fileExists).toBe(false);
    });
  });

  describe('End-to-end CLI workflow simulation', () => {
    it('should complete a full sync cycle', async () => {
      const { SyncManager } = await import('../../core/sync/manager');
      const { RuleEngine } = await import('../../core/rules/engine');
      const { WorkflowEngine } = await import('../../core/workflows/engine');
      const { ConfigLoader } = await import('../../core/config/loader');

      const loader = new ConfigLoader(repoPath);
      const settings = await loader.load();

      const syncManager = new SyncManager(repoPath, settings.sync);
      const ruleEngine = new RuleEngine({
        rulesDirectory: path.join(repoPath, '.zenflow', 'rules'),
        autoLoad: true,
        validationStrict: false,
        autoLoad: true,
      });
      const workflowEngine = new WorkflowEngine({
        workflowsDirectory: path.join(repoPath, '.zenflow', 'workflows'),
        stateDirectory: path.join(repoPath, '.zenflow', 'state'),
        maxConcurrent: 1,
      });

      await execAsync('git checkout -b e2e-feature', { cwd: repoPath });
      await fs.writeFile(path.join(repoPath, 'e2e.txt'), 'E2E test\n', 'utf-8');
      await execAsync('git add e2e.txt', { cwd: repoPath });
      await execAsync('git commit -m "E2E commit"', { cwd: repoPath });
      await execAsync('git checkout main', { cwd: repoPath });

      const validation = await syncManager.validateSync('e2e-feature');
      expect(validation.valid).toBe(true);

      const conflicts = await syncManager.checkConflicts('e2e-feature');
      expect(conflicts.has_conflicts).toBe(false);

      const diff = await syncManager.analyzeDiff('e2e-feature');
      expect(diff.files_changed).toBeGreaterThan(0);

      const syncOperation = await syncManager.syncWorktree('e2e-feature', {
        dryRun: false,
        force: false,
      });

      expect(syncOperation.status).toBe('success');

      const fileExists = await fs
        .access(path.join(repoPath, 'e2e.txt'))
        .then(() => true)
        .catch(() => false);

      expect(fileExists).toBe(true);
    });
  });
});
