import chokidar, { FSWatcher } from 'chokidar';
import path from 'path';
import fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getLogger } from '../utils/logger';
import { getEventEmitter } from './emitter';
import type { GitClient } from '../git/client';
import type { EventDetectorConfig, CommitEvent, FileChangeEvent } from './types';

const execAsync = promisify(exec);

export class EventDetector {
  private config: EventDetectorConfig;
  private watchers: Map<string, FSWatcher>;
  private gitClient: GitClient;
  private logger = getLogger();
  private emitter = getEventEmitter();
  private debounceTimers: Map<string, NodeJS.Timeout>;
  private pendingChanges: Map<string, Set<string>>;
  private lastCommitHashes: Map<string, string>;
  private running: boolean;

  constructor(gitClient: GitClient, config: Partial<EventDetectorConfig> = {}) {
    this.gitClient = gitClient;
    this.config = {
      enabled: config.enabled ?? true,
      watchDirectories: config.watchDirectories ?? [],
      debounceMs: config.debounceMs ?? 5000,
      ignorePatterns: config.ignorePatterns ?? [
        '**/node_modules/**',
        '**/.git/**',
        '**/.next/**',
        '**/dist/**',
        '**/build/**',
        '**/.zenflow/state/**',
        '**/.zenflow/logs/**',
        '**/*.log',
        '**/.DS_Store',
        '**/coverage/**',
      ],
    };
    this.watchers = new Map();
    this.debounceTimers = new Map();
    this.pendingChanges = new Map();
    this.lastCommitHashes = new Map();
    this.running = false;

    this.logger.debug('EventDetector initialized', { config: this.config });
  }

  async start(): Promise<void> {
    if (!this.config.enabled) {
      this.logger.info('EventDetector disabled, skipping start');
      return;
    }

    if (this.running) {
      this.logger.warn('EventDetector already running');
      return;
    }

    this.running = true;
    this.logger.info('Starting EventDetector');

    const worktrees = await this.gitClient.listWorktrees();
    
    const worktreesToWatch = this.config.watchDirectories.length > 0
      ? worktrees.filter(wt => this.config.watchDirectories.includes(wt.path))
      : worktrees.filter(wt => wt.branch && !wt.branch.includes('HEAD'));

    for (const worktree of worktreesToWatch) {
      await this.watchWorktree(worktree.path, worktree.branch);
    }

    await this.initializeCommitHashes(worktreesToWatch.map(wt => ({ path: wt.path, branch: wt.branch })));

    this.logger.info('EventDetector started', {
      watchedWorktrees: worktreesToWatch.length,
    });
  }

  async stop(): Promise<void> {
    if (!this.running) {
      this.logger.warn('EventDetector not running');
      return;
    }

    this.running = false;
    this.logger.info('Stopping EventDetector');

    for (const [worktreePath, watcher] of this.watchers.entries()) {
      await watcher.close();
      this.logger.debug('Watcher closed', { worktreePath });
    }

    this.watchers.clear();

    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    this.pendingChanges.clear();

    this.logger.info('EventDetector stopped');
  }

  private async watchWorktree(worktreePath: string, branch: string): Promise<void> {
    if (this.watchers.has(worktreePath)) {
      this.logger.warn('Worktree already being watched', { worktreePath });
      return;
    }

    this.logger.debug('Starting to watch worktree', { worktreePath, branch });

    const watcher = chokidar.watch(worktreePath, {
      ignored: this.config.ignorePatterns,
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 1000,
        pollInterval: 100,
      },
      depth: 99,
    });

    watcher
      .on('add', (filePath) => this.handleFileChange(worktreePath, branch, filePath, 'created'))
      .on('change', (filePath) => this.handleFileChange(worktreePath, branch, filePath, 'modified'))
      .on('unlink', (filePath) => this.handleFileChange(worktreePath, branch, filePath, 'deleted'))
      .on('error', (error) => {
        this.logger.error('Watcher error', {
          worktreePath,
          error: error.message,
        });
      })
      .on('ready', () => {
        this.logger.info('Watcher ready', { worktreePath, branch });
      });

    this.watchers.set(worktreePath, watcher);
    this.pendingChanges.set(worktreePath, new Set());

    await this.setupCommitWatcher(worktreePath, branch);
  }

  private async setupCommitWatcher(worktreePath: string, branch: string): Promise<void> {
    const gitDir = path.join(worktreePath, '.git');
    
    try {
      const stats = await fs.stat(gitDir);
      
      const targetPath = stats.isDirectory() 
        ? path.join(gitDir, 'logs', 'HEAD')
        : gitDir;

      const commitWatcher = chokidar.watch(targetPath, {
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: {
          stabilityThreshold: 500,
          pollInterval: 100,
        },
      });

      commitWatcher.on('change', async () => {
        await this.checkForNewCommit(worktreePath, branch);
      });

      this.logger.debug('Commit watcher set up', { worktreePath, targetPath });
    } catch (error) {
      this.logger.error('Failed to set up commit watcher', {
        worktreePath,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async initializeCommitHashes(worktrees: Array<{ path: string; branch: string }>): Promise<void> {
    for (const { path: worktreePath, branch } of worktrees) {
      try {
        const commitHash = await this.getLatestCommitHash(worktreePath);
        this.lastCommitHashes.set(worktreePath, commitHash);
        this.logger.debug('Initialized commit hash', { worktreePath, branch, commitHash });
      } catch (error) {
        this.logger.error('Failed to initialize commit hash', {
          worktreePath,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  private async getLatestCommitHash(worktreePath: string): Promise<string> {
    try {
      const { stdout } = await execAsync('git rev-parse HEAD', {
        cwd: worktreePath,
      });
      return stdout.trim();
    } catch (error) {
      this.logger.error('Failed to get latest commit hash', {
        worktreePath,
        error: error instanceof Error ? error.message : String(error),
      });
      return '';
    }
  }

  private async checkForNewCommit(worktreePath: string, branch: string): Promise<void> {
    try {
      const currentHash = await this.getLatestCommitHash(worktreePath);
      const lastHash = this.lastCommitHashes.get(worktreePath);

      if (currentHash && currentHash !== lastHash) {
        this.lastCommitHashes.set(worktreePath, currentHash);
        
        const commitInfo = await this.getCommitInfo(worktreePath, currentHash);
        
        this.logger.info('New commit detected', {
          worktreePath,
          branch,
          commitHash: currentHash,
        });

        this.emitter.emit({
          type: 'commit',
          source: 'git-watcher',
          worktree: worktreePath,
          branch,
          commit_hash: currentHash,
          commit_message: commitInfo.message,
          author: commitInfo.author,
        });

        this.pendingChanges.get(worktreePath)?.clear();
        const existingTimer = this.debounceTimers.get(worktreePath);
        if (existingTimer) {
          clearTimeout(existingTimer);
          this.debounceTimers.delete(worktreePath);
        }
      }
    } catch (error) {
      this.logger.error('Error checking for new commit', {
        worktreePath,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async getCommitInfo(worktreePath: string, commitHash: string): Promise<{ message: string; author: string }> {
    try {
      const { stdout: message } = await execAsync('git log -1 --pretty=%B', {
        cwd: worktreePath,
      });
      
      const { stdout: author } = await execAsync('git log -1 --pretty=%an', {
        cwd: worktreePath,
      });

      return {
        message: message.trim(),
        author: author.trim(),
      };
    } catch (error) {
      this.logger.error('Failed to get commit info', {
        commitHash,
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        message: '',
        author: '',
      };
    }
  }

  private handleFileChange(
    worktreePath: string,
    branch: string,
    filePath: string,
    changeType: 'created' | 'modified' | 'deleted'
  ): void {
    const relativePath = path.relative(worktreePath, filePath);
    
    this.logger.debug('File change detected', {
      worktreePath,
      branch,
      file: relativePath,
      changeType,
    });

    const changes = this.pendingChanges.get(worktreePath);
    if (changes) {
      changes.add(relativePath);
    }

    const existingTimer = this.debounceTimers.get(worktreePath);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      this.emitFileChangeEvent(worktreePath, branch, changeType);
    }, this.config.debounceMs);

    this.debounceTimers.set(worktreePath, timer);
  }

  private emitFileChangeEvent(
    worktreePath: string,
    branch: string,
    changeType: 'created' | 'modified' | 'deleted'
  ): void {
    const changes = this.pendingChanges.get(worktreePath);
    if (!changes || changes.size === 0) {
      return;
    }

    const files_changed = Array.from(changes);
    
    this.logger.info('Emitting file change event', {
      worktreePath,
      branch,
      changeType,
      fileCount: files_changed.length,
    });

    this.emitter.emit({
      type: 'file_change',
      source: 'file-watcher',
      worktree: worktreePath,
      branch,
      files_changed,
      change_type: changeType,
    });

    changes.clear();
    this.debounceTimers.delete(worktreePath);
  }

  async addWorktree(worktreePath: string, branch: string): Promise<void> {
    if (!this.running) {
      this.logger.warn('Cannot add worktree, EventDetector not running');
      return;
    }

    await this.watchWorktree(worktreePath, branch);
    
    const commitHash = await this.getLatestCommitHash(worktreePath);
    this.lastCommitHashes.set(worktreePath, commitHash);
    
    this.logger.info('Worktree added to watcher', { worktreePath, branch });
  }

  async removeWorktree(worktreePath: string): Promise<void> {
    const watcher = this.watchers.get(worktreePath);
    if (watcher) {
      await watcher.close();
      this.watchers.delete(worktreePath);
      this.pendingChanges.delete(worktreePath);
      this.lastCommitHashes.delete(worktreePath);
      
      const timer = this.debounceTimers.get(worktreePath);
      if (timer) {
        clearTimeout(timer);
        this.debounceTimers.delete(worktreePath);
      }

      this.logger.info('Worktree removed from watcher', { worktreePath });
    }
  }

  isRunning(): boolean {
    return this.running;
  }

  getWatchedWorktrees(): string[] {
    return Array.from(this.watchers.keys());
  }
}
