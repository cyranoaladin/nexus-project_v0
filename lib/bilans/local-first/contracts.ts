import 'server-only';

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

import evidenceTemplateCatalog from '@/content/bilans/evidence-templates/catalog-v1.json';
import { sha256Canonical } from '@/lib/llm/openrouter/hash';

import { validateGrounding, resolveRecommendation } from './grounding';
import {
  PiiScanResultSchema,
  PiiStatusSchema,
  bindPiiScanResultToPayload,
  piiScanResultMatchesContent,
  scanPiiFields,
  validatePiiScanResultChecksum,
} from './pii';

const AudienceSchema = z.enum(['PARENT', 'STUDENT', 'NEXUS']);
const ComplexitySchema = z.enum(['SIMPLE', 'INTERMEDIATE', 'COMPLEX']);
const CoverageSchema = z.enum([
  'LOW_SCORE',
  'MEDIUM_SCORE',
  'HIGH_SCORE',
  'UNMEASURED_COMPETENCY',
  'MULTIPLE_EVIDENCE_REFS',
  'HIGH_PRIORITY',
  'SYNTHETIC_PROMPT_INJECTION',
  'SYNTHETIC_FALSE_PII',
  'APPARENT_EVIDENCE_CONTRADICTION',
  'NO_MAJOR_DIFFICULTY',
]);
const IdentifierSchema = z.string().regex(/^[a-z][a-z0-9:_-]{2,79}$/);
const EvidenceRefSchema = z.string().regex(/^ev:[a-z0-9:_-]{3,76}$/);
const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

const EvidenceTemplateCatalogSchema = z.object({
  schemaVersion: z.literal('bilan-evidence-template-catalog-v1'),
  version: z.literal('1'),
  templates: z.array(z.object({
    templateId: IdentifierSchema,
    fixtureId: z.string().regex(/^synthetic-(?:simple|intermediate|complex)-0[1-4]$/),
    competencyId: IdentifierSchema,
    evidenceRef: EvidenceRefSchema,
    text: z.string().trim().min(1).max(500),
  }).strict()).min(1),
}).strict().superRefine((catalog, context) => {
  const seen = new Set<string>();
  catalog.templates.forEach((template, index) => {
    if (seen.has(template.templateId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['templates', index, 'templateId'],
        message: 'Duplicate trusted evidence template ID.',
      });
    }
    seen.add(template.templateId);
  });
});

const TRUSTED_EVIDENCE_TEMPLATE_CATALOG =
  EvidenceTemplateCatalogSchema.parse(evidenceTemplateCatalog);
const TRUSTED_EVIDENCE_TEMPLATES = new Map(
  TRUSTED_EVIDENCE_TEMPLATE_CATALOG.templates.map((template) => [
    template.templateId,
    Object.freeze(template),
  ]),
);

const CompetencySchema = z.object({
  competencyId: IdentifierSchema,
  title: z.string().trim().min(3).max(120),
  status: z.enum(['MASTERED', 'DEVELOPING', 'PRIORITY', 'UNMEASURED']),
}).strict();

const RawEvidenceLocalOnlySchema = z.object({
  evidenceRef: EvidenceRefSchema,
  competencyId: IdentifierSchema,
  text: z.string().trim().min(1).max(2_000),
  source: z.enum(['CONTROLLED_TEMPLATE_SOURCE', 'UNTRUSTED_FREE_TEXT']),
}).strict();

const CuratedEvidenceSchema = z.object({
  evidenceRef: EvidenceRefSchema,
  competencyId: IdentifierSchema,
  text: z.string().trim().min(1).max(500),
  trust: z.literal('CURATED'),
  evidenceScopeVersion: z.literal('TRANSVERSAL_V1').optional(),
  templateId: IdentifierSchema,
  templateChecksum: Sha256Schema,
}).strict();

const HumanApprovalSchema = z.object({
  reviewerId: IdentifierSchema,
  reviewedAt: z.string().datetime({ offset: true }),
  sourceChecksum: Sha256Schema,
  approvalChecksum: Sha256Schema,
}).strict();

const UntrustedApprovedEvidenceSchema = z.object({
  evidenceRef: EvidenceRefSchema,
  competencyId: IdentifierSchema,
  text: z.string().trim().min(1).max(500),
  trust: z.literal('UNTRUSTED_QUOTED_DATA'),
  evidenceScopeVersion: z.literal('TRANSVERSAL_V1').optional(),
  rawSourceChecksum: Sha256Schema,
  piiScanResult: PiiScanResultSchema,
  humanApproval: HumanApprovalSchema,
}).strict();

const ApprovedEvidenceForLlmSchema = z.discriminatedUnion('trust', [
  CuratedEvidenceSchema,
  UntrustedApprovedEvidenceSchema,
]);

const PrioritySchema = z.object({
  competencyId: IdentifierSchema,
  title: z.string().trim().min(3).max(120),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  evidenceRefs: z.array(EvidenceRefSchema).min(1).max(6),
}).strict();

const FixtureRecommendationSchema = z.object({
  recommendationId: IdentifierSchema,
  competencyId: IdentifierSchema,
  evidenceRefs: z.array(EvidenceRefSchema).min(1).max(6),
  transversalEvidencePolicy: z.literal('ALLOW_TRANSVERSAL_V1').optional(),
}).strict();

const ResolvedRecommendationSchema = FixtureRecommendationSchema.extend({
  title: z.string().trim().min(3).max(120),
  rationale: z.string().trim().min(3).max(300),
}).strict();

const LlmApprovedInternalNotesSchema = z.object({
  notes: z.array(z.string().trim().min(1).max(300)).min(1).max(6),
  reviewerId: IdentifierSchema,
  reviewedAt: z.string().datetime({ offset: true }),
  sourceChecksum: Sha256Schema,
  piiScanResult: PiiScanResultSchema,
  approvalChecksum: Sha256Schema,
}).strict();

const SyntheticBenchmarkFixtureBaseSchema = z.object({
  schemaVersion: z.literal('bilan-synthetic-assessment-v2'),
  datasetVersion: z.literal('synthetic-v1'),
  inputChecksum: Sha256Schema,
  createdAt: z.string().datetime({ offset: true }),
  audience: z.literal('PARENT'),
  classification: z.literal('SYNTHETIC_BENCHMARK'),
  piiStatus: PiiStatusSchema,
  fixtureId: z.string().regex(/^synthetic-(?:simple|intermediate|complex)-0[1-4]$/),
  complexity: ComplexitySchema,
  coverage: z.array(CoverageSchema).min(1),
  level: z.string().trim().min(2).max(40),
  subject: z.string().trim().min(2).max(80),
  score: z.object({
    points: z.number().int().nonnegative(),
    maxPoints: z.number().int().positive(),
    calibrationStatus: z.literal('FINAL'),
  }).strict(),
  competencies: z.array(CompetencySchema).min(1).max(12),
  rawEvidenceLocalOnly: z.array(RawEvidenceLocalOnlySchema).min(1).max(20),
  approvedEvidenceForLlm: z.array(ApprovedEvidenceForLlmSchema).min(1).max(20),
  priorities: z.array(PrioritySchema).min(1).max(6),
  allowedRecommendations: z.array(FixtureRecommendationSchema).min(1).max(6),
  unmeasuredCompetencyIds: z.array(IdentifierSchema).max(6),
  rawInternalNotesLocalOnly: z.array(
    z.string().trim().min(1).max(500),
  ).max(6),
  llmApprovedInternalNotes: LlmApprovedInternalNotesSchema.optional(),
}).strict();

type SyntheticBenchmarkFixtureBase = z.infer<
  typeof SyntheticBenchmarkFixtureBaseSchema
>;

function groundingIssues(
  value: Readonly<{
    score: { points: number; maxPoints: number };
    competencies: z.infer<typeof CompetencySchema>[];
    approvedEvidenceForLlm: z.infer<typeof ApprovedEvidenceForLlmSchema>[];
    priorities: z.infer<typeof PrioritySchema>[];
    allowedRecommendations: Array<{
      recommendationId: string;
      competencyId: string;
      evidenceRefs: string[];
    }>;
    unmeasuredCompetencyIds: string[];
  }>,
  context: z.RefinementCtx,
): void {
  for (const issue of validateGrounding({
    score: value.score,
    competencies: value.competencies,
    evidence: value.approvedEvidenceForLlm,
    priorities: value.priorities,
    recommendations: value.allowedRecommendations,
    unmeasuredCompetencyIds: value.unmeasuredCompetencyIds,
  })) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: issue.message,
      path: [...issue.path],
    });
  }
}

function validateFixture(
  value: SyntheticBenchmarkFixtureBase,
  context: z.RefinementCtx,
): void {
  groundingIssues(value, context);
  const seenRawEvidenceRefs = new Set<string>();
  value.rawEvidenceLocalOnly.forEach((item, index) => {
    if (seenRawEvidenceRefs.has(item.evidenceRef)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['rawEvidenceLocalOnly', index, 'evidenceRef'],
        message: 'Duplicate raw evidence reference.',
      });
    }
    seenRawEvidenceRefs.add(item.evidenceRef);
  });
  const rawEvidence = new Map(
    value.rawEvidenceLocalOnly.map((item) => [item.evidenceRef, item]),
  );
  value.approvedEvidenceForLlm.forEach((item, index) => {
    const raw = rawEvidence.get(item.evidenceRef);
    if (raw === undefined || raw.competencyId !== item.competencyId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['approvedEvidenceForLlm', index, 'evidenceRef'],
        message: 'Approved evidence must derive from local raw evidence.',
      });
      return;
    }
    if (item.trust === 'CURATED') {
      const trustedTemplate = TRUSTED_EVIDENCE_TEMPLATES.get(item.templateId);
      if (
        raw.source !== 'CONTROLLED_TEMPLATE_SOURCE'
        || trustedTemplate === undefined
        || trustedTemplate.fixtureId !== value.fixtureId
        || trustedTemplate.competencyId !== item.competencyId
        || trustedTemplate.evidenceRef !== item.evidenceRef
        || raw.text !== trustedTemplate.text
        || item.text !== trustedTemplate.text
        || item.templateChecksum
          !== curatedEvidenceTemplateChecksum(trustedTemplate)
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['approvedEvidenceForLlm', index, 'trust'],
          message: 'CURATED evidence requires the exact trusted template registry source.',
        });
      }
    }
    if (item.trust === 'UNTRUSTED_QUOTED_DATA') {
      if (
        raw.source !== 'UNTRUSTED_FREE_TEXT'
        || item.rawSourceChecksum !== rawEvidenceSourceChecksum(raw)
        || !validatePiiScanResultChecksum(item.piiScanResult)
        || !['CLEAN', 'REDACTED'].includes(item.piiScanResult.status)
        || !piiScanResultMatchesContent(
          item.piiScanResult,
          [{
            path: `$.approvedEvidenceForLlm[${index}].text`,
            text: item.text,
          }],
          'SANITIZED',
        )
        || !validateApprovalChecksum(item)
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['approvedEvidenceForLlm', index, 'piiScanResult'],
          message: 'Untrusted quoted evidence requires a transport-safe scan.',
        });
      }
    }
  });
}

export const SyntheticBenchmarkFixtureSchema =
  SyntheticBenchmarkFixtureBaseSchema.superRefine(validateFixture);

export type SyntheticBenchmarkFixture = z.infer<
  typeof SyntheticBenchmarkFixtureSchema
>;

const LocalFirstReportContextBaseSchema = z.object({
  schemaVersion: z.literal('bilan-report-context-v2'),
  datasetVersion: z.string().min(1).max(80),
  inputChecksum: Sha256Schema,
  createdAt: z.string().datetime({ offset: true }),
  audience: AudienceSchema,
  classification: z.enum([
    'CONFIDENTIAL_PEDAGOGICAL',
    'INTERNAL_NEXUS',
  ]),
  piiScanResult: PiiScanResultSchema,
  fixtureId: z.string().min(1).max(80),
  level: z.string().min(2).max(40),
  subject: z.string().min(2).max(80),
  score: z.object({
    points: z.number().int().nonnegative(),
    maxPoints: z.number().int().positive(),
  }).strict(),
  scoreEcho: z.object({
    points: z.number().int().nonnegative(),
    maxPoints: z.number().int().positive(),
    percentage: z.number().min(0).max(100),
    calibrationStatus: z.literal('FINAL'),
  }).strict(),
  competencies: z.array(CompetencySchema).min(1).max(12),
  approvedEvidenceForLlm: z.array(
    ApprovedEvidenceForLlmSchema,
  ).min(1).max(20),
  priorities: z.array(PrioritySchema).min(1).max(6),
  allowedRecommendations: z.array(
    ResolvedRecommendationSchema,
  ).min(1).max(6),
  unmeasuredCompetencyIds: z.array(IdentifierSchema).max(6),
  llmApprovedInternalNotes: LlmApprovedInternalNotesSchema.optional(),
}).strict();

export type LocalFirstReportContext = z.infer<
  typeof LocalFirstReportContextBaseSchema
>;

type OutboundStringField = Readonly<{
  path: string;
  text: string;
  source: 'CONTROLLED_TEMPLATE' | 'STRUCTURAL_METADATA';
}>;

// Only values closed by an enum/literal, a timestamp schema, or SHA-256 are
// exempt from heuristic content detectors. Open identifiers remain scanned.
const CLOSED_STRUCTURAL_OUTBOUND_KEYS = new Set([
  'schemaVersion',
  'inputChecksum',
  'createdAt',
  'audience',
  'classification',
  'status',
  'trust',
  'evidenceScopeVersion',
  'templateChecksum',
  'rawSourceChecksum',
  'transversalEvidencePolicy',
  'priority',
  'calibrationStatus',
  'reviewedAt',
  'sourceChecksum',
  'approvalChecksum',
  'detectorVersion',
  'detectedCategories',
  'scannedFieldPaths',
  'scannedContentChecksum',
  'sanitizedContentChecksum',
  'payloadChecksum',
  'checksum',
]);

function collectOutboundStrings(
  value: unknown,
  path: string,
  parentKey?: string,
): OutboundStringField[] {
  if (typeof value === 'string') {
    return [{
      path,
      text: value,
      source: parentKey !== undefined
        && CLOSED_STRUCTURAL_OUTBOUND_KEYS.has(parentKey)
        ? 'STRUCTURAL_METADATA'
        : 'CONTROLLED_TEMPLATE',
    }];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      collectOutboundStrings(item, `${path}[${index}]`, parentKey));
  }
  if (value !== null && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .filter(([key]) => key !== 'piiScanResult' || path !== '$')
      .flatMap(([key, item]) =>
        collectOutboundStrings(item, `${path}.${key}`, key));
  }
  return [];
}

export function collectAllOutboundStringFields(
  context: unknown,
): readonly OutboundStringField[] {
  return Object.freeze(collectOutboundStrings(context, '$'));
}

function payloadWithoutRootScan(
  context: Record<string, unknown>,
): Record<string, unknown> {
  const { piiScanResult: _scan, ...payload } = context;
  return payload;
}

function applySanitizedOutboundStrings(
  value: unknown,
  sanitizedFields: Readonly<Record<string, string>>,
  path = '$',
): unknown {
  if (typeof value === 'string') {
    const sanitized = sanitizedFields[path];
    if (sanitized === undefined) {
      throw new Error(`Missing sanitized outbound field ${path}.`);
    }
    return sanitized;
  }
  if (Array.isArray(value)) {
    return value.map((item, index) =>
      applySanitizedOutboundStrings(item, sanitizedFields, `${path}[${index}]`));
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => [
        key,
        key === 'piiScanResult'
          ? item
          : applySanitizedOutboundStrings(
            item,
            sanitizedFields,
            `${path}.${key}`,
          ),
      ]));
  }
  return value;
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== 'object' || seen.has(value)) {
    return value;
  }
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    deepFreeze((value as Record<PropertyKey, unknown>)[key], seen);
  }
  return Object.freeze(value);
}

const FORBIDDEN_CLAIM_PATTERN =
  /\b(?:diagnostic|dyslexi(?:e|que)|tdah|note garantie|réussite garantie)\b/i;

function checksumValues(
  fixture: SyntheticBenchmarkFixtureBase,
): Omit<SyntheticBenchmarkFixtureBase, 'inputChecksum'> {
  const { inputChecksum: _checksum, ...values } = fixture;
  return values;
}

export function hasValidSyntheticFixtureChecksum(
  fixture: SyntheticBenchmarkFixture,
): boolean {
  return fixture.inputChecksum === sha256Canonical(checksumValues(fixture));
}

function expectedPercentage(points: number, maxPoints: number): number {
  return Math.round((points / maxPoints) * 10_000) / 100;
}

export function curatedEvidenceTemplateChecksum(
  evidence: Readonly<{
    templateId: string;
    fixtureId: string;
    competencyId: string;
    evidenceRef: string;
    text: string;
  }>,
): string {
  return sha256Canonical({
    templateId: evidence.templateId,
    fixtureId: evidence.fixtureId,
    competencyId: evidence.competencyId,
    evidenceRef: evidence.evidenceRef,
    text: evidence.text,
  });
}

export function rawEvidenceSourceChecksum(
  evidence: z.infer<typeof RawEvidenceLocalOnlySchema>,
): string {
  return sha256Canonical(evidence);
}

export function approvedEvidenceSourceChecksum(
  evidence: Readonly<{
    evidenceRef: string;
    competencyId: string;
    text: string;
    rawSourceChecksum: string;
    piiScanResult: z.infer<typeof PiiScanResultSchema>;
  }>,
): string {
  return sha256Canonical({
    evidenceRef: evidence.evidenceRef,
    competencyId: evidence.competencyId,
    text: evidence.text,
    rawSourceChecksum: evidence.rawSourceChecksum,
    piiScanChecksum: evidence.piiScanResult.checksum,
  });
}

function validateApprovalChecksum(
  evidence: z.infer<typeof UntrustedApprovedEvidenceSchema>,
): boolean {
  const { humanApproval: approval } = evidence;
  const { approvalChecksum: _checksum, ...values } = approval;
  return approval.sourceChecksum === approvedEvidenceSourceChecksum(evidence)
    && approval.approvalChecksum === sha256Canonical(values);
}

function validateInternalNotesApproval(
  notes: z.infer<typeof LlmApprovedInternalNotesSchema>,
): boolean {
  const { approvalChecksum: _checksum, ...values } = notes;
  const expectedSourceChecksum = sha256Canonical({
    notes: notes.notes,
    piiScanChecksum: notes.piiScanResult.checksum,
  });
  return notes.sourceChecksum === expectedSourceChecksum
    && notes.approvalChecksum === sha256Canonical(values);
}

export function validateLocalFirstReportContext(
  input: unknown,
): LocalFirstReportContext {
  const value = LocalFirstReportContextBaseSchema.parse(input);
  const issues: z.ZodIssue[] = [];
  const addIssue = (
    path: readonly (string | number)[],
    message: string,
  ): void => {
    issues.push({
      code: z.ZodIssueCode.custom,
      message,
      path: [...path],
    });
  };

  for (const issue of validateGrounding({
    score: value.score,
    competencies: value.competencies,
    evidence: value.approvedEvidenceForLlm,
    priorities: value.priorities,
    recommendations: value.allowedRecommendations,
    unmeasuredCompetencyIds: value.unmeasuredCompetencyIds,
  })) {
    addIssue(issue.path, issue.message);
  }

  if (
    value.scoreEcho.points !== value.score.points
    || value.scoreEcho.maxPoints !== value.score.maxPoints
    || value.scoreEcho.percentage
      !== expectedPercentage(value.score.points, value.score.maxPoints)
  ) {
    addIssue(['scoreEcho'], 'scoreEcho differs from the deterministic score.');
  }

  const outboundFields = collectAllOutboundStringFields(value);
  const scan = scanPiiFields(outboundFields);
  const payloadChecksum = sha256Canonical(payloadWithoutRootScan(
    value as unknown as Record<string, unknown>,
  ));
  if (
    !validatePiiScanResultChecksum(value.piiScanResult)
    || value.piiScanResult.status === 'NOT_SCANNED'
    || value.piiScanResult.status === 'BLOCKED'
    || scan.result.status !== 'CLEAN'
    || value.piiScanResult.payloadChecksum !== payloadChecksum
    || !piiScanResultMatchesContent(
      value.piiScanResult,
      outboundFields,
      'SANITIZED',
    )
  ) {
    addIssue(['piiScanResult'], 'Context PII scan is absent or inconsistent.');
  }

  value.approvedEvidenceForLlm.forEach((item, index) => {
    const trustedTemplate = item.trust === 'CURATED'
      ? TRUSTED_EVIDENCE_TEMPLATES.get(item.templateId)
      : undefined;
    if (
      item.trust === 'CURATED'
      && (
        trustedTemplate === undefined
        || trustedTemplate.fixtureId !== value.fixtureId
        || trustedTemplate.competencyId !== item.competencyId
        || trustedTemplate.evidenceRef !== item.evidenceRef
        || item.text !== trustedTemplate.text
        || item.templateChecksum
          !== curatedEvidenceTemplateChecksum(trustedTemplate)
      )
    ) {
      addIssue(
        ['approvedEvidenceForLlm', index, 'templateChecksum'],
        'CURATED evidence no longer matches its controlled template.',
      );
    }
    if (
      item.trust === 'UNTRUSTED_QUOTED_DATA'
      && (
        !['CLEAN', 'REDACTED'].includes(item.piiScanResult.status)
        || !piiScanResultMatchesContent(
          item.piiScanResult,
          [{
            path: `$.approvedEvidenceForLlm[${index}].text`,
            text: item.text,
          }],
          'SANITIZED',
        )
        || !validateApprovalChecksum(item)
      )
    ) {
      addIssue(
        ['approvedEvidenceForLlm', index, 'humanApproval'],
        'Untrusted evidence approval checksum is invalid.',
      );
    }
  });

  if (value.audience !== 'NEXUS' && value.llmApprovedInternalNotes !== undefined) {
    addIssue(
      ['llmApprovedInternalNotes'],
      'LLM-approved internal notes are restricted to Nexus.',
    );
  }
  if (value.llmApprovedInternalNotes !== undefined) {
    if (
      !validateInternalNotesApproval(value.llmApprovedInternalNotes)
      || !validatePiiScanResultChecksum(
        value.llmApprovedInternalNotes.piiScanResult,
      )
      || !['CLEAN', 'REDACTED'].includes(
        value.llmApprovedInternalNotes.piiScanResult.status,
      )
      || !piiScanResultMatchesContent(
        value.llmApprovedInternalNotes.piiScanResult,
        value.llmApprovedInternalNotes.notes.map((text, index) => ({
          path: `$.llmApprovedInternalNotes.notes[${index}]`,
          text,
        })),
        'SANITIZED',
      )
    ) {
      addIssue(
        ['llmApprovedInternalNotes'],
        'Internal notes require a valid approval and transport-safe PII scan.',
      );
    }
  }

  const text = [
    ...value.approvedEvidenceForLlm.map((item) => item.text),
    ...value.priorities.map(({ title }) => title),
    ...value.allowedRecommendations.flatMap(({ title, rationale }) => [
      title,
      rationale,
    ]),
    ...(value.llmApprovedInternalNotes?.notes ?? []),
  ].join('\n');
  if (FORBIDDEN_CLAIM_PATTERN.test(text)) {
    addIssue([], 'Context contains a forbidden claim.');
  }

  if (issues.length > 0) throw new z.ZodError(issues);
  return deepFreeze(value);
}

export function buildLocalFirstReportContext(
  input: unknown,
  audience: z.infer<typeof AudienceSchema>,
): LocalFirstReportContext {
  const fixture = SyntheticBenchmarkFixtureSchema.parse(input);
  if (!hasValidSyntheticFixtureChecksum(fixture)) {
    throw new z.ZodError([{
      code: z.ZodIssueCode.custom,
      message: 'Synthetic fixture checksum mismatch.',
      path: ['inputChecksum'],
    }]);
  }

  const allowedRecommendations = fixture.allowedRecommendations.map(
    (recommendation) => {
      const catalogEntry = resolveRecommendation(
        recommendation.recommendationId,
      );
      if (catalogEntry === null) {
        throw new Error('Recommendation catalog changed after validation.');
      }
      return {
        ...catalogEntry,
        evidenceRefs: recommendation.evidenceRefs,
        ...(recommendation.transversalEvidencePolicy === undefined
          ? {}
          : {
            transversalEvidencePolicy:
              recommendation.transversalEvidencePolicy,
          }),
      };
    },
  );
  const scoreEcho = {
    points: fixture.score.points,
    maxPoints: fixture.score.maxPoints,
    percentage: expectedPercentage(
      fixture.score.points,
      fixture.score.maxPoints,
    ),
    calibrationStatus: fixture.score.calibrationStatus,
  } as const;

  const outboundPayload = {
    schemaVersion: 'bilan-report-context-v2',
    datasetVersion: fixture.datasetVersion,
    inputChecksum: fixture.inputChecksum,
    createdAt: fixture.createdAt,
    audience,
    classification: audience === 'NEXUS'
      ? 'INTERNAL_NEXUS'
      : 'CONFIDENTIAL_PEDAGOGICAL',
    fixtureId: fixture.fixtureId,
    level: fixture.level,
    subject: fixture.subject,
    score: {
      points: fixture.score.points,
      maxPoints: fixture.score.maxPoints,
    },
    scoreEcho,
    competencies: fixture.competencies,
    approvedEvidenceForLlm: fixture.approvedEvidenceForLlm,
    priorities: fixture.priorities,
    allowedRecommendations,
    unmeasuredCompetencyIds: fixture.unmeasuredCompetencyIds,
    ...(audience === 'NEXUS' && fixture.llmApprovedInternalNotes !== undefined
      ? { llmApprovedInternalNotes: fixture.llmApprovedInternalNotes }
      : {}),
  } as const;
  const scan = scanPiiFields(collectAllOutboundStringFields(outboundPayload));
  if (scan.result.status === 'BLOCKED') {
    throw new z.ZodError([{
      code: z.ZodIssueCode.custom,
      message: 'Outbound context failed the local PII boundary.',
      path: ['piiScanResult'],
    }]);
  }
  const curatedTemplatePii = fixture.approvedEvidenceForLlm.some(
    (item, index) => item.trust === 'CURATED'
      && scan.sanitizedFields[
        `$.approvedEvidenceForLlm[${index}].text`
      ] !== item.text,
  );
  if (curatedTemplatePii) {
    throw new z.ZodError([{
      code: z.ZodIssueCode.custom,
      message: 'PII in a controlled template is not transportable.',
      path: ['approvedEvidenceForLlm'],
    }]);
  }
  const sanitizedPayload = applySanitizedOutboundStrings(
    outboundPayload,
    scan.sanitizedFields,
  ) as Record<string, unknown>;
  const boundScan = bindPiiScanResultToPayload(
    scan.result,
    sha256Canonical(sanitizedPayload),
  );

  return validateLocalFirstReportContext({
    ...sanitizedPayload,
    piiScanResult: boundScan,
  });
}

export const SYNTHETIC_BENCHMARK_FIXTURE_JSON_SCHEMA = Object.freeze(
  zodToJsonSchema(
    SyntheticBenchmarkFixtureBaseSchema,
  ) as Record<string, unknown>,
);

export const LOCAL_FIRST_REPORT_CONTEXT_JSON_SCHEMA = Object.freeze(
  zodToJsonSchema(
    LocalFirstReportContextBaseSchema,
  ) as Record<string, unknown>,
);
