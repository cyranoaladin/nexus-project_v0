import 'server-only';

import { z } from 'zod';

import benchmarkPolicyJson from '@/content/bilans/model-policies/bilan-model-benchmark-policy-v1.json';
import { sha256Canonical } from './hash';
import type { OpenRouterOutputTokenParameter } from './types';

const BenchmarkModelSchema = z.object({
  id: z.enum([
    'openai/gpt-5.6-luna',
    'openai/gpt-5.6-terra',
    'anthropic/claude-sonnet-5',
  ]),
  outputTokenParameter: z.enum([
    'max_tokens',
    'max_completion_tokens',
  ]),
}).strict();

const BenchmarkPolicySchema = z.object({
  id: z.literal('bilan-model-benchmark-policy'),
  version: z.literal('1'),
  models: z.tuple([
    BenchmarkModelSchema.extend({
      id: z.literal('openai/gpt-5.6-luna'),
      outputTokenParameter: z.literal('max_completion_tokens'),
    }).strict(),
    BenchmarkModelSchema.extend({
      id: z.literal('openai/gpt-5.6-terra'),
      outputTokenParameter: z.literal('max_completion_tokens'),
    }).strict(),
    BenchmarkModelSchema.extend({
      id: z.literal('anthropic/claude-sonnet-5'),
      outputTokenParameter: z.literal('max_tokens'),
    }).strict(),
  ]),
  reasoning: z.object({
    effort: z.literal('low'),
    excludeFromResponse: z.literal(true),
  }).strict(),
  providerPolicy: z.object({
    requireParameters: z.literal(true),
    dataCollection: z.literal('deny'),
    zdr: z.literal(true),
  }).strict(),
  maxOutputTokens: z.literal(2048),
  retryCount: z.literal(0),
  hardStopMicrosUsd: z.literal(1_500_000),
  warningMicrosUsd: z.literal(1_000_000),
  responseCaching: z.literal(false),
}).strict();

export type BilanBenchmarkModelId = z.infer<
  typeof BenchmarkModelSchema
>['id'];

export const BILAN_BENCHMARK_POLICY = Object.freeze(
  BenchmarkPolicySchema.parse(benchmarkPolicyJson),
);

export const BILAN_BENCHMARK_POLICY_CHECKSUM = sha256Canonical(
  BILAN_BENCHMARK_POLICY,
);

export function benchmarkOutputTokenParameter(
  model: BilanBenchmarkModelId,
): OpenRouterOutputTokenParameter {
  const entry = BILAN_BENCHMARK_POLICY.models.find(
    (candidate) => candidate.id === model,
  );
  if (entry === undefined) throw new Error('Unknown benchmark model.');
  return entry.outputTokenParameter;
}
