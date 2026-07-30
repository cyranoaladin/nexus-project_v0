import 'server-only';

import { createHmac } from 'node:crypto';
import { z } from 'zod';

import capabilityBaseline from '@/content/bilans/model-policies/openrouter-capability-baseline-v1.1.json';
import {
  OpenRouterError,
  OpenRouterModelCompatibilityError,
} from './errors';
import { sha256Canonical } from './hash';
import {
  BILAN_MODEL_POLICY,
  BILAN_MODEL_POLICY_CHECKSUM,
} from './policy';
import type {
  OpenRouterModelCapabilitySnapshot,
  OpenRouterPreflightProof,
} from './types';

const ModelCatalogSchema = z.object({
  data: z.array(z.object({
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
  })),
}).passthrough();

const parsedCapabilityBaseline = ModelCatalogSchema.parse(capabilityBaseline);
const MAX_SNAPSHOT_TO_VERIFICATION_MILLISECONDS = 5 * 60 * 1_000;
const MAX_PROOF_VALIDITY_MILLISECONDS = 24 * 60 * 60 * 1_000;
const SHA_256_PATTERN = /^[a-f0-9]{64}$/;
const GIT_SHA_PATTERN = /^[a-f0-9]{40}$/;

function approvedCanonicalSlug(requestedModelId: string): string {
  const approved = parsedCapabilityBaseline.data.find(
    ({ id }) => id === requestedModelId,
  )?.canonical_slug;
  if (!approved) throw new OpenRouterModelCompatibilityError();
  return approved;
}

function requestedModels(): readonly string[] {
  return [
    BILAN_MODEL_POLICY.primaryModel,
    ...BILAN_MODEL_POLICY.fallbackModels,
  ];
}

export function createApiKeyFingerprint(apiKey: string): string {
  if (apiKey.trim() === '') throw new OpenRouterModelCompatibilityError();
  return createHmac('sha256', apiKey)
    .update('nexus-openrouter-api-key-fingerprint-v1')
    .digest('hex');
}

function snapshotChecksumValues(
  snapshot: Omit<OpenRouterModelCapabilitySnapshot, 'capabilityChecksum'>,
) {
  return {
    requestedModelId: snapshot.requestedModelId,
    canonicalSlug: snapshot.canonicalSlug,
    fetchedAt: snapshot.fetchedAt,
    supportedParameters: snapshot.supportedParameters,
    contextLength: snapshot.contextLength,
    maxCompletionTokens: snapshot.maxCompletionTokens,
    structuredOutputsSupported: snapshot.structuredOutputsSupported,
    temperatureDeclaredSupported: snapshot.temperatureDeclaredSupported,
    reasoningSupported: snapshot.reasoningSupported,
    reasoningEfforts: snapshot.reasoningEfforts,
  };
}

export function hasValidCapabilityChecksum(
  snapshot: OpenRouterModelCapabilitySnapshot,
): boolean {
  const { capabilityChecksum: _checksum, ...values } = snapshot;
  return snapshot.capabilityChecksum === sha256Canonical(
    snapshotChecksumValues(values),
  );
}

export function buildCapabilitySnapshots(
  catalog: unknown,
  options: Readonly<{ fetchedAt?: string }> = {},
): readonly OpenRouterModelCapabilitySnapshot[] {
  const parsed = ModelCatalogSchema.safeParse(catalog);
  if (!parsed.success) throw new OpenRouterModelCompatibilityError();
  const fetchedAt = options.fetchedAt ?? new Date().toISOString();

  return Object.freeze(requestedModels().map((requestedModelId) => {
    const model = parsed.data.data.find(({ id }) => id === requestedModelId);
    if (!model) throw new OpenRouterModelCompatibilityError();
    const supportedParameters = Object.freeze(
      [...new Set(model.supported_parameters)].sort(),
    );
    const reasoningEfforts = Object.freeze(
      [...new Set(model.reasoning?.supported_efforts ?? [])].sort(),
    );
    const values = {
      requestedModelId,
      canonicalSlug: model.canonical_slug,
      fetchedAt,
      supportedParameters,
      contextLength: model.context_length,
      maxCompletionTokens: model.top_provider.max_completion_tokens,
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
        && reasoningEfforts.includes(BILAN_MODEL_POLICY.reasoning.effort),
      reasoningEfforts,
    };
    return Object.freeze({
      ...values,
      capabilityChecksum: sha256Canonical(values),
    });
  }));
}

export function verifyModelPolicyCapabilities(
  snapshots: readonly OpenRouterModelCapabilitySnapshot[],
  options: Readonly<{
    verifiedAt: string;
    expiresAt: string;
    apiKey: string;
    preflightSoftwareSha: string;
    catalogChecksum: string;
  }>,
): OpenRouterPreflightProof {
  const requiredModels = requestedModels();
  if (snapshots.length !== requiredModels.length) {
    throw new OpenRouterModelCompatibilityError();
  }
  const verifiedAtMs = Date.parse(options.verifiedAt);
  const expiresAtMs = Date.parse(options.expiresAt);
  if (
    !Number.isFinite(verifiedAtMs)
    || !Number.isFinite(expiresAtMs)
    || expiresAtMs <= verifiedAtMs
    || expiresAtMs - verifiedAtMs > MAX_PROOF_VALIDITY_MILLISECONDS
    || !SHA_256_PATTERN.test(options.catalogChecksum)
    || !GIT_SHA_PATTERN.test(options.preflightSoftwareSha)
  ) {
    throw new OpenRouterModelCompatibilityError();
  }
  for (const modelId of requiredModels) {
    const snapshot = snapshots.find(
      ({ requestedModelId }) => requestedModelId === modelId,
    );
    if (
      !snapshot
      || snapshot.canonicalSlug !== approvedCanonicalSlug(modelId)
      || !Number.isFinite(Date.parse(snapshot.fetchedAt))
      || Date.parse(snapshot.fetchedAt) > verifiedAtMs
      || verifiedAtMs - Date.parse(snapshot.fetchedAt)
        > MAX_SNAPSHOT_TO_VERIFICATION_MILLISECONDS
      || !Number.isInteger(snapshot.contextLength)
      || snapshot.contextLength <= 0
      || !Number.isInteger(snapshot.maxCompletionTokens)
      || snapshot.maxCompletionTokens <= 0
      || snapshot.structuredOutputsSupported !== (
        snapshot.supportedParameters.includes('response_format')
        && snapshot.supportedParameters.includes('structured_outputs')
      )
      || snapshot.temperatureDeclaredSupported
        !== snapshot.supportedParameters.includes('temperature')
      || snapshot.reasoningSupported !== (
        (
          snapshot.supportedParameters.includes('reasoning')
          || snapshot.supportedParameters.includes('reasoning_effort')
        )
        && snapshot.reasoningEfforts.includes(
          BILAN_MODEL_POLICY.reasoning.effort,
        )
      )
      || !snapshot.structuredOutputsSupported
      || !snapshot.reasoningSupported
      || !snapshot.reasoningEfforts.includes(BILAN_MODEL_POLICY.reasoning.effort)
      || BILAN_MODEL_POLICY.requiredCapabilities.some(
        (capability) => !snapshot.supportedParameters.includes(capability),
      )
      || !hasValidCapabilityChecksum(snapshot)
    ) {
      throw new OpenRouterModelCompatibilityError();
    }
  }
  const values = {
    policyId: BILAN_MODEL_POLICY.id,
    policyVersion: BILAN_MODEL_POLICY.version,
    policyChecksum: BILAN_MODEL_POLICY_CHECKSUM,
    catalogChecksum: options.catalogChecksum,
    apiKeyFingerprint: createApiKeyFingerprint(options.apiKey),
    preflightSoftwareSha: options.preflightSoftwareSha,
    verifiedAt: options.verifiedAt,
    expiresAt: options.expiresAt,
    snapshots: Object.freeze([...snapshots]),
  };
  return Object.freeze({
    ...values,
    proofChecksum: sha256Canonical(values),
  });
}

export function assertOpenRouterPreflightProof(
  proof: OpenRouterPreflightProof,
  context: Readonly<{
    apiKey: string;
    preflightSoftwareSha: string;
    currentTime: number;
  }>,
): void {
  const {
    proofChecksum: _proofChecksum,
    ...proofValues
  } = proof;
  const verifiedAtMs = Date.parse(proof.verifiedAt);
  const expiresAtMs = Date.parse(proof.expiresAt);
  const validSnapshots = proof.snapshots.length === requestedModels().length
    && requestedModels().every((model) =>
      proof.snapshots.some(({ requestedModelId }) =>
        requestedModelId === model));
  if (
    proof.policyId !== BILAN_MODEL_POLICY.id
    || proof.policyVersion !== BILAN_MODEL_POLICY.version
    || proof.policyChecksum !== BILAN_MODEL_POLICY_CHECKSUM
    || !SHA_256_PATTERN.test(proof.catalogChecksum)
    || proof.apiKeyFingerprint !== createApiKeyFingerprint(context.apiKey)
    || proof.preflightSoftwareSha !== context.preflightSoftwareSha
    || !GIT_SHA_PATTERN.test(proof.preflightSoftwareSha)
    || proof.proofChecksum !== sha256Canonical(proofValues)
    || !Number.isFinite(verifiedAtMs)
    || !Number.isFinite(expiresAtMs)
    || verifiedAtMs > context.currentTime
    || expiresAtMs <= verifiedAtMs
    || expiresAtMs - verifiedAtMs > MAX_PROOF_VALIDITY_MILLISECONDS
    || context.currentTime > expiresAtMs
    || !validSnapshots
  ) {
    throw new OpenRouterError('OPENROUTER_POLICY_REJECTED');
  }
  for (const snapshot of proof.snapshots) {
    const fetchedAtMs = Date.parse(snapshot.fetchedAt);
    if (
      !Number.isFinite(fetchedAtMs)
      || fetchedAtMs > verifiedAtMs
      || verifiedAtMs - fetchedAtMs
        > MAX_SNAPSHOT_TO_VERIFICATION_MILLISECONDS
      || snapshot.canonicalSlug !== approvedCanonicalSlug(
        snapshot.requestedModelId,
      )
      || !hasValidCapabilityChecksum(snapshot)
      || !snapshot.structuredOutputsSupported
      || !snapshot.reasoningSupported
      || !Number.isInteger(snapshot.contextLength)
      || snapshot.contextLength <= 0
      || !Number.isInteger(snapshot.maxCompletionTokens)
      || snapshot.maxCompletionTokens <= 0
      || snapshot.structuredOutputsSupported !== (
        snapshot.supportedParameters.includes('response_format')
        && snapshot.supportedParameters.includes('structured_outputs')
      )
      || snapshot.temperatureDeclaredSupported
        !== snapshot.supportedParameters.includes('temperature')
      || snapshot.reasoningSupported !== (
        (
          snapshot.supportedParameters.includes('reasoning')
          || snapshot.supportedParameters.includes('reasoning_effort')
        )
        && snapshot.reasoningEfforts.includes(
          BILAN_MODEL_POLICY.reasoning.effort,
        )
      )
      || !snapshot.reasoningEfforts.includes(
        BILAN_MODEL_POLICY.reasoning.effort,
      )
      || BILAN_MODEL_POLICY.requiredCapabilities.some(
        (capability) => !snapshot.supportedParameters.includes(capability),
      )
    ) {
      throw new OpenRouterError('OPENROUTER_POLICY_REJECTED');
    }
  }
}
