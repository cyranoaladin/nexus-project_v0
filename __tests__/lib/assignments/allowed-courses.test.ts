/**
 * Périmètre de cours assignable — un candidat unique s'auto-résout, zéro ou
 * plusieurs candidats ne doivent JAMAIS produire un choix devinés.
 *
 * La fixture d'ambiguïté est réelle, pas synthétique : en Première voie
 * générale, `tc-maths-anticipees-premiere` (tronc commun, épreuve anticipée)
 * ET `eds-maths-premiere` (spécialité) portent tous deux
 * `legacySubject: MATHEMATIQUES` et sont simultanément suivis dès qu'un élève
 * choisit la spécialité maths (voir `data/curriculum/v1/courses.json`).
 */

import {
  allowedCourseKeysForSubject,
  classifyAssignmentCourseScope,
  classifyCandidates,
  coachCapableCourseKeys,
} from '@/lib/assignments/allowed-courses';
import { listFollowedCourses, resolveStudentCourses, type EnrollmentRecord } from '@/lib/curriculum/enrollment';

const PREMIERE_EDS = {
  gradeLevel: 'PREMIERE',
  academicTrack: 'EDS_GENERALE',
  stmgPathway: null,
};

function enrollment(courseKey: string, kind: EnrollmentRecord['kind'] = 'SPECIALTY'): EnrollmentRecord {
  return { courseKey, kind, source: 'ADMIN' };
}

function followedCoursesFor(enrollments: readonly EnrollmentRecord[]) {
  return listFollowedCourses(resolveStudentCourses(PREMIERE_EDS, enrollments));
}

describe('classifyCandidates', () => {
  it('résout un candidat unique en BACKFILL_AUTO', () => {
    expect(classifyCandidates(['tc-maths-anticipees-premiere'])).toEqual({
      state: 'BACKFILL_AUTO',
      courseKey: 'tc-maths-anticipees-premiere',
    });
  });

  it('ne devine rien quand il n’y a aucun candidat : BACKFILL_UNRESOLVED', () => {
    expect(classifyCandidates([])).toEqual({ state: 'BACKFILL_UNRESOLVED' });
  });

  it('ne devine rien quand plusieurs candidats existent : BACKFILL_AMBIGUOUS', () => {
    expect(classifyCandidates(['a', 'b'])).toEqual({
      state: 'BACKFILL_AMBIGUOUS',
      candidateCourseKeys: ['a', 'b'],
    });
  });
});

describe('coachCapableCourseKeys', () => {
  it('projette un ensemble de matières génériques en clés de cours du catalogue', () => {
    const capable = coachCapableCourseKeys(['MATHEMATIQUES']);
    expect(capable.has('tc-maths-anticipees-premiere')).toBe(true);
    expect(capable.has('eds-maths-premiere')).toBe(true);
    expect(capable.has('stmg-maths-premiere')).toBe(true);
    expect(capable.has('eds-nsi-premiere')).toBe(false);
  });

  it('ne rend capable d’aucun cours quand le coach ne déclare rien', () => {
    expect(coachCapableCourseKeys([]).size).toBe(0);
  });
});

describe('allowedCourseKeysForSubject', () => {
  it('exactement un candidat: tronc commun maths seul quand la spécialité maths n’est pas choisie', () => {
    const followedCourses = followedCoursesFor([enrollment('eds-nsi-premiere')]);
    const candidates = allowedCourseKeysForSubject({
      followedCourses,
      subject: 'MATHEMATIQUES',
      coachSubjects: ['MATHEMATIQUES'],
    });
    expect(candidates).toEqual(['tc-maths-anticipees-premiere']);
  });

  it('zéro candidat: l’élève ne suit aucun cours de cette matière', () => {
    const followedCourses = followedCoursesFor([enrollment('eds-maths-premiere')]);
    const candidates = allowedCourseKeysForSubject({
      followedCourses,
      subject: 'NSI',
      coachSubjects: ['NSI'],
    });
    expect(candidates).toEqual([]);
  });

  it('zéro candidat: le coach n’est pas capable de la matière, même si l’élève suit un cours', () => {
    const followedCourses = followedCoursesFor([enrollment('eds-nsi-premiere')]);
    const candidates = allowedCourseKeysForSubject({
      followedCourses,
      subject: 'MATHEMATIQUES',
      coachSubjects: [],
    });
    expect(candidates).toEqual([]);
  });

  it('plusieurs candidats — fixture réelle Première tronc commun + spécialité maths', () => {
    const followedCourses = followedCoursesFor([enrollment('eds-maths-premiere')]);
    const candidates = allowedCourseKeysForSubject({
      followedCourses,
      subject: 'MATHEMATIQUES',
      coachSubjects: ['MATHEMATIQUES'],
    });
    expect(candidates).toEqual(['eds-maths-premiere', 'tc-maths-anticipees-premiere']);
  });
});

describe('classifyAssignmentCourseScope', () => {
  it('BACKFILL_AUTO quand toutes les matières résolvent à un candidat unique, clés fusionnées', () => {
    const followedCourses = followedCoursesFor([enrollment('eds-nsi-premiere')]);
    const result = classifyAssignmentCourseScope({
      subjects: ['FRANCAIS', 'NSI'],
      followedCourses,
      coachSubjects: ['FRANCAIS', 'NSI'],
    });
    expect(result.state).toBe('BACKFILL_AUTO');
    expect(result.academicCourseKeys).toEqual(['eds-nsi-premiere', 'tc-francais-premiere']);
  });

  it('BACKFILL_AMBIGUOUS dès qu’une seule matière est ambiguë, aucune clé écrite', () => {
    const followedCourses = followedCoursesFor([enrollment('eds-maths-premiere')]);
    const result = classifyAssignmentCourseScope({
      subjects: ['FRANCAIS', 'MATHEMATIQUES'],
      followedCourses,
      coachSubjects: ['FRANCAIS', 'MATHEMATIQUES'],
    });
    expect(result.state).toBe('BACKFILL_AMBIGUOUS');
    expect(result.academicCourseKeys).toEqual([]);
  });

  it('BACKFILL_UNRESOLVED dès qu’une seule matière est sans candidat, aucune clé écrite', () => {
    const followedCourses = followedCoursesFor([enrollment('eds-maths-premiere')]);
    const result = classifyAssignmentCourseScope({
      subjects: ['FRANCAIS', 'SES'],
      followedCourses,
      coachSubjects: ['FRANCAIS', 'SES'],
    });
    expect(result.state).toBe('BACKFILL_UNRESOLVED');
    expect(result.academicCourseKeys).toEqual([]);
  });

  it('BACKFILL_UNRESOLVED quand l’assignation ne porte aucune matière historique', () => {
    const result = classifyAssignmentCourseScope({
      subjects: [],
      followedCourses: [],
      coachSubjects: ['MATHEMATIQUES'],
    });
    expect(result.state).toBe('BACKFILL_UNRESOLVED');
    expect(result.academicCourseKeys).toEqual([]);
  });

  it('AMBIGUOUS l’emporte même mélangé à des matières AUTO', () => {
    const followedCourses = followedCoursesFor([enrollment('eds-maths-premiere'), enrollment('eds-nsi-premiere')]);
    const result = classifyAssignmentCourseScope({
      subjects: ['NSI', 'MATHEMATIQUES'],
      followedCourses,
      coachSubjects: ['NSI', 'MATHEMATIQUES'],
    });
    expect(result.state).toBe('BACKFILL_AMBIGUOUS');
  });
});
