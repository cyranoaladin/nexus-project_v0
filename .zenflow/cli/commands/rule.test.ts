import { jest } from '@jest/globals';
import type { Rule } from '../../core/rules/types';
import type { Event } from '../../core/events/types';

jest.mock('../../core/utils/logger', () => ({
  getLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(),
  })),
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(),
  })),
}));

jest.mock('../../core/rules/engine');
jest.mock('../../core/rules/loader');
jest.mock('../../core/config/loader');

const mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined): never => {
  throw new Error(`process.exit called with ${code}`);
});

const mockLoadConfig = jest.fn();
const mockLoadRules = jest.fn();
const mockGetRules = jest.fn();
const mockGetEnabledRules = jest.fn();
const mockGetDisabledRules = jest.fn();
const mockGetRule = jest.fn();
const mockEnableRule = jest.fn();
const mockDisableRule = jest.fn();
const mockEvaluateRule = jest.fn();
const mockValidateRuleFile = jest.fn();
const mockLoadRule = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  mockExit.mockClear();
  
  (require('../../core/config/loader') as any).loadConfig = mockLoadConfig;
  
  mockLoadConfig.mockReturnValue({
    rules: {
      directory: '.zenflow/rules',
      auto_load: true,
      validation_strict: true,
    },
  });

  (require('../../core/rules/engine') as any).RuleEngine = jest.fn().mockImplementation(() => ({
    loadRules: mockLoadRules,
    getRules: mockGetRules,
    getEnabledRules: mockGetEnabledRules,
    getDisabledRules: mockGetDisabledRules,
    getRule: mockGetRule,
    enableRule: mockEnableRule,
    disableRule: mockDisableRule,
    evaluateRule: mockEvaluateRule,
  }));

  (require('../../core/rules/loader') as any).RuleLoader = jest.fn().mockImplementation(() => ({
    validateRuleFile: mockValidateRuleFile,
    loadRule: mockLoadRule,
  }));
});

describe('Rule CLI Commands', () => {
  const createMockRule = (overrides: Partial<Rule> = {}): Rule => ({
    name: 'test-rule',
    version: '1.0.0',
    description: 'Test rule',
    author: 'Test Author',
    enabled: true,
    triggers: [
      {
        type: 'commit',
        branches: {
          include: ['feature/*'],
          exclude: [],
        },
      },
    ],
    conditions: [
      {
        type: 'branch_check',
        pattern: 'feature/*',
      },
    ],
    actions: [
      {
        type: 'run_workflow',
        workflow: 'test-workflow',
      },
    ],
    guards: {
      max_retries: 3,
      timeout: 300,
      on_error: 'abort',
    },
    ...overrides,
  });

  describe('zenflow rule list', () => {
    it('should list all rules', async () => {
      const mockRules = [
        createMockRule({ name: 'rule-1', enabled: true }),
        createMockRule({ name: 'rule-2', enabled: false }),
      ];
      
      mockLoadRules.mockResolvedValue(mockRules);
      mockGetRules.mockReturnValue(mockRules);

      const { createRuleCommand } = await import('./rule');
      const command = createRuleCommand({});

      await command.parseAsync(['node', 'test', 'list']);

      expect(mockLoadRules).toHaveBeenCalled();
      expect(mockGetRules).toHaveBeenCalled();
    });

    it('should filter enabled rules', async () => {
      const mockRules = [createMockRule({ enabled: true })];
      
      mockLoadRules.mockResolvedValue(mockRules);
      mockGetEnabledRules.mockReturnValue(mockRules);

      const { createRuleCommand } = await import('./rule');
      const command = createRuleCommand({});

      await command.parseAsync(['node', 'test', 'list', '--enabled']);

      expect(mockGetEnabledRules).toHaveBeenCalled();
    });

    it('should filter disabled rules', async () => {
      const mockRules = [createMockRule({ enabled: false })];
      
      mockLoadRules.mockResolvedValue(mockRules);
      mockGetDisabledRules.mockReturnValue(mockRules);

      const { createRuleCommand } = await import('./rule');
      const command = createRuleCommand({});

      await command.parseAsync(['node', 'test', 'list', '--disabled']);

      expect(mockGetDisabledRules).toHaveBeenCalled();
    });

    it('should output JSON when --json flag is set', async () => {
      const mockRules = [createMockRule()];
      
      mockLoadRules.mockResolvedValue(mockRules);
      mockGetRules.mockReturnValue(mockRules);

      const { createRuleCommand } = await import('./rule');
      const command = createRuleCommand({ json: true });

      await command.parseAsync(['node', 'test', 'list']);

      expect(mockGetRules).toHaveBeenCalled();
    });
  });

  describe('zenflow rule show', () => {
    it('should show rule details', async () => {
      const mockRule = createMockRule({ name: 'test-rule' });
      
      mockLoadRules.mockResolvedValue([mockRule]);
      mockGetRule.mockReturnValue(mockRule);

      const { createRuleCommand } = await import('./rule');
      const command = createRuleCommand({});

      await command.parseAsync(['node', 'test', 'show', 'test-rule']);

      expect(mockLoadRules).toHaveBeenCalled();
      expect(mockGetRule).toHaveBeenCalledWith('test-rule');
    });

    it('should output JSON when --json flag is set', async () => {
      const mockRule = createMockRule();
      
      mockLoadRules.mockResolvedValue([mockRule]);
      mockGetRule.mockReturnValue(mockRule);

      const { createRuleCommand } = await import('./rule');
      const command = createRuleCommand({ json: true });

      await command.parseAsync(['node', 'test', 'show', 'test-rule']);

      expect(mockGetRule).toHaveBeenCalledWith('test-rule');
    });

    it('should handle rule not found', async () => {
      mockLoadRules.mockResolvedValue([]);
      mockGetRule.mockReturnValue(undefined);

      const { createRuleCommand } = await import('./rule');
      const command = createRuleCommand({});

      await expect(
        command.parseAsync(['node', 'test', 'show', 'non-existent'])
      ).rejects.toThrow();
    });
  });

  describe('zenflow rule validate', () => {
    it('should validate a valid rule file', async () => {
      const mockRule = createMockRule();
      
      mockValidateRuleFile.mockResolvedValue({ valid: true });
      mockLoadRule.mockResolvedValue(mockRule);

      const { createRuleCommand } = await import('./rule');
      const command = createRuleCommand({});

      await command.parseAsync(['node', 'test', 'validate', 'test-rule.yaml']);

      expect(mockValidateRuleFile).toHaveBeenCalledWith('test-rule.yaml');
      expect(mockLoadRule).toHaveBeenCalledWith('test-rule.yaml');
    });

    it('should handle invalid rule file', async () => {
      mockValidateRuleFile.mockResolvedValue({
        valid: false,
        errors: ['name: Required', 'version: Required'],
      });

      const { createRuleCommand } = await import('./rule');
      const command = createRuleCommand({});

      await expect(
        command.parseAsync(['node', 'test', 'validate', 'invalid-rule.yaml'])
      ).rejects.toThrow();
    });
  });

  describe('zenflow rule enable', () => {
    it('should enable a rule', async () => {
      const mockRule = createMockRule({ enabled: false });
      
      mockLoadRules.mockResolvedValue([mockRule]);
      mockEnableRule.mockResolvedValue(undefined);

      const { createRuleCommand } = await import('./rule');
      const command = createRuleCommand({});

      await command.parseAsync(['node', 'test', 'enable', 'test-rule']);

      expect(mockLoadRules).toHaveBeenCalled();
      expect(mockEnableRule).toHaveBeenCalledWith('test-rule');
    });
  });

  describe('zenflow rule disable', () => {
    it('should disable a rule', async () => {
      const mockRule = createMockRule({ enabled: true });
      
      mockLoadRules.mockResolvedValue([mockRule]);
      mockDisableRule.mockResolvedValue(undefined);

      const { createRuleCommand } = await import('./rule');
      const command = createRuleCommand({});

      await command.parseAsync(['node', 'test', 'disable', 'test-rule']);

      expect(mockLoadRules).toHaveBeenCalled();
      expect(mockDisableRule).toHaveBeenCalledWith('test-rule');
    });
  });

  describe('zenflow rule test', () => {
    it('should test rule with default event', async () => {
      const mockRule = createMockRule();
      
      mockLoadRules.mockResolvedValue([mockRule]);
      mockGetRule.mockReturnValue(mockRule);
      mockEvaluateRule.mockResolvedValue(true);

      const { createRuleCommand } = await import('./rule');
      const command = createRuleCommand({});

      await command.parseAsync(['node', 'test', 'test', 'test-rule']);

      expect(mockLoadRules).toHaveBeenCalled();
      expect(mockGetRule).toHaveBeenCalledWith('test-rule');
      expect(mockEvaluateRule).toHaveBeenCalled();
    });

    it('should test rule with custom event', async () => {
      const mockRule = createMockRule();
      const customEvent: Event = {
        type: 'commit',
        branch: 'feature/test',
        timestamp: new Date(),
        data: { commit: 'abc123' },
      };
      
      mockLoadRules.mockResolvedValue([mockRule]);
      mockGetRule.mockReturnValue(mockRule);
      mockEvaluateRule.mockResolvedValue(true);

      const { createRuleCommand } = await import('./rule');
      const command = createRuleCommand({});

      await command.parseAsync([
        'node',
        'test',
        'test',
        'test-rule',
        '--event',
        JSON.stringify(customEvent),
      ]);

      expect(mockEvaluateRule).toHaveBeenCalled();
    });

    it('should handle rule would not trigger', async () => {
      const mockRule = createMockRule();
      
      mockLoadRules.mockResolvedValue([mockRule]);
      mockGetRule.mockReturnValue(mockRule);
      mockEvaluateRule.mockResolvedValue(false);

      const { createRuleCommand } = await import('./rule');
      const command = createRuleCommand({});

      await command.parseAsync(['node', 'test', 'test', 'test-rule']);

      expect(mockEvaluateRule).toHaveBeenCalled();
    });

    it('should handle invalid event JSON', async () => {
      const mockRule = createMockRule();
      
      mockLoadRules.mockResolvedValue([mockRule]);
      mockGetRule.mockReturnValue(mockRule);

      const { createRuleCommand } = await import('./rule');
      const command = createRuleCommand({});

      await expect(
        command.parseAsync([
          'node',
          'test',
          'test',
          'test-rule',
          '--event',
          'invalid-json',
        ])
      ).rejects.toThrow();
    });
  });
});
