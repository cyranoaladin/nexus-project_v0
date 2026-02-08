import { jest } from '@jest/globals';
import type { SyncOperation } from '../../core/sync/types';

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-123'),
}));

jest.mock('../../core/utils/logger', () => ({
  getLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  })),
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  })),
}));

jest.mock('../../core/sync/manager');
jest.mock('../../core/config/loader');
jest.mock('commander', () => {
  const actualCommander = jest.requireActual('commander');
  return actualCommander;
});

const mockLoadConfig = jest.fn();
const mockSyncAllWorktrees = jest.fn();
const mockSyncWorktree = jest.fn();
const mockGetSyncHistory = jest.fn<() => Promise<any[]>>();
const mockRollbackSync = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  
  (require('../../core/config/loader') as any).loadConfig = mockLoadConfig;
  
  mockLoadConfig.mockReturnValue({
    sync: {
      enabled: true,
      auto_push: false,
      max_retries: 3,
      timeout: 300,
      conflict_strategy: 'abort',
      excluded_worktrees: [],
      notification_channels: ['console', 'log'],
      verification_commands: [],
    },
  });

  (require('../../core/sync/manager') as any).SyncManager = jest.fn().mockImplementation(() => ({
    syncAllWorktrees: mockSyncAllWorktrees,
    syncWorktree: mockSyncWorktree,
    getSyncHistory: mockGetSyncHistory,
    rollbackSync: mockRollbackSync,
  }));
});

describe('Sync CLI Commands', () => {
  const createMockSyncOperation = (overrides: Partial<SyncOperation> = {}): SyncOperation => ({
    id: 'test-sync-id-123',
    worktree_branch: 'feature/test',
    commit_hash: 'abc123',
    status: 'success',
    started_at: new Date('2024-01-01T10:00:00Z'),
    completed_at: new Date('2024-01-01T10:01:00Z'),
    diff_summary: {
      files_changed: 5,
      insertions: 100,
      deletions: 50,
      files: [],
    },
    ...overrides,
  });

  describe('zenflow sync auto', () => {
    it('should sync all worktrees successfully', async () => {
      const mockResults = [
        createMockSyncOperation({ worktree_branch: 'feature/a' }),
        createMockSyncOperation({ worktree_branch: 'feature/b' }),
      ];
      
      // @ts-expect-error - Mock function typed as jest.fn() without explicit types
      mockSyncAllWorktrees.mockResolvedValue(mockResults);

      const { createSyncCommand } = await import('./sync');
      const command = createSyncCommand({});

      await command.parseAsync(['node', 'test', 'auto']);

      expect(mockSyncAllWorktrees).toHaveBeenCalledWith({
        dryRun: false,
      });
    });

    it('should handle dry-run mode', async () => {
      const mockResults = [createMockSyncOperation()];
      // @ts-expect-error - Mock function typed as jest.fn() without explicit types
      mockSyncAllWorktrees.mockResolvedValue(mockResults);

      const { createSyncCommand } = await import('./sync');
      const command = createSyncCommand({});

      await command.parseAsync(['node', 'test', 'auto', '--dry-run']);

      expect(mockSyncAllWorktrees).toHaveBeenCalledWith({
        dryRun: true,
      });
    });

    it('should handle no worktrees found', async () => {
      // @ts-expect-error - Mock function typed as jest.fn() without explicit types
      mockSyncAllWorktrees.mockResolvedValue([]);

      const { createSyncCommand } = await import('./sync');
      const command = createSyncCommand({});

      await command.parseAsync(['node', 'test', 'auto']);

      expect(mockSyncAllWorktrees).toHaveBeenCalled();
    });

    it('should exit with error when syncs fail', async () => {
      const mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined) => {
        throw new Error(`Process exited with code ${code}`);
      });

      const mockResults = [
        createMockSyncOperation({ status: 'failure', error: 'Test error' }),
      ];
      
      // @ts-expect-error - Mock function typed as jest.fn() without explicit types
      mockSyncAllWorktrees.mockResolvedValue(mockResults);

      const { createSyncCommand } = await import('./sync');
      const command = createSyncCommand({});

      await expect(command.parseAsync(['node', 'test', 'auto'])).rejects.toThrow('Process exited with code 1');

      mockExit.mockRestore();
    });

    it('should display conflict warnings', async () => {
      const mockResults = [
        createMockSyncOperation({
          status: 'conflict',
          conflict_info: {
            has_conflicts: true,
            conflicted_files: ['file1.txt', 'file2.txt'],
            details: [],
          },
        }),
      ];
      
      // @ts-expect-error - Mock function typed as jest.fn() without explicit types
      mockSyncAllWorktrees.mockResolvedValue(mockResults);

      const { createSyncCommand } = await import('./sync');
      const command = createSyncCommand({});

      await command.parseAsync(['node', 'test', 'auto']);

      expect(mockSyncAllWorktrees).toHaveBeenCalled();
    });
  });

  describe('zenflow sync worktree', () => {
    it('should sync a specific worktree', async () => {
      const mockResult = createMockSyncOperation();
      // @ts-expect-error - Mock function typed as jest.fn() without explicit types
      mockSyncWorktree.mockResolvedValue(mockResult);

      const { createSyncCommand } = await import('./sync');
      const command = createSyncCommand({});

      await command.parseAsync(['node', 'test', 'worktree', 'feature/test']);

      expect(mockSyncWorktree).toHaveBeenCalledWith('feature/test', {
        force: false,
        dryRun: false,
      });
    });

    it('should handle --force option', async () => {
      const mockResult = createMockSyncOperation();
      // @ts-expect-error - Mock function typed as jest.fn() without explicit types
      mockSyncWorktree.mockResolvedValue(mockResult);

      const { createSyncCommand } = await import('./sync');
      const command = createSyncCommand({});

      await command.parseAsync(['node', 'test', 'worktree', 'feature/test', '--force']);

      expect(mockSyncWorktree).toHaveBeenCalledWith('feature/test', {
        force: true,
        dryRun: false,
      });
    });

    it('should handle --dry-run option', async () => {
      const mockResult = createMockSyncOperation({ status: 'success' });
      // @ts-expect-error - Mock function typed as jest.fn() without explicit types
      mockSyncWorktree.mockResolvedValue(mockResult);

      const { createSyncCommand } = await import('./sync');
      const command = createSyncCommand({});

      await command.parseAsync(['node', 'test', 'worktree', 'feature/test', '--dry-run']);

      expect(mockSyncWorktree).toHaveBeenCalledWith('feature/test', {
        force: false,
        dryRun: true,
      });
    });

    it('should exit with error on conflict without force', async () => {
      const mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined) => {
        throw new Error(`Process exited with code ${code}`);
      });

      const mockResult = createMockSyncOperation({
        status: 'conflict',
        conflict_info: {
          has_conflicts: true,
          conflicted_files: ['file1.txt'],
          details: [],
        },
      });
      // @ts-expect-error - Mock function typed as jest.fn() without explicit types
      mockSyncWorktree.mockResolvedValue(mockResult);

      const { createSyncCommand } = await import('./sync');
      const command = createSyncCommand({});

      await expect(
        command.parseAsync(['node', 'test', 'worktree', 'feature/test'])
      ).rejects.toThrow('Process exited with code 1');

      mockExit.mockRestore();
    });

    it('should exit with error on failure', async () => {
      const mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined) => {
        throw new Error(`Process exited with code ${code}`);
      });

      const mockResult = createMockSyncOperation({
        status: 'failure',
        error: 'Sync failed',
      });
      // @ts-expect-error - Mock function typed as jest.fn() without explicit types
      mockSyncWorktree.mockResolvedValue(mockResult);

      const { createSyncCommand } = await import('./sync');
      const command = createSyncCommand({});

      await expect(
        command.parseAsync(['node', 'test', 'worktree', 'feature/test'])
      ).rejects.toThrow('Process exited with code 1');

      mockExit.mockRestore();
    });
  });

  describe('zenflow sync list', () => {
    it('should list sync history with default options', async () => {
      const mockHistory = [
        createMockSyncOperation(),
        createMockSyncOperation({ worktree_branch: 'feature/other' }),
      ];
      mockGetSyncHistory.mockResolvedValue(mockHistory);

      const { createSyncCommand } = await import('./sync');
      const command = createSyncCommand({});

      await command.parseAsync(['node', 'test', 'list']);

      expect(mockGetSyncHistory).toHaveBeenCalledWith({
        limit: 20,
      });
    });

    it('should filter by status', async () => {
      const mockHistory = [createMockSyncOperation({ status: 'success' })];
      mockGetSyncHistory.mockResolvedValue(mockHistory);

      const { createSyncCommand } = await import('./sync');
      const command = createSyncCommand({});

      await command.parseAsync(['node', 'test', 'list', '--status', 'success']);

      expect(mockGetSyncHistory).toHaveBeenCalledWith({
        limit: 20,
        status: 'success',
      });
    });

    it('should filter by date', async () => {
      const mockHistory = [createMockSyncOperation()];
      mockGetSyncHistory.mockResolvedValue(mockHistory);

      const { createSyncCommand } = await import('./sync');
      const command = createSyncCommand({});

      await command.parseAsync(['node', 'test', 'list', '--since', '2024-01-01']);

      expect(mockGetSyncHistory).toHaveBeenCalledWith({
        limit: 20,
        since: new Date('2024-01-01'),
      });
    });

    it('should limit results', async () => {
      const mockHistory = [createMockSyncOperation()];
      mockGetSyncHistory.mockResolvedValue(mockHistory);

      const { createSyncCommand } = await import('./sync');
      const command = createSyncCommand({});

      await command.parseAsync(['node', 'test', 'list', '--limit', '50']);

      expect(mockGetSyncHistory).toHaveBeenCalledWith({
        limit: 50,
      });
    });

    it('should handle empty history', async () => {
      mockGetSyncHistory.mockResolvedValue([]);

      const { createSyncCommand } = await import('./sync');
      const command = createSyncCommand({});

      await command.parseAsync(['node', 'test', 'list']);

      expect(mockGetSyncHistory).toHaveBeenCalled();
    });

    it('should handle invalid date format', async () => {
      const mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined) => {
        throw new Error(`Process exited with code ${code}`);
      });

      const { createSyncCommand } = await import('./sync');
      const command = createSyncCommand({});

      await expect(
        command.parseAsync(['node', 'test', 'list', '--since', 'invalid-date'])
      ).rejects.toThrow();

      mockExit.mockRestore();
    });

    it('should handle invalid status', async () => {
      const mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined) => {
        throw new Error(`Process exited with code ${code}`);
      });

      const { createSyncCommand } = await import('./sync');
      const command = createSyncCommand({});

      await expect(
        command.parseAsync(['node', 'test', 'list', '--status', 'invalid-status'])
      ).rejects.toThrow();

      mockExit.mockRestore();
    });
  });

  describe('zenflow sync show', () => {
    it('should show sync details', async () => {
      const mockOperation = createMockSyncOperation();
      mockGetSyncHistory.mockResolvedValue([mockOperation]);

      const { createSyncCommand } = await import('./sync');
      const command = createSyncCommand({});

      await command.parseAsync(['node', 'test', 'show', 'test-sync']);

      expect(mockGetSyncHistory).toHaveBeenCalledWith({ limit: 1000 });
    });

    it('should handle partial sync ID match', async () => {
      const mockOperation = createMockSyncOperation({ id: 'test-sync-id-123' });
      mockGetSyncHistory.mockResolvedValue([mockOperation]);

      const { createSyncCommand } = await import('./sync');
      const command = createSyncCommand({});

      await command.parseAsync(['node', 'test', 'show', 'test-sync']);

      expect(mockGetSyncHistory).toHaveBeenCalled();
    });

    it('should handle sync not found', async () => {
      const mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined) => {
        throw new Error(`Process exited with code ${code}`);
      });

      mockGetSyncHistory.mockResolvedValue([]);

      const { createSyncCommand } = await import('./sync');
      const command = createSyncCommand({});

      await expect(
        command.parseAsync(['node', 'test', 'show', 'nonexistent-id'])
      ).rejects.toThrow();

      mockExit.mockRestore();
    });

    it('should display conflict information', async () => {
      const mockOperation = createMockSyncOperation({
        conflict_info: {
          has_conflicts: true,
          conflicted_files: ['file1.txt', 'file2.txt'],
          details: [],
        },
      });
      mockGetSyncHistory.mockResolvedValue([mockOperation]);

      const { createSyncCommand } = await import('./sync');
      const command = createSyncCommand({});

      await command.parseAsync(['node', 'test', 'show', 'test-sync']);

      expect(mockGetSyncHistory).toHaveBeenCalled();
    });

    it('should display error information', async () => {
      const mockOperation = createMockSyncOperation({
        status: 'failure',
        error: 'Test error message',
      });
      mockGetSyncHistory.mockResolvedValue([mockOperation]);

      const { createSyncCommand } = await import('./sync');
      const command = createSyncCommand({});

      await command.parseAsync(['node', 'test', 'show', 'test-sync']);

      expect(mockGetSyncHistory).toHaveBeenCalled();
    });
  });

  describe('zenflow sync rollback', () => {
    it('should rollback a sync operation', async () => {
      const mockOperation = createMockSyncOperation({
        rollback_point: 'stash-123',
      });
      mockGetSyncHistory.mockResolvedValue([mockOperation]);
      mockRollbackSync.mockResolvedValue(undefined);

      const { createSyncCommand } = await import('./sync');
      const command = createSyncCommand({});

      await command.parseAsync(['node', 'test', 'rollback', 'test-sync']);

      expect(mockRollbackSync).toHaveBeenCalledWith('test-sync-id-123');
    });

    it('should handle already rolled back operation', async () => {
      const mockOperation = createMockSyncOperation({
        status: 'rolled_back',
        rollback_point: 'stash-123',
      });
      mockGetSyncHistory.mockResolvedValue([mockOperation]);

      const { createSyncCommand } = await import('./sync');
      const command = createSyncCommand({});

      await command.parseAsync(['node', 'test', 'rollback', 'test-sync']);

      expect(mockRollbackSync).not.toHaveBeenCalled();
    });

    it('should handle sync without rollback point', async () => {
      const mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined) => {
        throw new Error(`Process exited with code ${code}`);
      });

      const mockOperation = createMockSyncOperation({
        rollback_point: undefined,
      });
      mockGetSyncHistory.mockResolvedValue([mockOperation]);

      const { createSyncCommand } = await import('./sync');
      const command = createSyncCommand({});

      await expect(
        command.parseAsync(['node', 'test', 'rollback', 'test-sync'])
      ).rejects.toThrow('Process exited with code 1');

      mockExit.mockRestore();
    });

    it('should handle sync not found', async () => {
      const mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined) => {
        throw new Error(`Process exited with code ${code}`);
      });

      mockGetSyncHistory.mockResolvedValue([]);

      const { createSyncCommand } = await import('./sync');
      const command = createSyncCommand({});

      await expect(
        command.parseAsync(['node', 'test', 'rollback', 'nonexistent-id'])
      ).rejects.toThrow();

      mockExit.mockRestore();
    });

    it('should handle partial sync ID match', async () => {
      const mockOperation = createMockSyncOperation({
        id: 'test-sync-id-123',
        rollback_point: 'stash-123',
      });
      mockGetSyncHistory.mockResolvedValue([mockOperation]);
      mockRollbackSync.mockResolvedValue(undefined);

      const { createSyncCommand } = await import('./sync');
      const command = createSyncCommand({});

      await command.parseAsync(['node', 'test', 'rollback', 'test-sync']);

      expect(mockRollbackSync).toHaveBeenCalledWith('test-sync-id-123');
    });
  });
});
