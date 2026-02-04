import { getLogger } from '../utils/logger';
import { MergeAnalyzer } from '../git/merge';
import { DiffAnalyzer } from '../git/diff';
import type { ConflictInfo, ConflictDetail } from '../git/types';

export interface ConflictCheckOptions {
  checkContent?: boolean;
  checkDeleteModify?: boolean;
  checkRename?: boolean;
  checkMode?: boolean;
}

export interface ConflictReport {
  conflictInfo: ConflictInfo;
  riskLevel: 'none' | 'low' | 'medium' | 'high';
  recommendations: string[];
  canAutoResolve: boolean;
}

export class ConflictDetector {
  private repoPath: string;
  private logger = getLogger();
  private mergeAnalyzer: MergeAnalyzer;
  private diffAnalyzer: DiffAnalyzer;

  constructor(repoPath: string) {
    this.repoPath = repoPath;
    this.mergeAnalyzer = new MergeAnalyzer(repoPath);
    this.diffAnalyzer = new DiffAnalyzer(repoPath);
  }

  async detectConflicts(
    base: string,
    target: string,
    options: ConflictCheckOptions = {}
  ): Promise<ConflictReport> {
    const {
      checkContent = true,
      checkDeleteModify = true,
      checkRename = true,
      checkMode = true,
    } = options;

    try {
      this.logger.info('Running comprehensive conflict detection', {
        base,
        target,
        options,
      });

      const conflictInfo = await this.mergeAnalyzer.checkConflicts(base, target);

      const riskLevel = this.assessRiskLevel(conflictInfo);
      const recommendations = this.generateRecommendations(conflictInfo);
      const canAutoResolve = this.canAutoResolveConflicts(conflictInfo);

      const report: ConflictReport = {
        conflictInfo,
        riskLevel,
        recommendations,
        canAutoResolve,
      };

      this.logger.info('Conflict detection complete', {
        base,
        target,
        hasConflicts: conflictInfo.has_conflicts,
        riskLevel,
        canAutoResolve,
        conflictCount: conflictInfo.details.length,
      });

      return report;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Conflict detection failed', { base, target, error: message });
      throw error;
    }
  }

  async quickCheck(base: string, target: string): Promise<boolean> {
    try {
      this.logger.debug('Running quick conflict check', { base, target });

      const conflictInfo = await this.mergeAnalyzer.checkConflicts(base, target);

      this.logger.debug('Quick check complete', {
        base,
        target,
        hasConflicts: conflictInfo.has_conflicts,
      });

      return conflictInfo.has_conflicts;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Quick conflict check failed', { base, target, error: message });
      throw error;
    }
  }

  async getConflictDetails(base: string, target: string): Promise<ConflictDetail[]> {
    try {
      const conflictInfo = await this.mergeAnalyzer.checkConflicts(base, target);
      return conflictInfo.details;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to get conflict details', { base, target, error: message });
      throw error;
    }
  }

  private assessRiskLevel(conflictInfo: ConflictInfo): 'none' | 'low' | 'medium' | 'high' {
    if (!conflictInfo.has_conflicts) {
      return 'none';
    }

    const contentConflicts = conflictInfo.details.filter(d => d.type === 'content').length;
    const deleteModifyConflicts = conflictInfo.details.filter(d => d.type === 'delete/modify').length;
    const renameConflicts = conflictInfo.details.filter(d => d.type === 'rename').length;
    const modeConflicts = conflictInfo.details.filter(d => d.type === 'mode').length;

    if (deleteModifyConflicts > 0 || renameConflicts > 0) {
      return 'high';
    }

    if (contentConflicts > 5) {
      return 'high';
    }

    if (contentConflicts > 2 || modeConflicts > 2) {
      return 'medium';
    }

    if (contentConflicts > 0 || modeConflicts > 0) {
      return 'low';
    }

    return 'none';
  }

  private generateRecommendations(conflictInfo: ConflictInfo): string[] {
    const recommendations: string[] = [];

    if (!conflictInfo.has_conflicts) {
      recommendations.push('No conflicts detected. Safe to proceed with merge.');
      return recommendations;
    }

    const conflictsByType = this.groupConflictsByType(conflictInfo.details);

    if (conflictsByType.content.length > 0) {
      recommendations.push(
        `Found ${conflictsByType.content.length} content conflict(s). Manual review required.`
      );
      recommendations.push(
        'Review conflicted files and resolve overlapping changes before merging.'
      );
    }

    if (conflictsByType['delete/modify'].length > 0) {
      recommendations.push(
        `Found ${conflictsByType['delete/modify'].length} delete/modify conflict(s). High risk.`
      );
      recommendations.push(
        'Determine whether deleted files should be restored or modifications should be discarded.'
      );
    }

    if (conflictsByType.rename.length > 0) {
      recommendations.push(
        `Found ${conflictsByType.rename.length} rename conflict(s). Choose consistent naming.`
      );
      recommendations.push(
        'Decide on a single rename path or keep both files with different names.'
      );
    }

    if (conflictsByType.mode.length > 0) {
      recommendations.push(
        `Found ${conflictsByType.mode.length} mode conflict(s). Verify file permissions.`
      );
      recommendations.push(
        'Ensure file permissions are set correctly for the target environment.'
      );
    }

    recommendations.push('Abort automatic sync and resolve conflicts manually.');

    return recommendations;
  }

  private canAutoResolveConflicts(conflictInfo: ConflictInfo): boolean {
    if (!conflictInfo.has_conflicts) {
      return true;
    }

    const hasContentConflicts = conflictInfo.details.some(d => d.type === 'content');
    const hasDeleteModifyConflicts = conflictInfo.details.some(d => d.type === 'delete/modify');
    const hasRenameConflicts = conflictInfo.details.some(d => d.type === 'rename');

    return !(hasContentConflicts || hasDeleteModifyConflicts || hasRenameConflicts);
  }

  private groupConflictsByType(details: ConflictDetail[]): Record<string, ConflictDetail[]> {
    const grouped: Record<string, ConflictDetail[]> = {
      content: [],
      'delete/modify': [],
      rename: [],
      mode: [],
    };

    for (const detail of details) {
      if (grouped[detail.type]) {
        grouped[detail.type].push(detail);
      }
    }

    return grouped;
  }
}
