import {
  ZenflowError,
  GitOperationError,
  ConflictDetectedError,
  ValidationError,
  ConfigurationError,
  ConfigValidationError,
  RuleExecutionError,
  WorkflowExecutionError,
  SyncOperationError,
  RollbackError,
  TimeoutError,
  LockError,
} from './errors';

describe('Custom Error Classes', () => {
  describe('ZenflowError', () => {
    it('should create error with correct name and message', () => {
      const error = new ZenflowError('Test error');
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ZenflowError);
      expect(error.name).toBe('ZenflowError');
      expect(error.message).toBe('Test error');
    });

    it('should have correct prototype chain', () => {
      const error = new ZenflowError('Test');
      expect(Object.getPrototypeOf(error)).toBe(ZenflowError.prototype);
    });

    it('should be throwable and catchable', () => {
      expect(() => {
        throw new ZenflowError('Test error');
      }).toThrow('Test error');
    });
  });

  describe('GitOperationError', () => {
    it('should create error with message only', () => {
      const error = new GitOperationError('Git failed');
      
      expect(error).toBeInstanceOf(ZenflowError);
      expect(error.name).toBe('GitOperationError');
      expect(error.message).toBe('Git failed');
      expect(error.command).toBeUndefined();
      expect(error.exitCode).toBeUndefined();
    });

    it('should create error with command and exit code', () => {
      const error = new GitOperationError('Git push failed', 'git push origin main', 1);
      
      expect(error.message).toBe('Git push failed');
      expect(error.command).toBe('git push origin main');
      expect(error.exitCode).toBe(1);
    });

    it('should be instance of both GitOperationError and ZenflowError', () => {
      const error = new GitOperationError('Test');
      expect(error).toBeInstanceOf(GitOperationError);
      expect(error).toBeInstanceOf(ZenflowError);
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('ConflictDetectedError', () => {
    it('should store conflicted files array', () => {
      const files = ['file1.ts', 'file2.ts', 'file3.ts'];
      const error = new ConflictDetectedError('Conflicts detected', files);
      
      expect(error.name).toBe('ConflictDetectedError');
      expect(error.message).toBe('Conflicts detected');
      expect(error.conflictedFiles).toEqual(files);
    });

    it('should handle empty conflicted files array', () => {
      const error = new ConflictDetectedError('Conflicts detected', []);
      expect(error.conflictedFiles).toEqual([]);
    });

    it('should be instance of ZenflowError', () => {
      const error = new ConflictDetectedError('Test', []);
      expect(error).toBeInstanceOf(ConflictDetectedError);
      expect(error).toBeInstanceOf(ZenflowError);
    });
  });

  describe('ValidationError', () => {
    it('should create error without validation errors', () => {
      const error = new ValidationError('Validation failed');
      
      expect(error.name).toBe('ValidationError');
      expect(error.message).toBe('Validation failed');
      expect(error.errors).toBeUndefined();
    });

    it('should store validation errors array', () => {
      const errors = ['Error 1', 'Error 2'];
      const error = new ValidationError('Validation failed', errors);
      
      expect(error.errors).toEqual(errors);
    });

    it('should be instance of ZenflowError', () => {
      const error = new ValidationError('Test');
      expect(error).toBeInstanceOf(ValidationError);
      expect(error).toBeInstanceOf(ZenflowError);
    });
  });

  describe('ConfigurationError', () => {
    it('should create error without config path', () => {
      const error = new ConfigurationError('Config error');
      
      expect(error.name).toBe('ConfigurationError');
      expect(error.message).toBe('Config error');
      expect(error.configPath).toBeUndefined();
    });

    it('should store config path', () => {
      const error = new ConfigurationError('Config error', '/path/to/config.json');
      expect(error.configPath).toBe('/path/to/config.json');
    });

    it('should be instance of ZenflowError', () => {
      const error = new ConfigurationError('Test');
      expect(error).toBeInstanceOf(ConfigurationError);
      expect(error).toBeInstanceOf(ZenflowError);
    });
  });

  describe('ConfigValidationError', () => {
    it('should create error without validation errors', () => {
      const error = new ConfigValidationError('Config validation failed');
      
      expect(error.name).toBe('ConfigValidationError');
      expect(error.validationErrors).toBeUndefined();
    });

    it('should store validation errors', () => {
      const errors = ['Invalid field 1', 'Invalid field 2'];
      const error = new ConfigValidationError('Config validation failed', errors);
      
      expect(error.validationErrors).toEqual(errors);
    });

    it('should be instance of ZenflowError', () => {
      const error = new ConfigValidationError('Test');
      expect(error).toBeInstanceOf(ConfigValidationError);
      expect(error).toBeInstanceOf(ZenflowError);
    });
  });

  describe('RuleExecutionError', () => {
    it('should create error without rule name', () => {
      const error = new RuleExecutionError('Rule failed');
      
      expect(error.name).toBe('RuleExecutionError');
      expect(error.ruleName).toBeUndefined();
    });

    it('should store rule name', () => {
      const error = new RuleExecutionError('Rule failed', 'worktree-sync-rule');
      expect(error.ruleName).toBe('worktree-sync-rule');
    });

    it('should be instance of ZenflowError', () => {
      const error = new RuleExecutionError('Test');
      expect(error).toBeInstanceOf(RuleExecutionError);
      expect(error).toBeInstanceOf(ZenflowError);
    });
  });

  describe('WorkflowExecutionError', () => {
    it('should create error with message only', () => {
      const error = new WorkflowExecutionError('Workflow failed');
      
      expect(error.name).toBe('WorkflowExecutionError');
      expect(error.message).toBe('Workflow failed');
      expect(error.workflowName).toBeUndefined();
      expect(error.stepId).toBeUndefined();
    });

    it('should store workflow name and step ID', () => {
      const error = new WorkflowExecutionError(
        'Step failed',
        'sync-workflow',
        'validate-step'
      );
      
      expect(error.workflowName).toBe('sync-workflow');
      expect(error.stepId).toBe('validate-step');
    });

    it('should be instance of ZenflowError', () => {
      const error = new WorkflowExecutionError('Test');
      expect(error).toBeInstanceOf(WorkflowExecutionError);
      expect(error).toBeInstanceOf(ZenflowError);
    });
  });

  describe('SyncOperationError', () => {
    it('should create error with message only', () => {
      const error = new SyncOperationError('Sync failed');
      
      expect(error.name).toBe('SyncOperationError');
      expect(error.worktreeBranch).toBeUndefined();
      expect(error.syncId).toBeUndefined();
    });

    it('should store worktree branch and sync ID', () => {
      const error = new SyncOperationError(
        'Sync failed',
        'feature/new-feature',
        'sync-123'
      );
      
      expect(error.worktreeBranch).toBe('feature/new-feature');
      expect(error.syncId).toBe('sync-123');
    });

    it('should be instance of ZenflowError', () => {
      const error = new SyncOperationError('Test');
      expect(error).toBeInstanceOf(SyncOperationError);
      expect(error).toBeInstanceOf(ZenflowError);
    });
  });

  describe('RollbackError', () => {
    it('should create error without rollback point', () => {
      const error = new RollbackError('Rollback failed');
      
      expect(error.name).toBe('RollbackError');
      expect(error.rollbackPoint).toBeUndefined();
    });

    it('should store rollback point', () => {
      const error = new RollbackError('Rollback failed', 'abc123');
      expect(error.rollbackPoint).toBe('abc123');
    });

    it('should be instance of ZenflowError', () => {
      const error = new RollbackError('Test');
      expect(error).toBeInstanceOf(RollbackError);
      expect(error).toBeInstanceOf(ZenflowError);
    });
  });

  describe('TimeoutError', () => {
    it('should create error without timeout seconds', () => {
      const error = new TimeoutError('Operation timed out');
      
      expect(error.name).toBe('TimeoutError');
      expect(error.timeoutSeconds).toBeUndefined();
    });

    it('should store timeout duration', () => {
      const error = new TimeoutError('Operation timed out after 30s', 30);
      expect(error.timeoutSeconds).toBe(30);
    });

    it('should be instance of ZenflowError', () => {
      const error = new TimeoutError('Test');
      expect(error).toBeInstanceOf(TimeoutError);
      expect(error).toBeInstanceOf(ZenflowError);
    });
  });

  describe('LockError', () => {
    it('should create error without lock path', () => {
      const error = new LockError('Failed to acquire lock');
      
      expect(error.name).toBe('LockError');
      expect(error.lockPath).toBeUndefined();
    });

    it('should store lock path', () => {
      const error = new LockError('Lock already held', '/path/to/lock');
      expect(error.lockPath).toBe('/path/to/lock');
    });

    it('should be instance of ZenflowError', () => {
      const error = new LockError('Test');
      expect(error).toBeInstanceOf(LockError);
      expect(error).toBeInstanceOf(ZenflowError);
    });
  });

  describe('Error catching and type checking', () => {
    it('should catch and identify specific error types', () => {
      try {
        throw new GitOperationError('Git error', 'git push', 1);
      } catch (error) {
        expect(error).toBeInstanceOf(GitOperationError);
        if (error instanceof GitOperationError) {
          expect(error.command).toBe('git push');
          expect(error.exitCode).toBe(1);
        }
      }
    });

    it('should catch errors as ZenflowError base class', () => {
      try {
        throw new ConflictDetectedError('Conflict', ['file.ts']);
      } catch (error) {
        expect(error).toBeInstanceOf(ZenflowError);
        if (error instanceof ZenflowError) {
          expect(error.message).toBe('Conflict');
        }
      }
    });

    it('should preserve stack trace', () => {
      const error = new ValidationError('Test');
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('ValidationError');
    });
  });
});
