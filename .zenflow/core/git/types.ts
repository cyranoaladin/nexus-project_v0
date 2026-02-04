export interface Worktree {
  path: string;
  branch: string;
  commit: string;
  locked: boolean;
  prunable: boolean;
}

export interface FileDiff {
  path: string;
  status: 'A' | 'M' | 'D' | 'R' | 'C';
  insertions: number;
  deletions: number;
  binary: boolean;
}

export interface DiffSummary {
  files_changed: number;
  insertions: number;
  deletions: number;
  files: FileDiff[];
}

export interface ConflictDetail {
  file: string;
  type: 'content' | 'delete/modify' | 'rename' | 'mode';
  description: string;
}

export interface ConflictInfo {
  has_conflicts: boolean;
  conflicted_files: string[];
  details: ConflictDetail[];
}

export interface MergeResult {
  success: boolean;
  commit_hash?: string;
  conflicts?: ConflictInfo;
  error?: string;
}
