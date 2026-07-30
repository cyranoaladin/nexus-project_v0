import 'server-only';

import { z } from 'zod';

import capabilityBaseline from '@/content/bilans/model-policies/openrouter-capability-baseline-v1.1.json';
import { OpenRouterModelCompatibilityError } from './errors';
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
  options: Readonly<{ verifiedAt?: string }> = {},
): OpenRouterPreflightProof {
  const requiredModels = requestedModels();
  if (snapshots.length !== requiredModels.length) {
    throw new OpenRouterModelCompatibilityError();
  }
  if (!Number.isFinite(Date.parse(options.verifiedAt ?? new Date().toISOString()))) {
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
  return Object.freeze({
    policyId: BILAN_MODEL_POLICY.id,
    policyVersion: BILAN_MODEL_POLICY.version,
    policyChecksum: BILAN_MODEL_POLICY_CHECKSUM,
    verifiedAt: options.verifiedAt ?? new Date().toISOString(),
    snapshots: Object.freeze([...snapshots]),
  });
}
