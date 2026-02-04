import fs from 'fs';
import path from 'path';
import { ZenflowSettings, ZenflowSettingsSchema } from './schema';
import { ConfigValidationError } from '../utils/errors';

export class ConfigLoader {
  private configPath: string;
  private cachedConfig: ZenflowSettings | null = null;

  constructor(configPath: string = '.zenflow/settings.json') {
    this.configPath = path.resolve(process.cwd(), configPath);
  }

  load(forceReload: boolean = false): ZenflowSettings {
    if (this.cachedConfig && !forceReload) {
      return this.cachedConfig;
    }

    try {
      if (!fs.existsSync(this.configPath)) {
        throw new ConfigValidationError(
          `Configuration file not found: ${this.configPath}`
        );
      }

      const rawContent = fs.readFileSync(this.configPath, 'utf-8');
      
      if (!rawContent.trim()) {
        throw new ConfigValidationError(
          `Configuration file is empty: ${this.configPath}`
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

      const validationResult = ZenflowSettingsSchema.safeParse(parsedConfig);
      
      if (!validationResult.success) {
        const errorMessages = validationResult.error.errors
          .map(err => `  - ${err.path.join('.')}: ${err.message}`)
          .join('\n');
        throw new ConfigValidationError(
          `Configuration validation failed:\n${errorMessages}`
        );
      }

      this.cachedConfig = this.applyDefaults(validationResult.data);
      return this.cachedConfig;
    } catch (error) {
      if (error instanceof ConfigValidationError) {
        throw error;
      }
      throw new ConfigValidationError(
        `Failed to load configuration: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private applyDefaults(config: ZenflowSettings): ZenflowSettings {
    return config;
  }

  reload(): ZenflowSettings {
    return this.load(true);
  }

  getConfigPath(): string {
    return this.configPath;
  }

  clearCache(): void {
    this.cachedConfig = null;
  }
}

const defaultLoader = new ConfigLoader();

export function loadConfig(configPath?: string): ZenflowSettings {
  if (configPath) {
    const loader = new ConfigLoader(configPath);
    return loader.load();
  }
  return defaultLoader.load();
}

export function reloadConfig(): ZenflowSettings {
  return defaultLoader.reload();
}

export function getConfigPath(): string {
  return defaultLoader.getConfigPath();
}

export function clearConfigCache(): void {
  defaultLoader.clearCache();
}
