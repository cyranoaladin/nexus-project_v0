import { Command } from 'commander';
import { createOutput } from '../utils/output';
import { DaemonManager } from '../../daemon/manager';
import { SyncManager } from '../../core/sync/manager';
import { GitClient } from '../../core/git/client';
import path from 'path';
import * as fs from 'fs/promises';

function getRepoPath(configPath?: string): string {
  if (configPath) {
    return path.dirname(path.dirname(path.resolve(configPath)));
  }
  return process.cwd();
}

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function formatDate(date: Date): string {
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

async function loadConfig(repoPath: string): Promise<any> {
  try {
    const configPath = path.join(repoPath, '.zenflow', 'settings.json');
    const content = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}

export function createStatusCommand(globalOptions: any): Command {
  const command = new Command('status');
  command.description('Show Zenflow system status');

  command
    .description('Show overall system status')
    .action(async () => {
      const output = createOutput(globalOptions);
      try {
        const repoPath = getRepoPath(globalOptions.config);
        const daemonManager = new DaemonManager(repoPath);
        const gitClient = new GitClient(repoPath);
        
        const config = await loadConfig(repoPath);
        const daemonStatus = await daemonManager.getStatus();
        const worktrees = await gitClient.listWorktrees();
        
        const syncConfig = {
          enabled: true,
          autoPush: false,
          maxRetries: 3,
          timeout: 300000,
          conflictStrategy: 'abort' as const,
          excludedWorktrees: [],
          notificationChannels: ['console' as const, 'log' as const],
          verificationCommands: [],
        };
        
        const syncManager = new SyncManager(repoPath, syncConfig);
        const recentSyncs = await syncManager.getSyncHistory({ limit: 5 });

        output.info('=== Zenflow System Status ===');
        output.newline();

        output.info('📁 Repository:');
        output.debug(`  Path: ${repoPath}`);
        output.debug(`  Worktrees: ${worktrees.length}`);
        output.newline();

        output.info('⚙️  Daemon Service:');
        if (daemonStatus.running) {
          output.success(`  Status: Running (PID: ${daemonStatus.pid})`);
          if (daemonStatus.uptime) {
            output.debug(`  Uptime: ${formatUptime(daemonStatus.uptime)}`);
          }
          if (daemonStatus.startedAt) {
            output.debug(`  Started: ${formatDate(daemonStatus.startedAt)}`);
          }
          output.debug(`  Health: ${daemonStatus.health || 'unknown'}`);
        } else {
          output.warning('  Status: Stopped');
        }
        output.newline();

        output.info('📊 Recent Sync Activity:');
        if (recentSyncs.length === 0) {
          output.debug('  No sync operations recorded');
        } else {
          const successCount = recentSyncs.filter(s => s.status === 'success').length;
          const failureCount = recentSyncs.filter(s => s.status === 'failure').length;
          const conflictCount = recentSyncs.filter(s => s.status === 'conflict').length;
          
          output.debug(`  Total operations: ${recentSyncs.length}`);
          output.debug(`  Success: ${successCount} | Failures: ${failureCount} | Conflicts: ${conflictCount}`);
          
          const lastSync = recentSyncs[0];
          if (lastSync) {
            output.debug(`  Last sync: ${lastSync.worktree_branch} (${lastSync.status}) at ${formatDate(lastSync.started_at)}`);
          }
        }
        output.newline();

        if (globalOptions.json) {
          output.json({
            repoPath,
            daemon: daemonStatus,
            worktrees: worktrees.length,
            recentSyncs: {
              total: recentSyncs.length,
              success: recentSyncs.filter(s => s.status === 'success').length,
              failure: recentSyncs.filter(s => s.status === 'failure').length,
              conflict: recentSyncs.filter(s => s.status === 'conflict').length,
            },
          });
        }
      } catch (error) {
        output.error('Failed to get system status', error as Error);
        process.exit(1);
      }
    });

  command
    .command('worktrees')
    .description('List all worktrees with sync status')
    .action(async () => {
      const output = createOutput(globalOptions);
      try {
        const repoPath = getRepoPath(globalOptions.config);
        const gitClient = new GitClient(repoPath);
        
        const syncConfig = {
          enabled: true,
          autoPush: false,
          maxRetries: 3,
          timeout: 300000,
          conflictStrategy: 'abort' as const,
          excludedWorktrees: [],
          notificationChannels: ['console' as const, 'log' as const],
          verificationCommands: [],
        };
        
        const syncManager = new SyncManager(repoPath, syncConfig);
        
        output.info('📂 Worktrees Status');
        output.newline();
        
        const worktrees = await gitClient.listWorktrees();
        
        if (worktrees.length === 0) {
          output.info('No worktrees found');
          return;
        }

        const worktreeData = await Promise.all(
          worktrees.map(async (wt) => {
            let syncStatus = 'N/A';
            let lastSync = '';
            
            if (wt.branch !== 'main' && wt.branch !== 'refs/heads/main') {
              try {
                const history = await syncManager.getSyncHistory({
                  worktreeBranch: wt.branch,
                  limit: 1,
                });
                
                if (history.length > 0) {
                  const last = history[0];
                  syncStatus = last.status;
                  lastSync = formatDate(last.started_at);
                }
              } catch (error) {
                syncStatus = 'error';
              }
            } else {
              syncStatus = 'main';
              lastSync = '-';
            }

            return {
              Branch: wt.branch.replace('refs/heads/', ''),
              Path: wt.path.replace(repoPath, '.'),
              Commit: wt.commit.substring(0, 7),
              'Sync Status': syncStatus,
              'Last Sync': lastSync || 'Never',
            };
          })
        );

        if (globalOptions.json) {
          output.json(worktreeData);
        } else {
          output.table(worktreeData);
        }
      } catch (error) {
        output.error('Failed to get worktrees status', error as Error);
        process.exit(1);
      }
    });

  command
    .command('service')
    .description('Show daemon service status')
    .action(async () => {
      const output = createOutput(globalOptions);
      try {
        const repoPath = getRepoPath(globalOptions.config);
        const manager = new DaemonManager(repoPath);
        
        const status = await manager.getStatus();

        output.info('🔧 Zenflow Daemon Service Status');
        output.newline();

        if (status.running) {
          output.success(`Status: Running`);
          output.info(`PID: ${status.pid}`);
          
          if (status.uptime) {
            output.info(`Uptime: ${formatUptime(status.uptime)}`);
          }
          
          if (status.startedAt) {
            output.info(`Started At: ${formatDate(status.startedAt)}`);
          }
          
          output.info(`Health: ${status.health || 'unknown'}`);
          output.newline();
          
          output.info(`Log File: ${path.join(repoPath, '.zenflow/logs/daemon.log')}`);
          output.info(`PID File: ${path.join(repoPath, '.zenflow/state/daemon.pid')}`);
        } else {
          output.warning('Status: Stopped');
          output.newline();
          output.info('Use "zenflow daemon start" to start the service');
        }

        if (globalOptions.json) {
          output.json(status);
        }
      } catch (error) {
        output.error('Failed to get service status', error as Error);
        process.exit(1);
      }
    });

  return command;
}
