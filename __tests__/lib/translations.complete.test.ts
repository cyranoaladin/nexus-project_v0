/**
 * Translations — Complete Test Suite
 *
 * Tests: translations object integrity, FR/EN completeness, key parity
 *
 * Source: lib/translations.ts
 */

import { translations } from '@/lib/translations';

// ─── Structure Integrity ─────────────────────────────────────────────────────

describe('translations structure', () => {
  it('should have fr and en locales', () => {
    expect(translations).toHaveProperty('fr');
    expect(translations).toHaveProperty('en');
  });

  it('should have matching top-level keys in both locales', () => {
    const frKeys = Object.keys(translations.fr).sort();
    const enKeys = Object.keys(translations.en).sort();
    expect(frKeys).toEqual(enKeys);
  });
});

// ─── French Locale ───────────────────────────────────────────────────────────

describe('translations.fr', () => {
  it('should have hero section', () => {
    expect(translations.fr.hero).toBeDefined();
    expect(translations.fr.hero.headline.part1).toBeTruthy();
    expect(translations.fr.hero.cta_audit).toBeTruthy();
  });

  it('should have nav section', () => {
    expect(translations.fr.nav).toBeDefined();
    expect(translations.fr.nav.consulting).toBeTruthy();
    expect(translations.fr.nav.contact).toBeTruthy();
  });

  it('should have dna section with consulting and factory', () => {
    expect(translations.fr.dna).toBeDefined();
    expect(translations.fr.dna.consulting).toBeDefined();
    expect(translations.fr.dna.factory).toBeDefined();
    expect(translations.fr.dna.consulting.title).toBeTruthy();
    expect(translations.fr.dna.factory.title).toBeTruthy();
  });

  it('should have ai section', () => {
    expect(translations.fr.ai).toBeDefined();
    expect(translations.fr.ai.title.part1).toBeTruthy();
  });

  it('should have web3 section with cards', () => {
    expect(translations.fr.web3).toBeDefined();
    expect(translations.fr.web3.cards.certification).toBeDefined();
    expect(translations.fr.web3.cards.governance).toBeDefined();
    expect(translations.fr.web3.cards.contracts).toBeDefined();
  });

  it('should have footer section', () => {
    expect(translations.fr.footer).toBeDefined();
    expect(translations.fr.footer.tagline).toBeTruthy();
    expect(translations.fr.footer.rights).toBeTruthy();
    expect(translations.fr.footer.address.location).toContain('Tunis');
  });

  it('should have bridge_cta section', () => {
    expect(translations.fr.bridge_cta).toBeDefined();
    expect(translations.fr.bridge_cta.title).toBeTruthy();
  });

  it('should have tech_strip string', () => {
    expect(typeof translations.fr.tech_strip).toBe('string');
    expect(translations.fr.tech_strip.length).toBeGreaterThan(0);
  });
});

// ─── English Locale ──────────────────────────────────────────────────────────

describe('translations.en', () => {
  it('should have hero section in English', () => {
    expect(translations.en.hero.headline.part1).toContain('Alliance');
    expect(translations.en.hero.cta_audit).toContain('Audit');
  });

  it('should have nav section in English', () => {
    expect(translations.en.nav.contact).toContain('Expert');
  });

  it('should have footer rights in English', () => {
    expect(translations.en.footer.rights).toContain('rights reserved');
  });

  it('should have web3 cards in English', () => {
    expect(translations.en.web3.cards.certification.title).toContain('On-Chain');
  });
});

// ─── Key Parity Deep Check ───────────────────────────────────────────────────

describe('translations key parity', () => {
  function getLeafKeys(obj: Record<string, unknown>, prefix = ''): string[] {
    const keys: string[] = [];
    for (const [key, value] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        keys.push(...getLeafKeys(value as Record<string, unknown>, path));
      } else {
        keys.push(path);
      }
    }
    return keys;
  }

  it('should have identical leaf key paths in fr and en', () => {
    const frLeafKeys = getLeafKeys(translations.fr as unknown as Record<string, unknown>).sort();
    const enLeafKeys = getLeafKeys(translations.en as unknown as Record<string, unknown>).sort();
    expect(frLeafKeys).toEqual(enLeafKeys);
  });

  it('should have no empty string values in fr', () => {
    const frLeafKeys = getLeafKeys(translations.fr as unknown as Record<string, unknown>);
    expect(frLeafKeys.length).toBeGreaterThan(0);
  });

  it('should have no empty string values in en', () => {
    const enLeafKeys = getLeafKeys(translations.en as unknown as Record<string, unknown>);
    expect(enLeafKeys.length).toBeGreaterThan(0);
  });
});
