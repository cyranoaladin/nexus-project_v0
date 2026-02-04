import { exec } from 'child_process';
import { promisify } from 'util';
import { getLogger } from '../utils/logger';
import { GitClient } from '../git/client';
import { ConflictDetector } from '../sync/conflicts';
import type { Rule, Trigger, Condition } from './types';
import type { Event } from '../events/types';

const execAsync = promisify(exec);

export class RuleEvaluator {
  private repoPath: string;
  private gitClient: GitClient;
  private conflictDetector: ConflictDetector;
  private logger = getLogger();

  constructor(repoPath: string) {
    this.repoPath = repoPath;
    this.gitClient = new GitClient(repoPath);
    this.conflictDetector = new ConflictDetector(repoPath);
  }

  async evaluateRule(rule: Rule, event: Event): Promise<boolean> {
    try {
      this.logger.debug('Evaluating rule', { rule: rule.name, eventType: event.type });

      if (!rule.enabled) {
        this.logger.debug('Rule is disabled', { rule: rule.name });
        return false;
      }

      const triggerMatches = await this.evaluateTriggers(rule.triggers, event);
      if (!triggerMatches) {
        this.logger.debug('Trigger did not match', { rule: rule.name });
        return false;
      }

      const conditionsPass = await this.evaluateConditions(rule.conditions, event);
      if (!conditionsPass) {
        this.logger.debug('Conditions did not pass', { rule: rule.name });
        return false;
      }

      this.logger.info('Rule evaluation passed', { rule: rule.name });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Rule evaluation failed', { rule: rule.name, error: message });
      return false;
    }
  }

  async evaluateTriggers(triggers: Trigger[], event: Event): Promise<boolean> {
    for (const trigger of triggers) {
      if (await this.evaluateTrigger(trigger, event)) {
        return true;
      }
    }
    return false;
  }

  async evaluateTrigger(trigger: Trigger, event: Event): Promise<boolean> {
    if (trigger.type !== event.type) {
      return false;
    }

    if (trigger.branches) {
      const branchMatch = await this.matchBranchPattern(trigger.branches.pattern, event);
      if (!branchMatch) {
        return false;
      }
    }

    if (trigger.events && trigger.events.length > 0) {
      const eventMatch = this.matchEventType(trigger.events, event);
      if (!eventMatch) {
        return false;
      }
    }

    return true;
  }

  async evaluateConditions(conditions: Condition[], event: Event): Promise<boolean> {
    for (const condition of conditions) {
      const result = await this.evaluateCondition(condition, event);
      if (!result) {
        this.logger.debug('Condition failed', { type: condition.type });
        return false;
      }
    }
    return true;
  }

  async evaluateCondition(condition: Condition, event: Event): Promise<boolean> {
    try {
      switch (condition.type) {
        case 'branch_check':
          return await this.evaluateBranchCheck(condition, event);
        
        case 'worktree_active':
          return await this.evaluateWorktreeActive(condition, event);
        
        case 'no_conflicts':
          return await this.evaluateNoConflicts(condition, event);
        
        case 'disk_space':
          return await this.evaluateDiskSpace(condition);
        
        default:
          this.logger.warn('Unknown condition type', { type: condition.type });
          return true;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Condition evaluation failed', { 
        type: condition.type, 
        error: message 
      });
      return false;
    }
  }

  private async evaluateBranchCheck(condition: Condition, event: Event): Promise<boolean> {
    const branch = this.extractBranchFromEvent(event);
    
    if (!branch) {
      this.logger.debug('No branch in event', { eventType: event.type });
      return false;
    }

    if ('not_branch' in condition) {
      const notBranch = condition.not_branch as string;
      const result = branch !== notBranch && !branch.endsWith(`/${notBranch}`);
      
      this.logger.debug('Branch check (not)', { 
        branch, 
        notBranch, 
        result 
      });
      
      return result;
    }

    if ('branch' in condition) {
      const expectedBranch = condition.branch as string;
      const result = branch === expectedBranch || branch.endsWith(`/${expectedBranch}`);
      
      this.logger.debug('Branch check (is)', { 
        branch, 
        expectedBranch, 
        result 
      });
      
      return result;
    }

    return true;
  }

  private async evaluateWorktreeActive(condition: Condition, event: Event): Promise<boolean> {
    const branch = this.extractBranchFromEvent(event);
    
    if (!branch) {
      return false;
    }

    try {
      const worktree = await this.gitClient.getWorktree(branch);
      const isActive = worktree !== null && !worktree.prunable && !worktree.locked;
      
      this.logger.debug('Worktree active check', { 
        branch, 
        isActive,
        exists: worktree !== null 
      });
      
      return isActive;
    } catch (error) {
      this.logger.error('Failed to check worktree status', { 
        branch, 
        error: error instanceof Error ? error.message : String(error) 
      });
      return false;
    }
  }

  private async evaluateNoConflicts(condition: Condition, event: Event): Promise<boolean> {
    const branch = this.extractBranchFromEvent(event);
    
    if (!branch) {
      return false;
    }

    const targetBranch = ('with_branch' in condition) 
      ? (condition.with_branch as string) 
      : 'main';

    try {
      const hasConflicts = await this.conflictDetector.quickCheck(targetBranch, branch);
      
      this.logger.debug('No conflicts check', { 
        branch, 
        targetBranch, 
        hasConflicts,
        result: !hasConflicts 
      });
      
      return !hasConflicts;
    } catch (error) {
      this.logger.error('Failed to check conflicts', { 
        branch, 
        targetBranch, 
        error: error instanceof Error ? error.message : String(error) 
      });
      return false;
    }
  }

  private async evaluateDiskSpace(condition: Condition): Promise<boolean> {
    const minGb = ('min_gb' in condition) ? Number(condition.min_gb) : 1;

    try {
      const { stdout } = await execAsync(`df -BG "${this.repoPath}" | tail -1 | awk '{print $4}'`);
      const availableGbStr = stdout.trim().replace('G', '');
      const availableGb = parseInt(availableGbStr, 10);

      const hasSpace = availableGb >= minGb;
      
      this.logger.debug('Disk space check', { 
        availableGb, 
        minGb, 
        hasSpace 
      });
      
      return hasSpace;
    } catch (error) {
      this.logger.error('Failed to check disk space', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      return false;
    }
  }

  private async matchBranchPattern(pattern: string, event: Event): Promise<boolean> {
    const branch = this.extractBranchFromEvent(event);
    
    if (!branch) {
      return false;
    }

    try {
      const regex = this.patternToRegex(pattern);
      const cleanBranch = branch.replace(/^refs\/heads\//, '');
      const matches = regex.test(cleanBranch);
      
      this.logger.debug('Branch pattern match', { 
        pattern, 
        branch: cleanBranch, 
        matches 
      });
      
      return matches;
    } catch (error) {
      this.logger.error('Invalid branch pattern', { 
        pattern, 
        error: error instanceof Error ? error.message : String(error) 
      });
      return false;
    }
  }

  private matchEventType(eventTypes: string[], event: Event): boolean {
    const matches = eventTypes.includes(event.source) || eventTypes.includes(event.type);
    
    this.logger.debug('Event type match', { 
      eventTypes, 
      eventSource: event.source, 
      eventType: event.type, 
      matches 
    });
    
    return matches;
  }

  private extractBranchFromEvent(event: Event): string | null {
    if ('branch' in event) {
      return (event as { branch: string }).branch;
    }
    return null;
  }

  private patternToRegex(pattern: string): RegExp {
    let regexStr = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');

    if (pattern.includes('[') && pattern.includes(']')) {
      return new RegExp(`^${regexStr}$`);
    }

    return new RegExp(`^${regexStr}$`);
  }
}
