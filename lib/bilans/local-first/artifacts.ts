import 'server-only';

import {
  closeSync,
  constants,
  fsyncSync,
  linkSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import { sha256Canonical } from '@/lib/llm/openrouter/hash';

import {
  PiiScanResultSchema,
  piiScanResultMatchesContent,
  scanPiiFields,
  validatePiiScanResultChecksum,
} from './pii';

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const GitShaSchema = z.string().regex(/^[a-f0-9]{40}$/);

const ArtifactTypeSchema = z.enum([
  'NORMALIZED_ASSESSMENT',
  'SCORE_SNAPSHOT',
  'EVIDENCE_SNAPSHOT',
  'REPORT_CONTEXT',
  'LLM_DRAFT',
  'GROUNDING_VALIDATION',
  'HUMAN_REVIEW',
  'APPROVED_REVISION',
]);

const ARTIFACT_ORDER = ArtifactTypeSchema.options;
const SAFE_JSON_PROPERTY_NAME = /^[A-Za-z][A-Za-z0-9_]{0,79}$/;
type NumericArtifactMetricRule = Readonly<{
  pattern: RegExp;
  minimum: number;
  maximum: number;
  integer?: boolean;
}>;

const SAFE_NUMERIC_ARTIFACT_METRICS: readonly NumericArtifactMetricRule[] = [
  { pattern: /^\$\.payload\.points$/, minimum: 0, maximum: 100_000 },
  { pattern: /^\$\.payload\.maxPoints$/, minimum: 1, maximum: 100_000 },
  { pattern: /^\$\.payload\.score\.points$/, minimum: 0, maximum: 100_000 },
  { pattern: /^\$\.payload\.score\.maxPoints$/, minimum: 1, maximum: 100_000 },
  { pattern: /^\$\.payload\.scoreEcho\.points$/, minimum: 0, maximum: 100_000 },
  { pattern: /^\$\.payload\.scoreEcho\.maxPoints$/, minimum: 1, maximum: 100_000 },
  {
    pattern: /^\$\.payload\.scoreEcho\.percentage$/,
    minimum: 0,
    maximum: 100,
    integer: false,
  },
  { pattern: /^\$\.payload\.(?:usage|provenance)\.(?:promptTokens|completionTokens|reasoningTokens|totalTokens)$/, minimum: 0, maximum: 10_000_000 },
  { pattern: /^\$\.payload\.(?:usage|provenance)\.costMicrosUsd$/, minimum: 0, maximum: 15_000_000 },
  { pattern: /^\$\.payload\.provenance\.latencyMs$/, minimum: 0, maximum: 300_000 },
  { pattern: /^\$\.payload\.provenance\.attemptNumber$/, minimum: 1, maximum: 3 },
  { pattern: /^\$\.payload\.attempts\[\d+\]\.(?:promptTokens|completionTokens|reasoningTokens|totalTokens)$/, minimum: 0, maximum: 10_000_000 },
  { pattern: /^\$\.payload\.attempts\[\d+\]\.costMicrosUsd$/, minimum: 0, maximum: 15_000_000 },
  { pattern: /^\$\.payload\.attempts\[\d+\]\.latencyMs$/, minimum: 0, maximum: 300_000 },
  { pattern: /^\$\.payload\.attempts\[\d+\]\.attemptNumber$/, minimum: 1, maximum: 3 },
  { pattern: /^\$\.payload\.actionPlan\[\d+\]\.durationWeeks$/, minimum: 1, maximum: 104 },
];

function isSafeNumericArtifactMetric(path: string, value: number): boolean {
  if (!Number.isFinite(value)) return false;
  const rule = SAFE_NUMERIC_ARTIFACT_METRICS.find(({ pattern }) =>
    pattern.test(path));
  return rule !== undefined
    && (rule.integer === false || Number.isSafeInteger(value))
    && value >= rule.minimum
    && value <= rule.maximum;
}

function isApprovedPiiScanObjectPath(path: string): boolean {
  return path === '$.payload.piiScanResult'
    || /^\$\.payload\.approvedEvidenceForLlm\[\d+\]\.piiScanResult$/.test(path)
    || path === '$.payload.llmApprovedInternalNotes.piiScanResult';
}

function isPlainJsonValue(
  value: unknown,
  ancestors = new Set<object>(),
): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return true;
  }
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object') return false;
  if (ancestors.has(value)) return false;

  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
    return false;
  }

  const nextAncestors = new Set(ancestors).add(value);
  if (Array.isArray(value)) {
    const enumerableKeys = Object.keys(value);
    if (
      Object.getOwnPropertySymbols(value).length > 0
      || Object.getOwnPropertyNames(value).length !== value.length + 1
      || enumerableKeys.length !== value.length
      || enumerableKeys.some((key, index) => key !== String(index))
    ) return false;
    return value.every((item) => isPlainJsonValue(item, nextAncestors));
  }

  const propertyNames = Object.getOwnPropertyNames(value);
  if (
    Object.getOwnPropertySymbols(value).length > 0
    || propertyNames.length !== Object.keys(value).length
    || propertyNames.some((key) => !SAFE_JSON_PROPERTY_NAME.test(key))
  ) return false;
  return propertyNames.every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor !== undefined
      && descriptor.enumerable
      && 'value' in descriptor
      && isPlainJsonValue(descriptor.value, nextAncestors);
  });
}

function clonePlainJsonValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
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

type ArtifactPiiField = Readonly<{
  path: string;
  text: string;
  source: 'CONTROLLED_TEMPLATE' | 'UNCLASSIFIED_FREE_TEXT';
}>;

function payloadPiiFields(
  value: unknown,
  path = '$.payload',
  insideValidatedPiiScan = false,
): ArtifactPiiField[] {
  if (typeof value === 'string' || typeof value === 'number') {
    return [{
      path,
      text: String(value),
      source: typeof value === 'number'
        && !(
          isSafeNumericArtifactMetric(path, value)
          || (
            insideValidatedPiiScan
            && path.endsWith('.piiScanResult.redactionCount')
            && Number.isSafeInteger(value)
            && value >= 0
            && value <= 1_000
          )
        )
        ? 'UNCLASSIFIED_FREE_TEXT'
        : 'CONTROLLED_TEMPLATE',
    }];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      payloadPiiFields(item, `${path}[${index}]`, insideValidatedPiiScan));
  }
  if (value === null || typeof value !== 'object') return [];
  const currentPiiScan = isApprovedPiiScanObjectPath(path)
    && PiiScanResultSchema.safeParse(value).success
    && validatePiiScanResultChecksum(
      value as z.infer<typeof PiiScanResultSchema>,
    );
  return Object.entries(value).flatMap(([key, item]) =>
    payloadPiiFields(
      item,
      `${path}.${key}`,
      insideValidatedPiiScan || currentPiiScan,
    ));
}

export function scanLocalFirstArtifactPayload(
  payload: unknown,
): z.infer<typeof PiiScanResultSchema> {
  if (!isPlainJsonValue(payload)) {
    throw new TypeError('Artifact payload must contain plain JSON values only.');
  }
  return scanPiiFields(payloadPiiFields(payload)).result;
}

function piiScanMatchesPayload(
  scan: z.infer<typeof PiiScanResultSchema>,
  payload: unknown,
): boolean {
  const trustedFields = payloadPiiFields(payload);
  const trustedScan = scanLocalFirstArtifactPayload(payload);
  return trustedScan.status === 'CLEAN'
    && scan.checksum === trustedScan.checksum
    && piiScanResultMatchesContent(
    scan,
    trustedFields,
    'SCANNED',
  );
}

export const LocalFirstArtifactEnvelopeSchema = z.object({
  artifactId: z.string().uuid(),
  artifactType: ArtifactTypeSchema,
  schemaVersion: z.literal('local-first-artifact-envelope-v1'),
  repositorySha: GitShaSchema,
  datasetVersion: z.string().min(1).max(120),
  parentArtifactChecksum: Sha256Schema.nullable(),
  artifactChecksum: Sha256Schema,
  generatedAt: z.string().datetime({ offset: true }),
  generatorId: z.string().regex(/^[a-z][a-z0-9:_-]{2,79}$/),
  generatorVersion: z.string().min(1).max(40),
  scoringPolicyChecksum: Sha256Schema,
  corpusChecksum: Sha256Schema,
  promptChecksum: Sha256Schema.nullable(),
  outputSchemaChecksum: Sha256Schema.nullable(),
  audience: z.enum(['PARENT', 'STUDENT', 'NEXUS']),
  classification: z.enum([
    'SYNTHETIC_BENCHMARK',
    'CONFIDENTIAL_PEDAGOGICAL',
    'INTERNAL_NEXUS',
  ]),
  piiScanResult: PiiScanResultSchema,
  payload: z.unknown(),
}).strict().superRefine((value, context) => {
  if (!isPlainJsonValue(value.payload)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['payload'],
      message: 'Artifact payload must contain plain JSON values only.',
    });
    return;
  }
  const isRoot = value.artifactType === 'NORMALIZED_ASSESSMENT';
  if (isRoot && value.parentArtifactChecksum !== null) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['parentArtifactChecksum'],
      message: 'The root artifact cannot have a parent.',
    });
  }
  if (!isRoot && value.parentArtifactChecksum === null) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['parentArtifactChecksum'],
      message: 'A non-root artifact requires a parent.',
    });
  }
  if (!piiScanMatchesPayload(value.piiScanResult, value.payload)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['piiScanResult'],
      message: 'The PII scan is not bound to the artifact payload.',
    });
  }
});

export type LocalFirstArtifactEnvelope = z.infer<
  typeof LocalFirstArtifactEnvelopeSchema
>;

type CreateArtifactInput = Readonly<{
  artifactType: z.infer<typeof ArtifactTypeSchema>;
  repositorySha: string;
  expectedRepositorySha: string;
  datasetVersion: string;
  generatorId: string;
  generatorVersion: string;
  scoringPolicyChecksum: string;
  corpusChecksum: string;
  promptChecksum: string | null;
  outputSchemaChecksum: string | null;
  audience: 'PARENT' | 'STUDENT' | 'NEXUS';
  classification:
    | 'SYNTHETIC_BENCHMARK'
    | 'CONFIDENTIAL_PEDAGOGICAL'
    | 'INTERNAL_NEXUS';
  piiScanResult: z.infer<typeof PiiScanResultSchema>;
  payload: unknown;
  parent?: LocalFirstArtifactEnvelope;
  now?: Date;
}>;

function valuesForChecksum(
  artifact: Omit<LocalFirstArtifactEnvelope, 'artifactChecksum'>
    & Partial<Pick<LocalFirstArtifactEnvelope, 'artifactChecksum'>>,
): Omit<LocalFirstArtifactEnvelope, 'artifactChecksum'> {
  const { artifactChecksum: _checksum, ...values } = artifact;
  return values as Omit<LocalFirstArtifactEnvelope, 'artifactChecksum'>;
}

export function hasValidArtifactChecksum(input: unknown): boolean {
  const parsed = LocalFirstArtifactEnvelopeSchema.safeParse(input);
  if (!parsed.success) return false;
  return parsed.data.artifactChecksum
    === sha256Canonical(valuesForChecksum(parsed.data));
}

export function createLocalFirstArtifact(
  input: CreateArtifactInput,
): LocalFirstArtifactEnvelope {
  if (!isPlainJsonValue(input.payload)) {
    throw new TypeError('Artifact payload must contain plain JSON values only.');
  }
  const payload = clonePlainJsonValue(input.payload);
  if (
    !GitShaSchema.safeParse(input.repositorySha).success
    || input.repositorySha !== input.expectedRepositorySha
  ) {
    throw new Error('Artifact repository SHA differs from the clean checkout.');
  }
  if (!validatePiiScanResultChecksum(input.piiScanResult)) {
    throw new Error('Artifact PII scan checksum is invalid.');
  }
  if (!piiScanMatchesPayload(input.piiScanResult, payload)) {
    throw new Error(
      'Artifact trusted PII scan is not bound to a transport-safe payload.',
    );
  }
  const isRoot = input.artifactType === 'NORMALIZED_ASSESSMENT';
  if (isRoot && input.parent !== undefined) {
    throw new Error('The root artifact cannot have a parent.');
  }
  if (!isRoot && input.parent === undefined) {
    throw new Error('A non-root artifact requires a parent.');
  }
  if (
    input.parent !== undefined
    && (
      !hasValidArtifactChecksum(input.parent)
      || input.parent.repositorySha !== input.repositorySha
      || input.parent.datasetVersion !== input.datasetVersion
      || input.parent.audience !== input.audience
    )
  ) {
    throw new Error('Artifact parent is invalid or belongs to another chain.');
  }
  if (input.parent !== undefined) {
    const parentIndex = ARTIFACT_ORDER.indexOf(input.parent.artifactType);
    const childIndex = ARTIFACT_ORDER.indexOf(input.artifactType);
    if (childIndex !== parentIndex + 1) {
      throw new Error('Artifact type does not follow its parent.');
    }
  }

  const values = {
    artifactId: randomUUID(),
    artifactType: input.artifactType,
    schemaVersion: 'local-first-artifact-envelope-v1' as const,
    repositorySha: input.repositorySha,
    datasetVersion: input.datasetVersion,
    parentArtifactChecksum: input.parent?.artifactChecksum ?? null,
    generatedAt: (input.now ?? new Date()).toISOString(),
    generatorId: input.generatorId,
    generatorVersion: input.generatorVersion,
    scoringPolicyChecksum: input.scoringPolicyChecksum,
    corpusChecksum: input.corpusChecksum,
    promptChecksum: input.promptChecksum,
    outputSchemaChecksum: input.outputSchemaChecksum,
    audience: input.audience,
    classification: input.classification,
    piiScanResult: input.piiScanResult,
    payload,
  };
  return deepFreeze(LocalFirstArtifactEnvelopeSchema.parse({
    ...values,
    artifactChecksum: sha256Canonical(values),
  }));
}

export function validateArtifactChain(
  inputs: readonly unknown[],
): readonly LocalFirstArtifactEnvelope[] {
  if (inputs.length === 0) throw new Error('Artifact chain is empty.');
  const chain = inputs.map((input) =>
    LocalFirstArtifactEnvelopeSchema.parse(input));
  chain.forEach((artifact, index) => {
    if (!hasValidArtifactChecksum(artifact)) {
      throw new Error(`Artifact checksum mismatch at index ${index}.`);
    }
    if (index === 0) {
      if (
        artifact.artifactType !== 'NORMALIZED_ASSESSMENT'
        || artifact.parentArtifactChecksum !== null
      ) {
        throw new Error('Artifact chain does not begin at its root.');
      }
      return;
    }
    const parent = chain[index - 1];
    if (
      artifact.parentArtifactChecksum !== parent.artifactChecksum
      || artifact.repositorySha !== parent.repositorySha
      || artifact.datasetVersion !== parent.datasetVersion
      || artifact.audience !== parent.audience
      || ARTIFACT_ORDER.indexOf(artifact.artifactType)
        !== ARTIFACT_ORDER.indexOf(parent.artifactType) + 1
    ) {
      throw new Error(`Artifact chain is broken at index ${index}.`);
    }
  });
  const ownedChain = chain.map((artifact) =>
    clonePlainJsonValue(artifact));
  return Object.freeze(ownedChain.map((artifact) => deepFreeze(artifact)));
}

export function writeLocalFirstArtifactAtomic(
  path: string,
  input: LocalFirstArtifactEnvelope,
): void {
  const artifact = LocalFirstArtifactEnvelopeSchema.parse(input);
  if (!hasValidArtifactChecksum(artifact)) {
    throw new Error('Artifact checksum is invalid.');
  }
  const temporaryPath = join(
    dirname(path),
    `.${basename(path)}.${randomUUID()}.tmp`,
  );
  let descriptor: number | null = null;
  try {
    descriptor = openSync(
      temporaryPath,
      constants.O_CREAT
        | constants.O_EXCL
        | constants.O_WRONLY
        | constants.O_NOFOLLOW,
      0o600,
    );
    writeFileSync(descriptor, `${JSON.stringify(artifact, null, 2)}\n`, {
      encoding: 'utf8',
    });
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = null;
    try {
      linkSync(temporaryPath, path);
    } catch (error) {
      if (
        error !== null
        && typeof error === 'object'
        && 'code' in error
        && error.code === 'EEXIST'
      ) {
        throw new Error('Artifact already exists; overwrite is forbidden.');
      }
      throw error;
    }
  } finally {
    if (descriptor !== null) closeSync(descriptor);
    try {
      unlinkSync(temporaryPath);
    } catch (error) {
      if (
        error === null
        || typeof error !== 'object'
        || !('code' in error)
        || error.code !== 'ENOENT'
      ) {
        throw error;
      }
    }
  }
}

export function readLocalFirstArtifact(
  path: string,
): LocalFirstArtifactEnvelope {
  const artifact = LocalFirstArtifactEnvelopeSchema.parse(
    JSON.parse(readFileSync(path, 'utf8')),
  );
  if (!hasValidArtifactChecksum(artifact)) {
    throw new Error('Artifact checksum mismatch.');
  }
  return deepFreeze(artifact);
}
