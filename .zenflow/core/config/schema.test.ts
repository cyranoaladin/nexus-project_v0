import {
  ZenflowSettingsSchema,
  SyncConfigSchema,
  RulesConfigSchema,
  WorkflowsConfigSchema,
  LoggingConfigSchema,
  GitConfigSchema,
} from './schema';

describe('ConfigSchema', () => {
  describe('SyncConfigSchema', () => {
    it('should apply default values', () => {
      const result = SyncConfigSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({
          enabled: true,
          auto_push: false,
          max_retries: 3,
          timeout: 300,
          conflict_strategy: 'abort',
          excluded_worktrees: [],
          notification_channels: ['console', 'log'],
          verification_commands: [],
        });
      }
    });

    it('should validate custom sync config', () => {
      const config = {
        enabled: true,
        auto_push: true,
        max_retries: 5,
        timeout: 600,
        conflict_strategy: 'manual',
        excluded_worktrees: ['temp-*', 'test-*'],
        notification_channels: ['console', 'log', 'email'],
        verification_commands: ['npm run lint', 'npm run typecheck'],
      };
      const result = SyncConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should reject max_retries > 10', () => {
      const config = { max_retries: 11 };
      const result = SyncConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should reject negative max_retries', () => {
      const config = { max_retries: -1 };
      const result = SyncConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should reject negative timeout', () => {
      const config = { timeout: -100 };
      const result = SyncConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should reject invalid conflict_strategy', () => {
      const config = { conflict_strategy: 'invalid' };
      const result = SyncConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should reject invalid notification channel', () => {
      const config = { notification_channels: ['invalid'] };
      const result = SyncConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });
  });

  describe('RulesConfigSchema', () => {
    it('should apply default values', () => {
      const result = RulesConfigSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({
          directory: '.zenflow/rules',
          auto_load: true,
          validation_strict: true,
        });
      }
    });

    it('should validate custom rules config', () => {
      const config = {
        directory: '/custom/path/rules',
        auto_load: false,
        validation_strict: false,
      };
      const result = RulesConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });
  });

  describe('WorkflowsConfigSchema', () => {
    it('should apply default values', () => {
      const result = WorkflowsConfigSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({
          directory: '.zenflow/workflows',
          state_directory: '.zenflow/state/executions',
          max_concurrent: 1,
        });
      }
    });

    it('should validate custom workflows config', () => {
      const config = {
        directory: '/custom/workflows',
        state_directory: '/custom/state',
        max_concurrent: 5,
      };
      const result = WorkflowsConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should reject max_concurrent < 1', () => {
      const config = { max_concurrent: 0 };
      const result = WorkflowsConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should reject negative max_concurrent', () => {
      const config = { max_concurrent: -1 };
      const result = WorkflowsConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });
  });

  describe('LoggingConfigSchema', () => {
    it('should apply default values', () => {
      const result = LoggingConfigSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({
          level: 'info',
          directory: '.zenflow/logs',
          rotation: 'daily',
          retention_days: 30,
          max_size_mb: 100,
          format: 'text',
        });
      }
    });

    it('should validate custom logging config', () => {
      const config = {
        level: 'debug',
        directory: '/var/log/zenflow',
        rotation: 'weekly',
        retention_days: 90,
        max_size_mb: 500,
        format: 'json',
      };
      const result = LoggingConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should validate all log levels', () => {
      const levels = ['debug', 'info', 'warn', 'error'];
      levels.forEach((level) => {
        const config = { level };
        const result = LoggingConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid log level', () => {
      const config = { level: 'invalid' };
      const result = LoggingConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should reject invalid rotation', () => {
      const config = { rotation: 'invalid' };
      const result = LoggingConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should reject retention_days < 1', () => {
      const config = { retention_days: 0 };
      const result = LoggingConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should reject max_size_mb < 1', () => {
      const config = { max_size_mb: 0 };
      const result = LoggingConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should reject invalid format', () => {
      const config = { format: 'invalid' };
      const result = LoggingConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });
  });

  describe('GitConfigSchema', () => {
    it('should apply default values', () => {
      const result = GitConfigSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({
          main_directory: '.',
          worktrees_directory: '../',
          remote: 'origin',
          default_branch: 'main',
        });
      }
    });

    it('should validate custom git config', () => {
      const config = {
        main_directory: '/path/to/main',
        worktrees_directory: '/path/to/worktrees',
        remote: 'upstream',
        default_branch: 'master',
      };
      const result = GitConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });
  });

  describe('ZenflowSettingsSchema', () => {
    it('should validate existing settings structure', () => {
      const existingSettings = {
        setup_script: 'npm install && npx prisma generate',
        dev_server_script: 'npm run dev',
        verification_script: 'npm run lint && npm run typecheck',
        copy_files: ['.env*', 'secrets/*.json'],
        theme: {
          colors: {
            brand: {
              primary: '#2563EB',
              secondary: '#EF4444',
              accent: '#2EE9F6',
              'accent-dark': '#1BCED4',
            },
          },
        },
        accessibility: {
          wcag: 'AA',
          contrastRatios: {
            normal: '4.5:1',
            large: '3:1',
          },
        },
      };
      const result = ZenflowSettingsSchema.safeParse(existingSettings);
      expect(result.success).toBe(true);
    });

    it('should validate extended settings with zenflow configs', () => {
      const extendedSettings = {
        setup_script: 'npm install',
        sync: {
          enabled: true,
          auto_push: true,
        },
        rules: {
          directory: '.zenflow/rules',
        },
        workflows: {
          directory: '.zenflow/workflows',
        },
        logging: {
          level: 'debug',
        },
        git: {
          remote: 'origin',
        },
      };
      const result = ZenflowSettingsSchema.safeParse(extendedSettings);
      expect(result.success).toBe(true);
    });

    it('should validate complete settings with all sections', () => {
      const completeSettings = {
        setup_script: 'npm install',
        dev_server_script: 'npm run dev',
        verification_script: 'npm run lint',
        copy_files: ['.env'],
        theme: {
          colors: {
            brand: {
              primary: '#000',
              secondary: '#fff',
              accent: '#f00',
              'accent-dark': '#900',
            },
          },
        },
        accessibility: {
          wcag: 'AAA',
        },
        sync: {
          enabled: true,
          auto_push: false,
          max_retries: 3,
          timeout: 600,
          conflict_strategy: 'abort',
          excluded_worktrees: [],
          notification_channels: ['console'],
          verification_commands: ['npm test'],
        },
        rules: {
          directory: '.zenflow/rules',
          auto_load: true,
          validation_strict: true,
        },
        workflows: {
          directory: '.zenflow/workflows',
          state_directory: '.zenflow/state',
          max_concurrent: 1,
        },
        logging: {
          level: 'info',
          directory: '.zenflow/logs',
          rotation: 'daily',
          retention_days: 30,
          max_size_mb: 100,
          format: 'text',
        },
        git: {
          main_directory: '.',
          worktrees_directory: '../',
          remote: 'origin',
          default_branch: 'main',
        },
      };
      const result = ZenflowSettingsSchema.safeParse(completeSettings);
      expect(result.success).toBe(true);
    });

    it('should validate empty settings', () => {
      const result = ZenflowSettingsSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should reject invalid sync config', () => {
      const invalidSettings = {
        sync: {
          max_retries: 20,
        },
      };
      const result = ZenflowSettingsSchema.safeParse(invalidSettings);
      expect(result.success).toBe(false);
    });

    it('should reject invalid rules config', () => {
      const invalidSettings = {
        rules: {
          directory: 123,
        },
      };
      const result = ZenflowSettingsSchema.safeParse(invalidSettings);
      expect(result.success).toBe(false);
    });

    it('should reject invalid logging level', () => {
      const invalidSettings = {
        logging: {
          level: 'invalid',
        },
      };
      const result = ZenflowSettingsSchema.safeParse(invalidSettings);
      expect(result.success).toBe(false);
    });

    it('should reject invalid accessibility wcag level', () => {
      const invalidSettings = {
        accessibility: {
          wcag: 'B',
        },
      };
      const result = ZenflowSettingsSchema.safeParse(invalidSettings);
      expect(result.success).toBe(false);
    });
  });
});
