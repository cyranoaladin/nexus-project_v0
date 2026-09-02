/**
 * ARIA Course Access Resolver.
 *
 * Résolveur canonique des droits d'accès aux cours ARIA.
 *
 * Invariants stricts :
 * 1. Les quatre dimensions restent strictement découplées :
 *    - academicallyRelevant (vérité scolaire SSoT)
 *    - productSupported (capacités Nexus ARIA)
 *    - commerciallyEntitled (abonnement / droits)
 *    - pinnedForAria (préférence cockpit sans effet sur l'accès)
 * 2. Aucune assimilation arbitraire (ex: non-NSI -> aria_maths supprimé).
 * 3. Seule fonction décidant de l'état d'un cours pour l'UI.
 */

import type {
  AcademicEnrollmentKind,
  AcademicEnrollmentSource,
  AcademicTrack,
  GradeLevel,
  StmgPathway,
} from '@prisma/client';
import { listCoursesFor } from '@/lib/curriculum/catalog';
import { resolveStudentCourses } from '@/lib/curriculum/enrollment';
import { getCourseCapabilities } from './curriculum';
import { listResourcesForCourse } from './resources';
import type {
  AriaCourseAccess,
  AriaCourseKey,
  AriaCourseStatus,
  AriaCourseSummary,
} from './contracts';
import type { CanonicalAriaEntitlementContext } from './kernel/entitlements';
import { AriaError } from './kernel/errors';

export type {
  AriaCourseAccess,
  AriaCourseKey,
  AriaCourseStatus,
  AriaCourseSummary,
};

export interface StudentWithEnrollments {
  readonly id: string;
  readonly gradeLevel: GradeLevel;
  readonly academicTrack: AcademicTrack;
  readonly stmgPathway?: StmgPathway | null;
  readonly academicEnrollments?: readonly {
    readonly courseKey: string;
    readonly kind: AcademicEnrollmentKind;
    readonly source: AcademicEnrollmentSource;
  }[];
}

function resolveValidatedStudentCourses(student: StudentWithEnrollments) {
  const identity = {
    gradeLevel: student.gradeLevel,
    academicTrack: student.academicTrack,
    stmgPathway: student.stmgPathway ?? null,
  };
  const enrollments = student.academicEnrollments ?? [];
  const applicableCourseKeys = new Set(listCoursesFor({
    gradeLevel: identity.gradeLevel,
    track: identity.academicTrack,
    stmgPathway: identity.stmgPathway,
  }).map(({ courseKey }) => courseKey));
  if (enrollments.some(({ courseKey }) => !applicableCourseKeys.has(courseKey))) {
    throw new AriaError(
      'INTERNAL_ERROR',
      500,
      'La carte scolaire ARIA active est incohérente.',
      { reasonCode: 'ACADEMIC_ENROLLMENT_OUTSIDE_CURRENT_MAP' },
    );
  }
  return resolveStudentCourses(identity, enrollments);
}

export function listStudentAcademicCourseKeys(
  student: StudentWithEnrollments,
): readonly AriaCourseKey[] {
  return resolveValidatedStudentCourses(student)
    .filter(({ academicStatus }) => academicStatus !== 'NOT_ENROLLED')
    .map(({ course }) => course.courseKey);
}

/**
 * Résout les droits d'accès pour un cours spécifique et un élève donné.
 */
export function resolveAriaCourseAccess(params: {
  courseKey: AriaCourseKey;
  student: StudentWithEnrollments;
  pinnedCourseKeys?: readonly AriaCourseKey[];
  entitlements?: CanonicalAriaEntitlementContext;
}): AriaCourseAccess {
  const { courseKey, student, pinnedCourseKeys = [], entitlements } = params;

  // 1. Académiquement pertinent ?
  const enrolledCourses = resolveValidatedStudentCourses(student);

  const matchingEnrolled = enrolledCourses.find((e) => e.course.courseKey === courseKey);
  const academicallyRelevant = Boolean(
    matchingEnrolled && matchingEnrolled.academicStatus !== 'NOT_ENROLLED'
  );

  // 2. Produit supporté par ARIA ?
  const capabilities = getCourseCapabilities(courseKey);
  const resourceCount = listResourcesForCourse(courseKey).length;
  const productSupported =
    capabilities.hasSkillGraph ||
    resourceCount > 0 ||
    capabilities.hasRagCorpus ||
    capabilities.hasChat;

  // 3. Commercialement autorisé ? (Strictement sans heuristique implicite)
  const commerciallyEntitled = Boolean(
    entitlements?.hasGenericAccess
    && (entitlements.hasGlobalAccess || entitlements.courseKeys.includes(courseKey)),
  );

  // 4. Sélectionné dans le cockpit ARIA ?
  const pinnedForAria = pinnedCourseKeys.includes(courseKey);

  // Déduction du statut
  let status: AriaCourseStatus;
  let lockReason: 'NOT_ENTITLED' | 'UNSUPPORTED' | 'NOT_ENROLLED' | undefined;

  if (!academicallyRelevant) {
    status = 'UNSUPPORTED';
    lockReason = 'NOT_ENROLLED';
  } else if (!productSupported) {
    status = 'UNSUPPORTED';
    lockReason = 'UNSUPPORTED';
  } else if (!commerciallyEntitled) {
    status = 'LOCKED';
    lockReason = 'NOT_ENTITLED';
  } else {
    status = 'AVAILABLE';
  }

  return {
    courseKey,
    academicallyRelevant,
    productSupported,
    commerciallyEntitled,
    pinnedForAria,
    status,
    lockReason,
  };
}

/**
 * Résout le sommaire ARIA complet pour tous les cours pertinents d'un élève.
 */
export function resolveStudentAriaCourses(params: {
  student: StudentWithEnrollments;
  pinnedCourseKeys?: readonly AriaCourseKey[];
  entitlements?: CanonicalAriaEntitlementContext;
}): readonly AriaCourseSummary[] {
  const academicResolution = resolveValidatedStudentCourses(params.student);
  const results: AriaCourseSummary[] = [];

  for (const enrolled of academicResolution) {
    if (enrolled.academicStatus === 'NOT_ENROLLED') continue;

    const course = enrolled.course;

    const capabilities = getCourseCapabilities(course.courseKey);
    const resources = listResourcesForCourse(course.courseKey);
    const fullCapabilities = {
      ...capabilities,
      resourceCount: resources.length,
      hasResources: resources.length > 0,
    };

    const access = resolveAriaCourseAccess({
      courseKey: course.courseKey,
      student: params.student,
      pinnedCourseKeys: params.pinnedCourseKeys,
      entitlements: params.entitlements,
    });

    results.push({
      courseKey: course.courseKey,
      label: course.label,
      longLabel: course.longLabel,
      gradeLevel: course.gradeLevel,
      tracks: course.tracks,
      kind: course.kind,
      capabilities: fullCapabilities,
      access,
    });
  }

  return results;
}
