import {
  assertCurriculumRegistryIntegrity,
  CURRICULUM_REGISTRY,
  PHYSICS_CURRICULA,
  NSI_CURRICULA,
  SNT_CURRICULA,
  FRENCH_CURRICULA,
} from '@/lib/curriculum/registry';
import type { CurriculumVersion } from '@/lib/curriculum/schemas/curriculum';

describe('curriculum registry', () => {
  test('contains the reviewed mathematics transitions required for 2026-2027', () => {
    expect(CURRICULUM_REGISTRY.map((curriculum) => curriculum.id)).toEqual(expect.arrayContaining([
      'fr-maths-troisieme-cycle4-2020',
      'fr-maths-seconde-gt-2019',
      'fr-maths-seconde-gt-2026',
      'fr-maths-premiere-speciality-2019',
      'fr-maths-premiere-speciality-2026',
      'fr-maths-terminale-speciality-2019',
      'fr-maths-terminale-speciality-2026',
    ]));
  });

  test('contains physics-chemistry curricula for all required levels', () => {
    const ids = CURRICULUM_REGISTRY.map((c) => c.id);
    expect(ids).toEqual(expect.arrayContaining([
      'fr-physics-troisieme-cycle4-2020',
      'fr-physics-seconde-gt-2019',
      'fr-physics-premiere-speciality-2019',
      'fr-physics-terminale-speciality-2020',
    ]));
  });

  test('contains NSI curricula for Première and Terminale', () => {
    const ids = CURRICULUM_REGISTRY.map((c) => c.id);
    expect(ids).toEqual(expect.arrayContaining([
      'fr-nsi-premiere-speciality-2019',
      'fr-nsi-terminale-speciality-2020',
    ]));
  });

  test('contains SNT curricula for Seconde and Troisième readiness', () => {
    const ids = CURRICULUM_REGISTRY.map((c) => c.id);
    expect(ids).toEqual(expect.arrayContaining([
      'fr-snt-readiness-troisieme-2020',
      'fr-snt-seconde-gt-2019',
    ]));
  });

  test('contains French curricula for all levels including Terminale transversal module', () => {
    const ids = CURRICULUM_REGISTRY.map((c) => c.id);
    expect(ids).toEqual(expect.arrayContaining([
      'fr-french-troisieme-cycle4-2020',
      'fr-french-seconde-gt-2019',
      'fr-french-premiere-general-2019',
      'fr-french-terminale-transversal-2020',
    ]));
  });

  test('all curricula have PUBLISHED status', () => {
    for (const curriculum of CURRICULUM_REGISTRY) {
      expect(curriculum.status).toBe('PUBLISHED');
    }
  });

  test('all curricula have at least one official source', () => {
    for (const curriculum of CURRICULUM_REGISTRY) {
      expect(curriculum.officialSources.length).toBeGreaterThanOrEqual(1);
    }
  });

  test('has unique ids and no overlapping effective ranges for one selector', () => {
    expect(() => assertCurriculumRegistryIntegrity(CURRICULUM_REGISTRY)).not.toThrow();
  });

  test('physics curricula export contains expected entries', () => {
    expect(PHYSICS_CURRICULA.length).toBe(4);
    expect(PHYSICS_CURRICULA.map((c) => c.subject).every((s) => s === 'PHYSICS_CHEMISTRY')).toBe(true);
  });

  test('NSI curricula export contains entries for GENERAL track only', () => {
    expect(NSI_CURRICULA.length).toBe(2);
    expect(NSI_CURRICULA.map((c) => c.track).every((t) => t === 'GENERAL')).toBe(true);
  });

  test('SNT curricula export contains COMMON variant for Seconde', () => {
    const secondeEntry = SNT_CURRICULA.find((c) => c.level === 'SECONDE');
    expect(secondeEntry).toBeDefined();
    expect(secondeEntry?.subjectVariant).toBe('COMMON');
  });

  test('SNT Troisième entry uses SNT_READINESS variant to distinguish from regular college curriculum', () => {
    const snrEntry = SNT_CURRICULA.find((c) => c.level === 'TROISIEME');
    expect(snrEntry).toBeDefined();
    expect(snrEntry?.subjectVariant).toBe('SNT_READINESS');
  });

  test('French Terminale entry uses TRANSVERSAL_EXPRESSION variant (no official French Terminale programme)', () => {
    const terminaleEntry = FRENCH_CURRICULA.find((c) => c.level === 'TERMINALE');
    expect(terminaleEntry).toBeDefined();
    expect(terminaleEntry?.subjectVariant).toBe('TRANSVERSAL_EXPRESSION');
  });

  test('exposes deeply frozen curriculum entries and official sources', () => {
    const entry = CURRICULUM_REGISTRY[0];

    expect(Object.isFrozen(CURRICULUM_REGISTRY)).toBe(true);
    expect(Object.isFrozen(entry)).toBe(true);
    expect(Object.isFrozen(entry.officialSources)).toBe(true);
    expect(Object.isFrozen(entry.officialSources[0])).toBe(true);
  });

  test('rejects overlapping versions for the same subject, level, track and variant', () => {
    const source = CURRICULUM_REGISTRY.find(
      (curriculum) => curriculum.id === 'fr-maths-seconde-gt-2026',
    );
    expect(source).toBeDefined();

    const overlapping: CurriculumVersion = {
      ...source!,
      id: 'fr-maths-seconde-gt-overlap',
      version: 'overlap-test',
      effectiveFromAcademicYear: '2027-2028',
    };

    expect(() => assertCurriculumRegistryIntegrity([
      ...CURRICULUM_REGISTRY,
      overlapping,
    ])).toThrow(/overlap/i);
  });
});
