import fs from 'fs';
import path from 'path';
import { ConfigLoader, loadConfig, reloadConfig, getConfigPath, clearConfigCache } from './loader';
import { ConfigValidationError } from '../utils/errors';

jest.mock('fs');

const mockFs = fs as jest.Mocked<typeof fs>;

describe('ConfigLoader', () => {
  const validConfig = {
    setup_script: 'npm install',
    dev_server_script: 'npm run dev',
    sync: {
      enabled: true,
      auto_push: false,
      max_retries: 3,
    },
    rules: {
      directory: '.zenflow/rules',
    },
    workflows: {
      directory: '.zenflow/workflows',
    },
    logging: {
      level: 'info' as const,
      directory: '.zenflow/logs',
    },
    git: {
      main_directory: '.',
      remote: 'origin',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify(validConfig));
  });

  describe('constructor', () => {
    it('should use default config path', () => {
      const loader = new ConfigLoader();
      expect(loader.getConfigPath()).toContain('.zenflow/settings.json');
    });

    it('should accept custom config path', () => {
      const loader = new ConfigLoader('custom/path/settings.json');
      expect(loader.getConfigPath()).toContain('custom/path/settings.json');
    });
  });

  describe('load', () => {
    it('should load and parse valid configuration', () => {
      const loader = new ConfigLoader();
      const config = loader.load();

      expect(config).toBeDefined();
      expect(config.setup_script).toBe('npm install');
      expect(config.sync?.enabled).toBe(true);
    });

    it('should apply default values for missing optional fields', () => {
      mockFs.readFileSync.mockReturnValue(JSON.stringify({}));

      const loader = new ConfigLoader();
      const config = loader.load();

      expect(config.sync?.enabled).toBe(true);
      expect(config.sync?.auto_push).toBe(false);
      expect(config.sync?.max_retries).toBe(3);
      expect(config.rules?.directory).toBe('.zenflow/rules');
      expect(config.workflows?.directory).toBe('.zenflow/workflows');
      expect(config.logging?.level).toBe('info');
    });

    it('should merge user config with defaults', () => {
      const partialConfig = {
        sync: {
          enabled: false,
          auto_push: true,
        },
      };
      mockFs.readFileSync.mockReturnValue(JSON.stringify(partialConfig));

      const loader = new ConfigLoader();
      const config = loader.load();

      expect(config.sync?.enabled).toBe(false);
      expect(config.sync?.auto_push).toBe(true);
      expect(config.sync?.max_retries).toBe(3);
    });

    it('should cache configuration on first load', () => {
      const loader = new ConfigLoader();
      
      loader.load();
      loader.load();

      expect(mockFs.readFileSync).toHaveBeenCalledTimes(1);
    });

    it('should not use cache when forceReload is true', () => {
      const loader = new ConfigLoader();
      
      loader.load();
      loader.load(true);

      expect(mockFs.readFileSync).toHaveBeenCalledTimes(2);
    });

    it('should throw error when config file does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      const loader = new ConfigLoader();
      
      expect(() => loader.load()).toThrow(ConfigValidationError);
      expect(() => loader.load()).toThrow(/not found/);
    });

    it('should throw error when config file is empty', () => {
      mockFs.readFileSync.mockReturnValue('');

      const loader = new ConfigLoader();
      
      expect(() => loader.load()).toThrow(ConfigValidationError);
      expect(() => loader.load()).toThrow(/empty/);
    });

    it('should throw error when config file contains invalid JSON', () => {
      mockFs.readFileSync.mockReturnValue('{ invalid json }');

      const loader = new ConfigLoader();
      
      expect(() => loader.load()).toThrow(ConfigValidationError);
      expect(() => loader.load()).toThrow(/Invalid JSON/);
    });

    it('should throw error when config validation fails', () => {
      const invalidConfig = {
        sync: {
          enabled: 'not-a-boolean',
        },
      };
      mockFs.readFileSync.mockReturnValue(JSON.stringify(invalidConfig));

      const loader = new ConfigLoader();
      
      expect(() => loader.load()).toThrow(ConfigValidationError);
      expect(() => loader.load()).toThrow(/validation failed/);
    });

    it('should validate integer constraints', () => {
      const invalidConfig = {
        sync: {
          max_retries: -1,
        },
      };
      mockFs.readFileSync.mockReturnValue(JSON.stringify(invalidConfig));

      const loader = new ConfigLoader();
      
      expect(() => loader.load()).toThrow(ConfigValidationError);
    });

    it('should validate enum values', () => {
      const invalidConfig = {
        sync: {
          conflict_strategy: 'invalid-strategy',
        },
      };
      mockFs.readFileSync.mockReturnValue(JSON.stringify(invalidConfig));

      const loader = new ConfigLoader();
      
      expect(() => loader.load()).toThrow(ConfigValidationError);
    });

    it('should handle file system errors gracefully', () => {
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const loader = new ConfigLoader();
      
      expect(() => loader.load()).toThrow(ConfigValidationError);
      expect(() => loader.load()).toThrow(/Permission denied/);
    });
  });

  describe('reload', () => {
    it('should force reload configuration', () => {
      const loader = new ConfigLoader();
      
      loader.load();
      loader.reload();

      expect(mockFs.readFileSync).toHaveBeenCalledTimes(2);
    });

    it('should update cached configuration', () => {
      const loader = new ConfigLoader();
      
      const config1 = loader.load();
      expect(config1.setup_script).toBe('npm install');

      const updatedConfig = { ...validConfig, setup_script: 'yarn install' };
      mockFs.readFileSync.mockReturnValue(JSON.stringify(updatedConfig));

      const config2 = loader.reload();
      expect(config2.setup_script).toBe('yarn install');
    });
  });

  describe('clearCache', () => {
    it('should clear cached configuration', () => {
      const loader = new ConfigLoader();
      
      loader.load();
      loader.clearCache();
      loader.load();

      expect(mockFs.readFileSync).toHaveBeenCalledTimes(2);
    });
  });

  describe('module-level functions', () => {
    beforeEach(() => {
      clearConfigCache();
    });

    it('should load config with default loader', () => {
      const config = loadConfig();
      
      expect(config).toBeDefined();
      expect(config.sync?.enabled).toBe(true);
    });

    it('should load config with custom path', () => {
      const config = loadConfig('custom/settings.json');
      
      expect(config).toBeDefined();
      expect(mockFs.readFileSync).toHaveBeenCalled();
    });

    it('should reload config with default loader', () => {
      jest.clearAllMocks();
      loadConfig();
      reloadConfig();
      
      expect(mockFs.readFileSync).toHaveBeenCalledTimes(2);
    });

    it('should get config path from default loader', () => {
      const configPath = getConfigPath();
      
      expect(configPath).toContain('.zenflow/settings.json');
    });
  });

  describe('nested configuration merging', () => {
    it('should merge theme configuration correctly', () => {
      const configWithTheme = {
        theme: {
          colors: {
            brand: {
              primary: '#FF0000',
              secondary: '#00FF00',
              accent: '#0000FF',
              'accent-dark': '#000088',
            },
          },
        },
      };
      mockFs.readFileSync.mockReturnValue(JSON.stringify(configWithTheme));

      const loader = new ConfigLoader();
      const config = loader.load();

      expect(config.theme?.colors?.brand?.primary).toBe('#FF0000');
    });

    it('should merge accessibility configuration correctly', () => {
      const configWithA11y = {
        accessibility: {
          wcag: 'AAA' as const,
          contrastRatios: {
            normal: '7:1',
          },
        },
      };
      mockFs.readFileSync.mockReturnValue(JSON.stringify(configWithA11y));

      const loader = new ConfigLoader();
      const config = loader.load();

      expect(config.accessibility?.wcag).toBe('AAA');
      expect(config.accessibility?.contrastRatios?.normal).toBe('7:1');
    });
  });

  describe('array configuration', () => {
    it('should handle array configurations', () => {
      const configWithArrays = {
        copy_files: ['.env', '.env.local'],
        sync: {
          excluded_worktrees: ['temp', 'test'],
          notification_channels: ['console', 'log'],
        },
      };
      mockFs.readFileSync.mockReturnValue(JSON.stringify(configWithArrays));

      const loader = new ConfigLoader();
      const config = loader.load();

      expect(config.copy_files).toEqual(['.env', '.env.local']);
      expect(config.sync?.excluded_worktrees).toEqual(['temp', 'test']);
      expect(config.sync?.notification_channels).toEqual(['console', 'log']);
    });
  });
});
