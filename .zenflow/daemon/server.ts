#!/usr/bin/env node

import { getLogger } from '../core/utils/logger';
import path from 'path';

const logger = getLogger();

class DaemonServer {
  private repoPath: string;
  private running: boolean = false;

  constructor(repoPath: string) {
    this.repoPath = path.resolve(repoPath);
  }

  async start(): Promise<void> {
    this.running = true;
    
    logger.info('Zenflow daemon starting', {
      repoPath: this.repoPath,
      pid: process.pid,
    });

    this.setupSignalHandlers();

    while (this.running) {
      await this.tick();
      await this.sleep(5000);
    }

    logger.info('Zenflow daemon stopped');
  }

  private async tick(): Promise<void> {
    try {
      logger.debug('Daemon heartbeat', { timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('Error in daemon tick', { error });
    }
  }

  private setupSignalHandlers(): void {
    process.on('SIGTERM', () => {
      logger.info('Received SIGTERM, shutting down gracefully');
      this.shutdown();
    });

    process.on('SIGINT', () => {
      logger.info('Received SIGINT, shutting down gracefully');
      this.shutdown();
    });

    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', { error });
      this.shutdown();
    });

    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled rejection', { reason });
    });
  }

  private shutdown(): void {
    if (!this.running) return;
    
    logger.info('Shutting down daemon');
    this.running = false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

const repoPath = process.argv[2] || process.cwd();
const server = new DaemonServer(repoPath);

server.start().catch((error) => {
  logger.error('Daemon failed to start', { error });
  process.exit(1);
});
