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

// Type guards for Event union type
export function isCommitEvent(event: Event): event is CommitEvent {
  return event.type === 'commit';
}

export function isFileChangeEvent(event: Event): event is FileChangeEvent {
  return event.type === 'file_change';
}

export function isScheduleEvent(event: Event): event is ScheduleEvent {
  return event.type === 'schedule';
}

export function isManualEvent(event: Event): event is ManualEvent {
  return event.type === 'manual';
}
