import path from 'path';
import { GitOperationError, ValidationError } from './errors';

const SENSITIVE_KEYS = [
  'password',
  'token',
  'secret',
  'api_key',
  'apikey',
  'auth',
  'credential',
  'private_key',
  'privatekey',
  'access_token',
  'accesstoken',
];

export class SecurityValidator {
  static validateBranchName(branch: string): string {
    if (!branch || typeof branch !== 'string') {
      throw new GitOperationError('Branch name must be a non-empty string');
    }

    if (!/^[a-zA-Z0-9/_-]+$/.test(branch)) {
      throw new GitOperationError(
        `Invalid branch name: contains forbidden characters. Only alphanumeric, '/', '_', and '-' are allowed`
      );
    }

    if (branch.length > 255) {
      throw new GitOperationError('Branch name exceeds maximum length of 255 characters');
    }

    return branch;
  }

  static validateFilePath(filePath: string, baseDir?: string): string {
    if (!filePath || typeof filePath !== 'string') {
      throw new ValidationError('File path must be a non-empty string');
    }

    const normalized = path.normalize(filePath);

    if (normalized.includes('..')) {
      throw new ValidationError(
        `Path traversal detected in file path: ${filePath}`
      );
    }

    if (path.isAbsolute(normalized) && baseDir) {
      const resolvedBase = path.resolve(baseDir);
      const resolvedPath = path.resolve(normalized);
      
      if (!resolvedPath.startsWith(resolvedBase)) {
        throw new ValidationError(
          `File path escapes base directory: ${filePath}`
        );
      }
    }

    if (filePath.length > 4096) {
      throw new ValidationError('File path exceeds maximum length of 4096 characters');
    }

    return normalized;
  }

  static validateStashId(stashId: string): string {
    if (!stashId || typeof stashId !== 'string') {
      throw new GitOperationError('Stash ID must be a non-empty string');
    }

    if (!/^stash@\{\d+\}$/.test(stashId)) {
      throw new GitOperationError(
        `Invalid stash ID format: ${stashId}. Expected format: stash@{n}`
      );
    }

    return stashId;
  }

  static sanitizeCommitMessage(message: string): string {
    if (!message || typeof message !== 'string') {
      throw new GitOperationError('Commit message must be a non-empty string');
    }

    if (message.length > 10000) {
      throw new GitOperationError('Commit message exceeds maximum length of 10000 characters');
    }

    return message
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\$/g, '\\$')
      .replace(/`/g, '\\`');
  }

  static sanitizeShellCommand(command: string): void {
    if (!command || typeof command !== 'string') {
      throw new ValidationError('Command must be a non-empty string');
    }

    const dangerousPatterns = [
      /;\s*rm\s+-rf/i,
      /;\s*dd\s+if=/i,
      /;\s*mkfs/i,
      />\s*\/dev\/sd[a-z]/i,
      /;\s*:?\(\)\s*\{/,
      /\$\(.*rm\s+-rf/i,
      /`.*rm\s+-rf/i,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(command)) {
        throw new ValidationError(
          'Command contains potentially dangerous patterns and has been blocked'
        );
      }
    }

    const commandInjectionPatterns = [
      /;\s*\w+/,
      /\|\s*\w+/,
      /&&\s*\w+/,
      /\|\|\s*\w+/,
    ];

    const allowedCommands = ['git', 'npm', 'node', 'echo', 'cat', 'ls', 'pwd', 'test'];
    const commandStart = command.trim().split(/\s+/)[0];

    if (!allowedCommands.includes(commandStart)) {
      throw new ValidationError(
        `Command '${commandStart}' is not in the allowed list. Allowed commands: ${allowedCommands.join(', ')}`
      );
    }
  }

  static redactSensitiveData(data: any): any {
    if (typeof data === 'string') {
      return this.redactSensitiveString(data);
    }

    if (Array.isArray(data)) {
      return data.map(item => this.redactSensitiveData(item));
    }

    if (typeof data === 'object' && data !== null) {
      const redacted: any = {};
      for (const [key, value] of Object.entries(data)) {
        if (this.isSensitiveKey(key)) {
          redacted[key] = '[REDACTED]';
        } else {
          redacted[key] = this.redactSensitiveData(value);
        }
      }
      return redacted;
    }

    return data;
  }

  private static isSensitiveKey(key: string): boolean {
    const lowerKey = key.toLowerCase();
    return SENSITIVE_KEYS.some(sensitive => lowerKey.includes(sensitive));
  }

  private static redactSensitiveString(str: string): string {
    let redacted = str;

    const tokenPattern = /([a-zA-Z0-9_-]{20,})/g;
    redacted = redacted.replace(tokenPattern, (match) => {
      if (match.length >= 32) {
        return '[REDACTED_TOKEN]';
      }
      return match;
    });

    const base64Pattern = /([A-Za-z0-9+\/]{40,}={0,2})/g;
    redacted = redacted.replace(base64Pattern, '[REDACTED_BASE64]');

    const jwtPattern = /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
    redacted = redacted.replace(jwtPattern, '[REDACTED_JWT]');

    return redacted;
  }

  static validateRemoteName(remote: string): string {
    if (!remote || typeof remote !== 'string') {
      throw new GitOperationError('Remote name must be a non-empty string');
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(remote)) {
      throw new GitOperationError(
        `Invalid remote name: ${remote}. Only alphanumeric, '_', and '-' are allowed`
      );
    }

    if (remote.length > 255) {
      throw new GitOperationError('Remote name exceeds maximum length of 255 characters');
    }

    return remote;
  }

  static escapeShellArg(arg: string): string {
    if (!arg || typeof arg !== 'string') {
      return '""';
    }

    return `"${arg.replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/`/g, '\\`')}"`;
  }
}

export class RateLimiter {
  private operations: Map<string, number[]> = new Map();
  private maxOperations: number;
  private timeWindowMs: number;

  constructor(maxOperations: number, timeWindowSeconds: number) {
    this.maxOperations = maxOperations;
    this.timeWindowMs = timeWindowSeconds * 1000;
  }

  checkLimit(operationKey: string): boolean {
    const now = Date.now();
    const timestamps = this.operations.get(operationKey) || [];

    const recentTimestamps = timestamps.filter(
      ts => now - ts < this.timeWindowMs
    );

    if (recentTimestamps.length >= this.maxOperations) {
      return false;
    }

    recentTimestamps.push(now);
    this.operations.set(operationKey, recentTimestamps);

    return true;
  }

  getRemainingAttempts(operationKey: string): number {
    const now = Date.now();
    const timestamps = this.operations.get(operationKey) || [];
    
    const recentTimestamps = timestamps.filter(
      ts => now - ts < this.timeWindowMs
    );

    return Math.max(0, this.maxOperations - recentTimestamps.length);
  }

  getTimeUntilReset(operationKey: string): number {
    const timestamps = this.operations.get(operationKey) || [];
    if (timestamps.length === 0) {
      return 0;
    }

    const oldestTimestamp = Math.min(...timestamps);
    const resetTime = oldestTimestamp + this.timeWindowMs;
    const now = Date.now();

    return Math.max(0, resetTime - now);
  }

  reset(operationKey?: string): void {
    if (operationKey) {
      this.operations.delete(operationKey);
    } else {
      this.operations.clear();
    }
  }
}

export const globalRateLimiters = {
  push: new RateLimiter(1, 60),
  sync: new RateLimiter(10, 60),
};
