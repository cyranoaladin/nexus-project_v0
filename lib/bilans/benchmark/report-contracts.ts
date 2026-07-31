import 'server-only';

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

import type { LocalFirstReportContext } from '@/lib/bilans/local-first/contracts';

const IdentifierSchema = z.string().regex(/^[a-z][a-z0-9:_-]{2,79}$/);
const EvidenceRefSchema = z.string().regex(/^ev:[a-z0-9:_-]{3,76}$/);
export const AI_ASSISTANCE_DISCLOSURE =
  'Synthèse générée avec assistance IA et revue par l’équipe pédagogique Nexus Réussite.';
function plainText(maximumLength: number) {
  return z.string().trim().min(2).max(maximumLength).superRefine(
    (value, context) => {
    const forbidden = [
      /<[^>]+>/u,
      /(?:^|\s)(?:#{1,6}|\*\*|__|```|\[[^\]]+\]\([^)]*\))/u,
      /\b(?:dyslexi(?:e|que)|tdah|trouble médical|diagnostic médical)\b/iu,
      /\b(?:note|réussite|mention)\s+(?:garantie|assurée|prévue)\b/iu,
      /\b(?:meilleur|moins bon|au-dessus|en dessous)\s+que\s+(?:les|ses)\s+(?:élèves|pairs)\b/iu,
    ];
    if (forbidden.some((pattern) => pattern.test(value))) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Narrative contains forbidden markup or claim.',
      });
    }
    },
  );
}

const NarrativeWithEvidenceSchema = z.object({
  competencyId: IdentifierSchema,
  title: plainText(120),
  explanation: plainText(800),
  evidenceRefs: z.array(EvidenceRefSchema).min(1).max(6),
}).strict();

const PriorityNarrativeSchema = NarrativeWithEvidenceSchema.extend({
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']),
}).strict();

const ActionPlanSchema = z.object({
  recommendationId: IdentifierSchema,
  title: plainText(120),
  rationale: plainText(800),
  actions: z.array(plainText(240)).min(1).max(5),
  cadence: plainText(120),
  durationWeeks: z.number().int().min(1).max(12),
  evidenceRefs: z.array(EvidenceRefSchema).min(1).max(6),
}).strict();

const UnmeasuredAreaSchema = z.object({
  competencyId: IdentifierSchema,
  title: plainText(120),
}).strict();

function reportDraftSchema<A extends 'PARENT' | 'STUDENT' | 'NEXUS'>(
  audience: A,
) {
  return z.object({
    schemaVersion: z.literal(
      `bilan-report-${audience.toLowerCase()}-draft-v1`,
    ),
    audience: z.literal(audience),
    title: plainText(160),
    summary: plainText(800),
    strengths: z.array(NarrativeWithEvidenceSchema).max(8),
    priorities: z.array(PriorityNarrativeSchema).max(8),
    actionPlan: z.array(ActionPlanSchema).max(8),
    unmeasuredAreas: z.array(UnmeasuredAreaSchema).max(12),
    cautionNotes: z.array(
      plainText(300),
    ).max(8),
    closingMessage: z.literal(AI_ASSISTANCE_DISCLOSURE),
    ...(audience === 'NEXUS'
      ? {
        internal: z.object({
          reviewFocus: z.array(
            plainText(300),
          ).max(8),
        }).strict(),
      }
      : {}),
  }).strict();
}

export const ParentReportDraftSchema = reportDraftSchema('PARENT');
export const StudentReportDraftSchema = reportDraftSchema('STUDENT');
export const NexusReportDraftSchema = reportDraftSchema('NEXUS');

export type ParentReportDraft = z.infer<typeof ParentReportDraftSchema>;

function finalReportSchema<A extends 'PARENT' | 'STUDENT' | 'NEXUS'>(
  audience: A,
  draft: ReturnType<typeof reportDraftSchema<A>>,
) {
  const shape = draft.shape;
  return z.object({
    ...shape,
    schemaVersion: z.literal(
      `bilan-report-${audience.toLowerCase()}-v1`,
    ),
    scoreEcho: z.object({
      points: z.number().int().nonnegative(),
      maxPoints: z.number().int().positive(),
      percentage: z.number().min(0).max(100),
      calibrationStatus: z.literal('FINAL'),
    }).strict(),
  }).strict();
}

export const ParentReportSchema = finalReportSchema(
  'PARENT',
  ParentReportDraftSchema,
);
export const StudentReportSchema = finalReportSchema(
  'STUDENT',
  StudentReportDraftSchema,
);
export const NexusReportSchema = finalReportSchema(
  'NEXUS',
  NexusReportDraftSchema,
);

export type ParentReport = z.infer<typeof ParentReportSchema>;

export type ParentLlmPayload = Readonly<{
  schemaVersion: 'bilan-parent-llm-input-v1';
  audience: 'PARENT';
  level: string;
  subject: string;
  competencies: LocalFirstReportContext['competencies'];
  evidence: LocalFirstReportContext['approvedEvidenceForLlm'];
  priorities: LocalFirstReportContext['priorities'];
  allowedRecommendations: LocalFirstReportContext['allowedRecommendations'];
  unmeasuredCompetencyIds: LocalFirstReportContext['unmeasuredCompetencyIds'];
}>;

function closedJsonSchema(schema: z.ZodTypeAny): Readonly<Record<string, unknown>> {
  const generated = zodToJsonSchema(schema, {
    $refStrategy: 'none',
  }) as Record<string, unknown>;
  delete generated.$schema;
  const unsupportedTransportKeywords = new Set([
    'minItems',
    'maxItems',
    'minLength',
    'maxLength',
    'pattern',
    'format',
    'minimum',
    'maximum',
  ]);
  const transportSubset = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(transportSubset);
    if (value === null || typeof value !== 'object') return value;
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !unsupportedTransportKeywords.has(key))
        .map(([key, nested]) => [key, transportSubset(nested)]),
    );
  };
  const value = transportSubset(generated);
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('REPORT_SCHEMA_INVALID');
  }
  return Object.freeze(value as Record<string, unknown>);
}

export const REPORT_PARENT_DRAFT_JSON_SCHEMA = closedJsonSchema(
  ParentReportDraftSchema,
);
export const REPORT_STUDENT_DRAFT_JSON_SCHEMA = closedJsonSchema(
  StudentReportDraftSchema,
);
export const REPORT_NEXUS_DRAFT_JSON_SCHEMA = closedJsonSchema(
  NexusReportDraftSchema,
);
export const REPORT_PARENT_JSON_SCHEMA = closedJsonSchema(ParentReportSchema);
export const REPORT_STUDENT_JSON_SCHEMA = closedJsonSchema(StudentReportSchema);
export const REPORT_NEXUS_JSON_SCHEMA = closedJsonSchema(NexusReportSchema);

function recordAt(
  value: unknown,
  label: string,
): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`REPORT_SCHEMA_INVALID:${label}`);
  }
  return value as Record<string, unknown>;
}

function arrayItemProperties(
  root: Record<string, unknown>,
  field: string,
): Readonly<{
  arraySchema: Record<string, unknown>;
  properties: Record<string, unknown>;
}> {
  const rootProperties = recordAt(root.properties, 'root.properties');
  const arraySchema = recordAt(rootProperties[field], field);
  const itemSchema = recordAt(arraySchema.items, `${field}.items`);
  return {
    arraySchema,
    properties: recordAt(itemSchema.properties, `${field}.properties`),
  };
}

function setEnum(
  properties: Record<string, unknown>,
  field: string,
  values: readonly string[],
): void {
  if (values.length === 0) return;
  recordAt(properties[field], field).enum = [...values];
}

export function buildGroundedParentDraftJsonSchema(
  context: LocalFirstReportContext,
): Readonly<Record<string, unknown>> {
  if (context.audience !== 'PARENT') {
    throw new Error('REPORT_AUDIENCE_MISMATCH');
  }
  const schema = JSON.parse(
    JSON.stringify(REPORT_PARENT_DRAFT_JSON_SCHEMA),
  ) as Record<string, unknown>;
  const evidenceRefs = context.approvedEvidenceForLlm.map(
    ({ evidenceRef }) => evidenceRef,
  );

  const mastered = context.competencies
    .filter(({ status }) => status === 'MASTERED')
    .map(({ competencyId }) => competencyId);
  const strength = arrayItemProperties(schema, 'strengths');
  setEnum(strength.properties, 'competencyId', mastered);
  const strengthEvidence = recordAt(
    strength.properties.evidenceRefs,
    'strengths.evidenceRefs',
  );
  setEnum(strengthEvidence, 'items', evidenceRefs);

  const priorities = arrayItemProperties(schema, 'priorities');
  setEnum(
    priorities.properties,
    'competencyId',
    context.priorities.map(({ competencyId }) => competencyId),
  );
  setEnum(
    priorities.properties,
    'priority',
    [...new Set(context.priorities.map(({ priority }) => priority))],
  );
  setEnum(
    recordAt(priorities.properties.evidenceRefs, 'priorities.evidenceRefs'),
    'items',
    evidenceRefs,
  );

  const actions = arrayItemProperties(schema, 'actionPlan');
  setEnum(
    actions.properties,
    'recommendationId',
    context.allowedRecommendations.map(
      ({ recommendationId }) => recommendationId,
    ),
  );
  setEnum(
    recordAt(actions.properties.evidenceRefs, 'actionPlan.evidenceRefs'),
    'items',
    evidenceRefs,
  );

  const unmeasured = arrayItemProperties(schema, 'unmeasuredAreas');
  setEnum(
    unmeasured.properties,
    'competencyId',
    context.unmeasuredCompetencyIds,
  );

  return Object.freeze(schema);
}

function duplicates(values: readonly string[]): boolean {
  return new Set(values).size !== values.length;
}

function assertGroundedDraft(
  context: LocalFirstReportContext,
  draft: ParentReportDraft,
): void {
  const competencyById = new Map(
    context.competencies.map((item) => [item.competencyId, item]),
  );
  const evidenceById = new Map(
    context.approvedEvidenceForLlm.map((item) => [item.evidenceRef, item]),
  );
  const priorityByCompetency = new Map(
    context.priorities.map((item) => [item.competencyId, item]),
  );
  const recommendationById = new Map(
    context.allowedRecommendations.map((item) => [
      item.recommendationId,
      item,
    ]),
  );
  const issue = (message: string): never => {
    throw new Error(`REPORT_GROUNDING_FAILURE: ${message}`);
  };
  const assertEvidence = (
    competencyId: string,
    evidenceRefs: readonly string[],
  ): void => {
    if (duplicates(evidenceRefs)) issue('DUPLICATE_EVIDENCE_REF');
    for (const evidenceRef of evidenceRefs) {
      if (evidenceById.get(evidenceRef)?.competencyId !== competencyId) {
        issue('CROSS_COMPETENCY_EVIDENCE_REF');
      }
    }
  };

  if (duplicates(draft.strengths.map(({ competencyId }) => competencyId))) {
    issue('DUPLICATE_STRENGTH_COMPETENCY');
  }
  if (duplicates(draft.priorities.map(({ competencyId }) => competencyId))) {
    issue('DUPLICATE_PRIORITY_COMPETENCY');
  }
  if (duplicates(
    draft.actionPlan.map(({ recommendationId }) => recommendationId),
  )) {
    issue('DUPLICATE_RECOMMENDATION');
  }

  for (const strength of draft.strengths) {
    if (competencyById.get(strength.competencyId)?.status !== 'MASTERED') {
      issue('INVALID_STRENGTH_COMPETENCY');
    }
    assertEvidence(strength.competencyId, strength.evidenceRefs);
  }
  for (const priority of draft.priorities) {
    const canonical = priorityByCompetency.get(priority.competencyId);
    if (
      canonical === undefined
      || canonical.priority !== priority.priority
      || competencyById.get(priority.competencyId)?.status === 'UNMEASURED'
    ) {
      issue('PRIORITY_CONTEXT_MISMATCH');
    }
    assertEvidence(priority.competencyId, priority.evidenceRefs);
  }
  for (const action of draft.actionPlan) {
    const canonical = recommendationById.get(action.recommendationId)
      ?? issue('RECOMMENDATION_NOT_ALLOWLISTED');
    assertEvidence(canonical.competencyId, action.evidenceRefs);
    if (
      action.evidenceRefs.some(
        (reference) => !canonical.evidenceRefs.includes(reference),
      )
    ) {
      issue('RECOMMENDATION_EVIDENCE_NOT_AUTHORIZED');
    }
  }
  const expectedUnmeasured = [...context.unmeasuredCompetencyIds].sort();
  const actualUnmeasured = draft.unmeasuredAreas
    .map(({ competencyId }) => competencyId)
    .sort();
  if (
    duplicates(actualUnmeasured)
    || JSON.stringify(actualUnmeasured) !== JSON.stringify(expectedUnmeasured)
  ) {
    issue('UNMEASURED_STATUS_MISMATCH');
  }
}

export function validateParentReportDraft(input: unknown): ParentReportDraft {
  return ParentReportDraftSchema.parse(input);
}

export function buildParentLlmPayload(
  context: LocalFirstReportContext,
): ParentLlmPayload {
  if (
    context.audience !== 'PARENT'
    || ['NOT_SCANNED', 'BLOCKED'].includes(context.piiScanResult.status)
    || context.llmApprovedInternalNotes !== undefined
  ) {
    throw new Error('REPORT_CONTEXT_NOT_TRANSPORT_SAFE');
  }
  return Object.freeze({
    schemaVersion: 'bilan-parent-llm-input-v1',
    audience: 'PARENT',
    level: context.level,
    subject: context.subject,
    competencies: context.competencies,
    evidence: context.approvedEvidenceForLlm,
    priorities: context.priorities,
    allowedRecommendations: context.allowedRecommendations,
    unmeasuredCompetencyIds: context.unmeasuredCompetencyIds,
  });
}

export function assembleGroundedParentReport(
  context: LocalFirstReportContext,
  draft: ParentReportDraft,
): ParentReport {
  if (context.audience !== 'PARENT') {
    throw new Error('REPORT_AUDIENCE_MISMATCH');
  }
  assertGroundedDraft(context, draft);
  return ParentReportSchema.parse({
    ...draft,
    schemaVersion: 'bilan-report-parent-v1',
    scoreEcho: context.scoreEcho,
  });
}
