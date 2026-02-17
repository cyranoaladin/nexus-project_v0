/**
 * Tests for InvoiceAccessToken pure helpers.
 * DB operations (create/verify/revoke) are tested via integration or mocked separately.
 */

import {
  generateRawToken,
  hashToken,
  computeExpiresAt,
  TOKEN_EXPIRY_HOURS,
} from '@/lib/invoice/access-token';

// ─── generateRawToken ────────────────────────────────────────────────────────

describe('generateRawToken', () => {
  it('returns a 64-char hex string', () => {
    const token = generateRawToken();
    expect(token).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(token)).toBe(true);
  });

  it('generates unique tokens on each call', () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generateRawToken()));
    expect(tokens.size).toBe(100);
  });
});

// ─── hashToken ───────────────────────────────────────────────────────────────

describe('hashToken', () => {
  it('returns a 64-char hex string (SHA-256)', () => {
    const hash = hashToken('test-token');
    expect(hash).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(hash)).toBe(true);
  });

  it('is deterministic (same input → same hash)', () => {
    const a = hashToken('my-token-123');
    const b = hashToken('my-token-123');
    expect(a).toBe(b);
  });

  it('different inputs → different hashes', () => {
    const a = hashToken('token-a');
    const b = hashToken('token-b');
    expect(a).not.toBe(b);
  });

  it('raw token and its hash are different', () => {
    const raw = generateRawToken();
    const hash = hashToken(raw);
    expect(raw).not.toBe(hash);
  });
});

// ─── computeExpiresAt ────────────────────────────────────────────────────────

describe('computeExpiresAt', () => {
  it('defaults to TOKEN_EXPIRY_HOURS (72h)', () => {
    const before = Date.now();
    const expiresAt = computeExpiresAt();
    const after = Date.now();

    const expectedMin = before + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000;
    const expectedMax = after + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000;

    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(expectedMin);
    expect(expiresAt.getTime()).toBeLessThanOrEqual(expectedMax);
  });

  it('accepts custom hours', () => {
    const before = Date.now();
    const expiresAt = computeExpiresAt(24);
    const expected = before + 24 * 60 * 60 * 1000;

    // Allow 100ms tolerance
    expect(Math.abs(expiresAt.getTime() - expected)).toBeLessThan(100);
  });

  it('0 hours → expires immediately (≈ now)', () => {
    const now = Date.now();
    const expiresAt = computeExpiresAt(0);
    expect(Math.abs(expiresAt.getTime() - now)).toBeLessThan(100);
  });

  it('returns a Date object', () => {
    expect(computeExpiresAt()).toBeInstanceOf(Date);
  });
});

// ─── TOKEN_EXPIRY_HOURS constant ─────────────────────────────────────────────

describe('TOKEN_EXPIRY_HOURS', () => {
  it('is 72', () => {
    expect(TOKEN_EXPIRY_HOURS).toBe(72);
  });
});
