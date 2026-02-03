import { exec } from 'child_process';
import { promisify } from 'util';
import { statfs } from 'fs';
import { getLogger } from '../utils/logger';
import { GitClient } from '../git/client';
import type { ValidationResult, ValidationCheck } from './types';
import { ValidationError } from '../utils/errors';

const execAsync = promisify(exec);
const statfsAsync = promisify(statfs);

export class SyncValidator {
  private repoPath: string;
  private gitClient: GitClient;
  private logger = getLogger();
  private minDiskSpaceBytes = 1024 * 1024 * 1024;

  constructor(repoPath: string) {
    this.repoPath = repoPath;
    this.gitClient = new GitClient(repoPath);
  }

  async validateSync(branch: string, options?: { skipDiskCheck?: boolean; skipNetworkCheck?: boolean }): Promise<ValidationResult> {
    this.logger.info('Starting sync validation', { branch });

    const checks: ValidationCheck[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const worktreeCheck = await this.validateWorktreeExists(branch);
      checks.push(worktreeCheck);
      if (!worktreeCheck.passed) {
        errors.push(worktreeCheck.message || 'Worktree validation failed');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      checks.push({
        name: 'worktree_exists',
        passed: false,
        message: `Failed to validate worktree: ${message}`,
      });
      errors.push(message);
    }

    if (!options?.skipDiskCheck) {
      try {
        const diskSpaceCheck = await this.validateDiskSpace();
        checks.push(diskSpaceCheck);
        if (!diskSpaceCheck.passed) {
          errors.push(diskSpaceCheck.message || 'Disk space validation failed');
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        checks.push({
          name: 'disk_space',
          passed: false,
          message: `Failed to check disk space: ${message}`,
        });
        warnings.push(`Could not verify disk space: ${message}`);
      }
    }

    try {
      const repoHealthCheck = await this.validateRepositoryHealth();
      checks.push(repoHealthCheck);
      if (!repoHealthCheck.passed) {
        errors.push(repoHealthCheck.message || 'Repository health validation failed');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      checks.push({
        name: 'repository_health',
        passed: false,
        message: `Failed to check repository health: ${message}`,
      });
      warnings.push(`Could not verify repository health: ${message}`);
    }

    try {
      const permissionsCheck = await this.validateFilePermissions();
      checks.push(permissionsCheck);
      if (!permissionsCheck.passed) {
        warnings.push(permissionsCheck.message || 'File permissions check failed');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      checks.push({
        name: 'file_permissions',
        passed: false,
        message: `Failed to check file permissions: ${message}`,
      });
      warnings.push(`Could not verify file permissions: ${message}`);
    }

    if (!options?.skipNetworkCheck) {
      try {
        const networkCheck = await this.validateNetworkConnectivity();
        checks.push(networkCheck);
        if (!networkCheck.passed) {
          warnings.push(networkCheck.message || 'Network connectivity check failed');
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        checks.push({
          name: 'network_connectivity',
          passed: false,
          message: `Failed to check network connectivity: ${message}`,
        });
        warnings.push(`Could not verify network connectivity: ${message}`);
      }
    }

    const valid = errors.length === 0;

    const result: ValidationResult = {
      valid,
      checks,
      errors,
      warnings,
    };

    this.logger.info('Sync validation complete', {
      branch,
      valid,
      checksCount: checks.length,
      errorsCount: errors.length,
      warningsCount: warnings.length,
    });

    return result;
  }

  private async validateWorktreeExists(branch: string): Promise<ValidationCheck> {
    try {
      const worktree = await this.gitClient.getWorktree(branch);

      if (!worktree) {
        return {
          name: 'worktree_exists',
          passed: false,
          message: `Worktree for branch ${branch} does not exist`,
        };
      }

      if (worktree.locked) {
        return {
          name: 'worktree_exists',
          passed: false,
          message: `Worktree for branch ${branch} is locked`,
          details: { worktree },
        };
      }

      if (worktree.prunable) {
        return {
          name: 'worktree_exists',
          passed: false,
          message: `Worktree for branch ${branch} is prunable (may be stale)`,
          details: { worktree },
        };
      }

      return {
        name: 'worktree_exists',
        passed: true,
        message: `Worktree for branch ${branch} exists and is valid`,
        details: { worktree },
      };
    } catch (error) {
      throw error;
    }
  }

  private async validateDiskSpace(): Promise<ValidationCheck> {
    try {
      const stats = await statfsAsync(this.repoPath);
      const availableBytes = stats.bavail * stats.bsize;
      const availableGB = (availableBytes / (1024 * 1024 * 1024)).toFixed(2);

      if (availableBytes < this.minDiskSpaceBytes) {
        return {
          name: 'disk_space',
          passed: false,
          message: `Insufficient disk space: ${availableGB} GB available, minimum 1 GB required`,
          details: {
            availableBytes,
            availableGB,
            requiredBytes: this.minDiskSpaceBytes,
            requiredGB: 1,
          },
        };
      }

      return {
        name: 'disk_space',
        passed: true,
        message: `Sufficient disk space: ${availableGB} GB available`,
        details: {
          availableBytes,
          availableGB,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  private async validateRepositoryHealth(): Promise<ValidationCheck> {
    try {
      await execAsync('git fsck --no-progress', {
        cwd: this.repoPath,
        timeout: 60000,
      });

      return {
        name: 'repository_health',
        passed: true,
        message: 'Repository health check passed (git fsck)',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      
      if (message.includes('timeout')) {
        return {
          name: 'repository_health',
          passed: false,
          message: 'Repository health check timed out (git fsck took >60s)',
        };
      }

      return {
        name: 'repository_health',
        passed: false,
        message: `Repository health check failed: ${message}`,
      };
    }
  }

  private async validateFilePermissions(): Promise<ValidationCheck> {
    try {
      const { stdout } = await execAsync('git status --porcelain', {
        cwd: this.repoPath,
      });

      const lines = stdout.trim().split('\n').filter(line => line.trim());
      const uncommittedChanges = lines.length;

      if (uncommittedChanges > 0) {
        return {
          name: 'file_permissions',
          passed: false,
          message: `Working directory has uncommitted changes (${uncommittedChanges} files)`,
          details: {
            uncommittedChanges,
          },
        };
      }

      await execAsync(`test -w "${this.repoPath}/.git"`, {
        cwd: this.repoPath,
      });

      return {
        name: 'file_permissions',
        passed: true,
        message: 'File permissions check passed (working directory clean, .git writable)',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        name: 'file_permissions',
        passed: false,
        message: `File permissions check failed: ${message}`,
      };
    }
  }

  private async validateNetworkConnectivity(): Promise<ValidationCheck> {
    try {
      const { stdout } = await execAsync('git remote get-url origin', {
        cwd: this.repoPath,
        timeout: 5000,
      });

      const remoteUrl = stdout.trim();

      if (!remoteUrl) {
        return {
          name: 'network_connectivity',
          passed: true,
          message: 'No remote configured (network check skipped)',
        };
      }

      try {
        await execAsync('git ls-remote --heads origin', {
          cwd: this.repoPath,
          timeout: 10000,
        });

        return {
          name: 'network_connectivity',
          passed: true,
          message: 'Network connectivity to remote verified',
          details: { remoteUrl },
        };
      } catch (lsRemoteError) {
        const message = lsRemoteError instanceof Error ? lsRemoteError.message : String(lsRemoteError);
        return {
          name: 'network_connectivity',
          passed: false,
          message: `Cannot reach remote: ${message}`,
          details: { remoteUrl },
        };
      }
    } catch (error) {
      return {
        name: 'network_connectivity',
        passed: true,
        message: 'No remote configured (network check skipped)',
      };
    }
  }

  setMinDiskSpace(bytes: number): void {
    this.minDiskSpaceBytes = bytes;
    this.logger.debug('Minimum disk space updated', {
      bytes,
      GB: (bytes / (1024 * 1024 * 1024)).toFixed(2),
    });
  }
}
