import { exec } from 'child_process';
import { GitOperationError } from '../utils/errors';
import { DiffAnalyzer } from './diff';

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

describe.skip('DiffAnalyzer', () => {
  let analyzer: DiffAnalyzer;
  const repoPath = '/test/repo';

  beforeEach(() => {
    jest.clearAllMocks();
    analyzer = new DiffAnalyzer(repoPath);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('analyzeDetailed', () => {
    it('should analyze detailed diff successfully', async () => {
      const numstatOutput = `10\t5\tsrc/file1.ts
20\t10\tsrc/file2.ts`;

      const nameStatusOutput = `M\tsrc/file1.ts
M\tsrc/file2.ts`;

      let callCount = 0;
      mockExec.mockImplementation((cmd: string, options: any, callback: any) => {
        callCount++;
        if (callCount === 1) {
          callback(null, { stdout: numstatOutput, stderr: '' });
        } else {
          callback(null, { stdout: nameStatusOutput, stderr: '' });
        }
      });

      const result = await analyzer.analyzeDetailed('main', 'feature');

      expect(result.files_changed).toBe(2);
      expect(result.insertions).toBe(30);
      expect(result.deletions).toBe(15);
      expect(result.files).toHaveLength(2);
      expect(result.files[0].path).toBe('src/file1.ts');
      expect(result.files[0].status).toBe('M');
      expect(result.files[0].insertions).toBe(10);
      expect(result.files[0].deletions).toBe(5);
    });

    it('should handle binary files', async () => {
      const numstatOutput = `-\t-\timage.png
10\t5\tsrc/file.ts`;

      const nameStatusOutput = `M\timage.png
M\tsrc/file.ts`;

      let callCount = 0;
      mockExec.mockImplementation((cmd: string, options: any, callback: any) => {
        callCount++;
        if (callCount === 1) {
          callback(null, { stdout: numstatOutput, stderr: '' });
        } else {
          callback(null, { stdout: nameStatusOutput, stderr: '' });
        }
      });

      const result = await analyzer.analyzeDetailed('main', 'feature');

      expect(result.files_changed).toBe(2);
      expect(result.insertions).toBe(10);
      expect(result.deletions).toBe(5);
      expect(result.files[0].binary).toBe(true);
      expect(result.files[1].binary).toBe(false);
    });

    it('should detect renamed files', async () => {
      const numstatOutput = `10\t5\tsrc/newFile.ts`;

      const nameStatusOutput = `R100\tsrc/oldFile.ts\tsrc/newFile.ts`;

      let callCount = 0;
      mockExec.mockImplementation((cmd: string, options: any, callback: any) => {
        callCount++;
        if (callCount === 1) {
          callback(null, { stdout: numstatOutput, stderr: '' });
        } else {
          callback(null, { stdout: nameStatusOutput, stderr: '' });
        }
      });

      const result = await analyzer.analyzeDetailed('main', 'feature');

      expect(result.files).toHaveLength(1);
      expect(result.files[0].status).toBe('R');
      expect(result.files[0].oldPath).toBe('src/oldFile.ts');
      expect(result.files[0].newPath).toBe('src/newFile.ts');
      expect(result.files[0].similarity).toBe(100);
    });

    it('should detect copied files', async () => {
      const numstatOutput = `10\t0\tsrc/copyFile.ts`;

      const nameStatusOutput = `C100\tsrc/originalFile.ts\tsrc/copyFile.ts`;

      let callCount = 0;
      mockExec.mockImplementation((cmd: string, options: any, callback: any) => {
        callCount++;
        if (callCount === 1) {
          callback(null, { stdout: numstatOutput, stderr: '' });
        } else {
          callback(null, { stdout: nameStatusOutput, stderr: '' });
        }
      });

      const result = await analyzer.analyzeDetailed('main', 'feature');

      expect(result.files).toHaveLength(1);
      expect(result.files[0].status).toBe('C');
      expect(result.files[0].oldPath).toBe('src/originalFile.ts');
      expect(result.files[0].newPath).toBe('src/copyFile.ts');
    });

    it('should detect deleted files', async () => {
      const numstatOutput = ``;

      const nameStatusOutput = `D\tsrc/deletedFile.ts`;

      let callCount = 0;
      mockExec.mockImplementation((cmd: string, options: any, callback: any) => {
        callCount++;
        if (callCount === 1) {
          callback(null, { stdout: numstatOutput, stderr: '' });
        } else {
          callback(null, { stdout: nameStatusOutput, stderr: '' });
        }
      });

      const result = await analyzer.analyzeDetailed('main', 'feature');

      expect(result.files).toHaveLength(1);
      expect(result.files[0].status).toBe('D');
      expect(result.files[0].path).toBe('src/deletedFile.ts');
      expect(result.files[0].insertions).toBe(0);
      expect(result.files[0].deletions).toBe(0);
    });

    it('should throw GitOperationError on command failure', async () => {
      mockExec.mockImplementation((cmd: string, options: any, callback: any) => {
        callback(new Error('Command failed'), null, null);
      });

      await expect(analyzer.analyzeDetailed('main', 'feature')).rejects.toThrow(GitOperationError);
    });

  });
});
