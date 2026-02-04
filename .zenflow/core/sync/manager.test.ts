import { SyncManager } from './manager';
import { GitClient } from '../git/client';
import { SyncAnalyzer } from './analyzer';
import { ConflictDetector } from './conflicts';
import { SafeMerger } from './merger';
import { SyncValidator } from './validator';
import { RollbackManager } from './rollback';
import type { SyncConfig, SyncOperation } from './types';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

jest.mock('../utils/logger', () => ({
  getLogger: jest.fn(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-sync-id-123'),
}));

jest.mock('../git/client');
jest.mock('./analyzer');
jest.mock('./conflicts');
jest.mock('./merger');
jest.mock('./validator');
jest.mock('./rollback');

describe('SyncManager', () => {
  let syncManager: SyncManager;
  let mockConfig: SyncConfig;
  let tempDir: string;
  let statePath: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zenflow-sync-test-'));
    statePath = path.join(tempDir, '.zenflow', 'state', 'sync');
    
    mockConfig = {
      enabled: true,
      autoPush: false,
      maxRetries: 3,
      timeout: 300,
      conflictStrategy: 'abort',
      excludedWorktrees: ['staging', 'production'],
      notificationChannels: ['console', 'log'],
      verificationCommands: [],
    };

    syncManager = new SyncManager(tempDir, mockConfig);

    jest.clearAllMocks();
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('syncWorktree', () => {
    it('should successfully sync a worktree with no conflicts', async () => {
      const branch = 'feature-123';

      const mockWorktree = {
        path: '/path/to/worktree',
        branch,
        commit: 'abc123',
        locked: false,
        prunable: false,
      };

      const mockDiffSummary = {
        files_changed: 3,
        insertions: 50,
        deletions: 20,
        files: [
          { path: 'file1.ts', status: 'M' as const, insertions: 30, deletions: 10, binary: false },
          { path: 'file2.ts', status: 'A' as const, insertions: 20, deletions: 0, binary: false },
          { path: 'file3.ts', status: 'D' as const, insertions: 0, deletions: 10, binary: false },
        ],
      };

      const mockConflictInfo = {
        has_conflicts: false,
        conflicted_files: [],
        details: [],
      };

      const mockValidationResult = {
        valid: true,
        checks: [],
        errors: [],
        warnings: [],
      };

      const mockMergeResult = {
        success: true,
        syncOperation: {
          id: 'sync-1',
          worktree_branch: branch,
          commit_hash: 'abc123',
          status: 'success' as const,
          started_at: new Date(),
          completed_at: new Date(),
        },
      };

      (SyncValidator.prototype.validateSync as jest.Mock).mockResolvedValue(mockValidationResult);
      (SyncAnalyzer.prototype.analyzeDiff as jest.Mock).mockResolvedValue(mockDiffSummary);
      (ConflictDetector.prototype.detectConflicts as jest.Mock).mockResolvedValue({
        conflictInfo: mockConflictInfo,
        riskLevel: 'none',
        recommendations: [],
        canAutoResolve: true,
      });
      (SafeMerger.prototype.mergeWorktree as jest.Mock).mockResolvedValue(mockMergeResult);

      const result = await syncManager.syncWorktree(branch);

      expect(result.status).toBe('success');
      expect(result.worktree_branch).toBe(branch);
      expect(result.diff_summary).toEqual(mockDiffSummary);
      expect(result.conflict_info).toEqual(mockConflictInfo);
      
      expect(SyncValidator.prototype.validateSync).toHaveBeenCalledWith(branch);
      expect(SyncAnalyzer.prototype.analyzeDiff).toHaveBeenCalledWith(branch, 'main');
      expect(ConflictDetector.prototype.detectConflicts).toHaveBeenCalledWith('main', branch);
      expect(SafeMerger.prototype.mergeWorktree).toHaveBeenCalled();
    });

    it('should abort sync when conflicts are detected', async () => {
      const branch = 'feature-conflicts';

      const mockDiffSummary = {
        files_changed: 2,
        insertions: 30,
        deletions: 10,
        files: [
          { path: 'file1.ts', status: 'M' as const, insertions: 30, deletions: 10, binary: false },
        ],
      };

      const mockConflictInfo = {
        has_conflicts: true,
        conflicted_files: ['file1.ts'],
        details: [
          {
            file: 'file1.ts',
            type: 'content' as const,
            description: 'Content conflict in file1.ts',
          },
        ],
      };

      const mockValidationResult = {
        valid: true,
        checks: [],
        errors: [],
        warnings: [],
      };

      (SyncValidator.prototype.validateSync as jest.Mock).mockResolvedValue(mockValidationResult);
      (SyncAnalyzer.prototype.analyzeDiff as jest.Mock).mockResolvedValue(mockDiffSummary);
      (ConflictDetector.prototype.detectConflicts as jest.Mock).mockResolvedValue({
        conflictInfo: mockConflictInfo,
        riskLevel: 'medium',
        recommendations: ['Manual review required'],
        canAutoResolve: false,
      });

      const result = await syncManager.syncWorktree(branch);

      expect(result.status).toBe('conflict');
      expect(result.conflict_info?.has_conflicts).toBe(true);
      expect(result.conflict_info?.conflicted_files).toContain('file1.ts');
      
      expect(SafeMerger.prototype.mergeWorktree).not.toHaveBeenCalled();
    });

    it('should skip sync when no changes detected', async () => {
      const branch = 'feature-no-changes';

      const mockDiffSummary = {
        files_changed: 0,
        insertions: 0,
        deletions: 0,
        files: [],
      };

      const mockValidationResult = {
        valid: true,
        checks: [],
        errors: [],
        warnings: [],
      };

      (SyncValidator.prototype.validateSync as jest.Mock).mockResolvedValue(mockValidationResult);
      (SyncAnalyzer.prototype.analyzeDiff as jest.Mock).mockResolvedValue(mockDiffSummary);

      const result = await syncManager.syncWorktree(branch);

      expect(result.status).toBe('success');
      expect(result.diff_summary?.files_changed).toBe(0);
      
      expect(ConflictDetector.prototype.detectConflicts).not.toHaveBeenCalled();
      expect(SafeMerger.prototype.mergeWorktree).not.toHaveBeenCalled();
    });

    it('should fail when validation fails', async () => {
      const branch = 'feature-invalid';

      const mockValidationResult = {
        valid: false,
        checks: [],
        errors: ['Insufficient disk space'],
        warnings: [],
      };

      (SyncValidator.prototype.validateSync as jest.Mock).mockResolvedValue(mockValidationResult);

      await expect(syncManager.syncWorktree(branch)).rejects.toThrow('Insufficient disk space');
      
      expect(SyncAnalyzer.prototype.analyzeDiff).not.toHaveBeenCalled();
    });

    it('should skip excluded worktrees', async () => {
      const branch = 'staging';

      await expect(syncManager.syncWorktree(branch)).rejects.toThrow('excluded');
      
      expect(SyncValidator.prototype.validateSync).not.toHaveBeenCalled();
    });

    it('should handle dry-run mode', async () => {
      const branch = 'feature-dryrun';

      const mockDiffSummary = {
        files_changed: 2,
        insertions: 20,
        deletions: 5,
        files: [
          { path: 'file1.ts', status: 'M' as const, insertions: 20, deletions: 5, binary: false },
        ],
      };

      const mockConflictInfo = {
        has_conflicts: false,
        conflicted_files: [],
        details: [],
      };

      const mockValidationResult = {
        valid: true,
        checks: [],
        errors: [],
        warnings: [],
      };

      (SyncValidator.prototype.validateSync as jest.Mock).mockResolvedValue(mockValidationResult);
      (SyncAnalyzer.prototype.analyzeDiff as jest.Mock).mockResolvedValue(mockDiffSummary);
      (ConflictDetector.prototype.detectConflicts as jest.Mock).mockResolvedValue({
        conflictInfo: mockConflictInfo,
        riskLevel: 'none',
        recommendations: [],
        canAutoResolve: true,
      });

      const result = await syncManager.syncWorktree(branch, { dryRun: true });

      expect(result.status).toBe('success');
      expect(result.diff_summary?.files_changed).toBe(2);
      
      expect(SafeMerger.prototype.mergeWorktree).not.toHaveBeenCalled();
    });

    it('should push changes when autoPush is enabled', async () => {
      const branch = 'feature-autopush';

      const mockDiffSummary = {
        files_changed: 1,
        insertions: 10,
        deletions: 0,
        files: [
          { path: 'file1.ts', status: 'M' as const, insertions: 10, deletions: 0, binary: false },
        ],
      };

      const mockConflictInfo = {
        has_conflicts: false,
        conflicted_files: [],
        details: [],
      };

      const mockValidationResult = {
        valid: true,
        checks: [],
        errors: [],
        warnings: [],
      };

      const mockMergeResult = {
        success: true,
        syncOperation: {
          id: 'sync-2',
          worktree_branch: branch,
          commit_hash: 'def456',
          status: 'success' as const,
          started_at: new Date(),
          completed_at: new Date(),
        },
      };

      (SyncValidator.prototype.validateSync as jest.Mock).mockResolvedValue(mockValidationResult);
      (SyncAnalyzer.prototype.analyzeDiff as jest.Mock).mockResolvedValue(mockDiffSummary);
      (ConflictDetector.prototype.detectConflicts as jest.Mock).mockResolvedValue({
        conflictInfo: mockConflictInfo,
        riskLevel: 'none',
        recommendations: [],
        canAutoResolve: true,
      });
      (SafeMerger.prototype.mergeWorktree as jest.Mock).mockResolvedValue(mockMergeResult);
      (GitClient.prototype.push as jest.Mock).mockResolvedValue(undefined);

      const result = await syncManager.syncWorktree(branch, { autoPush: true });

      expect(result.status).toBe('success');
      expect(GitClient.prototype.push).toHaveBeenCalledWith('origin', 'main');
    });
  });

  describe('syncAllWorktrees', () => {
    it('should sync all non-excluded worktrees', async () => {
      const mockWorktrees = [
        { path: '/path/main', branch: 'main', commit: 'abc', locked: false, prunable: false },
        { path: '/path/feat1', branch: 'feature-1', commit: 'def', locked: false, prunable: false },
        { path: '/path/feat2', branch: 'feature-2', commit: 'ghi', locked: false, prunable: false },
        { path: '/path/staging', branch: 'staging', commit: 'jkl', locked: false, prunable: false },
      ];

      (SyncAnalyzer.prototype.listAllWorktrees as jest.Mock).mockResolvedValue(mockWorktrees);

      const syncWorktreeSpy = jest.spyOn(syncManager, 'syncWorktree').mockImplementation(
        async (branch: string) => ({
          id: `sync-${branch}`,
          worktree_branch: branch,
          commit_hash: 'abc123',
          status: 'success',
          started_at: new Date(),
          completed_at: new Date(),
        })
      );

      const results = await syncManager.syncAllWorktrees();

      expect(results).toHaveLength(2);
      expect(syncWorktreeSpy).toHaveBeenCalledTimes(2);
      expect(syncWorktreeSpy).toHaveBeenCalledWith('feature-1', {});
      expect(syncWorktreeSpy).toHaveBeenCalledWith('feature-2', {});
      expect(syncWorktreeSpy).not.toHaveBeenCalledWith('main', {});
      expect(syncWorktreeSpy).not.toHaveBeenCalledWith('staging', {});
    });

    it('should handle individual sync failures in batch mode', async () => {
      const mockWorktrees = [
        { path: '/path/feat1', branch: 'feature-1', commit: 'def', locked: false, prunable: false },
        { path: '/path/feat2', branch: 'feature-2', commit: 'ghi', locked: false, prunable: false },
      ];

      (SyncAnalyzer.prototype.listAllWorktrees as jest.Mock).mockResolvedValue(mockWorktrees);

      const syncWorktreeSpy = jest.spyOn(syncManager, 'syncWorktree').mockImplementation(
        async (branch: string) => {
          if (branch === 'feature-1') {
            throw new Error('Sync failed for feature-1');
          }
          return {
            id: `sync-${branch}`,
            worktree_branch: branch,
            commit_hash: 'ghi123',
            status: 'success',
            started_at: new Date(),
            completed_at: new Date(),
          };
        }
      );

      const results = await syncManager.syncAllWorktrees();

      expect(results).toHaveLength(2);
      expect(results[0].status).toBe('failure');
      expect(results[0].worktree_branch).toBe('feature-1');
      expect(results[1].status).toBe('success');
      expect(results[1].worktree_branch).toBe('feature-2');
    });

    it('should return empty array when no syncable worktrees', async () => {
      const mockWorktrees = [
        { path: '/path/main', branch: 'main', commit: 'abc', locked: false, prunable: false },
      ];

      (SyncAnalyzer.prototype.listAllWorktrees as jest.Mock).mockResolvedValue(mockWorktrees);

      const results = await syncManager.syncAllWorktrees();

      expect(results).toHaveLength(0);
    });
  });

  describe('analyzeDiff', () => {
    it('should return diff summary for a branch', async () => {
      const branch = 'feature-diff';
      const mockDiffSummary = {
        files_changed: 3,
        insertions: 50,
        deletions: 20,
        files: [
          { path: 'file1.ts', status: 'M' as const, insertions: 30, deletions: 10, binary: false },
          { path: 'file2.ts', status: 'A' as const, insertions: 20, deletions: 0, binary: false },
          { path: 'file3.ts', status: 'D' as const, insertions: 0, deletions: 10, binary: false },
        ],
      };

      (SyncAnalyzer.prototype.analyzeDiff as jest.Mock).mockResolvedValue(mockDiffSummary);

      const result = await syncManager.analyzeDiff(branch);

      expect(result).toEqual(mockDiffSummary);
      expect(SyncAnalyzer.prototype.analyzeDiff).toHaveBeenCalledWith(branch, 'main');
    });
  });

  describe('checkConflicts', () => {
    it('should return conflict info for a branch', async () => {
      const branch = 'feature-conflicts';
      const mockConflictInfo = {
        has_conflicts: true,
        conflicted_files: ['file1.ts'],
        details: [
          {
            file: 'file1.ts',
            type: 'content' as const,
            description: 'Content conflict',
          },
        ],
      };

      (ConflictDetector.prototype.detectConflicts as jest.Mock).mockResolvedValue({
        conflictInfo: mockConflictInfo,
        riskLevel: 'medium',
        recommendations: [],
        canAutoResolve: false,
      });

      const result = await syncManager.checkConflicts(branch);

      expect(result).toEqual(mockConflictInfo);
      expect(ConflictDetector.prototype.detectConflicts).toHaveBeenCalledWith('main', branch);
    });
  });

  describe('validateSync', () => {
    it('should return validation result for a branch', async () => {
      const branch = 'feature-validate';
      const mockValidationResult = {
        valid: true,
        checks: [
          { name: 'disk_space', passed: true, message: 'Sufficient disk space' },
        ],
        errors: [],
        warnings: [],
      };

      (SyncValidator.prototype.validateSync as jest.Mock).mockResolvedValue(mockValidationResult);

      const result = await syncManager.validateSync(branch);

      expect(result).toEqual(mockValidationResult);
      expect(SyncValidator.prototype.validateSync).toHaveBeenCalledWith(branch);
    });
  });

  describe('rollbackSync', () => {
    it('should rollback a sync operation', async () => {
      const syncId = 'sync-rollback-test';
      const mockSyncOperation: SyncOperation = {
        id: syncId,
        worktree_branch: 'feature-rollback',
        commit_hash: 'abc123',
        status: 'success',
        started_at: new Date(),
        completed_at: new Date(),
        rollback_point: 'stash@{0}',
      };

      await fs.mkdir(statePath, { recursive: true });
      await fs.writeFile(
        path.join(statePath, `${syncId}.json`),
        JSON.stringify(mockSyncOperation),
        'utf-8'
      );

      (RollbackManager.prototype.rollback as jest.Mock).mockResolvedValue({
        success: true,
        previousCommit: 'abc123',
      });

      await syncManager.rollbackSync(syncId);

      expect(RollbackManager.prototype.rollback).toHaveBeenCalledWith(
        expect.objectContaining({
          stashId: 'stash@{0}',
          commitHash: 'abc123',
          branch: 'feature-rollback',
        })
      );
    });

    it('should throw error when sync operation not found', async () => {
      const syncId = 'non-existent-sync';

      await expect(syncManager.rollbackSync(syncId)).rejects.toThrow('not found');
    });

    it('should throw error when no rollback point', async () => {
      const syncId = 'sync-no-rollback';
      const mockSyncOperation: SyncOperation = {
        id: syncId,
        worktree_branch: 'feature-no-rollback',
        commit_hash: 'abc123',
        status: 'success',
        started_at: new Date(),
        completed_at: new Date(),
      };

      await fs.mkdir(statePath, { recursive: true });
      await fs.writeFile(
        path.join(statePath, `${syncId}.json`),
        JSON.stringify(mockSyncOperation),
        'utf-8'
      );

      await expect(syncManager.rollbackSync(syncId)).rejects.toThrow('no rollback point');
    });
  });

  describe('getSyncHistory', () => {
    it('should return all sync operations', async () => {
      const operations: SyncOperation[] = [
        {
          id: 'sync-1',
          worktree_branch: 'feature-1',
          commit_hash: 'abc123',
          status: 'success',
          started_at: new Date('2024-01-01'),
          completed_at: new Date('2024-01-01'),
        },
        {
          id: 'sync-2',
          worktree_branch: 'feature-2',
          commit_hash: 'def456',
          status: 'failure',
          started_at: new Date('2024-01-02'),
          completed_at: new Date('2024-01-02'),
        },
      ];

      await fs.mkdir(statePath, { recursive: true });
      for (const op of operations) {
        await fs.writeFile(
          path.join(statePath, `${op.id}.json`),
          JSON.stringify(op),
          'utf-8'
        );
      }

      const result = await syncManager.getSyncHistory();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('sync-2');
      expect(result[1].id).toBe('sync-1');
    });

    it('should filter by status', async () => {
      const operations: SyncOperation[] = [
        {
          id: 'sync-1',
          worktree_branch: 'feature-1',
          commit_hash: 'abc123',
          status: 'success',
          started_at: new Date('2024-01-01'),
        },
        {
          id: 'sync-2',
          worktree_branch: 'feature-2',
          commit_hash: 'def456',
          status: 'failure',
          started_at: new Date('2024-01-02'),
        },
      ];

      await fs.mkdir(statePath, { recursive: true });
      for (const op of operations) {
        await fs.writeFile(
          path.join(statePath, `${op.id}.json`),
          JSON.stringify(op),
          'utf-8'
        );
      }

      const result = await syncManager.getSyncHistory({ status: 'success' });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('sync-1');
    });

    it('should limit results', async () => {
      const operations: SyncOperation[] = [
        {
          id: 'sync-1',
          worktree_branch: 'feature-1',
          commit_hash: 'abc123',
          status: 'success',
          started_at: new Date('2024-01-01'),
        },
        {
          id: 'sync-2',
          worktree_branch: 'feature-2',
          commit_hash: 'def456',
          status: 'success',
          started_at: new Date('2024-01-02'),
        },
        {
          id: 'sync-3',
          worktree_branch: 'feature-3',
          commit_hash: 'ghi789',
          status: 'success',
          started_at: new Date('2024-01-03'),
        },
      ];

      await fs.mkdir(statePath, { recursive: true });
      for (const op of operations) {
        await fs.writeFile(
          path.join(statePath, `${op.id}.json`),
          JSON.stringify(op),
          'utf-8'
        );
      }

      const result = await syncManager.getSyncHistory({ limit: 2 });

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('sync-3');
      expect(result[1].id).toBe('sync-2');
    });
  });
});
