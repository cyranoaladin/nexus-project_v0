export interface WorkflowInput {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required: boolean;
  default?: unknown;
  description?: string;
}

export interface WorkflowOutput {
  name: string;
  type: string;
  description?: string;
}

export interface WorkflowStep {
  id: string;
  name: string;
  type: 'shell' | 'javascript' | 'workflow';
  command?: string;
  script?: string;
  workflow?: string;
  inputs?: Record<string, unknown>;
  outputs?: Record<string, string>;
  when?: string;
  unless?: string;
  timeout?: number;
  on_failure?: 'abort' | 'continue' | 'skip_to_step' | 'rollback_to_step';
  continue_on_error?: boolean;
}

export interface ErrorHandling {
  strategy: 'abort' | 'rollback' | 'continue';
  cleanup_steps?: WorkflowStep[];
}

export interface NotificationAction {
  type: 'log' | 'email' | 'webhook';
  level?: 'debug' | 'info' | 'warn' | 'error';
  message?: string;
  [key: string]: unknown;
}

export interface Notifications {
  on_success?: NotificationAction[];
  on_failure?: NotificationAction[];
}

export interface Workflow {
  name: string;
  version: string;
  description: string;
  author: string;
  inputs: WorkflowInput[];
  outputs: WorkflowOutput[];
  steps: WorkflowStep[];
  error_handling: ErrorHandling;
  notifications?: Notifications;
}

export interface WorkflowExecution {
  id: string;
  workflow_name: string;
  status: 'pending' | 'running' | 'success' | 'failure' | 'rolled_back';
  started_at: Date;
  completed_at?: Date;
  current_step?: string;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  steps: StepExecution[];
  error?: Error;
}

export interface StepExecution {
  step_id: string;
  status: 'pending' | 'running' | 'success' | 'failure' | 'skipped';
  started_at?: Date;
  completed_at?: Date;
  outputs?: Record<string, unknown>;
  error?: string;
}

export interface WorkflowEngineConfig {
  workflowsDirectory: string;
  stateDirectory: string;
  maxConcurrent: number;
}
