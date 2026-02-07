import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { GitOperationError } from '../utils/errors';
import { getLogger } from '../utils/logger';
import { SecurityValidator } from '../utils/security';
import type { Worktree, DiffSummary, FileDiff, ConflictInfo, MergeResult } from './types';

const execAsync = promisify(exec);

export class GitClient {
  private repoPath: string;
  private logger = getLogger();

  constructor(repoPath: string) {
    this.repoPath = path.resolve(repoPath);
  }

  async getCurrentBranch(): Promise<string> {
    try {
      this.logger.debug('Getting current branch', { repoPath: this.repoPath });

      const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD', {
        cwd: this.repoPath,
      });

      const branch = stdout.trim();
      this.logger.debug('Current branch', { branch });
      return branch;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to get current branch', { error: message });
      throw new GitOperationError(
        `Failed to get current branch: ${message}`,
        'git rev-parse --abbrev-ref HEAD'
      );
    }
  }

  async listWorktrees(): Promise<Worktree[]> {
    try {
      this.logger.debug('Listing worktrees', { repoPath: this.repoPath });

      const { stdout } = await execAsync('git worktree list --porcelain', {
        cwd: this.repoPath,
      });

      const worktrees: Worktree[] = [];
      const lines = stdout.trim().split('\n');
      let currentWorktree: Partial<Worktree> = {};

      for (const line of lines) {
        if (line === '') {
          if (currentWorktree.path) {
            worktrees.push({
              path: currentWorktree.path,
              branch: currentWorktree.branch || '',
              commit: currentWorktree.commit || '',
              locked: currentWorktree.locked || false,
              prunable: currentWorktree.prunable || false,
            });
          }
          currentWorktree = {};
          continue;
        }

        if (line.startsWith('worktree ')) {
          currentWorktree.path = line.substring(9);
        } else if (line.startsWith('HEAD ')) {
          currentWorktree.commit = line.substring(5);
        } else if (line.startsWith('branch ')) {
          currentWorktree.branch = line.substring(7);
        } else if (line === 'locked') {
          currentWorktree.locked = true;
        } else if (line === 'prunable') {
          currentWorktree.prunable = true;
        }
      }

      if (currentWorktree.path) {
        worktrees.push({
          path: currentWorktree.path,
          branch: currentWorktree.branch || '',
          commit: currentWorktree.commit || '',
          locked: currentWorktree.locked || false,
          prunable: currentWorktree.prunable || false,
        });
      }

      this.logger.info(`Found ${worktrees.length} worktrees`);
      return worktrees;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to list worktrees', { error: message });
      throw new GitOperationError(
        `Failed to list worktrees: ${message}`,
        'git worktree list --porcelain'
      );
    }
  }

  async getWorktree(branch: string): Promise<Worktree | null> {
    try {
      this.logger.debug('Getting worktree for branch', { branch });

      const worktrees = await this.listWorktrees();
      const worktree = worktrees.find(wt => wt.branch === branch || wt.branch === `refs/heads/${branch}`);

      if (worktree) {
        this.logger.debug('Found worktree', { branch, path: worktree.path });
      } else {
        this.logger.debug('Worktree not found', { branch });
      }

      return worktree || null;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to get worktree', { branch, error: message });
      throw new GitOperationError(
        `Failed to get worktree for branch ${branch}: ${message}`,
        'git worktree list --porcelain'
      );
    }
  }

  async diff(base: string, target: string): Promise<DiffSummary> {
    try {
      this.logger.debug('Computing diff', { base, target });

      const sanitizedBase = SecurityValidator.validateBranchName(base);
      const sanitizedTarget = SecurityValidator.validateBranchName(target);

      const { stdout } = await execAsync(
        `git diff --stat --numstat ${sanitizedBase}...${sanitizedTarget}`,
        { cwd: this.repoPath }
      );

      const lines = stdout.trim().split('\n');
      const files: FileDiff[] = [];
      let totalInsertions = 0;
      let totalDeletions = 0;

      for (const line of lines) {
        if (!line.trim()) continue;

        const parts = line.split('\t');
        if (parts.length < 3) continue;

        const insertions = parts[0] === '-' ? 0 : parseInt(parts[0], 10);
        const deletions = parts[1] === '-' ? 0 : parseInt(parts[1], 10);
        const filePath = parts[2];

        const isBinary = parts[0] === '-' && parts[1] === '-';

        let status: FileDiff['status'] = 'M';
        if (insertions > 0 && deletions === 0) status = 'A';
        else if (insertions === 0 && deletions > 0) status = 'D';

        files.push({
          path: filePath,
          status,
          insertions,
          deletions,
          binary: isBinary,
        });

        if (!isBinary) {
          totalInsertions += insertions;
          totalDeletions += deletions;
        }
      }

      const summary: DiffSummary = {
        files_changed: files.length,
        insertions: totalInsertions,
        deletions: totalDeletions,
        files,
      };

      this.logger.info('Diff computed', {
        base,
        target,
        filesChanged: summary.files_changed,
        insertions: summary.insertions,
        deletions: summary.deletions,
      });

      return summary;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to compute diff', { base, target, error: message });
      throw new GitOperationError(
        `Failed to compute diff between ${base} and ${target}: ${message}`,
        'git diff --stat --numstat'
      );
    }
  }

  async checkConflicts(base: string, target: string): Promise<ConflictInfo> {
    try {
      this.logger.debug('Checking for conflicts', { base, target });

      const sanitizedBase = SecurityValidator.validateBranchName(base);
      const sanitizedTarget = SecurityValidator.validateBranchName(target);

      const { stdout } = await execAsync(
        `git merge-tree $(git merge-base ${sanitizedBase} ${sanitizedTarget}) ${sanitizedBase} ${sanitizedTarget}`,
        { cwd: this.repoPath }
      );

      const conflictMarkers = stdout.match(/<<<<<<<|>>>>>>>/g);
      const hasConflicts = conflictMarkers !== null && conflictMarkers.length > 0;

      const conflictInfo: ConflictInfo = {
        has_conflicts: hasConflicts,
        conflicted_files: [],
        details: [],
      };

      if (hasConflicts) {
        const conflictedFilesSet = new Set<string>();
        const lines = stdout.split('\n');

        let currentFile: string | null = null;
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];

          const fileDiffMatch = line.match(/^\+\+\+ [ab]\/(.+)$/);
          if (fileDiffMatch) {
            currentFile = fileDiffMatch[1];
          }

          if (line.includes('<<<<<<<') && currentFile) {
            conflictedFilesSet.add(currentFile);
            conflictInfo.details.push({
              file: currentFile,
              type: 'content',
              description: 'Content conflict detected',
            });
          }
        }

        conflictInfo.conflicted_files = Array.from(conflictedFilesSet);
        this.logger.warn('Conflicts detected', {
          base,
          target,
          conflictedFiles: conflictInfo.conflicted_files,
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
        'git merge-tree'
      );
    }
  }

  async merge(branch: string, message: string): Promise<MergeResult> {
    try {
      this.logger.info('Starting merge', { branch, message });

      const conflicts = await this.checkConflicts('HEAD', branch);

      if (conflicts.has_conflicts) {
        this.logger.warn('Merge aborted due to conflicts', {
          branch,
          conflictedFiles: conflicts.conflicted_files,
        });
        return {
          success: false,
          conflicts,
          error: 'Merge would result in conflicts',
        };
      }

      const sanitizedBranch = SecurityValidator.validateBranchName(branch);
      const sanitizedMessage = SecurityValidator.sanitizeCommitMessage(message);

      const { stdout } = await execAsync(
        `git merge --no-ff -m "${sanitizedMessage}" ${sanitizedBranch}`,
        { cwd: this.repoPath }
      );

      const commitHashMatch = stdout.match(/Merge made by .+ strategy\.\n\s*([a-f0-9]{7,40})/);
      const commitHash = commitHashMatch ? commitHashMatch[1] : undefined;

      this.logger.info('Merge completed successfully', { branch, commitHash });

      return {
        success: true,
        commit_hash: commitHash,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Merge failed', { branch, error: message });

      try {
        await execAsync('git merge --abort', { cwd: this.repoPath });
        this.logger.info('Merge aborted');
      } catch (abortError) {
        this.logger.warn('Failed to abort merge', {
          error: abortError instanceof Error ? abortError.message : String(abortError),
        });
      }

      return {
        success: false,
        error: message,
      };
    }
  }

  async createCommit(message: string, files?: string[]): Promise<string> {
    try {
      this.logger.debug('Creating commit', { message, filesCount: files?.length });

      if (files && files.length > 0) {
        const sanitizedFiles = files.map(f => {
          const validated = SecurityValidator.validateFilePath(f, this.repoPath);
          return SecurityValidator.escapeShellArg(validated);
        });
        await execAsync(`git add ${sanitizedFiles.join(' ')}`, { cwd: this.repoPath });
        this.logger.debug('Files staged', { count: files.length });
      } else {
        await execAsync('git add -A', { cwd: this.repoPath });
        this.logger.debug('All changes staged');
      }

      const sanitizedMessage = SecurityValidator.sanitizeCommitMessage(message);

      const { stdout } = await execAsync(
        `git commit -m "${sanitizedMessage}"`,
        { cwd: this.repoPath }
      );

      const commitHashMatch = stdout.match(/\[.+ ([a-f0-9]{7,40})\]/);
      const commitHash = commitHashMatch ? commitHashMatch[1] : '';

      this.logger.info('Commit created', { commitHash, message });

      return commitHash;
    } catch (error) {
      const message_str = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to create commit', { message, error: message_str });
      throw new GitOperationError(
        `Failed to create commit: ${message_str}`,
        'git commit'
      );
    }
  }

  async push(remote: string, branch: string): Promise<void> {
    try {
      this.logger.info('Pushing to remote', { remote, branch });

      const sanitizedRemote = SecurityValidator.validateRemoteName(remote);
      const sanitizedBranch = SecurityValidator.validateBranchName(branch);

      await execAsync(
        `git push ${sanitizedRemote} ${sanitizedBranch}`,
        { cwd: this.repoPath, timeout: 60000 }
      );

      this.logger.info('Push completed successfully', { remote, branch });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Push failed', { remote, branch, error: message });
      throw new GitOperationError(
        `Failed to push to ${remote}/${branch}: ${message}`,
        'git push'
      );
    }
  }

  async createStash(message: string): Promise<string> {
    try {
      this.logger.debug('Creating stash', { message });

      const sanitizedMessage = SecurityValidator.sanitizeCommitMessage(message);

      const { stdout } = await execAsync(
        `git stash push -m "${sanitizedMessage}"`,
        { cwd: this.repoPath }
      );

      const stashMatch = stdout.match(/Saved working directory and index state .+: (.+)/);
      const stashId = stashMatch ? 'stash@{0}' : '';

      this.logger.info('Stash created', { stashId, message });

      return stashId;
    } catch (error) {
      const message_str = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to create stash', { message, error: message_str });
      throw new GitOperationError(
        `Failed to create stash: ${message_str}`,
        'git stash push'
      );
    }
  }

  async applyStash(stashId: string): Promise<void> {
    try {
      this.logger.info('Applying stash', { stashId });

      const sanitizedStashId = SecurityValidator.validateStashId(stashId);

      await execAsync(
        `git stash apply ${sanitizedStashId}`,
        { cwd: this.repoPath }
      );

      this.logger.info('Stash applied successfully', { stashId });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to apply stash', { stashId, error: message });
      throw new GitOperationError(
        `Failed to apply stash ${stashId}: ${message}`,
        'git stash apply'
      );
    }
  }

}
