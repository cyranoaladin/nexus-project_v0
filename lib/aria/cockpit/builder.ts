/**
 * ARIA Cockpit Payload Builder.
 *
 * Construit l'état complet du Cockpit ARIA pour un élève :
 * - Profil d'apprentissage
 * - Cours scolaires résolus avec droits d'accès 4D
 * - Graphe de compétences compilé pour le cours actif
 * - Ressources officielles vérifiées pour le cours actif
 * - Conversations récentes
 * - Métriques RAG réelles
 */

import { prisma } from '@/lib/prisma';
import { resolveStudentAriaCourses, type StudentWithEnrollments } from '@/lib/aria/access';
import { ensureDefaultProfile } from '@/lib/aria/profile/service';
import { getSkillGraph, type AriaSkillGraph } from '@/lib/aria/curriculum/skill-graph';
import { listResourcesForCourse } from '@/lib/aria/resources';
import { getCourseCapabilities } from '@/lib/aria/curriculum';
import type {
  AriaCourseSummary,
  AriaLearningProfileDTO,
  AriaResource,
  AriaCourseCapabilities,
} from '@/lib/aria/contracts';

export interface AriaCockpitPayload {
  readonly student: {
    readonly id: string;
    readonly gradeLevel: string;
    readonly academicTrack: string;
    readonly stmgPathway: string | null;
  };
  readonly profile: AriaLearningProfileDTO;
  readonly courses: readonly AriaCourseSummary[];
  readonly activeCourseKey: string | null;
  readonly activeCourseCapabilities: AriaCourseCapabilities | null;
  readonly activeSkillGraph: AriaSkillGraph | null;
  readonly activeResources: readonly AriaResource[];
  readonly recentConversations: readonly {
    readonly id: string;
    readonly title: string;
    readonly courseKey: string | null;
    readonly updatedAt: string;
    readonly messageCount: number;
  }[];
}

export type StudentForCockpit = StudentWithEnrollments & {
  readonly subscriptions?: readonly {
    readonly status?: string;
    readonly ariaSubjects?: unknown;
  }[];
};

export async function buildAriaCockpitPayload(params: {
  readonly student: StudentForCockpit;
  readonly requestedCourseKey?: string | null;
}): Promise<AriaCockpitPayload> {
  const { student, requestedCourseKey } = params;

  // 1. Profil par défaut ou existant
  const profile = await ensureDefaultProfile(student);

  // 2. Extraire les abonnements
  const activeSub = student.subscriptions?.[0];
  let ariaSubjects: string[] = [];
  if (activeSub?.ariaSubjects) {
    if (Array.isArray(activeSub.ariaSubjects)) {
      ariaSubjects = activeSub.ariaSubjects as string[];
    } else if (typeof activeSub.ariaSubjects === 'string') {
      try {
        const parsed = JSON.parse(activeSub.ariaSubjects);
        if (Array.isArray(parsed) && parsed.every((s) => typeof s === 'string')) {
          ariaSubjects = parsed;
        }
      } catch {
        ariaSubjects = [];
      }
    }
  }

  // 3. Résolution des cours de l'élève
  const courses = resolveStudentAriaCourses({
    student,
    selectedCourseKeys: profile.selectedCourseKeys,
    entitlements: {
      ariaSubjects,
      hasGlobalAriaAccess: ariaSubjects.includes('ALL'),
    },
  });

  // 4. Détermination du cours actif
  let activeCourseKey: string | null = null;

  if (requestedCourseKey && courses.some((c) => c.courseKey === requestedCourseKey)) {
    activeCourseKey = requestedCourseKey;
  } else if (
    profile.selectedCourseKeys.length > 0 &&
    courses.some((c) => c.courseKey === profile.selectedCourseKeys[0])
  ) {
    activeCourseKey = profile.selectedCourseKeys[0];
  } else {
    const firstAvailable = courses.find((c) => c.access.status === 'AVAILABLE');
    activeCourseKey = firstAvailable ? firstAvailable.courseKey : (courses[0]?.courseKey ?? null);
  }

  // 5. Données du cours actif
  const activeCourseCapabilities = activeCourseKey ? getCourseCapabilities(activeCourseKey) : null;
  const activeSkillGraph = activeCourseKey ? getSkillGraph(activeCourseKey) : null;
  const activeResources = activeCourseKey ? listResourcesForCourse(activeCourseKey) : [];

  // 6. Conversations récentes
  const conversations = await prisma.ariaConversation.findMany({
    where: {
      studentId: student.id,
      ...(activeCourseKey ? { courseKey: activeCourseKey } : {}),
    },
    include: {
      messages: {
        select: { id: true },
      },
    },
    orderBy: { updatedAt: 'desc' },
    take: 10,
  });

  const recentConversations = conversations.map((conv) => ({
    id: conv.id,
    title: conv.title || 'Conversation sans titre',
    courseKey: conv.courseKey,
    updatedAt: conv.updatedAt.toISOString(),
    messageCount: conv.messages.length,
  }));

  return {
    student: {
      id: student.id,
      gradeLevel: student.gradeLevel,
      academicTrack: student.academicTrack,
      stmgPathway: student.stmgPathway ?? null,
    },
    profile,
    courses,
    activeCourseKey,
    activeCourseCapabilities,
    activeSkillGraph,
    activeResources,
    recentConversations,
  };
}
