export interface BranchPattern {
  pattern: string;
}

export interface Trigger {
  type: 'commit' | 'file_change' | 'schedule' | 'manual';
  branches?: BranchPattern;
  events?: string[];
  schedule?: string;
}

export interface Condition {
  type: string;
  [key: string]: unknown;
}

export interface Action {
  type: 'run_workflow' | 'shell' | 'log' | 'notify';
  [key: string]: unknown;
}

export interface Guards {
  max_retries: number;
  timeout: number;
  on_error: 'abort' | 'rollback' | 'continue';
}

export interface Rule {
  name: string;
  version: string;
  description: string;
  author: string;
  enabled: boolean;
  triggers: Trigger[];
  conditions: Condition[];
  actions: Action[];
  guards: Guards;
  metadata?: Record<string, unknown>;
}

export interface RuleEngineConfig {
  rulesDirectory: string;
  autoLoad: boolean;
  validationStrict: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}
