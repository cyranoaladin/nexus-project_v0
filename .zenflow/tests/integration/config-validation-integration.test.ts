import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { ConfigLoader } from '../../core/config/loader';
import { ConfigValidator } from '../../core/config/validator';
import type { ZenflowSettings } from '../../core/config/types';

jest.mock('../../core/utils/logger', () => ({
  getLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

describe('Config Loader + Validator Integration', () => {
  let tempDir: string;
  let zenflowDir: string;
  let loader: ConfigLoader;
  let validator: ConfigValidator;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zenflow-config-integration-'));
    zenflowDir = path.join(tempDir, '.zenflow');

    await fs.mkdir(zenflowDir, { recursive: true });

    loader = new ConfigLoader(tempDir);
    validator = new ConfigValidator();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Config loading and validation', () => {
    it('should load and validate a valid configuration', async () => {
      const config: ZenflowSettings = {
        version: '1.0.0',
        project: {
          name: 'test-project',
          root: tempDir,
        },
        sync: {
          autoPush: false,
          verificationCommands: ['npm run lint'],
          conflictStrategy: 'abort',
          excludedBranches: ['main', 'develop'],
          excludedPaths: ['node_modules/', '.git/'],
        },
        rules: {
          directory: '.zenflow/rules',
          autoLoad: true,
        },
        workflows: {
          directory: '.zenflow/workflows',
          stateDirectory: '.zenflow/state',
          maxConcurrent: 2,
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

      const settingsPath = path.join(zenflowDir, 'settings.json');
      await fs.writeFile(settingsPath, JSON.stringify(config, null, 2), 'utf-8');

      const loadedConfig = await loader.loadSettings();
      expect(loadedConfig).toBeDefined();
      expect(loadedConfig.project.name).toBe('test-project');

      const validationResult = validator.validateSettings(loadedConfig);
      expect(validationResult.valid).toBe(true);
      expect(validationResult.errors).toBeUndefined();
    });

    it('should reject invalid configuration', async () => {
      const invalidConfig = {
        version: '1.0.0',
        project: {
          name: 'test-project',
        },
        sync: {
          autoPush: 'invalid',
          conflictStrategy: 'invalid_strategy',
        },
      };

      const settingsPath = path.join(zenflowDir, 'settings.json');
      await fs.writeFile(settingsPath, JSON.stringify(invalidConfig, null, 2), 'utf-8');

      await expect(loader.loadSettings()).rejects.toThrow();
    });

    it('should use default values when optional fields are missing', async () => {
      const minimalConfig = {
        version: '1.0.0',
        project: {
          name: 'test-project',
          root: tempDir,
        },
      };

      const settingsPath = path.join(zenflowDir, 'settings.json');
      await fs.writeFile(settingsPath, JSON.stringify(minimalConfig, null, 2), 'utf-8');

      const loadedConfig = await loader.loadSettings();
      
      expect(loadedConfig.sync).toBeDefined();
      expect(loadedConfig.rules).toBeDefined();
      expect(loadedConfig.workflows).toBeDefined();
      expect(loadedConfig.logging).toBeDefined();
      expect(loadedConfig.git).toBeDefined();

      const validationResult = validator.validateSettings(loadedConfig);
      expect(validationResult.valid).toBe(true);
    });

    it('should validate sync configuration options', async () => {
      const configWithSyncOptions: ZenflowSettings = {
        version: '1.0.0',
        project: {
          name: 'test-project',
          root: tempDir,
        },
        sync: {
          autoPush: true,
          verificationCommands: ['npm test', 'npm run build'],
          conflictStrategy: 'manual',
          excludedBranches: ['production', 'staging'],
          excludedPaths: ['dist/', 'build/', '.next/'],
        },
      };

      const settingsPath = path.join(zenflowDir, 'settings.json');
      await fs.writeFile(settingsPath, JSON.stringify(configWithSyncOptions, null, 2), 'utf-8');

      const loadedConfig = await loader.loadSettings();
      
      expect(loadedConfig.sync.autoPush).toBe(true);
      expect(loadedConfig.sync.verificationCommands).toHaveLength(2);
      expect(loadedConfig.sync.conflictStrategy).toBe('manual');
      expect(loadedConfig.sync.excludedBranches).toContain('production');

      const validationResult = validator.validateSettings(loadedConfig);
      expect(validationResult.valid).toBe(true);
    });

    it('should validate rules configuration', async () => {
      const configWithRules: ZenflowSettings = {
        version: '1.0.0',
        project: {
          name: 'test-project',
          root: tempDir,
        },
        rules: {
          directory: '.zenflow/custom-rules',
          autoLoad: false,
        },
      };

      const settingsPath = path.join(zenflowDir, 'settings.json');
      await fs.writeFile(settingsPath, JSON.stringify(configWithRules, null, 2), 'utf-8');

      const loadedConfig = await loader.loadSettings();
      
      expect(loadedConfig.rules.directory).toBe('.zenflow/custom-rules');
      expect(loadedConfig.rules.autoLoad).toBe(false);

      const validationResult = validator.validateSettings(loadedConfig);
      expect(validationResult.valid).toBe(true);
    });

    it('should validate workflow configuration', async () => {
      const configWithWorkflows: ZenflowSettings = {
        version: '1.0.0',
        project: {
          name: 'test-project',
          root: tempDir,
        },
        workflows: {
          directory: '.zenflow/custom-workflows',
          stateDirectory: '.zenflow/workflow-state',
          maxConcurrent: 5,
        },
      };

      const settingsPath = path.join(zenflowDir, 'settings.json');
      await fs.writeFile(settingsPath, JSON.stringify(configWithWorkflows, null, 2), 'utf-8');

      const loadedConfig = await loader.loadSettings();
      
      expect(loadedConfig.workflows.directory).toBe('.zenflow/custom-workflows');
      expect(loadedConfig.workflows.stateDirectory).toBe('.zenflow/workflow-state');
      expect(loadedConfig.workflows.maxConcurrent).toBe(5);

      const validationResult = validator.validateSettings(loadedConfig);
      expect(validationResult.valid).toBe(true);
    });

    it('should validate logging configuration', async () => {
      const configWithLogging: ZenflowSettings = {
        version: '1.0.0',
        project: {
          name: 'test-project',
          root: tempDir,
        },
        logging: {
          level: 'debug',
          directory: '.zenflow/custom-logs',
          maxFiles: 60,
          maxSize: '200m',
        },
      };

      const settingsPath = path.join(zenflowDir, 'settings.json');
      await fs.writeFile(settingsPath, JSON.stringify(configWithLogging, null, 2), 'utf-8');

      const loadedConfig = await loader.loadSettings();
      
      expect(loadedConfig.logging.level).toBe('debug');
      expect(loadedConfig.logging.directory).toBe('.zenflow/custom-logs');
      expect(loadedConfig.logging.maxFiles).toBe(60);
      expect(loadedConfig.logging.maxSize).toBe('200m');

      const validationResult = validator.validateSettings(loadedConfig);
      expect(validationResult.valid).toBe(true);
    });
  });

  describe('Config error handling', () => {
    it('should throw error when settings file does not exist', async () => {
      await expect(loader.loadSettings()).rejects.toThrow();
    });

    it('should reject malformed JSON', async () => {
      const settingsPath = path.join(zenflowDir, 'settings.json');
      await fs.writeFile(settingsPath, '{ invalid json }', 'utf-8');

      await expect(loader.loadSettings()).rejects.toThrow();
    });

    it('should reject empty configuration', async () => {
      const settingsPath = path.join(zenflowDir, 'settings.json');
      await fs.writeFile(settingsPath, '{}', 'utf-8');

      await expect(loader.loadSettings()).rejects.toThrow();
    });

    it('should validate and report multiple errors', async () => {
      const configWithErrors = {
        version: '1.0.0',
        project: {
          name: '',
          root: '',
        },
        sync: {
          conflictStrategy: 'invalid',
        },
        workflows: {
          maxConcurrent: -1,
        },
      };

      const validationResult = validator.validateSettings(configWithErrors as any);
      
      expect(validationResult.valid).toBe(false);
      expect(validationResult.errors).toBeDefined();
      expect(validationResult.errors!.length).toBeGreaterThan(0);
    });
  });

  describe('Config merging with defaults', () => {
    it('should merge user config with default values', async () => {
      const partialConfig = {
        version: '1.0.0',
        project: {
          name: 'test-project',
          root: tempDir,
        },
        sync: {
          autoPush: true,
        },
      };

      const settingsPath = path.join(zenflowDir, 'settings.json');
      await fs.writeFile(settingsPath, JSON.stringify(partialConfig, null, 2), 'utf-8');

      const loadedConfig = await loader.loadSettings();
      
      expect(loadedConfig.sync.autoPush).toBe(true);
      expect(loadedConfig.sync.conflictStrategy).toBeDefined();
      expect(loadedConfig.rules).toBeDefined();
      expect(loadedConfig.workflows).toBeDefined();
      expect(loadedConfig.logging).toBeDefined();

      const validationResult = validator.validateSettings(loadedConfig);
      expect(validationResult.valid).toBe(true);
    });

    it('should allow overriding default values', async () => {
      const customConfig: ZenflowSettings = {
        version: '1.0.0',
        project: {
          name: 'test-project',
          root: tempDir,
        },
        sync: {
          autoPush: true,
          verificationCommands: ['custom-command'],
          conflictStrategy: 'force',
          excludedBranches: ['custom-branch'],
          excludedPaths: ['custom-path/'],
        },
        rules: {
          directory: 'custom-rules',
          autoLoad: false,
        },
      };

      const settingsPath = path.join(zenflowDir, 'settings.json');
      await fs.writeFile(settingsPath, JSON.stringify(customConfig, null, 2), 'utf-8');

      const loadedConfig = await loader.loadSettings();
      
      expect(loadedConfig.sync.autoPush).toBe(true);
      expect(loadedConfig.sync.verificationCommands).toEqual(['custom-command']);
      expect(loadedConfig.sync.conflictStrategy).toBe('force');
      expect(loadedConfig.rules.directory).toBe('custom-rules');
      expect(loadedConfig.rules.autoLoad).toBe(false);

      const validationResult = validator.validateSettings(loadedConfig);
      expect(validationResult.valid).toBe(true);
    });
  });
});
