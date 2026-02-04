import { RollbackManager } from './rollback';
import { GitClient } from '../git/client';
import { RollbackError, GitOperationError } from '../utils/errors';
import type { BackupInfo } from './merger';

jest.mock('../git/client');
jest.mock('child_process');
jest.mock('../utils/logger', () => ({
  getLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

const { exec } = require('child_process');
const mockExec = exec as jest.Mock;

describe('RollbackManager', () => {
  let rollbackManager: RollbackManager;
  let mockGitClient: any;

  const mockBackup: BackupInfo = {
    stashId: 'stash@{0}',
    commitHash: 'target-commit-hash',
    timestamp: new Date('2024-01-01T00:00:00Z'),
    branch: 'feature/test',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockGitClient = {
      applyStash: jest.fn(),
    };

    (GitClient as any).mockImplementation(() => mockGitClient);

    rollbackManager = new RollbackManager('/test/repo');
  });

  describe('rollback', () => {
    it('should successfully rollback to previous commit and restore stash', async () => {
      mockExec.mockImplementation((cmd: string, options: any, callback: any) => {
        if (cmd.includes('rev-parse HEAD')) {
          callback(null, { stdout: 'current-commit-hash\n', stderr: '' });
        } else if (cmd.includes('status --porcelain')) {
          callback(null, { stdout: '', stderr: '' });
        } else if (cmd.includes('reset --mixed')) {
          callback(null, { stdout: '', stderr: '' });
        }
      });

      mockGitClient.applyStash.mockResolvedValue(undefined);

      const result = await rollbackManager.rollback(mockBackup);

      expect(result.success).toBe(true);
      expect(result.previousCommit).toBe('current-commit-hash');
      expect(result.restoredStash).toBe('stash@{0}');
      expect(mockGitClient.applyStash).toHaveBeenCalledWith('stash@{0}');
    });

    it('should skip rollback if already at target commit', async () => {
      mockExec.mockImplementation((cmd: string, options: any, callback: any) => {
        if (cmd.includes('rev-parse HEAD')) {
          callback(null, { stdout: 'target-commit-hash\n', stderr: '' });
        }
      });

      const result = await rollbackManager.rollback(mockBackup);

      expect(result.success).toBe(true);
      expect(result.previousCommit).toBe('target-commit-hash');
      expect(mockGitClient.applyStash).not.toHaveBeenCalled();
    });

    it('should fail if uncommitted changes exist and force is false', async () => {
      mockExec.mockImplementation((cmd: string, options: any, callback: any) => {
        if (cmd.includes('rev-parse HEAD')) {
          callback(null, { stdout: 'current-commit-hash\n', stderr: '' });
        } else if (cmd.includes('status --porcelain')) {
          callback(null, { stdout: 'M file.ts\n', stderr: '' });
        }
      });

      await expect(rollbackManager.rollback(mockBackup)).rejects.toThrow(RollbackError);
      await expect(rollbackManager.rollback(mockBackup)).rejects.toThrow(/Uncommitted changes/);
    });

    it('should proceed with rollback if force option is true despite uncommitted changes', async () => {
      mockExec.mockImplementation((cmd: string, options: any, callback: any) => {
        if (cmd.includes('rev-parse HEAD')) {
          callback(null, { stdout: 'current-commit-hash\n', stderr: '' });
        } else if (cmd.includes('status --porcelain')) {
          callback(null, { stdout: 'M file.ts\n', stderr: '' });
        } else if (cmd.includes('reset --hard')) {
          callback(null, { stdout: '', stderr: '' });
        }
      });

      mockGitClient.applyStash.mockResolvedValue(undefined);

      const result = await rollbackManager.rollback(mockBackup, { force: true });

      expect(result.success).toBe(true);
      expect(result.previousCommit).toBe('current-commit-hash');
    });

    it('should use hard reset when force is true', async () => {
      mockExec.mockImplementation((cmd: string, options: any, callback: any) => {
        if (cmd.includes('rev-parse HEAD')) {
          callback(null, { stdout: 'current-commit-hash\n', stderr: '' });
        } else if (cmd.includes('status --porcelain')) {
          callback(null, { stdout: '', stderr: '' });
        } else if (cmd.includes('reset --hard')) {
          callback(null, { stdout: '', stderr: '' });
        }
      });

      mockGitClient.applyStash.mockResolvedValue(undefined);

      await rollbackManager.rollback(mockBackup, { force: true });

      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('reset --hard'),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should use mixed reset when force is false', async () => {
      mockExec.mockImplementation((cmd: string, options: any, callback: any) => {
        if (cmd.includes('rev-parse HEAD')) {
          callback(null, { stdout: 'current-commit-hash\n', stderr: '' });
        } else if (cmd.includes('status --porcelain')) {
          callback(null, { stdout: '', stderr: '' });
        } else if (cmd.includes('reset --mixed')) {
          callback(null, { stdout: '', stderr: '' });
        }
      });

      mockGitClient.applyStash.mockResolvedValue(undefined);

      await rollbackManager.rollback(mockBackup);

      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('reset --mixed'),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should continue rollback even if stash restore fails', async () => {
      mockExec.mockImplementation((cmd: string, options: any, callback: any) => {
        if (cmd.includes('rev-parse HEAD')) {
          callback(null, { stdout: 'current-commit-hash\n', stderr: '' });
        } else if (cmd.includes('status --porcelain')) {
          callback(null, { stdout: '', stderr: '' });
        } else if (cmd.includes('reset --mixed')) {
          callback(null, { stdout: '', stderr: '' });
        }
      });

      mockGitClient.applyStash.mockRejectedValue(new Error('Stash not found'));

      const result = await rollbackManager.rollback(mockBackup);

      expect(result.success).toBe(true);
      expect(result.previousCommit).toBe('current-commit-hash');
      expect(result.restoredStash).toBeUndefined();
    });

    it('should throw RollbackError on reset failure', async () => {
      mockExec.mockImplementation((cmd: string, options: any, callback: any) => {
        if (cmd.includes('rev-parse HEAD')) {
          callback(null, { stdout: 'current-commit-hash\n', stderr: '' });
        } else if (cmd.includes('status --porcelain')) {
          callback(null, { stdout: '', stderr: '' });
        } else if (cmd.includes('reset')) {
          callback(new Error('Reset failed'), null);
        }
      });

      await expect(rollbackManager.rollback(mockBackup)).rejects.toThrow(RollbackError);
    });
  });

  describe('rollbackBySteps', () => {
    it('should rollback by specified number of steps', async () => {
      mockExec.mockImplementation((cmd: string, options: any, callback: any) => {
        if (cmd.includes('rev-parse HEAD~')) {
          callback(null, { stdout: 'target-commit-by-steps\n', stderr: '' });
        } else if (cmd.includes('rev-parse HEAD')) {
          callback(null, { stdout: 'current-commit-hash\n', stderr: '' });
        } else if (cmd.includes('status --porcelain')) {
          callback(null, { stdout: '', stderr: '' });
        } else if (cmd.includes('reset --mixed')) {
          callback(null, { stdout: '', stderr: '' });
        }
      });

      const result = await rollbackManager.rollbackBySteps(3);

      expect(result.success).toBe(true);
      expect(result.previousCommit).toBe('current-commit-hash');
    });

    it('should fail if uncommitted changes exist and force is false', async () => {
      mockExec.mockImplementation((cmd: string, options: any, callback: any) => {
        if (cmd.includes('rev-parse HEAD~')) {
          callback(null, { stdout: 'target-commit-by-steps\n', stderr: '' });
        } else if (cmd.includes('rev-parse HEAD')) {
          callback(null, { stdout: 'current-commit-hash\n', stderr: '' });
        } else if (cmd.includes('status --porcelain')) {
          callback(null, { stdout: 'M file.ts\n', stderr: '' });
        }
      });

      await expect(rollbackManager.rollbackBySteps(2)).rejects.toThrow(RollbackError);
    });

    it('should throw error if commit by steps does not exist', async () => {
      mockExec.mockImplementation((cmd: string, options: any, callback: any) => {
        if (cmd.includes('rev-parse HEAD~')) {
          callback(new Error('Commit not found'), null);
        } else if (cmd.includes('rev-parse HEAD')) {
          callback(null, { stdout: 'current-commit-hash\n', stderr: '' });
        } else if (cmd.includes('status --porcelain')) {
          callback(null, { stdout: '', stderr: '' });
        }
      });

      await expect(rollbackManager.rollbackBySteps(100)).rejects.toThrow(RollbackError);
    });
  });

  describe('verifyRollbackPossible', () => {
    it('should return possible=true if rollback is possible', async () => {
      mockExec.mockImplementation((cmd: string, options: any, callback: any) => {
        if (cmd.includes('rev-parse target-commit-hash')) {
          callback(null, { stdout: 'target-commit-hash\n', stderr: '' });
        } else if (cmd.includes('status --porcelain')) {
          callback(null, { stdout: '', stderr: '' });
        }
      });

      const result = await rollbackManager.verifyRollbackPossible(mockBackup);

      expect(result.possible).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should return possible=false if commit not found', async () => {
      mockExec.mockImplementation((cmd: string, options: any, callback: any) => {
        if (cmd.includes('rev-parse target-commit-hash')) {
          callback(null, { stdout: '', stderr: '' });
        }
      });

      const result = await rollbackManager.verifyRollbackPossible(mockBackup);

      expect(result.possible).toBe(false);
      expect(result.reason).toContain('not found');
    });

    it('should return possible=false if uncommitted changes exist', async () => {
      mockExec.mockImplementation((cmd: string, options: any, callback: any) => {
        if (cmd.includes('rev-parse target-commit-hash')) {
          callback(null, { stdout: 'target-commit-hash\n', stderr: '' });
        } else if (cmd.includes('status --porcelain')) {
          callback(null, { stdout: 'M file.ts\n', stderr: '' });
        }
      });

      const result = await rollbackManager.verifyRollbackPossible(mockBackup);

      expect(result.possible).toBe(false);
      expect(result.reason).toContain('uncommitted changes');
    });

    it('should handle errors gracefully', async () => {
      mockExec.mockImplementation((cmd: string, options: any, callback: any) => {
        callback(new Error('Git error'), null);
      });

      const result = await rollbackManager.verifyRollbackPossible(mockBackup);

      expect(result.possible).toBe(false);
      expect(result.reason).toContain('Cannot verify rollback');
    });
  });
});
