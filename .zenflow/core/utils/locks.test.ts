import * as fs from 'fs';
import * as path from 'path';
import { FileLock, createFileLock } from './locks';
import { TimeoutError } from './errors';

describe('FileLock', () => {
  let lockDir: string;
  let fileLock: FileLock;

  beforeEach(() => {
    lockDir = path.join(__dirname, '__test_locks__');
    if (fs.existsSync(lockDir)) {
      fs.rmSync(lockDir, { recursive: true, force: true });
    }
    fileLock = new FileLock(lockDir);
  });

  afterEach(() => {
    fileLock.cleanup();
    if (fs.existsSync(lockDir)) {
      fs.rmSync(lockDir, { recursive: true, force: true });
    }
  });

  describe('acquire', () => {
    it('should acquire a lock successfully', async () => {
      const lockId = await fileLock.acquire('test-resource');
      
      expect(lockId).toBeTruthy();
      expect(fileLock.isLocked('test-resource')).toBe(true);
      
      const lockInfo = fileLock.getLockInfo('test-resource');
      expect(lockInfo).toBeTruthy();
      expect(lockInfo?.lockId).toBe(lockId);
      expect(lockInfo?.resource).toBe('test-resource');
      expect(lockInfo?.pid).toBe(process.pid);
    });

    it('should wait for lock to be released', async () => {
      const lockId1 = await fileLock.acquire('test-resource');
      
      const promise = fileLock.acquire('test-resource', { timeout: 2000 });
      
      setTimeout(async () => {
        await fileLock.release('test-resource', lockId1);
      }, 500);
      
      const lockId2 = await promise;
      expect(lockId2).toBeTruthy();
      expect(lockId2).not.toBe(lockId1);
    });

    it('should timeout if lock cannot be acquired', async () => {
      await fileLock.acquire('test-resource');
      
      await expect(
        fileLock.acquire('test-resource', { timeout: 1000 })
      ).rejects.toThrow(TimeoutError);
    });

    it('should remove stale locks', async () => {
      const lockPath = path.join(lockDir, 'test-resource.lock');
      const staleLock = {
        lockId: 'stale-lock',
        resource: 'test-resource',
        acquiredAt: new Date(Date.now() - 4000000),
        pid: 999999,
        hostname: 'test-host',
      };
      
      fs.writeFileSync(lockPath, JSON.stringify(staleLock));
      
      const lockId = await fileLock.acquire('test-resource');
      expect(lockId).toBeTruthy();
      expect(fileLock.isLocked('test-resource')).toBe(true);
    });

    it('should handle concurrent lock acquisitions', async () => {
      const promises = Array.from({ length: 5 }, (_, i) =>
        fileLock.acquire(`resource-${i}`)
      );
      
      const lockIds = await Promise.all(promises);
      expect(lockIds).toHaveLength(5);
      expect(new Set(lockIds).size).toBe(5);
    });
  });

  describe('release', () => {
    it('should release a lock successfully', async () => {
      const lockId = await fileLock.acquire('test-resource');
      
      await fileLock.release('test-resource', lockId);
      
      expect(fileLock.isLocked('test-resource')).toBe(false);
      expect(fileLock.getLockInfo('test-resource')).toBeNull();
    });

    it('should handle releasing non-existent lock gracefully', async () => {
      await expect(
        fileLock.release('non-existent', 'fake-lock-id')
      ).resolves.not.toThrow();
    });

    it('should reject release with wrong lock ID', async () => {
      const lockId = await fileLock.acquire('test-resource');
      
      await expect(
        fileLock.release('test-resource', 'wrong-lock-id')
      ).rejects.toThrow('Lock ID mismatch');
      
      expect(fileLock.isLocked('test-resource')).toBe(true);
    });

    it('should handle multiple releases of same lock gracefully', async () => {
      const lockId = await fileLock.acquire('test-resource');
      
      await fileLock.release('test-resource', lockId);
      await expect(
        fileLock.release('test-resource', lockId)
      ).resolves.not.toThrow();
    });
  });

  describe('withLock', () => {
    it('should execute function with lock', async () => {
      let executed = false;
      
      const result = await fileLock.withLock('test-resource', async () => {
        executed = true;
        expect(fileLock.isLocked('test-resource')).toBe(true);
        return 'success';
      });
      
      expect(executed).toBe(true);
      expect(result).toBe('success');
      expect(fileLock.isLocked('test-resource')).toBe(false);
    });

    it('should release lock even if function throws', async () => {
      await expect(
        fileLock.withLock('test-resource', async () => {
          expect(fileLock.isLocked('test-resource')).toBe(true);
          throw new Error('Test error');
        })
      ).rejects.toThrow('Test error');
      
      expect(fileLock.isLocked('test-resource')).toBe(false);
    });

    it('should prevent concurrent access with lock', async () => {
      const execOrder: number[] = [];
      
      const task1 = fileLock.withLock('shared-resource', async () => {
        execOrder.push(1);
        await new Promise((resolve) => setTimeout(resolve, 200));
        execOrder.push(2);
      });
      
      const task2 = fileLock.withLock('shared-resource', async () => {
        execOrder.push(3);
        await new Promise((resolve) => setTimeout(resolve, 100));
        execOrder.push(4);
      });
      
      await Promise.all([task1, task2]);
      
      expect(execOrder).toEqual([1, 2, 3, 4]);
    });

    it('should allow parallel access to different resources', async () => {
      const execOrder: number[] = [];
      
      const task1 = fileLock.withLock('resource-1', async () => {
        execOrder.push(1);
        await new Promise((resolve) => setTimeout(resolve, 100));
        execOrder.push(2);
      });
      
      const task2 = fileLock.withLock('resource-2', async () => {
        execOrder.push(3);
        await new Promise((resolve) => setTimeout(resolve, 50));
        execOrder.push(4);
      });
      
      await Promise.all([task1, task2]);
      
      expect(execOrder).toContain(1);
      expect(execOrder).toContain(2);
      expect(execOrder).toContain(3);
      expect(execOrder).toContain(4);
      expect(execOrder.indexOf(4)).toBeLessThan(execOrder.indexOf(2));
    });
  });

  describe('forceRelease', () => {
    it('should forcibly release a lock', async () => {
      await fileLock.acquire('test-resource');
      
      fileLock.forceRelease('test-resource');
      
      expect(fileLock.isLocked('test-resource')).toBe(false);
    });

    it('should handle forcing release of non-existent lock', () => {
      expect(() => {
        fileLock.forceRelease('non-existent');
      }).not.toThrow();
    });
  });

  describe('isLocked', () => {
    it('should return true for locked resource', async () => {
      await fileLock.acquire('test-resource');
      expect(fileLock.isLocked('test-resource')).toBe(true);
    });

    it('should return false for unlocked resource', () => {
      expect(fileLock.isLocked('test-resource')).toBe(false);
    });
  });

  describe('getLockInfo', () => {
    it('should return lock info for locked resource', async () => {
      const lockId = await fileLock.acquire('test-resource');
      
      const lockInfo = fileLock.getLockInfo('test-resource');
      
      expect(lockInfo).toBeTruthy();
      expect(lockInfo?.lockId).toBe(lockId);
      expect(lockInfo?.resource).toBe('test-resource');
      expect(lockInfo?.pid).toBe(process.pid);
    });

    it('should return null for unlocked resource', () => {
      const lockInfo = fileLock.getLockInfo('test-resource');
      expect(lockInfo).toBeNull();
    });
  });

  describe('deadlock detection', () => {
    it('should detect and remove stale locks automatically', async () => {
      const lockPath = path.join(lockDir, 'stale-resource.lock');
      const staleLock = {
        lockId: 'stale-lock',
        resource: 'stale-resource',
        acquiredAt: new Date(Date.now() - 4000000),
        pid: 999999,
        hostname: 'test-host',
      };
      
      fs.writeFileSync(lockPath, JSON.stringify(staleLock));
      
      fileLock['detectDeadlocks']();
      
      expect(fs.existsSync(lockPath)).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('should release all locks and stop deadlock detection', async () => {
      await fileLock.acquire('resource-1');
      await fileLock.acquire('resource-2');
      await fileLock.acquire('resource-3');
      
      fileLock.cleanup();
      
      expect(fileLock.isLocked('resource-1')).toBe(false);
      expect(fileLock.isLocked('resource-2')).toBe(false);
      expect(fileLock.isLocked('resource-3')).toBe(false);
    });
  });

  describe('createFileLock', () => {
    it('should create a FileLock instance', () => {
      const lock = createFileLock(lockDir);
      expect(lock).toBeInstanceOf(FileLock);
      lock.cleanup();
    });
  });
});
