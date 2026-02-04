import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import yaml from 'js-yaml';
import { RuleLoader } from './loader';
import type { Rule } from './types';

jest.mock('../utils/logger', () => ({
  getLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

describe('RuleLoader', () => {
  let tempDir: string;
  let loader: RuleLoader;

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

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zenflow-test-'));
    loader = new RuleLoader(tempDir);
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

      const rule2 = { ...validRule, name: 'rule2' };
      await fs.writeFile(
        path.join(tempDir, 'rule2.yaml'),
        yaml.dump(rule2)
      );

      const rules = await loader.loadRules();

      expect(rules).toHaveLength(2);
      expect(rules.map(r => r.name)).toContain('test-rule');
      expect(rules.map(r => r.name)).toContain('rule2');
    });

    it('should load rules from subdirectories', async () => {
      await fs.mkdir(path.join(tempDir, 'sync'), { recursive: true });
      await fs.writeFile(
        path.join(tempDir, 'sync', 'sync-rule.yaml'),
        yaml.dump({ ...validRule, name: 'sync-rule' })
      );

      const rules = await loader.loadRules();

      expect(rules).toHaveLength(1);
      expect(rules[0].name).toBe('sync-rule');
    });

    it('should return empty array if directory does not exist', async () => {
      const nonExistentLoader = new RuleLoader('/non/existent/path');
      const rules = await nonExistentLoader.loadRules();

      expect(rules).toHaveLength(0);
    });

    it('should skip invalid rule files', async () => {
      await fs.writeFile(
        path.join(tempDir, 'valid.yaml'),
        yaml.dump(validRule)
      );

      await fs.writeFile(
        path.join(tempDir, 'invalid.yaml'),
        'invalid: yaml: content: ]['
      );

      const rules = await loader.loadRules();

      expect(rules).toHaveLength(1);
      expect(rules[0].name).toBe('test-rule');
    });

    it('should only load .yaml and .yml files', async () => {
      await fs.writeFile(
        path.join(tempDir, 'rule.yaml'),
        yaml.dump(validRule)
      );

      await fs.writeFile(
        path.join(tempDir, 'rule.txt'),
        'not a rule file'
      );

      const rules = await loader.loadRules();

      expect(rules).toHaveLength(1);
    });
  });

  describe('loadRule', () => {
    it('should load a rule by name', async () => {
      await fs.writeFile(
        path.join(tempDir, 'test-rule.yaml'),
        yaml.dump(validRule)
      );

      const rule = await loader.loadRule('test-rule');

      expect(rule.name).toBe('test-rule');
      expect(rule.version).toBe('1.0.0');
    });

    it('should load a rule by file path', async () => {
      const filePath = path.join(tempDir, 'custom-rule.yaml');
      await fs.writeFile(filePath, yaml.dump(validRule));

      const rule = await loader.loadRule(filePath);

      expect(rule.name).toBe('test-rule');
    });

    it('should load rule from sync subdirectory', async () => {
      await fs.mkdir(path.join(tempDir, 'sync'), { recursive: true });
      await fs.writeFile(
        path.join(tempDir, 'sync', 'sync-rule.yaml'),
        yaml.dump({ ...validRule, name: 'sync-rule' })
      );

      const rule = await loader.loadRule('sync-rule');

      expect(rule.name).toBe('sync-rule');
    });

    it('should throw error for non-existent rule', async () => {
      await expect(loader.loadRule('non-existent')).rejects.toThrow(
        /Rule file not found/
      );
    });

    it('should handle .yml extension', async () => {
      await fs.writeFile(
        path.join(tempDir, 'test-rule.yml'),
        yaml.dump(validRule)
      );

      const rule = await loader.loadRule('test-rule');

      expect(rule.name).toBe('test-rule');
    });
  });

  describe('validateRuleFile', () => {
    it('should validate a valid rule file', async () => {
      const filePath = path.join(tempDir, 'valid.yaml');
      await fs.writeFile(filePath, yaml.dump(validRule));

      const result = await loader.validateRuleFile(filePath);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should reject rule with missing required fields', async () => {
      const invalidRule = {
        name: 'incomplete',
      };

      const filePath = path.join(tempDir, 'invalid.yaml');
      await fs.writeFile(filePath, yaml.dump(invalidRule));

      const result = await loader.validateRuleFile(filePath);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it('should reject rule with invalid version format', async () => {
      const invalidRule = {
        ...validRule,
        version: 'invalid',
      };

      const filePath = path.join(tempDir, 'invalid.yaml');
      await fs.writeFile(filePath, yaml.dump(invalidRule));

      const result = await loader.validateRuleFile(filePath);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.some(e => e.includes('version'))).toBe(true);
    });

    it('should reject rule with no triggers', async () => {
      const invalidRule = {
        ...validRule,
        triggers: [],
      };

      const filePath = path.join(tempDir, 'invalid.yaml');
      await fs.writeFile(filePath, yaml.dump(invalidRule));

      const result = await loader.validateRuleFile(filePath);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should handle malformed YAML', async () => {
      const filePath = path.join(tempDir, 'malformed.yaml');
      await fs.writeFile(filePath, 'invalid: yaml: [');

      const result = await loader.validateRuleFile(filePath);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should handle non-existent file', async () => {
      const result = await loader.validateRuleFile('/non/existent/file.yaml');

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });
});
