import 'server-only';

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { sha256Canonical } from '@/lib/llm/openrouter/hash';

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

const CompetencySchema = z.object({
  competencyId: IdentifierSchema,
  title: z.string().trim().min(3).max(120),
  status: z.enum(['MASTERED', 'DEVELOPING', 'PRIORITY', 'UNMEASURED']),
}).strict();

const EvidenceSchema = z.object({
  evidenceRef: EvidenceRefSchema,
  competencyId: IdentifierSchema,
  text: z.string().trim().min(1).max(500),
  trust: z.enum(['CURATED', 'EVIDENCE_DATA_UNTRUSTED']),
}).strict();

const PrioritySchema = z.object({
  competencyId: IdentifierSchema,
  title: z.string().trim().min(3).max(120),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  evidenceRefs: z.array(EvidenceRefSchema).min(1).max(6),
}).strict();

const RecommendationSchema = z.object({
  recommendationId: IdentifierSchema,
  title: z.string().trim().min(3).max(120),
  rationale: z.string().trim().min(3).max(300),
  evidenceRefs: z.array(EvidenceRefSchema).min(1).max(6),
}).strict();

const SyntheticBenchmarkFixtureBaseSchema = z.object({
  schemaVersion: z.literal('bilan-synthetic-assessment-v1'),
  sourceSha: z.string().regex(/^[a-f0-9]{40}$/),
  inputChecksum: z.string().regex(/^[a-f0-9]{64}$/),
  createdAt: z.string().datetime({ offset: true }),
  audience: z.literal('PARENT'),
  classification: z.literal('SYNTHETIC_BENCHMARK'),
  piiStatus: z.enum(['NO_PII', 'SYNTHETIC_REDACTION_REQUIRED']),
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
  evidence: z.array(EvidenceSchema).min(1).max(20),
  priorities: z.array(PrioritySchema).min(1).max(6),
  allowedRecommendations: z.array(RecommendationSchema).min(1).max(6),
  unmeasuredCompetencyIds: z.array(IdentifierSchema).max(6),
  internalNotes: z.array(z.string().trim().min(1).max(300)).max(6),
}).strict();

type SyntheticBenchmarkFixtureBase = z.infer<
  typeof SyntheticBenchmarkFixtureBaseSchema
>;

function validateGroundedValues(
  value: Readonly<{
    score: { points: number; maxPoints: number };
    competencies: readonly { competencyId: string }[];
    evidence: readonly { evidenceRef: string; competencyId: string }[];
    priorities: readonly { competencyId: string; evidenceRefs: readonly string[] }[];
    allowedRecommendations: readonly { evidenceRefs: readonly string[] }[];
    unmeasuredCompetencyIds?: readonly string[];
  }>,
  context: z.RefinementCtx,
): void {
  if (value.score.points > value.score.maxPoints) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Score points exceed maxPoints.',
      path: ['score', 'points'],
    });
  }
  const competencyIds = new Set(
    value.competencies.map(({ competencyId }) => competencyId),
  );
  const evidenceRefs = new Set(
    value.evidence.map(({ evidenceRef }) => evidenceRef),
  );
  value.evidence.forEach((evidence, index) => {
    if (!competencyIds.has(evidence.competencyId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Evidence references an unknown competency.',
        path: ['evidence', index, 'competencyId'],
      });
    }
  });
  value.priorities.forEach((priority, index) => {
    if (!competencyIds.has(priority.competencyId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Priority references an unknown competency.',
        path: ['priorities', index, 'competencyId'],
      });
    }
    priority.evidenceRefs.forEach((reference) => {
      if (!evidenceRefs.has(reference)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Priority references unknown evidence.',
          path: ['priorities', index, 'evidenceRefs'],
        });
      }
    });
  });
  value.allowedRecommendations.forEach((recommendation, index) => {
    recommendation.evidenceRefs.forEach((reference) => {
      if (!evidenceRefs.has(reference)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Recommendation references unknown evidence.',
          path: ['allowedRecommendations', index, 'evidenceRefs'],
        });
      }
    });
  });
  value.unmeasuredCompetencyIds?.forEach((competencyId, index) => {
    if (!competencyIds.has(competencyId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Unmeasured list references an unknown competency.',
        path: ['unmeasuredCompetencyIds', index],
      });
    }
  });
}

export const SyntheticBenchmarkFixtureSchema =
  SyntheticBenchmarkFixtureBaseSchema.superRefine(validateGroundedValues);

export type SyntheticBenchmarkFixture = z.infer<
  typeof SyntheticBenchmarkFixtureSchema
>;

const LocalFirstReportContextBaseSchema = z.object({
  schemaVersion: z.literal('bilan-report-context-v1'),
  sourceSha: z.string().regex(/^[a-f0-9]{40}$/),
  inputChecksum: z.string().regex(/^[a-f0-9]{64}$/),
  createdAt: z.string().datetime({ offset: true }),
  audience: AudienceSchema,
  classification: z.enum([
    'CONFIDENTIAL_PEDAGOGICAL',
    'INTERNAL_NEXUS',
  ]),
  piiStatus: z.literal('REDACTED'),
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
  evidence: z.array(EvidenceSchema).min(1).max(20),
  priorities: z.array(PrioritySchema).min(1).max(6),
  allowedRecommendations: z.array(RecommendationSchema).min(1).max(6),
  unmeasuredCompetencyIds: z.array(IdentifierSchema).max(6),
  internalNotes: z.array(z.string().trim().min(1).max(300)).max(6).optional(),
}).strict();

export type LocalFirstReportContext = z.infer<
  typeof LocalFirstReportContextBaseSchema
>;

const FORBIDDEN_CLAIM_PATTERN =
  /\b(?:diagnostic|dyslexi(?:e|que)|tdah|note garantie|réussite garantie)\b/i;
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const TUNISIA_PHONE_PATTERN = /\+216(?:[\s.-]*\d){8}/g;
const PROMPT_INJECTION_PATTERN =
  /ignore (?:les|toutes les) (?:règles|instructions)/i;

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

function sanitizeEvidenceText(text: string): string {
  if (PROMPT_INJECTION_PATTERN.test(text)) {
    return '[PROMPT_INJECTION_REDACTED]';
  }
  return text
    .replace(EMAIL_PATTERN, '[REDACTED_EMAIL]')
    .replace(TUNISIA_PHONE_PATTERN, '[REDACTED_PHONE]');
}

export function validateLocalFirstReportContext(
  input: unknown,
): LocalFirstReportContext {
  const value = LocalFirstReportContextBaseSchema.parse(input);
  const issues: z.ZodIssue[] = [];
  validateGroundedValues(value, {
    addIssue: (issue) => issues.push({
      ...issue,
      path: issue.path ?? [],
    } as z.ZodIssue),
    path: [],
  });
  const expectedPercentage = Math.round(
    (value.score.points / value.score.maxPoints) * 10_000,
  ) / 100;
  if (
    value.scoreEcho.points !== value.score.points
    || value.scoreEcho.maxPoints !== value.score.maxPoints
    || value.scoreEcho.percentage !== expectedPercentage
  ) {
    issues.push({
      code: z.ZodIssueCode.custom,
      message: 'scoreEcho differs from the deterministic score.',
      path: ['scoreEcho'],
    });
  }
  if (value.audience !== 'NEXUS' && value.internalNotes !== undefined) {
    issues.push({
      code: z.ZodIssueCode.custom,
      message: 'Internal notes are restricted to Nexus.',
      path: ['internalNotes'],
    });
  }
  const publicText = [
    ...value.evidence.map(({ text }) => text),
    ...value.priorities.map(({ title }) => title),
    ...value.allowedRecommendations.flatMap(({ title, rationale }) =>
      [title, rationale]),
  ].join('\n');
  if (
    EMAIL_PATTERN.test(publicText)
    || TUNISIA_PHONE_PATTERN.test(publicText)
    || PROMPT_INJECTION_PATTERN.test(publicText)
    || FORBIDDEN_CLAIM_PATTERN.test(publicText)
  ) {
    issues.push({
      code: z.ZodIssueCode.custom,
      message: 'Context contains forbidden or unredacted text.',
      path: [],
    });
  }
  if (issues.length > 0) {
    throw new z.ZodError(issues);
  }
  return Object.freeze(value);
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
  const scoreEcho = {
    points: fixture.score.points,
    maxPoints: fixture.score.maxPoints,
    percentage: Math.round(
      (fixture.score.points / fixture.score.maxPoints) * 10_000,
    ) / 100,
    calibrationStatus: fixture.score.calibrationStatus,
  } as const;
  return validateLocalFirstReportContext({
    schemaVersion: 'bilan-report-context-v1',
    sourceSha: fixture.sourceSha,
    inputChecksum: fixture.inputChecksum,
    createdAt: fixture.createdAt,
    audience,
    classification: audience === 'NEXUS'
      ? 'INTERNAL_NEXUS'
      : 'CONFIDENTIAL_PEDAGOGICAL',
    piiStatus: 'REDACTED',
    fixtureId: fixture.fixtureId,
    level: fixture.level,
    subject: fixture.subject,
    score: {
      points: fixture.score.points,
      maxPoints: fixture.score.maxPoints,
    },
    scoreEcho,
    competencies: fixture.competencies,
    evidence: fixture.evidence.map((evidence) => ({
      ...evidence,
      text: sanitizeEvidenceText(evidence.text),
    })),
    priorities: fixture.priorities,
    allowedRecommendations: fixture.allowedRecommendations,
    unmeasuredCompetencyIds: fixture.unmeasuredCompetencyIds,
    ...(audience === 'NEXUS'
      ? { internalNotes: fixture.internalNotes }
      : {}),
  });
}

export const SYNTHETIC_BENCHMARK_FIXTURE_JSON_SCHEMA = Object.freeze(
  zodToJsonSchema(SyntheticBenchmarkFixtureBaseSchema) as Record<string, unknown>,
);

export const LOCAL_FIRST_REPORT_CONTEXT_JSON_SCHEMA = Object.freeze(
  zodToJsonSchema(LocalFirstReportContextBaseSchema) as Record<string, unknown>,
);
