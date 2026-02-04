export class ZenflowError extends Error {
  public readonly timestamp: Date;
  public readonly code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'ZenflowError';
    this.code = code;
    this.timestamp = new Date();
    Object.setPrototypeOf(this, ZenflowError.prototype);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack,
    };
  }
}

export class GitOperationError extends ZenflowError {
  public readonly command?: string;
  public readonly exitCode?: number;
  public readonly stderr?: string;

  constructor(message: string, command?: string, exitCode?: number, stderr?: string) {
    super(message, 'GIT_OPERATION_ERROR');
    this.name = 'GitOperationError';
    this.command = command;
    this.exitCode = exitCode;
    this.stderr = stderr;
    Object.setPrototypeOf(this, GitOperationError.prototype);
  }

  toJSON() {
    return {
      ...super.toJSON(),
      command: this.command,
      exitCode: this.exitCode,
      stderr: this.stderr,
    };
  }
}

export class ConflictDetectedError extends ZenflowError {
  public readonly conflictedFiles: string[];
  public readonly resolutionSuggestion?: string;

  constructor(message: string, conflictedFiles: string[], resolutionSuggestion?: string) {
    super(message, 'CONFLICT_DETECTED');
    this.name = 'ConflictDetectedError';
    this.conflictedFiles = conflictedFiles;
    this.resolutionSuggestion = resolutionSuggestion;
    Object.setPrototypeOf(this, ConflictDetectedError.prototype);
  }

  toJSON() {
    return {
      ...super.toJSON(),
      conflictedFiles: this.conflictedFiles,
      resolutionSuggestion: this.resolutionSuggestion,
    };
  }
}

export class ValidationError extends ZenflowError {
  public readonly errors?: string[];
  public readonly field?: string;

  constructor(message: string, errors?: string[], field?: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    this.errors = errors;
    this.field = field;
    Object.setPrototypeOf(this, ValidationError.prototype);
  }

  toJSON() {
    return {
      ...super.toJSON(),
      errors: this.errors,
      field: this.field,
    };
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
  public readonly lockPath?: string;

  constructor(message: string, lockPath?: string) {
    super(message, 'LOCK_ERROR');
    this.name = 'LockError';
    this.lockPath = lockPath;
    Object.setPrototypeOf(this, LockError.prototype);
  }

  toJSON() {
    return {
      ...super.toJSON(),
      lockPath: this.lockPath,
    };
  }
}

export class SecurityError extends ZenflowError {
  public readonly violationType: string;

  constructor(message: string, violationType: string) {
    super(message, 'SECURITY_ERROR');
    this.name = 'SecurityError';
    this.violationType = violationType;
    Object.setPrototypeOf(this, SecurityError.prototype);
  }

  toJSON() {
    return {
      ...super.toJSON(),
      violationType: this.violationType,
    };
  }
}

export class RateLimitError extends ZenflowError {
  public readonly operation: string;
  public readonly retryAfter: number;

  constructor(message: string, operation: string, retryAfterMs: number) {
    super(message, 'RATE_LIMIT_EXCEEDED');
    this.name = 'RateLimitError';
    this.operation = operation;
    this.retryAfter = retryAfterMs;
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }

  toJSON() {
    return {
      ...super.toJSON(),
      operation: this.operation,
      retryAfter: this.retryAfter,
    };
  }
}
