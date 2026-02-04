import { SyncValidator } from './validator';
import { GitClient } from '../git/client';
import type { Worktree } from '../git/types';
import { exec } from 'child_process';
import { statfs } from 'fs';

jest.mock('child_process');
jest.mock('fs');
jest.mock('../git/client');
jest.mock('../utils/logger', () => ({
  getLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

describe('SyncValidator', () => {
  let validator: SyncValidator;
  let mockGitClient: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockGitClient = {
      getWorktree: jest.fn(),
    };

    (GitClient as any).mockImplementation(() => mockGitClient);

    validator = new SyncValidator('/test/repo');
  });

  describe('validateSync', () => {
    it('should validate all checks successfully', async () => {
      const mockWorktree: Worktree = {
        path: '/test/worktree',
        branch: 'feature/test',
        commit: 'abc123',
        locked: false,
        prunable: false,
      };

      mockGitClient.getWorktree.mockResolvedValue(mockWorktree);

      (statfs as any).mockImplementation((path: string, callback: Function) => {
        callback(null, {
          bavail: 2097152,
          bsize: 1024,
        });
      });

      (exec as any).mockImplementation((cmd: string, options: any, callback: Function) => {
        if (cmd.includes('git fsck')) {
          callback(null, { stdout: '', stderr: '' });
        } else if (cmd.includes('git status')) {
          callback(null, { stdout: '', stderr: '' });
        } else if (cmd.includes('test -w')) {
          callback(null, { stdout: '', stderr: '' });
        } else if (cmd.includes('git remote get-url')) {
          callback(null, { stdout: 'https://github.com/test/repo.git\n', stderr: '' });
        } else if (cmd.includes('git ls-remote')) {
          callback(null, { stdout: '', stderr: '' });
        }
      });

      const result = await validator.validateSync('feature/test');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.checks.length).toBeGreaterThan(0);
    });

    it('should fail if worktree does not exist', async () => {
      mockGitClient.getWorktree.mockResolvedValue(null);

      (statfs as any).mockImplementation((path: string, callback: Function) => {
        callback(null, {
          bavail: 2097152,
          bsize: 1024,
        });
      });

      (exec as any).mockImplementation((cmd: string, options: any, callback: Function) => {
        callback(null, { stdout: '', stderr: '' });
      });

      const result = await validator.validateSync('nonexistent');

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('does not exist');
    });

    it('should fail if worktree is locked', async () => {
      const mockWorktree: Worktree = {
        path: '/test/worktree',
        branch: 'feature/test',
        commit: 'abc123',
        locked: true,
        prunable: false,
      };

      mockGitClient.getWorktree.mockResolvedValue(mockWorktree);

      (statfs as any).mockImplementation((path: string, callback: Function) => {
        callback(null, {
          bavail: 2097152,
          bsize: 1024,
        });
      });

      (exec as any).mockImplementation((cmd: string, options: any, callback: Function) => {
        callback(null, { stdout: '', stderr: '' });
      });

      const result = await validator.validateSync('feature/test');

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('locked');
    });

    it('should fail if worktree is prunable', async () => {
      const mockWorktree: Worktree = {
        path: '/test/worktree',
        branch: 'feature/test',
        commit: 'abc123',
        locked: false,
        prunable: true,
      };

      mockGitClient.getWorktree.mockResolvedValue(mockWorktree);

      (statfs as any).mockImplementation((path: string, callback: Function) => {
        callback(null, {
          bavail: 2097152,
          bsize: 1024,
        });
      });

      (exec as any).mockImplementation((cmd: string, options: any, callback: Function) => {
        callback(null, { stdout: '', stderr: '' });
      });

      const result = await validator.validateSync('feature/test');

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('prunable');
    });

    it('should fail if insufficient disk space', async () => {
      const mockWorktree: Worktree = {
        path: '/test/worktree',
        branch: 'feature/test',
        commit: 'abc123',
        locked: false,
        prunable: false,
      };

      mockGitClient.getWorktree.mockResolvedValue(mockWorktree);

      (statfs as any).mockImplementation((path: string, callback: Function) => {
        callback(null, {
          bavail: 100,
          bsize: 1024,
        });
      });

      (exec as any).mockImplementation((cmd: string, options: any, callback: Function) => {
        callback(null, { stdout: '', stderr: '' });
      });

      const result = await validator.validateSync('feature/test');

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('disk space'))).toBe(true);
    });

    it('should skip disk check if option is set', async () => {
      const mockWorktree: Worktree = {
        path: '/test/worktree',
        branch: 'feature/test',
        commit: 'abc123',
        locked: false,
        prunable: false,
      };

      mockGitClient.getWorktree.mockResolvedValue(mockWorktree);

      (exec as any).mockImplementation((cmd: string, options: any, callback: Function) => {
        callback(null, { stdout: '', stderr: '' });
      });

      const result = await validator.validateSync('feature/test', { skipDiskCheck: true });

      const diskCheckExists = result.checks.some(c => c.name === 'disk_space');
      expect(diskCheckExists).toBe(false);
    });

    it('should skip network check if option is set', async () => {
      const mockWorktree: Worktree = {
        path: '/test/worktree',
        branch: 'feature/test',
        commit: 'abc123',
        locked: false,
        prunable: false,
      };

      mockGitClient.getWorktree.mockResolvedValue(mockWorktree);

      (statfs as any).mockImplementation((path: string, callback: Function) => {
        callback(null, {
          bavail: 2097152,
          bsize: 1024,
        });
      });

      (exec as any).mockImplementation((cmd: string, options: any, callback: Function) => {
        callback(null, { stdout: '', stderr: '' });
      });

      const result = await validator.validateSync('feature/test', { skipNetworkCheck: true });

      const networkCheckExists = result.checks.some(c => c.name === 'network_connectivity');
      expect(networkCheckExists).toBe(false);
    });

    it('should warn if git fsck fails but continue', async () => {
      const mockWorktree: Worktree = {
        path: '/test/worktree',
        branch: 'feature/test',
        commit: 'abc123',
        locked: false,
        prunable: false,
      };

      mockGitClient.getWorktree.mockResolvedValue(mockWorktree);

      (statfs as any).mockImplementation((path: string, callback: Function) => {
        callback(null, {
          bavail: 2097152,
          bsize: 1024,
        });
      });

      (exec as any).mockImplementation((cmd: string, options: any, callback: Function) => {
        if (cmd.includes('git fsck')) {
          callback(new Error('fsck failed'), { stdout: '', stderr: '' });
        } else {
          callback(null, { stdout: '', stderr: '' });
        }
      });

      const result = await validator.validateSync('feature/test');

      expect(result.valid).toBe(false);
      const fsckCheck = result.checks.find(c => c.name === 'repository_health');
      expect(fsckCheck?.passed).toBe(false);
    });

    it('should warn if working directory has uncommitted changes', async () => {
      const mockWorktree: Worktree = {
        path: '/test/worktree',
        branch: 'feature/test',
        commit: 'abc123',
        locked: false,
        prunable: false,
      };

      mockGitClient.getWorktree.mockResolvedValue(mockWorktree);

      (statfs as any).mockImplementation((path: string, callback: Function) => {
        callback(null, {
          bavail: 2097152,
          bsize: 1024,
        });
      });

      (exec as any).mockImplementation((cmd: string, options: any, callback: Function) => {
        if (cmd.includes('git status')) {
          callback(null, { stdout: 'M file1.ts\nA file2.ts\n', stderr: '' });
        } else {
          callback(null, { stdout: '', stderr: '' });
        }
      });

      const result = await validator.validateSync('feature/test');

      const permCheck = result.checks.find(c => c.name === 'file_permissions');
      expect(permCheck?.passed).toBe(false);
      expect(permCheck?.message).toContain('uncommitted changes');
    });

    it('should handle network check with no remote', async () => {
      const mockWorktree: Worktree = {
        path: '/test/worktree',
        branch: 'feature/test',
        commit: 'abc123',
        locked: false,
        prunable: false,
      };

      mockGitClient.getWorktree.mockResolvedValue(mockWorktree);

      (statfs as any).mockImplementation((path: string, callback: Function) => {
        callback(null, {
          bavail: 2097152,
          bsize: 1024,
        });
      });

      (exec as any).mockImplementation((cmd: string, options: any, callback: Function) => {
        if (cmd.includes('git remote get-url')) {
          callback(new Error('No remote'), { stdout: '', stderr: '' });
        } else {
          callback(null, { stdout: '', stderr: '' });
        }
      });

      const result = await validator.validateSync('feature/test');

      const networkCheck = result.checks.find(c => c.name === 'network_connectivity');
      expect(networkCheck?.passed).toBe(true);
      expect(networkCheck?.message).toContain('No remote configured');
    });
  });

  describe('setMinDiskSpace', () => {
    it('should update minimum disk space requirement', () => {
      const newMinBytes = 2 * 1024 * 1024 * 1024;
      validator.setMinDiskSpace(newMinBytes);

      expect(() => validator.setMinDiskSpace(newMinBytes)).not.toThrow();
    });
  });
});
