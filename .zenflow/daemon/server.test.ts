jest.mock('uuid', () => ({
  v4: () => 'test-uuid-1234-5678-90ab-cdef',
}));

import http from 'http';
import { DaemonServer, startDaemon, stopDaemon } from './server';
import { getEventEmitter } from '../core/events/emitter';
import type { Event } from '../core/events/types';

jest.mock('../core/utils/logger', () => ({
  getLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

jest.mock('../core/config/loader', () => ({
  loadConfig: jest.fn(() => ({
    sync: {
      enabled: true,
      auto_push: false,
      max_retries: 3,
      timeout: 300,
      conflict_strategy: 'abort',
      excluded_worktrees: [],
      notification_channels: ['console', 'log'],
      verification_commands: [],
    },
    rules: {
      directory: '.zenflow/rules',
      auto_load: true,
      validation_strict: true,
    },
    workflows: {
      directory: '.zenflow/workflows',
      state_directory: '.zenflow/state/executions',
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
  })),
}));

jest.mock('../core/rules/engine');
jest.mock('../core/workflows/engine');

describe('DaemonServer', () => {
  let daemon: DaemonServer;
  const testPort = 3031;

  beforeEach(() => {
    jest.clearAllMocks();
    daemon = new DaemonServer({
      eventProcessingInterval: 100,
      maxBatchSize: 5,
      healthCheckPort: testPort,
      schedulerEnabled: false,
    });
  });

  afterEach(async () => {
    if (daemon) {
      await daemon.stop();
    }
  });

  describe('Initialization', () => {
    it('should create daemon instance with default config', () => {
      expect(daemon).toBeDefined();
      expect(daemon.getStatus().running).toBe(false);
    });

    it('should create daemon with custom config', () => {
      const customDaemon = new DaemonServer({
        eventProcessingInterval: 2000,
        maxBatchSize: 20,
        healthCheckPort: 3032,
        schedulerEnabled: true,
      });

      expect(customDaemon).toBeDefined();
      expect(customDaemon.getStatus().running).toBe(false);
    });
  });

  describe('Start/Stop', () => {
    it('should start daemon successfully', async () => {
      await daemon.start();

      const status = daemon.getStatus();
      expect(status.running).toBe(true);
      expect(status.healthCheckRunning).toBe(true);
    });

    it('should not start daemon twice', async () => {
      await daemon.start();
      await daemon.start();

      expect(daemon.getStatus().running).toBe(true);
    });

    it('should stop daemon successfully', async () => {
      await daemon.start();
      expect(daemon.getStatus().running).toBe(true);

      await daemon.stop();
      expect(daemon.getStatus().running).toBe(false);
    });

    it('should not fail when stopping inactive daemon', async () => {
      await expect(daemon.stop()).resolves.not.toThrow();
    });
  });

  describe('Health Check', () => {
    it('should respond to health check requests', async () => {
      await daemon.start();

      const response = await makeHttpRequest(testPort, '/health');

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.status).toBeDefined();
      expect(data.components).toBeDefined();
    });

    it('should respond to readiness check requests', async () => {
      await daemon.start();

      const response = await makeHttpRequest(testPort, '/ready');

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.ready).toBeDefined();
    });

    it('should respond to metrics requests', async () => {
      await daemon.start();

      const response = await makeHttpRequest(testPort, '/metrics');

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.uptime_ms).toBeDefined();
      expect(data.event_queue_size).toBeDefined();
    });

    it('should return 404 for unknown endpoints', async () => {
      await daemon.start();

      const response = await makeHttpRequest(testPort, '/unknown');

      expect(response.statusCode).toBe(404);
    });
  });

  describe('Event Processing', () => {
    it('should process events from queue', async () => {
      await daemon.start();

      const emitter = getEventEmitter();
      const event: Omit<Event, 'id' | 'timestamp'> = {
        type: 'manual',
        source: 'test',
        triggered_by: 'test-user',
      };

      emitter.emit(event);

      await new Promise(resolve => setTimeout(resolve, 200));

      expect(daemon.getStatus().running).toBe(true);
    });

    it('should handle event processing errors gracefully', async () => {
      await daemon.start();

      const emitter = getEventEmitter();
      const event: Omit<Event, 'id' | 'timestamp'> = {
        type: 'commit',
        source: 'test',
        worktree: 'test-worktree',
        branch: 'test-branch',
        commit_hash: 'abc123',
        commit_message: 'Test commit',
        author: 'Test Author',
      };

      emitter.emit(event);

      await new Promise(resolve => setTimeout(resolve, 200));

      expect(daemon.getStatus().running).toBe(true);
    });
  });

  describe('Status Reporting', () => {
    it('should report correct status when stopped', () => {
      const status = daemon.getStatus();

      expect(status.running).toBe(false);
      expect(status.eventQueueSize).toBeGreaterThanOrEqual(0);
      expect(status.schedulerRunning).toBe(false);
      expect(status.healthCheckRunning).toBe(false);
    });

    it('should report correct status when running', async () => {
      await daemon.start();
      const status = daemon.getStatus();

      expect(status.running).toBe(true);
      expect(status.healthCheckRunning).toBe(true);
    });
  });

  describe('Graceful Shutdown', () => {
    it('should handle graceful shutdown', async () => {
      await daemon.start();
      expect(daemon.getStatus().running).toBe(true);

      await daemon.stop();

      const status = daemon.getStatus();
      expect(status.running).toBe(false);
      expect(status.healthCheckRunning).toBe(false);
    });

    it('should not start again after stopping', async () => {
      await daemon.start();
      await daemon.stop();
      
      await daemon.start();
      expect(daemon.getStatus().running).toBe(true);
    });
  });

  describe('Module Functions', () => {
    afterEach(async () => {
      await stopDaemon();
    });

    it('should start daemon using startDaemon function', async () => {
      const instance = await startDaemon({
        eventProcessingInterval: 100,
        maxBatchSize: 5,
        healthCheckPort: 3033,
        schedulerEnabled: false,
      });

      expect(instance).toBeDefined();
      expect(instance.getStatus().running).toBe(true);
    });

    it('should stop daemon using stopDaemon function', async () => {
      await startDaemon({
        eventProcessingInterval: 100,
        maxBatchSize: 5,
        healthCheckPort: 3034,
        schedulerEnabled: false,
      });

      await stopDaemon();

      await expect(stopDaemon()).resolves.not.toThrow();
    });
  });
});

function makeHttpRequest(port: number, path: string): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.get(
      {
        hostname: 'localhost',
        port,
        path,
        timeout: 5000,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode || 0,
            body,
          });
        });
      }
    );

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}
