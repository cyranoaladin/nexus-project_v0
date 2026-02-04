import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  SecurityValidator,
  RateLimiter,
  FilePermissionValidator,
} from './security';
import { GitOperationError, ValidationError } from './errors';

describe('SecurityValidator', () => {
  describe('validateBranchName', () => {
    it('should accept valid branch names', () => {
      expect(() => SecurityValidator.validateBranchName('main')).not.toThrow();
      expect(() => SecurityValidator.validateBranchName('feature/new-feature')).not.toThrow();
      expect(() => SecurityValidator.validateBranchName('hotfix-123')).not.toThrow();
      expect(() => SecurityValidator.validateBranchName('release_v1.0')).not.toThrow();
    });

    it('should reject invalid branch names', () => {
      expect(() => SecurityValidator.validateBranchName('branch with spaces')).toThrow(GitOperationError);
      expect(() => SecurityValidator.validateBranchName('branch;rm -rf')).toThrow(GitOperationError);
      expect(() => SecurityValidator.validateBranchName('branch$malicious')).toThrow(GitOperationError);
      expect(() => SecurityValidator.validateBranchName('branch|cmd')).toThrow(GitOperationError);
    });

    it('should reject empty or invalid types', () => {
      expect(() => SecurityValidator.validateBranchName('')).toThrow(GitOperationError);
      expect(() => SecurityValidator.validateBranchName(null as any)).toThrow(GitOperationError);
    });

    it('should reject overly long branch names', () => {
      const longName = 'a'.repeat(300);
      expect(() => SecurityValidator.validateBranchName(longName)).toThrow(GitOperationError);
    });
  });

  describe('validateFilePath', () => {
    it('should accept valid file paths', () => {
      expect(() => SecurityValidator.validateFilePath('src/file.ts')).not.toThrow();
      expect(() => SecurityValidator.validateFilePath('path/to/file.txt')).not.toThrow();
    });

    it('should reject path traversal attempts', () => {
      expect(() => SecurityValidator.validateFilePath('../etc/passwd')).toThrow(ValidationError);
      expect(() => SecurityValidator.validateFilePath('../../malicious')).toThrow(ValidationError);
      expect(() => SecurityValidator.validateFilePath('path/../../../etc/shadow')).toThrow(ValidationError);
    });

    it('should reject overly long paths', () => {
      const longPath = 'a/'.repeat(2100);
      expect(() => SecurityValidator.validateFilePath(longPath)).toThrow(ValidationError);
    });

    it('should validate against base directory', () => {
      const baseDir = '/home/user/project';
      expect(() => SecurityValidator.validateFilePath('/home/user/project/file.txt', baseDir)).not.toThrow();
      expect(() => SecurityValidator.validateFilePath('/home/user/other/file.txt', baseDir)).toThrow(ValidationError);
    });
  });

  describe('validateStashId', () => {
    it('should accept valid stash IDs', () => {
      expect(() => SecurityValidator.validateStashId('stash@{0}')).not.toThrow();
      expect(() => SecurityValidator.validateStashId('stash@{5}')).not.toThrow();
      expect(() => SecurityValidator.validateStashId('stash@{123}')).not.toThrow();
    });

    it('should reject invalid stash IDs', () => {
      expect(() => SecurityValidator.validateStashId('stash')).toThrow(GitOperationError);
      expect(() => SecurityValidator.validateStashId('stash@0')).toThrow(GitOperationError);
      expect(() => SecurityValidator.validateStashId('invalid')).toThrow(GitOperationError);
      expect(() => SecurityValidator.validateStashId('stash@{abc}')).toThrow(GitOperationError);
    });
  });

  describe('sanitizeCommitMessage', () => {
    it('should escape special characters', () => {
      const result = SecurityValidator.sanitizeCommitMessage('Message with "quotes"');
      expect(result).toContain('\\"');
    });

    it('should escape newlines', () => {
      const result = SecurityValidator.sanitizeCommitMessage('Line 1\nLine 2');
      expect(result).toContain('\\n');
    });

    it('should escape shell metacharacters', () => {
      const result = SecurityValidator.sanitizeCommitMessage('Message with $var and `cmd`');
      expect(result).toContain('\\$');
      expect(result).toContain('\\`');
    });

    it('should reject overly long messages', () => {
      const longMessage = 'a'.repeat(11000);
      expect(() => SecurityValidator.sanitizeCommitMessage(longMessage)).toThrow(GitOperationError);
    });
  });

  describe('sanitizeShellCommand', () => {
    it('should allow safe commands', () => {
      expect(() => SecurityValidator.sanitizeShellCommand('git status')).not.toThrow();
      expect(() => SecurityValidator.sanitizeShellCommand('npm install')).not.toThrow();
      expect(() => SecurityValidator.sanitizeShellCommand('echo hello')).not.toThrow();
    });

    it('should reject dangerous commands', () => {
      expect(() => SecurityValidator.sanitizeShellCommand('rm -rf /')).toThrow(ValidationError);
      expect(() => SecurityValidator.sanitizeShellCommand('dd if=/dev/zero')).toThrow(ValidationError);
      expect(() => SecurityValidator.sanitizeShellCommand('mkfs.ext4')).toThrow(ValidationError);
    });

    it('should reject command injection attempts', () => {
      expect(() => SecurityValidator.sanitizeShellCommand('python main.py')).toThrow(ValidationError);
      expect(() => SecurityValidator.sanitizeShellCommand('./malicious.sh')).toThrow(ValidationError);
    });
  });

  describe('redactSensitiveData', () => {
    it('should redact sensitive keys in objects', () => {
      const data = {
        username: 'john',
        password: 'secret123',
        api_key: 'abc123xyz',
      };
      const redacted = SecurityValidator.redactSensitiveData(data);
      expect(redacted.username).toBe('john');
      expect(redacted.password).toBe('[REDACTED]');
      expect(redacted.api_key).toBe('[REDACTED]');
    });

    it('should redact JWT tokens in strings', () => {
      const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      const redacted = SecurityValidator.redactSensitiveData(jwt);
      expect(redacted).toBe('[REDACTED_JWT]');
    });

    it('should redact long tokens', () => {
      const token = 'ghp_1234567890abcdefghijklmnopqrstuvwxyz123456';
      const redacted = SecurityValidator.redactSensitiveData(token);
      expect(redacted).toBe('[REDACTED_TOKEN]');
    });

    it('should handle nested objects', () => {
      const data = {
        user: {
          name: 'john',
          credentials: {
            password: 'secret',
            token: 'abc123',
          },
        },
      };
      const redacted = SecurityValidator.redactSensitiveData(data);
      expect(redacted.user.name).toBe('john');
      expect(redacted.user.credentials.password).toBe('[REDACTED]');
      expect(redacted.user.credentials.token).toBe('[REDACTED]');
    });

    it('should handle arrays', () => {
      const data = [
        { name: 'item1', secret: 'value1' },
        { name: 'item2', secret: 'value2' },
      ];
      const redacted = SecurityValidator.redactSensitiveData(data);
      expect(redacted[0].name).toBe('item1');
      expect(redacted[0].secret).toBe('[REDACTED]');
      expect(redacted[1].secret).toBe('[REDACTED]');
    });
  });

  describe('validateRemoteName', () => {
    it('should accept valid remote names', () => {
      expect(() => SecurityValidator.validateRemoteName('origin')).not.toThrow();
      expect(() => SecurityValidator.validateRemoteName('upstream')).not.toThrow();
      expect(() => SecurityValidator.validateRemoteName('my-remote')).not.toThrow();
    });

    it('should reject invalid remote names', () => {
      expect(() => SecurityValidator.validateRemoteName('remote with spaces')).toThrow(GitOperationError);
      expect(() => SecurityValidator.validateRemoteName('remote/path')).toThrow(GitOperationError);
      expect(() => SecurityValidator.validateRemoteName('')).toThrow(GitOperationError);
    });
  });

  describe('escapeShellArg', () => {
    it('should escape shell arguments', () => {
      const result = SecurityValidator.escapeShellArg('file name.txt');
      expect(result).toBe('"file name.txt"');
    });

    it('should escape quotes in arguments', () => {
      const result = SecurityValidator.escapeShellArg('file "quoted".txt');
      expect(result).toContain('\\"');
    });

    it('should handle empty strings', () => {
      const result = SecurityValidator.escapeShellArg('');
      expect(result).toBe('""');
    });
  });
});

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    rateLimiter = new RateLimiter(3, 1);
  });

  it('should allow operations within limit', () => {
    expect(rateLimiter.checkLimit('test')).toBe(true);
    expect(rateLimiter.checkLimit('test')).toBe(true);
    expect(rateLimiter.checkLimit('test')).toBe(true);
  });

  it('should block operations exceeding limit', () => {
    rateLimiter.checkLimit('test');
    rateLimiter.checkLimit('test');
    rateLimiter.checkLimit('test');
    expect(rateLimiter.checkLimit('test')).toBe(false);
  });

  it('should track different operations separately', () => {
    rateLimiter.checkLimit('op1');
    rateLimiter.checkLimit('op1');
    rateLimiter.checkLimit('op1');
    
    expect(rateLimiter.checkLimit('op2')).toBe(true);
  });

  it('should reset after time window', async () => {
    rateLimiter.checkLimit('test');
    rateLimiter.checkLimit('test');
    rateLimiter.checkLimit('test');
    expect(rateLimiter.checkLimit('test')).toBe(false);

    await new Promise(resolve => setTimeout(resolve, 1100));
    
    expect(rateLimiter.checkLimit('test')).toBe(true);
  });

  it('should return remaining attempts correctly', () => {
    expect(rateLimiter.getRemainingAttempts('test')).toBe(3);
    rateLimiter.checkLimit('test');
    expect(rateLimiter.getRemainingAttempts('test')).toBe(2);
    rateLimiter.checkLimit('test');
    expect(rateLimiter.getRemainingAttempts('test')).toBe(1);
  });

  it('should reset specific operation', () => {
    rateLimiter.checkLimit('test');
    rateLimiter.checkLimit('test');
    rateLimiter.reset('test');
    
    expect(rateLimiter.getRemainingAttempts('test')).toBe(3);
  });

  it('should reset all operations', () => {
    rateLimiter.checkLimit('op1');
    rateLimiter.checkLimit('op2');
    rateLimiter.reset();
    
    expect(rateLimiter.getRemainingAttempts('op1')).toBe(3);
    expect(rateLimiter.getRemainingAttempts('op2')).toBe(3);
  });
});

describe('FilePermissionValidator', () => {
  describe('checkReadPermission', () => {
    it('should return true for readable files', async () => {
      const result = await FilePermissionValidator.checkReadPermission(__filename);
      expect(result).toBe(true);
    });

    it('should return false for non-existent files', async () => {
      const result = await FilePermissionValidator.checkReadPermission('/nonexistent/file.txt');
      expect(result).toBe(false);
    });
  });

  describe('ensureDirectoryWritable', () => {
    it('should not throw for writable directories', async () => {
      await expect(FilePermissionValidator.ensureDirectoryWritable('/tmp')).resolves.not.toThrow();
    });

    it('should throw for non-writable directories', async () => {
      await expect(FilePermissionValidator.ensureDirectoryWritable('/root')).rejects.toThrow(ValidationError);
    });
  });
});
