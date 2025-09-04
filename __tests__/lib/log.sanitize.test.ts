import { sanitizeLog, safeStringify } from '@/lib/log/sanitize';

describe('lib/log/sanitize', () => {
  test('sanitizes known secret patterns', () => {
    const input = 'key sk-abcXYZ hf_token hf_12345 postgres://user:pass@host/db redis://redis:pass@localhost:6379 https://user:pwd@domain.com/path';
    const out = sanitizeLog(input);
    expect(out).not.toContain('sk-');
    expect(out).not.toContain('hf_');
    expect(out).not.toContain('postgres://');
    expect(out).not.toContain('redis://');
    expect(out).not.toContain('user:pwd@');
    expect(out).toContain('[REDACTED]');
  });

  test('safeStringify handles circular references gracefully', () => {
    const a: any = { foo: 'bar' };
    a.self = a; // circular
    const s = safeStringify(a);
    // Should not throw and should be a string
    expect(typeof s).toBe('string');
  });

  test('sanitizeLog accepts non-string inputs', () => {
    const obj = { token: 'sk-123' };
    const out = sanitizeLog(obj);
    expect(out).toContain('[REDACTED]');
  });
});
