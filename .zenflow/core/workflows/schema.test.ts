import {
  WorkflowSchema,
  WorkflowInputSchema,
  WorkflowOutputSchema,
  WorkflowStepSchema,
  ErrorHandlingSchema,
  NotificationActionSchema,
  NotificationsSchema,
} from './schema';

describe('WorkflowSchema', () => {
  describe('WorkflowInputSchema', () => {
    it('should validate a required string input', () => {
      const input = {
        name: 'branch',
        type: 'string',
        required: true,
        description: 'Branch name',
      };
      const result = WorkflowInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should validate optional input with default', () => {
      const input = {
        name: 'dry_run',
        type: 'boolean',
        required: false,
        default: false,
      };
      const result = WorkflowInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should validate all input types', () => {
      const types = ['string', 'number', 'boolean', 'array', 'object'];
      types.forEach((type) => {
        const input = {
          name: 'test',
          type,
          required: true,
        };
        const result = WorkflowInputSchema.safeParse(input);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid type', () => {
      const input = {
        name: 'test',
        type: 'invalid',
        required: true,
      };
      const result = WorkflowInputSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('string, number, boolean, array, object');
      }
    });

    it('should reject empty name', () => {
      const input = {
        name: '',
        type: 'string',
        required: true,
      };
      const result = WorkflowInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('WorkflowOutputSchema', () => {
    it('should validate an output', () => {
      const output = {
        name: 'commit_hash',
        type: 'string',
        description: 'The commit hash of the merge',
      };
      const result = WorkflowOutputSchema.safeParse(output);
      expect(result.success).toBe(true);
    });

    it('should validate output without description', () => {
      const output = {
        name: 'status',
        type: 'boolean',
      };
      const result = WorkflowOutputSchema.safeParse(output);
      expect(result.success).toBe(true);
    });

    it('should reject empty name', () => {
      const output = {
        name: '',
        type: 'string',
      };
      const result = WorkflowOutputSchema.safeParse(output);
      expect(result.success).toBe(false);
    });

    it('should reject empty type', () => {
      const output = {
        name: 'result',
        type: '',
      };
      const result = WorkflowOutputSchema.safeParse(output);
      expect(result.success).toBe(false);
    });
  });

  describe('WorkflowStepSchema', () => {
    it('should validate a shell step', () => {
      const step = {
        id: 'check-conflicts',
        name: 'Check for conflicts',
        type: 'shell',
        command: 'git diff --check',
      };
      const result = WorkflowStepSchema.safeParse(step);
      expect(result.success).toBe(true);
    });

    it('should validate a javascript step', () => {
      const step = {
        id: 'analyze',
        name: 'Analyze diff',
        type: 'javascript',
        script: 'console.log("analyzing")',
      };
      const result = WorkflowStepSchema.safeParse(step);
      expect(result.success).toBe(true);
    });

    it('should validate a workflow step', () => {
      const step = {
        id: 'sub-workflow',
        name: 'Run validation',
        type: 'workflow',
        workflow: 'validate-worktree',
        inputs: { branch: 'feature/test' },
      };
      const result = WorkflowStepSchema.safeParse(step);
      expect(result.success).toBe(true);
    });

    it('should validate step with all optional fields', () => {
      const step = {
        id: 'full-step',
        name: 'Full featured step',
        type: 'shell',
        command: 'echo "test"',
        inputs: { var: 'value' },
        outputs: { result: 'output.result' },
        when: 'inputs.dry_run === false',
        unless: 'inputs.skip === true',
        timeout: 300,
        on_failure: 'rollback_to_step',
        continue_on_error: false,
      };
      const result = WorkflowStepSchema.safeParse(step);
      expect(result.success).toBe(true);
    });

    it('should reject shell step without command', () => {
      const step = {
        id: 'invalid',
        name: 'Invalid shell step',
        type: 'shell',
      };
      const result = WorkflowStepSchema.safeParse(step);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('shell requires command');
      }
    });

    it('should reject javascript step without script', () => {
      const step = {
        id: 'invalid',
        name: 'Invalid javascript step',
        type: 'javascript',
      };
      const result = WorkflowStepSchema.safeParse(step);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('javascript requires script');
      }
    });

    it('should reject workflow step without workflow name', () => {
      const step = {
        id: 'invalid',
        name: 'Invalid workflow step',
        type: 'workflow',
      };
      const result = WorkflowStepSchema.safeParse(step);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('workflow requires workflow name');
      }
    });

    it('should reject negative timeout', () => {
      const step = {
        id: 'test',
        name: 'Test',
        type: 'shell',
        command: 'echo "test"',
        timeout: -100,
      };
      const result = WorkflowStepSchema.safeParse(step);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('positive');
      }
    });

    it('should reject zero timeout', () => {
      const step = {
        id: 'test',
        name: 'Test',
        type: 'shell',
        command: 'echo "test"',
        timeout: 0,
      };
      const result = WorkflowStepSchema.safeParse(step);
      expect(result.success).toBe(false);
    });

    it('should reject invalid on_failure value', () => {
      const step = {
        id: 'test',
        name: 'Test',
        type: 'shell',
        command: 'echo "test"',
        on_failure: 'invalid',
      };
      const result = WorkflowStepSchema.safeParse(step);
      expect(result.success).toBe(false);
    });

    it('should reject empty id', () => {
      const step = {
        id: '',
        name: 'Test',
        type: 'shell',
        command: 'echo "test"',
      };
      const result = WorkflowStepSchema.safeParse(step);
      expect(result.success).toBe(false);
    });

    it('should reject empty name', () => {
      const step = {
        id: 'test',
        name: '',
        type: 'shell',
        command: 'echo "test"',
      };
      const result = WorkflowStepSchema.safeParse(step);
      expect(result.success).toBe(false);
    });
  });

  describe('ErrorHandlingSchema', () => {
    it('should validate abort strategy', () => {
      const errorHandling = {
        strategy: 'abort',
      };
      const result = ErrorHandlingSchema.safeParse(errorHandling);
      expect(result.success).toBe(true);
    });

    it('should validate rollback strategy with cleanup steps', () => {
      const errorHandling = {
        strategy: 'rollback',
        cleanup_steps: [
          {
            id: 'cleanup',
            name: 'Cleanup',
            type: 'shell',
            command: 'git reset --hard',
          },
        ],
      };
      const result = ErrorHandlingSchema.safeParse(errorHandling);
      expect(result.success).toBe(true);
    });

    it('should validate continue strategy', () => {
      const errorHandling = {
        strategy: 'continue',
      };
      const result = ErrorHandlingSchema.safeParse(errorHandling);
      expect(result.success).toBe(true);
    });

    it('should reject invalid strategy', () => {
      const errorHandling = {
        strategy: 'invalid',
      };
      const result = ErrorHandlingSchema.safeParse(errorHandling);
      expect(result.success).toBe(false);
    });
  });

  describe('NotificationActionSchema', () => {
    it('should validate log notification', () => {
      const notification = {
        type: 'log',
        level: 'info',
        message: 'Workflow completed',
      };
      const result = NotificationActionSchema.safeParse(notification);
      expect(result.success).toBe(true);
    });

    it('should validate email notification', () => {
      const notification = {
        type: 'email',
        to: 'admin@example.com',
        subject: 'Workflow completed',
        message: 'The workflow completed successfully',
      };
      const result = NotificationActionSchema.safeParse(notification);
      expect(result.success).toBe(true);
    });

    it('should validate webhook notification', () => {
      const notification = {
        type: 'webhook',
        url: 'https://example.com/webhook',
        method: 'POST',
      };
      const result = NotificationActionSchema.safeParse(notification);
      expect(result.success).toBe(true);
    });

    it('should reject invalid type', () => {
      const notification = {
        type: 'invalid',
      };
      const result = NotificationActionSchema.safeParse(notification);
      expect(result.success).toBe(false);
    });

    it('should reject invalid level', () => {
      const notification = {
        type: 'log',
        level: 'invalid',
      };
      const result = NotificationActionSchema.safeParse(notification);
      expect(result.success).toBe(false);
    });
  });

  describe('NotificationsSchema', () => {
    it('should validate notifications with success and failure', () => {
      const notifications = {
        on_success: [
          {
            type: 'log',
            level: 'info',
            message: 'Success',
          },
        ],
        on_failure: [
          {
            type: 'log',
            level: 'error',
            message: 'Failure',
          },
        ],
      };
      const result = NotificationsSchema.safeParse(notifications);
      expect(result.success).toBe(true);
    });

    it('should validate empty notifications', () => {
      const notifications = {};
      const result = NotificationsSchema.safeParse(notifications);
      expect(result.success).toBe(true);
    });
  });

  describe('WorkflowSchema', () => {
    const validWorkflow = {
      name: 'sync-worktree-to-main',
      version: '1.0.0',
      description: 'Sync worktree changes to main directory',
      author: 'Zenflow',
      inputs: [
        {
          name: 'branch',
          type: 'string',
          required: true,
          description: 'Worktree branch name',
        },
      ],
      outputs: [
        {
          name: 'commit_hash',
          type: 'string',
          description: 'Merge commit hash',
        },
      ],
      steps: [
        {
          id: 'check-conflicts',
          name: 'Check for conflicts',
          type: 'shell',
          command: 'zenflow sync --worktree ${inputs.branch} --dry-run',
        },
      ],
      error_handling: {
        strategy: 'rollback',
      },
    };

    it('should validate a complete valid workflow', () => {
      const result = WorkflowSchema.safeParse(validWorkflow);
      expect(result.success).toBe(true);
    });

    it('should validate workflow with notifications', () => {
      const workflowWithNotifications = {
        ...validWorkflow,
        notifications: {
          on_success: [
            {
              type: 'log',
              level: 'info',
              message: 'Sync completed',
            },
          ],
          on_failure: [
            {
              type: 'log',
              level: 'error',
              message: 'Sync failed',
            },
          ],
        },
      };
      const result = WorkflowSchema.safeParse(workflowWithNotifications);
      expect(result.success).toBe(true);
    });

    it('should default inputs to empty array', () => {
      const workflowWithoutInputs = {
        ...validWorkflow,
        inputs: undefined,
      };
      const result = WorkflowSchema.safeParse(workflowWithoutInputs);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.inputs).toEqual([]);
      }
    });

    it('should default outputs to empty array', () => {
      const workflowWithoutOutputs = {
        ...validWorkflow,
        outputs: undefined,
      };
      const result = WorkflowSchema.safeParse(workflowWithoutOutputs);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.outputs).toEqual([]);
      }
    });

    it('should reject empty name', () => {
      const invalidWorkflow = { ...validWorkflow, name: '' };
      const result = WorkflowSchema.safeParse(invalidWorkflow);
      expect(result.success).toBe(false);
    });

    it('should reject invalid version format', () => {
      const invalidWorkflow = { ...validWorkflow, version: '1.0' };
      const result = WorkflowSchema.safeParse(invalidWorkflow);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('semantic versioning');
      }
    });

    it('should reject empty description', () => {
      const invalidWorkflow = { ...validWorkflow, description: '' };
      const result = WorkflowSchema.safeParse(invalidWorkflow);
      expect(result.success).toBe(false);
    });

    it('should reject empty author', () => {
      const invalidWorkflow = { ...validWorkflow, author: '' };
      const result = WorkflowSchema.safeParse(invalidWorkflow);
      expect(result.success).toBe(false);
    });

    it('should reject empty steps array', () => {
      const invalidWorkflow = { ...validWorkflow, steps: [] };
      const result = WorkflowSchema.safeParse(invalidWorkflow);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('At least one step is required');
      }
    });

    it('should reject invalid step in array', () => {
      const invalidWorkflow = {
        ...validWorkflow,
        steps: [
          {
            id: 'invalid',
            name: 'Invalid',
            type: 'shell',
          },
        ],
      };
      const result = WorkflowSchema.safeParse(invalidWorkflow);
      expect(result.success).toBe(false);
    });

    it('should reject missing error_handling', () => {
      const invalidWorkflow = { ...validWorkflow, error_handling: undefined };
      const result = WorkflowSchema.safeParse(invalidWorkflow);
      expect(result.success).toBe(false);
    });

    it('should reject missing required fields', () => {
      const result = WorkflowSchema.safeParse({});
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0);
      }
    });
  });
});
