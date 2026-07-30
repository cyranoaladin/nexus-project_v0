import 'server-only';

import { z } from 'zod';

import { verifyModelPolicyCapabilities } from './capabilities';
import { OpenRouterError } from './errors';
import {
  BILAN_MODEL_POLICY,
  BILAN_MODEL_POLICY_CHECKSUM,
} from './policy';
import type {
  OpenRouterCompletion,
  OpenRouterCompletionInput,
  OpenRouterModelCapabilitySnapshot,
  OpenRouterPreflightProof,
  OpenRouterRequestBody,
} from './types';
import type { OpenRouterConfig as ParsedOpenRouterConfig } from './config';

type OpenRouterClientDependencies = Readonly<{
  sleep?: (milliseconds: number) => Promise<void>;
  random?: () => number;
  now?: () => number;
}>;

const ResponseEnvelopeSchema = z.object({
  model: z.string().min(1),
  provider: z.string().optional(),
  choices: z.array(z.object({
    message: z.object({
      content: z.string(),
    }).passthrough(),
    finish_reason: z.string().nullable(),
  })).length(1),
  usage: z.object({
    prompt_tokens: z.number().int().nonnegative(),
    completion_tokens: z.number().int().nonnegative(),
    total_tokens: z.number().int().nonnegative(),
    cost: z.number().nonnegative(),
  }),
}).passthrough();

const MAX_RESPONSE_ENVELOPE_CHARACTERS = 4 * 1024 * 1024;
const MAX_RETRY_AFTER_MILLISECONDS = 30_000;
const MAX_PREFLIGHT_AGE_MILLISECONDS = 24 * 60 * 60 * 1_000;
const MAX_PREFLIGHT_CLOCK_SKEW_MILLISECONDS = 5 * 60 * 1_000;

async function readBoundedResponseText(response: Response): Promise<string> {
  const declaredLength = Number(response.headers.get('content-length'));
  if (
    Number.isFinite(declaredLength)
    && declaredLength > MAX_RESPONSE_ENVELOPE_CHARACTERS
  ) {
    await response.body?.cancel();
    throw new OpenRouterError('OPENROUTER_INVALID_RESPONSE');
  }
  if (response.body === null) return '';

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytesRead = 0;
  let result = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytesRead += value.byteLength;
      if (bytesRead > MAX_RESPONSE_ENVELOPE_CHARACTERS) {
        await reader.cancel();
        throw new OpenRouterError('OPENROUTER_INVALID_RESPONSE');
      }
      result += decoder.decode(value, { stream: true });
    }
    result += decoder.decode();
    return result;
  } finally {
    reader.releaseLock();
  }
}

function retryAfterMilliseconds(response: Response): number | null {
  const raw = response.headers.get('retry-after');
  if (!raw) return null;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1_000, MAX_RETRY_AFTER_MILLISECONDS);
  }
  const timestamp = Date.parse(raw);
  if (!Number.isFinite(timestamp)) return null;
  return Math.min(
    Math.max(0, timestamp - Date.now()),
    MAX_RETRY_AFTER_MILLISECONDS,
  );
}

function errorForStatus(status: number, retryAfterMs: number | null): OpenRouterError {
  if (status === 401) {
    return new OpenRouterError('OPENROUTER_INVALID_CREDENTIALS', { status });
  }
  if (status === 402) {
    return new OpenRouterError('OPENROUTER_INSUFFICIENT_CREDITS', { status });
  }
  if (status === 408) {
    return new OpenRouterError('OPENROUTER_TIMEOUT', {
      retryable: true,
      status,
      retryAfterMs,
    });
  }
  if (status === 429) {
    return new OpenRouterError('OPENROUTER_RATE_LIMITED', {
      retryable: true,
      status,
      retryAfterMs,
    });
  }
  if (status === 502) {
    return new OpenRouterError('OPENROUTER_PROVIDER_UNAVAILABLE', {
      retryable: true,
      status,
      retryAfterMs,
    });
  }
  if (status === 503) {
    return new OpenRouterError('OPENROUTER_NO_COMPLIANT_PROVIDER', {
      retryable: true,
      status,
      retryAfterMs,
    });
  }
  return new OpenRouterError('OPENROUTER_POLICY_REJECTED', { status });
}

function assertStrictSchema(schema: Readonly<Record<string, unknown>>): void {
  if (
    schema.type !== 'object'
    || schema.additionalProperties !== false
    || !Array.isArray(schema.required)
    || schema.required.length === 0
  ) {
    throw new OpenRouterError('OPENROUTER_POLICY_REJECTED');
  }
}

function assertPreflightProof(
  proof: OpenRouterPreflightProof,
  models: readonly string[],
  currentTime: number,
): void {
  const verifiedAt = Date.parse(proof.verifiedAt);
  if (
    proof.policyId !== BILAN_MODEL_POLICY.id
    || proof.policyVersion !== BILAN_MODEL_POLICY.version
    || proof.policyChecksum !== BILAN_MODEL_POLICY_CHECKSUM
    || !Number.isFinite(verifiedAt)
    || verifiedAt > currentTime + MAX_PREFLIGHT_CLOCK_SKEW_MILLISECONDS
    || currentTime - verifiedAt > MAX_PREFLIGHT_AGE_MILLISECONDS
  ) {
    throw new OpenRouterError('OPENROUTER_POLICY_REJECTED');
  }
  try {
    verifyModelPolicyCapabilities(proof.snapshots, {
      verifiedAt: proof.verifiedAt,
    });
  } catch {
    throw new OpenRouterError('OPENROUTER_POLICY_REJECTED');
  }
  if (
    proof.snapshots.length !== models.length
    || models.some((model) =>
      !proof.snapshots.some(({ requestedModelId }) =>
        requestedModelId === model))
  ) {
    throw new OpenRouterError('OPENROUTER_POLICY_REJECTED');
  }
}

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    throw new OpenRouterError('OPENROUTER_INVALID_RESPONSE');
  }
}

function responseErrorStatus(payload: unknown): number | null {
  if (
    payload !== null
    && typeof payload === 'object'
    && 'error' in payload
    && payload.error !== null
    && typeof payload.error === 'object'
    && 'code' in payload.error
  ) {
    const code = Number(payload.error.code);
    return Number.isInteger(code) ? code : null;
  }
  return null;
}

function isAbortError(error: unknown): boolean {
  return (
    error !== null
    && typeof error === 'object'
    && 'name' in error
    && error.name === 'AbortError'
  );
}

export class OpenRouterClient {
  private readonly config: ParsedOpenRouterConfig;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly random: () => number;
  private readonly now: () => number;

  constructor(
    config: ParsedOpenRouterConfig,
    dependencies: OpenRouterClientDependencies = {},
  ) {
    this.config = config;
    this.sleep = dependencies.sleep
      ?? ((milliseconds) =>
        new Promise((resolve) => setTimeout(resolve, milliseconds)));
    this.random = dependencies.random ?? Math.random;
    this.now = dependencies.now ?? Date.now;
  }

  async fetchModelCatalog(): Promise<unknown> {
    this.assertConfigured();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await fetch(new URL('models', this.config.baseUrl), {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
      if (!response.ok) {
        await response.body?.cancel();
        throw errorForStatus(
          response.status,
          retryAfterMilliseconds(response),
        );
      }
      const text = await readBoundedResponseText(response);
      const payload = safeJson(text);
      return payload;
    } catch (error) {
      if (error instanceof OpenRouterError) throw error;
      if (isAbortError(error)) {
        throw new OpenRouterError('OPENROUTER_TIMEOUT', { retryable: true });
      }
      throw new OpenRouterError('OPENROUTER_PROVIDER_UNAVAILABLE', {
        retryable: true,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  async complete<T>(
    input: OpenRouterCompletionInput<T>,
  ): Promise<OpenRouterCompletion<T>> {
    this.assertConfigured();
    assertStrictSchema(input.jsonSchema);
    const models = [
      this.config.primaryModel,
      ...this.config.fallbackModels,
    ];
    assertPreflightProof(input.preflightProof, models, this.now());

    let lastError: OpenRouterError | null = null;
    for (let index = 0; index < this.config.maxAttempts; index += 1) {
      const requestedModel = models[Math.min(index, models.length - 1)];
      const snapshot = input.preflightProof.snapshots.find(
        ({ requestedModelId }) => requestedModelId === requestedModel,
      );
      if (!snapshot) {
        throw new OpenRouterError('OPENROUTER_POLICY_REJECTED');
      }
      try {
        return await this.requestModel(input, snapshot, index + 1);
      } catch (error) {
        if (!(error instanceof OpenRouterError)) {
          throw new OpenRouterError('OPENROUTER_PROVIDER_UNAVAILABLE', {
            retryable: true,
          });
        }
        lastError = error;
        const hasNextAttempt = index + 1 < this.config.maxAttempts;
        if (!error.retryable || !hasNextAttempt) throw error;
        const delay = error.retryAfterMs
          ?? Math.min(1_000 * (2 ** index), 10_000)
            + Math.floor(this.random() * 250);
        await this.sleep(delay);
      }
    }
    throw lastError
      ?? new OpenRouterError('OPENROUTER_PROVIDER_UNAVAILABLE', {
        retryable: true,
      });
  }

  /**
   * Executes exactly one synthetic preflight invocation for an approved model.
   * Business workflows must use `complete`; this method exists only so private
   * release preflight can prove both policy-bound models independently.
   */
  async completePreflightForModel<T>(
    input: OpenRouterCompletionInput<T>,
    requestedModel: string,
  ): Promise<OpenRouterCompletion<T>> {
    this.assertConfigured();
    assertStrictSchema(input.jsonSchema);
    const models = [
      this.config.primaryModel,
      ...this.config.fallbackModels,
    ];
    assertPreflightProof(input.preflightProof, models, this.now());
    if (!models.includes(requestedModel)) {
      throw new OpenRouterError('OPENROUTER_POLICY_REJECTED');
    }
    const snapshot = input.preflightProof.snapshots.find(
      ({ requestedModelId }) => requestedModelId === requestedModel,
    );
    if (!snapshot) {
      throw new OpenRouterError('OPENROUTER_POLICY_REJECTED');
    }
    return this.requestModel(input, snapshot, 1);
  }

  private assertConfigured(): void {
    if (
      this.config.mode !== 'OPENROUTER_REQUIRED'
      || this.config.apiKey === null
    ) {
      throw new OpenRouterError('OPENROUTER_NOT_CONFIGURED');
    }
  }

  private async requestModel<T>(
    input: OpenRouterCompletionInput<T>,
    snapshot: OpenRouterModelCapabilitySnapshot,
    attemptNumber: number,
  ): Promise<OpenRouterCompletion<T>> {
    if (this.config.maxOutputTokens > snapshot.maxCompletionTokens) {
      throw new OpenRouterError('OPENROUTER_POLICY_REJECTED');
    }
    const body: OpenRouterRequestBody = {
      model: snapshot.requestedModelId,
      messages: input.messages,
      max_tokens: this.config.maxOutputTokens,
      reasoning: {
        effort: BILAN_MODEL_POLICY.reasoning.effort,
        exclude: BILAN_MODEL_POLICY.reasoning.excludeFromResponse,
      },
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: input.schemaName,
          strict: true,
          schema: input.jsonSchema,
        },
      },
      provider: {
        require_parameters:
          BILAN_MODEL_POLICY.providerPolicy.requireParameters,
        data_collection:
          BILAN_MODEL_POLICY.providerPolicy.dataCollection,
        zdr: BILAN_MODEL_POLICY.providerPolicy.zdr,
      },
      stream: false,
      usage: { include: true },
    };
    const startedAt = this.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(
        new URL('chat/completions', this.config.baseUrl),
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://nexusreussite.academy',
            // Native fetch requires ByteString-compatible HTTP header values.
            // The brand name is preserved; the em dash is transported as "-".
            'X-Title': 'Nexus Réussite - Bilans pédagogiques',
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        },
      );
      if (!response.ok) {
        await response.body?.cancel();
        throw errorForStatus(
          response.status,
          retryAfterMilliseconds(response),
        );
      }
      const responseText = await readBoundedResponseText(response);
      const payload = safeJson(responseText);
      const embeddedErrorStatus = responseErrorStatus(payload);
      if (embeddedErrorStatus !== null) {
        throw errorForStatus(
          embeddedErrorStatus,
          retryAfterMilliseconds(response),
        );
      }

      const parsed = ResponseEnvelopeSchema.safeParse(payload);
      if (!parsed.success) {
        throw new OpenRouterError('OPENROUTER_INVALID_RESPONSE');
      }
      const choice = parsed.data.choices[0];
      if (choice.finish_reason === 'error') {
        throw new OpenRouterError('OPENROUTER_PROVIDER_UNAVAILABLE', {
          retryable: true,
        });
      }
      const generationId = response.headers.get('x-generation-id')?.trim();
      if (!generationId || !choice.finish_reason) {
        throw new OpenRouterError('OPENROUTER_INVALID_RESPONSE');
      }
      if (
        parsed.data.model !== snapshot.requestedModelId
        && parsed.data.model !== snapshot.canonicalSlug
      ) {
        throw new OpenRouterError('OPENROUTER_POLICY_REJECTED');
      }
      if (
        parsed.data.usage.total_tokens
        !== parsed.data.usage.prompt_tokens
          + parsed.data.usage.completion_tokens
      ) {
        throw new OpenRouterError('OPENROUTER_INVALID_RESPONSE');
      }

      const costMicrosUsd = Math.round(parsed.data.usage.cost * 1_000_000);
      if (
        this.config.maxCostUsdPerReport !== null
        && parsed.data.usage.cost > this.config.maxCostUsdPerReport
      ) {
        throw new OpenRouterError('OPENROUTER_BUDGET_EXCEEDED');
      }

      const decoded = safeJson(choice.message.content);
      const validated = input.validator.safeParse(decoded);
      if (!validated.success) {
        throw new OpenRouterError('OPENROUTER_SCHEMA_FAILURE');
      }

      return Object.freeze({
        data: validated.data,
        provenance: Object.freeze({
          requestedModel: snapshot.requestedModelId,
          returnedModel: parsed.data.model,
          canonicalSlug: snapshot.canonicalSlug,
          generationId,
          finishReason: choice.finish_reason,
          promptTokens: parsed.data.usage.prompt_tokens,
          completionTokens: parsed.data.usage.completion_tokens,
          totalTokens: parsed.data.usage.total_tokens,
          costMicrosUsd,
          latencyMs: Math.max(0, this.now() - startedAt),
          attemptNumber,
          capabilityChecksum: snapshot.capabilityChecksum,
          policyId: BILAN_MODEL_POLICY.id,
          policyVersion: BILAN_MODEL_POLICY.version,
          policyChecksum: BILAN_MODEL_POLICY_CHECKSUM,
          responseSchemaVersion: input.schemaVersion,
        }),
      });
    } catch (error) {
      if (error instanceof OpenRouterError) throw error;
      if (isAbortError(error)) {
        throw new OpenRouterError('OPENROUTER_TIMEOUT', { retryable: true });
      }
      throw new OpenRouterError('OPENROUTER_PROVIDER_UNAVAILABLE', {
        retryable: true,
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}
