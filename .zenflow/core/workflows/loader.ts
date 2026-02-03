import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { glob } from 'glob';
import { WorkflowSchema } from './schema';
import { Workflow } from './types';
import { ValidationError } from '../utils/errors';
import { getLogger } from '../utils/logger';

const logger = getLogger();

export class WorkflowLoader {
  private workflowsDirectory: string;
  private cachedWorkflows: Map<string, Workflow> = new Map();

  constructor(workflowsDirectory: string = '.zenflow/workflows') {
    this.workflowsDirectory = path.resolve(process.cwd(), workflowsDirectory);
  }

  async loadWorkflows(): Promise<Workflow[]> {
    logger.info('Loading workflows from directory', { directory: this.workflowsDirectory });

    if (!fs.existsSync(this.workflowsDirectory)) {
      logger.warn('Workflows directory does not exist', { directory: this.workflowsDirectory });
      return [];
    }

    const pattern = path.join(this.workflowsDirectory, '**/*.{yaml,yml}');
    const workflowFiles = await glob(pattern, { nodir: true });

    logger.info(`Found ${workflowFiles.length} workflow files`);

    const workflows: Workflow[] = [];
    for (const filePath of workflowFiles) {
      try {
        const workflow = await this.loadWorkflowFromFile(filePath);
        workflows.push(workflow);
        this.cachedWorkflows.set(workflow.name, workflow);
      } catch (error) {
        logger.error('Failed to load workflow file', {
          file: filePath,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return workflows;
  }

  async loadWorkflow(name: string): Promise<Workflow> {
    if (this.cachedWorkflows.has(name)) {
      logger.debug('Returning cached workflow', { name });
      return this.cachedWorkflows.get(name)!;
    }

    logger.info('Loading workflow by name', { name });

    const pattern = path.join(this.workflowsDirectory, '**/*.{yaml,yml}');
    const workflowFiles = await glob(pattern, { nodir: true });

    for (const filePath of workflowFiles) {
      try {
        const workflow = await this.loadWorkflowFromFile(filePath);
        this.cachedWorkflows.set(workflow.name, workflow);
        
        if (workflow.name === name) {
          logger.info('Found workflow', { name, file: filePath });
          return workflow;
        }
      } catch (error) {
        logger.debug('Skipping invalid workflow file', {
          file: filePath,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    throw new ValidationError(`Workflow not found: ${name}`);
  }

  async loadWorkflowFromFile(filePath: string): Promise<Workflow> {
    logger.debug('Loading workflow from file', { file: filePath });

    if (!fs.existsSync(filePath)) {
      throw new ValidationError(`Workflow file not found: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, 'utf-8');

    let parsed: unknown;
    try {
      parsed = yaml.load(content);
    } catch (error) {
      throw new ValidationError(
        `Failed to parse YAML in ${filePath}: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    const validationResult = WorkflowSchema.safeParse(parsed);
    
    if (!validationResult.success) {
      const errorMessages = validationResult.error.errors
        .map(err => `  - ${err.path.join('.')}: ${err.message}`)
        .join('\n');
      throw new ValidationError(
        `Workflow validation failed for ${filePath}:\n${errorMessages}`
      );
    }

    logger.debug('Successfully loaded and validated workflow', {
      file: filePath,
      name: validationResult.data.name,
      version: validationResult.data.version,
    });

    return validationResult.data;
  }

  validateWorkflow(workflow: Workflow): { valid: boolean; errors?: string[] } {
    const validationResult = WorkflowSchema.safeParse(workflow);
    
    if (validationResult.success) {
      return { valid: true };
    }

    const errors = validationResult.error.errors.map(
      err => `${err.path.join('.')}: ${err.message}`
    );
    
    return { valid: false, errors };
  }

  clearCache(): void {
    logger.debug('Clearing workflow cache');
    this.cachedWorkflows.clear();
  }

  getCachedWorkflows(): Workflow[] {
    return Array.from(this.cachedWorkflows.values());
  }
}

const defaultLoader = new WorkflowLoader();

export async function loadWorkflows(): Promise<Workflow[]> {
  return defaultLoader.loadWorkflows();
}

export async function loadWorkflow(name: string): Promise<Workflow> {
  return defaultLoader.loadWorkflow(name);
}

export async function loadWorkflowFromFile(filePath: string): Promise<Workflow> {
  return defaultLoader.loadWorkflowFromFile(filePath);
}

export function validateWorkflow(workflow: Workflow): { valid: boolean; errors?: string[] } {
  return defaultLoader.validateWorkflow(workflow);
}

export function clearWorkflowCache(): void {
  defaultLoader.clearCache();
}
