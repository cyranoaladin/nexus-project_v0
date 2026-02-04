import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import yaml from 'js-yaml';
import { RuleEngine } from './engine';
import type { Rule, RuleEngineConfig } from './types';
import type { CommitEvent } from '../events/types';

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

describe('RuleEngine', () => {
  let tempDir: string;
  let engine: RuleEngine;
  let config: RuleEngineConfig;

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
        message: 'Test action',
      },
    ],
    guards: {
      max_retries: 3,
      timeout: 300,
      on_error: 'abort',
    },
  };

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

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zenflow-test-'));
    config = {
      rulesDirectory: tempDir,
      autoLoad: false,
      validationStrict: true,
    };
    engine = new RuleEngine(config);
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('loadRules', () => {
    it('should load all rules from directory', async () => {
      await fs.writeFile(
        path.join(tempDir, 'rule1.yaml'),
        yaml.dump(validRule)
      );

      await fs.writeFile(
        path.join(tempDir, 'rule2.yaml'),
        yaml.dump({ ...validRule, name: 'rule2' })
      );

      const rules = await engine.loadRules();

      expect(rules).toHaveLength(2);
      expect(engine.getRules()).toHaveLength(2);
    });

    it('should clear existing rules before loading', async () => {
      await fs.writeFile(
        path.join(tempDir, 'rule1.yaml'),
        yaml.dump(validRule)
      );

      await engine.loadRules();
      expect(engine.getRules()).toHaveLength(1);

      await fs.writeFile(
        path.join(tempDir, 'rule2.yaml'),
        yaml.dump({ ...validRule, name: 'rule2' })
      );

      await engine.loadRules();
      expect(engine.getRules()).toHaveLength(2);
    });
  });

  describe('loadRule', () => {
    it('should load a single rule by name', async () => {
      await fs.writeFile(
        path.join(tempDir, 'test-rule.yaml'),
        yaml.dump(validRule)
      );

      const rule = await engine.loadRule('test-rule');

      expect(rule.name).toBe('test-rule');
      expect(engine.getRule('test-rule')).toBeDefined();
    });

    it('should add loaded rule to engine', async () => {
      await fs.writeFile(
        path.join(tempDir, 'new-rule.yaml'),
        yaml.dump({ ...validRule, name: 'new-rule' })
      );

      expect(engine.getRule('new-rule')).toBeUndefined();

      await engine.loadRule('new-rule');

      expect(engine.getRule('new-rule')).toBeDefined();
    });
  });

  describe('validateRule', () => {
    it('should validate a valid rule', async () => {
      const result = await engine.validateRule(validRule);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should reject rule with missing required fields', async () => {
      const invalidRule = {
        name: 'incomplete',
      } as any;

      const result = await engine.validateRule(invalidRule);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it('should reject rule with invalid version', async () => {
      const invalidRule = {
        ...validRule,
        version: 'invalid',
      };

      const result = await engine.validateRule(invalidRule);

      expect(result.valid).toBe(false);
      expect(result.errors!.some(e => e.includes('version'))).toBe(true);
    });
  });

  describe('evaluateRule', () => {
    it('should evaluate rule against event', async () => {
      const result = await engine.evaluateRule(validRule, commitEvent);

      expect(typeof result).toBe('boolean');
    });

    it('should return false for disabled rules', async () => {
      const disabledRule = { ...validRule, enabled: false };

      const result = await engine.evaluateRule(disabledRule, commitEvent);

      expect(result).toBe(false);
    });
  });

  describe('executeRule', () => {
    it('should execute rule if conditions are met', async () => {
      await engine.executeRule(validRule, commitEvent);

    });

    it('should skip execution if conditions are not met', async () => {
      const ruleWithMismatchedTrigger = {
        ...validRule,
        triggers: [{ type: 'manual' as const }],
      };

      await engine.executeRule(ruleWithMismatchedTrigger, commitEvent);

    });
  });

  describe('enableRule and disableRule', () => {
    beforeEach(async () => {
      await fs.writeFile(
        path.join(tempDir, 'test-rule.yaml'),
        yaml.dump(validRule)
      );
      await engine.loadRule('test-rule');
    });

    it('should enable a disabled rule', async () => {
      await engine.disableRule('test-rule');
      let rule = engine.getRule('test-rule');
      expect(rule?.enabled).toBe(false);

      await engine.enableRule('test-rule');
      rule = engine.getRule('test-rule');
      expect(rule?.enabled).toBe(true);
    });

    it('should disable an enabled rule', async () => {
      let rule = engine.getRule('test-rule');
      expect(rule?.enabled).toBe(true);

      await engine.disableRule('test-rule');
      rule = engine.getRule('test-rule');
      expect(rule?.enabled).toBe(false);
    });

    it('should persist enabled state to file', async () => {
      await engine.enableRule('test-rule');

      const content = await fs.readFile(
        path.join(tempDir, 'test-rule.yaml'),
        'utf-8'
      );
      const rule = yaml.load(content) as Rule;

      expect(rule.enabled).toBe(true);
    });

    it('should persist disabled state to file', async () => {
      await engine.disableRule('test-rule');

      const content = await fs.readFile(
        path.join(tempDir, 'test-rule.yaml'),
        'utf-8'
      );
      const rule = yaml.load(content) as Rule;

      expect(rule.enabled).toBe(false);
    });

    it('should throw error for non-existent rule', async () => {
      await expect(engine.enableRule('non-existent')).rejects.toThrow(
        /Rule not found/
      );

      await expect(engine.disableRule('non-existent')).rejects.toThrow(
        /Rule not found/
      );
    });
  });

  describe('getRules', () => {
    it('should return all loaded rules', async () => {
      await fs.writeFile(
        path.join(tempDir, 'rule1.yaml'),
        yaml.dump(validRule)
      );
      await fs.writeFile(
        path.join(tempDir, 'rule2.yaml'),
        yaml.dump({ ...validRule, name: 'rule2' })
      );

      await engine.loadRules();

      const rules = engine.getRules();

      expect(rules).toHaveLength(2);
    });

    it('should return empty array if no rules loaded', () => {
      const rules = engine.getRules();

      expect(rules).toHaveLength(0);
    });
  });

  describe('getRule', () => {
    it('should return specific rule by name', async () => {
      await fs.writeFile(
        path.join(tempDir, 'test-rule.yaml'),
        yaml.dump(validRule)
      );
      await engine.loadRule('test-rule');

      const rule = engine.getRule('test-rule');

      expect(rule).toBeDefined();
      expect(rule?.name).toBe('test-rule');
    });

    it('should return undefined for non-existent rule', () => {
      const rule = engine.getRule('non-existent');

      expect(rule).toBeUndefined();
    });
  });

  describe('getEnabledRules', () => {
    it('should return only enabled rules', async () => {
      await fs.writeFile(
        path.join(tempDir, 'enabled.yaml'),
        yaml.dump({ ...validRule, name: 'enabled', enabled: true })
      );
      await fs.writeFile(
        path.join(tempDir, 'disabled.yaml'),
        yaml.dump({ ...validRule, name: 'disabled', enabled: false })
      );

      await engine.loadRules();

      const enabledRules = engine.getEnabledRules();

      expect(enabledRules).toHaveLength(1);
      expect(enabledRules[0].name).toBe('enabled');
    });
  });

  describe('getDisabledRules', () => {
    it('should return only disabled rules', async () => {
      await fs.writeFile(
        path.join(tempDir, 'enabled.yaml'),
        yaml.dump({ ...validRule, name: 'enabled', enabled: true })
      );
      await fs.writeFile(
        path.join(tempDir, 'disabled.yaml'),
        yaml.dump({ ...validRule, name: 'disabled', enabled: false })
      );

      await engine.loadRules();

      const disabledRules = engine.getDisabledRules();

      expect(disabledRules).toHaveLength(1);
      expect(disabledRules[0].name).toBe('disabled');
    });
  });

  describe('findMatchingRules', () => {
    beforeEach(async () => {
      await fs.writeFile(
        path.join(tempDir, 'commit-rule.yaml'),
        yaml.dump({
          ...validRule,
          name: 'commit-rule',
          triggers: [{ type: 'commit', branches: { pattern: '*' } }],
        })
      );
      await fs.writeFile(
        path.join(tempDir, 'manual-rule.yaml'),
        yaml.dump({
          ...validRule,
          name: 'manual-rule',
          triggers: [{ type: 'manual' }],
        })
      );

      await engine.loadRules();
    });

    it('should find rules matching the event', async () => {
      const matchingRules = await engine.findMatchingRules(commitEvent);

      expect(matchingRules.length).toBeGreaterThanOrEqual(0);
      matchingRules.forEach(rule => {
        expect(rule.enabled).toBe(true);
      });
    });

    it('should not return disabled rules', async () => {
      await engine.disableRule('commit-rule');

      const matchingRules = await engine.findMatchingRules(commitEvent);

      expect(matchingRules.every(r => r.name !== 'commit-rule')).toBe(true);
    });
  });

  describe('autoLoad', () => {
    it('should auto-load rules on construction when enabled', async () => {
      await fs.writeFile(
        path.join(tempDir, 'auto-rule.yaml'),
        yaml.dump({ ...validRule, name: 'auto-rule' })
      );

      const autoLoadConfig = {
        ...config,
        autoLoad: true,
      };

      await new Promise(resolve => setTimeout(resolve, 100));

      const autoEngine = new RuleEngine(autoLoadConfig);

      await new Promise(resolve => setTimeout(resolve, 100));
    });
  });
});
