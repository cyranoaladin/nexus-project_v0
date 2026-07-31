import 'server-only';

import { createHmac } from 'node:crypto';
import { z } from 'zod';

import {
  BILAN_BENCHMARK_POLICY,
  BILAN_BENCHMARK_POLICY_CHECKSUM,
  benchmarkOutputTokenParameter,
  type BilanBenchmarkModelId,
} from './benchmark-policy';
import { createApiKeyFingerprint, hasValidCapabilityChecksum } from './capabilities';
import { OpenRouterError, OpenRouterModelCompatibilityError } from './errors';
import { canonicalJson, sha256Canonical } from './hash';
import type {
  OpenRouterBenchmarkCapabilityProof,
  OpenRouterModelCapabilitySnapshot,
} from './types';

const CatalogSchema = z.object({ data: z.array(z.unknown()) }).passthrough();
const EntrySchema = z.object({
  id: z.string().min(1),
  canonical_slug: z.string().min(1),
  context_length: z.number().int().positive(),
  supported_parameters: z.array(z.string()),
  top_provider: z.object({
    max_completion_tokens: z.number().int().positive(),
  }),
  reasoning: z.object({
    supported_efforts: z.array(z.string()).nullable().optional(),
  }).optional(),
}).passthrough();

const SHA256 = /^[a-f0-9]{64}$/;
const GIT_SHA = /^[a-f0-9]{40}$/;
const MAX_AGE_MS = 5 * 60 * 1_000;
const MAX_VALIDITY_MS = 24 * 60 * 60 * 1_000;

function proofChecksum(apiKey: string, values: unknown): string {
  return createHmac('sha256', apiKey)
    .update('nexus-openrouter-benchmark-proof-v1\0')
    .update(canonicalJson(values))
    .digest('hex');
}

function snapshotValues(
  snapshot: Omit<OpenRouterModelCapabilitySnapshot, 'capabilityChecksum'>,
) {
  return { ...snapshot };
}

export function buildBenchmarkCapabilityProof(
  catalog: unknown,
  options: Readonly<{
    apiKey: string;
    softwareSha: string;
    fetchedAt: string;
    verifiedAt: string;
    expiresAt: string;
  }>,
): OpenRouterBenchmarkCapabilityProof {
  const parsed = CatalogSchema.safeParse(catalog);
  const verifiedAtMs = Date.parse(options.verifiedAt);
  const expiresAtMs = Date.parse(options.expiresAt);
  const fetchedAtMs = Date.parse(options.fetchedAt);
  if (
    !parsed.success
    || !GIT_SHA.test(options.softwareSha)
    || !Number.isFinite(verifiedAtMs)
    || !Number.isFinite(expiresAtMs)
    || !Number.isFinite(fetchedAtMs)
    || fetchedAtMs > verifiedAtMs
    || verifiedAtMs - fetchedAtMs > MAX_AGE_MS
    || expiresAtMs <= verifiedAtMs
    || expiresAtMs - verifiedAtMs > MAX_VALIDITY_MS
  ) {
    throw new OpenRouterModelCompatibilityError();
  }
  const snapshots = BILAN_BENCHMARK_POLICY.models.map((policyModel) => {
    const candidate = parsed.data.data.find((entry) =>
      entry !== null
      && typeof entry === 'object'
      && 'id' in entry
      && entry.id === policyModel.id);
    const model = EntrySchema.safeParse(candidate);
    if (!model.success) throw new OpenRouterModelCompatibilityError();
    const supportedParameters = Object.freeze(
      [...new Set(model.data.supported_parameters)].sort(),
    );
    const reasoningEfforts = Object.freeze(
      [...new Set(model.data.reasoning?.supported_efforts ?? [])].sort(),
    );
    const outputTokenParameter = benchmarkOutputTokenParameter(
      policyModel.id,
    );
    const values = {
      requestedModelId: policyModel.id,
      canonicalSlug: model.data.canonical_slug,
      outputTokenParameter,
      fetchedAt: options.fetchedAt,
      supportedParameters,
      contextLength: model.data.context_length,
      maxCompletionTokens: model.data.top_provider.max_completion_tokens,
      structuredOutputsSupported:
        supportedParameters.includes('response_format')
        && supportedParameters.includes('structured_outputs'),
      temperatureDeclaredSupported:
        supportedParameters.includes('temperature'),
      reasoningSupported:
        (
          supportedParameters.includes('reasoning')
          || supportedParameters.includes('reasoning_effort')
        )
        && reasoningEfforts.includes('low'),
      reasoningEfforts,
    } as const;
    if (
      !values.structuredOutputsSupported
      || !values.reasoningSupported
      || !supportedParameters.includes(outputTokenParameter)
    ) {
      throw new OpenRouterModelCompatibilityError();
    }
    return Object.freeze({
      ...values,
      capabilityChecksum: sha256Canonical(snapshotValues(values)),
    });
  });
  const catalogChecksum = sha256Canonical(catalog);
  const values = {
    policyId: BILAN_BENCHMARK_POLICY.id,
    policyVersion: BILAN_BENCHMARK_POLICY.version,
    policyChecksum: BILAN_BENCHMARK_POLICY_CHECKSUM,
    catalogChecksum,
    apiKeyFingerprint: createApiKeyFingerprint(options.apiKey),
    softwareSha: options.softwareSha,
    verifiedAt: options.verifiedAt,
    expiresAt: options.expiresAt,
    snapshots: Object.freeze(snapshots),
  } as const;
  return Object.freeze({
    ...values,
    proofChecksum: proofChecksum(options.apiKey, values),
  });
}

export function assertBenchmarkCapabilityProof(
  proof: OpenRouterBenchmarkCapabilityProof,
  context: Readonly<{
    apiKey: string;
    softwareSha: string;
    currentTime: number;
  }>,
): void {
  const { proofChecksum: _checksum, ...values } = proof;
  const verifiedAtMs = Date.parse(proof.verifiedAt);
  const expiresAtMs = Date.parse(proof.expiresAt);
  const expectedModels = BILAN_BENCHMARK_POLICY.models.map(({ id }) => id);
  const actualModels = proof.snapshots.map(({ requestedModelId }) =>
    requestedModelId);
  const invalidSnapshot = proof.snapshots.some((snapshot) =>
    !hasValidCapabilityChecksum(snapshot)
    || !snapshot.structuredOutputsSupported
    || !snapshot.reasoningSupported
    || !snapshot.reasoningEfforts.includes('low')
    || !snapshot.supportedParameters.includes(snapshot.outputTokenParameter)
    || snapshot.outputTokenParameter !== benchmarkOutputTokenParameter(
      snapshot.requestedModelId as BilanBenchmarkModelId,
    ));
  if (
    proof.policyId !== BILAN_BENCHMARK_POLICY.id
    || proof.policyVersion !== BILAN_BENCHMARK_POLICY.version
    || proof.policyChecksum !== BILAN_BENCHMARK_POLICY_CHECKSUM
    || !SHA256.test(proof.catalogChecksum)
    || proof.apiKeyFingerprint !== createApiKeyFingerprint(context.apiKey)
    || proof.softwareSha !== context.softwareSha
    || !GIT_SHA.test(proof.softwareSha)
    || proof.proofChecksum !== proofChecksum(context.apiKey, values)
    || JSON.stringify(actualModels) !== JSON.stringify(expectedModels)
    || !Number.isFinite(verifiedAtMs)
    || !Number.isFinite(expiresAtMs)
    || verifiedAtMs > context.currentTime
    || expiresAtMs <= context.currentTime
    || expiresAtMs - verifiedAtMs > MAX_VALIDITY_MS
    || invalidSnapshot
  ) {
    throw new OpenRouterError('OPENROUTER_POLICY_REJECTED');
  }
}
