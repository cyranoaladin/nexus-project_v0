import { jest } from '@jest/globals';
import { Command } from 'commander';
import { createDaemonCommand } from './daemon';
import { DaemonManager } from '../../daemon/manager';

jest.mock('../../daemon/manager');

describe('Daemon Commands', () => {
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

  describe('daemon start', () => {
    it('should start the daemon successfully', async () => {
      const mockStart = jest.fn().mockResolvedValue(undefined);
      const mockGetStatus = jest.fn().mockResolvedValue({
        running: true,
        pid: 12345,
        uptime: 1000,
        startedAt: new Date(),
        health: 'healthy',
      });

      jest.mocked(DaemonManager).mockImplementation(() => ({
        start: mockStart,
        getStatus: mockGetStatus,
      } as any));

      const command = createDaemonCommand({});
      await command.parseAsync(['node', 'test', 'start'], { from: 'user' });

      expect(mockStart).toHaveBeenCalled();
      expect(mockGetStatus).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('started successfully'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('12345'));
    });

    it('should handle start errors', async () => {
      const mockStart = jest.fn().mockRejectedValue(new Error('Daemon is already running'));

      jest.mocked(DaemonManager).mockImplementation(() => ({
        start: mockStart,
      } as any));

      const command = createDaemonCommand({});
      await command.parseAsync(['node', 'test', 'start'], { from: 'user' });

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to start daemon'));
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('daemon stop', () => {
    it('should stop the daemon successfully', async () => {
      const mockStop = jest.fn().mockResolvedValue(undefined);

      jest.mocked(DaemonManager).mockImplementation(() => ({
        stop: mockStop,
      } as any));

      const command = createDaemonCommand({});
      await command.parseAsync(['node', 'test', 'stop'], { from: 'user' });

      expect(mockStop).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('stopped successfully'));
    });

    it('should handle stop errors', async () => {
      const mockStop = jest.fn().mockRejectedValue(new Error('Daemon is not running'));

      jest.mocked(DaemonManager).mockImplementation(() => ({
        stop: mockStop,
      } as any));

      const command = createDaemonCommand({});
      await command.parseAsync(['node', 'test', 'stop'], { from: 'user' });

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to stop daemon'));
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('daemon restart', () => {
    it('should restart the daemon successfully', async () => {
      const mockRestart = jest.fn().mockResolvedValue(undefined);
      const mockGetStatus = jest.fn().mockResolvedValue({
        running: true,
        pid: 54321,
        uptime: 1000,
        startedAt: new Date(),
        health: 'healthy',
      });

      jest.mocked(DaemonManager).mockImplementation(() => ({
        restart: mockRestart,
        getStatus: mockGetStatus,
      } as any));

      const command = createDaemonCommand({});
      await command.parseAsync(['node', 'test', 'restart'], { from: 'user' });

      expect(mockRestart).toHaveBeenCalled();
      expect(mockGetStatus).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('restarted successfully'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('54321'));
    });

    it('should handle restart errors', async () => {
      const mockRestart = jest.fn().mockRejectedValue(new Error('Failed to restart'));

      jest.mocked(DaemonManager).mockImplementation(() => ({
        restart: mockRestart,
      } as any));

      const command = createDaemonCommand({});
      await command.parseAsync(['node', 'test', 'restart'], { from: 'user' });

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to restart daemon'));
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('daemon logs', () => {
    it('should display logs with default lines count', async () => {
      const mockGetLogs = jest.fn().mockResolvedValue([
        'Log line 1',
        'Log line 2',
        'Log line 3',
      ]);

      jest.mocked(DaemonManager).mockImplementation(() => ({
        getLogs: mockGetLogs,
      } as any));

      const command = createDaemonCommand({});
      await command.parseAsync(['node', 'test', 'logs'], { from: 'user' });

      expect(mockGetLogs).toHaveBeenCalledWith(50);
      expect(consoleLogSpy).toHaveBeenCalledWith('Log line 1');
      expect(consoleLogSpy).toHaveBeenCalledWith('Log line 2');
      expect(consoleLogSpy).toHaveBeenCalledWith('Log line 3');
    });

    it('should display logs with custom lines count', async () => {
      const mockGetLogs = jest.fn().mockResolvedValue([
        'Log line 1',
        'Log line 2',
      ]);

      jest.mocked(DaemonManager).mockImplementation(() => ({
        getLogs: mockGetLogs,
      } as any));

      const command = createDaemonCommand({});
      await command.parseAsync(['node', 'test', 'logs', '--lines', '10'], { from: 'user' });

      expect(mockGetLogs).toHaveBeenCalledWith(10);
    });

    it('should show message when no logs available', async () => {
      const mockGetLogs = jest.fn().mockResolvedValue([]);

      jest.mocked(DaemonManager).mockImplementation(() => ({
        getLogs: mockGetLogs,
      } as any));

      const command = createDaemonCommand({});
      await command.parseAsync(['node', 'test', 'logs'], { from: 'user' });

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('No logs available'));
    });

    it('should follow logs when --follow flag is set', async () => {
      const mockFollowLogs = jest.fn().mockImplementation((callback: (line: string) => void) => {
        callback('Followed log line 1');
        callback('Followed log line 2');
        return jest.fn();
      });

      jest.mocked(DaemonManager).mockImplementation(() => ({
        followLogs: mockFollowLogs,
      } as any));

      const command = createDaemonCommand({});
      const promise = command.parseAsync(['node', 'test', 'logs', '--follow'], { from: 'user' });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockFollowLogs).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Following daemon logs'));
    });

    it('should handle log viewing errors', async () => {
      const mockGetLogs = jest.fn().mockRejectedValue(new Error('Cannot read log file'));

      jest.mocked(DaemonManager).mockImplementation(() => ({
        getLogs: mockGetLogs,
      } as any));

      const command = createDaemonCommand({});
      await command.parseAsync(['node', 'test', 'logs'], { from: 'user' });

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to view daemon logs'));
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('getRepoPath', () => {
    it('should use current directory when no config provided', async () => {
      const mockStart = jest.fn().mockResolvedValue(undefined);
      const mockGetStatus = jest.fn().mockResolvedValue({
        running: true,
        pid: 12345,
      });

      jest.mocked(DaemonManager).mockImplementation((repoPath: string) => {
        expect(repoPath).toBe(process.cwd());
        return {
          start: mockStart,
          getStatus: mockGetStatus,
        } as any;
      });

      const command = createDaemonCommand({});
      await command.parseAsync(['node', 'test', 'start'], { from: 'user' });

      expect(mockStart).toHaveBeenCalled();
    });

    it('should derive repo path from config path when provided', async () => {
      const mockStart = jest.fn().mockResolvedValue(undefined);
      const mockGetStatus = jest.fn().mockResolvedValue({
        running: true,
        pid: 12345,
      });

      const configPath = '/custom/path/.zenflow/settings.json';

      jest.mocked(DaemonManager).mockImplementation((repoPath: string) => {
        expect(repoPath).toContain('/custom/path');
        return {
          start: mockStart,
          getStatus: mockGetStatus,
        } as any;
      });

      const command = createDaemonCommand({ config: configPath });
      await command.parseAsync(['node', 'test', 'start'], { from: 'user' });

      expect(mockStart).toHaveBeenCalled();
    });
  });
});
