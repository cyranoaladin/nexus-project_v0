import 'server-only';

import type { z } from 'zod';

export type BilanReportGenerationMode = 'DISABLED' | 'OPENROUTER_REQUIRED';

export type BilanModelPolicy = Readonly<{
  id: 'bilan-model-policy';
  version: '1.1';
  primaryModel: 'anthropic/claude-sonnet-5';
  fallbackModels: readonly ['openai/gpt-5.6-terra'];
  temperature: Readonly<{ mode: 'OMIT' }>;
  topP: Readonly<{ mode: 'OMIT' }>;
  seed: Readonly<{ mode: 'OMIT' }>;
  reasoning: Readonly<{
    mode: 'PREFLIGHT_REQUIRED';
    effort: 'low';
    excludeFromResponse: true;
  }>;
  requiredCapabilities: readonly [
    'response_format',
    'structured_outputs',
    'max_tokens',
  ];
  providerPolicy: Readonly<{
    requireParameters: true;
    dataCollection: 'deny';
    zdr: true;
  }>;
  retryPolicy: Readonly<{
    id: 'bilan-retry-policy';
    version: '1';
    attemptPlan: readonly [
      'anthropic/claude-sonnet-5',
      'openai/gpt-5.6-terra',
      'openai/gpt-5.6-terra',
    ];
    maxAttempts: 3;
  }>;
  automaticCapabilityEnablement: false;
}>;

export type OpenRouterModelCapabilitySnapshot = Readonly<{
  requestedModelId: string;
  canonicalSlug: string;
  fetchedAt: string;
  supportedParameters: readonly string[];
  contextLength: number;
  maxCompletionTokens: number;
  structuredOutputsSupported: boolean;
  temperatureDeclaredSupported: boolean;
  reasoningSupported: boolean;
  reasoningEfforts: readonly string[];
  capabilityChecksum: string;
}>;

export type OpenRouterModelCatalogFetch = Readonly<{
  catalog: unknown;
  responseBytes: number;
}>;

export type OpenRouterPreflightProof = Readonly<{
  policyId: string;
  policyVersion: string;
  policyChecksum: string;
  catalogChecksum: string;
  apiKeyFingerprint: string;
  preflightSoftwareSha: string;
  verifiedAt: string;
  expiresAt: string;
  snapshots: readonly OpenRouterModelCapabilitySnapshot[];
  proofChecksum: string;
}>;

export type OpenRouterMessage = Readonly<{
  role: 'system' | 'user' | 'assistant';
  content: string;
}>;

export type StrictJsonSchema = Readonly<Record<string, unknown>>;

export type OpenRouterRequestBody = Readonly<{
  model: string;
  messages: readonly OpenRouterMessage[];
  max_tokens: number;
  reasoning: Readonly<{
    effort: 'low';
    exclude: true;
  }>;
  response_format: Readonly<{
    type: 'json_schema';
    json_schema: Readonly<{
      name: string;
      strict: true;
      schema: StrictJsonSchema;
    }>;
  }>;
  provider: Readonly<{
    require_parameters: true;
    data_collection: 'deny';
    zdr: true;
  }>;
  stream: false;
}>;

export type OpenRouterCompletionInput<T> = Readonly<{
  messages: readonly OpenRouterMessage[];
  schemaName: string;
  schemaVersion: string;
  jsonSchema: StrictJsonSchema;
  validator: z.ZodType<T>;
  preflightProof: OpenRouterPreflightProof;
}>;

export type OpenRouterTransportProvenance = Readonly<{
  requestedModel: string;
  returnedModel: string;
  provider: string | null;
  canonicalSlug: string;
  generationId: string;
  finishReason: string;
  promptTokens: number;
  completionTokens: number;
  reasoningTokens: number | null;
  totalTokens: number;
  costMicrosUsd: number;
  latencyMs: number;
  attemptNumber: number;
  capabilityChecksum: string;
  policyId: string;
  policyVersion: string;
  policyChecksum: string;
  responseSchemaVersion: string;
}>;

export type OpenRouterInvocationAttemptOutcome = 'SUCCEEDED' | 'FAILED';

export type OpenRouterInvocationAttempt = Readonly<{
  attemptNumber: number;
  requestedModel: string;
  startedAt: string;
  completedAt: string;
  latencyMs: number;
  outcome: OpenRouterInvocationAttemptOutcome;
  normalizedErrorCode: string | null;
  retryable: boolean;
  generationId: string | null;
  returnedModel: string | null;
  provider: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  reasoningTokens: number | null;
  totalTokens: number | null;
  costMicrosUsd: number | null;
  finishReason: string | null;
}>;

export type OpenRouterCompletion<T> = Readonly<{
  data: T;
  provenance: OpenRouterTransportProvenance;
  attempts: readonly OpenRouterInvocationAttempt[];
}>;
