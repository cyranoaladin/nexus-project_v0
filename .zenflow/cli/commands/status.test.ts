import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import { createStatusCommand } from './status';
import { DaemonManager } from '../../daemon/manager';
import { SyncManager } from '../../core/sync/manager';
import { GitClient } from '../../core/git/client';

vi.mock('../../daemon/manager');
vi.mock('../../core/sync/manager');
vi.mock('../../core/git/client');
vi.mock('fs/promises');

describe('Status Commands', () => {
  let consoleLogSpy: any;
  let consoleErrorSpy: any;
  let processExitSpy: any;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
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

      vi.mocked(DaemonManager).mockImplementation(() => ({
        getStatus: vi.fn().mockResolvedValue(mockDaemonStatus),
      } as any));

      vi.mocked(GitClient).mockImplementation(() => ({
        listWorktrees: vi.fn().mockResolvedValue(mockWorktrees),
      } as any));

      vi.mocked(SyncManager).mockImplementation(() => ({
        getSyncHistory: vi.fn().mockResolvedValue(mockSyncs),
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

      vi.mocked(DaemonManager).mockImplementation(() => ({
        getStatus: vi.fn().mockResolvedValue(mockDaemonStatus),
      } as any));

      vi.mocked(GitClient).mockImplementation(() => ({
        listWorktrees: vi.fn().mockResolvedValue(mockWorktrees),
      } as any));

      vi.mocked(SyncManager).mockImplementation(() => ({
        getSyncHistory: vi.fn().mockResolvedValue([]),
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

      vi.mocked(DaemonManager).mockImplementation(() => ({
        getStatus: vi.fn().mockResolvedValue(mockDaemonStatus),
      } as any));

      vi.mocked(GitClient).mockImplementation(() => ({
        listWorktrees: vi.fn().mockResolvedValue(mockWorktrees),
      } as any));

      vi.mocked(SyncManager).mockImplementation(() => ({
        getSyncHistory: vi.fn().mockResolvedValue([]),
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

      vi.mocked(GitClient).mockImplementation(() => ({
        listWorktrees: vi.fn().mockResolvedValue(mockWorktrees),
      } as any));

      vi.mocked(SyncManager).mockImplementation(() => ({
        getSyncHistory: vi.fn().mockResolvedValue(mockSyncHistory),
      } as any));

      const command = createStatusCommand({});
      await command.parseAsync(['node', 'test', 'worktrees'], { from: 'user' });

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Worktrees Status'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('main'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('feature-1'));
    });

    it('should show message when no worktrees found', async () => {
      vi.mocked(GitClient).mockImplementation(() => ({
        listWorktrees: vi.fn().mockResolvedValue([]),
      } as any));

      const command = createStatusCommand({});
      await command.parseAsync(['node', 'test', 'worktrees'], { from: 'user' });

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('No worktrees found'));
    });

    it('should output table in JSON format when --json flag is set', async () => {
      const mockWorktrees = [
        { path: '/repo', branch: 'main', commit: 'abc1234567', locked: false, prunable: false },
      ];

      vi.mocked(GitClient).mockImplementation(() => ({
        listWorktrees: vi.fn().mockResolvedValue(mockWorktrees),
      } as any));

      vi.mocked(SyncManager).mockImplementation(() => ({
        getSyncHistory: vi.fn().mockResolvedValue([]),
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

      vi.mocked(DaemonManager).mockImplementation(() => ({
        getStatus: vi.fn().mockResolvedValue(mockDaemonStatus),
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

      vi.mocked(DaemonManager).mockImplementation(() => ({
        getStatus: vi.fn().mockResolvedValue(mockDaemonStatus),
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

      vi.mocked(DaemonManager).mockImplementation(() => ({
        getStatus: vi.fn().mockResolvedValue(mockDaemonStatus),
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
      vi.mocked(DaemonManager).mockImplementation(() => ({
        getStatus: vi.fn().mockRejectedValue(new Error('Test error')),
      } as any));

      const command = createStatusCommand({});
      await command.parseAsync(['node', 'test'], { from: 'user' });

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to get system status'));
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });
});
