import { Command } from 'commander';
import { createOutput } from '../utils/output';
import { ValidationError } from '../utils/validation';
import { SyncManager } from '../../core/sync/manager';
import { loadConfig } from '../../core/config/loader';
import type { SyncFilters, SyncOperation } from '../../core/sync/types';

function getSyncManager(configPath?: string): SyncManager {
  const config = loadConfig(configPath);
  const repoPath = process.cwd();
  
  const syncConfig = {
    enabled: config.sync?.enabled ?? true,
    autoPush: config.sync?.auto_push ?? false,
    maxRetries: config.sync?.max_retries ?? 3,
    timeout: config.sync?.timeout ?? 300,
    conflictStrategy: config.sync?.conflict_strategy ?? 'abort',
    excludedWorktrees: config.sync?.excluded_worktrees ?? [],
    notificationChannels: config.sync?.notification_channels ?? ['console', 'log'],
    verificationCommands: config.sync?.verification_commands ?? [],
  };

  return new SyncManager(repoPath, syncConfig as any);
}

function formatSyncStatus(status: SyncOperation['status']): string {
  const statusColors: Record<SyncOperation['status'], string> = {
    pending: '⏳',
    running: '▶️ ',
    success: '✅',
    conflict: '⚠️ ',
    failure: '❌',
    rolled_back: '⏪',
  };
  return statusColors[status] || status;
}

function formatDate(date: Date): string {
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatDuration(start: Date, end?: Date): string {
  if (!end) return '-';
  const durationMs = end.getTime() - start.getTime();
  const seconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${seconds}s`;
}

export function createSyncCommand(globalOptions: any): Command {
  const command = new Command('sync');
  command.description('Synchronize worktree changes to main directory');

  command
    .command('auto')
    .description('Automatically sync all active worktrees')
    .option('--dry-run', 'Preview changes without applying them')
    .action(async (options) => {
      const output = createOutput(globalOptions);
      try {
        if (options.dryRun) {
          output.info('🔍 Running in dry-run mode (no changes will be applied)');
          output.newline();
        }

        output.info('📋 Starting automatic sync for all active worktrees...');
        output.newline();

        const manager = getSyncManager(globalOptions.config);
        const results = await manager.syncAllWorktrees({
          dryRun: options.dryRun ?? false,
        });

        if (results.length === 0) {
          output.info('No worktrees found to sync');
          return;
        }

        output.newline();
        output.info('📊 Sync Summary:');
        output.newline();

        const successCount = results.filter(r => r.status === 'success').length;
        const failureCount = results.filter(r => r.status === 'failure').length;
        const conflictCount = results.filter(r => r.status === 'conflict').length;

        const tableData = results.map(result => ({
          Branch: result.worktree_branch,
          Status: formatSyncStatus(result.status),
          Files: result.diff_summary?.files_changed?.toString() ?? '0',
          Duration: formatDuration(result.started_at, result.completed_at),
        }));

        output.table(tableData, ['Branch', 'Status', 'Files', 'Duration']);
        
        output.newline();
        output.info(`Total: ${results.length} | Success: ${successCount} | Conflicts: ${conflictCount} | Failures: ${failureCount}`);

        if (conflictCount > 0) {
          output.newline();
          output.warning(`⚠️  ${conflictCount} worktree(s) have conflicts. Use 'zenflow sync show <sync-id>' for details.`);
        }

        if (failureCount > 0) {
          output.newline();
          output.error(`❌ ${failureCount} worktree(s) failed to sync. Check logs for details.`);
          process.exit(1);
        }

        output.newline();
        output.success('✨ Automatic sync completed!');
      } catch (error) {
        output.error('Failed to sync worktrees', error as Error);
        process.exit(1);
      }
    });

  command
    .command('worktree <name>')
    .description('Sync a specific worktree')
    .option('--force', 'Force sync even if conflicts exist')
    .option('--dry-run', 'Preview changes without applying them')
    .action(async (name, options) => {
      const output = createOutput(globalOptions);
      try {
        if (options.dryRun) {
          output.info('🔍 Running in dry-run mode (no changes will be applied)');
          output.newline();
        }

        if (options.force) {
          output.warning('⚠️  Force mode enabled - conflicts will be ignored');
          output.newline();
        }

        output.info(`🔄 Syncing worktree: ${name}...`);
        output.newline();

        const manager = getSyncManager(globalOptions.config);
        const result = await manager.syncWorktree(name, {
          force: options.force ?? false,
          dryRun: options.dryRun ?? false,
        });

        output.info('📊 Sync Result:');
        output.newline();

        const details = [
          `  Branch:     ${result.worktree_branch}`,
          `  Status:     ${formatSyncStatus(result.status)} ${result.status}`,
          `  Started:    ${formatDate(result.started_at)}`,
          `  Duration:   ${formatDuration(result.started_at, result.completed_at)}`,
        ];

        if (result.diff_summary) {
          details.push(`  Files:      ${result.diff_summary.files_changed} changed`);
          details.push(`  Insertions: +${result.diff_summary.insertions}`);
          details.push(`  Deletions:  -${result.diff_summary.deletions}`);
        }

        if (result.conflict_info?.has_conflicts) {
          details.push(`  Conflicts:  ${result.conflict_info.conflicted_files.length} files`);
        }

        if (result.error) {
          details.push(`  Error:      ${result.error}`);
        }

        output.list(details, '');

        if (result.conflict_info?.has_conflicts && !options.force) {
          output.newline();
          output.warning('⚠️  Conflicts detected:');
          output.list(result.conflict_info.conflicted_files, '  -');
          output.newline();
          output.info('Use --force to sync anyway, or resolve conflicts manually');
        }

        if (result.status === 'success') {
          output.newline();
          output.success(`✨ Successfully synced ${name}!`);
        } else if (result.status === 'conflict') {
          output.newline();
          output.warning('⚠️  Sync aborted due to conflicts');
          process.exit(1);
        } else if (result.status === 'failure') {
          output.newline();
          output.error('❌ Sync failed');
          process.exit(1);
        }
      } catch (error) {
        output.error(`Failed to sync worktree: ${name}`, error as Error);
        process.exit(1);
      }
    });

  command
    .command('list')
    .description('List sync history')
    .option('--since <date>', 'Show syncs since date (ISO format or relative like "2023-01-01" or "7 days ago")')
    .option('--status <status>', 'Filter by status (success, failed, conflict, pending, running, rolled_back)')
    .option('--limit <n>', 'Limit number of results', '20')
    .action(async (options) => {
      const output = createOutput(globalOptions);
      try {
        const filters: SyncFilters = {
          limit: parseInt(options.limit, 10),
        };

        if (options.since) {
          const sinceDate = new Date(options.since);
          if (isNaN(sinceDate.getTime())) {
            throw new ValidationError(`Invalid date format: ${options.since}`);
          }
          filters.since = sinceDate;
        }

        if (options.status) {
          const validStatuses = ['success', 'failure', 'conflict', 'pending', 'running', 'rolled_back'];
          if (!validStatuses.includes(options.status)) {
            throw new ValidationError(
              `Invalid status: ${options.status}. Must be one of: ${validStatuses.join(', ')}`
            );
          }
          filters.status = options.status as SyncOperation['status'];
        }

        output.info('📋 Retrieving sync history...');
        output.newline();

        const manager = getSyncManager(globalOptions.config);
        const history = await manager.getSyncHistory(filters);

        if (history.length === 0) {
          output.info('No sync operations found');
          return;
        }

        if (globalOptions.json) {
          output.json(history);
          return;
        }

        const tableData = history.map(op => ({
          'Sync ID': op.id.substring(0, 8),
          Branch: op.worktree_branch,
          Status: formatSyncStatus(op.status),
          Files: op.diff_summary?.files_changed?.toString() ?? '-',
          Started: formatDate(op.started_at),
          Duration: formatDuration(op.started_at, op.completed_at),
        }));

        output.table(tableData, ['Sync ID', 'Branch', 'Status', 'Files', 'Started', 'Duration']);
        
        output.newline();
        output.info(`Showing ${history.length} sync operation(s)`);
        output.info(`Use 'zenflow sync show <sync-id>' to see full details`);
      } catch (error) {
        output.error('Failed to list sync history', error as Error);
        process.exit(1);
      }
    });

  command
    .command('show <sync-id>')
    .description('Show details of a specific sync')
    .action(async (syncId) => {
      const output = createOutput(globalOptions);
      try {
        output.info(`📋 Retrieving sync operation: ${syncId}...`);
        output.newline();

        const manager = getSyncManager(globalOptions.config);
        const history = await manager.getSyncHistory({ limit: 1000 });
        
        const operation = history.find(op => op.id.startsWith(syncId) || op.id === syncId);
        
        if (!operation) {
          throw new ValidationError(`Sync operation not found: ${syncId}`);
        }

        if (globalOptions.json) {
          output.json(operation);
          return;
        }

        output.info('🔍 Sync Operation Details:');
        output.newline();

        const details = [
          `  ID:           ${operation.id}`,
          `  Branch:       ${operation.worktree_branch}`,
          `  Status:       ${formatSyncStatus(operation.status)} ${operation.status}`,
          `  Started:      ${formatDate(operation.started_at)}`,
        ];

        if (operation.completed_at) {
          details.push(`  Completed:    ${formatDate(operation.completed_at)}`);
          details.push(`  Duration:     ${formatDuration(operation.started_at, operation.completed_at)}`);
        }

        if (operation.commit_hash) {
          details.push(`  Commit:       ${operation.commit_hash}`);
        }

        if (operation.rollback_point) {
          details.push(`  Rollback ID:  ${operation.rollback_point}`);
        }

        output.list(details, '');

        if (operation.diff_summary) {
          output.newline();
          output.info('📊 Changes:');
          output.list([
            `  Files changed:  ${operation.diff_summary.files_changed}`,
            `  Insertions:     +${operation.diff_summary.insertions}`,
            `  Deletions:      -${operation.diff_summary.deletions}`,
          ], '');
        }

        if (operation.conflict_info?.has_conflicts) {
          output.newline();
          output.warning('⚠️  Conflicts:');
          output.list(operation.conflict_info.conflicted_files.map(f => `  ${f}`), '-');
        }

        if (operation.error) {
          output.newline();
          output.error('❌ Error:');
          output.info(`  ${operation.error}`);
        }
      } catch (error) {
        output.error(`Failed to show sync: ${syncId}`, error as Error);
        process.exit(1);
      }
    });

  command
    .command('rollback <sync-id>')
    .description('Rollback a specific sync')
    .action(async (syncId) => {
      const output = createOutput(globalOptions);
      try {
        output.info(`⏪ Rolling back sync operation: ${syncId}...`);
        output.newline();

        const manager = getSyncManager(globalOptions.config);
        const history = await manager.getSyncHistory({ limit: 1000 });
        
        const operation = history.find(op => op.id.startsWith(syncId) || op.id === syncId);
        
        if (!operation) {
          throw new ValidationError(`Sync operation not found: ${syncId}`);
        }

        if (operation.status === 'rolled_back') {
          output.warning('⚠️  This sync operation has already been rolled back');
          return;
        }

        if (!operation.rollback_point) {
          output.error('❌ No rollback point available for this sync operation');
          process.exit(1);
          return;
        }

        output.warning(`Rolling back changes from: ${operation.worktree_branch}`);
        output.newline();

        await manager.rollbackSync(operation.id);

        output.newline();
        output.success('✨ Rollback completed successfully!');
        output.info(`  Branch:  ${operation.worktree_branch}`);
        output.info(`  Sync ID: ${operation.id}`);
      } catch (error) {
        output.error(`Failed to rollback sync: ${syncId}`, error as Error);
        process.exit(1);
      }
    });

  return command;
}
