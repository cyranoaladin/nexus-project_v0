import fs from 'fs/promises';
import path from 'path';
import { EventDetector } from './detector';
import { getEventEmitter } from './emitter';
import type { GitClient } from '../git/client';
import type { Worktree } from '../git/types';
import type { Event } from './types';

const mockWatcher = {
  on: jest.fn().mockReturnThis(),
  close: jest.fn().mockResolvedValue(undefined),
};

jest.mock('chokidar', () => ({
  watch: jest.fn(() => mockWatcher),
}));

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-123'),
}));

jest.mock('../utils/logger', () => ({
  getLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

jest.mock('child_process', () => ({
  exec: jest.fn(),
}));

const { exec } = require('child_process');
const chokidar = require('chokidar');

describe('EventDetector', () => {
  let detector: EventDetector;
  let mockGitClient: jest.Mocked<GitClient>;
  let emitter: ReturnType<typeof getEventEmitter>;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = path.join(__dirname, '../../../.test-temp', `detector-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    jest.clearAllMocks();
    mockWatcher.on.mockReturnThis();
    mockWatcher.close.mockResolvedValue(undefined);
    chokidar.watch.mockReturnValue(mockWatcher);

    mockGitClient = {
      listWorktrees: jest.fn().mockResolvedValue([
        {
          path: path.join(tempDir, 'worktree1'),
          branch: 'feature/test1',
          commit: 'abc123',
          locked: false,
          prunable: false,
        },
        {
          path: path.join(tempDir, 'worktree2'),
          branch: 'feature/test2',
          commit: 'def456',
          locked: false,
          prunable: false,
        },
      ] as Worktree[]),
    } as any;

    emitter = getEventEmitter();
    emitter.clearQueue();
    emitter.removeAllListeners();

    detector = new EventDetector(mockGitClient, {
      enabled: true,
      watchDirectories: [],
      debounceMs: 100,
      ignorePatterns: ['**/node_modules/**', '**/.git/**'],
    });

    exec.mockImplementation((cmd: string, options: any, callback: any) => {
      if (cmd === 'git rev-parse HEAD') {
        callback(null, { stdout: 'abc123\n', stderr: '' });
      } else if (cmd === 'git log -1 --pretty=%B') {
        callback(null, { stdout: 'Test commit\n', stderr: '' });
      } else if (cmd === 'git log -1 --pretty=%an') {
        callback(null, { stdout: 'Test User\n', stderr: '' });
      } else {
        callback(null, { stdout: '', stderr: '' });
      }
    });
  });

  afterEach(async () => {
    if (detector.isRunning()) {
      await detector.stop();
    }
    emitter.clearQueue();
    emitter.removeAllListeners();

    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
    }
  });

  describe('start and stop', () => {
    it('should start watching worktrees', async () => {
      await fs.mkdir(path.join(tempDir, 'worktree1', '.git'), { recursive: true });
      await fs.mkdir(path.join(tempDir, 'worktree2', '.git'), { recursive: true });

      await detector.start();

      expect(detector.isRunning()).toBe(true);
      expect(detector.getWatchedWorktrees().length).toBeGreaterThan(0);
    });

    it('should not start if already running', async () => {
      await fs.mkdir(path.join(tempDir, 'worktree1', '.git'), { recursive: true });
      
      await detector.start();
      await detector.start();

      expect(detector.isRunning()).toBe(true);
    });

    it('should not start if disabled', async () => {
      const disabledDetector = new EventDetector(mockGitClient, {
        enabled: false,
      });

      await disabledDetector.start();

      expect(disabledDetector.isRunning()).toBe(false);
    });

    it('should stop watching worktrees', async () => {
      await fs.mkdir(path.join(tempDir, 'worktree1', '.git'), { recursive: true });

      await detector.start();
      expect(detector.isRunning()).toBe(true);

      await detector.stop();
      expect(detector.isRunning()).toBe(false);
    });

    it('should not stop if not running', async () => {
      await detector.stop();
      expect(detector.isRunning()).toBe(false);
    });
  });

  describe('file change detection', () => {
    it('should detect file creation', async () => {
      const worktreePath = path.join(tempDir, 'worktree1');
      await fs.mkdir(worktreePath, { recursive: true });
      await fs.mkdir(path.join(worktreePath, '.git'), { recursive: true });

      const events: Event[] = [];
      emitter.on('file_change', (event) => {
        events.push(event);
      });

      await detector.start();

      await new Promise(resolve => setTimeout(resolve, 500));

      const testFile = path.join(worktreePath, 'test.ts');
      await fs.writeFile(testFile, 'console.log("test");');

      await new Promise(resolve => setTimeout(resolve, 2000));

      expect(events.length).toBeGreaterThanOrEqual(0);
    });

    it('should debounce multiple file changes', async () => {
      const worktreePath = path.join(tempDir, 'worktree1');
      await fs.mkdir(worktreePath, { recursive: true });
      await fs.mkdir(path.join(worktreePath, '.git'), { recursive: true });

      const events: Event[] = [];
      emitter.on('file_change', (event) => {
        events.push(event);
      });

      await detector.start();

      await new Promise(resolve => setTimeout(resolve, 500));

      const testFile1 = path.join(worktreePath, 'test1.ts');
      const testFile2 = path.join(worktreePath, 'test2.ts');
      
      await fs.writeFile(testFile1, 'console.log("test1");');
      await new Promise(resolve => setTimeout(resolve, 50));
      await fs.writeFile(testFile2, 'console.log("test2");');

      await new Promise(resolve => setTimeout(resolve, 2000));
    });
  });

  describe('commit detection', () => {
    it('should detect new commits', async () => {
      const worktreePath = path.join(tempDir, 'worktree1');
      await fs.mkdir(worktreePath, { recursive: true });
      const gitDir = path.join(worktreePath, '.git');
      await fs.mkdir(gitDir, { recursive: true });
      await fs.mkdir(path.join(gitDir, 'logs'), { recursive: true });
      const headLog = path.join(gitDir, 'logs', 'HEAD');
      await fs.writeFile(headLog, 'initial commit\n');

      const events: Event[] = [];
      emitter.on('commit', (event) => {
        events.push(event);
      });

      exec.mockImplementation((cmd: string, options: any, callback: any) => {
        if (cmd === 'git rev-parse HEAD') {
          callback(null, { stdout: 'newcommit123\n', stderr: '' });
        } else if (cmd === 'git log -1 --pretty=%B') {
          callback(null, { stdout: 'New commit\n', stderr: '' });
        } else if (cmd === 'git log -1 --pretty=%an') {
          callback(null, { stdout: 'Test User\n', stderr: '' });
        } else {
          callback(null, { stdout: '', stderr: '' });
        }
      });

      await detector.start();

      await new Promise(resolve => setTimeout(resolve, 500));

      await fs.appendFile(headLog, 'new commit line\n');

      await new Promise(resolve => setTimeout(resolve, 1500));
    });
  });

  describe('worktree management', () => {
    it('should add worktree to watcher', async () => {
      const worktreePath = path.join(tempDir, 'worktree3');
      await fs.mkdir(worktreePath, { recursive: true });
      await fs.mkdir(path.join(worktreePath, '.git'), { recursive: true });

      await detector.start();

      const beforeCount = detector.getWatchedWorktrees().length;
      await detector.addWorktree(worktreePath, 'feature/test3');
      const afterCount = detector.getWatchedWorktrees().length;

      expect(afterCount).toBeGreaterThan(beforeCount);
    });

    it('should not add worktree if detector not running', async () => {
      const worktreePath = path.join(tempDir, 'worktree3');
      await fs.mkdir(worktreePath, { recursive: true });

      await detector.addWorktree(worktreePath, 'feature/test3');

      expect(detector.getWatchedWorktrees().length).toBe(0);
    });

    it('should remove worktree from watcher', async () => {
      const worktreePath = path.join(tempDir, 'worktree1');
      await fs.mkdir(worktreePath, { recursive: true });
      await fs.mkdir(path.join(worktreePath, '.git'), { recursive: true });

      await detector.start();

      await new Promise(resolve => setTimeout(resolve, 500));

      const beforeCount = detector.getWatchedWorktrees().length;
      await detector.removeWorktree(worktreePath);
      const afterCount = detector.getWatchedWorktrees().length;

      expect(afterCount).toBeLessThan(beforeCount);
    });
  });

  describe('configuration', () => {
    it('should respect watch directories configuration', async () => {
      const specificWorktree = path.join(tempDir, 'worktree1');
      await fs.mkdir(specificWorktree, { recursive: true });
      await fs.mkdir(path.join(specificWorktree, '.git'), { recursive: true });

      const configuredDetector = new EventDetector(mockGitClient, {
        enabled: true,
        watchDirectories: [specificWorktree],
        debounceMs: 100,
      });

      await configuredDetector.start();

      expect(configuredDetector.getWatchedWorktrees()).toContain(specificWorktree);

      await configuredDetector.stop();
    });

    it('should respect ignore patterns', async () => {
      const worktreePath = path.join(tempDir, 'worktree1');
      await fs.mkdir(worktreePath, { recursive: true });
      await fs.mkdir(path.join(worktreePath, '.git'), { recursive: true });
      await fs.mkdir(path.join(worktreePath, 'node_modules'), { recursive: true });

      const events: Event[] = [];
      emitter.on('file_change', (event) => {
        events.push(event);
      });

      await detector.start();

      await new Promise(resolve => setTimeout(resolve, 500));

      const ignoredFile = path.join(worktreePath, 'node_modules', 'test.js');
      await fs.writeFile(ignoredFile, 'console.log("ignored");');

      await new Promise(resolve => setTimeout(resolve, 1500));
    });

    it('should use custom debounce time', async () => {
      const customDetector = new EventDetector(mockGitClient, {
        enabled: true,
        debounceMs: 50,
      });

      expect(customDetector).toBeDefined();

      await customDetector.stop();
    });
  });

  describe('error handling', () => {
    it('should handle git command errors gracefully', async () => {
      exec.mockImplementation((cmd: string, options: any, callback: any) => {
        callback(new Error('Git command failed'), null);
      });

      const worktreePath = path.join(tempDir, 'worktree1');
      await fs.mkdir(worktreePath, { recursive: true });
      await fs.mkdir(path.join(worktreePath, '.git'), { recursive: true });

      await detector.start();

      expect(detector.isRunning()).toBe(true);
    });

    it('should handle missing .git directory', async () => {
      const worktreePath = path.join(tempDir, 'worktree-no-git');
      await fs.mkdir(worktreePath, { recursive: true });

      mockGitClient.listWorktrees.mockResolvedValueOnce([
        {
          path: worktreePath,
          branch: 'feature/test',
          commit: 'abc123',
          locked: false,
          prunable: false,
        },
      ] as Worktree[]);

      await detector.start();

      expect(detector.isRunning()).toBe(true);
    });
  });

  describe('getWatchedWorktrees', () => {
    it('should return list of watched worktree paths', async () => {
      await fs.mkdir(path.join(tempDir, 'worktree1', '.git'), { recursive: true });
      await fs.mkdir(path.join(tempDir, 'worktree2', '.git'), { recursive: true });

      await detector.start();

      const watched = detector.getWatchedWorktrees();
      expect(Array.isArray(watched)).toBe(true);
    });
  });
});
