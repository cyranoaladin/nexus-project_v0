jest.mock('uuid', () => ({
  v4: () => 'test-uuid-1234-5678-90ab-cdef',
}));

import * as path from 'path';
import * as os from 'os';
import { Profiler } from './profiler';
import { TestRepoGenerator, RepoConfig } from './helpers/repo-generator';
import { SyncManager } from '../../core/sync/manager';
import { GitClient } from '../../core/git/client';
import type { SyncConfig } from '../../core/sync/types';

const TEST_BASE_PATH = path.join(os.tmpdir(), 'zenflow-profiling-tests');

const DEFAULT_SYNC_CONFIG: SyncConfig = {
  enabled: true,
  autoPush: false,
  maxRetries: 3,
  timeout: 300000,
  conflictStrategy: 'abort',
  excludedWorktrees: [],
  notificationChannels: ['console'],
  verificationCommands: [],
};

describe('Profiling Examples', () => {
  let profiler: Profiler;

  beforeEach(() => {
    profiler = new Profiler();
  });

  afterEach(() => {
    profiler.printSummary();

    const profilePath = path.join(
      process.cwd(),
      '.zenflow/tests/performance/profiles',
      `profile-${Date.now()}.json`
    );
    profiler.exportToJSON(profilePath);

    profiler.destroy();
  });

  it('should profile sync operations with detailed metrics', async () => {
    const config: RepoConfig = {
      name: 'test-repo-profiling',
      numWorktrees: 1,
      filesPerWorktree: 30,
      linesPerFile: 150,
      basePath: TEST_BASE_PATH,
    };

    const generator = new TestRepoGenerator(config);
    const repoPath = await generator.create();
    const worktreePaths = await generator.createWorktrees(repoPath);
    await generator.populateWorktree(worktreePaths[0], 'medium');

    profiler.takeHeapSnapshot('before-sync');

    const { result, profile } = await profiler.profile(
      'syncWorktree',
      async () => {
        const syncManager = new SyncManager(repoPath, DEFAULT_SYNC_CONFIG);
        const gitClient = new GitClient(worktreePaths[0]);
        const branch = await gitClient.getCurrentBranch();
        return await syncManager.syncWorktree(branch, { dryRun: false });
      }
    );

    profiler.takeHeapSnapshot('after-sync');

    console.log(`Sync operation completed in ${profile.duration.toFixed(2)}ms`);
    console.log(`Memory delta: ${(
      (profile.memoryAfter.heapUsed - profile.memoryBefore.heapUsed) / 1024 / 1024
    ).toFixed(2)}MB`);

    await generator.cleanup();

    expect(result).toBeDefined();
    expect(result.status).toBe('completed');
  }, 300000);

  it('should profile conflict detection separately', async () => {
    const config: RepoConfig = {
      name: 'test-repo-conflict-profiling',
      numWorktrees: 1,
      filesPerWorktree: 50,
      linesPerFile: 200,
      basePath: TEST_BASE_PATH,
    };

    const generator = new TestRepoGenerator(config);
    const repoPath = await generator.create();
    const worktreePaths = await generator.createWorktrees(repoPath);
    await generator.populateWorktree(worktreePaths[0], 'medium');

    const syncManager = new SyncManager(repoPath, DEFAULT_SYNC_CONFIG);
    const gitClient = new GitClient(worktreePaths[0]);
    const branch = await gitClient.getCurrentBranch();

    const { result: conflicts, profile } = await profiler.profile(
      'checkConflicts',
      async () => {
        return await syncManager.checkConflicts(branch);
      }
    );

    console.log(`Conflict detection completed in ${profile.duration.toFixed(2)}ms`);
    console.log(`Has conflicts: ${conflicts.has_conflicts}`);

    await generator.cleanup();

    expect(conflicts).toBeDefined();
    expect(conflicts.has_conflicts).toBe(false);
  }, 180000);

  it('should profile batch operations', async () => {
    const config: RepoConfig = {
      name: 'test-repo-batch-profiling',
      numWorktrees: 5,
      filesPerWorktree: 20,
      linesPerFile: 100,
      basePath: TEST_BASE_PATH,
    };

    const generator = new TestRepoGenerator(config);
    const repoPath = await generator.create();
    const worktreePaths = await generator.createWorktrees(repoPath);

    for (const wtPath of worktreePaths) {
      await generator.populateWorktree(wtPath, 'small');
    }

    profiler.takeHeapSnapshot('before-batch-sync');

    const { result, profile } = await profiler.profile(
      'syncAllWorktrees',
      async () => {
        const syncManager = new SyncManager(repoPath, DEFAULT_SYNC_CONFIG);
        return await syncManager.syncAllWorktrees({ dryRun: false });
      }
    );

    profiler.takeHeapSnapshot('after-batch-sync');

    console.log(`Batch sync completed in ${profile.duration.toFixed(2)}ms`);
    console.log(`Synced ${result.length} worktrees`);

    await generator.cleanup();

    expect(result).toBeDefined();
    expect(result.length).toBe(5);
  }, 480000);

  it('should identify performance bottlenecks in validation', async () => {
    const config: RepoConfig = {
      name: 'test-repo-validation-profiling',
      numWorktrees: 1,
      filesPerWorktree: 40,
      linesPerFile: 150,
      basePath: TEST_BASE_PATH,
    };

    const generator = new TestRepoGenerator(config);
    const repoPath = await generator.create();
    const worktreePaths = await generator.createWorktrees(repoPath);
    await generator.populateWorktree(worktreePaths[0], 'medium');

    const syncManager = new SyncManager(repoPath, DEFAULT_SYNC_CONFIG);
    const gitClient = new GitClient(worktreePaths[0]);
    const branch = await gitClient.getCurrentBranch();

    const { result: validationResult, profile } = await profiler.profile(
      'validateSync',
      async () => {
        return await syncManager.validateSync(branch);
      }
    );

    console.log(`Validation completed in ${profile.duration.toFixed(2)}ms`);
    console.log(`Validation passed: ${validationResult.valid}`);

    await generator.cleanup();

    expect(validationResult).toBeDefined();
    expect(validationResult.valid).toBe(true);
  }, 120000);
});
