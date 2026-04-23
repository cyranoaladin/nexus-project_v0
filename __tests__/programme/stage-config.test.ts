/**
 * F44: Stage config integrity tests
 * Validates that all chapter keys referenced in stage config exist in programmeData
 */

import { STAGE_PRINTEMPS_2026 } from '@/app/programme/maths-1ere/config/stage';
import { programmeData } from '@/app/programme/maths-1ere/data';

describe('F44: Stage Config Integrity', () => {
  // Build a set of all valid chapter IDs from programmeData
  const allValidChapIds = new Set<string>();
  const chapIdToCatKey = new Map<string, string>();

  beforeAll(() => {
    for (const [catKey, cat] of Object.entries(programmeData)) {
      for (const chap of cat.chapitres) {
        allValidChapIds.add(chap.id);
        chapIdToCatKey.set(chap.id, catKey);
      }
    }
  });

  it('should have all chapter keys in stage config exist in programmeData', () => {
    const invalidKeys: string[] = [];

    for (const seance of STAGE_PRINTEMPS_2026.seances) {
      for (const chapId of seance.chapitresClés) {
        if (!allValidChapIds.has(chapId)) {
          invalidKeys.push(`${seance.date}:${chapId}`);
        }
      }
    }

    expect(invalidKeys).toEqual([]);
  });

  it('should have corrected the 3 previously broken keys', () => {
    // These were the broken keys before F44 fix
    const previouslyBrokenKeys = ['suites-numeriques', 'derivation-variations', 'probabilites-conditionnelles'];

    for (const seance of STAGE_PRINTEMPS_2026.seances) {
      for (const chapId of seance.chapitresClés) {
        expect(previouslyBrokenKeys).not.toContain(chapId);
      }
    }
  });

  it('should have valid corrected keys present', () => {
    // After fix, these should exist
    const correctedKeys = ['suites', 'derivation', 'variations-courbes', 'probabilites-cond'];
    const allChapIdsInStage = STAGE_PRINTEMPS_2026.seances.flatMap(s => s.chapitresClés);

    for (const key of correctedKeys) {
      expect(allChapIdsInStage).toContain(key);
    }
  });

  it('should have every non-empty chapter reference point to valid chapters', () => {
    for (const seance of STAGE_PRINTEMPS_2026.seances) {
      // Only check if there are chapter keys defined
      if (seance.chapitresClés.length > 0) {
        for (const chapId of seance.chapitresClés) {
          expect(allValidChapIds.has(chapId)).toBe(true);
        }
      }
    }
  });

  it('should have Math sessions reference valid math chapters', () => {
    const mathChapitres = new Set<string>();
    for (const cat of Object.values(programmeData)) {
      for (const chap of cat.chapitres) {
        mathChapitres.add(chap.id);
      }
    }

    for (const seance of STAGE_PRINTEMPS_2026.seances) {
      if (seance.matiere === 'Mathématiques' && seance.chapitresClés.length > 0) {
        for (const chapId of seance.chapitresClés) {
          expect(mathChapitres.has(chapId)).toBe(true);
        }
      }
    }
  });

  it('should have findCatKeyForChapter helper logic validated', () => {
    // Test the logic used in SeanceDuJour.tsx
    function findCatKeyForChapter(chapId: string): string | null {
      for (const [catKey, cat] of Object.entries(programmeData)) {
        if (cat.chapitres.some((chap) => chap.id === chapId)) {
          return catKey;
        }
      }
      return null;
    }

    // Test with corrected keys
    expect(findCatKeyForChapter('suites')).toBe('algebre');
    expect(findCatKeyForChapter('derivation')).toBe('analyse');
    expect(findCatKeyForChapter('probabilites-cond')).toBe('probabilites');

    // Test with previously broken keys (should return null as they don't exist)
    expect(findCatKeyForChapter('suites-numeriques')).toBeNull();
    expect(findCatKeyForChapter('derivation-variations')).toBeNull();
    expect(findCatKeyForChapter('probabilites-conditionnelles')).toBeNull();
  });
});
