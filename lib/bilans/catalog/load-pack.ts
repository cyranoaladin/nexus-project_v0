import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { z } from 'zod';

import {
  agentOutputJsonSchema,
  buildValidatedPack,
  promptRefSchema,
  type ValidatedPack,
} from '../validators/contracts';

const ROOT = process.cwd();
const FIXTURE_REVIEWER = /fixture|jamais un enseignant|test[-_ ]only/i;
const MAX_CORRECT_ANSWER_POSITION_PERCENT = 40;

const promptFilesSchema = z.object({
  preAnalysis: promptRefSchema,
  eleve: promptRefSchema,
  parents: promptRefSchema,
  nexus: promptRefSchema,
  verifier: promptRefSchema,
}).strict();

const outputSchemasSchema = z.object({
  preAnalysis: agentOutputJsonSchema,
  eleve: agentOutputJsonSchema,
  parents: agentOutputJsonSchema,
  nexus: agentOutputJsonSchema,
  verifier: agentOutputJsonSchema,
}).strict();

const questionOptionSchema = z.object({
  id: z.string().trim().min(1),
  text: z.string().trim().min(1),
  isCorrect: z.boolean(),
  distractorRationale: z.string().trim().min(1).optional(),
}).strict().superRefine((option, context) => {
  if (!option.isCorrect && option.distractorRationale === undefined) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['distractorRationale'],
      message: 'A distractor must document the real error it captures',
    });
  }
});

const questionSchema = z.object({
  id: z.string().trim().min(1),
  subject: z.literal('MATHS'),
  category: z.string().trim().min(1),
  domainId: z.string().trim().min(1),
  nodeCpsId: z.string().trim().regex(/^[a-z0-9]+(\.[a-z0-9-]+)+$/),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  targetTimeSec: z.number().int().min(15).max(300),
  shortCorrection: z.string().trim().min(1).max(320),
  weight: z.number().positive(),
  competencies: z.array(z.string().trim().min(1)).min(1),
  questionText: z.string().trim().min(1),
  options: z.array(questionOptionSchema).min(2),
  explanation: z.string().trim().min(1),
  imageUrl: z.string().trim().min(1).optional(),
  hint: z.string().trim().min(1).optional(),
  codeSnippet: z.string().min(1).optional(),
  latexFormula: z.string().min(1).optional(),
}).strict().superRefine((question, context) => {
  if (question.options.filter(({ isCorrect }) => isCorrect).length !== 1) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['options'], message: 'Exactly one option must be correct' });
  }
});

const packSchema = z.object({
  slug: z.string().trim().min(1),
  level: z.literal('TERMINALE'),
  subject: z.literal('MATHS'),
  version: z.number().int().positive(),
  status: z.enum(['DRAFT', 'VALIDATED']),
  review: z.object({
    validatedBy: z.string().trim().min(1).nullable(),
    validatedAt: z.string().datetime({ offset: true }).nullable(),
  }).strict(),
  questionnaire: z.object({
    targetDurationMin: z.number().int().positive(),
    confidenceScale: z.object({
      levels: z.literal(4),
      labels: z.array(z.string().trim().min(1)).length(4),
    }).strict(),
    items: z.array(questionSchema).min(12).max(50),
  }).strict(),
  scoring: z.object({
    engine: z.literal('facts.v1.0.1'),
    domains: z.array(z.string().trim().min(1)).length(5),
  }).strict(),
  reporting: z.object({
    rag: z.object({
      enabled: z.boolean(),
      decisionRef: z.string().trim().min(1).optional(),
      sources: z.array(z.string()),
      topK: z.number().int().nonnegative(),
    }).strict().superRefine((rag, context) => {
      if (!rag.enabled && rag.decisionRef === undefined) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['decisionRef'],
          message: 'A disabled RAG policy must reference its decision',
        });
      }
    }),
    promptFiles: promptFilesSchema,
    outputSchemas: outputSchemasSchema,
  }).strict(),
  validation: z.object({
    lexiconPath: z.literal('data/bilans/lexique-interdit.json'),
    forbidDigits: z.array(z.enum(['eleve', 'parents'])).length(2),
  }).strict(),
}).strict().superRefine((pack, context) => {
  const domains = new Set(pack.scoring.domains);
  if (domains.size !== pack.scoring.domains.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['scoring', 'domains'], message: 'Domains must be unique' });
  }
  if (pack.questionnaire.items.some(({ domainId }) => !domains.has(domainId))) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['questionnaire', 'items'], message: 'Question domain is outside scoring domains' });
  }
  const positionCounts: number[] = [];
  for (const item of pack.questionnaire.items) {
    const correctPosition = item.options.findIndex(({ isCorrect }) => isCorrect);
    if (correctPosition >= 0) positionCounts[correctPosition] = (positionCounts[correctPosition] ?? 0) + 1;
  }
  for (const [position, count] of positionCounts.entries()) {
    if (count * 100 > pack.questionnaire.items.length * MAX_CORRECT_ANSWER_POSITION_PERCENT) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['questionnaire', 'items'],
        message: `PACK_CORRECT_ANSWER_POSITION_BIAS:${String.fromCharCode(65 + position)}:${count}/${pack.questionnaire.items.length}>40%`,
      });
    }
  }
  if (pack.status === 'DRAFT' && (pack.review.validatedBy !== null || pack.review.validatedAt !== null)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['review'], message: 'A draft pack cannot carry pedagogical approval' });
  }
  if (pack.status === 'VALIDATED' && (pack.review.validatedBy === null || pack.review.validatedAt === null)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['review'], message: 'A validated pack requires named and dated approval' });
  }
});

export type BilanPack = z.infer<typeof packSchema>;

function resolveRepositoryPath(relativePath: string): string {
  if (path.isAbsolute(relativePath)) throw new Error('PACK_PATH_OUTSIDE_REPOSITORY');
  const absolutePath = path.resolve(ROOT, relativePath);
  if (!absolutePath.startsWith(`${ROOT}${path.sep}`)) throw new Error('PACK_PATH_OUTSIDE_REPOSITORY');
  return absolutePath;
}

function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

export function readBoundPrompt(reference: Readonly<{ path: string; checksum: string }>): string {
  const content = readFileSync(resolveRepositoryPath(reference.path), 'utf8');
  if (sha256(content) !== reference.checksum) {
    throw new Error(`PACK_PROMPT_CHECKSUM_MISMATCH:${reference.path}`);
  }
  return content;
}

function validatePromptBindings(pack: BilanPack): void {
  for (const reference of Object.values(pack.reporting.promptFiles)) readBoundPrompt(reference);
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function nonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function completeRationale(value: unknown): boolean {
  return nonEmptyString(value) && String(value).trim().toUpperCase() !== 'A REMPLACER';
}

function collectItemMetadataFailures(raw: unknown): string[] {
  if (!isRecord(raw) || !isRecord(raw.questionnaire) || !Array.isArray(raw.questionnaire.items)) return [];

  const failures: string[] = [];
  raw.questionnaire.items.forEach((candidate, index) => {
    if (!isRecord(candidate)) {
      failures.push(`item[${index}]: expected an object`);
      return;
    }

    const itemId = nonEmptyString(candidate.id) ? String(candidate.id) : `item[${index}]`;
    if (!nonEmptyString(candidate.nodeCpsId)) failures.push(`${itemId}.nodeCpsId: required non-empty string`);
    if (![1, 2, 3].includes(candidate.difficulty as number)) failures.push(`${itemId}.difficulty: expected 1, 2 or 3`);
    if (!Number.isInteger(candidate.targetTimeSec) || Number(candidate.targetTimeSec) < 15 || Number(candidate.targetTimeSec) > 300) {
      failures.push(`${itemId}.targetTimeSec: expected an integer from 15 to 300`);
    }
    if (!nonEmptyString(candidate.shortCorrection)) failures.push(`${itemId}.shortCorrection: required non-empty string`);

    if (!Array.isArray(candidate.options)) return;
    candidate.options.forEach((option, optionIndex) => {
      if (!isRecord(option) || option.isCorrect !== false || completeRationale(option.distractorRationale)) return;
      const optionId = nonEmptyString(option.id) ? String(option.id) : `option[${optionIndex}]`;
      failures.push(`${itemId}.options.${optionId}.distractorRationale: required for every distractor`);
    });
  });
  return failures;
}

export function loadBilanPack(relativePath: string): BilanPack {
  const raw = JSON.parse(readFileSync(resolveRepositoryPath(relativePath), 'utf8')) as unknown;
  const metadataFailures = collectItemMetadataFailures(raw);
  if (metadataFailures.length > 0) {
    throw new Error(`PACK_ITEM_METADATA_INVALID\n${metadataFailures.join('\n')}`);
  }
  const pack = packSchema.parse(raw);
  validatePromptBindings(pack);
  return deepFreeze(pack);
}

export function loadValidatedPack(relativePath: string): ValidatedPack {
  const pack = loadBilanPack(relativePath);
  const reviewer = pack.review.validatedBy;
  if (
    pack.status !== 'VALIDATED'
    || reviewer === null
    || reviewer.trim() === ''
    || FIXTURE_REVIEWER.test(reviewer)
    || pack.review.validatedAt === null
  ) {
    throw new Error('PACK_PEDAGOGICAL_VALIDATION_REQUIRED');
  }
  return buildValidatedPack({
    slug: pack.slug,
    version: pack.version,
    status: pack.status,
    review: { validatedBy: reviewer, validatedAt: pack.review.validatedAt },
    scoring: { domains: pack.scoring.domains },
    reporting: {
      rag: pack.reporting.rag,
      promptFiles: pack.reporting.promptFiles,
      outputSchemas: pack.reporting.outputSchemas,
    },
    validation: pack.validation,
  });
}
