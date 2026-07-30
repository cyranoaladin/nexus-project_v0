import type { AssessmentDefinition } from '@/lib/pre-rentree/pedagogy';

import { AssessmentEngineError } from './errors';
import { sha256 } from './hash';
import type { CanonicalScore } from './scoring';

export const REPORT_TEMPLATE_VERSION = 'canonical-bilan-template-v1';

export type EngineReportAudience = 'STUDENT' | 'PARENT' | 'NEXUS';

export type DeterministicReport = Readonly<{
  status: 'FINAL';
  audience: EngineReportAudience;
  templateVersion: typeof REPORT_TEMPLATE_VERSION;
  definitionRef: AssessmentDefinition['ref'];
  scoringPolicy: CanonicalScore['policy'];
  contextChecksum: `sha256:${string}`;
  content: Readonly<{
    score: Readonly<{
      points: number;
      maxPoints: number;
      percentage: number | null;
    }>;
    calibrationStatus: CanonicalScore['calibrationStatus'];
    competencies: readonly Readonly<{
      nodeId: string;
      target: string;
      points: number;
      maxPoints: number;
      status: 'ACQUIRED' | 'TO_CONSOLIDATE' | 'NOT_MEASURED';
    }>[];
    publishableComments?: readonly string[];
    internal?: Readonly<{
      items: CanonicalScore['items'];
      internalComments: readonly string[];
    }>;
  }>;
}>;

export function buildDeterministicReport(input: Readonly<{
  audience: EngineReportAudience;
  definition: AssessmentDefinition;
  score: CanonicalScore;
}>): DeterministicReport {
  if (input.score.resultKind !== 'FINAL') {
    throw new AssessmentEngineError('FINAL_SCORE_REQUIRED');
  }
  if (
    input.score.definitionRef.definitionId !== input.definition.ref.definitionId
    || input.score.definitionRef.version !== input.definition.ref.version
    || input.score.definitionRef.sha256 !== input.definition.ref.sha256
  ) {
    throw new AssessmentEngineError('CATALOG_REFERENCE_MISMATCH');
  }

  const nodes = new Map(input.definition.nodes.map((node) => [node.id, node]));
  const competencies = input.score.nodes.map((nodeScore) => {
    const node = nodes.get(nodeScore.nodeId);
    if (!node) throw new AssessmentEngineError('CATALOG_REFERENCE_MISMATCH');
    const status = nodeScore.maxPoints === 0
      ? 'NOT_MEASURED'
      : nodeScore.points === nodeScore.maxPoints
        ? 'ACQUIRED'
        : 'TO_CONSOLIDATE';
    return {
      nodeId: nodeScore.nodeId,
      target: node.targetUse,
      points: nodeScore.points,
      maxPoints: nodeScore.maxPoints,
      status,
    } as const;
  });
  const publishableComments = input.score.items
    .map(({ publishableComment }) => publishableComment)
    .filter((comment): comment is string => Boolean(comment));
  const internalComments = input.score.items
    .map(({ internalComment }) => internalComment)
    .filter((comment): comment is string => Boolean(comment));
  const publicContent = {
    score: {
      points: input.score.score,
      maxPoints: input.score.maxScore,
      percentage: input.score.maxScore === 0
        ? null
        : Math.round((input.score.score / input.score.maxScore) * 10_000) / 100,
    },
    calibrationStatus: input.score.calibrationStatus,
    competencies,
  };
  const content = input.audience === 'NEXUS'
    ? {
      ...publicContent,
      publishableComments,
      internal: {
        items: input.score.items,
        internalComments,
      },
    }
    : input.audience === 'PARENT'
      ? { ...publicContent, publishableComments }
      : publicContent;
  const context = {
    audience: input.audience,
    content,
    definitionRef: input.definition.ref,
    scoringPolicy: input.score.policy,
    templateVersion: REPORT_TEMPLATE_VERSION,
  };

  return {
    status: 'FINAL',
    audience: input.audience,
    templateVersion: REPORT_TEMPLATE_VERSION,
    definitionRef: input.definition.ref,
    scoringPolicy: input.score.policy,
    contextChecksum: sha256(context),
    content,
  };
}
