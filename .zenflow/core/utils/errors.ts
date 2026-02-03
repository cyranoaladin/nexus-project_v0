export class ZenflowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ZenflowError';
    Object.setPrototypeOf(this, ZenflowError.prototype);
  }
}

export class GitOperationError extends ZenflowError {
  constructor(message: string, public command?: string, public exitCode?: number) {
    super(message);
    this.name = 'GitOperationError';
    Object.setPrototypeOf(this, GitOperationError.prototype);
  }
}

export class ConflictDetectedError extends ZenflowError {
  constructor(message: string, public conflictedFiles: string[]) {
    super(message);
    this.name = 'ConflictDetectedError';
    Object.setPrototypeOf(this, ConflictDetectedError.prototype);
  }
}

export class ValidationError extends ZenflowError {
  constructor(message: string, public errors?: string[]) {
    super(message);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class ConfigurationError extends ZenflowError {
  constructor(message: string, public configPath?: string) {
    super(message);
    this.name = 'ConfigurationError';
    Object.setPrototypeOf(this, ConfigurationError.prototype);
  }
}

export class ConfigValidationError extends ZenflowError {
  constructor(message: string, public validationErrors?: string[]) {
    super(message);
    this.name = 'ConfigValidationError';
    Object.setPrototypeOf(this, ConfigValidationError.prototype);
  }
}

export class RuleExecutionError extends ZenflowError {
  constructor(message: string, public ruleName?: string) {
    super(message);
    this.name = 'RuleExecutionError';
    Object.setPrototypeOf(this, RuleExecutionError.prototype);
  }
}

export class WorkflowExecutionError extends ZenflowError {
  constructor(message: string, public workflowName?: string, public stepId?: string) {
    super(message);
    this.name = 'WorkflowExecutionError';
    Object.setPrototypeOf(this, WorkflowExecutionError.prototype);
  }
}

export class SyncOperationError extends ZenflowError {
  constructor(message: string, public worktreeBranch?: string, public syncId?: string) {
    super(message);
    this.name = 'SyncOperationError';
    Object.setPrototypeOf(this, SyncOperationError.prototype);
  }
}

export class RollbackError extends ZenflowError {
  constructor(message: string, public rollbackPoint?: string) {
    super(message);
    this.name = 'RollbackError';
    Object.setPrototypeOf(this, RollbackError.prototype);
  }
}

export class TimeoutError extends ZenflowError {
  constructor(message: string, public timeoutSeconds?: number) {
    super(message);
    this.name = 'TimeoutError';
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}

export class LockError extends ZenflowError {
  constructor(message: string, public lockPath?: string) {
    super(message);
    this.name = 'LockError';
    Object.setPrototypeOf(this, LockError.prototype);
  }
}
