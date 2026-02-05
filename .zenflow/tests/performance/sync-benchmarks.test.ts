jest.mock('uuid', () => ({
  v4: () => 'test-uuid-1234-5678-90ab-cdef',
}));

import * as path from 'path';
import * as os from 'os';
import { TestRepoGenerator, RepoConfig } from './helpers/repo-generator';
import { PerformanceMonitor, BenchmarkResult } from './helpers/performance-metrics';
import { SyncManager } from '../../core/sync/manager';
import { GitClient } from '../../core/git/client';
import type { SyncConfig } from '../../core/sync/types';

const TEST_BASE_PATH = path.join(os.tmpdir(), 'zenflow-perf-tests');

const DEFAULT_SYNC_CONFIG: SyncConfig = {
  autoPush: false,
  createBackup: true,
  defaultRemote: 'origin',
  mainBranch: 'main',
  mergeStrategy: 'no-ff',
  validateBeforeSync: true,
  rollbackOnError: true,
};

describe('Sync Performance Benchmarks', () => {
  const benchmarkResults: BenchmarkResult[] = [];

  afterAll(() => {
    PerformanceMonitor.printBenchmarkResults(benchmarkResults);
    
    const resultsPath = path.join(process.cwd(), '.zenflow/tests/performance/results.json');
    PerformanceMonitor.exportResultsToJSON(benchmarkResults, resultsPath);
    console.log(`\nResults exported to: ${resultsPath}`);
  });

  describe('Small Sync (<10 files)', () => {
    it('should sync within 30 seconds', async () => {
      const config: RepoConfig = {
        name: 'test-repo-small',
        numWorktrees: 1,
        filesPerWorktree: 5,
        linesPerFile: 100,
        basePath: TEST_BASE_PATH,
      };

      const generator = new TestRepoGenerator(config);
      const repoPath = await generator.create();
      const worktreePaths = await generator.createWorktrees(repoPath);
      await generator.populateWorktree(worktreePaths[0], 'small');

      const result = await PerformanceMonitor.runBenchmark(
        'Small sync (5 files, 100 lines each)',
        'small',
        async () => {
          const syncManager = new SyncManager(repoPath, DEFAULT_SYNC_CONFIG);
          const gitClient = new GitClient(worktreePaths[0]);
          const branch = await gitClient.getCurrentBranch();
          await syncManager.syncWorktree(branch, { dryRun: false });
        },
        {
          durationMs: 30000,
          memoryUsedMB: 100,
          peakMemoryMB: 150,
        },
        3
      );

      benchmarkResults.push(result);
      await generator.cleanup();

      expect(result.passed).toBe(true);
    }, 180000);

    it('should handle multiple small syncs efficiently', async () => {
      const config: RepoConfig = {
        name: 'test-repo-small-multi',
        numWorktrees: 3,
        filesPerWorktree: 8,
        linesPerFile: 80,
        basePath: TEST_BASE_PATH,
      };

      const generator = new TestRepoGenerator(config);
      const repoPath = await generator.create();
      const worktreePaths = await generator.createWorktrees(repoPath);
      
      for (const wtPath of worktreePaths) {
        await generator.populateWorktree(wtPath, 'small');
      }

      const result = await PerformanceMonitor.runBenchmark(
        'Multiple small syncs (3 worktrees, 8 files each)',
        'small',
        async () => {
          const syncManager = new SyncManager(repoPath, DEFAULT_SYNC_CONFIG);
          await syncManager.syncAllWorktrees({ dryRun: false });
        },
        {
          durationMs: 60000,
          memoryUsedMB: 150,
          peakMemoryMB: 200,
        },
        3
      );

      benchmarkResults.push(result);
      await generator.cleanup();

      expect(result.passed).toBe(true);
    }, 240000);
  });

  describe('Medium Sync (10-100 files)', () => {
    it('should sync within 2 minutes', async () => {
      const config: RepoConfig = {
        name: 'test-repo-medium',
        numWorktrees: 1,
        filesPerWorktree: 50,
        linesPerFile: 200,
        basePath: TEST_BASE_PATH,
      };

      const generator = new TestRepoGenerator(config);
      const repoPath = await generator.create();
      const worktreePaths = await generator.createWorktrees(repoPath);
      await generator.populateWorktree(worktreePaths[0], 'medium');

      const result = await PerformanceMonitor.runBenchmark(
        'Medium sync (50 files, 200 lines each)',
        'medium',
        async () => {
          const syncManager = new SyncManager(repoPath, DEFAULT_SYNC_CONFIG);
          const gitClient = new GitClient(worktreePaths[0]);
          const branch = await gitClient.getCurrentBranch();
          await syncManager.syncWorktree(branch, { dryRun: false });
        },
        {
          durationMs: 120000,
          memoryUsedMB: 200,
          peakMemoryMB: 300,
        },
        3
      );

      benchmarkResults.push(result);
      await generator.cleanup();

      expect(result.passed).toBe(true);
    }, 480000);

    it('should handle batch sync of medium-sized worktrees', async () => {
      const config: RepoConfig = {
        name: 'test-repo-medium-batch',
        numWorktrees: 5,
        filesPerWorktree: 30,
        linesPerFile: 150,
        basePath: TEST_BASE_PATH,
      };

      const generator = new TestRepoGenerator(config);
      const repoPath = await generator.create();
      const worktreePaths = await generator.createWorktrees(repoPath);
      
      for (const wtPath of worktreePaths) {
        await generator.populateWorktree(wtPath, 'medium');
      }

      const result = await PerformanceMonitor.runBenchmark(
        'Batch medium sync (5 worktrees, 30 files each)',
        'medium',
        async () => {
          const syncManager = new SyncManager(repoPath, DEFAULT_SYNC_CONFIG);
          await syncManager.syncAllWorktrees({ dryRun: false });
        },
        {
          durationMs: 180000,
          memoryUsedMB: 250,
          peakMemoryMB: 350,
        },
        2
      );

      benchmarkResults.push(result);
      await generator.cleanup();

      expect(result.passed).toBe(true);
    }, 600000);
  });

  describe('Large Sync (100+ files)', () => {
    it('should sync within 10 minutes', async () => {
      const config: RepoConfig = {
        name: 'test-repo-large',
        numWorktrees: 1,
        filesPerWorktree: 150,
        linesPerFile: 300,
        basePath: TEST_BASE_PATH,
      };

      const generator = new TestRepoGenerator(config);
      const repoPath = await generator.create();
      const worktreePaths = await generator.createWorktrees(repoPath);
      await generator.populateWorktree(worktreePaths[0], 'large');

      const result = await PerformanceMonitor.runBenchmark(
        'Large sync (150 files, 300 lines each)',
        'large',
        async () => {
          const syncManager = new SyncManager(repoPath, DEFAULT_SYNC_CONFIG);
          const gitClient = new GitClient(worktreePaths[0]);
          const branch = await gitClient.getCurrentBranch();
          await syncManager.syncWorktree(branch, { dryRun: false });
        },
        {
          durationMs: 600000,
          memoryUsedMB: 300,
          peakMemoryMB: 450,
        },
        2
      );

      benchmarkResults.push(result);
      await generator.cleanup();

      expect(result.passed).toBe(true);
    }, 900000);

    it('should handle many worktrees (14+) efficiently', async () => {
      const config: RepoConfig = {
        name: 'test-repo-many-worktrees',
        numWorktrees: 14,
        filesPerWorktree: 20,
        linesPerFile: 100,
        basePath: TEST_BASE_PATH,
      };

      const generator = new TestRepoGenerator(config);
      const repoPath = await generator.create();
      const worktreePaths = await generator.createWorktrees(repoPath);
      
      for (const wtPath of worktreePaths) {
        await generator.populateWorktree(wtPath, 'medium');
      }

      const result = await PerformanceMonitor.runBenchmark(
        'Many worktrees sync (14 worktrees, 20 files each)',
        'large',
        async () => {
          const syncManager = new SyncManager(repoPath, DEFAULT_SYNC_CONFIG);
          await syncManager.syncAllWorktrees({ dryRun: false });
        },
        {
          durationMs: 600000,
          memoryUsedMB: 400,
          peakMemoryMB: 550,
        },
        2
      );

      benchmarkResults.push(result);
      await generator.cleanup();

      expect(result.passed).toBe(true);
    }, 1200000);
  });

  describe('Conflict Detection Performance', () => {
    it('should detect conflicts quickly', async () => {
      const config: RepoConfig = {
        name: 'test-repo-conflicts',
        numWorktrees: 1,
        filesPerWorktree: 30,
        linesPerFile: 100,
        basePath: TEST_BASE_PATH,
      };

      const generator = new TestRepoGenerator(config);
      const repoPath = await generator.create();
      const worktreePaths = await generator.createWorktrees(repoPath);
      await generator.populateWorktree(worktreePaths[0], 'medium');

      const result = await PerformanceMonitor.runBenchmark(
        'Conflict detection (30 files)',
        'medium',
        async () => {
          const syncManager = new SyncManager(repoPath, DEFAULT_SYNC_CONFIG);
          const gitClient = new GitClient(worktreePaths[0]);
          const branch = await gitClient.getCurrentBranch();
          await syncManager.checkConflicts(branch);
        },
        {
          durationMs: 30000,
          memoryUsedMB: 100,
          peakMemoryMB: 150,
        },
        5
      );

      benchmarkResults.push(result);
      await generator.cleanup();

      expect(result.passed).toBe(true);
    }, 180000);
  });

  describe('Validation Performance', () => {
    it('should validate quickly before sync', async () => {
      const config: RepoConfig = {
        name: 'test-repo-validation',
        numWorktrees: 1,
        filesPerWorktree: 40,
        linesPerFile: 150,
        basePath: TEST_BASE_PATH,
      };

      const generator = new TestRepoGenerator(config);
      const repoPath = await generator.create();
      const worktreePaths = await generator.createWorktrees(repoPath);
      await generator.populateWorktree(worktreePaths[0], 'medium');

      const result = await PerformanceMonitor.runBenchmark(
        'Pre-sync validation (40 files)',
        'medium',
        async () => {
          const syncManager = new SyncManager(repoPath, DEFAULT_SYNC_CONFIG);
          const gitClient = new GitClient(worktreePaths[0]);
          const branch = await gitClient.getCurrentBranch();
          await syncManager.validateSync(branch);
        },
        {
          durationMs: 15000,
          memoryUsedMB: 80,
          peakMemoryMB: 120,
        },
        5
      );

      benchmarkResults.push(result);
      await generator.cleanup();

      expect(result.passed).toBe(true);
    }, 120000);
  });
});
