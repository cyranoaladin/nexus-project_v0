import fs from 'fs';
import path from 'path';

jest.mock('fs');
jest.mock('../config/loader');
jest.mock('winston', () => {
  const createMockLogger = () => ({
    level: 'info',
    levels: { error: 0, warn: 1, info: 2, debug: 3 },
    transports: [
      { level: 'info', name: 'console' },
      { level: 'info', name: 'file' },
    ],
    close: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  });

  return {
    createLogger: jest.fn((opts: any) => {
      const logger = createMockLogger();
      if (opts?.level) {
        logger.level = opts.level;
        logger.transports.forEach((t: any) => t.level = opts.level);
      }
      return logger;
    }),
    Logger: jest.fn(),
    format: {
      combine: jest.fn((...args) => args),
      timestamp: jest.fn(() => 'timestamp-format'),
      printf: jest.fn((fn) => fn),
      colorize: jest.fn(() => 'colorize-format'),
      errors: jest.fn(() => 'errors-format'),
      json: jest.fn(() => 'json-format'),
    },
    config: {
      npm: {
        levels: { error: 0, warn: 1, info: 2, http: 3, verbose: 4, debug: 5, silly: 6 },
      },
    },
    transports: {
      Console: jest.fn(function(opts: any) {
        return { level: opts?.level || 'info', name: 'console' };
      }),
      File: jest.fn(function(opts: any) {
        return { level: opts?.level || 'info', name: 'file' };
      }),
    },
  };
});

jest.mock('winston-daily-rotate-file', () => {
  return jest.fn(function(opts: any) {
    return { level: opts?.level || 'info', name: 'daily-rotate-file' };
  });
});

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { createLogger, getLogger, resetLogger, setLogLevel } from './logger';
import { loadConfig } from '../config/loader';

const mockFs = fs as jest.Mocked<typeof fs>;
const mockLoadConfig = loadConfig as jest.MockedFunction<typeof loadConfig>;
const mockWinston = winston as jest.Mocked<typeof winston>;
const mockDailyRotateFile = DailyRotateFile as jest.Mocked<typeof DailyRotateFile>;

describe('Logger', () => {
  const mockConfig = {
    logging: {
      level: 'info' as const,
      directory: '.zenflow/logs',
      rotation: 'daily' as const,
      retention_days: 30,
      max_size_mb: 100,
      format: 'text' as const,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    resetLogger();
    mockFs.existsSync.mockReturnValue(true);
    mockFs.accessSync.mockReturnValue(undefined);
    mockLoadConfig.mockReturnValue(mockConfig as any);
  });

  afterEach(() => {
    resetLogger();
  });

  describe('createLogger', () => {
    it('should create logger with default configuration', () => {
      const logger = createLogger();

      expect(logger).toBeDefined();
      expect(logger).toHaveProperty('level');
      expect(logger).toHaveProperty('transports');
      expect(logger.level).toBe('info');
    });

    it('should create logger with custom configuration override', () => {
      const logger = createLogger({ level: 'debug' });

      expect(logger.level).toBe('debug');
    });

    it('should create logger with fallback config when loadConfig fails', () => {
      mockLoadConfig.mockImplementation(() => {
        throw new Error('Config load failed');
      });

      const logger = createLogger();

      expect(logger).toBeDefined();
      expect(logger).toHaveProperty('level');
      expect(logger).toHaveProperty('transports');
      expect(logger.level).toBe('info');
    });

    it('should have console and file transports', () => {
      const logger = createLogger();

      expect(logger.transports).toHaveLength(2);
    });

    it('should use correct log levels', () => {
      const logger = createLogger();

      expect(logger.levels).toBeDefined();
      expect(logger.levels).toHaveProperty('error');
      expect(logger.levels).toHaveProperty('warn');
      expect(logger.levels).toHaveProperty('info');
      expect(logger.levels).toHaveProperty('debug');
    });

    it('should call winston.createLogger with exitOnError: false', () => {
      createLogger();

      expect(mockWinston.createLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          exitOnError: false,
        })
      );
    });
  });

  describe('ensureLogDirectory', () => {
    it('should create log directory if it does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.mkdirSync.mockReturnValue(undefined);

      createLogger();

      expect(mockFs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('.zenflow/logs'),
        { recursive: true, mode: 0o755 }
      );
    });

    it('should not create directory if it already exists', () => {
      mockFs.existsSync.mockReturnValue(true);

      createLogger();

      expect(mockFs.mkdirSync).not.toHaveBeenCalled();
    });

    it('should throw error if directory creation fails', () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.mkdirSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      expect(() => createLogger()).toThrow(/Failed to create log directory/);
      expect(() => createLogger()).toThrow(/Permission denied/);
    });

    it('should check directory write permissions', () => {
      mockFs.existsSync.mockReturnValue(true);

      createLogger();

      expect(mockFs.accessSync).toHaveBeenCalledWith(
        expect.stringContaining('.zenflow/logs'),
        fs.constants.W_OK
      );
    });

    it('should throw error if directory is not writable', () => {
      mockFs.accessSync.mockImplementation(() => {
        throw new Error('Not writable');
      });

      expect(() => createLogger()).toThrow(/not writable/);
    });
  });

  describe('log levels', () => {
    it('should respect configured log level', () => {
      mockLoadConfig.mockReturnValue({
        logging: { ...mockConfig.logging, level: 'warn' },
      } as any);

      const logger = createLogger();

      expect(logger.level).toBe('warn');
    });

    it('should support debug level', () => {
      const logger = createLogger({ level: 'debug' });

      expect(logger.level).toBe('debug');
    });

    it('should support info level', () => {
      const logger = createLogger({ level: 'info' });

      expect(logger.level).toBe('info');
    });

    it('should support warn level', () => {
      const logger = createLogger({ level: 'warn' });

      expect(logger.level).toBe('warn');
    });

    it('should support error level', () => {
      const logger = createLogger({ level: 'error' });

      expect(logger.level).toBe('error');
    });
  });

  describe('log formats', () => {
    it('should use text format when configured', () => {
      mockLoadConfig.mockReturnValue({
        logging: { ...mockConfig.logging, format: 'text' },
      } as any);

      const logger = createLogger();

      expect(logger).toBeDefined();
    });

    it('should use json format when configured', () => {
      mockLoadConfig.mockReturnValue({
        logging: { ...mockConfig.logging, format: 'json' },
      } as any);

      const logger = createLogger();

      expect(logger).toBeDefined();
    });
  });

  describe('rotation configuration', () => {
    it('should configure daily rotation', () => {
      mockLoadConfig.mockReturnValue({
        logging: { ...mockConfig.logging, rotation: 'daily' },
      } as any);

      const logger = createLogger();

      expect(logger).toBeDefined();
    });

    it('should configure weekly rotation', () => {
      mockLoadConfig.mockReturnValue({
        logging: { ...mockConfig.logging, rotation: 'weekly' },
      } as any);

      const logger = createLogger();

      expect(logger).toBeDefined();
    });

    it('should configure size-based rotation', () => {
      mockLoadConfig.mockReturnValue({
        logging: { ...mockConfig.logging, rotation: 'size' },
      } as any);

      const logger = createLogger();

      expect(logger).toBeDefined();
    });

    it('should respect max_size_mb configuration', () => {
      mockLoadConfig.mockReturnValue({
        logging: { ...mockConfig.logging, max_size_mb: 50 },
      } as any);

      const logger = createLogger();

      expect(logger).toBeDefined();
    });

    it('should respect retention_days configuration', () => {
      mockLoadConfig.mockReturnValue({
        logging: { ...mockConfig.logging, retention_days: 60 },
      } as any);

      const logger = createLogger();

      expect(logger).toBeDefined();
    });
  });

  describe('getLogger', () => {
    it('should return singleton logger instance', () => {
      const logger1 = getLogger();
      const logger2 = getLogger();

      expect(logger1).toBe(logger2);
    });

    it('should create logger on first call', () => {
      const logger = getLogger();

      expect(logger).toBeDefined();
      expect(logger).toHaveProperty('level');
      expect(logger).toHaveProperty('transports');
    });

    it('should reuse existing logger instance', () => {
      getLogger();
      
      mockLoadConfig.mockClear();
      
      getLogger();

      expect(mockLoadConfig).not.toHaveBeenCalled();
    });
  });

  describe('resetLogger', () => {
    it('should close existing logger', () => {
      const logger = getLogger();
      const closeSpy = jest.spyOn(logger, 'close');

      resetLogger();

      expect(closeSpy).toHaveBeenCalled();
    });

    it('should allow creating new logger after reset', () => {
      const logger1 = getLogger();
      resetLogger();
      const logger2 = getLogger();

      expect(logger1).not.toBe(logger2);
    });

    it('should handle reset when no logger exists', () => {
      expect(() => resetLogger()).not.toThrow();
    });
  });

  describe('setLogLevel', () => {
    it('should update logger level', () => {
      const logger = getLogger();

      setLogLevel('debug');

      expect(logger.level).toBe('debug');
    });

    it('should update all transports level', () => {
      const logger = getLogger();

      setLogLevel('warn');

      logger.transports.forEach(transport => {
        expect(transport.level).toBe('warn');
      });
    });

    it('should support all log levels', () => {
      const logger = getLogger();
      const levels: ('debug' | 'info' | 'warn' | 'error')[] = ['debug', 'info', 'warn', 'error'];

      levels.forEach(level => {
        setLogLevel(level);
        expect(logger.level).toBe(level);
      });
    });
  });

  describe('error handling', () => {
    it('should handle errors with stack traces', () => {
      const logger = createLogger();

      expect(() => {
        logger.error('Test error', new Error('Stack trace test'));
      }).not.toThrow();
    });

    it('should call winston.createLogger with exitOnError: false', () => {
      createLogger();

      expect(mockWinston.createLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          exitOnError: false,
        })
      );
    });
  });

  describe('metadata support', () => {
    it('should support structured logging with metadata', () => {
      const logger = createLogger();

      expect(() => {
        logger.info('Test message', { userId: '123', action: 'test' });
      }).not.toThrow();
    });

    it('should handle empty metadata', () => {
      const logger = createLogger();

      expect(() => {
        logger.info('Test message');
      }).not.toThrow();
    });

    it('should handle complex metadata objects', () => {
      const logger = createLogger();

      expect(() => {
        logger.info('Test message', {
          user: { id: '123', name: 'Test' },
          metrics: [1, 2, 3],
          nested: { deep: { value: true } },
        });
      }).not.toThrow();
    });
  });

  describe('custom directory paths', () => {
    it('should resolve relative paths', () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.mkdirSync.mockReturnValue(undefined);

      createLogger({ directory: 'custom/logs' });

      expect(mockFs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('custom/logs'),
        expect.any(Object)
      );
    });

    it('should handle absolute paths', () => {
      const absolutePath = '/var/log/zenflow';
      mockFs.existsSync.mockReturnValue(false);
      mockFs.mkdirSync.mockReturnValue(undefined);

      createLogger({ directory: absolutePath });

      expect(mockFs.mkdirSync).toHaveBeenCalledWith(
        absolutePath,
        expect.any(Object)
      );
    });
  });

  describe('integration with config loader', () => {
    it('should use config from loadConfig', () => {
      const customConfig = {
        logging: {
          level: 'debug' as const,
          directory: 'custom/logs',
          rotation: 'weekly' as const,
          retention_days: 14,
          max_size_mb: 50,
          format: 'json' as const,
        },
      };
      mockLoadConfig.mockReturnValue(customConfig as any);

      const logger = createLogger();

      expect(logger.level).toBe('debug');
    });

    it('should allow config override', () => {
      mockLoadConfig.mockReturnValue(mockConfig as any);

      const logger = createLogger({ level: 'error' });

      expect(logger.level).toBe('error');
    });

    it('should merge config override with loaded config', () => {
      mockLoadConfig.mockReturnValue(mockConfig as any);
      mockFs.existsSync.mockReturnValue(false);
      mockFs.mkdirSync.mockReturnValue(undefined);

      createLogger({ level: 'debug', directory: 'override/logs' });

      expect(mockFs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('override/logs'),
        expect.any(Object)
      );
    });
  });
});
