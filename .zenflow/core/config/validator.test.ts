import fs from 'fs';
import path from 'path';
import { ConfigValidator, validateSettings, validateFile, validateDirectories } from './validator';
import { ConfigValidationError } from '../utils/errors';

jest.mock('fs');

const mockFs = fs as jest.Mocked<typeof fs>;

describe('ConfigValidator', () => {
  let validator: ConfigValidator;

  beforeEach(() => {
    jest.clearAllMocks();
    validator = new ConfigValidator();
  });

  describe('validateSettings', () => {
    it('should validate correct settings', () => {
      const config = {
        sync: {
          enabled: true,
          auto_push: false,
        },
      };

      const result = validator.validateSettings(config);
      
      expect(result).toBeDefined();
      expect(result.sync?.enabled).toBe(true);
    });

    it('should apply defaults for missing fields', () => {
      const config = {};

      const result = validator.validateSettings(config);
      
      expect(result.sync?.enabled).toBe(true);
      expect(result.sync?.max_retries).toBe(3);
      expect(result.logging?.level).toBe('info');
    });

    it('should throw error for invalid types', () => {
      const config = {
        sync: {
          enabled: 'yes',
        },
      };

      expect(() => validator.validateSettings(config)).toThrow(ConfigValidationError);
      expect(() => validator.validateSettings(config)).toThrow(/validation failed/);
    });

    it('should throw error for invalid enum values', () => {
      const config = {
        logging: {
          level: 'verbose',
        },
      };

      expect(() => validator.validateSettings(config)).toThrow(ConfigValidationError);
    });

    it('should throw error for out-of-range values', () => {
      const config = {
        sync: {
          max_retries: 15,
        },
      };

      expect(() => validator.validateSettings(config)).toThrow(ConfigValidationError);
    });
  });

  describe('validateSync', () => {
    it('should validate sync configuration', () => {
      const config = {
        enabled: true,
        auto_push: true,
        max_retries: 5,
      };

      const result = validator.validateSync(config);
      
      expect(result.enabled).toBe(true);
      expect(result.auto_push).toBe(true);
      expect(result.max_retries).toBe(5);
    });

    it('should apply defaults for sync config', () => {
      const config = {};

      const result = validator.validateSync(config);
      
      expect(result.enabled).toBe(true);
      expect(result.auto_push).toBe(false);
      expect(result.max_retries).toBe(3);
      expect(result.timeout).toBe(300);
      expect(result.conflict_strategy).toBe('abort');
    });

    it('should throw error for invalid sync config', () => {
      const config = {
        max_retries: -5,
      };

      expect(() => validator.validateSync(config)).toThrow(ConfigValidationError);
      expect(() => validator.validateSync(config)).toThrow(/Sync configuration/);
    });
  });

  describe('validateRules', () => {
    it('should validate rules configuration', () => {
      const config = {
        directory: 'custom/rules',
        auto_load: false,
        validation_strict: true,
      };

      const result = validator.validateRules(config);
      
      expect(result.directory).toBe('custom/rules');
      expect(result.auto_load).toBe(false);
      expect(result.validation_strict).toBe(true);
    });

    it('should apply defaults for rules config', () => {
      const config = {};

      const result = validator.validateRules(config);
      
      expect(result.directory).toBe('.zenflow/rules');
      expect(result.auto_load).toBe(true);
      expect(result.validation_strict).toBe(true);
    });

    it('should throw error for invalid rules config', () => {
      const config = {
        auto_load: 'yes',
      };

      expect(() => validator.validateRules(config)).toThrow(ConfigValidationError);
      expect(() => validator.validateRules(config)).toThrow(/Rules configuration/);
    });
  });

  describe('validateWorkflows', () => {
    it('should validate workflows configuration', () => {
      const config = {
        directory: 'custom/workflows',
        state_directory: 'custom/state',
        max_concurrent: 3,
      };

      const result = validator.validateWorkflows(config);
      
      expect(result.directory).toBe('custom/workflows');
      expect(result.state_directory).toBe('custom/state');
      expect(result.max_concurrent).toBe(3);
    });

    it('should apply defaults for workflows config', () => {
      const config = {};

      const result = validator.validateWorkflows(config);
      
      expect(result.directory).toBe('.zenflow/workflows');
      expect(result.state_directory).toBe('.zenflow/state/executions');
      expect(result.max_concurrent).toBe(1);
    });

    it('should throw error for invalid max_concurrent', () => {
      const config = {
        max_concurrent: 0,
      };

      expect(() => validator.validateWorkflows(config)).toThrow(ConfigValidationError);
    });
  });

  describe('validateLogging', () => {
    it('should validate logging configuration', () => {
      const config = {
        level: 'debug' as const,
        directory: 'logs',
        rotation: 'weekly' as const,
        retention_days: 60,
        max_size_mb: 200,
        format: 'json' as const,
      };

      const result = validator.validateLogging(config);
      
      expect(result.level).toBe('debug');
      expect(result.directory).toBe('logs');
      expect(result.rotation).toBe('weekly');
      expect(result.retention_days).toBe(60);
      expect(result.max_size_mb).toBe(200);
      expect(result.format).toBe('json');
    });

    it('should apply defaults for logging config', () => {
      const config = {};

      const result = validator.validateLogging(config);
      
      expect(result.level).toBe('info');
      expect(result.directory).toBe('.zenflow/logs');
      expect(result.rotation).toBe('daily');
      expect(result.retention_days).toBe(30);
      expect(result.max_size_mb).toBe(100);
      expect(result.format).toBe('text');
    });

    it('should throw error for invalid logging level', () => {
      const config = {
        level: 'verbose',
      };

      expect(() => validator.validateLogging(config)).toThrow(ConfigValidationError);
    });
  });

  describe('validateGit', () => {
    it('should validate git configuration', () => {
      const config = {
        main_directory: '/home/user/project',
        worktrees_directory: '/home/user/worktrees',
        remote: 'upstream',
        default_branch: 'develop',
      };

      const result = validator.validateGit(config);
      
      expect(result.main_directory).toBe('/home/user/project');
      expect(result.worktrees_directory).toBe('/home/user/worktrees');
      expect(result.remote).toBe('upstream');
      expect(result.default_branch).toBe('develop');
    });

    it('should apply defaults for git config', () => {
      const config = {};

      const result = validator.validateGit(config);
      
      expect(result.main_directory).toBe('.');
      expect(result.worktrees_directory).toBe('../');
      expect(result.remote).toBe('origin');
      expect(result.default_branch).toBe('main');
    });
  });

  describe('validateFile', () => {
    const validConfig = {
      sync: { enabled: true },
      rules: { directory: '.zenflow/rules' },
    };

    beforeEach(() => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(validConfig));
    });

    it('should validate file successfully', () => {
      const result = validator.validateFile('.zenflow/settings.json');
      
      expect(result).toBeDefined();
      expect(result.sync?.enabled).toBe(true);
    });

    it('should throw error when file does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      expect(() => validator.validateFile('nonexistent.json')).toThrow(ConfigValidationError);
      expect(() => validator.validateFile('nonexistent.json')).toThrow(/not found/);
    });

    it('should throw error when file is empty', () => {
      mockFs.readFileSync.mockReturnValue('');

      expect(() => validator.validateFile('empty.json')).toThrow(ConfigValidationError);
      expect(() => validator.validateFile('empty.json')).toThrow(/empty/);
    });

    it('should throw error when file contains invalid JSON', () => {
      mockFs.readFileSync.mockReturnValue('{ invalid }');

      expect(() => validator.validateFile('invalid.json')).toThrow(ConfigValidationError);
      expect(() => validator.validateFile('invalid.json')).toThrow(/Invalid JSON/);
    });

    it('should throw error when file read fails', () => {
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      expect(() => validator.validateFile('test.json')).toThrow(ConfigValidationError);
      expect(() => validator.validateFile('test.json')).toThrow(/Failed to read/);
    });
  });

  describe('checkDirectoryAccess', () => {
    it('should return exists false when directory does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = validator.checkDirectoryAccess('.zenflow/rules');
      
      expect(result.exists).toBe(false);
      expect(result.readable).toBe(false);
      expect(result.writable).toBe(false);
    });

    it('should check readable and writable permissions', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.accessSync.mockImplementation();

      const result = validator.checkDirectoryAccess('.zenflow/rules');
      
      expect(result.exists).toBe(true);
      expect(result.readable).toBe(true);
      expect(result.writable).toBe(true);
    });

    it('should detect non-readable directory', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.accessSync.mockImplementation((filePath, mode) => {
        if (mode === fs.constants.R_OK) {
          throw new Error('Not readable');
        }
      });

      const result = validator.checkDirectoryAccess('.zenflow/rules');
      
      expect(result.exists).toBe(true);
      expect(result.readable).toBe(false);
      expect(result.writable).toBe(true);
    });

    it('should detect non-writable directory', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.accessSync.mockImplementation((filePath, mode) => {
        if (mode === fs.constants.W_OK) {
          throw new Error('Not writable');
        }
      });

      const result = validator.checkDirectoryAccess('.zenflow/rules');
      
      expect(result.exists).toBe(true);
      expect(result.readable).toBe(true);
      expect(result.writable).toBe(false);
    });
  });

  describe('validateDirectories', () => {
    beforeEach(() => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.accessSync.mockImplementation();
    });

    it('should validate all directories exist and are accessible', () => {
      const config = {
        rules: { directory: '.zenflow/rules' },
        workflows: {
          directory: '.zenflow/workflows',
          state_directory: '.zenflow/state',
        },
        logging: { directory: '.zenflow/logs' },
      };

      const result = validator.validateDirectories(config);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should add warnings for non-existent directories', () => {
      mockFs.existsSync.mockReturnValue(false);

      const config = {
        rules: { directory: '.zenflow/rules' },
        workflows: { directory: '.zenflow/workflows' },
      };

      const result = validator.validateDirectories(config);
      
      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('Rules directory'))).toBe(true);
    });

    it('should add errors for non-readable directories', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.accessSync.mockImplementation((filePath, mode) => {
        if (mode === fs.constants.R_OK) {
          throw new Error('Not readable');
        }
      });

      const config = {
        rules: { directory: '.zenflow/rules' },
      };

      const result = validator.validateDirectories(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes('not readable'))).toBe(true);
    });

    it('should add errors for non-writable state directory', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.accessSync.mockImplementation((filePath, mode) => {
        if (mode === fs.constants.W_OK && String(filePath).includes('state')) {
          throw new Error('Not writable');
        }
      });

      const config = {
        workflows: { state_directory: '.zenflow/state' },
      };

      const result = validator.validateDirectories(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('not writable'))).toBe(true);
    });

    it('should add errors for non-writable logs directory', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.accessSync.mockImplementation((filePath, mode) => {
        if (mode === fs.constants.W_OK) {
          throw new Error('Not writable');
        }
      });

      const config = {
        logging: { directory: '.zenflow/logs' },
      };

      const result = validator.validateDirectories(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Logs directory') && e.includes('not writable'))).toBe(true);
    });

    it('should handle missing optional configurations', () => {
      const config = {};

      const result = validator.validateDirectories(config);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('module-level functions', () => {
    it('should validate settings using default validator', () => {
      const config = { sync: { enabled: true } };
      
      const result = validateSettings(config);
      
      expect(result).toBeDefined();
      expect(result.sync?.enabled).toBe(true);
    });

    it('should validate file using default validator', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify({ sync: { enabled: true } }));
      
      const result = validateFile('.zenflow/settings.json');
      
      expect(result).toBeDefined();
    });

    it('should validate directories using default validator', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.accessSync.mockImplementation();

      const config = {
        rules: { directory: '.zenflow/rules' },
      };
      
      const result = validateDirectories(config);
      
      expect(result.valid).toBe(true);
    });
  });
});
