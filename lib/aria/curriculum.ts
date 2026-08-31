import { getCourse } from '@/lib/curriculum/catalog';
import { listResourcesForCourse } from './resources';
import type { AriaCourseCapabilities, AriaCourseKey } from './contracts';
import { getAriaCourseCapabilityDeclaration } from './manifests/course-capabilities';
import { getAriaRagCorpusCapability } from './infrastructure/rag/manifest';
import { isDisposableAriaRagIdentityConfigured } from './infrastructure/rag/disposable-academic-identity';

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
      chatPolicy: null,
      generalChatAllowed: false,
      skillGraphRef: null,
      resourceCount: 0,
    };
  }

  const ragCapability = getAriaRagCorpusCapability(courseKey);
  const resourceCount = listResourcesForCourse(courseKey).length;
  const generalChatAllowed = declaration.chat?.policy === 'GENERAL_CHAT';
  const hasRagCorpus = ragCapability.status === 'AVAILABLE';
  const hasGroundedChatRuntime = hasRagCorpus && isDisposableAriaRagIdentityConfigured();
  return {
    hasSkillGraph: declaration.skillGraphRef !== null,
    hasResources: resourceCount > 0,
    hasRagCorpus,
    hasChat: declaration.chat !== null && (generalChatAllowed || hasGroundedChatRuntime),
    hasAssessmentContext: declaration.hasAssessmentContext,
    chatPolicy: declaration.chat?.policy ?? null,
    generalChatAllowed,
    skillGraphRef: declaration.skillGraphRef,
    resourceCount,
  };
}

export { listCourses, isKnownCourseKey } from '@/lib/curriculum/catalog';
