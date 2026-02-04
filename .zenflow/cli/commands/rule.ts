import { Command } from 'commander';
import { createOutput } from '../utils/output';
import { ValidationError } from '../utils/validation';
import { RuleEngine } from '../../core/rules/engine';
import { RuleLoader } from '../../core/rules/loader';
import { loadConfig } from '../../core/config/loader';
import type { Rule } from '../../core/rules/types';
import type { Event } from '../../core/events/types';

function getRuleEngine(configPath?: string): RuleEngine {
  const config = loadConfig(configPath);
  const rulesDirectory = config.rules?.directory ?? '.zenflow/rules';
  const autoLoad = config.rules?.auto_load ?? true;

  return new RuleEngine({
    rulesDirectory,
    autoLoad,
    validationStrict: config.rules?.validation_strict ?? true,
  });
}

function formatRuleTriggers(rule: Rule): string {
  return rule.triggers
    .map(t => {
      const parts = [t.type];
      if (t.branches?.include) {
        parts.push(`branches: ${t.branches.include.join(', ')}`);
      }
      return parts.join(' | ');
    })
    .join(', ');
}

function formatRuleActions(rule: Rule): string {
  return rule.actions.map(a => a.type).join(', ');
}

export function createRuleCommand(globalOptions: any): Command {
  const command = new Command('rule');
  command.description('Manage Zenflow rules');

  command
    .command('list')
    .description('List all rules')
    .option('--enabled', 'Show only enabled rules')
    .option('--disabled', 'Show only disabled rules')
    .action(async (options) => {
      const output = createOutput(globalOptions);
      try {
        output.info('📋 Loading rules...');
        output.newline();

        const engine = getRuleEngine(globalOptions.config);
        await engine.loadRules();

        let rules: Rule[] = [];
        if (options.enabled) {
          rules = engine.getEnabledRules();
        } else if (options.disabled) {
          rules = engine.getDisabledRules();
        } else {
          rules = engine.getRules();
        }

        if (rules.length === 0) {
          output.info('No rules found');
          return;
        }

        if (globalOptions.json) {
          output.json(rules);
          return;
        }

        const tableData = rules.map(rule => ({
          Name: rule.name,
          Status: rule.enabled ? '✅ Enabled' : '❌ Disabled',
          Version: rule.version,
          Triggers: formatRuleTriggers(rule),
          Actions: formatRuleActions(rule),
        }));

        output.table(tableData, ['Name', 'Status', 'Version', 'Triggers', 'Actions']);
        
        output.newline();
        output.info(`Total: ${rules.length} rule(s)`);
      } catch (error) {
        output.error('Failed to list rules', error as Error);
        process.exit(1);
      }
    });

  command
    .command('show <rule-name>')
    .description('Show details of a specific rule')
    .action(async (ruleName) => {
      const output = createOutput(globalOptions);
      try {
        output.info(`📋 Loading rule: ${ruleName}...`);
        output.newline();

        const engine = getRuleEngine(globalOptions.config);
        await engine.loadRules();
        
        const rule = engine.getRule(ruleName);
        if (!rule) {
          throw new ValidationError(`Rule not found: ${ruleName}`);
        }

        if (globalOptions.json) {
          output.json(rule);
          return;
        }

        output.info('🔍 Rule Details:');
        output.newline();

        const details = [
          `  Name:        ${rule.name}`,
          `  Version:     ${rule.version}`,
          `  Status:      ${rule.enabled ? '✅ Enabled' : '❌ Disabled'}`,
          `  Author:      ${rule.author}`,
          `  Description: ${rule.description}`,
        ];

        output.list(details, '');

        output.newline();
        output.info('🎯 Triggers:');
        rule.triggers.forEach((trigger, idx) => {
          output.info(`  ${idx + 1}. Type: ${trigger.type}`);
          if (trigger.branches?.include) {
            output.info(`     Branches: ${trigger.branches.include.join(', ')}`);
          }
          if (trigger.branches?.exclude) {
            output.info(`     Exclude: ${trigger.branches.exclude.join(', ')}`);
          }
        });

        if (rule.conditions.length > 0) {
          output.newline();
          output.info('✅ Conditions:');
          rule.conditions.forEach((condition, idx) => {
            output.info(`  ${idx + 1}. ${condition.type}`);
          });
        }

        output.newline();
        output.info('⚡ Actions:');
        rule.actions.forEach((action, idx) => {
          output.info(`  ${idx + 1}. ${action.type}`);
          if (action.workflow) {
            output.info(`     Workflow: ${action.workflow}`);
          }
          if (action.command) {
            output.info(`     Command: ${action.command}`);
          }
        });

        output.newline();
        output.info('🛡️  Guards:');
        output.list([
          `  Max Retries: ${rule.guards.max_retries}`,
          `  Timeout:     ${rule.guards.timeout}s`,
          `  On Error:    ${rule.guards.on_error}`,
        ], '');
      } catch (error) {
        output.error(`Failed to show rule: ${ruleName}`, error as Error);
        process.exit(1);
      }
    });

  command
    .command('validate <file>')
    .description('Validate a rule YAML file')
    .action(async (file) => {
      const output = createOutput(globalOptions);
      try {
        output.info(`🔍 Validating rule file: ${file}...`);
        output.newline();

        const config = loadConfig(globalOptions.config);
        const rulesDirectory = config.rules?.directory ?? '.zenflow/rules';
        const loader = new RuleLoader(rulesDirectory);

        const result = await loader.validateRuleFile(file);

        if (result.valid) {
          output.success('✅ Rule file is valid!');
          output.newline();
          
          const rule = await loader.loadRule(file);
          output.info('Rule details:');
          output.list([
            `  Name:    ${rule.name}`,
            `  Version: ${rule.version}`,
            `  Author:  ${rule.author}`,
          ], '');
        } else {
          output.error('❌ Rule validation failed:');
          output.newline();
          result.errors?.forEach(error => {
            output.error(`  - ${error}`);
          });
          process.exit(1);
        }
      } catch (error) {
        output.error(`Failed to validate rule file: ${file}`, error as Error);
        process.exit(1);
      }
    });

  command
    .command('enable <rule-name>')
    .description('Enable a rule')
    .action(async (ruleName) => {
      const output = createOutput(globalOptions);
      try {
        output.info(`🔓 Enabling rule: ${ruleName}...`);
        output.newline();

        const engine = getRuleEngine(globalOptions.config);
        await engine.loadRules();
        
        await engine.enableRule(ruleName);

        output.success(`✅ Rule "${ruleName}" enabled successfully!`);
      } catch (error) {
        output.error(`Failed to enable rule: ${ruleName}`, error as Error);
        process.exit(1);
      }
    });

  command
    .command('disable <rule-name>')
    .description('Disable a rule')
    .action(async (ruleName) => {
      const output = createOutput(globalOptions);
      try {
        output.info(`🔒 Disabling rule: ${ruleName}...`);
        output.newline();

        const engine = getRuleEngine(globalOptions.config);
        await engine.loadRules();
        
        await engine.disableRule(ruleName);

        output.success(`✅ Rule "${ruleName}" disabled successfully!`);
      } catch (error) {
        output.error(`Failed to disable rule: ${ruleName}`, error as Error);
        process.exit(1);
      }
    });

  command
    .command('test <rule-name>')
    .description('Test a rule with an event')
    .option('--event <json>', 'Event JSON to test with')
    .action(async (ruleName, options) => {
      const output = createOutput(globalOptions);
      try {
        output.info(`🧪 Testing rule: ${ruleName}...`);
        output.newline();

        const engine = getRuleEngine(globalOptions.config);
        await engine.loadRules();
        
        const rule = engine.getRule(ruleName);
        if (!rule) {
          throw new ValidationError(`Rule not found: ${ruleName}`);
        }

        let event: Event;
        if (options.event) {
          try {
            event = JSON.parse(options.event);
          } catch (error) {
            throw new ValidationError('Invalid event JSON format');
          }
        } else {
          event = {
            type: 'commit',
            branch: 'main',
            timestamp: new Date(),
            data: {},
          };
          output.info('Using default test event (type: commit, branch: main)');
          output.newline();
        }

        const result = await engine.evaluateRule(rule, event);

        if (result) {
          output.success('✅ Rule would be triggered by this event!');
          output.newline();
          output.info('Actions that would be executed:');
          rule.actions.forEach((action, idx) => {
            output.info(`  ${idx + 1}. ${action.type}`);
          });
        } else {
          output.warning('⚠️  Rule would NOT be triggered by this event');
          output.newline();
          output.info('This means one or more conditions were not met.');
        }
      } catch (error) {
        output.error(`Failed to test rule: ${ruleName}`, error as Error);
        process.exit(1);
      }
    });

  return command;
}
