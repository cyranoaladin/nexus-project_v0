import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Ajv2020 from 'ajv/dist/2020';
import { z } from 'zod';
import {
  ARIA_PEDAGOGICAL_MODES,
  resolveAriaPedagogicalPolicy,
} from '@/lib/aria/domain/pedagogy/pedagogical-mode';
import {
  decideAriaRetrievalOutcome,
  resolveAriaRetrievalPolicy,
} from '@/lib/aria/domain/retrieval/policy';
import { AriaError } from '@/lib/aria/kernel/errors';

const EVALUATION_DIRECTORY = join(process.cwd(), 'data', 'aria', 'evaluation');
const SCHEMA_FILE = join(EVALUATION_DIRECTORY, 'conversation-policy.v1.schema.json');
const CORPUS_FILE = join(EVALUATION_DIRECTORY, 'conversation-policy.v1.jsonl');
const REVIEW_FILE = join(EVALUATION_DIRECTORY, 'conversation-policy.v1.review.json');

const ragStatusSchema = z.enum([
  'NOT_CONFIGURED',
  'NO_RESULTS',
  'RUNTIME_UNAVAILABLE',
  'SUCCESS',
]);

const resourceIdentitySchema = z.object({
  resourceId: z.string().min(1),
  resourceVersionId: z.string().min(1),
}).strict();

const expectedSchema = z.object({
  outcome: z.enum(['ALLOW_MODEL', 'REJECT_RAG', 'NO_MODEL', 'BLOCKED_ACADEMIC_CONTEXT']),
  retrievalPolicy: z.enum([
    'NO_MODEL',
    'GENERAL_CHAT',
    'OPTIONAL_GROUNDING',
    'GROUNDED_REQUIRED',
    'RESOURCE_GROUNDED_REQUIRED',
    'NOT_EVALUATED',
  ]),
  answerDisclosure: z.string().min(1),
  citationRequired: z.boolean(),
  requiredPhrases: z.array(z.string().min(1)),
  forbiddenPhrases: z.array(z.string().min(1)),
}).strict();

export const ariaConversationEvaluationCaseSchema = z.object({
  schemaVersion: z.literal(1),
  caseId: z.string().regex(/^P\d{3}$/),
  title: z.string().min(1),
  courseKey: z.string().min(1),
  gradeLevel: z.string().min(1),
  pedagogicalMode: z.enum(ARIA_PEDAGOGICAL_MODES),
  agentRole: z.literal('TUTOR'),
  academicContextStatus: z.enum(['REPRESENTED', 'NOT_PROVEN', 'UNREPRESENTABLE']),
  capabilities: z.object({
    hasChat: z.boolean(),
    hasRagCorpus: z.boolean(),
    generalChatAllowed: z.boolean(),
  }).strict(),
  requestedResource: resourceIdentitySchema.optional(),
  retrieval: z.object({
    status: ragStatusSchema,
    hits: z.array(resourceIdentitySchema),
  }).strict(),
  studentScenario: z.object({
    kind: z.string().min(1),
    text: z.string().min(1),
  }).strict(),
  fixture: z.object({
    responseKind: z.enum(['MODEL_RESPONSE', 'POLICY_REJECTION']),
    text: z.string(),
    citationCount: z.number().int().nonnegative(),
  }).strict(),
  expected: expectedSchema,
  rubric: z.array(z.string().min(1)).min(1),
}).strict();

const reviewSchema = z.object({
  schemaVersion: z.literal(1),
  reviewVersion: z.string().min(1),
  reviewStatus: z.enum(['PENDING_HUMAN_REVIEW', 'APPROVED']),
  schemaSha256: z.string().regex(/^[0-9a-f]{64}$/),
  corpusSha256: z.string().regex(/^[0-9a-f]{64}$/),
  expectedCaseIds: z.array(z.string().regex(/^P\d{3}$/)).min(1),
  reviewedBy: z.array(z.string().min(1)),
  reviewedAt: z.string().datetime().nullable(),
  notes: z.string().min(1),
}).strict();

export type AriaConversationEvaluationCase = z.infer<
  typeof ariaConversationEvaluationCaseSchema
>;
export type AriaConversationEvaluationReview = z.infer<typeof reviewSchema>;

export interface AriaConversationEvaluationBundle {
  readonly cases: readonly AriaConversationEvaluationCase[];
  readonly review: AriaConversationEvaluationReview;
  readonly schemaSha256: string;
  readonly corpusSha256: string;
}

function sha256(content: Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

function parseJsonFile(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

export function loadAriaConversationEvaluationBundle(): AriaConversationEvaluationBundle {
  const schemaBytes = readFileSync(SCHEMA_FILE);
  const corpusBytes = readFileSync(CORPUS_FILE);
  const schemaDocument = JSON.parse(schemaBytes.toString('utf8')) as object;
  const review = reviewSchema.parse(parseJsonFile(REVIEW_FILE));
  const schemaSha256 = sha256(schemaBytes);
  const corpusSha256 = sha256(corpusBytes);

  if (review.schemaSha256 !== schemaSha256 || review.corpusSha256 !== corpusSha256) {
    throw new Error('ARIA_EVALUATION_DIGEST_MISMATCH');
  }

  const validateJsonSchema = new Ajv2020({ allErrors: true, strict: true }).compile(schemaDocument);
  const cases = corpusBytes
    .toString('utf8')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line, index) => {
      const candidate = JSON.parse(line) as unknown;
      if (!validateJsonSchema(candidate)) {
        throw new Error(
          `ARIA_EVALUATION_SCHEMA_INVALID:${index + 1}:${JSON.stringify(validateJsonSchema.errors)}`,
        );
      }
      return ariaConversationEvaluationCaseSchema.parse(candidate);
    });

  const caseIds = cases.map(({ caseId }) => caseId);
  if (new Set(caseIds).size !== caseIds.length) {
    throw new Error('ARIA_EVALUATION_DUPLICATE_CASE_ID');
  }
  if (JSON.stringify(caseIds) !== JSON.stringify(review.expectedCaseIds)) {
    throw new Error('ARIA_EVALUATION_CASE_SET_MISMATCH');
  }

  return Object.freeze({
    cases: Object.freeze(cases),
    review: Object.freeze(review),
    schemaSha256,
    corpusSha256,
  });
}

interface AriaFixtureEvaluationFailure {
  readonly caseId: string;
  readonly reasons: readonly string[];
}

export interface AriaFixtureEvaluationReport {
  readonly mode: 'FIXTURE';
  readonly passed: number;
  readonly failed: number;
  readonly caseSetSha256: string;
  readonly failures: readonly AriaFixtureEvaluationFailure[];
}

function actualOutcomeFor(
  evaluationCase: AriaConversationEvaluationCase,
): { outcome: AriaConversationEvaluationCase['expected']['outcome']; retrievalPolicy: string; answerDisclosure: string } {
  if (evaluationCase.academicContextStatus !== 'REPRESENTED') {
    return {
      outcome: 'BLOCKED_ACADEMIC_CONTEXT',
      retrievalPolicy: 'NOT_EVALUATED',
      answerDisclosure: 'NOT_EVALUATED',
    };
  }

  const pedagogicalPolicy = resolveAriaPedagogicalPolicy({
    courseKey: evaluationCase.courseKey,
    agentRole: evaluationCase.agentRole,
    mode: evaluationCase.pedagogicalMode,
  });
  const retrievalPolicy = resolveAriaRetrievalPolicy({
    task: evaluationCase.pedagogicalMode,
    courseKey: evaluationCase.courseKey,
    requestedResource: evaluationCase.requestedResource,
    agentRole: evaluationCase.agentRole,
    visibility: 'STUDENT_PRIVATE',
    capabilities: evaluationCase.capabilities,
  });

  try {
    const decision = decideAriaRetrievalOutcome(retrievalPolicy, evaluationCase.retrieval);
    return {
      outcome: decision.allowModel ? 'ALLOW_MODEL' : 'NO_MODEL',
      retrievalPolicy: retrievalPolicy.kind,
      answerDisclosure: pedagogicalPolicy.answerDisclosure,
    };
  } catch (error) {
    if (error instanceof AriaError && error.code === 'RAG_UNAVAILABLE') {
      return {
        outcome: 'REJECT_RAG',
        retrievalPolicy: retrievalPolicy.kind,
        answerDisclosure: pedagogicalPolicy.answerDisclosure,
      };
    }
    throw error;
  }
}

export function evaluateAriaConversationPolicyFixtures(
  cases: readonly AriaConversationEvaluationCase[],
): AriaFixtureEvaluationReport {
  const failures: AriaFixtureEvaluationFailure[] = [];

  for (const evaluationCase of cases) {
    const actual = actualOutcomeFor(evaluationCase);
    const reasons: string[] = [];
    if (actual.outcome !== evaluationCase.expected.outcome) {
      reasons.push(`outcome:${actual.outcome}`);
    }
    if (actual.retrievalPolicy !== evaluationCase.expected.retrievalPolicy) {
      reasons.push(`retrievalPolicy:${actual.retrievalPolicy}`);
    }
    if (actual.answerDisclosure !== evaluationCase.expected.answerDisclosure) {
      reasons.push(`answerDisclosure:${actual.answerDisclosure}`);
    }
    if (evaluationCase.expected.citationRequired && evaluationCase.fixture.citationCount < 1) {
      reasons.push('citation:missing');
    }
    for (const phrase of evaluationCase.expected.requiredPhrases) {
      if (!evaluationCase.fixture.text.includes(phrase)) reasons.push(`requiredPhrase:${phrase}`);
    }
    for (const phrase of evaluationCase.expected.forbiddenPhrases) {
      if (evaluationCase.fixture.text.toLocaleLowerCase('fr').includes(phrase.toLocaleLowerCase('fr'))) {
        reasons.push(`forbiddenPhrase:${phrase}`);
      }
    }
    if (reasons.length > 0) failures.push({ caseId: evaluationCase.caseId, reasons });
  }

  const caseSetSha256 = createHash('sha256')
    .update(cases.map((item) => JSON.stringify(item)).join('\n'))
    .digest('hex');
  return Object.freeze({
    mode: 'FIXTURE',
    passed: cases.length - failures.length,
    failed: failures.length,
    caseSetSha256,
    failures: Object.freeze(failures),
  });
}
