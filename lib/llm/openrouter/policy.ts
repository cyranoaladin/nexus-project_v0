import 'server-only';

import { z } from 'zod';

import policyJson from '@/content/bilans/model-policies/bilan-model-policy-v1.1.json';
import { sha256Canonical } from './hash';
import type { BilanModelPolicy } from './types';

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
  automaticCapabilityEnablement: z.literal(false),
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
