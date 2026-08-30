import type { Subject } from '@prisma/client';
import { getCourse, listCourses } from '@/lib/curriculum/catalog';
import { listResourcesForCourse } from './resources';
import type { AriaCourseCapabilities, AriaCourseKey } from './contracts';
import { getAriaCourseCapabilityDeclaration } from './manifests/course-capabilities';
import { getAriaRagCorpusCapability } from './infrastructure/rag/manifest';

export function getCourseCapabilities(courseKey: AriaCourseKey): AriaCourseCapabilities {
  const course = getCourse(courseKey);
  const declaration = getAriaCourseCapabilityDeclaration(courseKey);
  if (!course || !declaration) {
    return {
      hasSkillGraph: false,
      hasResources: false,
      hasRagCorpus: false,
      hasChat: false,
      hasAssessmentContext: false,
      generalChatAllowed: false,
      skillGraphRef: null,
      resourceCount: 0,
    };
  }

  const ragCapability = getAriaRagCorpusCapability(courseKey);
  const resourceCount = listResourcesForCourse(courseKey).length;
  const generalChatAllowed = declaration.chat?.policy === 'GENERAL_CHAT';
  const hasRagCorpus = ragCapability.status === 'AVAILABLE';
  return {
    hasSkillGraph: declaration.skillGraphRef !== null,
    hasResources: resourceCount > 0,
    hasRagCorpus,
    hasChat: hasRagCorpus || generalChatAllowed,
    hasAssessmentContext: declaration.hasAssessmentContext,
    generalChatAllowed,
    skillGraphRef: declaration.skillGraphRef,
    resourceCount,
  };
}

const SUBJECT_CANONICAL_LABELS: Readonly<Record<Subject, string>> = Object.freeze({
  MATHEMATIQUES: 'Mathématiques',
  MATHS_EXPERTES: 'Mathématiques Expertes',
  PHYSIQUE_CHIMIE: 'Physique-Chimie',
  SVT: 'Sciences de la Vie et de la Terre',
  NSI: 'Numérique et Sciences Informatiques',
  FRANCAIS: 'Français',
  PHILOSOPHIE: 'Philosophie',
  HISTOIRE_GEO: 'Histoire-Géographie',
  ANGLAIS: 'Anglais',
  ESPAGNOL: 'Espagnol',
  SES: 'Sciences Économiques et Sociales',
});

export function getSubjectDisplayName(subject: Subject): string {
  return SUBJECT_CANONICAL_LABELS[subject] ?? subject;
}

export function getCourseDisplayName(courseKey: string): string {
  const course = getCourse(courseKey);
  return course ? course.label : courseKey;
}

export { listCourses, isKnownCourseKey } from '@/lib/curriculum/catalog';

export function listSupportedAriaCourses(): readonly AriaCourseKey[] {
  return listCourses()
    .map((course) => course.courseKey)
    .filter((courseKey) => {
      const capabilities = getCourseCapabilities(courseKey);
      return capabilities.hasChat || capabilities.hasSkillGraph || capabilities.hasResources;
    });
}
