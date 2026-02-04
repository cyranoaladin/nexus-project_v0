import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { getLogger } from '../utils/logger';
import { RuleLoader } from './loader';
import { RuleEvaluator } from './evaluator';
import { RuleSchema } from './schema';
import { ValidationError } from '../utils/errors';
import type { Rule, RuleEngineConfig, ValidationResult } from './types';
import type { Event } from '../events/types';

export class RuleEngine {
  private config: RuleEngineConfig;
  private loader: RuleLoader;
  private evaluator: RuleEvaluator;
  private rules: Map<string, Rule> = new Map();
  private logger = getLogger();

  constructor(config: RuleEngineConfig) {
    this.config = config;
    this.loader = new RuleLoader(config.rulesDirectory);
    this.evaluator = new RuleEvaluator(process.cwd());

    if (config.autoLoad) {
      this.loadRules().catch(error => {
        this.logger.error('Failed to auto-load rules', { 
          error: error instanceof Error ? error.message : String(error) 
        });
      });
    }
  }

  async loadRules(): Promise<Rule[]> {
    try {
      this.logger.info('Loading all rules');
      
      const rules = await this.loader.loadRules();
      
      this.rules.clear();
      for (const rule of rules) {
        this.rules.set(rule.name, rule);
      }

      this.logger.info(`Loaded ${rules.length} rules into engine`);
      return rules;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to load rules', { error: message });
      throw new ValidationError(`Failed to load rules: ${message}`);
    }
  }

  async loadRule(name: string): Promise<Rule> {
    try {
      this.logger.debug('Loading single rule', { name });
      
      const rule = await this.loader.loadRule(name);
      this.rules.set(rule.name, rule);

      this.logger.info('Rule loaded into engine', { name: rule.name });
      return rule;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to load rule', { name, error: message });
      throw new ValidationError(`Failed to load rule "${name}": ${message}`);
    }
  }

  async validateRule(rule: Rule): Promise<ValidationResult> {
    try {
      this.logger.debug('Validating rule', { name: rule.name });

      const result = RuleSchema.safeParse(rule);

      if (!result.success) {
        const errors = result.error.errors.map(err => 
          `${err.path.join('.')}: ${err.message}`
        );
        
        this.logger.warn('Rule validation failed', { name: rule.name, errors });
        
        return {
          valid: false,
          errors,
        };
      }

      this.logger.debug('Rule is valid', { name: rule.name });
      return { valid: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Rule validation error', { name: rule.name, error: message });
      return {
        valid: false,
        errors: [message],
      };
    }
  }

  async evaluateRule(rule: Rule, event: Event): Promise<boolean> {
    try {
      this.logger.debug('Evaluating rule against event', { 
        rule: rule.name, 
        eventType: event.type 
      });

      const result = await this.evaluator.evaluateRule(rule, event);

      this.logger.debug('Rule evaluation result', { 
        rule: rule.name, 
        result 
      });

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to evaluate rule', { 
        rule: rule.name, 
        error: message 
      });
      return false;
    }
  }

  async executeRule(rule: Rule, event: Event): Promise<void> {
    try {
      this.logger.info('Executing rule', { rule: rule.name, eventType: event.type });

      const shouldExecute = await this.evaluateRule(rule, event);
      
      if (!shouldExecute) {
        this.logger.debug('Rule conditions not met, skipping execution', { 
          rule: rule.name 
        });
        return;
      }

      for (const action of rule.actions) {
        await this.executeAction(action, event, rule);
      }

      this.logger.info('Rule executed successfully', { rule: rule.name });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Rule execution failed', { 
        rule: rule.name, 
        error: message 
      });

      if (rule.guards.on_error === 'abort') {
        throw new ValidationError(
          `Rule execution failed (abort): ${message}`
        );
      }
    }
  }

  async enableRule(name: string): Promise<void> {
    try {
      this.logger.info('Enabling rule', { name });

      const rule = this.rules.get(name);
      if (!rule) {
        throw new ValidationError(`Rule not found: ${name}`);
      }

      rule.enabled = true;
      await this.persistRule(rule);

      this.logger.info('Rule enabled', { name });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to enable rule', { name, error: message });
      throw new ValidationError(`Failed to enable rule "${name}": ${message}`);
    }
  }

  async disableRule(name: string): Promise<void> {
    try {
      this.logger.info('Disabling rule', { name });

      const rule = this.rules.get(name);
      if (!rule) {
        throw new ValidationError(`Rule not found: ${name}`);
      }

      rule.enabled = false;
      await this.persistRule(rule);

      this.logger.info('Rule disabled', { name });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to disable rule', { name, error: message });
      throw new ValidationError(`Failed to disable rule "${name}": ${message}`);
    }
  }

  getRules(): Rule[] {
    return Array.from(this.rules.values());
  }

  getRule(name: string): Rule | undefined {
    return this.rules.get(name);
  }

  getEnabledRules(): Rule[] {
    return Array.from(this.rules.values()).filter(rule => rule.enabled);
  }

  getDisabledRules(): Rule[] {
    return Array.from(this.rules.values()).filter(rule => !rule.enabled);
  }

  async findMatchingRules(event: Event): Promise<Rule[]> {
    try {
      this.logger.debug('Finding matching rules for event', { eventType: event.type });

      const matchingRules: Rule[] = [];
      const enabledRules = this.getEnabledRules();

      for (const rule of enabledRules) {
        const matches = await this.evaluateRule(rule, event);
        if (matches) {
          matchingRules.push(rule);
        }
      }

      this.logger.info('Found matching rules', { 
        count: matchingRules.length,
        rules: matchingRules.map(r => r.name) 
      });

      return matchingRules;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to find matching rules', { error: message });
      throw new ValidationError(`Failed to find matching rules: ${message}`);
    }
  }

  private async executeAction(action: any, event: Event, rule: Rule): Promise<void> {
    this.logger.debug('Executing action', { 
      type: action.type, 
      rule: rule.name 
    });

    switch (action.type) {
      case 'log':
        this.logger.info('Rule action: log', { 
          rule: rule.name, 
          message: action.message 
        });
        break;

      case 'run_workflow':
        this.logger.info('Rule action: run_workflow', { 
          rule: rule.name, 
          workflow: action.workflow 
        });
        break;

      case 'shell':
        this.logger.info('Rule action: shell', { 
          rule: rule.name, 
          command: action.command 
        });
        break;

      case 'notify':
        this.logger.info('Rule action: notify', { 
          rule: rule.name, 
          message: action.message 
        });
        break;

      default:
        this.logger.warn('Unknown action type', { type: action.type });
    }
  }

  private async persistRule(rule: Rule): Promise<void> {
    try {
      const filePath = await this.findRuleFilePath(rule.name);
      const content = yaml.dump(rule, { indent: 2, lineWidth: 120 });
      
      await fs.writeFile(filePath, content, 'utf-8');
      
      this.logger.debug('Rule persisted', { name: rule.name, filePath });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to persist rule', { 
        name: rule.name, 
        error: message 
      });
      throw new ValidationError(`Failed to persist rule: ${message}`);
    }
  }

  private async findRuleFilePath(ruleName: string): Promise<string> {
    const possibleExtensions = ['.yaml', '.yml'];
    
    for (const ext of possibleExtensions) {
      const filePath = path.join(this.config.rulesDirectory, `${ruleName}${ext}`);
      
      const exists = await fs.access(filePath)
        .then(() => true)
        .catch(() => false);

      if (exists) {
        return filePath;
      }

      const syncPath = path.join(this.config.rulesDirectory, 'sync', `${ruleName}${ext}`);
      const syncExists = await fs.access(syncPath)
        .then(() => true)
        .catch(() => false);

      if (syncExists) {
        return syncPath;
      }
    }

    return path.join(this.config.rulesDirectory, `${ruleName}.yaml`);
  }
}
