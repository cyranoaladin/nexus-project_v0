import { GitClient } from '../git/client';
import { getLogger } from '../utils/logger';
import { SyncOperationError, RollbackError, GitOperationError } from '../utils/errors';
import type { MergeResult, ConflictInfo } from '../git/types';
import type { SyncOperation } from './types';
import { v4 as uuidv4 } from 'uuid';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface MergeOptions {
  force?: boolean;
  dryRun?: boolean;
  autoPush?: boolean;
  verificationCommands?: string[];
}

export interface BackupInfo {
  stashId: string;
  commitHash: string;
  timestamp: Date;
  branch: string;
}

export class SafeMerger {
  private gitClient: GitClient;
  private logger = getLogger();
  private repoPath: string;

  constructor(repoPath: string) {
    this.repoPath = repoPath;
    this.gitClient = new GitClient(repoPath);
  }

  async mergeWorktree(
    branch: string,
    options: MergeOptions = {}
  ): Promise<{ success: boolean; syncOperation: SyncOperation; backup?: BackupInfo }> {
    const syncId = uuidv4();
    const startedAt = new Date();
    
    this.logger.info('Starting safe merge operation', {
      syncId,
      branch,
      options,
    });

    const syncOperation: SyncOperation = {
      id: syncId,
      worktree_branch: branch,
      commit_hash: '',
      status: 'running',
      started_at: startedAt,
    };

    try {
      if (options.dryRun) {
        this.logger.info('Dry run mode: checking for conflicts only', { syncId, branch });
        const conflicts = await this.gitClient.checkConflicts('HEAD', branch);
        
        syncOperation.conflict_info = conflicts;
        
        if (conflicts.has_conflicts) {
          syncOperation.status = 'conflict';
          this.logger.warn('Dry run: conflicts detected', {
            syncId,
            branch,
            conflictedFiles: conflicts.conflicted_files,
          });
          return { success: false, syncOperation };
        }

        syncOperation.status = 'success';
        this.logger.info('Dry run: no conflicts detected', { syncId, branch });
        return { success: true, syncOperation };
      }

      const currentCommitHash = await this.getCurrentCommitHash();
      syncOperation.commit_hash = currentCommitHash;

      const backup = await this.createBackup(branch, currentCommitHash);
      syncOperation.rollback_point = backup.stashId;
      
      this.logger.info('Backup created successfully', {
        syncId,
        branch,
        stashId: backup.stashId,
        commitHash: backup.commitHash,
      });

      const conflicts = await this.gitClient.checkConflicts('HEAD', branch);
      syncOperation.conflict_info = conflicts;

      if (conflicts.has_conflicts && !options.force) {
        syncOperation.status = 'conflict';
        syncOperation.completed_at = new Date();
        
        this.logger.warn('Merge aborted: conflicts detected', {
          syncId,
          branch,
          conflictedFiles: conflicts.conflicted_files,
        });

        return { success: false, syncOperation, backup };
      }

      const commitMessage = this.generateCommitMessage(branch);
      const mergeResult = await this.gitClient.merge(branch, commitMessage);
      syncOperation.merge_result = mergeResult;

      if (!mergeResult.success) {
        syncOperation.status = 'failure';
        syncOperation.error = mergeResult.error;
        syncOperation.completed_at = new Date();
        
        this.logger.error('Merge operation failed', {
          syncId,
          branch,
          error: mergeResult.error,
        });

        return { success: false, syncOperation, backup };
      }

      const isClean = await this.validateMergeSuccess();
      
      if (!isClean) {
        syncOperation.status = 'failure';
        syncOperation.error = 'Repository is not clean after merge';
        syncOperation.completed_at = new Date();
        
        this.logger.error('Merge validation failed: repository not clean', {
          syncId,
          branch,
        });

        return { success: false, syncOperation, backup };
      }

      syncOperation.status = 'success';
      syncOperation.completed_at = new Date();
      
      this.logger.info('Merge operation completed successfully', {
        syncId,
        branch,
        commitHash: mergeResult.commit_hash,
      });

      return { success: true, syncOperation, backup };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      syncOperation.status = 'failure';
      syncOperation.error = errorMessage;
      syncOperation.completed_at = new Date();
      
      this.logger.error('Merge operation failed with exception', {
        syncId,
        branch,
        error: errorMessage,
      });

      throw new SyncOperationError(
        `Failed to merge worktree ${branch}: ${errorMessage}`,
        branch,
        syncId
      );
    }
  }

  private async createBackup(branch: string, commitHash: string): Promise<BackupInfo> {
    try {
      this.logger.debug('Creating backup before merge', { branch, commitHash });
      
      const timestamp = new Date();
      const backupMessage = `zenflow-backup: before merge ${branch} at ${timestamp.toISOString()}`;
      
      const stashId = await this.gitClient.createStash(backupMessage);
      
      const backup: BackupInfo = {
        stashId,
        commitHash,
        timestamp,
        branch,
      };

      this.logger.info('Backup created', {
        branch,
        stashId,
        commitHash,
      });

      return backup;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to create backup', { branch, error: message });
      throw new SyncOperationError(
        `Failed to create backup before merge: ${message}`,
        branch
      );
    }
  }

  private generateCommitMessage(branch: string): string {
    const description = `sync from ${branch}`;
    return `chore: merge ${branch} - ${description}`;
  }

  private async getCurrentCommitHash(): Promise<string> {
    try {
      const { stdout } = await execAsync('git rev-parse HEAD', { cwd: this.repoPath });
      return stdout.trim();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new GitOperationError(
        `Failed to get current commit hash: ${message}`,
        'git rev-parse HEAD'
      );
    }
  }

  private async validateMergeSuccess(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('git status --porcelain', { cwd: this.repoPath });
      const isClean = stdout.trim() === '';
      
      this.logger.debug('Merge validation result', { isClean });
      
      return isClean;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to validate merge', { error: message });
      return false;
    }
  }
}
