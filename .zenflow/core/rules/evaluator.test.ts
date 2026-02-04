import { RuleEvaluator } from './evaluator';
import { GitClient } from '../git/client';
import { ConflictDetector } from '../sync/conflicts';
import type { Rule, Trigger, Condition } from './types';
import type { CommitEvent, ManualEvent } from '../events/types';

jest.mock('../utils/logger', () => ({
  getLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

jest.mock('../git/client', () => ({
  GitClient: jest.fn().mockImplementation(() => ({
    getWorktree: jest.fn(),
  })),
}));

jest.mock('../sync/conflicts', () => ({
  ConflictDetector: jest.fn().mockImplementation(() => ({
    quickCheck: jest.fn(),
  })),
}));

describe('RuleEvaluator', () => {
  let evaluator: RuleEvaluator;
  let mockGitClient: any;
  let mockConflictDetector: any;

  const commitEvent: CommitEvent = {
    id: 'evt-1',
    type: 'commit',
    timestamp: new Date(),
    source: 'post-commit',
    worktree: '/path/to/worktree',
    branch: 'feature-abc',
    commit_hash: 'abc123',
    commit_message: 'Test commit',
    author: 'Test Author',
  };

  const manualEvent: ManualEvent = {
    id: 'evt-2',
    type: 'manual',
    timestamp: new Date(),
    source: 'cli',
    triggered_by: 'user',
  };

  const validRule: Rule = {
    name: 'test-rule',
    version: '1.0.0',
    description: 'Test rule',
    author: 'Test Author',
    enabled: true,
    triggers: [
      {
        type: 'commit',
        branches: { pattern: '*' },
      },
    ],
    conditions: [],
    actions: [
      {
        type: 'log',
        message: 'Test',
      },
    ],
    guards: {
      max_retries: 3,
      timeout: 300,
      on_error: 'abort',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    evaluator = new RuleEvaluator('/test/repo');
    mockGitClient = (evaluator as any).gitClient;
    mockConflictDetector = (evaluator as any).conflictDetector;
  });

  describe('evaluateRule', () => {
    it('should return false for disabled rules', async () => {
      const disabledRule = { ...validRule, enabled: false };
      
      const result = await evaluator.evaluateRule(disabledRule, commitEvent);
      
      expect(result).toBe(false);
    });

    it('should return true for enabled rule with matching trigger and conditions', async () => {
      const result = await evaluator.evaluateRule(validRule, commitEvent);
      
      expect(result).toBe(true);
    });

    it('should return false if trigger does not match', async () => {
      const ruleWithManualTrigger = {
        ...validRule,
        triggers: [{ type: 'manual' as const }],
      };
      
      const result = await evaluator.evaluateRule(ruleWithManualTrigger, commitEvent);
      
      expect(result).toBe(false);
    });

    it('should return false if conditions fail', async () => {
      mockGitClient.getWorktree = jest.fn().mockResolvedValue(null);
      
      const ruleWithCondition: Rule = {
        ...validRule,
        conditions: [{ type: 'worktree_active' }],
      };
      
      const result = await evaluator.evaluateRule(ruleWithCondition, commitEvent);
      
      expect(result).toBe(false);
    });

    it('should handle evaluation errors gracefully', async () => {
      mockGitClient.getWorktree = jest.fn().mockRejectedValue(new Error('Git error'));
      
      const ruleWithCondition: Rule = {
        ...validRule,
        conditions: [{ type: 'worktree_active' }],
      };
      
      const result = await evaluator.evaluateRule(ruleWithCondition, commitEvent);
      
      expect(result).toBe(false);
    });
  });

  describe('evaluateTrigger', () => {
    it('should match trigger by type', async () => {
      const trigger: Trigger = { type: 'commit' };
      
      const result = await evaluator.evaluateTrigger(trigger, commitEvent);
      
      expect(result).toBe(true);
    });

    it('should not match different trigger type', async () => {
      const trigger: Trigger = { type: 'manual' };
      
      const result = await evaluator.evaluateTrigger(trigger, commitEvent);
      
      expect(result).toBe(false);
    });

    it('should match branch pattern with wildcard', async () => {
      const trigger: Trigger = {
        type: 'commit',
        branches: { pattern: 'feature-*' },
      };
      
      const result = await evaluator.evaluateTrigger(trigger, commitEvent);
      
      expect(result).toBe(true);
    });

    it('should not match non-matching branch pattern', async () => {
      const trigger: Trigger = {
        type: 'commit',
        branches: { pattern: 'main' },
      };
      
      const result = await evaluator.evaluateTrigger(trigger, commitEvent);
      
      expect(result).toBe(false);
    });

    it('should match event source', async () => {
      const trigger: Trigger = {
        type: 'commit',
        events: ['post-commit'],
      };
      
      const result = await evaluator.evaluateTrigger(trigger, commitEvent);
      
      expect(result).toBe(true);
    });

    it('should not match non-matching event source', async () => {
      const trigger: Trigger = {
        type: 'commit',
        events: ['pre-commit'],
      };
      
      const result = await evaluator.evaluateTrigger(trigger, commitEvent);
      
      expect(result).toBe(false);
    });
  });

  describe('evaluateCondition - branch_check', () => {
    it('should pass branch_check with not_branch condition', async () => {
      const condition: Condition = {
        type: 'branch_check',
        not_branch: 'main',
      };
      
      const result = await evaluator.evaluateCondition(condition, commitEvent);
      
      expect(result).toBe(true);
    });

    it('should fail branch_check when branch matches not_branch', async () => {
      const condition: Condition = {
        type: 'branch_check',
        not_branch: 'feature-abc',
      };
      
      const result = await evaluator.evaluateCondition(condition, commitEvent);
      
      expect(result).toBe(false);
    });

    it('should pass branch_check with matching branch condition', async () => {
      const condition: Condition = {
        type: 'branch_check',
        branch: 'feature-abc',
      };
      
      const result = await evaluator.evaluateCondition(condition, commitEvent);
      
      expect(result).toBe(true);
    });

    it('should return false for events without branch', async () => {
      const condition: Condition = {
        type: 'branch_check',
        branch: 'main',
      };
      
      const result = await evaluator.evaluateCondition(condition, manualEvent);
      
      expect(result).toBe(false);
    });
  });

  describe('evaluateCondition - worktree_active', () => {
    it('should pass when worktree is active', async () => {
      mockGitClient.getWorktree = jest.fn().mockResolvedValue({
        path: '/path/to/worktree',
        branch: 'feature-abc',
        commit: 'abc123',
        locked: false,
        prunable: false,
      });
      
      const condition: Condition = { type: 'worktree_active' };
      
      const result = await evaluator.evaluateCondition(condition, commitEvent);
      
      expect(result).toBe(true);
    });

    it('should fail when worktree does not exist', async () => {
      mockGitClient.getWorktree = jest.fn().mockResolvedValue(null);
      
      const condition: Condition = { type: 'worktree_active' };
      
      const result = await evaluator.evaluateCondition(condition, commitEvent);
      
      expect(result).toBe(false);
    });

    it('should fail when worktree is locked', async () => {
      mockGitClient.getWorktree = jest.fn().mockResolvedValue({
        path: '/path/to/worktree',
        branch: 'feature-abc',
        commit: 'abc123',
        locked: true,
        prunable: false,
      });
      
      const condition: Condition = { type: 'worktree_active' };
      
      const result = await evaluator.evaluateCondition(condition, commitEvent);
      
      expect(result).toBe(false);
    });

    it('should fail when worktree is prunable', async () => {
      mockGitClient.getWorktree = jest.fn().mockResolvedValue({
        path: '/path/to/worktree',
        branch: 'feature-abc',
        commit: 'abc123',
        locked: false,
        prunable: true,
      });
      
      const condition: Condition = { type: 'worktree_active' };
      
      const result = await evaluator.evaluateCondition(condition, commitEvent);
      
      expect(result).toBe(false);
    });
  });

  describe('evaluateCondition - no_conflicts', () => {
    it('should pass when there are no conflicts', async () => {
      mockConflictDetector.quickCheck = jest.fn().mockResolvedValue(false);
      
      const condition: Condition = {
        type: 'no_conflicts',
        with_branch: 'main',
      };
      
      const result = await evaluator.evaluateCondition(condition, commitEvent);
      
      expect(result).toBe(true);
      expect(mockConflictDetector.quickCheck).toHaveBeenCalledWith('main', 'feature-abc');
    });

    it('should fail when there are conflicts', async () => {
      mockConflictDetector.quickCheck = jest.fn().mockResolvedValue(true);
      
      const condition: Condition = {
        type: 'no_conflicts',
        with_branch: 'main',
      };
      
      const result = await evaluator.evaluateCondition(condition, commitEvent);
      
      expect(result).toBe(false);
    });

    it('should use main as default target branch', async () => {
      mockConflictDetector.quickCheck = jest.fn().mockResolvedValue(false);
      
      const condition: Condition = { type: 'no_conflicts' };
      
      const result = await evaluator.evaluateCondition(condition, commitEvent);
      
      expect(result).toBe(true);
      expect(mockConflictDetector.quickCheck).toHaveBeenCalledWith('main', 'feature-abc');
    });
  });

  describe('evaluateCondition - disk_space', () => {
    it('should return true for unknown condition types', async () => {
      const condition: Condition = {
        type: 'unknown_condition',
      };
      
      const result = await evaluator.evaluateCondition(condition, commitEvent);
      
      expect(result).toBe(true);
    });
  });

  describe('evaluateConditions', () => {
    it('should pass when all conditions pass', async () => {
      const conditions: Condition[] = [
        { type: 'branch_check', not_branch: 'main' },
      ];
      
      const result = await evaluator.evaluateConditions(conditions, commitEvent);
      
      expect(result).toBe(true);
    });

    it('should fail when any condition fails', async () => {
      mockGitClient.getWorktree = jest.fn().mockResolvedValue(null);
      
      const conditions: Condition[] = [
        { type: 'branch_check', not_branch: 'main' },
        { type: 'worktree_active' },
      ];
      
      const result = await evaluator.evaluateConditions(conditions, commitEvent);
      
      expect(result).toBe(false);
    });

    it('should pass with empty conditions array', async () => {
      const result = await evaluator.evaluateConditions([], commitEvent);
      
      expect(result).toBe(true);
    });
  });
});
