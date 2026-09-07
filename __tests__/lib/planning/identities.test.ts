/**
 * Invariants d'identité pédagogique d'une occurrence de planning : élève et
 * cours de sa carte scolaire, assignation active reliant exactement ce couple
 * élève/coach avec ce cours dans son périmètre résolu, capacité déclarée du
 * coach. Fonction PURE — aucun accès base, données déjà chargées.
 */

import {
  isAssignmentActiveAt,
  verifyPlanningIdentities,
  type PlanningAssignmentSnapshot,
  type PlanningIdentitySnapshot,
} from '@/lib/planning/identities';
import type { EnrollmentRecord } from '@/lib/curriculum/enrollment';

const PREMIERE_EDS = {
  gradeLevel: 'PREMIERE',
  academicTrack: 'EDS_GENERALE',
  stmgPathway: null,
};

// `eds-maths-premiere` (spécialité) exige une inscription réelle ;
// `tc-maths-anticipees-premiere` (tronc commun) est dérivé automatiquement.
const MATHS_SPECIALTY_ENROLLMENT: EnrollmentRecord = {
  courseKey: 'eds-maths-premiere',
  kind: 'SPECIALTY',
  source: 'ADMIN',
};

function activeAssignment(overrides: Partial<PlanningAssignmentSnapshot> = {}): PlanningAssignmentSnapshot {
  return {
    id: 'assignment-1',
    studentId: 'student-1',
    coachId: 'coach-1',
    status: 'ACTIVE',
    startsAt: new Date('2026-01-01T00:00:00Z'),
    endsAt: null,
    academicCourseKeys: ['eds-maths-premiere'],
    ...overrides,
  };
}

function baseSnapshot(overrides: Partial<PlanningIdentitySnapshot> = {}): PlanningIdentitySnapshot {
  return {
    occurrenceDate: new Date('2026-03-10T00:00:00Z'),
    studentProfileId: 'student-1',
    coachProfileId: 'coach-1',
    academicCourseKey: 'eds-maths-premiere',
    student: { id: 'student-1', identity: PREMIERE_EDS },
    studentEnrollments: [MATHS_SPECIALTY_ENROLLMENT],
    assignment: activeAssignment(),
    coachSubjects: ['MATHEMATIQUES'],
    ...overrides,
  };
}

describe('isAssignmentActiveAt', () => {
  const date = new Date('2026-03-10T00:00:00Z');

  it('est active quand ACTIVE, démarrée et sans fin', () => {
    expect(
      isAssignmentActiveAt({ status: 'ACTIVE', startsAt: new Date('2026-01-01'), endsAt: null }, date),
    ).toBe(true);
  });

  it("n'est pas active hors du statut ACTIVE", () => {
    expect(
      isAssignmentActiveAt({ status: 'ENDED', startsAt: new Date('2026-01-01'), endsAt: null }, date),
    ).toBe(false);
  });

  it("n'est pas active avant sa date de début", () => {
    expect(
      isAssignmentActiveAt({ status: 'ACTIVE', startsAt: new Date('2026-04-01'), endsAt: null }, date),
    ).toBe(false);
  });

  it('n\'est plus active après sa date de fin', () => {
    expect(
      isAssignmentActiveAt(
        { status: 'ACTIVE', startsAt: new Date('2026-01-01'), endsAt: new Date('2026-02-01') },
        date,
      ),
    ).toBe(false);
  });
});

describe('verifyPlanningIdentities', () => {
  it('ne renvoie aucun échec quand tout est cohérent', () => {
    expect(verifyPlanningIdentities(baseSnapshot())).toEqual([]);
  });

  it("échoue STUDENT_NOT_FOUND quand l'élève est introuvable", () => {
    const failures = verifyPlanningIdentities(baseSnapshot({ student: null }));
    expect(failures).toContainEqual(expect.objectContaining({ reason: 'STUDENT_NOT_FOUND' }));
  });

  it("échoue COURSE_NOT_IN_STUDENT_MAP quand le cours n'est pas suivi", () => {
    const failures = verifyPlanningIdentities(
      baseSnapshot({ academicCourseKey: 'eds-nsi-premiere', assignment: activeAssignment({ academicCourseKeys: ['eds-nsi-premiere'] }), coachSubjects: ['NSI'] }),
    );
    expect(failures).toContainEqual(expect.objectContaining({ reason: 'COURSE_NOT_IN_STUDENT_MAP' }));
  });

  it('un cours obligatoire (tronc commun) est considéré suivi sans inscription explicite', () => {
    const failures = verifyPlanningIdentities(
      baseSnapshot({
        academicCourseKey: 'tc-maths-anticipees-premiere',
        studentEnrollments: [],
        assignment: activeAssignment({ academicCourseKeys: ['tc-maths-anticipees-premiere'] }),
      }),
    );
    expect(failures.some((f) => f.reason === 'COURSE_NOT_IN_STUDENT_MAP')).toBe(false);
  });

  it('échoue ASSIGNMENT_NOT_FOUND quand l\'assignation est introuvable', () => {
    const failures = verifyPlanningIdentities(baseSnapshot({ assignment: null }));
    expect(failures).toContainEqual(expect.objectContaining({ reason: 'ASSIGNMENT_NOT_FOUND' }));
  });

  it("échoue ASSIGNMENT_PARTICIPANT_MISMATCH quand l'assignation ne relie pas ce couple élève/coach", () => {
    const failures = verifyPlanningIdentities(
      baseSnapshot({ assignment: activeAssignment({ studentId: 'un-autre-eleve' }) }),
    );
    expect(failures).toContainEqual(expect.objectContaining({ reason: 'ASSIGNMENT_PARTICIPANT_MISMATCH' }));
  });

  it("échoue ASSIGNMENT_NOT_ACTIVE quand l'assignation est ENDED à la date de l'occurrence", () => {
    const failures = verifyPlanningIdentities(
      baseSnapshot({ assignment: activeAssignment({ status: 'ENDED' }) }),
    );
    expect(failures).toContainEqual(expect.objectContaining({ reason: 'ASSIGNMENT_NOT_ACTIVE' }));
  });

  it('échoue ASSIGNMENT_COURSE_NOT_IN_SCOPE quand le cours ne figure pas dans le périmètre résolu', () => {
    const failures = verifyPlanningIdentities(
      baseSnapshot({ assignment: activeAssignment({ academicCourseKeys: [] }) }),
    );
    expect(failures).toContainEqual(expect.objectContaining({ reason: 'ASSIGNMENT_COURSE_NOT_IN_SCOPE' }));
  });

  it('une assignation BACKFILL_UNRESOLVED/AMBIGUOUS (academicCourseKeys vide) échoue sans cas particulier', () => {
    // classifyAssignmentCourseScope produit academicCourseKeys: [] pour ces
    // deux états — aucun code dédié n'est nécessaire ici, la vérification
    // `includes` échoue naturellement.
    const failures = verifyPlanningIdentities(
      baseSnapshot({ assignment: activeAssignment({ academicCourseKeys: [] }) }),
    );
    expect(failures.map((f) => f.reason)).toContain('ASSIGNMENT_COURSE_NOT_IN_SCOPE');
  });

  it('échoue COACH_CAPABILITY_MISSING quand le coach ne déclare pas la matière du cours', () => {
    const failures = verifyPlanningIdentities(baseSnapshot({ coachSubjects: ['NSI'] }));
    expect(failures).toContainEqual(expect.objectContaining({ reason: 'COACH_CAPABILITY_MISSING' }));
  });

  it('cumule plusieurs échecs indépendants au lieu de s\'arrêter au premier', () => {
    const failures = verifyPlanningIdentities(
      baseSnapshot({ student: null, coachSubjects: ['NSI'] }),
    );
    const reasons = failures.map((f) => f.reason);
    expect(reasons).toEqual(
      expect.arrayContaining(['STUDENT_NOT_FOUND', 'COACH_CAPABILITY_MISSING']),
    );
  });
});
