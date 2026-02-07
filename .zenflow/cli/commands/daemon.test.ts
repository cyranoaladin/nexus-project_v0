import { createDaemonCommand } from './daemon';

jest.mock('../../daemon/manager');
jest.mock('../utils/output');

import { DaemonManager } from '../../daemon/manager';
import { createOutput } from '../utils/output';

describe('Daemon Command', () => {
  let mockOutput: any;
  let mockManager: jest.Mocked<DaemonManager>;
  const globalOptions = { verbose: false, quiet: false, config: undefined };

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

    mockManager = {
      start: jest.fn(),
      stop: jest.fn(),
      restart: jest.fn(),
      getStatus: jest.fn(),
      getLogs: jest.fn(),
      followLogs: jest.fn(),
    } as any;

    (DaemonManager as jest.Mock).mockImplementation(() => mockManager);
  });

  describe('daemon start', () => {
    it('should create daemon command', () => {
      const command = createDaemonCommand(globalOptions);
      expect(command).toBeDefined();
      expect(command.name()).toBe('daemon');
    });

    it('should start daemon successfully', async () => {
      mockManager.start.mockResolvedValue(undefined);
      mockManager.getStatus.mockResolvedValue({
        running: true,
        pid: 12345,
      });

      const command = createDaemonCommand(globalOptions);
      const startCmd = command.commands.find(c => c.name() === 'start');

      if (startCmd) {
        await startCmd.parseAsync([], { from: 'user' });
      }

      expect(mockManager.start).toHaveBeenCalled();
      expect(mockOutput.success).toHaveBeenCalledWith(expect.stringContaining('12345'));
    });

    it('should handle start failure', async () => {
      const mockExit = jest.spyOn(process, 'exit').mockImplementation((code) => {
        throw new Error(`Process exited with code ${code}`);
      });

      mockManager.start.mockRejectedValue(new Error('Failed to start'));

      const command = createDaemonCommand(globalOptions);
      const startCmd = command.commands.find(c => c.name() === 'start');

      if (startCmd) {
        try {
          await startCmd.parseAsync([], { from: 'user' });
        } catch (error) {
          expect((error as Error).message).toContain('Process exited');
        }
      }

      expect(mockOutput.error).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(1);
      
      mockExit.mockRestore();
    });
  });

  describe('daemon stop', () => {
    it('should stop daemon successfully', async () => {
      mockManager.stop.mockResolvedValue(undefined);

      const command = createDaemonCommand(globalOptions);
      const stopCmd = command.commands.find(c => c.name() === 'stop');

      if (stopCmd) {
        await stopCmd.parseAsync([], { from: 'user' });
      }

      expect(mockManager.stop).toHaveBeenCalled();
      expect(mockOutput.success).toHaveBeenCalledWith('Daemon stopped successfully');
    });

    it('should handle stop failure', async () => {
      const mockExit = jest.spyOn(process, 'exit').mockImplementation((code) => {
        throw new Error(`Process exited with code ${code}`);
      });

      mockManager.stop.mockRejectedValue(new Error('Failed to stop'));

      const command = createDaemonCommand(globalOptions);
      const stopCmd = command.commands.find(c => c.name() === 'stop');

      if (stopCmd) {
        try {
          await stopCmd.parseAsync([], { from: 'user' });
        } catch (error) {
          expect((error as Error).message).toContain('Process exited');
        }
      }

      expect(mockOutput.error).toHaveBeenCalled();
      
      mockExit.mockRestore();
    });
  });

  describe('daemon restart', () => {
    it('should restart daemon successfully', async () => {
      mockManager.restart.mockResolvedValue(undefined);
      mockManager.getStatus.mockResolvedValue({
        running: true,
        pid: 54321,
      });

      const command = createDaemonCommand(globalOptions);
      const restartCmd = command.commands.find(c => c.name() === 'restart');

      if (restartCmd) {
        await restartCmd.parseAsync([], { from: 'user' });
      }

      expect(mockManager.restart).toHaveBeenCalled();
      expect(mockOutput.success).toHaveBeenCalledWith(expect.stringContaining('54321'));
    });

    it('should handle restart failure', async () => {
      const mockExit = jest.spyOn(process, 'exit').mockImplementation((code) => {
        throw new Error(`Process exited with code ${code}`);
      });

      mockManager.restart.mockRejectedValue(new Error('Failed to restart'));

      const command = createDaemonCommand(globalOptions);
      const restartCmd = command.commands.find(c => c.name() === 'restart');

      if (restartCmd) {
        try {
          await restartCmd.parseAsync([], { from: 'user' });
        } catch (error) {
          expect((error as Error).message).toContain('Process exited');
        }
      }

      expect(mockOutput.error).toHaveBeenCalled();
      
      mockExit.mockRestore();
    });
  });

  describe('daemon logs', () => {
    it('should show logs without follow', async () => {
      const logLines = ['Log line 1', 'Log line 2', 'Log line 3'];
      mockManager.getLogs.mockResolvedValue(logLines);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const command = createDaemonCommand(globalOptions);
      const logsCmd = command.commands.find(c => c.name() === 'logs');

      if (logsCmd) {
        await logsCmd.parseAsync([], { from: 'user' });
      }

      expect(mockManager.getLogs).toHaveBeenCalledWith(50);
      expect(consoleSpy).toHaveBeenCalledTimes(3);
      
      consoleSpy.mockRestore();
    });

    it('should respect custom line count', async () => {
      mockManager.getLogs.mockResolvedValue([]);

      const command = createDaemonCommand(globalOptions);
      const logsCmd = command.commands.find(c => c.name() === 'logs');

      if (logsCmd) {
        await logsCmd.parseAsync(['--lines', '100'], { from: 'user' });
      }

      expect(mockManager.getLogs).toHaveBeenCalledWith(100);
    });

    it('should show message when no logs available', async () => {
      mockManager.getLogs.mockResolvedValue([]);

      const command = createDaemonCommand(globalOptions);
      const logsCmd = command.commands.find(c => c.name() === 'logs');

      if (logsCmd) {
        await logsCmd.parseAsync([], { from: 'user' });
      }

      expect(mockOutput.info).toHaveBeenCalledWith('No logs available');
    });

    it('should follow logs when --follow is specified', async () => {
      const stopFollowing = jest.fn();
      mockManager.followLogs.mockResolvedValue(stopFollowing);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const mockExit = jest.spyOn(process, 'exit').mockImplementation((code) => {
        // Don't throw, just track that exit was called
      });
      
      let signalHandler: any;
      const mockOn = jest.spyOn(process, 'on').mockImplementation((event: string, handler: any) => {
        if (event === 'SIGINT') {
          signalHandler = handler;
        }
        return process;
      });

      const command = createDaemonCommand(globalOptions);
      const logsCmd = command.commands.find(c => c.name() === 'logs');

      if (logsCmd) {
        await logsCmd.parseAsync(['--follow'], { from: 'user' });
        
        // Trigger SIGINT handler
        if (signalHandler) {
          signalHandler();
        }
      }

      expect(mockManager.followLogs).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(0);
      
      consoleSpy.mockRestore();
      mockOn.mockRestore();
      mockExit.mockRestore();
    });

    it('should handle logs failure', async () => {
      const mockExit = jest.spyOn(process, 'exit').mockImplementation((code) => {
        throw new Error(`Process exited with code ${code}`);
      });

      mockManager.getLogs.mockRejectedValue(new Error('Failed to read logs'));

      const command = createDaemonCommand(globalOptions);
      const logsCmd = command.commands.find(c => c.name() === 'logs');

      if (logsCmd) {
        try {
          await logsCmd.parseAsync([], { from: 'user' });
        } catch (error) {
          expect((error as Error).message).toContain('Process exited');
        }
      }

      expect(mockOutput.error).toHaveBeenCalled();
      
      mockExit.mockRestore();
    });
  });

  describe('getRepoPath', () => {
    it('should use current directory when no config provided', () => {
      const command = createDaemonCommand({ config: undefined });
      expect(command).toBeDefined();
    });

    it('should derive path from config when provided', () => {
      const command = createDaemonCommand({ config: '/path/to/.zenflow/settings.json' });
      expect(command).toBeDefined();
    });
  });
});
