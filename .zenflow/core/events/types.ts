export interface BaseEvent {
  id: string;
  type: 'commit' | 'file_change' | 'schedule' | 'manual';
  timestamp: Date;
  source: string;
  metadata?: Record<string, unknown>;
}

export interface CommitEvent extends BaseEvent {
  type: 'commit';
  worktree: string;
  branch: string;
  commit_hash: string;
  commit_message: string;
  author: string;
}

export interface FileChangeEvent extends BaseEvent {
  type: 'file_change';
  worktree: string;
  branch: string;
  files_changed: string[];
  change_type: 'created' | 'modified' | 'deleted';
}

export interface ScheduleEvent extends BaseEvent {
  type: 'schedule';
  cron_expression: string;
  job_name: string;
}

export interface ManualEvent extends BaseEvent {
  type: 'manual';
  triggered_by: string;
  reason?: string;
}

export type Event = CommitEvent | FileChangeEvent | ScheduleEvent | ManualEvent;

export interface EventQueue {
  events: Event[];
  processing: boolean;
}

export interface EventDetectorConfig {
  enabled: boolean;
  watchDirectories: string[];
  debounceMs: number;
  ignorePatterns: string[];
}
