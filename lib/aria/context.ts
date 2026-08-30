/**
 * ARIA Canonical Execution Context & Authorization Boundary.
 *
 * Invariants :
 * - ARIA_AUTHORIZATION_BOUNDARIES=1
 * - ARIA_ENTITLEMENT_CONTEXT_BUILDERS=1
 * - DIRECT_ORCHESTRATOR_ACCESS_BYPASS=0
 * - CROSS_COURSE_SKILL_CONTEXT=0
 * - CROSS_COURSE_RESOURCE_CONTEXT=0
 */

import { prisma } from '@/lib/prisma';
import { getCourse, isKnownCourseKey, type CourseRecord } from '@/lib/curriculum/catalog';
import {
  resolveAriaCourseAccess,
  type AriaCourseAccess,
  type StudentEntitlementContext,
  type StudentWithEnrollments,
} from './access';
import { getCourseCapabilities } from './curriculum';
import { getSkill } from './curriculum/skill-graph';
import { listResourcesForCourse } from './resources';
import { AriaError } from './errors';
import type { AriaCourseCapabilities, AriaCourseKey } from './contracts';

export interface AriaExecutionContext {
  readonly student: StudentWithEnrollments;
  readonly courseKey: AriaCourseKey;
  readonly course: CourseRecord;
  readonly skillId?: string;
  readonly resourceId?: string;
  readonly capabilities: AriaCourseCapabilities;
  readonly access: AriaCourseAccess;
  readonly entitlementContext: StudentEntitlementContext;
}

/**
 * Construit le contexte commercial canonique complet d'un élève à partir de ses abonnements réels.
 */
export function buildAriaEntitlementContext(student: StudentWithEnrollments): StudentEntitlementContext {
  const activeSub = student.subscriptions?.[0];
  let ariaSubjects: string[] = [];

  if (activeSub?.ariaSubjects) {
    if (Array.isArray(activeSub.ariaSubjects)) {
      ariaSubjects = activeSub.ariaSubjects as string[];
    } else if (typeof activeSub.ariaSubjects === 'string') {
      try {
        const parsed = JSON.parse(activeSub.ariaSubjects);
        if (Array.isArray(parsed) && parsed.every((s): s is string => typeof s === 'string')) {
          ariaSubjects = parsed;
        }
      } catch {
        ariaSubjects = [activeSub.ariaSubjects];
      }
    }
  }

  const hasGlobalAriaAccess = ariaSubjects.includes('ALL');
  const featureKeys: string[] = [];

  if (hasGlobalAriaAccess) {
    featureKeys.push('aria_global');
  }
  if (ariaSubjects.includes('MATHEMATIQUES')) {
    featureKeys.push('aria_maths');
  }
  if (ariaSubjects.includes('NSI')) {
    featureKeys.push('aria_nsi');
  }
  if (ariaSubjects.includes('STMG') || student.academicTrack === 'STMG') {
    if (ariaSubjects.includes('STMG') || hasGlobalAriaAccess) {
      featureKeys.push('aria_stmg');
    }
  }

  const courseKeys: string[] = [];
  for (const item of ariaSubjects) {
    if (isKnownCourseKey(item)) {
      courseKeys.push(item);
    }
  }

  return {
    ariaSubjects,
    featureKeys,
    courseKeys,
    hasGlobalAriaAccess,
  };
}

export interface ResolveExecutionContextParams {
  readonly studentId: string;
  readonly courseKey: string;
  readonly skillId?: string | null;
  readonly resourceId?: string | null;
  readonly studentOverride?: StudentWithEnrollments;
}

/**
 * Résout et autorise de manière immuable le contexte d'exécution ARIA.
 * Point unique d'autorisation pour tout appel à ARIA.
 */
export async function resolveAriaExecutionContext(
  params: ResolveExecutionContextParams
): Promise<AriaExecutionContext> {
  const { studentId, courseKey, skillId, resourceId, studentOverride } = params;

  // 1. Validation de l'existence du cours
  if (!isKnownCourseKey(courseKey)) {
    throw new AriaError('COURSE_NOT_FOUND', 400, `Le cours (${courseKey}) n'existe pas dans le catalogue.`);
  }

  const course = getCourse(courseKey);
  if (!course) {
    throw new AriaError('COURSE_NOT_FOUND', 400, `Le cours (${courseKey}) est introuvable.`);
  }

  // 2. Chargement de l'élève
  const student = studentOverride || (await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      academicEnrollments: true,
      subscriptions: {
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  }));

  if (!student) {
    throw new AriaError('NOT_ENROLLED', 404, 'Profil élève introuvable.');
  }

  // 3. Validation d'appartenance de la compétence (Cross-course skill rejection)
  if (skillId) {
    const skill = getSkill(courseKey, skillId);
    if (!skill) {
      throw new AriaError(
        'SKILL_MISMATCH',
        400,
        `La compétence (${skillId}) n'appartient pas au cours (${courseKey}).`
      );
    }
  }

  // 4. Validation d'appartenance de la ressource (Cross-course resource rejection)
  if (resourceId) {
    const availableResources = listResourcesForCourse(courseKey);
    const resourceMatch = availableResources.some((r) => r.id === resourceId);
    if (!resourceMatch) {
      throw new AriaError(
        'RESOURCE_MISMATCH',
        400,
        `La ressource (${resourceId}) n'appartient pas au cours (${courseKey}).`
      );
    }
  }

  // 5. Résolution des droits 4D (academicallyRelevant, productSupported, commerciallyEntitled)
  const entitlementContext = buildAriaEntitlementContext(student);
  const access = resolveAriaCourseAccess({
    courseKey,
    student,
    entitlements: entitlementContext,
  });

  if (!access.academicallyRelevant) {
    throw new AriaError(
      'NOT_ENROLLED',
      403,
      `Le cours (${courseKey}) ne fait pas partie de votre cursus scolaire inscrit.`
    );
  }

  if (!access.productSupported) {
    throw new AriaError(
      'UNSUPPORTED',
      422,
      `Le cours (${courseKey}) n'est pas encore supporté par ARIA.`
    );
  }

  if (!access.commerciallyEntitled) {
    throw new AriaError(
      'NOT_ENTITLED',
      403,
      'Accès ARIA non autorisé pour ce cours. Veuillez vérifier votre formule.'
    );
  }

  const capabilities = getCourseCapabilities(courseKey);

  return {
    student,
    courseKey,
    course,
    skillId: skillId || undefined,
    resourceId: resourceId || undefined,
    capabilities,
    access,
    entitlementContext,
  };
}
