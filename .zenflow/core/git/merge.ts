import { exec } from 'child_process';
import { promisify } from 'util';
import { GitOperationError } from '../utils/errors';
import { getLogger } from '../utils/logger';
import type { ConflictInfo, ConflictDetail } from './types';
import { DiffAnalyzer } from './diff';

const execAsync = promisify(exec);

export interface MergeTreeResult {
  hasConflicts: boolean;
  conflictedFiles: Set<string>;
  contentConflicts: ConflictDetail[];
  deleteModifyConflicts: ConflictDetail[];
  renameConflicts: ConflictDetail[];
  modeConflicts: ConflictDetail[];
}

export class MergeAnalyzer {
  private repoPath: string;
  private logger = getLogger();
  private diffAnalyzer: DiffAnalyzer;

  constructor(repoPath: string) {
    this.repoPath = repoPath;
    this.diffAnalyzer = new DiffAnalyzer(repoPath);
  }

  async checkConflicts(base: string, target: string): Promise<ConflictInfo> {
    try {
      this.logger.debug('Checking conflicts with merge-tree', { base, target });

      const mergeTreeResult = await this.analyzeMergeTree(base, target);
      const deleteModifyConflicts = await this.detectDeleteModifyConflicts(base, target);
      const renameConflicts = await this.detectRenameConflicts(base, target);
      const modeConflicts = await this.detectModeConflicts(base, target);

      const allConflictedFiles = new Set<string>([
        ...Array.from(mergeTreeResult.conflictedFiles),
        ...deleteModifyConflicts.map(c => c.file),
        ...renameConflicts.map(c => c.file),
        ...modeConflicts.map(c => c.file),
      ]);

      const allDetails = [
        ...mergeTreeResult.contentConflicts,
        ...deleteModifyConflicts,
        ...renameConflicts,
        ...modeConflicts,
      ];

      const conflictInfo: ConflictInfo = {
        has_conflicts: allConflictedFiles.size > 0,
        conflicted_files: Array.from(allConflictedFiles),
        details: allDetails,
      };

      if (conflictInfo.has_conflicts) {
        this.logger.warn('Conflicts detected', {
          base,
          target,
          totalConflicts: conflictInfo.details.length,
          conflictedFiles: conflictInfo.conflicted_files,
          byType: {
            content: mergeTreeResult.contentConflicts.length,
            deleteModify: deleteModifyConflicts.length,
            rename: renameConflicts.length,
            mode: modeConflicts.length,
          },
        });
      } else {
        this.logger.info('No conflicts detected', { base, target });
      }

      return conflictInfo;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to check conflicts', { base, target, error: message });
      throw new GitOperationError(
        `Failed to check conflicts between ${base} and ${target}: ${message}`,
        'merge conflict detection'
      );
    }
  }

  private async analyzeMergeTree(base: string, target: string): Promise<MergeTreeResult> {
    try {
      const sanitizedBase = this.sanitizeBranchName(base);
      const sanitizedTarget = this.sanitizeBranchName(target);

      const { stdout: mergeBaseOutput } = await execAsync(
        `git merge-base ${sanitizedBase} ${sanitizedTarget}`,
        { cwd: this.repoPath }
      );
      const mergeBase = mergeBaseOutput.trim();

      const { stdout } = await execAsync(
        `git merge-tree ${mergeBase} ${sanitizedBase} ${sanitizedTarget}`,
        { cwd: this.repoPath, maxBuffer: 50 * 1024 * 1024 }
      );

      const conflictMarkers = stdout.match(/<<<<<<<|>>>>>>>/g);
      const hasConflicts = conflictMarkers !== null && conflictMarkers.length > 0;

      const conflictedFiles = new Set<string>();
      const contentConflicts: ConflictDetail[] = [];

      if (hasConflicts) {
        const lines = stdout.split('\n');
        let currentFile: string | null = null;

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];

          const fileDiffMatch = line.match(/^\+\+\+ [ab]\/(.+)$/);
          if (fileDiffMatch) {
            currentFile = fileDiffMatch[1];
          }

          if (line.includes('<<<<<<<') && currentFile) {
            conflictedFiles.add(currentFile);

            let endLine = i;
            for (let j = i + 1; j < lines.length; j++) {
              if (lines[j].includes('>>>>>>>')) {
                endLine = j;
                break;
              }
            }

            const conflictLines = lines.slice(i, endLine + 1);
            const baseContent = conflictLines
              .slice(1, conflictLines.findIndex(l => l.includes('=======')))
              .join('\n');
            const targetContent = conflictLines
              .slice(conflictLines.findIndex(l => l.includes('=======')) + 1, -1)
              .join('\n');

            contentConflicts.push({
              file: currentFile,
              type: 'content',
              description: `Content conflict: base has "${baseContent.substring(0, 50)}...", target has "${targetContent.substring(0, 50)}..."`,
            });
          }
        }
      }

      return {
        hasConflicts,
        conflictedFiles,
        contentConflicts,
        deleteModifyConflicts: [],
        renameConflicts: [],
        modeConflicts: [],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new GitOperationError(
        `Failed to analyze merge-tree: ${message}`,
        'git merge-tree'
      );
    }
  }

  private async detectDeleteModifyConflicts(base: string, target: string): Promise<ConflictDetail[]> {
    try {
      const sanitizedBase = this.sanitizeBranchName(base);
      const sanitizedTarget = this.sanitizeBranchName(target);

      const { stdout: baseToTarget } = await execAsync(
        `git diff --name-status ${sanitizedBase}...${sanitizedTarget}`,
        { cwd: this.repoPath }
      );

      const { stdout: targetToBase } = await execAsync(
        `git diff --name-status ${sanitizedTarget}...${sanitizedBase}`,
        { cwd: this.repoPath }
      );

      const baseChanges = this.parseNameStatus(baseToTarget);
      const targetChanges = this.parseNameStatus(targetToBase);

      const conflicts: ConflictDetail[] = [];

      for (const [file, baseStatus] of Array.from(baseChanges.entries())) {
        const targetStatus = targetChanges.get(file);

        if (baseStatus === 'D' && targetStatus === 'M') {
          conflicts.push({
            file,
            type: 'delete/modify',
            description: `File deleted in ${base} but modified in ${target}`,
          });
        } else if (baseStatus === 'M' && targetStatus === 'D') {
          conflicts.push({
            file,
            type: 'delete/modify',
            description: `File modified in ${base} but deleted in ${target}`,
          });
        }
      }

      return conflicts;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new GitOperationError(
        `Failed to detect delete/modify conflicts: ${message}`,
        'git diff --name-status'
      );
    }
  }

  private async detectRenameConflicts(base: string, target: string): Promise<ConflictDetail[]> {
    try {
      const sanitizedBase = this.sanitizeBranchName(base);
      const sanitizedTarget = this.sanitizeBranchName(target);

      const { stdout: baseRenames } = await execAsync(
        `git diff --name-status -M ${sanitizedBase}...${sanitizedTarget}`,
        { cwd: this.repoPath }
      );

      const { stdout: targetRenames } = await execAsync(
        `git diff --name-status -M ${sanitizedTarget}...${sanitizedBase}`,
        { cwd: this.repoPath }
      );

      const baseRenameMap = new Map<string, string>();
      const targetRenameMap = new Map<string, string>();

      for (const line of baseRenames.trim().split('\n')) {
        if (line.startsWith('R')) {
          const parts = line.split('\t');
          if (parts.length >= 3) {
            baseRenameMap.set(parts[1], parts[2]);
          }
        }
      }

      for (const line of targetRenames.trim().split('\n')) {
        if (line.startsWith('R')) {
          const parts = line.split('\t');
          if (parts.length >= 3) {
            targetRenameMap.set(parts[1], parts[2]);
          }
        }
      }

      const conflicts: ConflictDetail[] = [];

      for (const [oldPath, newPathInBase] of Array.from(baseRenameMap.entries())) {
        const newPathInTarget = targetRenameMap.get(oldPath);
        if (newPathInTarget && newPathInBase !== newPathInTarget) {
          conflicts.push({
            file: oldPath,
            type: 'rename',
            description: `File renamed to different paths: ${newPathInBase} in ${base}, ${newPathInTarget} in ${target}`,
          });
        }
      }

      return conflicts;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new GitOperationError(
        `Failed to detect rename conflicts: ${message}`,
        'git diff --name-status -M'
      );
    }
  }

  private async detectModeConflicts(base: string, target: string): Promise<ConflictDetail[]> {
    try {
      const modeChangesInBase = await this.diffAnalyzer.getModeChanges('HEAD', base);
      const modeChangesInTarget = await this.diffAnalyzer.getModeChanges('HEAD', target);

      const conflicts: ConflictDetail[] = [];

      for (const [file, baseChange] of Array.from(modeChangesInBase.entries())) {
        const targetChange = modeChangesInTarget.get(file);
        if (targetChange && baseChange.newMode !== targetChange.newMode) {
          conflicts.push({
            file,
            type: 'mode',
            description: `File mode conflict: ${baseChange.newMode} in ${base}, ${targetChange.newMode} in ${target}`,
          });
        }
      }

      return conflicts;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new GitOperationError(
        `Failed to detect mode conflicts: ${message}`,
        'mode change detection'
      );
    }
  }

  private parseNameStatus(output: string): Map<string, string> {
    const map = new Map<string, string>();
    const lines = output.trim().split('\n').filter(line => line.trim());

    for (const line of lines) {
      const parts = line.split('\t');
      const statusPart = parts[0];
      const status = statusPart.charAt(0);

      if (status === 'R' && parts.length >= 3) {
        map.set(parts[2], status);
      } else if (parts.length >= 2) {
        map.set(parts[1], status);
      }
    }

    return map;
  }

  private sanitizeBranchName(branch: string): string {
    if (!/^[a-zA-Z0-9/_-]+$/.test(branch)) {
      throw new GitOperationError(
        `Invalid branch name: ${branch}`,
        undefined
      );
    }
    return branch;
  }
}
