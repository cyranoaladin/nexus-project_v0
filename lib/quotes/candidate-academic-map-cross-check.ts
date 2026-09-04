/**
 * Track A, Section 5 — read-only cross-check between ProfilCandidat
 * (candidate/exam-registration facts, SSoT=ProfilCandidat) and
 * StudentAcademicEnrollment (followed-course truth, SSoT=Academic Map).
 * These are two deliberately separate bounded contexts (see the schema
 * comment on ProfilCandidat) — this module NEVER writes to either side,
 * and never auto-derives one from the other. Its only job is to surface
 * a divergence for staff review; on any inconsistency, the answer is
 * fail closed (human review required), never a silent guess.
 *
 * Only meaningful when profil.studentId is set (the candidate is also an
 * existing enrolled Student) — the majority of candidat-individuel
 * profiles have no studentId at all (they aren't Nexus students), which
 * is NOT an inconsistency, just not applicable.
 */
import type { ProfilCandidatInput } from '@/lib/exams/parcours';

export type AcademicMapCrossCheckStatus =
  | 'NOT_APPLICABLE'
  | 'MISSING_ACADEMIC_MAP'
  | 'COMPATIBLE'
  | 'INCOMPATIBLE'
  | 'STALE_ENROLLMENT';

export interface AcademicMapCrossCheckResult {
  status: AcademicMapCrossCheckStatus;
  issues: string[];
  requiresHumanReview: boolean;
}

export interface EnrollmentFact {
  courseKey: string;
  kind: string;
  gradeLevel: string;
}

const SPECIALTY_COURSE_KEY_BY_SUBJECT_AND_LEVEL: Partial<Record<string, Partial<Record<'PREMIERE' | 'TERMINALE', string>>>> = {
  MATHEMATIQUES: { PREMIERE: 'eds-maths-premiere', TERMINALE: 'eds-maths-terminale' },
  NSI: { PREMIERE: 'eds-nsi-premiere', TERMINALE: 'eds-nsi-terminale' },
  PHYSIQUE_CHIMIE: { PREMIERE: 'eds-physique-chimie-premiere', TERMINALE: 'eds-physique-chimie-terminale' },
  SVT: { PREMIERE: 'eds-svt-premiere', TERMINALE: 'eds-svt-terminale' },
  SES: { PREMIERE: 'eds-ses-premiere', TERMINALE: 'eds-ses-terminale' },
};

/**
 * `enrollments: null` means "not applicable" (no studentId — the caller
 * should pass null rather than fetching anything when profil.studentId is
 * unset). `enrollments: []` means "we looked, the Student genuinely has
 * zero enrollments" — a real, flaggable inconsistency, distinct from null.
 */
export function checkAcademicMapConsistency(
  profil: ProfilCandidatInput,
  enrollments: readonly EnrollmentFact[] | null,
): AcademicMapCrossCheckResult {
  if (enrollments === null) {
    return { status: 'NOT_APPLICABLE', issues: [], requiresHumanReview: false };
  }

  if (enrollments.length === 0) {
    return {
      status: 'MISSING_ACADEMIC_MAP',
      issues: ['Le candidat est lié à un élève Nexus, mais aucun enseignement suivi n\'est enregistré dans la carte académique.'],
      requiresHumanReview: true,
    };
  }

  const specialtyEnrollments = enrollments.filter((e) => e.kind === 'SPECIALTY');
  const sameLevelSpecialties = specialtyEnrollments.filter((e) => e.gradeLevel === profil.level);

  if (sameLevelSpecialties.length === 0) {
    return {
      status: 'STALE_ENROLLMENT',
      issues: [
        `Le profil déclare le niveau ${profil.level}, mais la carte académique ne porte aucune spécialité pour ce niveau (inscriptions existantes à un autre niveau).`,
      ],
      requiresHumanReview: true,
    };
  }

  const expectedKeys = [profil.specialite1, profil.specialite2]
    .map((subject) => SPECIALTY_COURSE_KEY_BY_SUBJECT_AND_LEVEL[subject]?.[profil.level])
    .filter((key): key is string => key != null);

  const actualKeys = new Set(sameLevelSpecialties.map((e) => e.courseKey));
  const issues: string[] = [];
  for (const expected of expectedKeys) {
    if (!actualKeys.has(expected)) {
      issues.push(`Spécialité déclarée dans le profil (${expected}) absente de la carte académique.`);
    }
  }

  if (issues.length > 0) {
    return { status: 'INCOMPATIBLE', issues, requiresHumanReview: true };
  }

  return { status: 'COMPATIBLE', issues: [], requiresHumanReview: false };
}
