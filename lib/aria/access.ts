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
 *    - selectedForAria (sélection cockpit de l'élève)
 * 2. Aucune assimilation arbitraire (ex: non-NSI -> aria_maths supprimé).
 * 3. Seule fonction décidant de l'état d'un cours pour l'UI.
 */

import type {
  AcademicEnrollmentKind,
  AcademicEnrollmentSource,
  AcademicTrack,
  GradeLevel,
  StmgPathway,
  Subject,
} from '@prisma/client';
import { getCourse } from '@/lib/curriculum/catalog';
import { resolveStudentCourses } from '@/lib/curriculum/enrollment';
import { getCourseCapabilities } from './curriculum';
import { listResourcesForCourse } from './resources';
import type {
  AriaCourseAccess,
  AriaCourseKey,
  AriaCourseStatus,
  AriaCourseSummary,
} from './contracts';

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

export interface StudentEntitlementContext {
  /** Liste des matières ouvertes par l'abonnement actif (ex: ['MATHEMATIQUES', 'NSI']) */
  readonly ariaSubjects?: readonly (Subject | string)[] | null;
  /** Droits directs sous forme de feature keys (ex: ['aria_maths', 'aria_nsi', 'aria_global']) */
  readonly featureKeys?: readonly string[];
  /** Accès global ARIA débloqué (admin, promo, ou pack global) */
  readonly hasGlobalAriaAccess?: boolean;
}

/**
 * Résout les droits d'accès pour un cours spécifique et un élève donné.
 */
export function resolveAriaCourseAccess(params: {
  courseKey: AriaCourseKey;
  student: StudentWithEnrollments;
  selectedCourseKeys?: readonly AriaCourseKey[];
  entitlements?: StudentEntitlementContext;
}): AriaCourseAccess {
  const { courseKey, student, selectedCourseKeys = [], entitlements } = params;

  // 1. Académiquement pertinent ?
  const academicResolution = resolveStudentCourses(
    {
      gradeLevel: student.gradeLevel,
      academicTrack: student.academicTrack,
      stmgPathway: student.stmgPathway ?? null,
    },
    student.academicEnrollments ?? []
  );
  const enrolledRecord = academicResolution.find((c) => c.course.courseKey === courseKey);
  const academicallyRelevant = Boolean(enrolledRecord && enrolledRecord.academicStatus !== 'NOT_ENROLLED');

  // 2. Produit supporté ?
  const capabilities = getCourseCapabilities(courseKey);
  const resourceCount = listResourcesForCourse(courseKey).length;
  const productSupported =
    capabilities.hasSkillGraph ||
    resourceCount > 0 ||
    capabilities.hasRagCorpus ||
    capabilities.hasChat;

  // 3. Commercialement autorisé ?
  const course = getCourse(courseKey);
  let commerciallyEntitled = false;

  if (entitlements?.hasGlobalAriaAccess || entitlements?.featureKeys?.includes('aria_global')) {
    commerciallyEntitled = true;
  } else if (course?.legacySubject) {
    const subj = course.legacySubject;
    // Correspondance par sujet
    if (entitlements?.ariaSubjects?.includes(subj)) {
      commerciallyEntitled = true;
    }
    // Correspondance par feature key explicite
    if (subj === 'MATHEMATIQUES' && entitlements?.featureKeys?.includes('aria_maths')) {
      commerciallyEntitled = true;
    }
    if (subj === 'NSI' && entitlements?.featureKeys?.includes('aria_nsi')) {
      commerciallyEntitled = true;
    }
  } else if (!course?.legacySubject && academicallyRelevant) {
    // Modules technologiques hors Subject (ex: SGN, Management STMG)
    // S'ils ne sont pas soumis à gating par matière, ou si feature key générale
    commerciallyEntitled = Boolean(
      entitlements?.hasGlobalAriaAccess ||
      entitlements?.featureKeys?.includes('aria_stmg') ||
      entitlements?.featureKeys?.includes('aria_global') ||
      // Par défaut, si l'élève est inscrit en STMG et dispose d'un abonnement actif
      (student.academicTrack === 'STMG' && (entitlements?.ariaSubjects?.length ?? 0) > 0)
    );
  }

  // 4. Sélectionné dans le cockpit ARIA ?
  const selectedForAria = selectedCourseKeys.includes(courseKey);

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
  } else if (!selectedForAria) {
    status = 'SETUP_REQUIRED';
  } else {
    status = 'AVAILABLE';
  }

  return {
    courseKey,
    academicallyRelevant,
    productSupported,
    commerciallyEntitled,
    selectedForAria,
    status,
    lockReason,
  };
}

/**
 * Résout le sommaire ARIA complet pour tous les cours pertinents d'un élève.
 */
export function resolveStudentAriaCourses(params: {
  student: StudentWithEnrollments;
  selectedCourseKeys?: readonly AriaCourseKey[];
  entitlements?: StudentEntitlementContext;
}): readonly AriaCourseSummary[] {
  const academicResolution = resolveStudentCourses(
    {
      gradeLevel: params.student.gradeLevel,
      academicTrack: params.student.academicTrack,
      stmgPathway: params.student.stmgPathway ?? null,
    },
    params.student.academicEnrollments ?? []
  );
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
      selectedCourseKeys: params.selectedCourseKeys,
      entitlements: params.entitlements,
    });

    results.push({
      courseKey: course.courseKey,
      label: course.label,
      longLabel: course.longLabel,
      gradeLevel: course.gradeLevel,
      tracks: course.tracks,
      kind: course.kind,
      legacySubject: course.legacySubject,
      capabilities: fullCapabilities,
      access,
    });
  }

  return results;
}
