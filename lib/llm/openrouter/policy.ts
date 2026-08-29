import 'server-only';

import { z } from 'zod';

import policyJson from '@/content/bilans/model-policies/bilan-model-policy-v1.1.json';
import transportPolicyJson from '@/content/bilans/model-policies/bilan-transport-policy-v1.json';
import { sha256Canonical } from './hash';
import type {
  BilanModelPolicy,
  BilanTransportPolicy,
  OpenRouterOutputTokenParameter,
} from './types';

const ModelPolicySchema = z.object({
  id: z.literal('bilan-model-policy'),
  version: z.literal('1.1'),
  primaryModel: z.literal('anthropic/claude-sonnet-5'),
  fallbackModels: z.tuple([z.literal('openai/gpt-5.6-terra')]),
  temperature: z.object({ mode: z.literal('OMIT') }).strict(),
  topP: z.object({ mode: z.literal('OMIT') }).strict(),
  seed: z.object({ mode: z.literal('OMIT') }).strict(),
  reasoning: z.object({
    mode: z.literal('PREFLIGHT_REQUIRED'),
    effort: z.literal('low'),
    excludeFromResponse: z.literal(true),
  }).strict(),
  requiredCapabilities: z.tuple([
    z.literal('response_format'),
    z.literal('structured_outputs'),
    z.literal('max_tokens'),
  ]),
  providerPolicy: z.object({
    requireParameters: z.literal(true),
    dataCollection: z.literal('deny'),
    zdr: z.literal(true),
  }).strict(),
  retryPolicy: z.object({
    id: z.literal('bilan-retry-policy'),
    version: z.literal('1'),
    attemptPlan: z.tuple([
      z.literal('anthropic/claude-sonnet-5'),
      z.literal('openai/gpt-5.6-terra'),
      z.literal('openai/gpt-5.6-terra'),
    ]),
    maxAttempts: z.literal(3),
  }).strict(),
  automaticCapabilityEnablement: z.literal(false),
}).strict();

const TransportPolicySchema = z.object({
  id: z.literal('bilan-openrouter-transport-policy'),
  version: z.literal('1'),
  outputTokenParameters: z.object({
    'anthropic/claude-sonnet-5': z.literal('max_tokens'),
    'openai/gpt-5.6-terra': z.literal('max_completion_tokens'),
  }).strict(),
}).strict();

function deepFreeze<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
}

export const BILAN_MODEL_POLICY = deepFreeze(
  ModelPolicySchema.parse(policyJson),
) as BilanModelPolicy;

export const BILAN_MODEL_POLICY_CONFIG_VERSION =
  `${BILAN_MODEL_POLICY.id}-v${BILAN_MODEL_POLICY.version}` as const;

export const BILAN_MODEL_POLICY_CHECKSUM = sha256Canonical(BILAN_MODEL_POLICY);

export const BILAN_TRANSPORT_POLICY = deepFreeze(
  TransportPolicySchema.parse(transportPolicyJson),
) as BilanTransportPolicy;

export const BILAN_TRANSPORT_POLICY_CHECKSUM = sha256Canonical(
  BILAN_TRANSPORT_POLICY,
);

export function outputTokenParameterForModel(
  model: keyof BilanTransportPolicy['outputTokenParameters'],
): OpenRouterOutputTokenParameter {
  return BILAN_TRANSPORT_POLICY.outputTokenParameters[model];
}
