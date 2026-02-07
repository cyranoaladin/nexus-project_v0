import { ConflictDetector } from './conflicts';
import type { ConflictInfo } from '../git/types';
import { MergeAnalyzer } from '../git/merge';

jest.mock('../utils/logger', () => ({
  getLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

jest.mock('../git/merge');
jest.mock('../git/diff');

describe.skip('ConflictDetector', () => {
  let detector: ConflictDetector;
  const repoPath = '/test/repo';
  let mockCheckConflicts: jest.MockedFunction<any>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckConflicts = jest.fn();
    MergeAnalyzer.prototype.checkConflicts = mockCheckConflicts;
    detector = new ConflictDetector(repoPath);
  });

  describe('detectConflicts', () => {
    it('should return report with no conflicts when merge is clean', async () => {
      const mockConflictInfo: ConflictInfo = {
        has_conflicts: false,
        conflicted_files: [],
        details: [],
      };

      mockCheckConflicts.mockResolvedValue(mockConflictInfo);

      const report = await detector.detectConflicts('main', 'feature');

      expect(report.conflictInfo.has_conflicts).toBe(false);
      expect(report.riskLevel).toBe('none');
      expect(report.canAutoResolve).toBe(true);
      expect(report.recommendations).toContain('No conflicts detected. Safe to proceed with merge.');
    });

    it('should assess low risk for single content conflict', async () => {
      const mockConflictInfo: ConflictInfo = {
        has_conflicts: true,
        conflicted_files: ['src/file.ts'],
        details: [
          {
            file: 'src/file.ts',
            type: 'content',
            description: 'Content conflict detected',
          },
        ],
      };

      mockCheckConflicts.mockResolvedValue(mockConflictInfo);

      const report = await detector.detectConflicts('main', 'feature');

      expect(report.riskLevel).toBe('low');
      expect(report.canAutoResolve).toBe(false);
    });

    it('should assess high risk for delete/modify conflicts', async () => {
      const mockConflictInfo: ConflictInfo = {
        has_conflicts: true,
        conflicted_files: ['deleted.ts'],
        details: [
          {
            file: 'deleted.ts',
            type: 'delete/modify',
            description: 'File deleted in main but modified in feature',
          },
        ],
      };

      mockCheckConflicts.mockResolvedValue(mockConflictInfo);

      const report = await detector.detectConflicts('main', 'feature');

      expect(report.riskLevel).toBe('high');
      expect(report.canAutoResolve).toBe(false);
      expect(report.recommendations.some(r => r.includes('delete/modify'))).toBe(true);
    });

    it('should allow auto-resolve for mode conflicts only', async () => {
      const mockConflictInfo: ConflictInfo = {
        has_conflicts: true,
        conflicted_files: ['script.sh'],
        details: [
          {
            file: 'script.sh',
            type: 'mode',
            description: 'File mode conflict',
          },
        ],
      };

      mockCheckConflicts.mockResolvedValue(mockConflictInfo);

      const report = await detector.detectConflicts('main', 'feature');

      expect(report.riskLevel).toBe('low');
      expect(report.canAutoResolve).toBe(true);
    });
  });

  describe('quickCheck', () => {
    it('should return false when no conflicts exist', async () => {
      const mockConflictInfo: ConflictInfo = {
        has_conflicts: false,
        conflicted_files: [],
        details: [],
      };

      mockCheckConflicts.mockResolvedValue(mockConflictInfo);

      const hasConflicts = await detector.quickCheck('main', 'feature');

      expect(hasConflicts).toBe(false);
    });

    it('should return true when conflicts exist', async () => {
      const mockConflictInfo: ConflictInfo = {
        has_conflicts: true,
        conflicted_files: ['file.ts'],
        details: [
          {
            file: 'file.ts',
            type: 'content',
            description: 'Conflict',
          },
        ],
      };

      mockCheckConflicts.mockResolvedValue(mockConflictInfo);

      const hasConflicts = await detector.quickCheck('main', 'feature');

      expect(hasConflicts).toBe(true);
    });
  });

  describe('getConflictDetails', () => {
    it('should return detailed conflict information', async () => {
      const mockConflictInfo: ConflictInfo = {
        has_conflicts: true,
        conflicted_files: ['file1.ts', 'file2.ts'],
        details: [
          {
            file: 'file1.ts',
            type: 'content',
            description: 'Content conflict in file1',
          },
          {
            file: 'file2.ts',
            type: 'delete/modify',
            description: 'Delete/modify conflict in file2',
          },
        ],
      };

      mockCheckConflicts.mockResolvedValue(mockConflictInfo);

      const details = await detector.getConflictDetails('main', 'feature');

      expect(details).toHaveLength(2);
      expect(details[0].file).toBe('file1.ts');
      expect(details[0].type).toBe('content');
      expect(details[1].file).toBe('file2.ts');
      expect(details[1].type).toBe('delete/modify');
    });
  });
});
