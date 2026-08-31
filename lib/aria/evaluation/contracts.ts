import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Ajv2020 from 'ajv/dist/2020';
import { z } from 'zod';
import { getCourse } from '@/lib/curriculum/catalog';
import { getCourseCapabilities } from '@/lib/aria/curriculum';
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
const RAG_FIXTURE_FILE = join(
  process.cwd(),
  'data',
  'aria',
  'testing',
  'rag',
  'debbfb31c0a95e3e16ff33772f0626856e8dc01c52faab8270820b7f4374608a.json',
);

export const ARIA_CONVERSATION_EVALUATION_SEMANTIC_VALIDATOR_VERSION =
  'aria-conversation-semantic-validator-v1' as const;

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

const retrievalEvidenceIdentitySchema = resourceIdentitySchema.extend({
  contentSha256: z.string().regex(/^[0-9a-f]{64}$/),
  chunkId: z.string().min(1),
  locator: z.string().min(1),
});

const retrievalEvidenceSchema = z.discriminatedUnion('evidenceSource', [
  retrievalEvidenceIdentitySchema.extend({
    evidenceSource: z.literal('CANONICAL_RAG_FIXTURE'),
    manifestSha256: z.string().regex(/^[0-9a-f]{64}$/),
    corpusId: z.string().min(1),
    corpusVersionId: z.string().min(1),
  }).strict(),
  retrievalEvidenceIdentitySchema.extend({
    evidenceSource: z.literal('SYNTHETIC_EVALUATION_FIXTURE'),
    manifestSha256: z.null(),
    corpusId: z.null(),
    corpusVersionId: z.null(),
    fixtureContent: z.string().min(1),
  }).strict(),
]);

const citationEvidenceSchema = retrievalEvidenceIdentitySchema.extend({
  evidenceSource: z.enum(['CANONICAL_RAG_FIXTURE', 'SYNTHETIC_EVALUATION_FIXTURE']),
  manifestSha256: z.string().regex(/^[0-9a-f]{64}$/).nullable(),
  corpusId: z.string().min(1).nullable(),
  corpusVersionId: z.string().min(1).nullable(),
}).strict();

const canonicalRagFixtureSchema = z.object({
  manifest_sha256: z.string().regex(/^[0-9a-f]{64}$/),
  corpora: z.array(z.object({
    corpus_id: z.string().min(1),
    corpus_version_id: z.string().min(1),
    resources: z.array(z.object({
      resource_id: z.string().min(1),
      resource_version_id: z.string().min(1),
      content_sha256: z.string().regex(/^[0-9a-f]{64}$/),
      chunks: z.array(z.object({ chunk_id: z.string().min(1) }).passthrough()),
    }).passthrough()),
  }).passthrough()),
}).passthrough();

const canonicalRagFixture = canonicalRagFixtureSchema.parse(
  JSON.parse(readFileSync(RAG_FIXTURE_FILE, 'utf8')) as unknown,
);

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
  answerDisclosure: z.enum([
    'EXPLAIN_WITH_CHECKS',
    'PROGRESSIVE_HINTS',
    'ATTEMPT_FIRST',
    'DIAGNOSE_ATTEMPT',
    'CORRECTION_LIFECYCLE_REQUIRED',
    'COMPLETE_WORKED_SOLUTION',
    'EXAM_RULES_REQUIRED',
    'REVISION_PLAN_REQUIRED',
    'METHOD_FIRST',
    'NOT_EVALUATED',
  ]),
  citationRequired: z.boolean(),
  requiredPhrases: z.array(z.string().min(1)),
  forbiddenPhrases: z.array(z.string().min(1)),
}).strict();

export const ariaConversationEvaluationCaseSchema = z.object({
  schemaVersion: z.literal(1),
  caseId: z.string().regex(/^P\d{3}$/),
  title: z.string().min(1),
  courseKey: z.string().min(1),
  gradeLevel: z.enum([
    'QUATRIEME', 'TROISIEME', 'SECONDE', 'PREMIERE', 'TERMINALE', 'POSTBAC', 'AUTRE',
  ]),
  pedagogicalMode: z.enum(ARIA_PEDAGOGICAL_MODES),
  agentRole: z.literal('TUTOR'),
  academicContextStatus: z.enum(['REPRESENTED', 'NOT_PROVEN', 'UNREPRESENTABLE']),
  capabilitySource: z.enum(['CANONICAL_RUNTIME', 'SYNTHETIC_POLICY_CASE']),
  capabilities: z.object({
    hasChat: z.boolean(),
    hasRagCorpus: z.boolean(),
    generalChatAllowed: z.boolean(),
  }).strict(),
  requestedResource: resourceIdentitySchema.optional(),
  retrieval: z.object({
    status: ragStatusSchema,
    hits: z.array(retrievalEvidenceSchema),
  }).strict(),
  studentScenario: z.object({
    kind: z.string().min(1),
    text: z.string().min(1),
  }).strict(),
  fixture: z.object({
    responseKind: z.enum(['MODEL_RESPONSE', 'POLICY_REJECTION']),
    text: z.string(),
    citations: z.array(citationEvidenceSchema),
  }).strict(),
  expected: expectedSchema,
  rubric: z.array(z.string().min(1)).min(1),
}).strict().superRefine((evaluationCase, context) => {
  const course = getCourse(evaluationCase.courseKey);
  if (!course) {
    context.addIssue({
      code: z.ZodIssueCode.custom, path: ['courseKey'], message: 'unknown canonical course',
    });
  } else if (course.gradeLevel !== evaluationCase.gradeLevel) {
    context.addIssue({
      code: z.ZodIssueCode.custom, path: ['gradeLevel'], message: 'course grade mismatch',
    });
  }

  if (evaluationCase.retrieval.status === 'SUCCESS') {
    if (evaluationCase.retrieval.hits.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom, path: ['retrieval', 'hits'],
        message: 'successful retrieval requires evidence',
      });
    }
  } else if (evaluationCase.retrieval.hits.length !== 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom, path: ['retrieval', 'hits'],
      message: 'non-successful retrieval cannot expose hits',
    });
  }

  for (const hit of evaluationCase.retrieval.hits) {
    if (hit.evidenceSource === 'SYNTHETIC_EVALUATION_FIXTURE') {
      const digest = createHash('sha256').update(hit.fixtureContent).digest('hex');
      if (digest !== hit.contentSha256) {
        context.addIssue({
          code: z.ZodIssueCode.custom, path: ['retrieval', 'hits'],
          message: 'synthetic retrieval evidence digest mismatch',
        });
      }
      continue;
    }

    const canonicalCorpus = canonicalRagFixture.corpora.find((corpus) =>
      hit.manifestSha256 === canonicalRagFixture.manifest_sha256
      && corpus.corpus_id === hit.corpusId
      && corpus.corpus_version_id === hit.corpusVersionId);
    const canonicalResource = canonicalCorpus?.resources.find((resource) =>
      resource.resource_id === hit.resourceId
      && resource.resource_version_id === hit.resourceVersionId
      && resource.content_sha256 === hit.contentSha256
      && resource.chunks.some((chunk) => chunk.chunk_id === hit.chunkId));
    if (!canonicalResource) {
      context.addIssue({
        code: z.ZodIssueCode.custom, path: ['retrieval', 'hits'],
        message: 'canonical retrieval evidence is absent from the bound manifest',
      });
    }
  }

  const expectedResponseKind = evaluationCase.expected.outcome === 'ALLOW_MODEL'
    ? 'MODEL_RESPONSE'
    : 'POLICY_REJECTION';
  if (evaluationCase.fixture.responseKind !== expectedResponseKind) {
    context.addIssue({
      code: z.ZodIssueCode.custom, path: ['fixture', 'responseKind'],
      message: 'fixture response kind contradicts expected outcome',
    });
  }
  const canonicalCapabilities = getCourseCapabilities(evaluationCase.courseKey);
  const retrievalPolicy = course && evaluationCase.academicContextStatus === 'REPRESENTED'
    ? resolveAriaRetrievalPolicy({
      task: evaluationCase.pedagogicalMode,
      courseKey: evaluationCase.courseKey,
      requestedResource: evaluationCase.requestedResource,
      agentRole: evaluationCase.agentRole,
      visibility: 'STUDENT_PRIVATE',
      capabilities: evaluationCase.capabilitySource === 'CANONICAL_RUNTIME'
        ? {
          hasChat: canonicalCapabilities.hasChat,
          hasRagCorpus: canonicalCapabilities.hasRagCorpus,
          generalChatAllowed: canonicalCapabilities.generalChatAllowed,
        }
        : evaluationCase.capabilities,
    })
    : undefined;
  const citationRequired = evaluationCase.expected.outcome === 'ALLOW_MODEL'
    && (retrievalPolicy?.kind === 'GROUNDED_REQUIRED'
      || retrievalPolicy?.kind === 'RESOURCE_GROUNDED_REQUIRED');
  if (evaluationCase.expected.citationRequired !== citationRequired) {
    context.addIssue({
      code: z.ZodIssueCode.custom, path: ['expected', 'citationRequired'],
      message: 'citation requirement contradicts resolved retrieval policy',
    });
  }
  if (citationRequired && evaluationCase.fixture.citations.length === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom, path: ['fixture', 'citations'],
      message: 'required citation is missing',
    });
  }
  for (const citation of evaluationCase.fixture.citations) {
    if (!evaluationCase.retrieval.hits.some((hit) =>
      hit.evidenceSource === citation.evidenceSource
      && hit.manifestSha256 === citation.manifestSha256
      && hit.corpusId === citation.corpusId
      && hit.corpusVersionId === citation.corpusVersionId
      && hit.resourceId === citation.resourceId
      && hit.resourceVersionId === citation.resourceVersionId
      && hit.contentSha256 === citation.contentSha256
      && hit.chunkId === citation.chunkId
      && hit.locator === citation.locator)) {
      context.addIssue({
        code: z.ZodIssueCode.custom, path: ['fixture', 'citations'],
        message: 'citation is not bound to retrieved resource version',
      });
    }
  }

  if (evaluationCase.capabilitySource === 'CANONICAL_RUNTIME') {
    const expectedCapabilities = {
      hasChat: canonicalCapabilities.hasChat,
      hasRagCorpus: canonicalCapabilities.hasRagCorpus,
      generalChatAllowed: canonicalCapabilities.generalChatAllowed,
    };
    if (JSON.stringify(evaluationCase.capabilities) !== JSON.stringify(expectedCapabilities)) {
      context.addIssue({
        code: z.ZodIssueCode.custom, path: ['capabilities'],
        message: 'canonical runtime capabilities drifted',
      });
    }
  }
});

const reviewSchema = z.object({
  schemaVersion: z.literal(1),
  reviewVersion: z.string().min(1),
  semanticValidatorVersion: z.literal(
    ARIA_CONVERSATION_EVALUATION_SEMANTIC_VALIDATOR_VERSION,
  ),
  reviewStatus: z.enum(['PENDING_HUMAN_REVIEW', 'APPROVED']),
  schemaSha256: z.string().regex(/^[0-9a-f]{64}$/),
  corpusSha256: z.string().regex(/^[0-9a-f]{64}$/),
  expectedCaseIds: z.array(z.string().regex(/^P\d{3}$/)).min(1),
  reviewedBy: z.array(z.string().min(1)),
  reviewedAt: z.string().datetime().nullable(),
  notes: z.string().min(1),
}).strict().superRefine((review, context) => {
  if (review.reviewStatus === 'APPROVED'
    && (review.reviewedBy.length === 0 || review.reviewedAt === null)) {
    context.addIssue({
      code: z.ZodIssueCode.custom, message: 'approved evaluation requires human review evidence',
    });
  }
  if (review.reviewStatus === 'PENDING_HUMAN_REVIEW'
    && (review.reviewedBy.length !== 0 || review.reviewedAt !== null)) {
    context.addIssue({
      code: z.ZodIssueCode.custom, message: 'pending evaluation cannot claim review evidence',
    });
  }
});

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

export function validateAriaConversationEvaluationJsonStructure(candidate: unknown): boolean {
  const schemaDocument = parseJsonFile(SCHEMA_FILE) as object;
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schemaDocument);
  return Boolean(validate(candidate));
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
  readonly syntheticPolicyPassed: number;
  readonly syntheticPolicyFailed: number;
  readonly canonicalRuntimePassed: number;
  readonly canonicalRuntimeFailed: number;
  readonly productionQualification: 'NOT_EVALUATED';
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
  const canonicalCapabilities = getCourseCapabilities(evaluationCase.courseKey);
  const retrievalPolicy = resolveAriaRetrievalPolicy({
    task: evaluationCase.pedagogicalMode,
    courseKey: evaluationCase.courseKey,
    requestedResource: evaluationCase.requestedResource,
    agentRole: evaluationCase.agentRole,
    visibility: 'STUDENT_PRIVATE',
    capabilities: evaluationCase.capabilitySource === 'CANONICAL_RUNTIME'
      ? {
        hasChat: canonicalCapabilities.hasChat,
        hasRagCorpus: canonicalCapabilities.hasRagCorpus,
        generalChatAllowed: canonicalCapabilities.generalChatAllowed,
      }
      : evaluationCase.capabilities,
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
    if (evaluationCase.expected.citationRequired && evaluationCase.fixture.citations.length < 1) {
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
  const failedIds = new Set(failures.map(({ caseId }) => caseId));
  const syntheticCases = cases.filter(({ capabilitySource }) =>
    capabilitySource === 'SYNTHETIC_POLICY_CASE');
  const canonicalCases = cases.filter(({ capabilitySource }) =>
    capabilitySource === 'CANONICAL_RUNTIME');
  const syntheticPolicyFailed = syntheticCases.filter(({ caseId }) => failedIds.has(caseId)).length;
  const canonicalRuntimeFailed = canonicalCases.filter(({ caseId }) => failedIds.has(caseId)).length;
  return Object.freeze({
    mode: 'FIXTURE',
    passed: cases.length - failures.length,
    failed: failures.length,
    syntheticPolicyPassed: syntheticCases.length - syntheticPolicyFailed,
    syntheticPolicyFailed,
    canonicalRuntimePassed: canonicalCases.length - canonicalRuntimeFailed,
    canonicalRuntimeFailed,
    productionQualification: 'NOT_EVALUATED',
    caseSetSha256,
    failures: Object.freeze(failures),
  });
}
