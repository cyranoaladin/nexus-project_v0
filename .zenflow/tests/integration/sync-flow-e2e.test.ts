import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { SyncManager } from '../../core/sync/manager';
import { GitClient } from '../../core/git/client';
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

describe('Complete Sync Flow End-to-End Tests', () => {
  let tempDir: string;
  let repoPath: string;
  let gitClient: GitClient;
  let syncManager: SyncManager;
  let syncConfig: SyncConfig;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zenflow-e2e-sync-'));
    repoPath = path.join(tempDir, 'repo');

    await fs.mkdir(repoPath, { recursive: true });

    await execAsync('git init', { cwd: repoPath });
    await execAsync('git config user.email "test@example.com"', { cwd: repoPath });
    await execAsync('git config user.name "Test User"', { cwd: repoPath });

    await fs.writeFile(path.join(repoPath, 'README.md'), '# Test Repo\n', 'utf-8');
    await execAsync('git add .', { cwd: repoPath });
    await execAsync('git commit -m "Initial commit"', { cwd: repoPath });

    await fs.mkdir(path.join(repoPath, '.zenflow', 'state', 'sync'), { recursive: true });

    syncConfig = {
      enabled: true,
      autoPush: false,
      maxRetries: 3,
      timeout: 30000,
      conflictStrategy: 'abort',
      excludedWorktrees: [],
      notificationChannels: ['console'],
      verificationCommands: [],
    };

    gitClient = new GitClient(repoPath);
    syncManager = new SyncManager(repoPath, syncConfig);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Successful sync scenarios', () => {
    it('should complete sync with no conflicts - single file addition', async () => {
      await execAsync('git checkout -b feature-add-file', { cwd: repoPath });
      await fs.writeFile(path.join(repoPath, 'new-file.txt'), 'New content\n', 'utf-8');
      await execAsync('git add new-file.txt', { cwd: repoPath });
      await execAsync('git commit -m "Add new file"', { cwd: repoPath });
      await execAsync('git checkout main', { cwd: repoPath });

      const validation = await syncManager.validateSync('feature-add-file');
      expect(validation.valid).toBe(true);

      const diff = await syncManager.analyzeDiff('feature-add-file');
      expect(diff.files_changed).toBe(1);
      expect(diff.files[0].status).toBe('added');

      const conflicts = await syncManager.checkConflicts('feature-add-file');
      expect(conflicts.has_conflicts).toBe(false);

      const syncOperation = await syncManager.syncWorktree('feature-add-file', {
        dryRun: false,
        force: false,
      });

      expect(syncOperation.status).toBe('success');
      expect(syncOperation.diff_summary?.files_changed).toBe(1);

      const fileContent = await fs.readFile(path.join(repoPath, 'new-file.txt'), 'utf-8');
      expect(fileContent).toBe('New content\n');
    });

    it('should complete sync with no conflicts - multiple file modifications', async () => {
      await fs.writeFile(path.join(repoPath, 'file1.txt'), 'Original 1\n', 'utf-8');
      await fs.writeFile(path.join(repoPath, 'file2.txt'), 'Original 2\n', 'utf-8');
      await execAsync('git add .', { cwd: repoPath });
      await execAsync('git commit -m "Add files"', { cwd: repoPath });

      await execAsync('git checkout -b feature-modify-files', { cwd: repoPath });
      await fs.writeFile(path.join(repoPath, 'file1.txt'), 'Modified 1\n', 'utf-8');
      await fs.writeFile(path.join(repoPath, 'file2.txt'), 'Modified 2\n', 'utf-8');
      await fs.writeFile(path.join(repoPath, 'file3.txt'), 'New 3\n', 'utf-8');
      await execAsync('git add .', { cwd: repoPath });
      await execAsync('git commit -m "Modify files"', { cwd: repoPath });
      await execAsync('git checkout main', { cwd: repoPath });

      const syncOperation = await syncManager.syncWorktree('feature-modify-files', {
        dryRun: false,
        force: false,
      });

      expect(syncOperation.status).toBe('success');
      expect(syncOperation.diff_summary?.files_changed).toBeGreaterThanOrEqual(2);

      const file1Content = await fs.readFile(path.join(repoPath, 'file1.txt'), 'utf-8');
      const file2Content = await fs.readFile(path.join(repoPath, 'file2.txt'), 'utf-8');
      const file3Content = await fs.readFile(path.join(repoPath, 'file3.txt'), 'utf-8');

      expect(file1Content).toBe('Modified 1\n');
      expect(file2Content).toBe('Modified 2\n');
      expect(file3Content).toBe('New 3\n');
    });

    it('should complete sync with file deletion', async () => {
      await fs.writeFile(path.join(repoPath, 'to-delete.txt'), 'Will be deleted\n', 'utf-8');
      await execAsync('git add .', { cwd: repoPath });
      await execAsync('git commit -m "Add file to delete"', { cwd: repoPath });

      await execAsync('git checkout -b feature-delete-file', { cwd: repoPath });
      await fs.unlink(path.join(repoPath, 'to-delete.txt'));
      await execAsync('git add .', { cwd: repoPath });
      await execAsync('git commit -m "Delete file"', { cwd: repoPath });
      await execAsync('git checkout main', { cwd: repoPath });

      const syncOperation = await syncManager.syncWorktree('feature-delete-file', {
        dryRun: false,
        force: false,
      });

      expect(syncOperation.status).toBe('success');

      const fileExists = await fs
        .access(path.join(repoPath, 'to-delete.txt'))
        .then(() => true)
        .catch(() => false);

      expect(fileExists).toBe(false);
    });

    it('should handle empty worktree (no changes)', async () => {
      await execAsync('git checkout -b feature-no-changes', { cwd: repoPath });
      await execAsync('git checkout main', { cwd: repoPath });

      const diff = await syncManager.analyzeDiff('feature-no-changes');
      expect(diff.files_changed).toBe(0);

      const syncOperation = await syncManager.syncWorktree('feature-no-changes', {
        dryRun: false,
        force: false,
      });

      expect(syncOperation.status).toBe('success');
      expect(syncOperation.diff_summary?.files_changed).toBe(0);
    });
  });

  describe('Conflict detection and handling', () => {
    it('should detect and abort sync on content conflicts', async () => {
      await fs.writeFile(path.join(repoPath, 'conflict.txt'), 'Original content\n', 'utf-8');
      await execAsync('git add .', { cwd: repoPath });
      await execAsync('git commit -m "Add conflict file"', { cwd: repoPath });

      await execAsync('git checkout -b feature-conflict', { cwd: repoPath });
      await fs.writeFile(path.join(repoPath, 'conflict.txt'), 'Feature version\n', 'utf-8');
      await execAsync('git add .', { cwd: repoPath });
      await execAsync('git commit -m "Feature change"', { cwd: repoPath });

      await execAsync('git checkout main', { cwd: repoPath });
      await fs.writeFile(path.join(repoPath, 'conflict.txt'), 'Main version\n', 'utf-8');
      await execAsync('git add .', { cwd: repoPath });
      await execAsync('git commit -m "Main change"', { cwd: repoPath });

      const conflicts = await syncManager.checkConflicts('feature-conflict');
      expect(conflicts.has_conflicts).toBe(true);
      expect(conflicts.conflicted_files.length).toBeGreaterThan(0);

      const syncOperation = await syncManager.syncWorktree('feature-conflict', {
        dryRun: false,
        force: false,
      });

      expect(syncOperation.status).toBe('conflict');
      expect(syncOperation.conflict_info?.has_conflicts).toBe(true);

      const mainContent = await fs.readFile(path.join(repoPath, 'conflict.txt'), 'utf-8');
      expect(mainContent).toBe('Main version\n');
    });

    it('should detect delete/modify conflicts', async () => {
      await fs.writeFile(path.join(repoPath, 'delete-modify.txt'), 'Original\n', 'utf-8');
      await execAsync('git add .', { cwd: repoPath });
      await execAsync('git commit -m "Add file"', { cwd: repoPath });

      await execAsync('git checkout -b feature-delete', { cwd: repoPath });
      await fs.unlink(path.join(repoPath, 'delete-modify.txt'));
      await execAsync('git add .', { cwd: repoPath });
      await execAsync('git commit -m "Delete file"', { cwd: repoPath });

      await execAsync('git checkout main', { cwd: repoPath });
      await fs.writeFile(path.join(repoPath, 'delete-modify.txt'), 'Modified\n', 'utf-8');
      await execAsync('git add .', { cwd: repoPath });
      await execAsync('git commit -m "Modify file"', { cwd: repoPath });

      const conflicts = await syncManager.checkConflicts('feature-delete');
      expect(conflicts.has_conflicts).toBe(true);

      const syncOperation = await syncManager.syncWorktree('feature-delete', {
        dryRun: false,
        force: false,
      });

      expect(syncOperation.status).toBe('conflict');
    });

    it('should allow force sync even with conflicts', async () => {
      await fs.writeFile(path.join(repoPath, 'force-conflict.txt'), 'Original\n', 'utf-8');
      await execAsync('git add .', { cwd: repoPath });
      await execAsync('git commit -m "Add file"', { cwd: repoPath });

      await execAsync('git checkout -b feature-force', { cwd: repoPath });
      await fs.writeFile(path.join(repoPath, 'force-conflict.txt'), 'Feature version\n', 'utf-8');
      await execAsync('git add .', { cwd: repoPath });
      await execAsync('git commit -m "Feature change"', { cwd: repoPath });

      await execAsync('git checkout main', { cwd: repoPath });
      await fs.writeFile(path.join(repoPath, 'force-conflict.txt'), 'Main version\n', 'utf-8');
      await execAsync('git add .', { cwd: repoPath });
      await execAsync('git commit -m "Main change"', { cwd: repoPath });

      const conflicts = await syncManager.checkConflicts('feature-force');
      expect(conflicts.has_conflicts).toBe(true);

      const syncOperation = await syncManager.syncWorktree('feature-force', {
        dryRun: false,
        force: true,
      });

      expect(syncOperation.status).toBe('success');
    });
  });

  describe('Validation failures', () => {
    it('should reject sync of excluded branches', async () => {
      const syncConfigWithExclusions: SyncConfig = {
        ...syncConfig,
        excludedWorktrees: ['excluded-branch'],
      };

      const syncManagerWithExclusions = new SyncManager(repoPath, syncConfigWithExclusions);

      await execAsync('git checkout -b excluded-branch', { cwd: repoPath });
      await fs.writeFile(path.join(repoPath, 'excluded.txt'), 'Excluded\n', 'utf-8');
      await execAsync('git add .', { cwd: repoPath });
      await execAsync('git commit -m "Excluded commit"', { cwd: repoPath });
      await execAsync('git checkout main', { cwd: repoPath });

      await expect(
        syncManagerWithExclusions.syncWorktree('excluded-branch', {
          dryRun: false,
          force: false,
        })
      ).rejects.toThrow();
    });
  });

  describe('Dry-run mode', () => {
    it('should preview changes without applying them', async () => {
      await execAsync('git checkout -b feature-dry-run', { cwd: repoPath });
      await fs.writeFile(path.join(repoPath, 'dry-run.txt'), 'Dry run content\n', 'utf-8');
      await execAsync('git add dry-run.txt', { cwd: repoPath });
      await execAsync('git commit -m "Dry run commit"', { cwd: repoPath });
      await execAsync('git checkout main', { cwd: repoPath });

      const syncOperation = await syncManager.syncWorktree('feature-dry-run', {
        dryRun: true,
        force: false,
      });

      expect(syncOperation.status).toBe('success');
      expect(syncOperation.diff_summary?.files_changed).toBe(1);

      const fileExists = await fs
        .access(path.join(repoPath, 'dry-run.txt'))
        .then(() => true)
        .catch(() => false);

      expect(fileExists).toBe(false);
    });

    it('should detect conflicts in dry-run mode', async () => {
      await fs.writeFile(path.join(repoPath, 'dry-conflict.txt'), 'Original\n', 'utf-8');
      await execAsync('git add .', { cwd: repoPath });
      await execAsync('git commit -m "Add file"', { cwd: repoPath });

      await execAsync('git checkout -b feature-dry-conflict', { cwd: repoPath });
      await fs.writeFile(path.join(repoPath, 'dry-conflict.txt'), 'Feature\n', 'utf-8');
      await execAsync('git add .', { cwd: repoPath });
      await execAsync('git commit -m "Feature change"', { cwd: repoPath });

      await execAsync('git checkout main', { cwd: repoPath });
      await fs.writeFile(path.join(repoPath, 'dry-conflict.txt'), 'Main\n', 'utf-8');
      await execAsync('git add .', { cwd: repoPath });
      await execAsync('git commit -m "Main change"', { cwd: repoPath });

      const syncOperation = await syncManager.syncWorktree('feature-dry-conflict', {
        dryRun: true,
        force: false,
      });

      expect(syncOperation.status).toBe('conflict');
      expect(syncOperation.conflict_info?.has_conflicts).toBe(true);

      const mainContent = await fs.readFile(path.join(repoPath, 'dry-conflict.txt'), 'utf-8');
      expect(mainContent).toBe('Main\n');
    });
  });

  describe('Batch sync operations', () => {
    it('should sync multiple worktrees sequentially', async () => {
      await execAsync('git checkout -b feature-1', { cwd: repoPath });
      await fs.writeFile(path.join(repoPath, 'feature-1.txt'), 'Feature 1\n', 'utf-8');
      await execAsync('git add .', { cwd: repoPath });
      await execAsync('git commit -m "Feature 1"', { cwd: repoPath });

      await execAsync('git checkout main', { cwd: repoPath });

      await execAsync('git checkout -b feature-2', { cwd: repoPath });
      await fs.writeFile(path.join(repoPath, 'feature-2.txt'), 'Feature 2\n', 'utf-8');
      await execAsync('git add .', { cwd: repoPath });
      await execAsync('git commit -m "Feature 2"', { cwd: repoPath });

      await execAsync('git checkout main', { cwd: repoPath });

      const results = await syncManager.syncAllWorktrees({
        dryRun: false,
        force: false,
      });

      const successfulSyncs = results.filter(r => r.status === 'success');
      expect(successfulSyncs.length).toBe(2);

      const file1Exists = await fs
        .access(path.join(repoPath, 'feature-1.txt'))
        .then(() => true)
        .catch(() => false);
      const file2Exists = await fs
        .access(path.join(repoPath, 'feature-2.txt'))
        .then(() => true)
        .catch(() => false);

      expect(file1Exists).toBe(true);
      expect(file2Exists).toBe(true);
    });

    it('should continue batch sync even if one worktree has conflicts', async () => {
      await fs.writeFile(path.join(repoPath, 'shared.txt'), 'Original\n', 'utf-8');
      await execAsync('git add .', { cwd: repoPath });
      await execAsync('git commit -m "Add shared"', { cwd: repoPath });

      await execAsync('git checkout -b feature-conflict-batch', { cwd: repoPath });
      await fs.writeFile(path.join(repoPath, 'shared.txt'), 'Feature\n', 'utf-8');
      await execAsync('git add .', { cwd: repoPath });
      await execAsync('git commit -m "Feature change"', { cwd: repoPath });

      await execAsync('git checkout main', { cwd: repoPath });
      await fs.writeFile(path.join(repoPath, 'shared.txt'), 'Main\n', 'utf-8');
      await execAsync('git add .', { cwd: repoPath });
      await execAsync('git commit -m "Main change"', { cwd: repoPath });

      await execAsync('git checkout -b feature-success-batch', { cwd: repoPath });
      await fs.writeFile(path.join(repoPath, 'success.txt'), 'Success\n', 'utf-8');
      await execAsync('git add .', { cwd: repoPath });
      await execAsync('git commit -m "Success commit"', { cwd: repoPath });

      await execAsync('git checkout main', { cwd: repoPath });

      const results = await syncManager.syncAllWorktrees({
        dryRun: false,
        force: false,
      });

      const conflicts = results.filter(r => r.status === 'conflict');
      const successes = results.filter(r => r.status === 'success');

      expect(conflicts.length).toBeGreaterThan(0);
      expect(successes.length).toBeGreaterThan(0);
    });
  });

  describe('Sync history and rollback', () => {
    it('should track all sync operations', async () => {
      await execAsync('git checkout -b feature-history-1', { cwd: repoPath });
      await fs.writeFile(path.join(repoPath, 'history-1.txt'), 'History 1\n', 'utf-8');
      await execAsync('git add .', { cwd: repoPath });
      await execAsync('git commit -m "History 1"', { cwd: repoPath });
      await execAsync('git checkout main', { cwd: repoPath });

      await syncManager.syncWorktree('feature-history-1', { dryRun: false, force: false });

      await execAsync('git checkout -b feature-history-2', { cwd: repoPath });
      await fs.writeFile(path.join(repoPath, 'history-2.txt'), 'History 2\n', 'utf-8');
      await execAsync('git add .', { cwd: repoPath });
      await execAsync('git commit -m "History 2"', { cwd: repoPath });
      await execAsync('git checkout main', { cwd: repoPath });

      await syncManager.syncWorktree('feature-history-2', { dryRun: false, force: false });

      const history = await syncManager.getSyncHistory();
      expect(history.length).toBe(2);
      expect(history.every(op => op.status === 'success')).toBe(true);
    });

    it('should filter sync history by limit', async () => {
      for (let i = 1; i <= 5; i++) {
        await execAsync(`git checkout -b feature-limit-${i}`, { cwd: repoPath });
        await fs.writeFile(path.join(repoPath, `limit-${i}.txt`), `Limit ${i}\n`, 'utf-8');
        await execAsync('git add .', { cwd: repoPath });
        await execAsync(`git commit -m "Limit ${i}"`, { cwd: repoPath });
        await execAsync('git checkout main', { cwd: repoPath });

        await syncManager.syncWorktree(`feature-limit-${i}`, { dryRun: false, force: false });
      }

      const limitedHistory = await syncManager.getSyncHistory({ limit: 3 });
      expect(limitedHistory.length).toBe(3);
    });
  });
});
