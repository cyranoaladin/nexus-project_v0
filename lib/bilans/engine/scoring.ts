import type { AssessmentDefinition } from '@/lib/pre-rentree/pedagogy';

import { AssessmentEngineError } from './errors';
import { sha256 } from './hash';

export const SCORING_POLICY = Object.freeze({
  id: 'canonical-raw-item-score',
  version: '1.0.0',
  checksum: sha256({
    id: 'canonical-raw-item-score',
    itemMaximum: 1,
    manualMaximum: 1,
    technicalInvalidExcluded: true,
    version: '1.0.0',
  }),
});

export type ScoringResponse = Readonly<{
  itemId: string;
  responseType: 'AUTOMATIC_QCM' | 'MANUAL_SHORT_RESPONSE';
  selectedOptionIndex: number | null;
  textValue: string | null;
}>;

export type ScoringManualDecision = Readonly<{
  itemId: string;
  awardedPoints: number;
  maxPoints: number;
  decisionVersion: number;
  internalComment?: string;
  publishableComment?: string;
}>;

export type ScoredItemOutcome =
  | 'AUTOMATIC_CORRECT'
  | 'INCORRECT'
  | 'UNANSWERED'
  | 'PENDING_MANUAL_REVIEW'
  | 'MANUAL_GRADED'
  | 'TECHNICALLY_INVALID';

export type ScoredItem = Readonly<{
  itemId: string;
  nodeId: string;
  outcome: ScoredItemOutcome;
  points: number | null;
  maxPoints: number;
  manualDecisionVersion?: number;
  internalComment?: string;
  publishableComment?: string;
}>;

export type CanonicalScore = Readonly<{
  policy: typeof SCORING_POLICY;
  definitionRef: AssessmentDefinition['ref'];
  resultKind: 'PROVISIONAL' | 'FINAL';
  calibrationStatus: 'PENDING_POLICY_VALIDATION';
  score: number;
  maxScore: number;
  inputChecksum: `sha256:${string}`;
  items: readonly ScoredItem[];
  nodes: readonly Readonly<{
    nodeId: string;
    points: number;
    maxPoints: number;
    pendingManualCount: number;
    unansweredCount: number;
    technicallyInvalidCount: number;
  }>[];
}>;

type ComputeCanonicalScoreInput = Readonly<{
  definition: AssessmentDefinition;
  responses: readonly ScoringResponse[];
  manualDecisions: readonly ScoringManualDecision[];
  resultKind: 'PROVISIONAL' | 'FINAL';
  provisionalResultsEnabled: boolean;
}>;

function uniqueByItem<T extends Readonly<{ itemId: string }>>(
  values: readonly T[],
  errorCode: 'INVALID_RESPONSE' | 'INVALID_MANUAL_DECISION',
): ReadonlyMap<string, T> {
  const result = new Map<string, T>();
  for (const value of values) {
    if (result.has(value.itemId)) throw new AssessmentEngineError(errorCode);
    result.set(value.itemId, value);
  }
  return result;
}

function scoreItem(
  item: AssessmentDefinition['items'][number],
  response: ScoringResponse | undefined,
  manualDecision: ScoringManualDecision | undefined,
): ScoredItem {
  if (!response) {
    if (manualDecision) throw new AssessmentEngineError('INVALID_MANUAL_DECISION');
    return {
      itemId: item.id,
      nodeId: item.nodeId,
      outcome: 'UNANSWERED',
      points: 0,
      maxPoints: 1,
    };
  }
  if (response.responseType !== item.responseMode) {
    throw new AssessmentEngineError('INVALID_RESPONSE');
  }

  if (item.responseMode === 'AUTOMATIC_QCM') {
    if (
      response.textValue !== null
      || !Number.isInteger(response.selectedOptionIndex)
      || !item.options
      || response.selectedOptionIndex === null
      || !item.options[response.selectedOptionIndex]
    ) {
      return {
        itemId: item.id,
        nodeId: item.nodeId,
        outcome: 'TECHNICALLY_INVALID',
        points: null,
        maxPoints: 0,
      };
    }
    const correct = item.options[response.selectedOptionIndex].correct;
    return {
      itemId: item.id,
      nodeId: item.nodeId,
      outcome: correct ? 'AUTOMATIC_CORRECT' : 'INCORRECT',
      points: correct ? 1 : 0,
      maxPoints: 1,
    };
  }

  if (
    response.selectedOptionIndex !== null
    || !response.textValue
    || response.textValue.length > (item.maxCharacters ?? 2_000)
  ) {
    throw new AssessmentEngineError('INVALID_RESPONSE');
  }
  if (!manualDecision) {
    return {
      itemId: item.id,
      nodeId: item.nodeId,
      outcome: 'PENDING_MANUAL_REVIEW',
      points: null,
      maxPoints: 1,
    };
  }
  if (
    manualDecision.maxPoints !== 1
    || !Number.isInteger(manualDecision.decisionVersion)
    || manualDecision.decisionVersion < 1
    || !Number.isFinite(manualDecision.awardedPoints)
    || manualDecision.awardedPoints < 0
    || manualDecision.awardedPoints > 1
  ) {
    throw new AssessmentEngineError('INVALID_MANUAL_DECISION');
  }
  return {
    itemId: item.id,
    nodeId: item.nodeId,
    outcome: 'MANUAL_GRADED',
    points: manualDecision.awardedPoints,
    maxPoints: 1,
    manualDecisionVersion: manualDecision.decisionVersion,
    internalComment: manualDecision.internalComment,
    publishableComment: manualDecision.publishableComment,
  };
}

export function computeCanonicalScore(
  input: ComputeCanonicalScoreInput,
): CanonicalScore {
  if (
    input.resultKind === 'PROVISIONAL'
    && !input.provisionalResultsEnabled
  ) {
    throw new AssessmentEngineError('PROVISIONAL_RESULTS_DISABLED');
  }

  const definitionItemIds = new Set(input.definition.items.map(({ id }) => id));
  if (
    input.responses.some(({ itemId }) => !definitionItemIds.has(itemId))
    || input.manualDecisions.some(({ itemId }) => !definitionItemIds.has(itemId))
  ) {
    throw new AssessmentEngineError('ITEM_NOT_IN_DEFINITION');
  }
  const responses = uniqueByItem(input.responses, 'INVALID_RESPONSE');
  const decisions = uniqueByItem(
    input.manualDecisions,
    'INVALID_MANUAL_DECISION',
  );
  const items = input.definition.items.map((item) => scoreItem(
      item,
      responses.get(item.id),
      decisions.get(item.id),
    ));
  if (
    input.resultKind === 'FINAL'
    && items.some(({ outcome }) => outcome === 'PENDING_MANUAL_REVIEW')
  ) {
    throw new AssessmentEngineError('MANUAL_REVIEW_REQUIRED');
  }

  const nodes = [...input.definition.nodes]
    .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
    .map((node) => {
      const nodeItems = items.filter(({ nodeId }) => nodeId === node.id);
      return {
        nodeId: node.id,
        points: nodeItems.reduce((total, item) => total + (item.points ?? 0), 0),
        maxPoints: nodeItems.reduce((total, item) => total + item.maxPoints, 0),
        pendingManualCount: nodeItems.filter(
          ({ outcome }) => outcome === 'PENDING_MANUAL_REVIEW',
        ).length,
        unansweredCount: nodeItems.filter(
          ({ outcome }) => outcome === 'UNANSWERED',
        ).length,
        technicallyInvalidCount: nodeItems.filter(
          ({ outcome }) => outcome === 'TECHNICALLY_INVALID',
        ).length,
      };
    });
  const score = items.reduce((total, item) => total + (item.points ?? 0), 0);
  const maxScore = items.reduce((total, item) => total + item.maxPoints, 0);
  const checksumInput = {
    definitionRef: input.definition.ref,
    decisions: [...input.manualDecisions].sort(
      (left, right) => left.itemId.localeCompare(right.itemId),
    ),
    policy: SCORING_POLICY,
    responses: [...input.responses].sort(
      (left, right) => left.itemId.localeCompare(right.itemId),
    ),
    resultKind: input.resultKind,
  };

  return {
    policy: SCORING_POLICY,
    definitionRef: input.definition.ref,
    resultKind: input.resultKind,
    calibrationStatus: 'PENDING_POLICY_VALIDATION',
    score,
    maxScore,
    inputChecksum: sha256(checksumInput),
    items,
    nodes,
  };
}
