import { SafeMerger } from './merger';
import { GitClient } from '../git/client';
import type { MergeResult, ConflictInfo } from '../git/types';
import { SyncOperationError } from '../utils/errors';

jest.mock('../git/client');
jest.mock('child_process');
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-sync-id-123'),
}));
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

describe('SafeMerger', () => {
  let merger: SafeMerger;
  let mockGitClient: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockGitClient = {
      checkConflicts: jest.fn(),
      merge: jest.fn(),
      createStash: jest.fn(),
      applyStash: jest.fn(),
    };

    (GitClient as any).mockImplementation(() => mockGitClient);

    merger = new SafeMerger('/test/repo');
  });

  describe('mergeWorktree', () => {
    it('should perform successful merge with backup', async () => {
      const mockConflictInfo: ConflictInfo = {
        has_conflicts: false,
        conflicted_files: [],
        details: [],
      };

      const mockMergeResult: MergeResult = {
        success: true,
        commit_hash: 'abc123',
      };

      mockGitClient.checkConflicts.mockResolvedValue(mockConflictInfo);
      mockGitClient.merge.mockResolvedValue(mockMergeResult);
      mockGitClient.createStash.mockResolvedValue('stash@{0}');

      mockExec.mockImplementation((cmd: string, options: any, callback: any) => {
        if (cmd.includes('rev-parse HEAD')) {
          callback(null, { stdout: 'current-commit-hash\n', stderr: '' });
        } else if (cmd.includes('status --porcelain')) {
          callback(null, { stdout: '', stderr: '' });
        } else {
          callback(null, { stdout: '', stderr: '' });
        }
      });

      const result = await merger.mergeWorktree('feature/test');

      expect(result.success).toBe(true);
      expect(result.syncOperation.status).toBe('success');
      expect(result.syncOperation.worktree_branch).toBe('feature/test');
      expect(result.backup).toBeDefined();
      expect(result.backup?.stashId).toBe('stash@{0}');
      expect(mockGitClient.createStash).toHaveBeenCalled();
      expect(mockGitClient.checkConflicts).toHaveBeenCalledWith('HEAD', 'feature/test');
      expect(mockGitClient.merge).toHaveBeenCalled();
    });

    it('should abort merge when conflicts detected and force is false', async () => {
      const mockConflictInfo: ConflictInfo = {
        has_conflicts: true,
        conflicted_files: ['file1.ts', 'file2.ts'],
        details: [
          {
            file: 'file1.ts',
            type: 'content',
            description: 'Content conflict',
          },
        ],
      };

      mockGitClient.checkConflicts.mockResolvedValue(mockConflictInfo);
      mockGitClient.createStash.mockResolvedValue('stash@{0}');

      mockExec.mockImplementation((cmd: string, options: any, callback: any) => {
        if (cmd.includes('rev-parse HEAD')) {
          callback(null, { stdout: 'current-commit-hash\n', stderr: '' });
        } else {
          callback(null, { stdout: '', stderr: '' });
        }
      });

      const result = await merger.mergeWorktree('feature/test');

      expect(result.success).toBe(false);
      expect(result.syncOperation.status).toBe('conflict');
      expect(result.syncOperation.conflict_info?.has_conflicts).toBe(true);
      expect(result.syncOperation.conflict_info?.conflicted_files).toEqual(['file1.ts', 'file2.ts']);
      expect(mockGitClient.merge).not.toHaveBeenCalled();
    });

    it('should handle dry run mode correctly', async () => {
      const mockConflictInfo: ConflictInfo = {
        has_conflicts: false,
        conflicted_files: [],
        details: [],
      };

      mockGitClient.checkConflicts.mockResolvedValue(mockConflictInfo);

      const result = await merger.mergeWorktree('feature/test', { dryRun: true });

      expect(result.success).toBe(true);
      expect(result.syncOperation.status).toBe('success');
      expect(result.backup).toBeUndefined();
      expect(mockGitClient.createStash).not.toHaveBeenCalled();
      expect(mockGitClient.merge).not.toHaveBeenCalled();
      expect(mockGitClient.checkConflicts).toHaveBeenCalledWith('HEAD', 'feature/test');
    });

    it('should detect conflicts in dry run mode', async () => {
      const mockConflictInfo: ConflictInfo = {
        has_conflicts: true,
        conflicted_files: ['file1.ts'],
        details: [
          {
            file: 'file1.ts',
            type: 'content',
            description: 'Content conflict',
          },
        ],
      };

      mockGitClient.checkConflicts.mockResolvedValue(mockConflictInfo);

      const result = await merger.mergeWorktree('feature/test', { dryRun: true });

      expect(result.success).toBe(false);
      expect(result.syncOperation.status).toBe('conflict');
      expect(result.syncOperation.conflict_info?.has_conflicts).toBe(true);
      expect(mockGitClient.merge).not.toHaveBeenCalled();
    });

    it('should handle merge failure', async () => {
      const mockConflictInfo: ConflictInfo = {
        has_conflicts: false,
        conflicted_files: [],
        details: [],
      };

      const mockMergeResult: MergeResult = {
        success: false,
        error: 'Merge conflict',
      };

      mockGitClient.checkConflicts.mockResolvedValue(mockConflictInfo);
      mockGitClient.merge.mockResolvedValue(mockMergeResult);
      mockGitClient.createStash.mockResolvedValue('stash@{0}');

      mockExec.mockImplementation((cmd: string, options: any, callback: any) => {
        if (cmd.includes('rev-parse HEAD')) {
          callback(null, { stdout: 'current-commit-hash\n', stderr: '' });
        } else {
          callback(null, { stdout: '', stderr: '' });
        }
      });

      const result = await merger.mergeWorktree('feature/test');

      expect(result.success).toBe(false);
      expect(result.syncOperation.status).toBe('failure');
      expect(result.syncOperation.error).toBe('Merge conflict');
      expect(result.backup).toBeDefined();
    });

    it('should fail validation if repository is not clean after merge', async () => {
      const mockConflictInfo: ConflictInfo = {
        has_conflicts: false,
        conflicted_files: [],
        details: [],
      };

      const mockMergeResult: MergeResult = {
        success: true,
        commit_hash: 'abc123',
      };

      mockGitClient.checkConflicts.mockResolvedValue(mockConflictInfo);
      mockGitClient.merge.mockResolvedValue(mockMergeResult);
      mockGitClient.createStash.mockResolvedValue('stash@{0}');

      mockExec.mockImplementation((cmd: string, options: any, callback: any) => {
        if (cmd.includes('rev-parse HEAD')) {
          callback(null, { stdout: 'current-commit-hash\n', stderr: '' });
        } else if (cmd.includes('status --porcelain')) {
          callback(null, { stdout: 'M file.ts\n', stderr: '' });
        } else {
          callback(null, { stdout: '', stderr: '' });
        }
      });

      const result = await merger.mergeWorktree('feature/test');

      expect(result.success).toBe(false);
      expect(result.syncOperation.status).toBe('failure');
      expect(result.syncOperation.error).toBe('Repository is not clean after merge');
    });

    it('should generate correct commit message', async () => {
      const mockConflictInfo: ConflictInfo = {
        has_conflicts: false,
        conflicted_files: [],
        details: [],
      };

      const mockMergeResult: MergeResult = {
        success: true,
        commit_hash: 'abc123',
      };

      mockGitClient.checkConflicts.mockResolvedValue(mockConflictInfo);
      mockGitClient.merge.mockResolvedValue(mockMergeResult);
      mockGitClient.createStash.mockResolvedValue('stash@{0}');

      mockExec.mockImplementation((cmd: string, options: any, callback: any) => {
        if (cmd.includes('rev-parse HEAD')) {
          callback(null, { stdout: 'current-commit-hash\n', stderr: '' });
        } else if (cmd.includes('status --porcelain')) {
          callback(null, { stdout: '', stderr: '' });
        } else {
          callback(null, { stdout: '', stderr: '' });
        }
      });

      await merger.mergeWorktree('feature/awesome-feature');

      expect(mockGitClient.merge).toHaveBeenCalledWith(
        'feature/awesome-feature',
        'chore: merge feature/awesome-feature - sync from feature/awesome-feature'
      );
    });

    it('should throw SyncOperationError on unexpected errors', async () => {
      mockGitClient.checkConflicts.mockRejectedValue(new Error('Git error'));

      mockExec.mockImplementation((cmd: string, options: any, callback: any) => {
        if (cmd.includes('rev-parse HEAD')) {
          callback(null, { stdout: 'current-commit-hash\n', stderr: '' });
        } else {
          callback(null, { stdout: '', stderr: '' });
        }
      });

      await expect(merger.mergeWorktree('feature/test')).rejects.toThrow(SyncOperationError);
    });

    it('should handle backup creation failure', async () => {
      mockGitClient.createStash.mockRejectedValue(new Error('Stash failed'));

      mockExec.mockImplementation((cmd: string, options: any, callback: any) => {
        if (cmd.includes('rev-parse HEAD')) {
          callback(null, { stdout: 'current-commit-hash\n', stderr: '' });
        } else {
          callback(null, { stdout: '', stderr: '' });
        }
      });

      await expect(merger.mergeWorktree('feature/test')).rejects.toThrow(SyncOperationError);
      await expect(merger.mergeWorktree('feature/test')).rejects.toThrow(/Failed to create backup/);
    });

    it('should include backup info in successful merge', async () => {
      const mockConflictInfo: ConflictInfo = {
        has_conflicts: false,
        conflicted_files: [],
        details: [],
      };

      const mockMergeResult: MergeResult = {
        success: true,
        commit_hash: 'abc123',
      };

      mockGitClient.checkConflicts.mockResolvedValue(mockConflictInfo);
      mockGitClient.merge.mockResolvedValue(mockMergeResult);
      mockGitClient.createStash.mockResolvedValue('stash@{0}');

      mockExec.mockImplementation((cmd: string, options: any, callback: any) => {
        if (cmd.includes('rev-parse HEAD')) {
          callback(null, { stdout: 'backup-commit-hash\n', stderr: '' });
        } else if (cmd.includes('status --porcelain')) {
          callback(null, { stdout: '', stderr: '' });
        } else {
          callback(null, { stdout: '', stderr: '' });
        }
      });

      const result = await merger.mergeWorktree('feature/test');

      expect(result.backup).toBeDefined();
      expect(result.backup?.branch).toBe('feature/test');
      expect(result.backup?.commitHash).toBe('backup-commit-hash');
      expect(result.backup?.stashId).toBe('stash@{0}');
      expect(result.syncOperation.rollback_point).toBe('stash@{0}');
    });
  });
});
