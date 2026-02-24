/**
 * PII-Safe Logging — Complete Test Suite
 *
 * Tests: hashPII, safeSubmissionLog, safeDiagnosticLog
 *
 * Source: lib/diagnostics/safe-log.ts
 */

import { hashPII, safeSubmissionLog, safeDiagnosticLog } from '@/lib/diagnostics/safe-log';

// ─── hashPII ─────────────────────────────────────────────────────────────────

describe('hashPII', () => {
  it('should return an 8-character hex string', () => {
    const hash = hashPII('test@example.com');
    expect(hash).toHaveLength(8);
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });

  it('should be deterministic', () => {
    const hash1 = hashPII('test@example.com');
    const hash2 = hashPII('test@example.com');
    expect(hash1).toBe(hash2);
  });

  it('should produce different hashes for different inputs', () => {
    const hash1 = hashPII('alice@example.com');
    const hash2 = hashPII('bob@example.com');
    expect(hash1).not.toBe(hash2);
  });

  it('should handle empty string', () => {
    const hash = hashPII('');
    expect(hash).toHaveLength(8);
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });

  it('should handle unicode characters', () => {
    const hash = hashPII('مهدي@example.com');
    expect(hash).toHaveLength(8);
  });

  it('should not expose original value', () => {
    const hash = hashPII('sensitive-email@secret.com');
    expect(hash).not.toContain('sensitive');
    expect(hash).not.toContain('email');
    expect(hash).not.toContain('secret');
  });
});

// ─── safeSubmissionLog ───────────────────────────────────────────────────────

describe('safeSubmissionLog', () => {
  it('should include email_hash when identity.email present', () => {
    const log = safeSubmissionLog({
      identity: { email: 'test@example.com', firstName: 'John', lastName: 'Doe' },
    });
    expect(log).toContain('email_hash=');
    expect(log).not.toContain('test@example.com');
  });

  it('should include name_hash when firstName and lastName present', () => {
    const log = safeSubmissionLog({
      identity: { email: 'test@example.com', firstName: 'John', lastName: 'Doe' },
    });
    expect(log).toContain('name_hash=');
    expect(log).not.toContain('John');
    expect(log).not.toContain('Doe');
  });

  it('should include domain counts when competencies present', () => {
    const log = safeSubmissionLog({
      competencies: {
        algebra: [1, 2, 3],
        geometry: [4, 5],
      },
    });
    expect(log).toContain('domains=');
    expect(log).toContain('algebra:3');
    expect(log).toContain('geometry:2');
  });

  it('should include miniTest info when examPrep present', () => {
    const log = safeSubmissionLog({
      examPrep: {
        miniTest: { score: 8, completedInTime: true },
      },
    });
    expect(log).toContain('miniTest=8/ok');
  });

  it('should show timeout when miniTest not completed in time', () => {
    const log = safeSubmissionLog({
      examPrep: {
        miniTest: { score: 3, completedInTime: false },
      },
    });
    expect(log).toContain('miniTest=3/timeout');
  });

  it('should include version', () => {
    const log = safeSubmissionLog({ version: '2.0' });
    expect(log).toContain('version=2.0');
  });

  it('should default version to "unknown"', () => {
    const log = safeSubmissionLog({});
    expect(log).toContain('version=unknown');
  });

  it('should include timestamp', () => {
    const log = safeSubmissionLog({});
    expect(log).toContain('ts=');
    // Should be ISO format
    expect(log).toMatch(/ts=\d{4}-\d{2}-\d{2}T/);
  });

  it('should handle empty body', () => {
    const log = safeSubmissionLog({});
    expect(typeof log).toBe('string');
    expect(log.length).toBeGreaterThan(0);
  });

  it('should never expose raw PII', () => {
    const log = safeSubmissionLog({
      identity: {
        email: 'sensitive@secret.com',
        firstName: 'ConfidentialFirst',
        lastName: 'ConfidentialLast',
        phone: '+21612345678',
      },
    });
    expect(log).not.toContain('sensitive@secret.com');
    expect(log).not.toContain('ConfidentialFirst');
    expect(log).not.toContain('ConfidentialLast');
    expect(log).not.toContain('+21612345678');
  });
});

// ─── safeDiagnosticLog ───────────────────────────────────────────────────────

describe('safeDiagnosticLog', () => {
  it('should include event and diagnosticId', () => {
    const log = safeDiagnosticLog('SUBMIT', 'diag-123');
    expect(log).toContain('[DIAG] SUBMIT');
    expect(log).toContain('id=diag-123');
  });

  it('should include extra fields when provided', () => {
    const log = safeDiagnosticLog('SCORE', 'diag-456', {
      globalScore: 75,
      status: 'COMPLETED',
      hasLLM: true,
    });
    expect(log).toContain('globalScore=75');
    expect(log).toContain('status=COMPLETED');
    expect(log).toContain('hasLLM=true');
  });

  it('should work without extra fields', () => {
    const log = safeDiagnosticLog('START', 'diag-789');
    expect(log).toBe('[DIAG] START id=diag-789');
  });

  it('should handle empty extra object', () => {
    const log = safeDiagnosticLog('END', 'diag-000', {});
    expect(log).toBe('[DIAG] END id=diag-000');
  });

  it('should use pipe separator for multiple fields', () => {
    const log = safeDiagnosticLog('PROCESS', 'diag-111', { step: 1 });
    expect(log).toContain(' | ');
  });
});
