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

export type OpenRouterPreflightProof = Readonly<{
  policyId: string;
  policyVersion: string;
  policyChecksum: string;
  verifiedAt: string;
  snapshots: readonly OpenRouterModelCapabilitySnapshot[];
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
  usage: Readonly<{ include: true }>;
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
  canonicalSlug: string;
  generationId: string;
  finishReason: string;
  promptTokens: number;
  completionTokens: number;
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

export type OpenRouterCompletion<T> = Readonly<{
  data: T;
  provenance: OpenRouterTransportProvenance;
}>;
