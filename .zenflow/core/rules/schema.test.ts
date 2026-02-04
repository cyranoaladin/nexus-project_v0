import {
  RuleSchema,
  TriggerSchema,
  ConditionSchema,
  ActionSchema,
  GuardsSchema,
  BranchPatternSchema,
} from './schema';

describe('RuleSchema', () => {
  describe('BranchPatternSchema', () => {
    it('should validate a valid branch pattern', () => {
      const validPattern = { pattern: 'feature/*' };
      const result = BranchPatternSchema.safeParse(validPattern);
      expect(result.success).toBe(true);
    });

    it('should reject empty pattern', () => {
      const invalidPattern = { pattern: '' };
      const result = BranchPatternSchema.safeParse(invalidPattern);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('cannot be empty');
      }
    });

    it('should reject missing pattern', () => {
      const result = BranchPatternSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('TriggerSchema', () => {
    it('should validate a commit trigger', () => {
      const trigger = {
        type: 'commit',
        branches: { pattern: 'feature/*' },
      };
      const result = TriggerSchema.safeParse(trigger);
      expect(result.success).toBe(true);
    });

    it('should validate a file_change trigger', () => {
      const trigger = {
        type: 'file_change',
        events: ['create', 'modify'],
      };
      const result = TriggerSchema.safeParse(trigger);
      expect(result.success).toBe(true);
    });

    it('should validate a schedule trigger', () => {
      const trigger = {
        type: 'schedule',
        schedule: '0 */4 * * *',
      };
      const result = TriggerSchema.safeParse(trigger);
      expect(result.success).toBe(true);
    });

    it('should validate a manual trigger', () => {
      const trigger = {
        type: 'manual',
      };
      const result = TriggerSchema.safeParse(trigger);
      expect(result.success).toBe(true);
    });

    it('should reject invalid trigger type', () => {
      const trigger = {
        type: 'invalid',
      };
      const result = TriggerSchema.safeParse(trigger);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('commit, file_change, schedule, manual');
      }
    });

    it('should reject missing type', () => {
      const result = TriggerSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('ConditionSchema', () => {
    it('should validate a condition with type', () => {
      const condition = {
        type: 'branch_check',
        branch: 'main',
      };
      const result = ConditionSchema.safeParse(condition);
      expect(result.success).toBe(true);
    });

    it('should allow additional properties', () => {
      const condition = {
        type: 'no_conflicts',
        base: 'main',
        target: 'feature/test',
        custom_field: 'value',
      };
      const result = ConditionSchema.safeParse(condition);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveProperty('custom_field', 'value');
      }
    });

    it('should reject empty type', () => {
      const condition = { type: '' };
      const result = ConditionSchema.safeParse(condition);
      expect(result.success).toBe(false);
    });

    it('should reject missing type', () => {
      const result = ConditionSchema.safeParse({ other: 'value' });
      expect(result.success).toBe(false);
    });
  });

  describe('ActionSchema', () => {
    it('should validate run_workflow action', () => {
      const action = {
        type: 'run_workflow',
        workflow: 'sync-worktree-to-main',
        inputs: { branch: 'feature/test' },
      };
      const result = ActionSchema.safeParse(action);
      expect(result.success).toBe(true);
    });

    it('should validate shell action', () => {
      const action = {
        type: 'shell',
        command: 'echo "test"',
      };
      const result = ActionSchema.safeParse(action);
      expect(result.success).toBe(true);
    });

    it('should validate log action', () => {
      const action = {
        type: 'log',
        message: 'Test message',
        level: 'info',
      };
      const result = ActionSchema.safeParse(action);
      expect(result.success).toBe(true);
    });

    it('should validate notify action', () => {
      const action = {
        type: 'notify',
        channel: 'webhook',
        url: 'https://example.com/webhook',
      };
      const result = ActionSchema.safeParse(action);
      expect(result.success).toBe(true);
    });

    it('should reject invalid action type', () => {
      const action = {
        type: 'invalid',
      };
      const result = ActionSchema.safeParse(action);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('run_workflow, shell, log, notify');
      }
    });
  });

  describe('GuardsSchema', () => {
    it('should validate valid guards', () => {
      const guards = {
        max_retries: 3,
        timeout: 300,
        on_error: 'abort',
      };
      const result = GuardsSchema.safeParse(guards);
      expect(result.success).toBe(true);
    });

    it('should validate max retries boundary', () => {
      const guards = {
        max_retries: 0,
        timeout: 300,
        on_error: 'rollback',
      };
      const result = GuardsSchema.safeParse(guards);
      expect(result.success).toBe(true);
    });

    it('should reject max_retries > 10', () => {
      const guards = {
        max_retries: 11,
        timeout: 300,
        on_error: 'abort',
      };
      const result = GuardsSchema.safeParse(guards);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('between 0 and 10');
      }
    });

    it('should reject negative max_retries', () => {
      const guards = {
        max_retries: -1,
        timeout: 300,
        on_error: 'abort',
      };
      const result = GuardsSchema.safeParse(guards);
      expect(result.success).toBe(false);
    });

    it('should reject negative timeout', () => {
      const guards = {
        max_retries: 3,
        timeout: -100,
        on_error: 'abort',
      };
      const result = GuardsSchema.safeParse(guards);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('positive');
      }
    });

    it('should reject invalid on_error value', () => {
      const guards = {
        max_retries: 3,
        timeout: 300,
        on_error: 'invalid',
      };
      const result = GuardsSchema.safeParse(guards);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('abort, rollback, continue');
      }
    });
  });

  describe('RuleSchema', () => {
    const validRule = {
      name: 'worktree-sync-on-commit',
      version: '1.0.0',
      description: 'Sync worktree to main on commit',
      author: 'Zenflow',
      enabled: true,
      triggers: [
        {
          type: 'commit',
          branches: { pattern: 'feature/*' },
        },
      ],
      conditions: [
        {
          type: 'no_conflicts',
          base: 'main',
        },
      ],
      actions: [
        {
          type: 'run_workflow',
          workflow: 'sync-worktree-to-main',
        },
      ],
      guards: {
        max_retries: 3,
        timeout: 600,
        on_error: 'abort',
      },
    };

    it('should validate a complete valid rule', () => {
      const result = RuleSchema.safeParse(validRule);
      expect(result.success).toBe(true);
    });

    it('should validate rule with metadata', () => {
      const ruleWithMetadata = {
        ...validRule,
        metadata: {
          created_at: '2026-02-03',
          tags: ['sync', 'worktree'],
        },
      };
      const result = RuleSchema.safeParse(ruleWithMetadata);
      expect(result.success).toBe(true);
    });

    it('should default conditions to empty array', () => {
      const ruleWithoutConditions = {
        ...validRule,
        conditions: undefined,
      };
      const result = RuleSchema.safeParse(ruleWithoutConditions);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.conditions).toEqual([]);
      }
    });

    it('should reject empty name', () => {
      const invalidRule = { ...validRule, name: '' };
      const result = RuleSchema.safeParse(invalidRule);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('cannot be empty');
      }
    });

    it('should reject invalid version format', () => {
      const invalidRule = { ...validRule, version: '1.0' };
      const result = RuleSchema.safeParse(invalidRule);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('semantic versioning');
      }
    });

    it('should reject version with non-numeric parts', () => {
      const invalidRule = { ...validRule, version: '1.0.x' };
      const result = RuleSchema.safeParse(invalidRule);
      expect(result.success).toBe(false);
    });

    it('should reject empty description', () => {
      const invalidRule = { ...validRule, description: '' };
      const result = RuleSchema.safeParse(invalidRule);
      expect(result.success).toBe(false);
    });

    it('should reject empty author', () => {
      const invalidRule = { ...validRule, author: '' };
      const result = RuleSchema.safeParse(invalidRule);
      expect(result.success).toBe(false);
    });

    it('should reject non-boolean enabled', () => {
      const invalidRule = { ...validRule, enabled: 'true' };
      const result = RuleSchema.safeParse(invalidRule);
      expect(result.success).toBe(false);
    });

    it('should reject empty triggers array', () => {
      const invalidRule = { ...validRule, triggers: [] };
      const result = RuleSchema.safeParse(invalidRule);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('At least one trigger is required');
      }
    });

    it('should reject empty actions array', () => {
      const invalidRule = { ...validRule, actions: [] };
      const result = RuleSchema.safeParse(invalidRule);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('At least one action is required');
      }
    });

    it('should reject invalid trigger in array', () => {
      const invalidRule = {
        ...validRule,
        triggers: [{ type: 'invalid' }],
      };
      const result = RuleSchema.safeParse(invalidRule);
      expect(result.success).toBe(false);
    });

    it('should reject missing required fields', () => {
      const result = RuleSchema.safeParse({});
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0);
      }
    });
  });
});
