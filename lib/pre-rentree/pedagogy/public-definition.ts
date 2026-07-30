import type {
  AssessmentDefinition,
  PublicAssessmentDefinition,
  PublicAssessmentItem,
} from './types';

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
}

/**
 * Creates the only assessment shape that may cross the student or parent API
 * boundary. Correctness, rationales, obstacles and manual grading material are
 * intentionally not represented by this type.
 */
export function createPublicAssessmentDefinition(
  assessment: AssessmentDefinition,
): PublicAssessmentDefinition {
  const items: PublicAssessmentItem[] = assessment.items.map((item) => ({
    id: item.id,
    nodeId: item.nodeId,
    tier: item.tier,
    prompt: item.prompt,
    responseMode: item.responseMode,
    ...(item.responseMode === 'AUTOMATIC_QCM'
      ? {
        options: (item.options ?? []).map((option, index) => ({
          index,
          text: option.text,
        })),
      }
      : { maxCharacters: item.maxCharacters }),
  }));

  return deepFreeze({
    id: assessment.id,
    moduleId: assessment.moduleId,
    version: assessment.ref.version,
    sha256: assessment.ref.sha256,
    level: assessment.level,
    subject: assessment.subject,
    title: assessment.title,
    framing: assessment.framing,
    targetDurationMinutes: assessment.targetDurationMinutes,
    items,
  });
}
