/**
 * Credits Cancellation Policy — Complete Test Suite
 *
 * Tests: canCancelBooking with all session types, modalities, and time boundaries
 *
 * Source: lib/credits.ts (canCancelBooking function)
 */

import { canCancelBooking } from '@/lib/credits';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const NOW = new Date('2026-06-15T10:00:00Z');

function hoursFromNow(hours: number): Date {
  return new Date(NOW.getTime() + hours * 60 * 60 * 1000);
}

// ─── INDIVIDUAL Sessions — 24h Policy ────────────────────────────────────────

describe('canCancelBooking — INDIVIDUAL sessions', () => {
  it('should allow cancellation 25h before (ONLINE)', () => {
    expect(canCancelBooking('INDIVIDUAL' as any, 'ONLINE' as any, hoursFromNow(25), NOW)).toBe(true);
  });

  it('should allow cancellation exactly 24h before (ONLINE)', () => {
    expect(canCancelBooking('INDIVIDUAL' as any, 'ONLINE' as any, hoursFromNow(24), NOW)).toBe(true);
  });

  it('should deny cancellation 23h before (ONLINE)', () => {
    expect(canCancelBooking('INDIVIDUAL' as any, 'ONLINE' as any, hoursFromNow(23), NOW)).toBe(false);
  });

  it('should deny cancellation 1h before (ONLINE)', () => {
    expect(canCancelBooking('INDIVIDUAL' as any, 'ONLINE' as any, hoursFromNow(1), NOW)).toBe(false);
  });

  it('should deny cancellation for past session (ONLINE)', () => {
    expect(canCancelBooking('INDIVIDUAL' as any, 'ONLINE' as any, hoursFromNow(-1), NOW)).toBe(false);
  });

  it('should allow cancellation 48h before (IN_PERSON)', () => {
    expect(canCancelBooking('INDIVIDUAL' as any, 'IN_PERSON' as any, hoursFromNow(48), NOW)).toBe(true);
  });

  it('should allow cancellation 25h before (IN_PERSON)', () => {
    expect(canCancelBooking('INDIVIDUAL' as any, 'IN_PERSON' as any, hoursFromNow(25), NOW)).toBe(true);
  });

  it('should deny cancellation 23h before (IN_PERSON)', () => {
    // INDIVIDUAL type triggers 24h rule regardless of modality
    expect(canCancelBooking('INDIVIDUAL' as any, 'IN_PERSON' as any, hoursFromNow(23), NOW)).toBe(false);
  });
});

// ─── ONLINE Modality — 24h Policy ────────────────────────────────────────────

describe('canCancelBooking — ONLINE modality', () => {
  it('should allow cancellation 25h before (GROUP + ONLINE)', () => {
    // ONLINE modality triggers 24h rule even for GROUP
    expect(canCancelBooking('GROUP' as any, 'ONLINE' as any, hoursFromNow(25), NOW)).toBe(true);
  });

  it('should allow cancellation exactly 24h before (GROUP + ONLINE)', () => {
    expect(canCancelBooking('GROUP' as any, 'ONLINE' as any, hoursFromNow(24), NOW)).toBe(true);
  });

  it('should deny cancellation 23h before (GROUP + ONLINE)', () => {
    expect(canCancelBooking('GROUP' as any, 'ONLINE' as any, hoursFromNow(23), NOW)).toBe(false);
  });
});

// ─── HYBRID Modality — 24h Policy ────────────────────────────────────────────

describe('canCancelBooking — HYBRID modality', () => {
  it('should allow cancellation 25h before (GROUP + HYBRID)', () => {
    expect(canCancelBooking('GROUP' as any, 'HYBRID' as any, hoursFromNow(25), NOW)).toBe(true);
  });

  it('should deny cancellation 23h before (GROUP + HYBRID)', () => {
    expect(canCancelBooking('GROUP' as any, 'HYBRID' as any, hoursFromNow(23), NOW)).toBe(false);
  });
});

// ─── GROUP Sessions — 48h Policy (IN_PERSON) ────────────────────────────────

describe('canCancelBooking — GROUP sessions (IN_PERSON)', () => {
  it('should allow cancellation 49h before', () => {
    expect(canCancelBooking('GROUP' as any, 'IN_PERSON' as any, hoursFromNow(49), NOW)).toBe(true);
  });

  it('should allow cancellation exactly 48h before', () => {
    expect(canCancelBooking('GROUP' as any, 'IN_PERSON' as any, hoursFromNow(48), NOW)).toBe(true);
  });

  it('should deny cancellation 47h before', () => {
    expect(canCancelBooking('GROUP' as any, 'IN_PERSON' as any, hoursFromNow(47), NOW)).toBe(false);
  });

  it('should deny cancellation 24h before', () => {
    expect(canCancelBooking('GROUP' as any, 'IN_PERSON' as any, hoursFromNow(24), NOW)).toBe(false);
  });
});

// ─── MASTERCLASS Sessions — 48h Policy (IN_PERSON) ──────────────────────────

describe('canCancelBooking — MASTERCLASS sessions (IN_PERSON)', () => {
  it('should allow cancellation 49h before', () => {
    expect(canCancelBooking('MASTERCLASS' as any, 'IN_PERSON' as any, hoursFromNow(49), NOW)).toBe(true);
  });

  it('should allow cancellation exactly 48h before', () => {
    expect(canCancelBooking('MASTERCLASS' as any, 'IN_PERSON' as any, hoursFromNow(48), NOW)).toBe(true);
  });

  it('should deny cancellation 47h before', () => {
    expect(canCancelBooking('MASTERCLASS' as any, 'IN_PERSON' as any, hoursFromNow(47), NOW)).toBe(false);
  });

  it('should deny cancellation for past session', () => {
    expect(canCancelBooking('MASTERCLASS' as any, 'IN_PERSON' as any, hoursFromNow(-5), NOW)).toBe(false);
  });
});

// ─── Edge Cases ──────────────────────────────────────────────────────────────

describe('canCancelBooking — Edge Cases', () => {
  it('should allow cancellation far in the future (7 days)', () => {
    expect(canCancelBooking('INDIVIDUAL' as any, 'ONLINE' as any, hoursFromNow(168), NOW)).toBe(true);
  });

  it('should deny cancellation for session happening right now', () => {
    expect(canCancelBooking('INDIVIDUAL' as any, 'ONLINE' as any, NOW, NOW)).toBe(false);
  });

  it('should be deterministic across 100 calls', () => {
    const results = Array.from({ length: 100 }, () =>
      canCancelBooking('INDIVIDUAL' as any, 'ONLINE' as any, hoursFromNow(25), NOW)
    );
    expect(new Set(results).size).toBe(1);
    expect(results[0]).toBe(true);
  });
});
