import type {
  AssessmentDefinition,
  FinalizationOperation,
  ManualGrade,
  ManualGradingReadiness,
} from './types';

export class InvalidManualGradeError extends Error {
  readonly code = 'INVALID_MANUAL_GRADE';

  constructor() {
    super('INVALID_MANUAL_GRADE');
    this.name = 'InvalidManualGradeError';
  }
}

export class ManualGradingRequiredError extends Error {
  readonly code = 'EN_ATTENTE_CORRECTION_MANUELLE';

  constructor(
    public readonly operation: FinalizationOperation,
    public readonly pendingItemIds: readonly string[],
  ) {
    super('EN_ATTENTE_CORRECTION_MANUELLE');
    this.name = 'ManualGradingRequiredError';
  }
}

function isValidIsoInstant(value: string): boolean {
  return Number.isFinite(Date.parse(value)) && value.includes('T');
}

export function evaluateManualGrading(
  assessment: AssessmentDefinition,
  grades: readonly ManualGrade[],
): ManualGradingReadiness {
  const manualItemIds = assessment.items
    .filter(({ responseMode }) => responseMode === 'MANUAL_SHORT_RESPONSE')
    .map(({ id }) => id);
  const manualItems = new Set(manualItemIds);
  const gradedItems = new Set<string>();

  for (const grade of grades) {
    const valid = manualItems.has(grade.itemId)
      && !gradedItems.has(grade.itemId)
      && Number.isFinite(grade.awardedPoints)
      && Number.isFinite(grade.maxPoints)
      && grade.maxPoints > 0
      && grade.awardedPoints >= 0
      && grade.awardedPoints <= grade.maxPoints
      && grade.reviewedBy.trim().length > 0
      && isValidIsoInstant(grade.reviewedAt);
    if (!valid) throw new InvalidManualGradeError();
    gradedItems.add(grade.itemId);
  }

  const pendingManualItemIds = manualItemIds.filter((id) => !gradedItems.has(id));
  const readiness: ManualGradingReadiness = {
    workflowStatus: pendingManualItemIds.length
      ? 'EN_ATTENTE_CORRECTION_MANUELLE'
      : 'CORRIGE',
    pendingManualItemIds,
    manuallyGradedItemIds: manualItemIds.filter((id) => gradedItems.has(id)),
    automaticallyScorableItemIds: assessment.items
      .filter(({ responseMode }) => responseMode === 'AUTOMATIC_QCM')
      .map(({ id }) => id),
  };

  Object.freeze(readiness.pendingManualItemIds);
  Object.freeze(readiness.manuallyGradedItemIds);
  Object.freeze(readiness.automaticallyScorableItemIds);
  return Object.freeze(readiness);
}

export function assertFinalizationAllowed(
  readiness: ManualGradingReadiness,
  operation: FinalizationOperation,
): void {
  if (readiness.workflowStatus === 'EN_ATTENTE_CORRECTION_MANUELLE') {
    throw new ManualGradingRequiredError(operation, readiness.pendingManualItemIds);
  }
}
