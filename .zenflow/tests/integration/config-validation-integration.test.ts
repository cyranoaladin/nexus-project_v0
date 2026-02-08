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
      const config = {
        sync: {
          auto_push: false,
          verification_commands: ['npm run lint'],
          conflict_strategy: 'abort',
          excluded_worktrees: ['main', 'develop'],
        },
        rules: {
          directory: '.zenflow/rules',
          auto_load: true,
          validation_strict: true,
        },
        workflows: {
          directory: '.zenflow/workflows',
          state_directory: '.zenflow/state',
          max_concurrent: 2,
        },
        logging: {
          level: 'info',
          directory: '.zenflow/logs',
          retention_days: 30,
          max_size_mb: 100,
        },
        git: {
          remote: 'origin',
          default_branch: 'main',
        },
      };

      const settingsPath = path.join(zenflowDir, 'settings.json');
      await fs.writeFile(settingsPath, JSON.stringify(config, null, 2), 'utf-8');

      const loadedConfig = loader.load();
      expect(loadedConfig).toBeDefined();
      expect(loadedConfig.sync.autoPush).toBe(false);

      expect(() => validator.validateSettings(loadedConfig)).not.toThrow();
    });

    it('should reject invalid configuration', async () => {
      const invalidConfig = {
        sync: {
          auto_push: 'invalid',
          conflict_strategy: 'invalid_strategy',
        },
      };

      const settingsPath = path.join(zenflowDir, 'settings.json');
      await fs.writeFile(settingsPath, JSON.stringify(invalidConfig, null, 2), 'utf-8');

      expect(() => loader.load()).toThrow();
    });

    it('should use default values when optional fields are missing', async () => {
      const minimalConfig = {};

      const settingsPath = path.join(zenflowDir, 'settings.json');
      await fs.writeFile(settingsPath, JSON.stringify(minimalConfig, null, 2), 'utf-8');

      const loadedConfig = loader.load();
      
      expect(loadedConfig.sync).toBeDefined();
      expect(loadedConfig.rules).toBeDefined();
      expect(loadedConfig.workflows).toBeDefined();
      expect(loadedConfig.logging).toBeDefined();
      expect(loadedConfig.git).toBeDefined();

      expect(() => validator.validateSettings(loadedConfig)).not.toThrow();
    });

    it('should validate sync configuration options', async () => {
      const configWithSyncOptions = {
        sync: {
          auto_push: true,
          verification_commands: ['npm test', 'npm run build'],
          conflict_strategy: 'manual',
          excluded_worktrees: ['production', 'staging'],
        },
      };

      const settingsPath = path.join(zenflowDir, 'settings.json');
      await fs.writeFile(settingsPath, JSON.stringify(configWithSyncOptions, null, 2), 'utf-8');

      const loadedConfig = loader.load();
      
      expect(loadedConfig.sync.autoPush).toBe(true);
      expect(loadedConfig.sync.verificationCommands).toHaveLength(2);
      expect(loadedConfig.sync.conflictStrategy).toBe('manual');
      expect(loadedConfig.sync.excludedWorktrees).toContain('production');

      expect(() => validator.validateSettings(loadedConfig)).not.toThrow();
    });

    it('should validate rules configuration', async () => {
      const configWithRules = {
        rules: {
          directory: '.zenflow/custom-rules',
          auto_load: false,
          validation_strict: true,
        },
      };

      const settingsPath = path.join(zenflowDir, 'settings.json');
      await fs.writeFile(settingsPath, JSON.stringify(configWithRules, null, 2), 'utf-8');

      const loadedConfig = loader.load();
      
      expect(loadedConfig.rules.rulesDirectory).toBe('.zenflow/custom-rules');
      expect(loadedConfig.rules.autoLoad).toBe(false);

      expect(() => validator.validateSettings(loadedConfig)).not.toThrow();
    });

    it('should validate workflow configuration', async () => {
      const configWithWorkflows = {
        workflows: {
          directory: '.zenflow/custom-workflows',
          state_directory: '.zenflow/workflow-state',
          max_concurrent: 5,
        },
      };

      const settingsPath = path.join(zenflowDir, 'settings.json');
      await fs.writeFile(settingsPath, JSON.stringify(configWithWorkflows, null, 2), 'utf-8');

      const loadedConfig = loader.load();
      
      expect(loadedConfig.workflows.workflowsDirectory).toBe('.zenflow/custom-workflows');
      expect(loadedConfig.workflows.stateDirectory).toBe('.zenflow/workflow-state');
      expect(loadedConfig.workflows.maxConcurrent).toBe(5);

      expect(() => validator.validateSettings(loadedConfig)).not.toThrow();
    });

    it('should validate logging configuration', async () => {
      const configWithLogging = {
        logging: {
          level: 'debug',
          directory: '.zenflow/custom-logs',
          retention_days: 60,
          max_size_mb: 200,
        },
      };

      const settingsPath = path.join(zenflowDir, 'settings.json');
      await fs.writeFile(settingsPath, JSON.stringify(configWithLogging, null, 2), 'utf-8');

      const loadedConfig = loader.load();
      
      expect(loadedConfig.logging.level).toBe('debug');
      expect(loadedConfig.logging.directory).toBe('.zenflow/custom-logs');
      expect(loadedConfig.logging.retentionDays).toBe(60);
      expect(loadedConfig.logging.maxSizeMb).toBe(200);

      expect(() => validator.validateSettings(loadedConfig)).not.toThrow();
    });
  });

  describe('Config error handling', () => {
    it('should throw error when settings file does not exist', async () => {
      expect(() => loader.load()).toThrow();
    });

    it('should reject malformed JSON', async () => {
      const settingsPath = path.join(zenflowDir, 'settings.json');
      await fs.writeFile(settingsPath, '{ invalid json }', 'utf-8');

      expect(() => loader.load()).toThrow();
    });

    it('should accept empty configuration with defaults', async () => {
      const settingsPath = path.join(zenflowDir, 'settings.json');
      await fs.writeFile(settingsPath, '{}', 'utf-8');

      const loadedConfig = loader.load();
      expect(loadedConfig).toBeDefined();
      expect(loadedConfig.sync).toBeDefined();
    });

    it('should validate and report multiple errors', async () => {
      const configWithErrors = {
        sync: {
          conflict_strategy: 'invalid',
        },
        workflows: {
          max_concurrent: -1,
        },
      };

      expect(() => validator.validateSettings(configWithErrors as any)).toThrow();
    });
  });

  describe('Config merging with defaults', () => {
    it('should merge user config with default values', async () => {
      const partialConfig = {
        sync: {
          auto_push: true,
        },
      };

      const settingsPath = path.join(zenflowDir, 'settings.json');
      await fs.writeFile(settingsPath, JSON.stringify(partialConfig, null, 2), 'utf-8');

      const loadedConfig = loader.load();
      
      expect(loadedConfig.sync.autoPush).toBe(true);
      expect(loadedConfig.sync.conflictStrategy).toBeDefined();
      expect(loadedConfig.rules).toBeDefined();
      expect(loadedConfig.workflows).toBeDefined();
      expect(loadedConfig.logging).toBeDefined();

      expect(() => validator.validateSettings(loadedConfig)).not.toThrow();
    });

    it('should allow overriding default values', async () => {
      const customConfig = {
        sync: {
          auto_push: true,
          verification_commands: ['custom-command'],
          conflict_strategy: 'abort',
          excluded_worktrees: ['custom-branch'],
        },
        rules: {
          directory: 'custom-rules',
          auto_load: false,
          validation_strict: true,
        },
      };

      const settingsPath = path.join(zenflowDir, 'settings.json');
      await fs.writeFile(settingsPath, JSON.stringify(customConfig, null, 2), 'utf-8');

      const loadedConfig = loader.load();
      
      expect(loadedConfig.sync.autoPush).toBe(true);
      expect(loadedConfig.sync.verificationCommands).toEqual(['custom-command']);
      expect(loadedConfig.sync.conflictStrategy).toBe('abort');
      expect(loadedConfig.rules.rulesDirectory).toBe('custom-rules');
      expect(loadedConfig.rules.autoLoad).toBe(false);

      expect(() => validator.validateSettings(loadedConfig)).not.toThrow();
    });
  });
});
