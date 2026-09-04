/**
 * Track A, Section 5 — ProfilCandidat (declared exam facts) vs
 * StudentAcademicEnrollment (followed-course truth) must stay two
 * separate SSoTs, cross-checked read-only, never auto-synchronized.
 */
import type { ProfilCandidatInput } from '@/lib/exams/parcours';
import { checkAcademicMapConsistency } from '@/lib/quotes/candidate-academic-map-cross-check';

function baseProfil(overrides: Partial<ProfilCandidatInput> = {}): ProfilCandidatInput {
  return {
    level: 'TERMINALE',
    examSession: 2027,
    modalite: 'A',
    specialite1: 'MATHEMATIQUES',
    specialite2: 'NSI',
    specialiteAbandonnee: null,
    langueA: null,
    langueB: null,
    estRedoublant: false,
    estTitulaireBacDejaObtenu: false,
    changementSpecialite: false,
    intentionAmelioration: false,
    intentionCycleComplet: true,
    brancheBascule: null,
    epreuvesDispenseesDeclarees: [],
    etalementPlurisessionsDeclare: false,
    moyenneRattrapage: null,
    optionsTerminale: [],
    notesConservees: null,
    ...overrides,
  };
}

describe('checkAcademicMapConsistency', () => {
  test('candidat profile sans studentId: NOT_APPLICABLE, no cross-check attempted, never fails', () => {
    const result = checkAcademicMapConsistency(baseProfil(), null);
    expect(result.status).toBe('NOT_APPLICABLE');
    expect(result.requiresHumanReview).toBe(false);
  });

  test('missing Academic Map: studentId set but zero enrollments — flagged, human review required, never silently ignored', () => {
    const result = checkAcademicMapConsistency(baseProfil(), []);
    expect(result.status).toBe('MISSING_ACADEMIC_MAP');
    expect(result.requiresHumanReview).toBe(true);
  });

  test('compatible: both declared specialties have a matching SPECIALTY enrollment at the same grade', () => {
    const result = checkAcademicMapConsistency(baseProfil(), [
      { courseKey: 'eds-maths-terminale', kind: 'SPECIALTY', gradeLevel: 'TERMINALE' },
      { courseKey: 'eds-nsi-terminale', kind: 'SPECIALTY', gradeLevel: 'TERMINALE' },
    ]);
    expect(result.status).toBe('COMPATIBLE');
    expect(result.requiresHumanReview).toBe(false);
    expect(result.issues).toHaveLength(0);
  });

  test('incompatible: enrolled specialties do not match the declared ones — fails closed, human review required', () => {
    const result = checkAcademicMapConsistency(baseProfil({ specialite1: 'MATHEMATIQUES', specialite2: 'NSI' }), [
      { courseKey: 'eds-physique-chimie-terminale', kind: 'SPECIALTY', gradeLevel: 'TERMINALE' },
      { courseKey: 'eds-svt-terminale', kind: 'SPECIALTY', gradeLevel: 'TERMINALE' },
    ]);
    expect(result.status).toBe('INCOMPATIBLE');
    expect(result.requiresHumanReview).toBe(true);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  test('stale enrollment: enrollments exist only at a DIFFERENT grade than the profile declares — flagged distinctly from INCOMPATIBLE', () => {
    const result = checkAcademicMapConsistency(baseProfil({ level: 'TERMINALE' }), [
      { courseKey: 'eds-maths-premiere', kind: 'SPECIALTY', gradeLevel: 'PREMIERE' },
      { courseKey: 'eds-nsi-premiere', kind: 'SPECIALTY', gradeLevel: 'PREMIERE' },
    ]);
    expect(result.status).toBe('STALE_ENROLLMENT');
    expect(result.requiresHumanReview).toBe(true);
  });

  test('never writes anything — pure read-only comparison, no side effect, no auto-sync of either side', () => {
    const enrollments = [{ courseKey: 'eds-maths-terminale', kind: 'SPECIALTY', gradeLevel: 'TERMINALE' }];
    const frozenEnrollments = Object.freeze(enrollments);
    const profil = baseProfil();
    const frozenProfil = Object.freeze(profil);
    expect(() => checkAcademicMapConsistency(frozenProfil, frozenEnrollments)).not.toThrow();
  });
});
