import {
  CurriculumResolutionError,
  resolveCurriculumContext,
} from '@/lib/curriculum/version-resolution/resolve-curriculum-context';
import { CURRICULUM_REGISTRY } from '@/lib/curriculum/registry';

describe('resolveCurriculumContext', () => {
  // ──────────────────────────────────────────────────────────
  // Mathematics
  // ──────────────────────────────────────────────────────────

  test('entry into Seconde in 2026-2027 uses the prior Troisième programme and new Seconde programme', () => {
    const context = resolveCurriculumContext({
      academicYear: '2026-2027',
      currentLevel: 'TROISIEME',
      targetLevel: 'SECONDE',
      track: 'GENERAL_TECHNOLOGICAL',
      prerequisiteTrack: 'COLLEGE',
      subject: 'MATHEMATICS',
      subjectVariant: 'COMMON',
      prerequisiteSubjectVariant: 'COMMON',
    });

    expect(context).toMatchObject({
      previousAcademicYear: '2025-2026',
      prerequisiteCurriculumId: 'fr-maths-troisieme-cycle4-2020',
      targetCurriculumId: 'fr-maths-seconde-gt-2026',
    });
  });

  test('entry into Première speciality in 2026-2027 does not use the new Seconde programme as prerequisite', () => {
    const context = resolveCurriculumContext({
      academicYear: '2026-2027',
      currentLevel: 'SECONDE',
      targetLevel: 'PREMIERE',
      track: 'GENERAL',
      prerequisiteTrack: 'GENERAL_TECHNOLOGICAL',
      subject: 'MATHEMATICS',
      subjectVariant: 'SPECIALITY',
      prerequisiteSubjectVariant: 'COMMON',
      examSession: 2028,
    });

    expect(context).toMatchObject({
      prerequisiteCurriculumId: 'fr-maths-seconde-gt-2019',
      targetCurriculumId: 'fr-maths-premiere-speciality-2026',
      examSession: 2028,
    });
  });

  test('entry into Terminale in 2026-2027 keeps the 2019 Terminale programme', () => {
    const context = resolveCurriculumContext({
      academicYear: '2026-2027',
      currentLevel: 'PREMIERE',
      targetLevel: 'TERMINALE',
      track: 'GENERAL',
      prerequisiteTrack: 'GENERAL',
      subject: 'MATHEMATICS',
      subjectVariant: 'SPECIALITY',
      prerequisiteSubjectVariant: 'SPECIALITY',
      examSession: 2027,
    });

    expect(context).toMatchObject({
      prerequisiteCurriculumId: 'fr-maths-premiere-speciality-2019',
      targetCurriculumId: 'fr-maths-terminale-speciality-2019',
    });
  });

  test('entry into Terminale in 2027-2028 switches both prerequisite and target to the 2026 publications', () => {
    const context = resolveCurriculumContext({
      academicYear: '2027-2028',
      currentLevel: 'PREMIERE',
      targetLevel: 'TERMINALE',
      track: 'GENERAL',
      prerequisiteTrack: 'GENERAL',
      subject: 'MATHEMATICS',
      subjectVariant: 'SPECIALITY',
      prerequisiteSubjectVariant: 'SPECIALITY',
      examSession: 2028,
    });

    expect(context).toMatchObject({
      previousAcademicYear: '2026-2027',
      prerequisiteCurriculumId: 'fr-maths-premiere-speciality-2026',
      targetCurriculumId: 'fr-maths-terminale-speciality-2026',
    });
  });

  // ──────────────────────────────────────────────────────────
  // Physics-Chemistry
  // ──────────────────────────────────────────────────────────

  test('entry into Seconde in 2026-2027 resolves Physics-Chem Troisième as prerequisite', () => {
    const context = resolveCurriculumContext({
      academicYear: '2026-2027',
      currentLevel: 'TROISIEME',
      targetLevel: 'SECONDE',
      track: 'GENERAL_TECHNOLOGICAL',
      prerequisiteTrack: 'COLLEGE',
      subject: 'PHYSICS_CHEMISTRY',
      subjectVariant: 'COMMON',
      prerequisiteSubjectVariant: 'COMMON',
    });

    expect(context).toMatchObject({
      prerequisiteCurriculumId: 'fr-physics-troisieme-cycle4-2020',
      targetCurriculumId: 'fr-physics-seconde-gt-2019',
    });
  });

  test('entry into Première Physique-Chimie speciality in 2026-2027 resolves correctly', () => {
    const context = resolveCurriculumContext({
      academicYear: '2026-2027',
      currentLevel: 'SECONDE',
      targetLevel: 'PREMIERE',
      track: 'GENERAL',
      prerequisiteTrack: 'GENERAL_TECHNOLOGICAL',
      subject: 'PHYSICS_CHEMISTRY',
      subjectVariant: 'SPECIALITY',
      prerequisiteSubjectVariant: 'COMMON',
    });

    expect(context).toMatchObject({
      prerequisiteCurriculumId: 'fr-physics-seconde-gt-2019',
      targetCurriculumId: 'fr-physics-premiere-speciality-2019',
    });
  });

  test('entry into Terminale Physique-Chimie in 2026-2027 resolves the 2020 programme', () => {
    const context = resolveCurriculumContext({
      academicYear: '2026-2027',
      currentLevel: 'PREMIERE',
      targetLevel: 'TERMINALE',
      track: 'GENERAL',
      prerequisiteTrack: 'GENERAL',
      subject: 'PHYSICS_CHEMISTRY',
      subjectVariant: 'SPECIALITY',
      prerequisiteSubjectVariant: 'SPECIALITY',
    });

    expect(context).toMatchObject({
      prerequisiteCurriculumId: 'fr-physics-premiere-speciality-2019',
      targetCurriculumId: 'fr-physics-terminale-speciality-2020',
    });
  });

  // ──────────────────────────────────────────────────────────
  // NSI
  // ──────────────────────────────────────────────────────────

  test('NSI Première in 2026-2027 uses SNT Seconde as prerequisite', () => {
    const context = resolveCurriculumContext({
      academicYear: '2026-2027',
      currentLevel: 'SECONDE',
      targetLevel: 'PREMIERE',
      track: 'GENERAL',
      prerequisiteTrack: 'GENERAL_TECHNOLOGICAL',
      prerequisiteSubject: 'SNT',
      subject: 'NSI',
      subjectVariant: 'SPECIALITY',
      prerequisiteSubjectVariant: 'COMMON',
    });

    expect(context).toMatchObject({
      prerequisiteSubject: 'SNT',
      subject: 'NSI',
      prerequisiteCurriculumId: 'fr-snt-seconde-gt-2019',
      targetCurriculumId: 'fr-nsi-premiere-speciality-2019',
    });
  });

  test('entry into NSI Terminale in 2026-2027 uses the 2019 Première as prerequisite', () => {
    const context = resolveCurriculumContext({
      academicYear: '2026-2027',
      currentLevel: 'PREMIERE',
      targetLevel: 'TERMINALE',
      track: 'GENERAL',
      prerequisiteTrack: 'GENERAL',
      subject: 'NSI',
      subjectVariant: 'SPECIALITY',
      prerequisiteSubjectVariant: 'SPECIALITY',
    });

    expect(context).toMatchObject({
      prerequisiteCurriculumId: 'fr-nsi-premiere-speciality-2019',
      targetCurriculumId: 'fr-nsi-terminale-speciality-2020',
    });
  });

  // ──────────────────────────────────────────────────────────
  // SNT
  // ──────────────────────────────────────────────────────────

  test('SNT Seconde entry resolves correctly in 2026-2027', () => {
    const context = resolveCurriculumContext({
      academicYear: '2026-2027',
      currentLevel: 'TROISIEME',
      targetLevel: 'SECONDE',
      track: 'GENERAL_TECHNOLOGICAL',
      prerequisiteTrack: 'COLLEGE',
      subject: 'SNT',
      subjectVariant: 'COMMON',
      prerequisiteSubjectVariant: 'SNT_READINESS',
    });

    expect(context).toMatchObject({
      prerequisiteCurriculumId: 'fr-snt-readiness-troisieme-2020',
      targetCurriculumId: 'fr-snt-seconde-gt-2019',
    });
  });

  // ──────────────────────────────────────────────────────────
  // French
  // ──────────────────────────────────────────────────────────

  test('entry into Seconde in 2026-2027 resolves French cycle 4 as prerequisite', () => {
    const context = resolveCurriculumContext({
      academicYear: '2026-2027',
      currentLevel: 'TROISIEME',
      targetLevel: 'SECONDE',
      track: 'GENERAL_TECHNOLOGICAL',
      prerequisiteTrack: 'COLLEGE',
      subject: 'FRENCH',
      subjectVariant: 'COMMON',
      prerequisiteSubjectVariant: 'COMMON',
    });

    expect(context).toMatchObject({
      prerequisiteCurriculumId: 'fr-french-troisieme-cycle4-2020',
      targetCurriculumId: 'fr-french-seconde-gt-2019',
    });
  });

  test('entry into Première French in 2026-2027 resolves correctly', () => {
    const context = resolveCurriculumContext({
      academicYear: '2026-2027',
      currentLevel: 'SECONDE',
      targetLevel: 'PREMIERE',
      track: 'GENERAL',
      prerequisiteTrack: 'GENERAL_TECHNOLOGICAL',
      subject: 'FRENCH',
      subjectVariant: 'COMMON',
      prerequisiteSubjectVariant: 'COMMON',
    });

    expect(context).toMatchObject({
      prerequisiteCurriculumId: 'fr-french-seconde-gt-2019',
      targetCurriculumId: 'fr-french-premiere-general-2019',
    });
  });

  test('entry into Terminale French transversal module resolves in 2026-2027', () => {
    const context = resolveCurriculumContext({
      academicYear: '2026-2027',
      currentLevel: 'PREMIERE',
      targetLevel: 'TERMINALE',
      track: 'GENERAL',
      prerequisiteTrack: 'GENERAL',
      subject: 'FRENCH',
      subjectVariant: 'TRANSVERSAL_EXPRESSION',
      prerequisiteSubjectVariant: 'COMMON',
    });

    expect(context).toMatchObject({
      prerequisiteCurriculumId: 'fr-french-premiere-general-2019',
      targetCurriculumId: 'fr-french-terminale-transversal-2020',
    });
  });

  // ──────────────────────────────────────────────────────────
  // Error cases
  // ──────────────────────────────────────────────────────────

  test('fails explicitly when a required variant has no registered curriculum', () => {
    expect(() => resolveCurriculumContext({
      academicYear: '2026-2027',
      currentLevel: 'PREMIERE',
      targetLevel: 'TERMINALE',
      track: 'GENERAL',
      prerequisiteTrack: 'GENERAL',
      subject: 'MATHEMATICS',
      subjectVariant: 'COMPLEMENTARY',
      prerequisiteSubjectVariant: 'SPECIALITY',
    })).toThrow(CurriculumResolutionError);

    try {
      resolveCurriculumContext({
        academicYear: '2026-2027',
        currentLevel: 'PREMIERE',
        targetLevel: 'TERMINALE',
        track: 'GENERAL',
        prerequisiteTrack: 'GENERAL',
        subject: 'MATHEMATICS',
        subjectVariant: 'COMPLEMENTARY',
        prerequisiteSubjectVariant: 'SPECIALITY',
      });
    } catch (error) {
      expect(error).toMatchObject({ code: 'NO_MATCH', stage: 'TARGET' });
    }
  });

  test('fails explicitly when the requested year exceeds the validated registry horizon', () => {
    expect(() => resolveCurriculumContext({
      academicYear: '2035-2036',
      currentLevel: 'PREMIERE',
      targetLevel: 'TERMINALE',
      track: 'GENERAL',
      prerequisiteTrack: 'GENERAL',
      subject: 'MATHEMATICS',
      subjectVariant: 'SPECIALITY',
      prerequisiteSubjectVariant: 'SPECIALITY',
    })).toThrow(expect.objectContaining({
      code: 'NO_MATCH',
      stage: 'TARGET',
    }));
  });

  test('fails explicitly instead of choosing silently between overlapping target versions', () => {
    const target = CURRICULUM_REGISTRY.find(
      (curriculum) => curriculum.id === 'fr-maths-seconde-gt-2026',
    );
    expect(target).toBeDefined();

    const brokenRegistry = [
      ...CURRICULUM_REGISTRY,
      { ...target!, id: 'fr-maths-seconde-gt-ambiguous-test' },
    ];

    expect(() => resolveCurriculumContext({
      academicYear: '2026-2027',
      currentLevel: 'TROISIEME',
      targetLevel: 'SECONDE',
      track: 'GENERAL_TECHNOLOGICAL',
      prerequisiteTrack: 'COLLEGE',
      subject: 'MATHEMATICS',
      subjectVariant: 'COMMON',
      prerequisiteSubjectVariant: 'COMMON',
    }, brokenRegistry)).toThrow(expect.objectContaining({
      code: 'AMBIGUOUS_MATCH',
      stage: 'TARGET',
    }));
  });
});
