import { exec } from 'child_process';
import { GitClient } from './client';
import { GitOperationError } from '../utils/errors';
import type { Worktree, DiffSummary, ConflictInfo, MergeResult } from './types';

jest.mock('child_process');
jest.mock('../utils/logger', () => ({
  getLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

const mockExec = exec as unknown as jest.Mock;

describe('GitClient', () => {
  let client: GitClient;
  const testRepoPath = '/test/repo';

  beforeEach(() => {
    jest.clearAllMocks();
    client = new GitClient(testRepoPath);
  });

  describe('constructor', () => {
    it('should initialize with repository path', () => {
      expect(client).toBeInstanceOf(GitClient);
    });

    it('should resolve relative paths', () => {
      const relativeClient = new GitClient('.');
      expect(relativeClient).toBeInstanceOf(GitClient);
    });
  });

  describe('listWorktrees', () => {
    const mockWorktreeOutput = `worktree /home/user/repo
HEAD 1234567890abcdef
branch refs/heads/main

worktree /home/user/worktrees/feature-x
HEAD abcdef1234567890
branch refs/heads/feature-x

worktree /home/user/worktrees/detached
HEAD fedcba0987654321
detached

worktree /home/user/worktrees/locked-wt
HEAD 1111222233334444
branch refs/heads/locked-branch
locked

worktree /home/user/worktrees/prunable-wt
HEAD 5555666677778888
branch refs/heads/prunable-branch
prunable
`;

    it('should parse worktree list correctly', async () => {
      mockExec.mockImplementation((cmd, options, callback) => {
        callback(null, { stdout: mockWorktreeOutput, stderr: '' });
      });

      const worktrees = await client.listWorktrees();

      expect(worktrees).toHaveLength(5);
      expect(worktrees[0]).toEqual({
        path: '/home/user/repo',
        branch: 'refs/heads/main',
        commit: '1234567890abcdef',
        locked: false,
        prunable: false,
      });
      expect(worktrees[1]).toEqual({
        path: '/home/user/worktrees/feature-x',
        branch: 'refs/heads/feature-x',
        commit: 'abcdef1234567890',
        locked: false,
        prunable: false,
      });
    });

    it('should handle detached HEAD', async () => {
      mockExec.mockImplementation((cmd, options, callback) => {
        callback(null, { stdout: mockWorktreeOutput, stderr: '' });
      });

      const worktrees = await client.listWorktrees();
      const detached = worktrees.find(wt => wt.path === '/home/user/worktrees/detached');

      expect(detached).toBeDefined();
      expect(detached?.branch).toBe('');
      expect(detached?.commit).toBe('fedcba0987654321');
    });

    it('should parse locked worktree', async () => {
      mockExec.mockImplementation((cmd, options, callback) => {
        callback(null, { stdout: mockWorktreeOutput, stderr: '' });
      });

      const worktrees = await client.listWorktrees();
      const locked = worktrees.find(wt => wt.path === '/home/user/worktrees/locked-wt');

      expect(locked).toBeDefined();
      expect(locked?.locked).toBe(true);
    });

    it('should parse prunable worktree', async () => {
      mockExec.mockImplementation((cmd, options, callback) => {
        callback(null, { stdout: mockWorktreeOutput, stderr: '' });
      });

      const worktrees = await client.listWorktrees();
      const prunable = worktrees.find(wt => wt.path === '/home/user/worktrees/prunable-wt');

      expect(prunable).toBeDefined();
      expect(prunable?.prunable).toBe(true);
    });

    it('should handle empty worktree list', async () => {
      mockExec.mockImplementation((cmd, options, callback) => {
        callback(null, { stdout: '', stderr: '' });
      });

      const worktrees = await client.listWorktrees();

      expect(worktrees).toEqual([]);
    });

    it('should throw GitOperationError on command failure', async () => {
      mockExec.mockImplementation((cmd, options, callback) => {
        callback(new Error('Command failed'), null);
      });

      await expect(client.listWorktrees()).rejects.toThrow(GitOperationError);
      await expect(client.listWorktrees()).rejects.toThrow('Failed to list worktrees');
    });
  });

  describe('getWorktree', () => {
    const mockWorktreeOutput = `worktree /home/user/repo
HEAD 1234567890abcdef
branch refs/heads/main

worktree /home/user/worktrees/feature-x
HEAD abcdef1234567890
branch refs/heads/feature-x
`;

    beforeEach(() => {
      mockExec.mockImplementation((cmd, options, callback) => {
        callback(null, { stdout: mockWorktreeOutput, stderr: '' });
      });
    });

    it('should find worktree by branch name', async () => {
      const worktree = await client.getWorktree('refs/heads/feature-x');

      expect(worktree).not.toBeNull();
      expect(worktree?.branch).toBe('refs/heads/feature-x');
      expect(worktree?.path).toBe('/home/user/worktrees/feature-x');
    });

    it('should return null for non-existent branch', async () => {
      const worktree = await client.getWorktree('non-existent');

      expect(worktree).toBeNull();
    });

    it('should throw GitOperationError on command failure', async () => {
      mockExec.mockImplementation((cmd, options, callback) => {
        callback(new Error('Command failed'), null);
      });

      await expect(client.getWorktree('main')).rejects.toThrow(GitOperationError);
    });
  });

  describe('diff', () => {
    const mockDiffOutput = `10\t5\tsrc/file1.ts
0\t20\tsrc/file2.ts
15\t0\tsrc/file3.ts
-\t-\timage.png
`;

    it('should parse diff output correctly', async () => {
      mockExec.mockImplementation((cmd, options, callback) => {
        callback(null, { stdout: mockDiffOutput, stderr: '' });
      });

      const diff = await client.diff('main', 'feature-x');

      expect(diff.files_changed).toBe(4);
      expect(diff.insertions).toBe(25);
      expect(diff.deletions).toBe(25);
      expect(diff.files).toHaveLength(4);
      expect(diff.files[0]).toEqual({
        path: 'src/file1.ts',
        status: 'M',
        insertions: 10,
        deletions: 5,
        binary: false,
      });
    });

    it('should identify binary files', async () => {
      mockExec.mockImplementation((cmd, options, callback) => {
        callback(null, { stdout: mockDiffOutput, stderr: '' });
      });

      const diff = await client.diff('main', 'feature-x');
      const binaryFile = diff.files.find(f => f.path === 'image.png');

      expect(binaryFile).toBeDefined();
      expect(binaryFile?.binary).toBe(true);
      expect(binaryFile?.insertions).toBe(0);
      expect(binaryFile?.deletions).toBe(0);
    });

    it('should identify added files', async () => {
      mockExec.mockImplementation((cmd, options, callback) => {
        callback(null, { stdout: '15\t0\tnew-file.ts\n', stderr: '' });
      });

      const diff = await client.diff('main', 'feature-x');

      expect(diff.files[0].status).toBe('A');
    });

    it('should identify deleted files', async () => {
      mockExec.mockImplementation((cmd, options, callback) => {
        callback(null, { stdout: '0\t20\tdeleted-file.ts\n', stderr: '' });
      });

      const diff = await client.diff('main', 'feature-x');

      expect(diff.files[0].status).toBe('D');
    });

    it('should handle empty diff', async () => {
      mockExec.mockImplementation((cmd, options, callback) => {
        callback(null, { stdout: '', stderr: '' });
      });

      const diff = await client.diff('main', 'feature-x');

      expect(diff.files_changed).toBe(0);
      expect(diff.insertions).toBe(0);
      expect(diff.deletions).toBe(0);
      expect(diff.files).toEqual([]);
    });

    it('should throw GitOperationError on command failure', async () => {
      mockExec.mockImplementation((cmd, options, callback) => {
        callback(new Error('Command failed'), null);
      });

      await expect(client.diff('main', 'feature-x')).rejects.toThrow(GitOperationError);
    });

    it('should sanitize branch names', async () => {
      await expect(client.diff('main; rm -rf /', 'feature')).rejects.toThrow(GitOperationError);
      await expect(client.diff('main', 'feature`whoami`')).rejects.toThrow(GitOperationError);
    });
  });

  describe('checkConflicts', () => {
    it('should detect conflicts', async () => {
      const conflictOutput = `merged
added in remote
  their  100644 abc123 src/conflicted.ts
@@ -1,5 +1,9 @@
+++ b/src/conflicted.ts
 function test() {
+<<<<<<< .our
+  return 'version 1';
+=======
+  return 'version 2';
+>>>>>>> .their
 }
`;

      mockExec.mockImplementation((cmd, options, callback) => {
        callback(null, { stdout: conflictOutput, stderr: '' });
      });

      const conflicts = await client.checkConflicts('main', 'feature-x');

      expect(conflicts.has_conflicts).toBe(true);
      expect(conflicts.conflicted_files.length).toBeGreaterThan(0);
      expect(conflicts.details.length).toBeGreaterThan(0);
    });

    it('should return no conflicts when branches merge cleanly', async () => {
      mockExec.mockImplementation((cmd, options, callback) => {
        callback(null, { stdout: 'merged cleanly', stderr: '' });
      });

      const conflicts = await client.checkConflicts('main', 'feature-x');

      expect(conflicts.has_conflicts).toBe(false);
      expect(conflicts.conflicted_files).toEqual([]);
      expect(conflicts.details).toEqual([]);
    });

    it('should throw GitOperationError on command failure', async () => {
      mockExec.mockImplementation((cmd, options, callback) => {
        callback(new Error('Command failed'), null);
      });

      await expect(client.checkConflicts('main', 'feature-x')).rejects.toThrow(GitOperationError);
    });
  });

  describe('merge', () => {
    it('should merge successfully when no conflicts', async () => {
      mockExec.mockImplementation((cmd, options, callback) => {
        if (cmd.includes('merge-tree')) {
          callback(null, { stdout: 'merged cleanly', stderr: '' });
        } else if (cmd.includes('git merge')) {
          callback(null, { stdout: 'Merge made by recursive strategy.\n abc1234', stderr: '' });
        } else {
          callback(new Error('Unexpected command'), null);
        }
      });

      const result = await client.merge('feature-x', 'Merge feature-x into main');

      expect(result.success).toBe(true);
      expect(result.commit_hash).toBeDefined();
      expect(result.conflicts).toBeUndefined();
    });

    it('should abort merge when conflicts detected', async () => {
      mockExec.mockImplementation((cmd, options, callback) => {
        if (cmd.includes('merge-tree')) {
          callback(null, { 
            stdout: `+++ b/file.ts
<<<<<<< .our
version 1
=======
version 2
>>>>>>> .their`, 
            stderr: '' 
          });
        } else {
          callback(null, { stdout: '', stderr: '' });
        }
      });

      const result = await client.merge('feature-x', 'Merge feature-x into main');

      expect(result.success).toBe(false);
      expect(result.conflicts).toBeDefined();
      expect(result.conflicts?.has_conflicts).toBe(true);
    });

    it('should handle merge failure and abort', async () => {
      mockExec.mockImplementation((cmd, options, callback) => {
        if (cmd.includes('merge-tree')) {
          callback(null, { stdout: 'merged cleanly', stderr: '' });
        } else if (cmd.includes('git merge')) {
          callback(new Error('Merge failed'), null);
        } else if (cmd.includes('merge --abort')) {
          callback(null, { stdout: '', stderr: '' });
        } else {
          callback(new Error('Unexpected command'), null);
        }
      });

      const result = await client.merge('feature-x', 'Merge feature-x into main');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should sanitize commit message', async () => {
      mockExec.mockImplementation((cmd, options, callback) => {
        if (cmd.includes('merge-tree')) {
          callback(null, { stdout: 'merged cleanly', stderr: '' });
        } else if (cmd.includes('git merge')) {
          expect(cmd).not.toContain('";');
          callback(null, { stdout: 'Merge made by recursive strategy.\n abc1234', stderr: '' });
        }
      });

      await client.merge('feature-x', 'Message with "quotes"');
    });
  });

  describe('createCommit', () => {
    it('should create commit with specific files', async () => {
      mockExec.mockImplementation((cmd, options, callback) => {
        if (cmd.includes('git add')) {
          expect(cmd).toContain('src/file1.ts');
          callback(null, { stdout: '', stderr: '' });
        } else if (cmd.includes('git commit')) {
          callback(null, { stdout: '[main abc1234] Test commit', stderr: '' });
        } else {
          callback(new Error('Unexpected command'), null);
        }
      });

      const hash = await client.createCommit('Test commit', ['src/file1.ts']);

      expect(hash).toBe('abc1234');
    });

    it('should create commit with all changes', async () => {
      mockExec.mockImplementation((cmd, options, callback) => {
        if (cmd.includes('git add -A')) {
          callback(null, { stdout: '', stderr: '' });
        } else if (cmd.includes('git commit')) {
          callback(null, { stdout: '[main def5678] Test commit', stderr: '' });
        } else {
          callback(new Error('Unexpected command'), null);
        }
      });

      const hash = await client.createCommit('Test commit');

      expect(hash).toBe('def5678');
    });

    it('should sanitize commit message', async () => {
      mockExec.mockImplementation((cmd, options, callback) => {
        if (cmd.includes('git add')) {
          callback(null, { stdout: '', stderr: '' });
        } else if (cmd.includes('git commit')) {
          expect(cmd).toContain('\\"');
          callback(null, { stdout: '[main abc1234] Test', stderr: '' });
        }
      });

      await client.createCommit('Message with "quotes"');
    });

    it('should throw GitOperationError on commit failure', async () => {
      mockExec.mockImplementation((cmd, options, callback) => {
        if (cmd.includes('git add')) {
          callback(null, { stdout: '', stderr: '' });
        } else {
          callback(new Error('Nothing to commit'), null);
        }
      });

      await expect(client.createCommit('Test')).rejects.toThrow(GitOperationError);
    });

    it('should prevent path traversal in file paths', async () => {
      mockExec.mockImplementation((cmd, options, callback) => {
        callback(null, { stdout: '', stderr: '' });
      });

      await expect(client.createCommit('Test', ['../../../etc/passwd'])).rejects.toThrow(GitOperationError);
    });
  });

  describe('push', () => {
    it('should push to remote successfully', async () => {
      mockExec.mockImplementation((cmd, options, callback) => {
        expect(cmd).toContain('git push origin main');
        callback(null, { stdout: '', stderr: '' });
      });

      await expect(client.push('origin', 'main')).resolves.not.toThrow();
    });

    it('should throw GitOperationError on push failure', async () => {
      mockExec.mockImplementation((cmd, options, callback) => {
        callback(new Error('Permission denied'), null);
      });

      await expect(client.push('origin', 'main')).rejects.toThrow(GitOperationError);
      await expect(client.push('origin', 'main')).rejects.toThrow('Failed to push');
    });

    it('should sanitize remote and branch names', async () => {
      await expect(client.push('origin; rm -rf /', 'main')).rejects.toThrow(GitOperationError);
    });
  });

  describe('createStash', () => {
    it('should create stash successfully', async () => {
      mockExec.mockImplementation((cmd, options, callback) => {
        callback(null, { 
          stdout: 'Saved working directory and index state WIP on main: abc1234 Test message', 
          stderr: '' 
        });
      });

      const stashId = await client.createStash('Backup before merge');

      expect(stashId).toBe('stash@{0}');
    });

    it('should throw GitOperationError on stash failure', async () => {
      mockExec.mockImplementation((cmd, options, callback) => {
        callback(new Error('No local changes to save'), null);
      });

      await expect(client.createStash('Backup')).rejects.toThrow(GitOperationError);
    });

    it('should sanitize stash message', async () => {
      mockExec.mockImplementation((cmd, options, callback) => {
        expect(cmd).toContain('\\"');
        callback(null, { 
          stdout: 'Saved working directory and index state WIP on main: abc1234 Test', 
          stderr: '' 
        });
      });

      await client.createStash('Message with "quotes"');
    });
  });

  describe('applyStash', () => {
    it('should apply stash successfully', async () => {
      mockExec.mockImplementation((cmd, options, callback) => {
        expect(cmd).toContain('git stash apply stash@{0}');
        callback(null, { stdout: '', stderr: '' });
      });

      await expect(client.applyStash('stash@{0}')).resolves.not.toThrow();
    });

    it('should throw GitOperationError on apply failure', async () => {
      mockExec.mockImplementation((cmd, options, callback) => {
        callback(new Error('Stash not found'), null);
      });

      await expect(client.applyStash('stash@{0}')).rejects.toThrow(GitOperationError);
    });

    it('should validate stash ID format', async () => {
      await expect(client.applyStash('invalid-stash')).rejects.toThrow(GitOperationError);
      await expect(client.applyStash('stash@{0}; rm -rf /')).rejects.toThrow(GitOperationError);
    });

    it('should accept valid stash IDs', async () => {
      mockExec.mockImplementation((cmd, options, callback) => {
        callback(null, { stdout: '', stderr: '' });
      });

      await expect(client.applyStash('stash@{0}')).resolves.not.toThrow();
      await expect(client.applyStash('stash@{123}')).resolves.not.toThrow();
    });
  });

  describe('input sanitization', () => {
    it('should reject malicious branch names', async () => {
      await expect(client.diff('main', 'feature; rm -rf /')).rejects.toThrow(GitOperationError);
      await expect(client.diff('main$(whoami)', 'feature')).rejects.toThrow(GitOperationError);
      await expect(client.diff('main`whoami`', 'feature')).rejects.toThrow(GitOperationError);
    });

    it('should accept valid branch names', async () => {
      mockExec.mockImplementation((cmd, options, callback) => {
        callback(null, { stdout: '', stderr: '' });
      });

      await expect(client.diff('main', 'feature-x')).resolves.toBeDefined();
      await expect(client.diff('main', 'feature/test')).resolves.toBeDefined();
      await expect(client.diff('main', 'feature_test')).resolves.toBeDefined();
    });
  });
});
