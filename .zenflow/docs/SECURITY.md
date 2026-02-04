# Security Hardening Documentation

## Overview

This document describes the security measures implemented in the Zenflow system to protect against common vulnerabilities and attacks.

## Security Features

### 1. Input Validation and Sanitization

#### Branch Name Validation
- Only allows alphanumeric characters, `/`, `_`, and `-`
- Maximum length: 255 characters
- Rejects special characters that could be used for command injection

#### File Path Validation
- Prevents path traversal attacks (`../` patterns)
- Validates paths against base directory boundaries
- Maximum path length: 4096 characters
- All paths are normalized before use

#### Commit Message Sanitization
- Escapes shell metacharacters: `"`, `$`, `` ` ``, newlines
- Maximum message length: 10,000 characters
- Prevents command injection through commit messages

#### Shell Command Validation
- Whitelist of allowed commands: `git`, `npm`, `node`, `echo`, `cat`, `ls`, `pwd`, `test`
- Blocks dangerous patterns:
  - `rm -rf`
  - `dd if=`
  - `mkfs`
  - Writing to `/dev/sd*`
  - Fork bombs
- Prevents command chaining with `;`, `&&`, `||`, `|`

### 2. Rate Limiting

#### Push Operations
- Maximum: 1 push per minute per branch
- Prevents abuse and excessive API calls to remote
- Configurable through `RateLimiter` class

#### Sync Operations
- Maximum: 10 sync operations per minute
- Prevents system overload

### 3. Sensitive Data Protection

#### Automatic Redaction
The logger automatically redacts sensitive information:
- Password fields
- API keys and tokens
- Secret keys
- OAuth tokens
- JWT tokens
- Long Base64 strings (>40 chars)
- Private keys

#### Sensitive Keywords
The following patterns in object keys trigger redaction:
- `password`
- `token`
- `secret`
- `api_key` / `apikey`
- `auth`
- `credential`
- `private_key` / `privatekey`
- `access_token` / `accesstoken`

### 4. File Permission Checks

#### Directory Operations
- Validates write permissions before creating files
- Checks directory existence and accessibility
- Clear error messages when permissions are insufficient

#### File Operations
- Validates read permissions before accessing files
- Checks execute permissions for scripts
- Prevents operations on inaccessible resources

### 5. Error Handling

#### Enhanced Error Types
All custom errors include:
- Error code for programmatic handling
- Timestamp for tracking
- Structured metadata (command, exit code, etc.)
- JSON serialization support

#### Error Types
- `ZenflowError`: Base error with code and timestamp
- `GitOperationError`: Git command failures with command details
- `ConflictDetectedError`: Merge conflicts with file list and resolution suggestions
- `ValidationError`: Input validation failures with field information
- `SecurityError`: Security violations with violation type
- `RateLimitError`: Rate limit exceeded with retry information
- `LockError`: Lock acquisition failures with lock path
- `TimeoutError`: Operation timeouts with duration

### 6. Secure Defaults

#### Git Operations
- All Git commands use parameterized execution
- No string concatenation for command building
- Branch names and paths are validated before use
- Timeouts on push operations (60 seconds)

#### Workflow Execution
- Shell commands are validated before execution
- JavaScript execution uses Function constructor (isolated scope)
- Timeouts on all step executions
- Environment variables are not passed unsanitized

## Security Utilities

### SecurityValidator Class

```typescript
// Validate branch names
SecurityValidator.validateBranchName('feature/my-branch');

// Validate file paths
SecurityValidator.validateFilePath('src/file.ts', baseDir);

// Sanitize commit messages
const safe = SecurityValidator.sanitizeCommitMessage(userInput);

// Validate stash IDs
SecurityValidator.validateStashId('stash@{0}');

// Validate remote names
SecurityValidator.validateRemoteName('origin');

// Escape shell arguments
const escaped = SecurityValidator.escapeShellArg(filename);

// Redact sensitive data from logs
const redacted = SecurityValidator.redactSensitiveData(data);

// Validate shell commands
SecurityValidator.sanitizeShellCommand('git status');
```

### RateLimiter Class

```typescript
// Create rate limiter: 3 ops per 60 seconds
const limiter = new RateLimiter(3, 60);

// Check if operation is allowed
if (limiter.checkLimit('my-operation')) {
  // Perform operation
}

// Get remaining attempts
const remaining = limiter.getRemainingAttempts('my-operation');

// Get time until reset
const resetTime = limiter.getTimeUntilReset('my-operation');

// Reset specific operation
limiter.reset('my-operation');

// Reset all operations
limiter.reset();
```

### FilePermissionValidator Class

```typescript
// Check permissions
const canRead = await FilePermissionValidator.checkReadPermission(path);
const canWrite = await FilePermissionValidator.checkWritePermission(path);
const canExecute = await FilePermissionValidator.checkExecutePermission(path);

// Ensure permissions (throws on failure)
await FilePermissionValidator.ensureDirectoryWritable(dirPath);
await FilePermissionValidator.ensureFileReadable(filePath);
```

## Known Vulnerabilities

### Dependencies

**Next.js v15.0.0-canary.0 - 15.6.0-canary.60**
- Severity: Moderate
- Issue: Unbounded Memory Consumption via PPR Resume Endpoint
- CVE: GHSA-5f7q-jpqc-wp7h
- Status: Deferred (requires breaking change to v16+)
- Mitigation: Not directly exploitable in Zenflow context as PPR features are not used

## Security Best Practices

### For Developers

1. **Always validate user input** before using in commands or file operations
2. **Use SecurityValidator** utilities for all external inputs
3. **Never log sensitive data** directly - use structured logging with automatic redaction
4. **Check rate limits** before expensive operations (network calls, file I/O)
5. **Handle errors gracefully** with detailed but safe error messages
6. **Use parameterized commands** instead of string concatenation
7. **Validate file paths** against base directory before operations
8. **Set timeouts** on all external operations (Git, network, etc.)

### For Operators

1. **Run `npm audit`** regularly to check for dependency vulnerabilities
2. **Update dependencies** quarterly or when critical vulnerabilities are found
3. **Monitor logs** for suspicious patterns or repeated failures
4. **Review rate limit** settings based on usage patterns
5. **Set proper file permissions** on .zenflow directory (750 recommended)
6. **Rotate logs regularly** to prevent disk space issues
7. **Backup state directory** before major operations

## Testing

Security features are tested in:
- `.zenflow/core/utils/security.test.ts`: Unit tests for all security utilities
- Integration tests validate sanitization in real workflows
- Rate limiting behavior is tested with timing assertions

Run security tests:
```bash
npm test -- security.test.ts
```

## Incident Response

If a security issue is discovered:

1. **Document** the issue with details and reproduction steps
2. **Assess impact** - what data/systems are affected?
3. **Implement fix** following the security guidelines above
4. **Test thoroughly** including edge cases
5. **Update this document** with lessons learned
6. **Review similar code** for the same vulnerability pattern

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CWE: Common Weakness Enumeration](https://cwe.mitre.org/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Git Security](https://git-scm.com/docs/git-security)

## Changelog

### 2026-02-04
- Initial security hardening implementation
- Added input validation and sanitization
- Implemented rate limiting
- Added sensitive data redaction
- Enhanced error handling with detailed types
- Added file permission checks
- Documented security features and best practices
