import { exec } from 'child_process';
import { promisify } from 'util';
import { GitOperationError } from '../utils/errors';
import { getLogger } from '../utils/logger';
import type { DiffSummary, FileDiff } from './types';

const execAsync = promisify(exec);

export interface DetailedFileDiff extends FileDiff {
  oldPath?: string;
  newPath?: string;
  similarity?: number;
  oldMode?: string;
  newMode?: string;
}

export interface DetailedDiffSummary extends DiffSummary {
  files: DetailedFileDiff[];
}

export class DiffAnalyzer {
  private repoPath: string;
  private logger = getLogger();

  constructor(repoPath: string) {
    this.repoPath = repoPath;
  }

  async analyzeDetailed(base: string, target: string): Promise<DetailedDiffSummary> {
    try {
      this.logger.debug('Analyzing detailed diff', { base, target });

      const sanitizedBase = this.sanitizeBranchName(base);
      const sanitizedTarget = this.sanitizeBranchName(target);

      const { stdout: numstatOutput } = await execAsync(
        `git diff --numstat ${sanitizedBase}...${sanitizedTarget}`,
        { cwd: this.repoPath }
      );

      const { stdout: nameStatusOutput } = await execAsync(
        `git diff --name-status -M -C ${sanitizedBase}...${sanitizedTarget}`,
        { cwd: this.repoPath }
      );

      const files: DetailedFileDiff[] = [];
      const nameStatusMap = this.parseNameStatus(nameStatusOutput);
      const numstatLines = numstatOutput.trim().split('\n').filter(line => line.trim());

      let totalInsertions = 0;
      let totalDeletions = 0;

      for (const line of numstatLines) {
        const parts = line.split('\t');
        if (parts.length < 3) continue;

        const insertions = parts[0] === '-' ? 0 : parseInt(parts[0], 10);
        const deletions = parts[1] === '-' ? 0 : parseInt(parts[1], 10);
        const filePath = parts[2];
        const isBinary = parts[0] === '-' && parts[1] === '-';

        const statusInfo = nameStatusMap.get(filePath) || { status: 'M' as const };

        const fileDiff: DetailedFileDiff = {
          path: filePath,
          status: statusInfo.status,
          insertions,
          deletions,
          binary: isBinary,
          oldPath: statusInfo.oldPath,
          newPath: statusInfo.newPath,
          similarity: statusInfo.similarity,
        };

        files.push(fileDiff);

        if (!isBinary) {
          totalInsertions += insertions;
          totalDeletions += deletions;
        }
      }

      for (const [filePath, statusInfo] of Array.from(nameStatusMap.entries())) {
        if (statusInfo.status === 'D' && !files.find(f => f.path === filePath)) {
          files.push({
            path: filePath,
            status: 'D',
            insertions: 0,
            deletions: 0,
            binary: false,
          });
        }
      }

      const summary: DetailedDiffSummary = {
        files_changed: files.length,
        insertions: totalInsertions,
        deletions: totalDeletions,
        files,
      };

      this.logger.info('Detailed diff analysis complete', {
        base,
        target,
        filesChanged: summary.files_changed,
        insertions: summary.insertions,
        deletions: summary.deletions,
        renames: files.filter(f => f.status === 'R').length,
        copies: files.filter(f => f.status === 'C').length,
      });

      return summary;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to analyze detailed diff', { base, target, error: message });
      throw new GitOperationError(
        `Failed to analyze detailed diff between ${base} and ${target}: ${message}`,
        'git diff --numstat / --name-status'
      );
    }
  }

  async getModeChanges(base: string, target: string): Promise<Map<string, { oldMode: string; newMode: string }>> {
    try {
      const sanitizedBase = this.sanitizeBranchName(base);
      const sanitizedTarget = this.sanitizeBranchName(target);

      const { stdout } = await execAsync(
        `git diff --raw ${sanitizedBase}...${sanitizedTarget}`,
        { cwd: this.repoPath }
      );

      const modeChanges = new Map<string, { oldMode: string; newMode: string }>();
      const lines = stdout.trim().split('\n').filter(line => line.trim());

      for (const line of lines) {
        const match = line.match(/^:(\d+)\s+(\d+)\s+[a-f0-9]+\s+[a-f0-9]+\s+[A-Z]\s+(.+)$/);
        if (match) {
          const [, oldMode, newMode, path] = match;
          if (oldMode !== newMode) {
            modeChanges.set(path, { oldMode, newMode });
          }
        }
      }

      this.logger.debug('Mode changes detected', {
        base,
        target,
        count: modeChanges.size,
      });

      return modeChanges;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to get mode changes', { base, target, error: message });
      throw new GitOperationError(
        `Failed to get mode changes between ${base} and ${target}: ${message}`,
        'git diff --raw'
      );
    }
  }

  private parseNameStatus(output: string): Map<string, {
    status: FileDiff['status'];
    oldPath?: string;
    newPath?: string;
    similarity?: number;
  }> {
    const map = new Map<string, {
      status: FileDiff['status'];
      oldPath?: string;
      newPath?: string;
      similarity?: number;
    }>();

    const lines = output.trim().split('\n').filter(line => line.trim());

    for (const line of lines) {
      const parts = line.split('\t');
      const statusPart = parts[0];

      if (statusPart.startsWith('R')) {
        const similarity = parseInt(statusPart.substring(1), 10);
        const oldPath = parts[1];
        const newPath = parts[2];
        map.set(newPath, {
          status: 'R',
          oldPath,
          newPath,
          similarity,
        });
      } else if (statusPart.startsWith('C')) {
        const similarity = parseInt(statusPart.substring(1), 10);
        const oldPath = parts[1];
        const newPath = parts[2];
        map.set(newPath, {
          status: 'C',
          oldPath,
          newPath,
          similarity,
        });
      } else {
        const status = statusPart.charAt(0) as FileDiff['status'];
        const filePath = parts[1];
        map.set(filePath, { status });
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
