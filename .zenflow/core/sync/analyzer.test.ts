import { SyncAnalyzer } from './analyzer';
import { GitClient } from '../git/client';
import { DiffAnalyzer } from '../git/diff';
import type { Worktree, DiffSummary } from '../git/types';
import type { DetailedDiffSummary } from '../git/diff';

jest.mock('../git/client');
jest.mock('../git/diff');
jest.mock('../utils/logger', () => ({
  getLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

describe('SyncAnalyzer', () => {
  let analyzer: SyncAnalyzer;
  let mockGitClient: any;
  let mockDiffAnalyzer: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockGitClient = {
      getWorktree: jest.fn(),
      listWorktrees: jest.fn(),
    };

    mockDiffAnalyzer = {
      analyzeDetailed: jest.fn(),
    };

    (GitClient as any).mockImplementation(() => mockGitClient);
    (DiffAnalyzer as any).mockImplementation(() => mockDiffAnalyzer);

    analyzer = new SyncAnalyzer('/test/repo');
  });

  describe('analyzeDiff', () => {
    it('should analyze diff between worktree and target branch', async () => {
      const mockWorktree: Worktree = {
        path: '/test/worktree',
        branch: 'feature/test',
        commit: 'abc123',
        locked: false,
        prunable: false,
      };

      const mockDetailedDiff: DetailedDiffSummary = {
        files_changed: 3,
        insertions: 100,
        deletions: 50,
        files: [
          {
            path: 'file1.ts',
            status: 'A',
            insertions: 50,
            deletions: 0,
            binary: false,
          },
          {
            path: 'file2.ts',
            status: 'M',
            insertions: 40,
            deletions: 30,
            binary: false,
          },
          {
            path: 'file3.ts',
            status: 'D',
            insertions: 0,
            deletions: 20,
            binary: false,
          },
        ],
      };

      mockGitClient.getWorktree.mockResolvedValue(mockWorktree);
      mockDiffAnalyzer.analyzeDetailed.mockResolvedValue(mockDetailedDiff);

      const result = await analyzer.analyzeDiff('feature/test', 'main');

      expect(mockGitClient.getWorktree).toHaveBeenCalledWith('feature/test');
      expect(mockDiffAnalyzer.analyzeDetailed).toHaveBeenCalledWith('main', 'feature/test');
      expect(result).toEqual({
        files_changed: 3,
        insertions: 100,
        deletions: 50,
        files: mockDetailedDiff.files.map(f => ({
          path: f.path,
          status: f.status,
          insertions: f.insertions,
          deletions: f.deletions,
          binary: f.binary,
        })),
      });
    });

    it('should throw error if worktree not found', async () => {
      mockGitClient.getWorktree.mockResolvedValue(null);

      await expect(analyzer.analyzeDiff('nonexistent')).rejects.toThrow(
        'Worktree for branch nonexistent not found'
      );
    });

    it('should handle binary files', async () => {
      const mockWorktree: Worktree = {
        path: '/test/worktree',
        branch: 'feature/binary',
        commit: 'def456',
        locked: false,
        prunable: false,
      };

      const mockDetailedDiff: DetailedDiffSummary = {
        files_changed: 2,
        insertions: 50,
        deletions: 0,
        files: [
          {
            path: 'image.png',
            status: 'A',
            insertions: 0,
            deletions: 0,
            binary: true,
          },
          {
            path: 'file.ts',
            status: 'M',
            insertions: 50,
            deletions: 0,
            binary: false,
          },
        ],
      };

      mockGitClient.getWorktree.mockResolvedValue(mockWorktree);
      mockDiffAnalyzer.analyzeDetailed.mockResolvedValue(mockDetailedDiff);

      const result = await analyzer.analyzeDiff('feature/binary');

      expect(result.files_changed).toBe(2);
      expect(result.files.find(f => f.binary)).toBeDefined();
    });
  });

  describe('getWorktreeInfo', () => {
    it('should retrieve worktree information', async () => {
      const mockWorktree: Worktree = {
        path: '/test/worktree',
        branch: 'feature/test',
        commit: 'abc123',
        locked: false,
        prunable: false,
      };

      mockGitClient.getWorktree.mockResolvedValue(mockWorktree);

      const result = await analyzer.getWorktreeInfo('feature/test');

      expect(mockGitClient.getWorktree).toHaveBeenCalledWith('feature/test');
      expect(result).toEqual(mockWorktree);
    });

    it('should throw error if worktree not found', async () => {
      mockGitClient.getWorktree.mockResolvedValue(null);

      await expect(analyzer.getWorktreeInfo('nonexistent')).rejects.toThrow(
        'Worktree for branch nonexistent not found'
      );
    });
  });

  describe('listAllWorktrees', () => {
    it('should list all worktrees', async () => {
      const mockWorktrees: Worktree[] = [
        {
          path: '/test/main',
          branch: 'main',
          commit: 'abc123',
          locked: false,
          prunable: false,
        },
        {
          path: '/test/feature',
          branch: 'feature/test',
          commit: 'def456',
          locked: false,
          prunable: false,
        },
      ];

      mockGitClient.listWorktrees.mockResolvedValue(mockWorktrees);

      const result = await analyzer.listAllWorktrees();

      expect(mockGitClient.listWorktrees).toHaveBeenCalled();
      expect(result).toEqual(mockWorktrees);
      expect(result.length).toBe(2);
    });

    it('should return empty array if no worktrees', async () => {
      mockGitClient.listWorktrees.mockResolvedValue([]);

      const result = await analyzer.listAllWorktrees();

      expect(result).toEqual([]);
    });
  });

  describe('categorizeDiff', () => {
    it('should categorize files by status', () => {
      const diff: DiffSummary = {
        files_changed: 5,
        insertions: 100,
        deletions: 50,
        files: [
          { path: 'added.ts', status: 'A', insertions: 30, deletions: 0, binary: false },
          { path: 'modified.ts', status: 'M', insertions: 40, deletions: 20, binary: false },
          { path: 'deleted.ts', status: 'D', insertions: 0, deletions: 30, binary: false },
          { path: 'renamed.ts', status: 'R', insertions: 20, deletions: 0, binary: false },
          { path: 'copied.ts', status: 'C', insertions: 10, deletions: 0, binary: false },
        ],
      };

      const result = analyzer.categorizeDiff(diff);

      expect(result.added).toEqual(['added.ts']);
      expect(result.modified).toEqual(['modified.ts']);
      expect(result.deleted).toEqual(['deleted.ts']);
      expect(result.renamed).toEqual(['renamed.ts']);
      expect(result.copied).toEqual(['copied.ts']);
      expect(result.binary).toEqual([]);
    });

    it('should identify binary files', () => {
      const diff: DiffSummary = {
        files_changed: 3,
        insertions: 50,
        deletions: 0,
        files: [
          { path: 'text.ts', status: 'M', insertions: 50, deletions: 0, binary: false },
          { path: 'image.png', status: 'A', insertions: 0, deletions: 0, binary: true },
          { path: 'binary.dat', status: 'M', insertions: 0, deletions: 0, binary: true },
        ],
      };

      const result = analyzer.categorizeDiff(diff);

      expect(result.binary).toEqual(['image.png', 'binary.dat']);
    });
  });

  describe('calculateImpact', () => {
    it('should classify low impact changes', () => {
      const diff: DiffSummary = {
        files_changed: 2,
        insertions: 30,
        deletions: 20,
        files: [
          { path: 'file1.ts', status: 'M', insertions: 20, deletions: 10, binary: false },
          { path: 'file2.ts', status: 'M', insertions: 10, deletions: 10, binary: false },
        ],
      };

      const result = analyzer.calculateImpact(diff);

      expect(result.totalLines).toBe(50);
      expect(result.impactLevel).toBe('low');
      expect(result.riskFactors).toEqual([]);
    });

    it('should classify medium impact changes', () => {
      const diff: DiffSummary = {
        files_changed: 10,
        insertions: 80,
        deletions: 50,
        files: Array.from({ length: 10 }, (_, i) => ({
          path: `file${i}.ts`,
          status: 'M' as const,
          insertions: 8,
          deletions: 5,
          binary: false,
        })),
      };

      const result = analyzer.calculateImpact(diff);

      expect(result.totalLines).toBe(130);
      expect(result.impactLevel).toBe('medium');
      expect(result.riskFactors).toContain('Medium change (>100 lines)');
    });

    it('should classify high impact changes', () => {
      const diff: DiffSummary = {
        files_changed: 20,
        insertions: 400,
        deletions: 200,
        files: Array.from({ length: 20 }, (_, i) => ({
          path: `file${i}.ts`,
          status: 'M' as const,
          insertions: 20,
          deletions: 10,
          binary: false,
        })),
      };

      const result = analyzer.calculateImpact(diff);

      expect(result.totalLines).toBe(600);
      expect(result.impactLevel).toBe('high');
      expect(result.riskFactors).toContain('Large change (>500 lines)');
    });

    it('should classify critical impact changes', () => {
      const diff: DiffSummary = {
        files_changed: 100,
        insertions: 800,
        deletions: 400,
        files: Array.from({ length: 100 }, (_, i) => ({
          path: `file${i}.ts`,
          status: 'M' as const,
          insertions: 8,
          deletions: 4,
          binary: false,
        })),
      };

      const result = analyzer.calculateImpact(diff);

      expect(result.totalLines).toBe(1200);
      expect(result.impactLevel).toBe('critical');
      expect(result.riskFactors).toContain('Very large change (>1000 lines)');
      expect(result.riskFactors).toContain('Many files changed (>50)');
    });

    it('should detect binary file risk', () => {
      const diff: DiffSummary = {
        files_changed: 5,
        insertions: 50,
        deletions: 20,
        files: [
          { path: 'file1.ts', status: 'M', insertions: 50, deletions: 20, binary: false },
          { path: 'image1.png', status: 'A', insertions: 0, deletions: 0, binary: true },
          { path: 'image2.jpg', status: 'M', insertions: 0, deletions: 0, binary: true },
          { path: 'binary.dat', status: 'M', insertions: 0, deletions: 0, binary: true },
        ],
      };

      const result = analyzer.calculateImpact(diff);

      expect(result.riskFactors).toContain('Binary files modified (3)');
    });

    it('should detect many deletions risk', () => {
      const diff: DiffSummary = {
        files_changed: 15,
        insertions: 10,
        deletions: 50,
        files: [
          ...Array.from({ length: 12 }, (_, i) => ({
            path: `deleted${i}.ts`,
            status: 'D' as const,
            insertions: 0,
            deletions: 4,
            binary: false,
          })),
          { path: 'file1.ts', status: 'M', insertions: 10, deletions: 2, binary: false },
        ],
      };

      const result = analyzer.calculateImpact(diff);

      expect(result.riskFactors).toContain('Many files deleted (12)');
    });
  });
});
