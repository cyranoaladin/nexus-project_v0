import * as fs from 'fs';
import * as path from 'path';
import { getLogger } from './logger';
import { TimeoutError } from './errors';

const logger = getLogger();

export interface LockOptions {
  timeout?: number;
  retryInterval?: number;
  lockDirectory?: string;
}

export interface LockInfo {
  lockId: string;
  resource: string;
  acquiredAt: Date;
  pid: number;
  hostname: string;
}

export class FileLock {
  private lockDirectory: string;
  private activeLocks: Map<string, LockInfo>;
  private deadlockCheckInterval: NodeJS.Timeout | null;

  constructor(lockDirectory?: string) {
    this.lockDirectory = lockDirectory || path.join(process.cwd(), '.zenflow', 'state', 'locks');
    this.activeLocks = new Map();
    this.deadlockCheckInterval = null;
    this.ensureLockDirectory();
    this.startDeadlockDetection();
  }

  private ensureLockDirectory(): void {
    if (!fs.existsSync(this.lockDirectory)) {
      fs.mkdirSync(this.lockDirectory, { recursive: true });
    }
  }

  async acquire(resource: string, options: LockOptions = {}): Promise<string> {
    const {
      timeout = 300000,
      retryInterval = 100,
    } = options;

    const lockId = this.generateLockId();
    const lockPath = this.getLockPath(resource);
    const startTime = Date.now();

    logger.debug('Attempting to acquire lock', { resource, lockId });

    while (true) {
      if (Date.now() - startTime > timeout) {
        logger.error('Lock acquisition timeout', { resource, lockId, timeout });
        throw new TimeoutError(
          `Failed to acquire lock for resource "${resource}" within ${timeout}ms`,
          timeout / 1000
        );
      }

      try {
        const lockInfo: LockInfo = {
          lockId,
          resource,
          acquiredAt: new Date(),
          pid: process.pid,
          hostname: require('os').hostname(),
        };

        fs.writeFileSync(lockPath, JSON.stringify(lockInfo, null, 2), {
          flag: 'wx',
        });

        this.activeLocks.set(resource, lockInfo);

        logger.info('Lock acquired successfully', { resource, lockId });
        return lockId;
      } catch (error: any) {
        if (error.code === 'EEXIST') {
          const existingLock = this.readLockFile(lockPath);
          
          if (existingLock && this.isStale(existingLock)) {
            logger.warn('Removing stale lock', {
              resource,
              staleLock: existingLock.lockId,
            });
            this.forceRelease(resource);
            continue;
          }

          await this.sleep(retryInterval);
          continue;
        }

        logger.error('Unexpected error acquiring lock', {
          resource,
          lockId,
          error: error.message,
        });
        throw error;
      }
    }
  }

  async release(resource: string, lockId: string): Promise<void> {
    const lockPath = this.getLockPath(resource);

    try {
      const existingLock = this.readLockFile(lockPath);

      if (!existingLock) {
        logger.warn('Attempted to release non-existent lock', { resource, lockId });
        return;
      }

      if (existingLock.lockId !== lockId) {
        logger.error('Lock ID mismatch during release', {
          resource,
          expectedLockId: lockId,
          actualLockId: existingLock.lockId,
        });
        throw new Error(
          `Lock ID mismatch: cannot release lock "${resource}" with ID "${lockId}"`
        );
      }

      fs.unlinkSync(lockPath);
      this.activeLocks.delete(resource);

      logger.info('Lock released successfully', { resource, lockId });
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        logger.warn('Lock file already removed', { resource, lockId });
        this.activeLocks.delete(resource);
        return;
      }

      logger.error('Error releasing lock', {
        resource,
        lockId,
        error: error.message,
      });
      throw error;
    }
  }

  async withLock<T>(
    resource: string,
    fn: () => Promise<T>,
    options: LockOptions = {}
  ): Promise<T> {
    let lockId: string | null = null;

    try {
      lockId = await this.acquire(resource, options);
      const result = await fn();
      return result;
    } finally {
      if (lockId) {
        await this.release(resource, lockId);
      }
    }
  }

  forceRelease(resource: string): void {
    const lockPath = this.getLockPath(resource);

    try {
      if (fs.existsSync(lockPath)) {
        fs.unlinkSync(lockPath);
        this.activeLocks.delete(resource);
        logger.warn('Lock forcibly released', { resource });
      }
    } catch (error: any) {
      logger.error('Error forcing lock release', {
        resource,
        error: error.message,
      });
      throw error;
    }
  }

  isLocked(resource: string): boolean {
    const lockPath = this.getLockPath(resource);
    return fs.existsSync(lockPath);
  }

  getLockInfo(resource: string): LockInfo | null {
    const lockPath = this.getLockPath(resource);
    return this.readLockFile(lockPath);
  }

  private readLockFile(lockPath: string): LockInfo | null {
    try {
      if (!fs.existsSync(lockPath)) {
        return null;
      }

      const content = fs.readFileSync(lockPath, 'utf8');
      const lockInfo = JSON.parse(content) as LockInfo;
      lockInfo.acquiredAt = new Date(lockInfo.acquiredAt);
      return lockInfo;
    } catch (error: any) {
      logger.error('Error reading lock file', {
        lockPath,
        error: error.message,
      });
      return null;
    }
  }

  private isStale(lockInfo: LockInfo): boolean {
    const maxLockAge = 3600000;
    const lockAge = Date.now() - new Date(lockInfo.acquiredAt).getTime();

    if (lockAge > maxLockAge) {
      return true;
    }

    try {
      process.kill(lockInfo.pid, 0);
      return false;
    } catch {
      return true;
    }
  }

  private getLockPath(resource: string): string {
    const sanitizedResource = resource.replace(/[^a-zA-Z0-9-_]/g, '_');
    return path.join(this.lockDirectory, `${sanitizedResource}.lock`);
  }

  private generateLockId(): string {
    return `${Date.now()}-${process.pid}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private startDeadlockDetection(): void {
    this.deadlockCheckInterval = setInterval(() => {
      this.detectDeadlocks();
    }, 60000);
  }

  private detectDeadlocks(): void {
    const lockFiles = fs.readdirSync(this.lockDirectory).filter((file) => file.endsWith('.lock'));

    for (const lockFile of lockFiles) {
      const lockPath = path.join(this.lockDirectory, lockFile);
      const lockInfo = this.readLockFile(lockPath);

      if (lockInfo && this.isStale(lockInfo)) {
        logger.warn('Deadlock detected: removing stale lock', {
          resource: lockInfo.resource,
          lockId: lockInfo.lockId,
          lockAge: Date.now() - new Date(lockInfo.acquiredAt).getTime(),
        });

        try {
          fs.unlinkSync(lockPath);
          this.activeLocks.delete(lockInfo.resource);
        } catch (error: any) {
          logger.error('Error removing stale lock during deadlock detection', {
            resource: lockInfo.resource,
            error: error.message,
          });
        }
      }
    }
  }

  cleanup(): void {
    if (this.deadlockCheckInterval) {
      clearInterval(this.deadlockCheckInterval);
      this.deadlockCheckInterval = null;
    }

    for (const resource of this.activeLocks.keys()) {
      try {
        this.forceRelease(resource);
      } catch (error: any) {
        logger.error('Error releasing lock during cleanup', {
          resource,
          error: error.message,
        });
      }
    }

    this.activeLocks.clear();
  }
}

export function createFileLock(lockDirectory?: string): FileLock {
  return new FileLock(lockDirectory);
}
