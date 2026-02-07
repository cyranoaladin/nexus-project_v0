import * as http from 'http';
import { getLogger } from '../core/utils/logger';
import { RuleEngine } from '../core/rules/engine';
import { WorkflowEngine } from '../core/workflows/engine';
import { EventEmitter } from '../core/events/emitter';
import type { HealthStatus } from './types';

export interface HealthCheckConfig {
  port: number;
  ruleEngine: RuleEngine;
  workflowEngine: WorkflowEngine;
  eventEmitter: EventEmitter;
}

export class HealthCheck {
  private logger = getLogger();
  private config: HealthCheckConfig;
  private server: http.Server | null = null;
  private startTime: Date;
  private running = false;

  constructor(config: HealthCheckConfig) {
    this.config = config;
    this.startTime = new Date();
    this.logger.debug('HealthCheck initialized');
  }

  async start(): Promise<void> {
    if (this.running) {
      this.logger.warn('Health check service is already running');
      return;
    }

    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.server.on('error', (error) => {
        this.logger.error('Health check server error', {
          error: error.message,
        });
        reject(error);
      });

      this.server.listen(this.config.port, () => {
        this.running = true;
        this.logger.info('Health check service started', {
          port: this.config.port,
        });
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    if (!this.server || !this.running) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.server!.close((error) => {
        if (error) {
          this.logger.error('Error stopping health check service', {
            error: error.message,
          });
          reject(error);
        } else {
          this.running = false;
          this.logger.info('Health check service stopped');
          resolve();
        }
      });
    });
  }

  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const url = req.url || '/';

    this.logger.debug('Health check request received', {
      url,
      method: req.method,
    });

    if (url === '/health' || url === '/') {
      this.handleHealthCheck(res);
    } else if (url === '/ready') {
      this.handleReadinessCheck(res);
    } else if (url === '/metrics') {
      this.handleMetrics(res);
    } else {
      this.sendResponse(res, 404, { error: 'Not found' });
    }
  }

  private handleHealthCheck(res: http.ServerResponse): void {
    try {
      const status = this.getHealthStatus();
      let statusCode = 200;
      if (status.status === 'unhealthy') {
        statusCode = 503;
      } else if (status.status === 'healthy' || status.status === 'degraded') {
        statusCode = 200;
      }
      this.sendResponse(res, statusCode, status);
    } catch (error) {
      this.logger.error('Error generating health status', {
        error: error instanceof Error ? error.message : String(error),
      });
      this.sendResponse(res, 500, {
        status: 'unhealthy',
        message: 'Internal server error',
      });
    }
  }

  private handleReadinessCheck(res: http.ServerResponse): void {
    const queueSize = this.config.eventEmitter.getQueueSize();
    
    if (queueSize > 1000) {
      this.sendResponse(res, 503, {
        ready: false,
        reason: 'Event queue overloaded',
        queueSize,
      });
    } else {
      this.sendResponse(res, 200, {
        ready: true,
        queueSize,
      });
    }
  }

  private handleMetrics(res: http.ServerResponse): void {
    try {
      const uptime = Date.now() - this.startTime.getTime();
      const queueSize = this.config.eventEmitter.getQueueSize();

      const metrics = {
        uptime_ms: uptime,
        uptime_seconds: Math.floor(uptime / 1000),
        event_queue_size: queueSize,
        timestamp: new Date().toISOString(),
      };

      this.sendResponse(res, 200, metrics);
    } catch (error) {
      this.logger.error('Error generating metrics', {
        error: error instanceof Error ? error.message : String(error),
      });
      this.sendResponse(res, 500, { error: 'Internal server error' });
    }
  }

  private getHealthStatus(): HealthStatus {
    const uptime = Date.now() - this.startTime.getTime();
    const queueSize = this.config.eventEmitter.getQueueSize();

    const eventQueueStatus = queueSize > 1000 ? 'error' : queueSize > 500 ? 'warning' : 'ok';

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    let message: string | undefined;

    if (eventQueueStatus === 'error') {
      overallStatus = 'unhealthy';
      message = 'Event queue overloaded';
    } else if (eventQueueStatus === 'warning') {
      overallStatus = 'degraded';
      message = 'Event queue size elevated';
    }

    const status: HealthStatus = {
      status: overallStatus,
      timestamp: new Date(),
      uptime: uptime,
      components: {
        eventQueue: {
          status: eventQueueStatus,
          size: queueSize,
        },
        ruleEngine: {
          status: 'ok',
          rulesLoaded: 0,
        },
        scheduler: {
          status: 'ok',
          tasksScheduled: 0,
        },
      },
      message,
    };

    return status;
  }

  private sendResponse(
    res: http.ServerResponse,
    statusCode: number,
    data: unknown
  ): void {
    res.writeHead(statusCode, {
      'Content-Type': 'application/json',
    });
    res.end(JSON.stringify(data, null, 2));
  }

  isRunning(): boolean {
    return this.running;
  }
}
