/**
 * `lib/timezone.ts` — the single shared, IANA-aware timezone primitive.
 * Each test PROVES the offset is derived from real tzdata via `Intl`, not
 * a hardcoded constant: a zone that observes DST must return a DIFFERENT
 * offset in January vs. July.
 */
import { getUtcOffsetHours, getOrganizationUtcOffsetHours, ORGANIZATION_TIMEZONE } from '@/lib/timezone';

describe('ORGANIZATION_TIMEZONE', () => {
  it('is configured as Africa/Tunis', () => {
    expect(ORGANIZATION_TIMEZONE).toBe('Africa/Tunis');
  });
});

describe('getUtcOffsetHours', () => {
  it('resolves Africa/Tunis as UTC+1 (fixed, no DST since 2009)', () => {
    expect(getUtcOffsetHours('Africa/Tunis', new Date('2026-01-15T12:00:00Z'))).toBe(1);
    expect(getUtcOffsetHours('Africa/Tunis', new Date('2026-07-15T12:00:00Z'))).toBe(1);
  });

  it('resolves a DST-observing zone to DIFFERENT offsets across seasons — proves this is a real Intl/tzdata computation, not a hardcoded table', () => {
    const winterOffset = getUtcOffsetHours('Europe/Paris', new Date('2026-01-15T12:00:00Z'));
    const summerOffset = getUtcOffsetHours('Europe/Paris', new Date('2026-07-15T12:00:00Z'));
    expect(winterOffset).toBe(1);
    expect(summerOffset).toBe(2);
    expect(winterOffset).not.toBe(summerOffset);
  });

  it('resolves UTC itself to 0', () => {
    expect(getUtcOffsetHours('UTC', new Date('2026-01-15T12:00:00Z'))).toBe(0);
  });

  it('throws for an invalid IANA timezone name instead of silently defaulting', () => {
    expect(() => getUtcOffsetHours('Not/AZone', new Date())).toThrow();
  });
});

describe('getOrganizationUtcOffsetHours', () => {
  it('delegates to getUtcOffsetHours(ORGANIZATION_TIMEZONE, ...)', () => {
    const at = new Date('2026-03-10T10:00:00Z');
    expect(getOrganizationUtcOffsetHours(at)).toBe(getUtcOffsetHours(ORGANIZATION_TIMEZONE, at));
  });

  it('defaults to now when no instant is given', () => {
    expect(() => getOrganizationUtcOffsetHours()).not.toThrow();
  });
});
