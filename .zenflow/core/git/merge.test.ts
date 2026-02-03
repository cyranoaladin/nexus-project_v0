import { exec } from 'child_process';
import { MergeAnalyzer } from './merge';
import { GitOperationError } from '../utils/errors';

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

describe('MergeAnalyzer', () => {
  let analyzer: MergeAnalyzer;
  const repoPath = '/test/repo';

  beforeEach(() => {
    analyzer = new MergeAnalyzer(repoPath);
    jest.clearAllMocks();
  });

  describe('checkConflicts', () => {
    it('should detect no conflicts when branches are compatible', async () => {
      mockExec.mockImplementation((cmd, opts, callback) => {
        if (cmd.includes('merge-base')) {
          callback(null, { stdout: 'abc123\n', stderr: '' });
        } else if (cmd.includes('merge-tree')) {
          callback(null, { stdout: 'clean merge output', stderr: '' });
        } else {
          callback(null, { stdout: '', stderr: '' });
        }
      });

      const result = await analyzer.checkConflicts('main', 'feature');

      expect(result.has_conflicts).toBe(false);
      expect(result.conflicted_files).toHaveLength(0);
      expect(result.details).toHaveLength(0);
    });

    it('should detect content conflicts', async () => {
      const mergeTreeOutput = `diff --cc src/file.ts
index abc123..def456
--- a/src/file.ts
+++ b/src/file.ts
@@@ -1,3 -1,3 +1,7 @@@
++<<<<<<< .our
 +const x = 1;
++=======
+ const x = 2;
++>>>>>>> .their`;

      mockExec.mockImplementation((cmd, opts, callback) => {
        if (cmd.includes('merge-base')) {
          callback(null, { stdout: 'abc123\n', stderr: '' });
        } else if (cmd.includes('merge-tree')) {
          callback(null, { stdout: mergeTreeOutput, stderr: '' });
        } else {
          callback(null, { stdout: '', stderr: '' });
        }
      });

      const result = await analyzer.checkConflicts('main', 'feature');

      expect(result.has_conflicts).toBe(true);
      expect(result.conflicted_files).toContain('src/file.ts');
      expect(result.details.some(d => d.type === 'content')).toBe(true);
    });

    it('should throw GitOperationError on invalid branch name', async () => {
      await expect(analyzer.checkConflicts('main; rm -rf /', 'feature')).rejects.toThrow(
        GitOperationError
      );
    });
  });
});
