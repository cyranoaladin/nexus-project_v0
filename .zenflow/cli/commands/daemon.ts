import { Command } from 'commander';
import { createOutput } from '../utils/output';
import { DaemonManager } from '../../daemon/manager';
import path from 'path';

function getRepoPath(configPath?: string): string {
  if (configPath) {
    return path.dirname(path.dirname(path.resolve(configPath)));
  }
  return process.cwd();
}

export function createDaemonCommand(globalOptions: any): Command {
  const command = new Command('daemon');
  command.description('Manage Zenflow daemon service');

  command
    .command('start')
    .description('Start the background daemon')
    .action(async () => {
      const output = createOutput(globalOptions);
      try {
        const repoPath = getRepoPath(globalOptions.config);
        const manager = new DaemonManager(repoPath);
        
        output.info('Starting Zenflow daemon...');
        await manager.start();
        
        const status = await manager.getStatus();
        output.success(`Daemon started successfully (PID: ${status.pid})`);
        output.info(`Logs: ${path.join(repoPath, '.zenflow/logs/daemon.log')}`);
      } catch (error) {
        output.error('Failed to start daemon', error as Error);
        process.exit(1);
      }
    });

  command
    .command('stop')
    .description('Stop the daemon gracefully')
    .action(async () => {
      const output = createOutput(globalOptions);
      try {
        const repoPath = getRepoPath(globalOptions.config);
        const manager = new DaemonManager(repoPath);
        
        output.info('Stopping Zenflow daemon...');
        await manager.stop();
        
        output.success('Daemon stopped successfully');
      } catch (error) {
        output.error('Failed to stop daemon', error as Error);
        process.exit(1);
      }
    });

  command
    .command('restart')
    .description('Restart the daemon')
    .action(async () => {
      const output = createOutput(globalOptions);
      try {
        const repoPath = getRepoPath(globalOptions.config);
        const manager = new DaemonManager(repoPath);
        
        output.info('Restarting Zenflow daemon...');
        await manager.restart();
        
        const status = await manager.getStatus();
        output.success(`Daemon restarted successfully (PID: ${status.pid})`);
      } catch (error) {
        output.error('Failed to restart daemon', error as Error);
        process.exit(1);
      }
    });

  command
    .command('logs')
    .description('View daemon logs')
    .option('--follow', 'Follow log output')
    .option('--lines <n>', 'Number of lines to show', '50')
    .action(async (options) => {
      const output = createOutput(globalOptions);
      try {
        const repoPath = getRepoPath(globalOptions.config);
        const manager = new DaemonManager(repoPath);
        const lines = parseInt(options.lines, 10);
        
        if (options.follow) {
          output.info('Following daemon logs (press Ctrl+C to exit)...');
          output.newline();
          
          const stopFollowing = await manager.followLogs((line: string) => {
            console.log(line);
          });
          
          process.on('SIGINT', () => {
            stopFollowing();
            output.newline();
            output.info('Stopped following logs');
            process.exit(0);
          });
        } else {
          const logLines = await manager.getLogs(lines);
          
          if (logLines.length === 0) {
            output.info('No logs available');
          } else {
            logLines.forEach(line => console.log(line));
          }
        }
      } catch (error) {
        output.error('Failed to view daemon logs', error as Error);
        process.exit(1);
      }
    });

  return command;
}
