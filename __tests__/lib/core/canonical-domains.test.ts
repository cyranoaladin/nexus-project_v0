/**
 * Unit Tests — Canonical Domain Lists
 *
 * Tests for getCanonicalDomains, backfillCanonicalDomains.
 * Ensures every subject always returns a fixed, complete domain set.
 */

import {
  getCanonicalDomains,
  backfillCanonicalDomains,
  CANONICAL_DOMAINS_MATHS,
  CANONICAL_DOMAINS_NSI,
  CANONICAL_DOMAINS_GENERAL,
} from '@/lib/assessments/core/config';

// ─── getCanonicalDomains ─────────────────────────────────────────────────────

describe('getCanonicalDomains', () => {
  it('returns 6 domains for MATHS', () => {
    const domains = getCanonicalDomains('MATHS');
    expect(domains).toHaveLength(6);
    expect(domains).toEqual(CANONICAL_DOMAINS_MATHS);
  });

  it('returns 6 domains for NSI', () => {
    const domains = getCanonicalDomains('NSI');
    expect(domains).toHaveLength(6);
    expect(domains).toEqual(CANONICAL_DOMAINS_NSI);
  });

  it('returns 4 domains for GENERAL', () => {
    const domains = getCanonicalDomains('GENERAL');
    expect(domains).toHaveLength(4);
    expect(domains).toEqual(CANONICAL_DOMAINS_GENERAL);
  });

  it('returns MATHS as fallback for unknown subject', () => {
    const domains = getCanonicalDomains('UNKNOWN');
    expect(domains).toEqual(CANONICAL_DOMAINS_MATHS);
  });

  it('MATHS includes all expected keys', () => {
    const domains = getCanonicalDomains('MATHS');
    expect(domains).toContain('algebre');
    expect(domains).toContain('analyse');
    expect(domains).toContain('geometrie');
    expect(domains).toContain('combinatoire');
    expect(domains).toContain('logExp');
    expect(domains).toContain('probabilites');
  });

  it('NSI includes all expected keys', () => {
    const domains = getCanonicalDomains('NSI');
    expect(domains).toContain('python');
    expect(domains).toContain('poo');
    expect(domains).toContain('structures');
    expect(domains).toContain('algorithmique');
    expect(domains).toContain('sql');
    expect(domains).toContain('architecture');
  });
});

// ─── backfillCanonicalDomains ────────────────────────────────────────────────

describe('backfillCanonicalDomains', () => {
  it('returns all 6 MATHS domains even when partial is empty', () => {
    const result = backfillCanonicalDomains('MATHS', {});
    expect(Object.keys(result)).toHaveLength(6);
    for (const domain of CANONICAL_DOMAINS_MATHS) {
      expect(result[domain]).toBe(0);
    }
  });

  it('preserves existing scores and fills missing with 0', () => {
    const result = backfillCanonicalDomains('MATHS', {
      analyse: 75,
      combinatoire: 50,
    });
    expect(result.analyse).toBe(75);
    expect(result.combinatoire).toBe(50);
    expect(result.algebre).toBe(0);
    expect(result.geometrie).toBe(0);
    expect(result.logExp).toBe(0);
    expect(result.probabilites).toBe(0);
  });

  it('returns all 6 MATHS domains when all are provided', () => {
    const partial = {
      algebre: 80,
      analyse: 60,
      geometrie: 40,
      combinatoire: 100,
      logExp: 20,
      probabilites: 55,
    };
    const result = backfillCanonicalDomains('MATHS', partial);
    expect(Object.keys(result)).toHaveLength(6);
    expect(result.algebre).toBe(80);
    expect(result.probabilites).toBe(55);
  });

  it('ignores non-canonical keys from partial', () => {
    const result = backfillCanonicalDomains('MATHS', {
      analyse: 50,
      unknown_domain: 99,
    } as Record<string, number>);
    expect(Object.keys(result)).toHaveLength(6);
    expect(result).not.toHaveProperty('unknown_domain');
  });

  it('treats undefined scores as 0', () => {
    const result = backfillCanonicalDomains('MATHS', {
      analyse: undefined,
      combinatoire: 50,
    });
    expect(result.analyse).toBe(0);
    expect(result.combinatoire).toBe(50);
  });

  it('treats NaN scores as 0', () => {
    const result = backfillCanonicalDomains('MATHS', {
      analyse: NaN,
    });
    expect(result.analyse).toBe(0);
  });

  it('works for NSI subject', () => {
    const result = backfillCanonicalDomains('NSI', { python: 90 });
    expect(Object.keys(result)).toHaveLength(6);
    expect(result.python).toBe(90);
    expect(result.poo).toBe(0);
    expect(result.structures).toBe(0);
  });

  it('works for GENERAL subject', () => {
    const result = backfillCanonicalDomains('GENERAL', {});
    expect(Object.keys(result)).toHaveLength(4);
    expect(result.methodologie).toBe(0);
    expect(result.connaissances).toBe(0);
  });

  it('"toutes fausses" assessment returns all domains at 0', () => {
    const result = backfillCanonicalDomains('MATHS', {
      analyse: 0,
      combinatoire: 0,
    });
    expect(Object.keys(result)).toHaveLength(6);
    for (const domain of CANONICAL_DOMAINS_MATHS) {
      expect(result[domain]).toBe(0);
    }
  });
});
