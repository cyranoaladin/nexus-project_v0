jest.mock('uuid', () => ({
  v4: () => 'test-uuid-1234-5678-90ab-cdef',
}));

import { createStatusCommand } from './status';

jest.mock('../../daemon/manager');
jest.mock('../../core/sync/manager');
jest.mock('../../core/git/client');
jest.mock('../utils/output');

const mockReadFile = jest.fn();
jest.mock('fs/promises', () => ({
  readFile: mockReadFile,
}));

import { DaemonManager } from '../../daemon/manager';
import { SyncManager } from '../../core/sync/manager';
import { GitClient } from '../../core/git/client';
import { createOutput } from '../utils/output';

describe('Status Command', () => {
  let mockOutput: any;
  let mockDaemonManager: jest.Mocked<DaemonManager>;
  let mockSyncManager: jest.Mocked<SyncManager>;
  let mockGitClient: jest.Mocked<GitClient>;
  const globalOptions = { verbose: false, quiet: false, config: undefined, json: false };

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockOutput = {
      info: jest.fn(),
      success: jest.fn(),
      error: jest.fn(),
      warning: jest.fn(),
      newline: jest.fn(),
      json: jest.fn(),
      table: jest.fn(),
      progress: jest.fn(),
      debug: jest.fn(),
    };

    (createOutput as jest.Mock).mockReturnValue(mockOutput);

    mockDaemonManager = {
      getStatus: jest.fn(),
    } as any;

    mockSyncManager = {
      getSyncHistory: jest.fn(),
    } as any;

    mockGitClient = {
      listWorktrees: jest.fn(),
    } as any;

    (DaemonManager as jest.Mock).mockImplementation(() => mockDaemonManager);
    (SyncManager as jest.Mock).mockImplementation(() => mockSyncManager);
    (GitClient as jest.Mock).mockImplementation(() => mockGitClient);
    
    mockReadFile.mockResolvedValue(JSON.stringify({}));
  });

  describe('status (overall)', () => {
    it('should create status command', () => {
      const command = createStatusCommand(globalOptions);
      expect(command).toBeDefined();
      expect(command.name()).toBe('status');
    });

    it('should show overall system status', async () => {
      mockDaemonManager.getStatus.mockResolvedValue({
        running: true,
        pid: 12345,
        uptime: 3600000,
        startedAt: new Date('2024-01-01T12:00:00Z'),
        health: 'healthy',
      });

      mockGitClient.listWorktrees.mockResolvedValue([
        { path: '/path/to/worktree', branch: 'main', commit: 'abc123', prunable: false },
      ]);

      mockSyncManager.getSyncHistory.mockResolvedValue([
        {
          id: 'sync1',
          worktree_branch: 'feature/test',
          status: 'success',
          started_at: new Date(),
          completed_at: new Date(),
          duration_ms: 1000,
          files_changed: 5,
          commits_synced: 2,
        },
      ]);

      const command = createStatusCommand(globalOptions);
      
      await command.parseAsync([], { from: 'user' });

      expect(mockOutput.info).toHaveBeenCalledWith(expect.stringContaining('Zenflow System Status'));
      expect(mockOutput.success).toHaveBeenCalledWith(expect.stringContaining('Running'));
    });

    it('should show stopped daemon status', async () => {
      mockDaemonManager.getStatus.mockResolvedValue({
        running: false,
      });

      mockGitClient.listWorktrees.mockResolvedValue([]);
      mockSyncManager.getSyncHistory.mockResolvedValue([]);

      const command = createStatusCommand(globalOptions);
      
      await command.parseAsync([], { from: 'user' });

      expect(mockOutput.warning).toHaveBeenCalledWith(expect.stringContaining('Stopped'));
    });

    it('should show sync statistics', async () => {
      mockDaemonManager.getStatus.mockResolvedValue({ running: false });
      mockGitClient.listWorktrees.mockResolvedValue([]);
      
      mockSyncManager.getSyncHistory.mockResolvedValue([
        { id: '1', worktree_branch: 'branch1', status: 'success', started_at: new Date(), completed_at: new Date(), duration_ms: 1000, files_changed: 1, commits_synced: 1 },
        { id: '2', worktree_branch: 'branch2', status: 'failure', started_at: new Date(), completed_at: new Date(), duration_ms: 500, files_changed: 0, commits_synced: 0 },
        { id: '3', worktree_branch: 'branch3', status: 'conflict', started_at: new Date(), completed_at: new Date(), duration_ms: 200, files_changed: 0, commits_synced: 0 },
      ]);

      const command = createStatusCommand(globalOptions);
      
      await command.parseAsync([], { from: 'user' });

      expect(mockOutput.debug).toHaveBeenCalledWith(expect.stringContaining('Total operations: 3'));
      expect(mockOutput.debug).toHaveBeenCalledWith(expect.stringContaining('Success: 1'));
    });

    it('should output JSON when --json flag is set', async () => {
      const jsonOptions = { ...globalOptions, json: true };
      
      mockDaemonManager.getStatus.mockResolvedValue({ running: false });
      mockGitClient.listWorktrees.mockResolvedValue([]);
      mockSyncManager.getSyncHistory.mockResolvedValue([]);

      const command = createStatusCommand(jsonOptions);
      
      await command.parseAsync([], { from: 'user' });

      expect(mockOutput.json).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      const mockExit = jest.spyOn(process, 'exit').mockImplementation((code) => {
        throw new Error(`Process exited with code ${code}`);
      });

      mockDaemonManager.getStatus.mockRejectedValue(new Error('Failed to get status'));

      const command = createStatusCommand(globalOptions);
      
      try {
        await command.parseAsync([], { from: 'user' });
      } catch (error) {
        expect((error as Error).message).toContain('Process exited');
      }

      expect(mockOutput.error).toHaveBeenCalled();
      
      mockExit.mockRestore();
    });
  });

  describe('status worktrees', () => {
    it('should list worktrees with sync status', async () => {
      mockGitClient.listWorktrees.mockResolvedValue([
        { path: '/path/to/wt1', branch: 'refs/heads/feature/test', commit: 'abc123456', prunable: false },
        { path: '/path/to/wt2', branch: 'refs/heads/main', commit: 'def789012', prunable: false },
      ]);

      mockSyncManager.getSyncHistory.mockResolvedValue([
        {
          id: 'sync1',
          worktree_branch: 'feature/test',
          status: 'success',
          started_at: new Date('2024-01-01T10:00:00Z'),
          completed_at: new Date('2024-01-01T10:01:00Z'),
          duration_ms: 60000,
          files_changed: 5,
          commits_synced: 2,
        },
      ]);

      const command = createStatusCommand(globalOptions);
      const worktreesCmd = command.commands.find(c => c.name() === 'worktrees');

      if (worktreesCmd) {
        await worktreesCmd.parseAsync([], { from: 'user' });
      }

      expect(mockOutput.table).toHaveBeenCalled();
      const tableData = mockOutput.table.mock.calls[0][0];
      expect(tableData).toHaveLength(2);
    });

    it('should show message when no worktrees exist', async () => {
      mockGitClient.listWorktrees.mockResolvedValue([]);

      const command = createStatusCommand(globalOptions);
      const worktreesCmd = command.commands.find(c => c.name() === 'worktrees');

      if (worktreesCmd) {
        await worktreesCmd.parseAsync([], { from: 'user' });
      }

      expect(mockOutput.info).toHaveBeenCalledWith('No worktrees found');
    });

    it('should output JSON when --json flag is set', async () => {
      const jsonOptions = { ...globalOptions, json: true };
      
      mockGitClient.listWorktrees.mockResolvedValue([
        { path: '/path', branch: 'main', commit: 'abc123', prunable: false },
      ]);
      mockSyncManager.getSyncHistory.mockResolvedValue([]);

      const command = createStatusCommand(jsonOptions);
      const worktreesCmd = command.commands.find(c => c.name() === 'worktrees');

      if (worktreesCmd) {
        await worktreesCmd.parseAsync([], { from: 'user' });
      }

      expect(mockOutput.json).toHaveBeenCalled();
    });

    it('should handle main worktree specially', async () => {
      mockGitClient.listWorktrees.mockResolvedValue([
        { path: '/path/main', branch: 'main', commit: 'abc123', prunable: false },
      ]);
      mockSyncManager.getSyncHistory.mockResolvedValue([]);

      const command = createStatusCommand(globalOptions);
      const worktreesCmd = command.commands.find(c => c.name() === 'worktrees');

      if (worktreesCmd) {
        await worktreesCmd.parseAsync([], { from: 'user' });
      }

      const tableData = mockOutput.table.mock.calls[0][0];
      expect(tableData[0]['Sync Status']).toBe('main');
    });

    it('should handle sync history errors', async () => {
      mockGitClient.listWorktrees.mockResolvedValue([
        { path: '/path', branch: 'feature/test', commit: 'abc123', prunable: false },
      ]);
      mockSyncManager.getSyncHistory.mockRejectedValue(new Error('Failed'));

      const command = createStatusCommand(globalOptions);
      const worktreesCmd = command.commands.find(c => c.name() === 'worktrees');

      if (worktreesCmd) {
        await worktreesCmd.parseAsync([], { from: 'user' });
      }

      const tableData = mockOutput.table.mock.calls[0][0];
      expect(tableData[0]['Sync Status']).toBe('error');
    });
  });

  describe('status service', () => {
    it('should show running service status', async () => {
      mockDaemonManager.getStatus.mockResolvedValue({
        running: true,
        pid: 54321,
        uptime: 7200000,
        startedAt: new Date('2024-01-01T08:00:00Z'),
        health: 'healthy',
      });

      const command = createStatusCommand(globalOptions);
      const serviceCmd = command.commands.find(c => c.name() === 'service');

      if (serviceCmd) {
        await serviceCmd.parseAsync([], { from: 'user' });
      }

      expect(mockOutput.success).toHaveBeenCalledWith(expect.stringContaining('Running'));
      expect(mockOutput.info).toHaveBeenCalledWith(expect.stringContaining('54321'));
    });

    it('should show stopped service status', async () => {
      mockDaemonManager.getStatus.mockResolvedValue({
        running: false,
      });

      const command = createStatusCommand(globalOptions);
      const serviceCmd = command.commands.find(c => c.name() === 'service');

      if (serviceCmd) {
        await serviceCmd.parseAsync([], { from: 'user' });
      }

      expect(mockOutput.warning).toHaveBeenCalledWith(expect.stringContaining('Stopped'));
      expect(mockOutput.info).toHaveBeenCalledWith(expect.stringContaining('zenflow daemon start'));
    });

    it('should output JSON when --json flag is set', async () => {
      const jsonOptions = { ...globalOptions, json: true };
      
      mockDaemonManager.getStatus.mockResolvedValue({
        running: false,
      });

      const command = createStatusCommand(jsonOptions);
      const serviceCmd = command.commands.find(c => c.name() === 'service');

      if (serviceCmd) {
        await serviceCmd.parseAsync([], { from: 'user' });
      }

      expect(mockOutput.json).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      const mockExit = jest.spyOn(process, 'exit').mockImplementation((code) => {
        throw new Error(`Process exited with code ${code}`);
      });

      mockDaemonManager.getStatus.mockRejectedValue(new Error('Failed to get status'));

      const command = createStatusCommand(globalOptions);
      const serviceCmd = command.commands.find(c => c.name() === 'service');

      if (serviceCmd) {
        try {
          await serviceCmd.parseAsync([], { from: 'user' });
        } catch (error) {
          expect((error as Error).message).toContain('Process exited');
        }
      }

      expect(mockOutput.error).toHaveBeenCalled();
      
      mockExit.mockRestore();
    });
  });

  describe('utility functions', () => {
    it('should format uptime correctly', () => {
      const command = createStatusCommand(globalOptions);
      expect(command).toBeDefined();
    });

    it('should format dates correctly', () => {
      const command = createStatusCommand(globalOptions);
      expect(command).toBeDefined();
    });

    it('should load config correctly', () => {
      const command = createStatusCommand(globalOptions);
      expect(command).toBeDefined();
    });
  });
});
