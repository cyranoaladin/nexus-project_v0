import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { GitClient } from '../../core/git/client';
import { SyncManager } from '../../core/sync/manager';
import type { SyncConfig } from '../../core/sync/types';

const execAsync = promisify(exec);

jest.mock('../../core/utils/logger', () => ({
  getLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

describe('Git Client + Sync Manager Integration', () => {
  let tempDir: string;
  let repoPath: string;
  let gitClient: GitClient;
  let syncManager: SyncManager;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zenflow-git-integration-'));
    repoPath = path.join(tempDir, 'repo');

    await fs.mkdir(repoPath, { recursive: true });
    await execAsync('git init', { cwd: repoPath });
    await execAsync('git config user.email "test@example.com"', { cwd: repoPath });
    await execAsync('git config user.name "Test User"', { cwd: repoPath });
    
    await fs.writeFile(path.join(repoPath, 'README.md'), '# Test Repo\n', 'utf-8');
    await execAsync('git add .', { cwd: repoPath });
    await execAsync('git commit -m "Initial commit"', { cwd: repoPath });

    await fs.mkdir(path.join(repoPath, '.zenflow', 'state', 'sync'), { recursive: true });

    gitClient = new GitClient(repoPath);

    const syncConfig: SyncConfig = {
      enabled: true,
      autoPush: false,
      maxRetries: 3,
      timeout: 30000,
      conflictStrategy: 'abort',
      excludedWorktrees: [],
      notificationChannels: ['console'],
      verificationCommands: [],
    };

    syncManager = new SyncManager(repoPath, syncConfig);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Worktree operations with sync', () => {
    it('should list worktrees using GitClient', async () => {
      const worktrees = await gitClient.listWorktrees();
      
      expect(worktrees).toHaveLength(1);
      expect(worktrees[0].path).toBe(repoPath);
      expect(worktrees[0].branch).toContain('main');
    });

    it('should detect no changes when worktree has no modifications', async () => {
      await execAsync('git checkout -b feature-branch', { cwd: repoPath });
      await execAsync('git checkout main', { cwd: repoPath });

      const diff = await gitClient.diff('feature-branch', 'main');
      
      expect(diff.files_changed).toBe(0);
      expect(diff.insertions).toBe(0);
      expect(diff.deletions).toBe(0);
    });

    it('should detect changes between branches', async () => {
      await execAsync('git checkout -b feature-branch', { cwd: repoPath });
      await fs.writeFile(path.join(repoPath, 'test.txt'), 'Test content\n', 'utf-8');
      await execAsync('git add test.txt', { cwd: repoPath });
      await execAsync('git commit -m "Add test file"', { cwd: repoPath });
      await execAsync('git checkout main', { cwd: repoPath });

      const diff = await gitClient.diff('main', 'feature-branch');
      
      expect(diff.files_changed).toBeGreaterThan(0);
      expect(diff.insertions).toBeGreaterThan(0);
    });
  });

  describe('Sync Manager with Git Client', () => {
    it('should validate sync prerequisites', async () => {
      await execAsync('git checkout -b feature-branch', { cwd: repoPath });
      await execAsync('git checkout main', { cwd: repoPath });

      const validation = await syncManager.validateSync('feature-branch');
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toBeUndefined();
    });

    it('should analyze diff through sync manager', async () => {
      await execAsync('git checkout -b feature-branch', { cwd: repoPath });
      await fs.writeFile(path.join(repoPath, 'feature.txt'), 'Feature content\n', 'utf-8');
      await execAsync('git add feature.txt', { cwd: repoPath });
      await execAsync('git commit -m "Add feature"', { cwd: repoPath });
      await execAsync('git checkout main', { cwd: repoPath });

      const diff = await syncManager.analyzeDiff('feature-branch');
      
      expect(diff.files_changed).toBeGreaterThan(0);
      expect(diff.files).toHaveLength(1);
      expect(diff.files[0].path).toBe('feature.txt');
      expect(diff.files[0].status).toBe('added');
    });

    it('should check for conflicts', async () => {
      await execAsync('git checkout -b feature-branch', { cwd: repoPath });
      await fs.writeFile(path.join(repoPath, 'shared.txt'), 'Feature version\n', 'utf-8');
      await execAsync('git add shared.txt', { cwd: repoPath });
      await execAsync('git commit -m "Add from feature"', { cwd: repoPath });
      
      await execAsync('git checkout main', { cwd: repoPath });
      await fs.writeFile(path.join(repoPath, 'shared.txt'), 'Main version\n', 'utf-8');
      await execAsync('git add shared.txt', { cwd: repoPath });
      await execAsync('git commit -m "Add from main"', { cwd: repoPath });

      const conflicts = await syncManager.checkConflicts('feature-branch');
      
      expect(conflicts.has_conflicts).toBe(true);
      expect(conflicts.conflicted_files.length).toBeGreaterThan(0);
    });

    it('should detect no conflicts when files do not overlap', async () => {
      await execAsync('git checkout -b feature-branch', { cwd: repoPath });
      await fs.writeFile(path.join(repoPath, 'feature-file.txt'), 'Feature content\n', 'utf-8');
      await execAsync('git add feature-file.txt', { cwd: repoPath });
      await execAsync('git commit -m "Add feature file"', { cwd: repoPath });
      
      await execAsync('git checkout main', { cwd: repoPath });
      await fs.writeFile(path.join(repoPath, 'main-file.txt'), 'Main content\n', 'utf-8');
      await execAsync('git add main-file.txt', { cwd: repoPath });
      await execAsync('git commit -m "Add main file"', { cwd: repoPath });

      const conflicts = await syncManager.checkConflicts('feature-branch');
      
      expect(conflicts.has_conflicts).toBe(false);
      expect(conflicts.conflicted_files).toHaveLength(0);
    });
  });

  describe('Complete sync flow', () => {
    it('should complete sync flow without conflicts', async () => {
      await execAsync('git checkout -b feature-no-conflict', { cwd: repoPath });
      await fs.writeFile(path.join(repoPath, 'new-feature.txt'), 'New feature\n', 'utf-8');
      await execAsync('git add new-feature.txt', { cwd: repoPath });
      await execAsync('git commit -m "Add new feature"', { cwd: repoPath });
      await execAsync('git checkout main', { cwd: repoPath });

      const syncOperation = await syncManager.syncWorktree('feature-no-conflict', {
        dryRun: false,
        force: false,
        autoPush: false,
      });

      expect(syncOperation.status).toBe('success');
      expect(syncOperation.worktree_branch).toBe('feature-no-conflict');
      expect(syncOperation.diff_summary).toBeDefined();
      expect(syncOperation.diff_summary?.files_changed).toBeGreaterThan(0);

      const fileExists = await fs
        .access(path.join(repoPath, 'new-feature.txt'))
        .then(() => true)
        .catch(() => false);
      expect(fileExists).toBe(true);
    });

    it('should abort sync when conflicts are detected', async () => {
      await execAsync('git checkout -b feature-conflict', { cwd: repoPath });
      await fs.writeFile(path.join(repoPath, 'conflict.txt'), 'Feature version\n', 'utf-8');
      await execAsync('git add conflict.txt', { cwd: repoPath });
      await execAsync('git commit -m "Feature change"', { cwd: repoPath });
      
      await execAsync('git checkout main', { cwd: repoPath });
      await fs.writeFile(path.join(repoPath, 'conflict.txt'), 'Main version\n', 'utf-8');
      await execAsync('git add conflict.txt', { cwd: repoPath });
      await execAsync('git commit -m "Main change"', { cwd: repoPath });

      const syncOperation = await syncManager.syncWorktree('feature-conflict', {
        dryRun: false,
        force: false,
        autoPush: false,
      });

      expect(syncOperation.status).toBe('conflict');
      expect(syncOperation.conflict_info?.has_conflicts).toBe(true);
    });

    it('should skip sync when no changes exist', async () => {
      await execAsync('git checkout -b feature-no-changes', { cwd: repoPath });
      await execAsync('git checkout main', { cwd: repoPath });

      const syncOperation = await syncManager.syncWorktree('feature-no-changes', {
        dryRun: false,
        force: false,
        autoPush: false,
      });

      expect(syncOperation.status).toBe('success');
      expect(syncOperation.diff_summary?.files_changed).toBe(0);
    });

    it('should preview changes in dry-run mode', async () => {
      await execAsync('git checkout -b feature-dry-run', { cwd: repoPath });
      await fs.writeFile(path.join(repoPath, 'dry-run-file.txt'), 'Dry run content\n', 'utf-8');
      await execAsync('git add dry-run-file.txt', { cwd: repoPath });
      await execAsync('git commit -m "Dry run commit"', { cwd: repoPath });
      await execAsync('git checkout main', { cwd: repoPath });

      const syncOperation = await syncManager.syncWorktree('feature-dry-run', {
        dryRun: true,
        force: false,
        autoPush: false,
      });

      expect(syncOperation.status).toBe('success');
      expect(syncOperation.diff_summary?.files_changed).toBeGreaterThan(0);

      const fileExists = await fs
        .access(path.join(repoPath, 'dry-run-file.txt'))
        .then(() => true)
        .catch(() => false);
      expect(fileExists).toBe(false);
    });
  });

  describe('Sync history and rollback', () => {
    it('should track sync operations in history', async () => {
      await execAsync('git checkout -b feature-history', { cwd: repoPath });
      await fs.writeFile(path.join(repoPath, 'history-file.txt'), 'History content\n', 'utf-8');
      await execAsync('git add history-file.txt', { cwd: repoPath });
      await execAsync('git commit -m "History commit"', { cwd: repoPath });
      await execAsync('git checkout main', { cwd: repoPath });

      await syncManager.syncWorktree('feature-history', {
        dryRun: false,
        force: false,
        autoPush: false,
      });

      const history = await syncManager.getSyncHistory();
      
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].worktree_branch).toBe('feature-history');
      expect(history[0].status).toBe('success');
    });

    it('should filter sync history by status', async () => {
      await execAsync('git checkout -b feature-success', { cwd: repoPath });
      await fs.writeFile(path.join(repoPath, 'success.txt'), 'Success\n', 'utf-8');
      await execAsync('git add success.txt', { cwd: repoPath });
      await execAsync('git commit -m "Success commit"', { cwd: repoPath });
      await execAsync('git checkout main', { cwd: repoPath });

      await syncManager.syncWorktree('feature-success', {
        dryRun: false,
        force: false,
        autoPush: false,
      });

      const history = await syncManager.getSyncHistory({
        status: 'success',
      });

      expect(history.length).toBeGreaterThan(0);
      expect(history.every(op => op.status === 'success')).toBe(true);
    });
  });
});
