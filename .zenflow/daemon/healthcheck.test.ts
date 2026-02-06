import http from 'http';
import { HealthCheck } from './healthcheck';
import { RuleEngine } from '../core/rules/engine';
import { WorkflowEngine } from '../core/workflows/engine';
import { EventEmitter } from '../core/events/emitter';

jest.mock('../core/utils/logger', () => ({
  getLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

jest.mock('../core/rules/engine');
jest.mock('../core/workflows/engine');
jest.mock('../core/events/emitter');

describe('HealthCheck', () => {
  let healthCheck: HealthCheck;
  let mockRuleEngine: jest.Mocked<RuleEngine>;
  let mockWorkflowEngine: jest.Mocked<WorkflowEngine>;
  let mockEventEmitter: jest.Mocked<EventEmitter>;
  const testPort = 3040;

  beforeEach(() => {
    mockRuleEngine = {} as any;
    mockWorkflowEngine = {} as any;
    mockEventEmitter = {
      getQueueSize: jest.fn().mockReturnValue(0),
    } as any;

    healthCheck = new HealthCheck({
      port: testPort,
      ruleEngine: mockRuleEngine,
      workflowEngine: mockWorkflowEngine,
      eventEmitter: mockEventEmitter,
    });
  });

  afterEach(async () => {
    if (healthCheck) {
      await healthCheck.stop();
    }
  });

  describe('Initialization', () => {
    it('should create health check instance', () => {
      expect(healthCheck).toBeDefined();
      expect(healthCheck.isRunning()).toBe(false);
    });
  });

  describe('Start/Stop', () => {
    it('should start health check service', async () => {
      await healthCheck.start();
      expect(healthCheck.isRunning()).toBe(true);
    });

    it('should stop health check service', async () => {
      await healthCheck.start();
      await healthCheck.stop();
      expect(healthCheck.isRunning()).toBe(false);
    });

    it('should not start twice', async () => {
      await healthCheck.start();
      await healthCheck.start();
      expect(healthCheck.isRunning()).toBe(true);
    });

    it('should handle stop when not running', async () => {
      await expect(healthCheck.stop()).resolves.not.toThrow();
    });
  });

  describe('Health Endpoint', () => {
    it('should respond to /health with 200 when healthy', async () => {
      await healthCheck.start();

      const response = await makeHttpRequest(testPort, '/health');

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.status).toBe('healthy');
      expect(data.components).toBeDefined();
      expect(data.components.eventQueue).toBeDefined();
      expect(data.components.ruleEngine).toBeDefined();
      expect(data.components.scheduler).toBeDefined();
    });

    it('should respond to / with health status', async () => {
      await healthCheck.start();
      await new Promise(resolve => setTimeout(resolve, 50));

      const response = await makeHttpRequest(testPort, '/');

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.status).toBeDefined();
    });

    it('should report degraded status when queue is elevated', async () => {
      mockEventEmitter.getQueueSize.mockReturnValue(600);
      await healthCheck.start();
      await new Promise(resolve => setTimeout(resolve, 50));

      const response = await makeHttpRequest(testPort, '/health');

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.status).toBe('degraded');
      expect(data.message).toContain('elevated');
    });

    it('should report unhealthy status when queue is overloaded', async () => {
      mockEventEmitter.getQueueSize.mockReturnValue(1500);
      await healthCheck.start();
      await new Promise(resolve => setTimeout(resolve, 50));

      const response = await makeHttpRequest(testPort, '/health');

      expect(response.statusCode).toBe(503);
      const data = JSON.parse(response.body);
      expect(data.status).toBe('unhealthy');
      expect(data.message).toContain('overloaded');
    });

    it('should include uptime in health status', async () => {
      await healthCheck.start();
      await new Promise(resolve => setTimeout(resolve, 100));

      const response = await makeHttpRequest(testPort, '/health');

      const data = JSON.parse(response.body);
      expect(data.uptime).toBeGreaterThan(0);
    });
  });

  describe('Readiness Endpoint', () => {
    it('should respond to /ready with 200 when ready', async () => {
      await healthCheck.start();
      await new Promise(resolve => setTimeout(resolve, 50));

      const response = await makeHttpRequest(testPort, '/ready');

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.ready).toBe(true);
      expect(data.queueSize).toBe(0);
    });

    it('should respond to /ready with 503 when not ready', async () => {
      mockEventEmitter.getQueueSize.mockReturnValue(1500);
      await healthCheck.start();
      await new Promise(resolve => setTimeout(resolve, 50));

      const response = await makeHttpRequest(testPort, '/ready');

      expect(response.statusCode).toBe(503);
      const data = JSON.parse(response.body);
      expect(data.ready).toBe(false);
      expect(data.reason).toContain('overloaded');
    });
  });

  describe('Metrics Endpoint', () => {
    it('should respond to /metrics with metrics data', async () => {
      await healthCheck.start();
      await new Promise(resolve => setTimeout(resolve, 100));

      const response = await makeHttpRequest(testPort, '/metrics');

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.uptime_ms).toBeGreaterThan(0);
      expect(data.uptime_seconds).toBeGreaterThanOrEqual(0);
      expect(data.event_queue_size).toBe(0);
      expect(data.timestamp).toBeDefined();
    });
  });

  describe('Unknown Endpoints', () => {
    it('should return 404 for unknown endpoints', async () => {
      await healthCheck.start();
      await new Promise(resolve => setTimeout(resolve, 50));

      const response = await makeHttpRequest(testPort, '/unknown');

      expect(response.statusCode).toBe(404);
      const data = JSON.parse(response.body);
      expect(data.error).toBe('Not found');
    });
  });

  describe('Error Handling', () => {
    it('should handle errors gracefully', async () => {
      mockEventEmitter.getQueueSize.mockImplementation(() => {
        throw new Error('Test error');
      });

      await healthCheck.start();
      await new Promise(resolve => setTimeout(resolve, 50));

      const response = await makeHttpRequest(testPort, '/health');

      expect(response.statusCode).toBe(500);
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
