import { DiffAnalyzer } from '../git/diff';
import { GitClient } from '../git/client';
import { getLogger } from '../utils/logger';
import type { DiffSummary, Worktree } from '../git/types';
import { ValidationError } from '../utils/errors';

export class SyncAnalyzer {
  private repoPath: string;
  private gitClient: GitClient;
  private diffAnalyzer: DiffAnalyzer;
  private logger = getLogger();

  constructor(repoPath: string) {
    this.repoPath = repoPath;
    this.gitClient = new GitClient(repoPath);
    this.diffAnalyzer = new DiffAnalyzer(repoPath);
  }

  async analyzeDiff(worktreeBranch: string, targetBranch: string = 'main'): Promise<DiffSummary> {
    try {
      this.logger.info('Analyzing diff for worktree', {
        worktreeBranch,
        targetBranch,
      });

      const worktree = await this.gitClient.getWorktree(worktreeBranch);
      if (!worktree) {
        throw new ValidationError(`Worktree for branch ${worktreeBranch} not found`);
      }

      const detailedDiff = await this.diffAnalyzer.analyzeDetailed(targetBranch, worktreeBranch);

      const summary: DiffSummary = {
        files_changed: detailedDiff.files_changed,
        insertions: detailedDiff.insertions,
        deletions: detailedDiff.deletions,
        files: detailedDiff.files.map(file => ({
          path: file.path,
          status: file.status,
          insertions: file.insertions,
          deletions: file.deletions,
          binary: file.binary,
        })),
      };

      this.logger.info('Diff analysis complete', {
        worktreeBranch,
        filesChanged: summary.files_changed,
        insertions: summary.insertions,
        deletions: summary.deletions,
        addedFiles: summary.files.filter(f => f.status === 'A').length,
        modifiedFiles: summary.files.filter(f => f.status === 'M').length,
        deletedFiles: summary.files.filter(f => f.status === 'D').length,
        renamedFiles: summary.files.filter(f => f.status === 'R').length,
        copiedFiles: summary.files.filter(f => f.status === 'C').length,
        binaryFiles: summary.files.filter(f => f.binary).length,
      });

      return summary;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to analyze diff', {
        worktreeBranch,
        targetBranch,
        error: message,
      });
      throw error;
    }
  }

  async getWorktreeInfo(branch: string): Promise<Worktree> {
    try {
      this.logger.debug('Getting worktree info', { branch });

      const worktree = await this.gitClient.getWorktree(branch);
      if (!worktree) {
        throw new ValidationError(`Worktree for branch ${branch} not found`);
      }

      this.logger.debug('Worktree info retrieved', {
        branch,
        path: worktree.path,
        commit: worktree.commit,
        locked: worktree.locked,
        prunable: worktree.prunable,
      });

      return worktree;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to get worktree info', { branch, error: message });
      throw error;
    }
  }

  async listAllWorktrees(): Promise<Worktree[]> {
    try {
      this.logger.debug('Listing all worktrees');
      const worktrees = await this.gitClient.listWorktrees();
      
      this.logger.info('Worktrees listed', { count: worktrees.length });
      return worktrees;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to list worktrees', { error: message });
      throw error;
    }
  }

  categorizeDiff(diff: DiffSummary): {
    added: string[];
    modified: string[];
    deleted: string[];
    renamed: string[];
    copied: string[];
    binary: string[];
  } {
    const categorized = {
      added: [] as string[],
      modified: [] as string[],
      deleted: [] as string[],
      renamed: [] as string[],
      copied: [] as string[],
      binary: [] as string[],
    };

    for (const file of diff.files) {
      if (file.binary) {
        categorized.binary.push(file.path);
      }

      switch (file.status) {
        case 'A':
          categorized.added.push(file.path);
          break;
        case 'M':
          categorized.modified.push(file.path);
          break;
        case 'D':
          categorized.deleted.push(file.path);
          break;
        case 'R':
          categorized.renamed.push(file.path);
          break;
        case 'C':
          categorized.copied.push(file.path);
          break;
      }
    }

    this.logger.debug('Diff categorized', {
      added: categorized.added.length,
      modified: categorized.modified.length,
      deleted: categorized.deleted.length,
      renamed: categorized.renamed.length,
      copied: categorized.copied.length,
      binary: categorized.binary.length,
    });

    return categorized;
  }

  calculateImpact(diff: DiffSummary): {
    totalLines: number;
    impactLevel: 'low' | 'medium' | 'high' | 'critical';
    riskFactors: string[];
  } {
    const totalLines = diff.insertions + diff.deletions;
    const binaryCount = diff.files.filter(f => f.binary).length;
    const deletedCount = diff.files.filter(f => f.status === 'D').length;

    const riskFactors: string[] = [];
    let impactLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';

    if (totalLines > 1000) {
      impactLevel = 'critical';
      riskFactors.push('Very large change (>1000 lines)');
    } else if (totalLines > 500) {
      impactLevel = 'high';
      riskFactors.push('Large change (>500 lines)');
    } else if (totalLines > 100) {
      impactLevel = 'medium';
      riskFactors.push('Medium change (>100 lines)');
    }

    if (diff.files_changed > 50) {
      riskFactors.push('Many files changed (>50)');
      if (impactLevel === 'low') impactLevel = 'medium';
    }

    if (binaryCount > 0) {
      riskFactors.push(`Binary files modified (${binaryCount})`);
    }

    if (deletedCount > 10) {
      riskFactors.push(`Many files deleted (${deletedCount})`);
      if (impactLevel === 'low') impactLevel = 'medium';
    }

    this.logger.debug('Impact calculated', {
      totalLines,
      impactLevel,
      riskFactors,
    });

    return {
      totalLines,
      impactLevel,
      riskFactors,
    };
  }
}
