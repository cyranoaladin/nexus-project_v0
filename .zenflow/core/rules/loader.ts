import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { getLogger } from '../utils/logger';
import { RuleSchema } from './schema';
import { ValidationError } from '../utils/errors';
import type { Rule, ValidationResult } from './types';

export class RuleLoader {
  private rulesDirectory: string;
  private logger = getLogger();

  constructor(rulesDirectory: string) {
    this.rulesDirectory = path.resolve(rulesDirectory);
  }

  async loadRules(): Promise<Rule[]> {
    try {
      this.logger.info('Loading rules from directory', { directory: this.rulesDirectory });

      const ruleFiles = await this.discoverRuleFiles();
      const rules: Rule[] = [];

      for (const file of ruleFiles) {
        try {
          const rule = await this.loadRuleFromFile(file);
          rules.push(rule);
        } catch (error) {
          this.logger.warn('Failed to load rule file', { 
            file, 
            error: error instanceof Error ? error.message : String(error) 
          });
        }
      }

      this.logger.info(`Loaded ${rules.length} rules successfully`);
      return rules;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to load rules', { error: message });
      throw new ValidationError(`Failed to load rules: ${message}`);
    }
  }

  async loadRule(nameOrPath: string): Promise<Rule> {
    try {
      this.logger.debug('Loading rule', { nameOrPath });

      let filePath: string;
      if (nameOrPath.endsWith('.yaml') || nameOrPath.endsWith('.yml')) {
        filePath = path.isAbsolute(nameOrPath) ? nameOrPath : path.join(this.rulesDirectory, nameOrPath);
      } else {
        filePath = await this.findRuleFile(nameOrPath);
      }

      const rule = await this.loadRuleFromFile(filePath);
      this.logger.info('Rule loaded successfully', { name: rule.name, file: filePath });
      return rule;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to load rule', { nameOrPath, error: message });
      throw new ValidationError(`Failed to load rule "${nameOrPath}": ${message}`);
    }
  }

  async validateRuleFile(filePath: string): Promise<ValidationResult> {
    try {
      this.logger.debug('Validating rule file', { filePath });

      const content = await fs.readFile(filePath, 'utf-8');
      const data = yaml.load(content);

      const result = RuleSchema.safeParse(data);

      if (!result.success) {
        const errors = result.error.errors.map(err => 
          `${err.path.join('.')}: ${err.message}`
        );
        
        this.logger.warn('Rule validation failed', { filePath, errors });
        
        return {
          valid: false,
          errors,
        };
      }

      this.logger.debug('Rule file is valid', { filePath });
      return { valid: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to validate rule file', { filePath, error: message });
      return {
        valid: false,
        errors: [message],
      };
    }
  }

  private async loadRuleFromFile(filePath: string): Promise<Rule> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const data = yaml.load(content);

      const result = RuleSchema.safeParse(data);

      if (!result.success) {
        const errors = result.error.errors.map(err => 
          `${err.path.join('.')}: ${err.message}`
        ).join(', ');
        
        throw new ValidationError(
          `Invalid rule schema in ${filePath}: ${errors}`
        );
      }

      return result.data;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      
      const message = error instanceof Error ? error.message : String(error);
      throw new ValidationError(`Failed to parse rule file ${filePath}: ${message}`);
    }
  }

  private async discoverRuleFiles(): Promise<string[]> {
    try {
      const files: string[] = [];
      
      const exists = await fs.access(this.rulesDirectory)
        .then(() => true)
        .catch(() => false);

      if (!exists) {
        this.logger.warn('Rules directory does not exist', { directory: this.rulesDirectory });
        return files;
      }

      await this.scanDirectory(this.rulesDirectory, files);

      this.logger.debug(`Discovered ${files.length} rule files`);
      return files;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to discover rule files', { error: message });
      throw new ValidationError(`Failed to discover rule files: ${message}`);
    }
  }

  private async scanDirectory(dir: string, files: string[]): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        await this.scanDirectory(fullPath, files);
      } else if (entry.isFile() && (entry.name.endsWith('.yaml') || entry.name.endsWith('.yml'))) {
        files.push(fullPath);
      }
    }
  }

  private async findRuleFile(ruleName: string): Promise<string> {
    const possibleExtensions = ['.yaml', '.yml'];
    
    for (const ext of possibleExtensions) {
      const filePath = path.join(this.rulesDirectory, `${ruleName}${ext}`);
      
      const exists = await fs.access(filePath)
        .then(() => true)
        .catch(() => false);

      if (exists) {
        return filePath;
      }

      const syncPath = path.join(this.rulesDirectory, 'sync', `${ruleName}${ext}`);
      const syncExists = await fs.access(syncPath)
        .then(() => true)
        .catch(() => false);

      if (syncExists) {
        return syncPath;
      }
    }

    throw new ValidationError(`Rule file not found for rule: ${ruleName}`);
  }
}
