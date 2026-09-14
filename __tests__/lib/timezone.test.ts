/**
 * `lib/timezone.ts` — the single shared, IANA-aware timezone primitive.
 * Each test PROVES the offset is derived from real tzdata via `Intl`, not
 * a hardcoded constant: a zone that observes DST must return a DIFFERENT
 * offset in January vs. July.
 */
import {
  getUtcOffsetHours,
  getOrganizationUtcOffsetHours,
  getOrganizationTimezone,
  zonedWallClockToUtcInstant,
} from '@/lib/timezone';

function setNodeEnv(val: string) {
  (process.env as Record<string, string | undefined>).NODE_ENV = val;
}

describe('getOrganizationTimezone', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it('returns the explicitly configured NEXUS_ORGANIZATION_TIMEZONE value', () => {
    process.env.NEXUS_ORGANIZATION_TIMEZONE = 'Europe/Paris';
    expect(getOrganizationTimezone()).toBe('Europe/Paris');
  });

  it('falls back to the Africa/Tunis fixture outside production when unconfigured', () => {
    delete process.env.NEXUS_ORGANIZATION_TIMEZONE;
    setNodeEnv('test');
    expect(getOrganizationTimezone()).toBe('Africa/Tunis');
  });

  it('fails closed (throws) in production when unconfigured — never silently assumes a timezone', () => {
    delete process.env.NEXUS_ORGANIZATION_TIMEZONE;
    setNodeEnv('production');
    expect(() => getOrganizationTimezone()).toThrow(/NEXUS_ORGANIZATION_TIMEZONE/);
  });

  it('an explicitly configured value is used even in production', () => {
    process.env.NEXUS_ORGANIZATION_TIMEZONE = 'Africa/Tunis';
    setNodeEnv('production');
    expect(() => getOrganizationTimezone()).not.toThrow();
    expect(getOrganizationTimezone()).toBe('Africa/Tunis');
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
  it('delegates to getUtcOffsetHours(getOrganizationTimezone(), ...)', () => {
    const at = new Date('2026-03-10T10:00:00Z');
    expect(getOrganizationUtcOffsetHours(at)).toBe(getUtcOffsetHours(getOrganizationTimezone(), at));
  });

  it('defaults to now when no instant is given', () => {
    expect(() => getOrganizationUtcOffsetHours()).not.toThrow();
  });
});

describe('zonedWallClockToUtcInstant', () => {
  // pseudoUtc: a Date whose UTC accessors carry the LOCAL wall-clock
  // fields — the exact encoding lib/planning/invariants.ts's
  // combineDateAndTime uses.
  const pseudoUtc = (iso: string) => new Date(iso);

  it('a fixed-offset zone (Africa/Tunis, no DST since 2009) is always UNAMBIGUOUS', () => {
    const result = zonedWallClockToUtcInstant('Africa/Tunis', pseudoUtc('2026-06-15T14:00:00Z'));
    expect(result.outcome).toBe('UNAMBIGUOUS');
    // Africa/Tunis is UTC+1: 14:00 local == 13:00 UTC.
    expect(result.instant.toISOString()).toBe('2026-06-15T13:00:00.000Z');
  });

  it('an ordinary Europe/Paris wall-clock time away from any transition is UNAMBIGUOUS and round-trips', () => {
    // 2026-06-15 14:00 Paris (summer, UTC+2) == 12:00 UTC.
    const result = zonedWallClockToUtcInstant('Europe/Paris', pseudoUtc('2026-06-15T14:00:00Z'));
    expect(result.outcome).toBe('UNAMBIGUOUS');
    expect(result.instant.toISOString()).toBe('2026-06-15T12:00:00.000Z');
  });

  it('AMBIGUOUS_LOCAL_TIME: a fall-back local time (Europe/Paris, last Sunday of October, 02:30 occurs twice) resolves to the EARLIER UTC instant', () => {
    // 2026-10-25 is the last Sunday of October 2026 — Europe/Paris falls
    // back from CEST (UTC+2) to CET (UTC+1) at 03:00 CEST == 02:00 CET.
    // 02:30 local occurs once as 02:30 CEST (00:30 UTC) and again as
    // 02:30 CET (01:30 UTC). Policy: the earlier occurrence.
    const result = zonedWallClockToUtcInstant('Europe/Paris', pseudoUtc('2026-10-25T02:30:00Z'));
    expect(result.outcome).toBe('AMBIGUOUS');
    expect(result.instant.toISOString()).toBe('2026-10-25T00:30:00.000Z');
  });

  it('NONEXISTENT_LOCAL_TIME: a spring-forward local time (Europe/Paris, last Sunday of March, 02:30 is skipped) resolves forward past the gap', () => {
    // 2026-03-29 is the last Sunday of March 2026 — Europe/Paris springs
    // forward from CET (UTC+1) to CEST (UTC+2) at 02:00 CET, jumping
    // straight to 03:00 CEST. 02:30 local never occurs. Policy: shift
    // forward past the gap — the CEST offset applies, landing at 00:30 UTC
    // (== 02:30 CEST, the first real instant at/after the requested
    // wall-clock moment).
    const result = zonedWallClockToUtcInstant('Europe/Paris', pseudoUtc('2026-03-29T02:30:00Z'));
    expect(result.outcome).toBe('NONEXISTENT');
    expect(result.instant.toISOString()).toBe('2026-03-29T00:30:00.000Z');
  });

  it('a wall-clock time exactly at the fall-back boundary (the LAST ambiguous minute) is still classified AMBIGUOUS', () => {
    const result = zonedWallClockToUtcInstant('Europe/Paris', pseudoUtc('2026-10-25T02:59:00Z'));
    expect(result.outcome).toBe('AMBIGUOUS');
  });

  it('a wall-clock time exactly at the spring-forward boundary (the FIRST nonexistent minute) is still classified NONEXISTENT', () => {
    const result = zonedWallClockToUtcInstant('Europe/Paris', pseudoUtc('2026-03-29T02:00:00Z'));
    expect(result.outcome).toBe('NONEXISTENT');
  });
});
