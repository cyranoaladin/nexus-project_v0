import { jest } from '@jest/globals';
import { Command } from 'commander';
import { createStatusCommand } from './status';
import { DaemonManager } from '../../daemon/manager';
import { SyncManager } from '../../core/sync/manager';
import { GitClient } from '../../core/git/client';

jest.mock('../../daemon/manager');
jest.mock('../../core/sync/manager');
jest.mock('../../core/git/client');
jest.mock('fs/promises');

describe('Status Commands', () => {
  let consoleLogSpy: any;
  let consoleErrorSpy: any;
  let processExitSpy: any;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('status (overall)', () => {
    it('should display overall system status', async () => {
      const mockDaemonStatus = {
        running: true,
        pid: 12345,
        uptime: 3600000,
        startedAt: new Date('2024-01-01T12:00:00Z'),
        health: 'healthy' as const,
      };

      const mockWorktrees = [
        { path: '/repo', branch: 'main', commit: 'abc1234', locked: false, prunable: false },
        { path: '/repo/wt1', branch: 'feature-1', commit: 'def5678', locked: false, prunable: false },
      ];

      const mockSyncs = [
        {
          id: 'sync-1',
          worktree_branch: 'feature-1',
          commit_hash: 'def5678',
          status: 'success' as const,
          started_at: new Date('2024-01-01T13:00:00Z'),
        },
      ];

      (DaemonManager as jest.MockedClass<typeof DaemonManager>).mockImplementation(() => ({
        getStatus: jest.fn().mockResolvedValue(mockDaemonStatus),
      } as any));

      (GitClient as jest.MockedClass<typeof GitClient>).mockImplementation(() => ({
        listWorktrees: jest.fn().mockResolvedValue(mockWorktrees),
      } as any));

      (SyncManager as jest.MockedClass<typeof SyncManager>).mockImplementation(() => ({
        getSyncHistory: jest.fn().mockResolvedValue(mockSyncs),
      } as any));

      const command = createStatusCommand({});
      await command.parseAsync(['node', 'test'], { from: 'user' });

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Zenflow System Status'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Running'));
    });

    it('should show daemon stopped when not running', async () => {
      const mockDaemonStatus = {
        running: false,
      };

      const mockWorktrees = [
        { path: '/repo', branch: 'main', commit: 'abc1234', locked: false, prunable: false },
      ];

      (jest.mocked as any)(DaemonManager).mockImplementation(() => ({
        getStatus: jest.fn().mockResolvedValue(mockDaemonStatus),
      } as any));

      (jest.mocked as any)(GitClient).mockImplementation(() => ({
        listWorktrees: jest.fn().mockResolvedValue(mockWorktrees),
      } as any));

      (jest.mocked as any)(SyncManager).mockImplementation(() => ({
        getSyncHistory: jest.fn().mockResolvedValue([]),
      } as any));

      const command = createStatusCommand({});
      await command.parseAsync(['node', 'test'], { from: 'user' });

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Stopped'));
    });

    it('should output JSON when --json flag is set', async () => {
      const mockDaemonStatus = {
        running: true,
        pid: 12345,
        uptime: 3600000,
        startedAt: new Date('2024-01-01T12:00:00Z'),
        health: 'healthy' as const,
      };

      const mockWorktrees = [
        { path: '/repo', branch: 'main', commit: 'abc1234', locked: false, prunable: false },
      ];

      (jest.mocked as any)(DaemonManager).mockImplementation(() => ({
        getStatus: jest.fn().mockResolvedValue(mockDaemonStatus),
      } as any));

      (jest.mocked as any)(GitClient).mockImplementation(() => ({
        listWorktrees: jest.fn().mockResolvedValue(mockWorktrees),
      } as any));

      (jest.mocked as any)(SyncManager).mockImplementation(() => ({
        getSyncHistory: jest.fn().mockResolvedValue([]),
      } as any));

      const command = createStatusCommand({ json: true });
      await command.parseAsync(['node', 'test'], { from: 'user' });

      const jsonCalls = consoleLogSpy.mock.calls.filter((call: any) => {
        try {
          JSON.parse(call[0]);
          return true;
        } catch {
          return false;
        }
      });

      expect(jsonCalls.length).toBeGreaterThan(0);
    });
  });

  describe('status worktrees', () => {
    it('should list all worktrees with sync status', async () => {
      const mockWorktrees = [
        { path: '/repo', branch: 'refs/heads/main', commit: 'abc1234567', locked: false, prunable: false },
        { path: '/repo/wt1', branch: 'refs/heads/feature-1', commit: 'def5678901', locked: false, prunable: false },
      ];

      const mockSyncHistory = [
        {
          id: 'sync-1',
          worktree_branch: 'refs/heads/feature-1',
          commit_hash: 'def5678',
          status: 'success' as const,
          started_at: new Date('2024-01-01T13:00:00Z'),
        },
      ];

      (jest.mocked as any)(GitClient).mockImplementation(() => ({
        listWorktrees: jest.fn().mockResolvedValue(mockWorktrees),
      } as any));

      (jest.mocked as any)(SyncManager).mockImplementation(() => ({
        getSyncHistory: jest.fn().mockResolvedValue(mockSyncHistory),
      } as any));

      const command = createStatusCommand({});
      await command.parseAsync(['node', 'test', 'worktrees'], { from: 'user' });

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Worktrees Status'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('main'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('feature-1'));
    });

    it('should show message when no worktrees found', async () => {
      (jest.mocked as any)(GitClient).mockImplementation(() => ({
        listWorktrees: jest.fn().mockResolvedValue([]),
      } as any));

      const command = createStatusCommand({});
      await command.parseAsync(['node', 'test', 'worktrees'], { from: 'user' });

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('No worktrees found'));
    });

    it('should output table in JSON format when --json flag is set', async () => {
      const mockWorktrees = [
        { path: '/repo', branch: 'main', commit: 'abc1234567', locked: false, prunable: false },
      ];

      (jest.mocked as any)(GitClient).mockImplementation(() => ({
        listWorktrees: jest.fn().mockResolvedValue(mockWorktrees),
      } as any));

      (jest.mocked as any)(SyncManager).mockImplementation(() => ({
        getSyncHistory: jest.fn().mockResolvedValue([]),
      } as any));

      const command = createStatusCommand({ json: true });
      await command.parseAsync(['node', 'test', 'worktrees'], { from: 'user' });

      const jsonCalls = consoleLogSpy.mock.calls.filter((call: any) => {
        try {
          const parsed = JSON.parse(call[0]);
          return Array.isArray(parsed);
        } catch {
          return false;
        }
      });

      expect(jsonCalls.length).toBeGreaterThan(0);
    });
  });

  describe('status service', () => {
    it('should show daemon service status when running', async () => {
      const mockDaemonStatus = {
        running: true,
        pid: 12345,
        uptime: 3600000,
        startedAt: new Date('2024-01-01T12:00:00Z'),
        health: 'healthy' as const,
      };

      (jest.mocked as any)(DaemonManager).mockImplementation(() => ({
        getStatus: jest.fn().mockResolvedValue(mockDaemonStatus),
      } as any));

      const command = createStatusCommand({});
      await command.parseAsync(['node', 'test', 'service'], { from: 'user' });

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Running'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('12345'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('healthy'));
    });

    it('should show daemon service status when stopped', async () => {
      const mockDaemonStatus = {
        running: false,
      };

      (jest.mocked as any)(DaemonManager).mockImplementation(() => ({
        getStatus: jest.fn().mockResolvedValue(mockDaemonStatus),
      } as any));

      const command = createStatusCommand({});
      await command.parseAsync(['node', 'test', 'service'], { from: 'user' });

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Stopped'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('zenflow daemon start'));
    });

    it('should output JSON when --json flag is set', async () => {
      const mockDaemonStatus = {
        running: true,
        pid: 12345,
        uptime: 3600000,
        startedAt: new Date('2024-01-01T12:00:00Z'),
        health: 'healthy' as const,
      };

      (jest.mocked as any)(DaemonManager).mockImplementation(() => ({
        getStatus: jest.fn().mockResolvedValue(mockDaemonStatus),
      } as any));

      const command = createStatusCommand({ json: true });
      await command.parseAsync(['node', 'test', 'service'], { from: 'user' });

      const jsonCalls = consoleLogSpy.mock.calls.filter((call: any) => {
        try {
          const parsed = JSON.parse(call[0]);
          return typeof parsed === 'object' && 'running' in parsed;
        } catch {
          return false;
        }
      });

      expect(jsonCalls.length).toBeGreaterThan(0);
    });
  });

  describe('error handling', () => {
    it('should handle errors gracefully', async () => {
      (jest.mocked as any)(DaemonManager).mockImplementation(() => ({
        getStatus: jest.fn().mockRejectedValue(new Error('Test error')),
      } as any));

      const command = createStatusCommand({});
      await command.parseAsync(['node', 'test'], { from: 'user' });

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to get system status'));
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });
});
