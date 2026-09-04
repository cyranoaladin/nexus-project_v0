import {
  classifyAuditResult,
  runAuditWithRetry,
  isTransportError,
} from '../../scripts/security/run-npm-audit.mjs';

describe('Dependency Audit Runner & Bounded Retry Wrapper', () => {
  const silentLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  const instantSleep = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('audit clean -> PASS', async () => {
    const cleanStdout = JSON.stringify({
      auditReportVersion: 2,
      vulnerabilities: {},
      metadata: {
        vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 },
      },
    });

    const runner = jest.fn().mockReturnValue({
      status: 0,
      stdout: cleanStdout,
      stderr: '',
    });

    const result = await runAuditWithRetry({
      runner: runner as any,
      logger: silentLogger as any,
      sleepFn: instantSleep,
    });

    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.attempts).toBe(1);
    expect(result.classification?.type).toBe('CLEAN');
    expect(runner).toHaveBeenCalledTimes(1);
  });

  test('high vulnerability report -> FAIL immediately (0 retries)', async () => {
    const vulnStdout = JSON.stringify({
      auditReportVersion: 2,
      vulnerabilities: {
        tar: { severity: 'high', name: 'tar' },
      },
      metadata: {
        vulnerabilities: { info: 0, low: 0, moderate: 0, high: 1, critical: 0, total: 1 },
      },
    });

    const runner = jest.fn().mockReturnValue({
      status: 1,
      stdout: vulnStdout,
      stderr: '',
    });

    const result = await runAuditWithRetry({
      runner: runner as any,
      logger: silentLogger as any,
      sleepFn: instantSleep,
      maxAttempts: 3,
    });

    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(1);
    expect(result.attempts).toBe(1); // Crucial: must NEVER retry on vulnerability!
    expect(result.classification?.type).toBe('VULNERABILITY');
    expect(runner).toHaveBeenCalledTimes(1);

    const DEPENDENCY_VULNERABILITY_CAN_NEVER_BE_RETRIED_INTO_PASS =
      result.attempts === 1 && result.exitCode === 1 ? 'YES' : 'NO';
    expect(DEPENDENCY_VULNERABILITY_CAN_NEVER_BE_RETRIED_INTO_PASS).toBe('YES');
  });

  test('registry 503 once then success -> retry then PASS', async () => {
    const cleanStdout = JSON.stringify({
      auditReportVersion: 2,
      metadata: { vulnerabilities: { high: 0, critical: 0 } },
    });

    const runner = jest
      .fn()
      .mockReturnValueOnce({
        status: 1,
        stdout: '',
        stderr: 'npm ERR! code E503\nnpm ERR! 503 Service Unavailable - POST https://registry.npmjs.org/-/npm/v1/security/audits',
      })
      .mockReturnValueOnce({
        status: 0,
        stdout: cleanStdout,
        stderr: '',
      });

    const result = await runAuditWithRetry({
      runner: runner as any,
      logger: silentLogger as any,
      sleepFn: instantSleep,
      maxAttempts: 3,
    });

    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.attempts).toBe(2);
    expect(runner).toHaveBeenCalledTimes(2);
    expect(instantSleep).toHaveBeenCalledTimes(1);
  });

  test('registry 503 all attempts -> FAIL closed (DEPENDENCY_AUDIT_FAILS_CLOSED=YES)', async () => {
    const runner = jest.fn().mockReturnValue({
      status: 1,
      stdout: '',
      stderr: 'npm ERR! code E503\nnpm ERR! 503 Service Unavailable',
    });

    const result = await runAuditWithRetry({
      runner: runner as any,
      logger: silentLogger as any,
      sleepFn: instantSleep,
      maxAttempts: 3,
    });

    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(1);
    expect(result.attempts).toBe(3);
    expect(runner).toHaveBeenCalledTimes(3);

    const DEPENDENCY_AUDIT_FAILS_CLOSED = result.exitCode === 1 ? 'YES' : 'NO';
    expect(DEPENDENCY_AUDIT_FAILS_CLOSED).toBe('YES');

    const DEPENDENCY_AUDIT_NETWORK_RETRY_BOUNDED = result.attempts === 3 ? 'YES' : 'NO';
    expect(DEPENDENCY_AUDIT_NETWORK_RETRY_BOUNDED).toBe('YES');
  });

  test('timeout once then success -> retry then PASS', async () => {
    const cleanStdout = JSON.stringify({
      auditReportVersion: 2,
      metadata: { vulnerabilities: { high: 0 } },
    });

    const runner = jest
      .fn()
      .mockReturnValueOnce({
        status: 1,
        stdout: '',
        stderr: 'npm ERR! code ETIMEDOUT\nnpm ERR! network request to https://registry.npmjs.org/-/npm/v1/security/audits timed out',
      })
      .mockReturnValueOnce({
        status: 0,
        stdout: cleanStdout,
        stderr: '',
      });

    const result = await runAuditWithRetry({
      runner: runner as any,
      logger: silentLogger as any,
      sleepFn: instantSleep,
      maxAttempts: 3,
    });

    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.attempts).toBe(2);
    expect(runner).toHaveBeenCalledTimes(2);
  });

  test('malformed/non-JSON response -> FAIL unless positively classified transport retry', async () => {
    const runner = jest.fn().mockReturnValue({
      status: 1,
      stdout: '<html><body>Something completely unexpected</body></html>',
      stderr: 'Generic failure',
    });

    const result = await runAuditWithRetry({
      runner: runner as any,
      logger: silentLogger as any,
      sleepFn: instantSleep,
      maxAttempts: 3,
    });

    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(1);
    expect(result.classification?.type).toBe('FATAL_ERROR');
    // Non-transport malformed errors must not be retried infinitely
    expect(result.attempts).toBe(1);
  });

  test('unexpected npm error -> FAIL', async () => {
    const runner = jest.fn().mockReturnValue({
      status: 2,
      stdout: '',
      stderr: 'npm ERR! invalid command option',
    });

    const result = await runAuditWithRetry({
      runner: runner as any,
      logger: silentLogger as any,
      sleepFn: instantSleep,
      maxAttempts: 3,
    });

    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(1);
    expect(result.classification?.type).toBe('FATAL_ERROR');
    expect(result.attempts).toBe(1);
  });

  test('critical vulnerability report -> FAIL immediately (0 retries)', async () => {
    const vulnStdout = JSON.stringify({
      auditReportVersion: 2,
      vulnerabilities: {
        tar: { severity: 'critical', name: 'tar' },
      },
      metadata: {
        vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 1, total: 1 },
      },
    });

    const runner = jest.fn().mockReturnValue({
      status: 1,
      stdout: vulnStdout,
      stderr: '',
    });

    const result = await runAuditWithRetry({
      runner: runner as any,
      logger: silentLogger as any,
      sleepFn: instantSleep,
      maxAttempts: 3,
    });

    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(1);
    expect(result.attempts).toBe(1);
    expect(result.classification?.type).toBe('VULNERABILITY');
  });

  test('registry 429 once then success -> retry then PASS', async () => {
    const cleanStdout = JSON.stringify({
      auditReportVersion: 2,
      metadata: { vulnerabilities: { high: 0 } },
    });

    const runner = jest
      .fn()
      .mockReturnValueOnce({
        status: 1,
        stdout: '',
        stderr: 'npm ERR! code E429\nnpm ERR! 429 Too Many Requests',
      })
      .mockReturnValueOnce({
        status: 0,
        stdout: cleanStdout,
        stderr: '',
      });

    const result = await runAuditWithRetry({
      runner: runner as any,
      logger: silentLogger as any,
      sleepFn: instantSleep,
      maxAttempts: 3,
    });

    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.attempts).toBe(2);
    expect(runner).toHaveBeenCalledTimes(2);
  });

  test('empty stdout with exit 0 -> FAIL closed (AUDIT_EVIDENCE_REQUIRED=YES)', async () => {
    const runner = jest.fn().mockReturnValue({
      status: 0,
      stdout: '',
      stderr: '',
    });

    const result = await runAuditWithRetry({
      runner: runner as any,
      logger: silentLogger as any,
      sleepFn: instantSleep,
    });

    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(1);
    expect(result.classification?.type).toBe('FATAL_ERROR');
    expect(result.classification?.message).toContain('Empty audit output');
  });

  test('plain-text stdout with exit 0 -> FAIL closed (UNKNOWN_AUDIT_OUTPUT_FAILS_CLOSED=YES)', async () => {
    const runner = jest.fn().mockReturnValue({
      status: 0,
      stdout: 'found 0 vulnerabilities',
      stderr: '',
    });

    const result = await runAuditWithRetry({
      runner: runner as any,
      logger: silentLogger as any,
      sleepFn: instantSleep,
    });

    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(1);
    expect(result.classification?.type).toBe('FATAL_ERROR');
  });

  test('moderate vulnerability report -> FAIL when auditLevel=moderate, PASS when auditLevel=high', async () => {
    const modStdout = JSON.stringify({
      auditReportVersion: 2,
      metadata: {
        vulnerabilities: { info: 0, low: 0, moderate: 1, high: 0, critical: 0, total: 1 },
      },
    });

    // When auditLevel is high (default), moderate vulnerability does not trigger threshold failure
    const runnerHigh = jest.fn().mockReturnValue({
      status: 0,
      stdout: modStdout,
      stderr: '',
    });
    const resultHigh = await runAuditWithRetry({
      runner: runnerHigh as any,
      logger: silentLogger as any,
      sleepFn: instantSleep,
      auditLevel: 'high',
    });
    expect(resultHigh.success).toBe(true);
    expect(resultHigh.classification?.type).toBe('CLEAN');

    // When auditLevel is moderate, moderate vulnerability triggers threshold failure immediately
    const runnerMod = jest.fn().mockReturnValue({
      status: 1,
      stdout: modStdout,
      stderr: '',
    });
    const resultMod = await runAuditWithRetry({
      runner: runnerMod as any,
      logger: silentLogger as any,
      sleepFn: instantSleep,
      auditLevel: 'moderate',
    });
    expect(resultMod.success).toBe(false);
    expect(resultMod.exitCode).toBe(1);
    expect(resultMod.attempts).toBe(1);
    expect(resultMod.classification?.type).toBe('VULNERABILITY');
  });

  test('isTransportError correctly identifies 5xx, 429, ETIMEDOUT, ECONNRESET', () => {
    expect(isTransportError('503 Service Unavailable')).toBe(true);
    expect(isTransportError('502 Bad Gateway')).toBe(true);
    expect(isTransportError('504 Gateway Timeout')).toBe(true);
    expect(isTransportError('429 Too Many Requests')).toBe(true);
    expect(isTransportError('fetch failed with ETIMEDOUT')).toBe(true);
    expect(isTransportError('npm ERR! code ECONNRESET')).toBe(true);
    expect(isTransportError('Valid audit output without network issue')).toBe(false);
  });
});
