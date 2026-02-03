import fs from 'fs';
import path from 'path';
import {
  ZenflowSettings,
  ZenflowSettingsSchema,
  SyncConfig,
  SyncConfigSchema,
  RulesConfig,
  RulesConfigSchema,
  WorkflowsConfig,
  WorkflowsConfigSchema,
  LoggingConfig,
  LoggingConfigSchema,
  GitConfig,
  GitConfigSchema,
} from './schema';
import { ConfigValidationError } from '../utils/errors';

export class ConfigValidator {
  validateSettings(config: unknown): ZenflowSettings {
    const result = ZenflowSettingsSchema.safeParse(config);
    
    if (!result.success) {
      const errorMessages = result.error.errors
        .map(err => `${err.path.join('.')}: ${err.message}`)
        .join(', ');
      throw new ConfigValidationError(
        `Configuration validation failed: ${errorMessages}`
      );
    }
    
    return result.data;
  }

  validateSync(config: unknown): SyncConfig {
    const result = SyncConfigSchema.safeParse(config);
    
    if (!result.success) {
      const errorMessages = result.error.errors
        .map(err => `${err.path.join('.')}: ${err.message}`)
        .join(', ');
      throw new ConfigValidationError(
        `Sync configuration validation failed: ${errorMessages}`
      );
    }
    
    return result.data;
  }

  validateRules(config: unknown): RulesConfig {
    const result = RulesConfigSchema.safeParse(config);
    
    if (!result.success) {
      const errorMessages = result.error.errors
        .map(err => `${err.path.join('.')}: ${err.message}`)
        .join(', ');
      throw new ConfigValidationError(
        `Rules configuration validation failed: ${errorMessages}`
      );
    }
    
    return result.data;
  }

  validateWorkflows(config: unknown): WorkflowsConfig {
    const result = WorkflowsConfigSchema.safeParse(config);
    
    if (!result.success) {
      const errorMessages = result.error.errors
        .map(err => `${err.path.join('.')}: ${err.message}`)
        .join(', ');
      throw new ConfigValidationError(
        `Workflows configuration validation failed: ${errorMessages}`
      );
    }
    
    return result.data;
  }

  validateLogging(config: unknown): LoggingConfig {
    const result = LoggingConfigSchema.safeParse(config);
    
    if (!result.success) {
      const errorMessages = result.error.errors
        .map(err => `${err.path.join('.')}: ${err.message}`)
        .join(', ');
      throw new ConfigValidationError(
        `Logging configuration validation failed: ${errorMessages}`
      );
    }
    
    return result.data;
  }

  validateGit(config: unknown): GitConfig {
    const result = GitConfigSchema.safeParse(config);
    
    if (!result.success) {
      const errorMessages = result.error.errors
        .map(err => `${err.path.join('.')}: ${err.message}`)
        .join(', ');
      throw new ConfigValidationError(
        `Git configuration validation failed: ${errorMessages}`
      );
    }
    
    return result.data;
  }

  validateFile(filePath: string): ZenflowSettings {
    const absolutePath = path.resolve(process.cwd(), filePath);
    
    if (!fs.existsSync(absolutePath)) {
      throw new ConfigValidationError(
        `Configuration file not found: ${absolutePath}`
      );
    }

    let rawContent: string;
    try {
      rawContent = fs.readFileSync(absolutePath, 'utf-8');
    } catch (error) {
      throw new ConfigValidationError(
        `Failed to read configuration file: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    if (!rawContent.trim()) {
      throw new ConfigValidationError(
        `Configuration file is empty: ${absolutePath}`
      );
    }

    let parsedConfig: unknown;
    try {
      parsedConfig = JSON.parse(rawContent);
    } catch (parseError) {
      throw new ConfigValidationError(
        `Invalid JSON in configuration file: ${parseError instanceof Error ? parseError.message : String(parseError)}`
      );
    }

    return this.validateSettings(parsedConfig);
  }

  checkDirectoryAccess(dirPath: string): { exists: boolean; writable: boolean; readable: boolean } {
    const absolutePath = path.resolve(process.cwd(), dirPath);
    
    if (!fs.existsSync(absolutePath)) {
      return { exists: false, writable: false, readable: false };
    }

    let writable = false;
    let readable = false;

    try {
      fs.accessSync(absolutePath, fs.constants.R_OK);
      readable = true;
    } catch {
      readable = false;
    }

    try {
      fs.accessSync(absolutePath, fs.constants.W_OK);
      writable = true;
    } catch {
      writable = false;
    }

    return { exists: true, writable, readable };
  }

  validateDirectories(config: any): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (config.rules?.directory) {
      const rulesDir = this.checkDirectoryAccess(config.rules.directory);
      if (!rulesDir.exists) {
        warnings.push(`Rules directory does not exist: ${config.rules.directory}`);
      } else if (!rulesDir.readable) {
        errors.push(`Rules directory is not readable: ${config.rules.directory}`);
      }
    }

    if (config.workflows?.directory) {
      const workflowsDir = this.checkDirectoryAccess(config.workflows.directory);
      if (!workflowsDir.exists) {
        warnings.push(`Workflows directory does not exist: ${config.workflows.directory}`);
      } else if (!workflowsDir.readable) {
        errors.push(`Workflows directory is not readable: ${config.workflows.directory}`);
      }
    }

    if (config.workflows?.state_directory) {
      const stateDir = this.checkDirectoryAccess(config.workflows.state_directory);
      if (!stateDir.exists) {
        warnings.push(`Workflow state directory does not exist: ${config.workflows.state_directory}`);
      } else if (!stateDir.writable) {
        errors.push(`Workflow state directory is not writable: ${config.workflows.state_directory}`);
      }
    }

    if (config.logging?.directory) {
      const logsDir = this.checkDirectoryAccess(config.logging.directory);
      if (!logsDir.exists) {
        warnings.push(`Logs directory does not exist: ${config.logging.directory}`);
      } else if (!logsDir.writable) {
        errors.push(`Logs directory is not writable: ${config.logging.directory}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}

const defaultValidator = new ConfigValidator();

export function validateSettings(config: unknown): ZenflowSettings {
  return defaultValidator.validateSettings(config);
}

export function validateFile(filePath: string): ZenflowSettings {
  return defaultValidator.validateFile(filePath);
}

export function validateDirectories(config: any): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  return defaultValidator.validateDirectories(config);
}
