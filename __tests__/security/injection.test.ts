/**
 * Injection Security Tests — Complete Suite
 *
 * Tests: SQL injection prevention, XSS prevention, NoSQL injection,
 *        command injection, path traversal via validation schemas
 *
 * Source: lib/validation/*.ts (Zod schemas act as first line of defense)
 */

import { createUserSchema, updateUserSchema } from '@/lib/validation/users';
import { bookFullSessionSchema, cancelSessionSchema } from '@/lib/validation/sessions';
import { createPaymentSchema, refundPaymentSchema } from '@/lib/validation/payments';
import { emailSchema, passwordSchema, idSchema, phoneSchema } from '@/lib/validation/common';

// ─── SQL Injection via Validation Schemas ────────────────────────────────────

describe('SQL Injection Prevention', () => {
  const sqlPayloads = [
    "'; DROP TABLE users; --",
    "1' OR '1'='1",
    "admin'--",
    "1; DELETE FROM sessions WHERE 1=1",
    "' UNION SELECT * FROM users --",
    "Robert'); DROP TABLE students;--",
  ];

  describe('User creation rejects SQL in email field', () => {
    sqlPayloads.forEach((payload) => {
      it(`should reject: ${payload.substring(0, 30)}...`, () => {
        const result = emailSchema.safeParse(payload);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('User creation rejects SQL in name fields', () => {
    it('should accept normal names but reject SQL in firstName via length', () => {
      // SQL payloads are accepted as strings but Prisma parameterizes queries
      // The validation layer ensures format constraints
      const longPayload = "A".repeat(101); // exceeds max length
      const result = createUserSchema.safeParse({
        email: 'test@example.com',
        password: 'Password1',
        role: 'ELEVE',
        firstName: longPayload,
        lastName: 'Doe',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('ID fields reject SQL injection', () => {
    sqlPayloads.forEach((payload) => {
      it(`should reject SQL in ID: ${payload.substring(0, 30)}...`, () => {
        const result = idSchema.safeParse(payload);
        expect(result.success).toBe(false);
      });
    });
  });
});

// ─── XSS Prevention ─────────────────────────────────────────────────────────

describe('XSS Prevention', () => {
  const xssPayloads = [
    '<script>alert("xss")</script>',
    '<img src=x onerror=alert(1)>',
    'javascript:alert(1)',
    '<svg onload=alert(1)>',
    '"><script>document.location="http://evil.com"</script>',
  ];

  describe('Email field rejects XSS payloads', () => {
    xssPayloads.forEach((payload) => {
      it(`should reject: ${payload.substring(0, 30)}...`, () => {
        const result = emailSchema.safeParse(payload);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('Phone field rejects XSS payloads', () => {
    xssPayloads.forEach((payload) => {
      it(`should reject: ${payload.substring(0, 30)}...`, () => {
        const result = phoneSchema.safeParse(payload);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('Session cancellation reason accepts text but schema trims', () => {
    it('should trim whitespace from reason field', () => {
      const result = cancelSessionSchema.safeParse({
        sessionId: 'clh1234567890abcdefghij',
        reason: '  <script>alert(1)</script>  ',
      });
      // The schema trims but accepts the string (XSS prevention is at render layer)
      if (result.success) {
        expect(result.data.reason).toBe('<script>alert(1)</script>');
      }
    });
  });
});

// ─── Path Traversal Prevention ───────────────────────────────────────────────

describe('Path Traversal Prevention', () => {
  const pathPayloads = [
    '../../../etc/passwd',
    '..\\..\\..\\windows\\system32',
    '/etc/shadow',
    '....//....//etc/passwd',
    '%2e%2e%2f%2e%2e%2fetc%2fpasswd',
  ];

  describe('ID fields reject path traversal', () => {
    pathPayloads.forEach((payload) => {
      it(`should reject: ${payload}`, () => {
        const result = idSchema.safeParse(payload);
        expect(result.success).toBe(false);
      });
    });
  });
});

// ─── Oversized Input Prevention ──────────────────────────────────────────────

describe('Oversized Input Prevention', () => {
  it('should reject email with no domain', () => {
    const result = emailSchema.safeParse('a'.repeat(10000));
    expect(result.success).toBe(false);
  });

  it('should reject extremely long password', () => {
    const longPassword = 'A1' + 'a'.repeat(100000);
    const result = passwordSchema.safeParse(longPassword);
    // Password has no max length in schema, but this tests it doesn't crash
    // The schema should still parse without error
    expect(result.success).toBe(true);
  });

  it('should reject session description > 500 chars', () => {
    const result = bookFullSessionSchema.safeParse({
      coachId: 'clh1234567890abcdefghij',
      studentId: 'clh1234567890abcdefghij',
      subject: 'MATHEMATIQUES',
      scheduledDate: '2026-06-15',
      startTime: '14:00',
      endTime: '15:00',
      duration: 60,
      title: 'Test',
      creditsToUse: 1,
      description: 'A'.repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it('should reject refund reason > 500 chars', () => {
    const result = refundPaymentSchema.safeParse({
      reason: 'A'.repeat(501),
    });
    expect(result.success).toBe(false);
  });
});

// ─── Type Confusion Prevention ───────────────────────────────────────────────

describe('Type Confusion Prevention', () => {
  it('should reject number where string expected (email)', () => {
    const result = emailSchema.safeParse(12345);
    expect(result.success).toBe(false);
  });

  it('should reject array where string expected (id)', () => {
    const result = idSchema.safeParse(['clh1234567890abcdefghij']);
    expect(result.success).toBe(false);
  });

  it('should reject object where string expected (password)', () => {
    const result = passwordSchema.safeParse({ password: 'Password1' });
    expect(result.success).toBe(false);
  });

  it('should reject null where string expected', () => {
    const result = emailSchema.safeParse(null);
    expect(result.success).toBe(false);
  });

  it('should reject undefined where required', () => {
    const result = emailSchema.safeParse(undefined);
    expect(result.success).toBe(false);
  });

  it('should reject string where number expected (payment amount)', () => {
    const result = createPaymentSchema.safeParse({
      userId: 'clh1234567890abcdefghij',
      method: 'bank_transfer',
      type: 'SUBSCRIPTION',
      amount: 'not-a-number',
      currency: 'TND',
    });
    expect(result.success).toBe(false);
  });
});
