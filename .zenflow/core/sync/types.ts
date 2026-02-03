import { DiffSummary, ConflictInfo, MergeResult } from '../git/types.js';

export interface SyncOperation {
  id: string;
  worktree_branch: string;
  commit_hash: string;
  status: 'pending' | 'running' | 'success' | 'conflict' | 'failure' | 'rolled_back';
  started_at: Date;
  completed_at?: Date;
  diff_summary?: DiffSummary;
  conflict_info?: ConflictInfo;
  merge_result?: MergeResult;
  rollback_point?: string;
  error?: string;
}

export interface SyncOptions {
  force?: boolean;
  dryRun?: boolean;
  autoPush?: boolean;
  verificationCommands?: string[];
  conflictStrategy?: 'abort' | 'manual';
}

export interface SyncFilters {
  since?: Date;
  status?: SyncOperation['status'];
  limit?: number;
  worktreeBranch?: string;
}

export interface SyncConfig {
  enabled: boolean;
  autoPush: boolean;
  maxRetries: number;
  timeout: number;
  conflictStrategy: 'abort' | 'manual';
  excludedWorktrees: string[];
  notificationChannels: ('console' | 'log' | 'email' | 'webhook')[];
  verificationCommands: string[];
}
