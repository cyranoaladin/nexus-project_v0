import { GitClient } from '../git/client';
import { SyncAnalyzer } from './analyzer';
import { ConflictDetector } from './conflicts';
import { SafeMerger } from './merger';
import { SyncValidator } from './validator';
import { RollbackManager } from './rollback';
import { getLogger } from '../utils/logger';
import { SyncOperationError, ValidationError } from '../utils/errors';
import type {
  SyncOperation,
  SyncOptions,
  SyncFilters,
  SyncConfig,
  ValidationResult,
} from './types';
import type { DiffSummary, ConflictInfo, Worktree } from '../git/types';
import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs';
import path from 'path';

export class SyncManager {
  private gitClient: GitClient;
  private analyzer: SyncAnalyzer;
  private conflictDetector: ConflictDetector;
  private merger: SafeMerger;
  private validator: SyncValidator;
  private rollbackManager: RollbackManager;
  private logger = getLogger();
  private repoPath: string;
  private config: SyncConfig;
  private statePath: string;

  constructor(repoPath: string, config: SyncConfig) {
    this.repoPath = repoPath;
    this.config = config;
    this.statePath = path.join(repoPath, '.zenflow', 'state', 'sync');
    
    this.gitClient = new GitClient(repoPath);
    this.analyzer = new SyncAnalyzer(repoPath);
    this.conflictDetector = new ConflictDetector(repoPath);
    this.merger = new SafeMerger(repoPath);
    this.validator = new SyncValidator(repoPath);
    this.rollbackManager = new RollbackManager(repoPath);
  }

  async syncWorktree(branch: string, options: SyncOptions = {}): Promise<SyncOperation> {
    const mergedOptions: SyncOptions = {
      force: options.force ?? false,
      dryRun: options.dryRun ?? false,
      autoPush: options.autoPush ?? this.config.autoPush,
      verificationCommands: options.verificationCommands ?? this.config.verificationCommands,
      conflictStrategy: options.conflictStrategy ?? this.config.conflictStrategy,
    };

    this.logger.info('Starting worktree sync', {
      branch,
      options: mergedOptions,
    });

    const syncId = uuidv4();
    const startedAt = new Date();

    let syncOperation: SyncOperation = {
      id: syncId,
      worktree_branch: branch,
      commit_hash: '',
      status: 'pending',
      started_at: startedAt,
    };

    try {
      await this.ensureStatePath();

      if (this.isExcluded(branch)) {
        const errorMessage = `Worktree branch ${branch} is in excluded list`;
        syncOperation.status = 'failure';
        syncOperation.error = errorMessage;
        syncOperation.completed_at = new Date();
        await this.saveSyncOperation(syncOperation);
        
        this.logger.warn(errorMessage, { branch });
        throw new ValidationError(errorMessage);
      }

      syncOperation.status = 'running';
      await this.saveSyncOperation(syncOperation);

      const validationResult = await this.validateSync(branch);
      if (!validationResult.valid) {
        syncOperation.status = 'failure';
        syncOperation.error = `Validation failed: ${validationResult.errors.join(', ')}`;
        syncOperation.completed_at = new Date();
        await this.saveSyncOperation(syncOperation);
        
        this.logger.error('Sync validation failed', {
          branch,
          errors: validationResult.errors,
        });
        
        throw new ValidationError(`Sync validation failed: ${validationResult.errors.join(', ')}`);
      }

      const diffSummary = await this.analyzeDiff(branch);
      syncOperation.diff_summary = diffSummary;
      await this.saveSyncOperation(syncOperation);

      if (diffSummary.files_changed === 0) {
        syncOperation.status = 'success';
        syncOperation.completed_at = new Date();
        await this.saveSyncOperation(syncOperation);
        
        this.logger.info('No changes to sync', { branch });
        return syncOperation;
      }

      const conflictInfo = await this.checkConflicts(branch);
      syncOperation.conflict_info = conflictInfo;
      await this.saveSyncOperation(syncOperation);

      if (conflictInfo.has_conflicts && !mergedOptions.force) {
        syncOperation.status = 'conflict';
        syncOperation.completed_at = new Date();
        await this.saveSyncOperation(syncOperation);
        
        this.logger.warn('Conflicts detected, aborting sync', {
          branch,
          conflictedFiles: conflictInfo.conflicted_files,
        });
        
        return syncOperation;
      }

      if (mergedOptions.dryRun) {
        syncOperation.status = 'success';
        syncOperation.completed_at = new Date();
        await this.saveSyncOperation(syncOperation);
        
        this.logger.info('Dry run complete', {
          branch,
          filesChanged: diffSummary.files_changed,
        });
        
        return syncOperation;
      }

      const mergeResult = await this.merger.mergeWorktree(branch, {
        force: mergedOptions.force,
        dryRun: false,
        autoPush: mergedOptions.autoPush,
        verificationCommands: mergedOptions.verificationCommands,
      });

      syncOperation = {
        ...mergeResult.syncOperation,
        diff_summary: diffSummary,
        conflict_info: conflictInfo,
      };
      await this.saveSyncOperation(syncOperation);

      if (!mergeResult.success) {
        this.logger.error('Merge operation failed', {
          branch,
          syncId,
          error: syncOperation.error,
        });
        
        return syncOperation;
      }

      if (mergedOptions.autoPush && syncOperation.status === 'success') {
        try {
          await this.gitClient.push('origin', 'main');
          this.logger.info('Changes pushed to remote', { branch, syncId });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.warn('Failed to push changes to remote', {
            branch,
            syncId,
            error: message,
          });
          syncOperation.error = `Merge succeeded but push failed: ${message}`;
          await this.saveSyncOperation(syncOperation);
        }
      }

      if (mergedOptions.verificationCommands && mergedOptions.verificationCommands.length > 0) {
        await this.runVerificationCommands(mergedOptions.verificationCommands, syncOperation);
      }

      this.logger.info('Sync completed successfully', {
        branch,
        syncId,
        filesChanged: diffSummary.files_changed,
      });

      return syncOperation;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      syncOperation.status = 'failure';
      syncOperation.error = errorMessage;
      syncOperation.completed_at = new Date();
      await this.saveSyncOperation(syncOperation);
      
      this.logger.error('Sync operation failed', {
        branch,
        syncId,
        error: errorMessage,
      });
      
      throw new SyncOperationError(
        `Failed to sync worktree ${branch}: ${errorMessage}`,
        branch,
        syncId
      );
    }
  }

  async syncAllWorktrees(options: SyncOptions = {}): Promise<SyncOperation[]> {
    this.logger.info('Starting batch sync for all worktrees', { options });

    try {
      const worktrees = await this.analyzer.listAllWorktrees();
      
      const syncableWorktrees = worktrees.filter(
        wt => wt.branch !== 'main' && !this.isExcluded(wt.branch)
      );

      if (syncableWorktrees.length === 0) {
        this.logger.info('No syncable worktrees found');
        return [];
      }

      this.logger.info('Found syncable worktrees', {
        count: syncableWorktrees.length,
        branches: syncableWorktrees.map(wt => wt.branch),
      });

      const results: SyncOperation[] = [];

      for (const worktree of syncableWorktrees) {
        try {
          this.logger.info('Syncing worktree', { branch: worktree.branch });
          
          const result = await this.syncWorktree(worktree.branch, options);
          results.push(result);
          
          this.logger.info('Worktree sync result', {
            branch: worktree.branch,
            status: result.status,
            filesChanged: result.diff_summary?.files_changed ?? 0,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.error('Failed to sync worktree', {
            branch: worktree.branch,
            error: message,
          });
          
          results.push({
            id: uuidv4(),
            worktree_branch: worktree.branch,
            commit_hash: worktree.commit,
            status: 'failure',
            started_at: new Date(),
            completed_at: new Date(),
            error: message,
          });
        }
      }

      const successCount = results.filter(r => r.status === 'success').length;
      const failureCount = results.filter(r => r.status === 'failure').length;
      const conflictCount = results.filter(r => r.status === 'conflict').length;

      this.logger.info('Batch sync completed', {
        total: results.length,
        success: successCount,
        failure: failureCount,
        conflict: conflictCount,
      });

      return results;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Batch sync failed', { error: message });
      throw error;
    }
  }

  async analyzeDiff(branch: string): Promise<DiffSummary> {
    try {
      this.logger.debug('Analyzing diff for worktree', { branch });
      const diff = await this.analyzer.analyzeDiff(branch, 'main');
      return diff;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to analyze diff', { branch, error: message });
      throw error;
    }
  }

  async checkConflicts(branch: string): Promise<ConflictInfo> {
    try {
      this.logger.debug('Checking conflicts for worktree', { branch });
      
      const report = await this.conflictDetector.detectConflicts('main', branch);
      
      this.logger.debug('Conflict check complete', {
        branch,
        hasConflicts: report.conflictInfo.has_conflicts,
        riskLevel: report.riskLevel,
      });
      
      return report.conflictInfo;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to check conflicts', { branch, error: message });
      throw error;
    }
  }

  async validateSync(branch: string): Promise<ValidationResult> {
    try {
      this.logger.debug('Validating sync for worktree', { branch });
      const result = await this.validator.validateSync(branch);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to validate sync', { branch, error: message });
      throw error;
    }
  }

  async rollbackSync(syncId: string): Promise<void> {
    try {
      this.logger.info('Starting rollback for sync operation', { syncId });
      
      const syncOperation = await this.loadSyncOperation(syncId);
      
      if (!syncOperation) {
        throw new ValidationError(`Sync operation ${syncId} not found`);
      }

      if (!syncOperation.rollback_point) {
        throw new ValidationError(`Sync operation ${syncId} has no rollback point`);
      }

      if (syncOperation.status === 'rolled_back') {
        this.logger.warn('Sync operation already rolled back', { syncId });
        return;
      }

      const backup = {
        stashId: syncOperation.rollback_point,
        commitHash: syncOperation.commit_hash,
        timestamp: syncOperation.started_at,
        branch: syncOperation.worktree_branch,
      };

      await this.rollbackManager.rollback(backup);

      syncOperation.status = 'rolled_back';
      syncOperation.completed_at = new Date();
      await this.saveSyncOperation(syncOperation);
      
      this.logger.info('Rollback completed successfully', { syncId });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Rollback failed', { syncId, error: message });
      throw error;
    }
  }

  async getSyncHistory(filters?: SyncFilters): Promise<SyncOperation[]> {
    try {
      this.logger.debug('Retrieving sync history', { filters });
      
      const files = await this.listSyncOperationFiles();
      const operations: SyncOperation[] = [];

      for (const file of files) {
        const operation = await this.loadSyncOperationFromFile(file);
        if (operation && this.matchesFilters(operation, filters)) {
          operations.push(operation);
        }
      }

      operations.sort((a, b) => b.started_at.getTime() - a.started_at.getTime());

      if (filters?.limit) {
        return operations.slice(0, filters.limit);
      }

      return operations;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to retrieve sync history', { error: message });
      throw error;
    }
  }

  private isExcluded(branch: string): boolean {
    return this.config.excludedWorktrees.includes(branch);
  }

  private async ensureStatePath(): Promise<void> {
    try {
      await fs.mkdir(this.statePath, { recursive: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to create state directory', {
        path: this.statePath,
        error: message,
      });
      throw error;
    }
  }

  private async saveSyncOperation(operation: SyncOperation): Promise<void> {
    try {
      const filename = `${operation.id}.json`;
      const filepath = path.join(this.statePath, filename);
      
      const data = JSON.stringify(operation, null, 2);
      await fs.writeFile(filepath, data, 'utf-8');
      
      this.logger.debug('Sync operation saved', {
        id: operation.id,
        filepath,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to save sync operation', {
        id: operation.id,
        error: message,
      });
    }
  }

  private async loadSyncOperation(syncId: string): Promise<SyncOperation | null> {
    try {
      const filename = `${syncId}.json`;
      const filepath = path.join(this.statePath, filename);
      
      const data = await fs.readFile(filepath, 'utf-8');
      const operation = JSON.parse(data);
      
      operation.started_at = new Date(operation.started_at);
      if (operation.completed_at) {
        operation.completed_at = new Date(operation.completed_at);
      }
      
      return operation;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn('Failed to load sync operation', {
        syncId,
        error: message,
      });
      return null;
    }
  }

  private async listSyncOperationFiles(): Promise<string[]> {
    try {
      await this.ensureStatePath();
      const files = await fs.readdir(this.statePath);
      return files
        .filter(f => f.endsWith('.json'))
        .map(f => path.join(this.statePath, f));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to list sync operation files', { error: message });
      return [];
    }
  }

  private async loadSyncOperationFromFile(filepath: string): Promise<SyncOperation | null> {
    try {
      const data = await fs.readFile(filepath, 'utf-8');
      const operation = JSON.parse(data);
      
      operation.started_at = new Date(operation.started_at);
      if (operation.completed_at) {
        operation.completed_at = new Date(operation.completed_at);
      }
      
      return operation;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn('Failed to load sync operation from file', {
        filepath,
        error: message,
      });
      return null;
    }
  }

  private matchesFilters(operation: SyncOperation, filters?: SyncFilters): boolean {
    if (!filters) {
      return true;
    }

    if (filters.since && operation.started_at < filters.since) {
      return false;
    }

    if (filters.status && operation.status !== filters.status) {
      return false;
    }

    if (filters.worktreeBranch && operation.worktree_branch !== filters.worktreeBranch) {
      return false;
    }

    return true;
  }

  private async runVerificationCommands(
    commands: string[],
    syncOperation: SyncOperation
  ): Promise<void> {
    this.logger.info('Running verification commands', {
      syncId: syncOperation.id,
      commandCount: commands.length,
    });

    for (const command of commands) {
      try {
        this.logger.debug('Running verification command', {
          syncId: syncOperation.id,
          command,
        });
        
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);
        
        await execAsync(command, { cwd: this.repoPath });
        
        this.logger.info('Verification command succeeded', {
          syncId: syncOperation.id,
          command,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error('Verification command failed', {
          syncId: syncOperation.id,
          command,
          error: message,
        });
        
        syncOperation.status = 'failure';
        syncOperation.error = `Verification command failed: ${command}: ${message}`;
        await this.saveSyncOperation(syncOperation);
        
        throw new SyncOperationError(
          `Verification command failed: ${command}: ${message}`,
          syncOperation.worktree_branch,
          syncOperation.id
        );
      }
    }
  }
}
