import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { getLogger } from '../core/utils/logger';

export interface DaemonStatus {
  running: boolean;
  pid?: number;
  uptime?: number;
  startedAt?: Date;
  health?: 'healthy' | 'unhealthy' | 'unknown';
}

export class DaemonManager {
  private repoPath: string;
  private pidFile: string;
  private logger = getLogger();

  constructor(repoPath: string) {
    this.repoPath = repoPath;
    this.pidFile = path.join(repoPath, '.zenflow', 'state', 'daemon.pid');
  }

  async start(): Promise<void> {
    const status = await this.getStatus();
    
    if (status.running) {
      throw new Error(`Daemon is already running (PID: ${status.pid})`);
    }

    await this.ensurePidDirectory();

    const daemonScript = path.join(__dirname, 'server.js');
    const logFile = path.join(this.repoPath, '.zenflow', 'logs', 'daemon.log');
    
    const logStream = await fs.open(logFile, 'a');
    
    const child = spawn('node', [daemonScript, this.repoPath], {
      detached: true,
      stdio: ['ignore', logStream.fd, logStream.fd],
    });

    child.unref();

    const pidData = {
      pid: child.pid,
      startedAt: new Date().toISOString(),
    };

    await fs.writeFile(this.pidFile, JSON.stringify(pidData, null, 2));
    
    this.logger.info('Daemon started', { pid: child.pid });
  }

  async stop(): Promise<void> {
    const status = await this.getStatus();
    
    if (!status.running) {
      throw new Error('Daemon is not running');
    }

    if (!status.pid) {
      throw new Error('Cannot determine daemon PID');
    }

    try {
      process.kill(status.pid, 'SIGTERM');
      
      await this.waitForShutdown(status.pid, 10000);
      
      await this.clearPidFile();
      
      this.logger.info('Daemon stopped', { pid: status.pid });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to stop daemon', { error: message });
      throw new Error(`Failed to stop daemon: ${message}`);
    }
  }

  async restart(): Promise<void> {
    const status = await this.getStatus();
    
    if (status.running) {
      await this.stop();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    await this.start();
  }

  async getStatus(): Promise<DaemonStatus> {
    try {
      const pidData = await this.readPidFile();
      
      if (!pidData) {
        return { running: false };
      }

      const isRunning = this.isProcessRunning(pidData.pid);
      
      if (!isRunning) {
        await this.clearPidFile();
        return { running: false };
      }

      const startedAt = new Date(pidData.startedAt);
      const uptime = Date.now() - startedAt.getTime();
      
      const health = await this.checkHealth(pidData.pid);

      return {
        running: true,
        pid: pidData.pid,
        uptime,
        startedAt,
        health,
      };
    } catch (error) {
      this.logger.error('Failed to get daemon status', { error });
      return { running: false, health: 'unknown' };
    }
  }

  private async readPidFile(): Promise<{ pid: number; startedAt: string } | null> {
    try {
      const content = await fs.readFile(this.pidFile, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  private async clearPidFile(): Promise<void> {
    try {
      await fs.unlink(this.pidFile);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  private isProcessRunning(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch (error) {
      return false;
    }
  }

  private async waitForShutdown(pid: number, timeout: number): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (!this.isProcessRunning(pid)) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    try {
      process.kill(pid, 'SIGKILL');
      this.logger.warn('Daemon did not shutdown gracefully, force killed', { pid });
    } catch (error) {
      this.logger.error('Failed to force kill daemon', { pid, error });
    }
  }

  private async checkHealth(pid: number): Promise<'healthy' | 'unhealthy' | 'unknown'> {
    return 'healthy';
  }

  private async ensurePidDirectory(): Promise<void> {
    const dir = path.dirname(this.pidFile);
    await fs.mkdir(dir, { recursive: true });
  }

  async getLogs(lines: number = 50): Promise<string[]> {
    const logFile = path.join(this.repoPath, '.zenflow', 'logs', 'daemon.log');
    
    try {
      const content = await fs.readFile(logFile, 'utf-8');
      const allLines = content.split('\n').filter(line => line.trim());
      return allLines.slice(-lines);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  async followLogs(callback: (line: string) => void): Promise<() => void> {
    const logFile = path.join(this.repoPath, '.zenflow', 'logs', 'daemon.log');
    
    const fs = await import('fs');
    const readline = await import('readline');
    
    let watching = true;
    let position = 0;

    try {
      const stats = await fs.promises.stat(logFile);
      position = stats.size;
    } catch (error) {
    }

    const watchInterval = setInterval(async () => {
      if (!watching) return;

      try {
        const stats = await fs.promises.stat(logFile);
        
        if (stats.size > position) {
          const stream = fs.createReadStream(logFile, {
            start: position,
            encoding: 'utf-8',
          });

          const rl = readline.createInterface({
            input: stream,
            crlfDelay: Infinity,
          });

          for await (const line of rl) {
            if (line.trim()) {
              callback(line);
            }
          }

          position = stats.size;
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          this.logger.error('Error following logs', { error });
        }
      }
    }, 500);

    return () => {
      watching = false;
      clearInterval(watchInterval);
    };
  }
}
