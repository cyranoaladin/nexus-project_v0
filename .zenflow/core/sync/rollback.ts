import { GitClient } from '../git/client';
import { getLogger } from '../utils/logger';
import { RollbackError, GitOperationError } from '../utils/errors';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { BackupInfo } from './merger';

const execAsync = promisify(exec);

export interface RollbackOptions {
  force?: boolean;
  preserveChanges?: boolean;
}

export interface RollbackResult {
  success: boolean;
  previousCommit: string;
  restoredStash?: string;
  error?: string;
}

export class RollbackManager {
  private gitClient: GitClient;
  private logger = getLogger();
  private repoPath: string;

  constructor(repoPath: string) {
    this.repoPath = repoPath;
    this.gitClient = new GitClient(repoPath);
  }

  async rollback(
    backup: BackupInfo,
    options: RollbackOptions = {}
  ): Promise<RollbackResult> {
    this.logger.info('Starting rollback operation', {
      commitHash: backup.commitHash,
      stashId: backup.stashId,
      branch: backup.branch,
      options,
    });

    try {
      const currentCommit = await this.getCurrentCommitHash();
      
      if (currentCommit === backup.commitHash) {
        this.logger.warn('Already at target commit, no rollback needed', {
          commitHash: backup.commitHash,
        });
        return {
          success: true,
          previousCommit: currentCommit,
        };
      }

      const hasUncommittedChanges = await this.hasUncommittedChanges();
      
      if (hasUncommittedChanges && !options.force) {
        const errorMessage = 'Uncommitted changes detected. Use force option to rollback anyway.';
        this.logger.error(errorMessage);
        throw new RollbackError(errorMessage, backup.commitHash);
      }

      await this.resetToCommit(backup.commitHash, options.force);
      
      this.logger.info('Reset to previous commit successful', {
        targetCommit: backup.commitHash,
        previousCommit: currentCommit,
      });

      let restoredStash: string | undefined;
      
      if (backup.stashId) {
        try {
          await this.gitClient.applyStash(backup.stashId);
          restoredStash = backup.stashId;
          
          this.logger.info('Stash restored successfully', {
            stashId: backup.stashId,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.warn('Failed to restore stash, but commit rollback succeeded', {
            stashId: backup.stashId,
            error: message,
          });
        }
      }

      const result: RollbackResult = {
        success: true,
        previousCommit: currentCommit,
        restoredStash,
      };

      this.logger.info('Rollback completed successfully', result);

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.logger.error('Rollback operation failed', {
        backup,
        error: errorMessage,
      });

      if (error instanceof RollbackError) {
        throw error;
      }

      throw new RollbackError(
        `Failed to rollback to commit ${backup.commitHash}: ${errorMessage}`,
        backup.commitHash
      );
    }
  }

  async rollbackBySteps(steps: number, options: RollbackOptions = {}): Promise<RollbackResult> {
    this.logger.info('Starting rollback by steps', { steps, options });

    try {
      const currentCommit = await this.getCurrentCommitHash();
      
      const targetCommit = await this.getCommitBySteps(steps);
      
      const hasUncommittedChanges = await this.hasUncommittedChanges();
      
      if (hasUncommittedChanges && !options.force) {
        const errorMessage = 'Uncommitted changes detected. Use force option to rollback anyway.';
        this.logger.error(errorMessage);
        throw new RollbackError(errorMessage, targetCommit);
      }

      await this.resetToCommit(targetCommit, options.force);
      
      this.logger.info('Rollback by steps completed successfully', {
        steps,
        targetCommit,
        previousCommit: currentCommit,
      });

      return {
        success: true,
        previousCommit: currentCommit,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.logger.error('Rollback by steps failed', {
        steps,
        error: errorMessage,
      });

      throw new RollbackError(
        `Failed to rollback ${steps} steps: ${errorMessage}`,
        undefined
      );
    }
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

  private async hasUncommittedChanges(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('git status --porcelain', { cwd: this.repoPath });
      return stdout.trim() !== '';
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new GitOperationError(
        `Failed to check for uncommitted changes: ${message}`,
        'git status --porcelain'
      );
    }
  }

  private async resetToCommit(commitHash: string, force: boolean = false): Promise<void> {
    try {
      const resetMode = force ? '--hard' : '--mixed';
      
      this.logger.debug('Resetting to commit', {
        commitHash,
        mode: resetMode,
      });

      await execAsync(`git reset ${resetMode} ${commitHash}`, { cwd: this.repoPath });
      
      this.logger.info('Reset to commit successful', {
        commitHash,
        mode: resetMode,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new GitOperationError(
        `Failed to reset to commit ${commitHash}: ${message}`,
        'git reset'
      );
    }
  }

  private async getCommitBySteps(steps: number): Promise<string> {
    try {
      const { stdout } = await execAsync(
        `git rev-parse HEAD~${steps}`,
        { cwd: this.repoPath }
      );
      return stdout.trim();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new GitOperationError(
        `Failed to get commit ${steps} steps back: ${message}`,
        'git rev-parse'
      );
    }
  }

  async verifyRollbackPossible(backup: BackupInfo): Promise<{ possible: boolean; reason?: string }> {
    try {
      const { stdout } = await execAsync(
        `git rev-parse ${backup.commitHash}`,
        { cwd: this.repoPath }
      );
      
      if (!stdout.trim()) {
        return {
          possible: false,
          reason: `Commit ${backup.commitHash} not found in repository`,
        };
      }

      const hasUncommittedChanges = await this.hasUncommittedChanges();
      
      if (hasUncommittedChanges) {
        return {
          possible: false,
          reason: 'Repository has uncommitted changes. Commit or stash them first.',
        };
      }

      return { possible: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        possible: false,
        reason: `Cannot verify rollback: ${message}`,
      };
    }
  }
}
