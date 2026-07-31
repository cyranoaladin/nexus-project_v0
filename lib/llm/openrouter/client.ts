import 'server-only';

import { z } from 'zod';

import { assertOpenRouterPreflightProof } from './capabilities';
import type { OpenRouterConfig as ParsedOpenRouterConfig } from './config';
import {
  OpenRouterError,
  type OpenRouterErrorCode,
} from './errors';
import {
  assertTerraDiagnosticVariant,
  normalizeOpenRouterDiagnosticError,
} from './diagnostics';
import {
  BILAN_MODEL_POLICY,
  BILAN_MODEL_POLICY_CHECKSUM,
} from './policy';
import type {
  OpenRouterCompletion,
  OpenRouterCompletionInput,
  OpenRouterDiagnosticRequestBody,
  OpenRouterDiagnosticResult,
  OpenRouterDiagnosticVariant,
  OpenRouterInvocationAttempt,
  OpenRouterModelCatalogFetch,
  OpenRouterPreflightRoutingOptions,
  OpenRouterModelCapabilitySnapshot,
  OpenRouterRequestBody,
} from './types';

export type OpenRouterClientDependencies = Readonly<{
  sleep?: (milliseconds: number) => Promise<void>;
  random?: () => number;
  now?: () => number;
  preflightSoftwareSha?: string;
}>;

const ResponseEnvelopeSchema = z.object({
  model: z.string().min(1),
  provider: z.string().min(1).optional(),
  choices: z.array(z.object({
    message: z.object({
      content: z.string(),
    }).passthrough(),
    finish_reason: z.string().nullable(),
  })).length(1),
  usage: z.object({
    prompt_tokens: z.number().int().nonnegative(),
    completion_tokens: z.number().int().nonnegative(),
    completion_tokens_details: z.object({
      reasoning_tokens: z.number().int().nonnegative().optional(),
    }).passthrough().optional(),
    total_tokens: z.number().int().nonnegative(),
    cost: z.union([
      z.string().min(1),
      z.number().finite().nonnegative(),
    ]),
  }),
}).passthrough();

const ProviderErrorEnvelopeSchema = z.object({
  error: z.object({
    code: z.union([z.string(), z.number()]).optional(),
    type: z.union([z.string(), z.number()]).optional(),
    message: z.string().optional(),
    metadata: z.unknown().optional(),
  }).passthrough(),
}).passthrough();

export const MAX_COMPLETION_RESPONSE_BYTES = 4 * 1024 * 1024;
export const MAX_MODEL_CATALOG_BYTES = 32 * 1024 * 1024;
export const MAX_PROVIDER_ERROR_BYTES = 64 * 1024;

const MAX_RETRY_AFTER_MILLISECONDS = 30_000;
const USD_DECIMAL_PATTERN = /^(0|[1-9]\d*)(?:\.(\d{1,12}))?$/;

async function readBoundedResponseText(
  response: Response,
  maximumBytes: number,
): Promise<string> {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
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
      if (bytesRead > maximumBytes) {
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

type ProviderErrorDescriptor = Readonly<{
  providerCode: string | null;
  safeErrorType: ReturnType<typeof normalizeOpenRouterDiagnosticError>['errorType'];
  safeErrorCode: ReturnType<typeof normalizeOpenRouterDiagnosticError>['errorCode'];
}>;

async function readProviderErrorDescriptor(
  response: Response,
): Promise<ProviderErrorDescriptor> {
  try {
    const text = await readBoundedResponseText(
      response,
      MAX_PROVIDER_ERROR_BYTES,
    );
    if (text === '') {
      return {
        providerCode: null,
        safeErrorType: 'unknown_safe_code',
        safeErrorCode: 'unknown_safe_code',
      };
    }
    const parsed: unknown = JSON.parse(text);
    const envelope = ProviderErrorEnvelopeSchema.safeParse(parsed);
    if (!envelope.success) {
      return {
        providerCode: null,
        safeErrorType: 'unknown_safe_code',
        safeErrorCode: 'unknown_safe_code',
      };
    }
    const safe = normalizeOpenRouterDiagnosticError({
      httpStatus: response.status,
      rawErrorType: envelope.data.error.type,
      rawErrorCode: envelope.data.error.code,
      retryable: false,
      requestVariantId: 'D1',
    });
    return {
      providerCode: envelope.data.error.code === undefined
        ? null
        : String(envelope.data.error.code).trim(),
      safeErrorType: safe.errorType,
      safeErrorCode: safe.errorCode,
    };
  } catch {
    return {
      providerCode: null,
      safeErrorType: 'unknown_safe_code',
      safeErrorCode: 'unknown_safe_code',
    };
  }
}

function retryAfterMilliseconds(
  response: Response,
  currentTime: number,
): number | null {
  const raw = response.headers.get('retry-after');
  if (!raw) return null;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1_000, MAX_RETRY_AFTER_MILLISECONDS);
  }
  const timestamp = Date.parse(raw);
  if (!Number.isFinite(timestamp)) return null;
  return Math.min(
    Math.max(0, timestamp - currentTime),
    MAX_RETRY_AFTER_MILLISECONDS,
  );
}

function isExplicitNoCompliantProvider(code: string | null): boolean {
  if (code === null) return false;
  return [
    'NO_COMPLIANT_PROVIDER',
    'OPENROUTER_NO_COMPLIANT_PROVIDER',
  ].includes(code.toUpperCase());
}

function errorForRecognizedProviderCode(
  code: string | null,
  status: number,
  retryAfterMs: number | null,
): OpenRouterError | null {
  if (code === null) return null;
  const normalized = code.trim().toUpperCase();
  if (isExplicitNoCompliantProvider(normalized)) {
    return new OpenRouterError('OPENROUTER_NO_COMPLIANT_PROVIDER', {
      retryable: true,
      status,
      retryAfterMs,
    });
  }
  if (['INVALID_API_KEY', 'AUTHENTICATION_ERROR'].includes(normalized)) {
    return new OpenRouterError('OPENROUTER_INVALID_CREDENTIALS', { status });
  }
  if (normalized === 'INSUFFICIENT_CREDITS') {
    return new OpenRouterError('OPENROUTER_INSUFFICIENT_CREDITS', { status });
  }
  if (['INVALID_REQUEST', 'INVALID_REQUEST_ERROR'].includes(normalized)) {
    return new OpenRouterError('OPENROUTER_INVALID_REQUEST', { status });
  }
  if (normalized === 'POLICY_REJECTED') {
    return new OpenRouterError('OPENROUTER_POLICY_REJECTED', { status });
  }
  if (['REQUEST_TIMEOUT', 'TIMEOUT'].includes(normalized)) {
    return new OpenRouterError('OPENROUTER_TIMEOUT', {
      retryable: true,
      status,
      retryAfterMs,
    });
  }
  if (['RATE_LIMITED', 'RATE_LIMIT_ERROR'].includes(normalized)) {
    return new OpenRouterError('OPENROUTER_RATE_LIMITED', {
      retryable: true,
      status,
      retryAfterMs,
    });
  }
  if (['PROVIDER_UNAVAILABLE', 'SERVICE_UNAVAILABLE'].includes(normalized)) {
    return new OpenRouterError('OPENROUTER_PROVIDER_UNAVAILABLE', {
      retryable: true,
      status,
      retryAfterMs,
    });
  }
  return null;
}

function errorForStatus(
  status: number,
  retryAfterMs: number | null,
  descriptor: ProviderErrorDescriptor,
): OpenRouterError {
  const providerFields = {
    providerErrorType: descriptor.safeErrorType,
    providerErrorCode: descriptor.safeErrorCode,
  } as const;
  if (status === 400) {
    return new OpenRouterError('OPENROUTER_INVALID_REQUEST', {
      status,
      ...providerFields,
    });
  }
  if (status === 401) {
    return new OpenRouterError('OPENROUTER_INVALID_CREDENTIALS', {
      status,
      ...providerFields,
    });
  }
  if (status === 402) {
    return new OpenRouterError('OPENROUTER_INSUFFICIENT_CREDITS', {
      status,
      ...providerFields,
    });
  }
  if (status === 403) {
    return new OpenRouterError('OPENROUTER_POLICY_REJECTED', {
      status,
      ...providerFields,
    });
  }
  const providerError = errorForRecognizedProviderCode(
    descriptor.providerCode,
    status,
    retryAfterMs,
  );
  if (providerError !== null) {
    return new OpenRouterError(providerError.code, {
      retryable: providerError.retryable,
      status: providerError.status,
      retryAfterMs: providerError.retryAfterMs,
      ...providerFields,
    });
  }
  if (status === 408) {
    return new OpenRouterError('OPENROUTER_TIMEOUT', {
      retryable: true,
      status,
      retryAfterMs,
      ...providerFields,
    });
  }
  if (status === 429) {
    return new OpenRouterError('OPENROUTER_RATE_LIMITED', {
      retryable: true,
      status,
      retryAfterMs,
      ...providerFields,
    });
  }
  if (status === 502 || status === 503) {
    return new OpenRouterError('OPENROUTER_PROVIDER_UNAVAILABLE', {
      retryable: true,
      status,
      retryAfterMs,
      ...providerFields,
    });
  }
  return new OpenRouterError('OPENROUTER_INVALID_REQUEST', {
    status,
    ...providerFields,
  });
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

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    throw new OpenRouterError('OPENROUTER_INVALID_RESPONSE');
  }
}

function embeddedErrorStatus(payload: unknown): Readonly<{
  status: number;
  descriptor: ProviderErrorDescriptor;
}> | null {
  const envelope = ProviderErrorEnvelopeSchema.safeParse(payload);
  if (!envelope.success) return null;
  const rawCode = envelope.data.error.code;
  if (rawCode === undefined) {
    return {
      status: 400,
      descriptor: {
        providerCode: null,
        safeErrorType: 'unknown_safe_code',
        safeErrorCode: 'unknown_safe_code',
      },
    };
  }
  const providerCode = String(rawCode).trim();
  const numericCode = Number(providerCode);
  const safe = normalizeOpenRouterDiagnosticError({
    httpStatus: Number.isInteger(numericCode) ? numericCode : 400,
    rawErrorType: envelope.data.error.type,
    rawErrorCode: rawCode,
    retryable: false,
    requestVariantId: 'D1',
  });
  return {
    status: Number.isInteger(numericCode) ? numericCode : 400,
    descriptor: {
      providerCode,
      safeErrorType: safe.errorType,
      safeErrorCode: safe.errorCode,
    },
  };
}

function isAbortError(error: unknown): boolean {
  return (
    error !== null
    && typeof error === 'object'
    && 'name' in error
    && error.name === 'AbortError'
  );
}

function safeDiagnosticCodeForError(
  code: OpenRouterErrorCode,
): ReturnType<typeof normalizeOpenRouterDiagnosticError>['errorCode'] {
  const mapping: Partial<Record<
    OpenRouterErrorCode,
    ReturnType<typeof normalizeOpenRouterDiagnosticError>['errorCode']
  >> = {
    OPENROUTER_INVALID_CREDENTIALS: 'authentication',
    OPENROUTER_INSUFFICIENT_CREDITS: 'payment_required',
    OPENROUTER_POLICY_REJECTED: 'permission_denied',
    OPENROUTER_RATE_LIMITED: 'rate_limit_exceeded',
    OPENROUTER_PROVIDER_UNAVAILABLE: 'provider_unavailable',
    OPENROUTER_NO_COMPLIANT_PROVIDER: 'provider_unavailable',
    OPENROUTER_INVALID_REQUEST: 'invalid_request',
  };
  return mapping[code] ?? 'unknown_safe_code';
}

function usdCostToMicros(value: string | number): number {
  if (typeof value === 'number') {
    const micros = Math.ceil(value * 1_000_000);
    if (
      !Number.isFinite(value)
      || value < 0
      || !Number.isSafeInteger(micros)
    ) {
      throw new OpenRouterError('OPENROUTER_INVALID_RESPONSE');
    }
    return micros;
  }
  const raw = value;
  const match = USD_DECIMAL_PATTERN.exec(raw);
  if (!match) throw new OpenRouterError('OPENROUTER_INVALID_RESPONSE');
  const whole = BigInt(match[1]);
  const fractional = match[2] ?? '';
  const firstSixDigits = fractional.slice(0, 6).padEnd(6, '0');
  let micros = whole * BigInt(1_000_000) + BigInt(firstSixDigits);
  if (/[1-9]/.test(fractional.slice(6))) micros += BigInt(1);
  if (micros > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new OpenRouterError('OPENROUTER_INVALID_RESPONSE');
  }
  return Number(micros);
}

function cloneErrorWithAttempts(
  error: OpenRouterError,
  attempts: readonly OpenRouterInvocationAttempt[],
): OpenRouterError {
  return new OpenRouterError(error.code, {
    retryable: error.retryable,
    status: error.status,
    retryAfterMs: error.retryAfterMs,
    attempts,
    providerErrorType: error.providerErrorType,
    providerErrorCode: error.providerErrorCode,
  });
}

export class OpenRouterClient {
  private readonly config: ParsedOpenRouterConfig;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly random: () => number;
  private readonly now: () => number;
  private readonly preflightSoftwareSha: string;

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
    this.preflightSoftwareSha = dependencies.preflightSoftwareSha ?? '';
  }

  async fetchModelCatalog(): Promise<unknown> {
    return (await this.fetchModelCatalogWithMetadata()).catalog;
  }

  async fetchModelCatalogWithMetadata(): Promise<OpenRouterModelCatalogFetch> {
    return this.fetchCatalog('models');
  }

  async fetchZdrEndpointCatalogWithMetadata(): Promise<OpenRouterModelCatalogFetch> {
    return this.fetchCatalog('endpoints/zdr');
  }

  private async fetchCatalog(
    relativePath: 'models' | 'endpoints/zdr',
  ): Promise<OpenRouterModelCatalogFetch> {
    this.assertConfigured();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await fetch(new URL(relativePath, this.config.baseUrl), {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
      if (!response.ok) {
        const retryAfterMs = retryAfterMilliseconds(response, this.now());
        const descriptor = await readProviderErrorDescriptor(response);
        throw errorForStatus(response.status, retryAfterMs, descriptor);
      }
      const text = await readBoundedResponseText(
        response,
        MAX_MODEL_CATALOG_BYTES,
      );
      return Object.freeze({
        catalog: safeJson(text),
        responseBytes: Buffer.byteLength(text, 'utf8'),
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

  async complete<T>(
    input: OpenRouterCompletionInput<T>,
  ): Promise<OpenRouterCompletion<T>> {
    this.assertConfigured();
    assertStrictSchema(input.jsonSchema);
    this.assertProof(input);

    const attempts: OpenRouterInvocationAttempt[] = [];
    const attemptPlan = BILAN_MODEL_POLICY.retryPolicy.attemptPlan;
    if (this.config.maxAttempts !== attemptPlan.length) {
      throw new OpenRouterError('OPENROUTER_POLICY_REJECTED');
    }
    for (let index = 0; index < attemptPlan.length; index += 1) {
      const requestedModel = attemptPlan[index];
      const snapshot = input.preflightProof.snapshots.find(
        ({ requestedModelId }) => requestedModelId === requestedModel,
      );
      if (!snapshot) throw new OpenRouterError('OPENROUTER_POLICY_REJECTED');
      try {
        const completion = await this.requestModel(
          input,
          snapshot,
          index + 1,
        );
        return Object.freeze({
          ...completion,
          attempts: Object.freeze([
            ...attempts,
            ...completion.attempts,
          ]),
        });
      } catch (caught) {
        const error = caught instanceof OpenRouterError
          ? caught
          : new OpenRouterError('OPENROUTER_PROVIDER_UNAVAILABLE', {
            retryable: true,
          });
        attempts.push(...error.attempts);
        const hasNextAttempt = index + 1 < attemptPlan.length;
        if (!error.retryable || !hasNextAttempt) {
          throw cloneErrorWithAttempts(error, attempts);
        }
        const delay = error.retryAfterMs
          ?? Math.min(1_000 * (2 ** index), 10_000)
            + Math.floor(this.random() * 250);
        await this.sleep(delay);
      }
    }
    throw new OpenRouterError('OPENROUTER_PROVIDER_UNAVAILABLE', {
      retryable: true,
      attempts,
    });
  }

  async completePreflightForModel<T>(
    input: OpenRouterCompletionInput<T>,
    requestedModel: string,
    routing: OpenRouterPreflightRoutingOptions = {},
  ): Promise<OpenRouterCompletion<T>> {
    this.assertConfigured();
    assertStrictSchema(input.jsonSchema);
    this.assertProof(input);
    const approvedModels: readonly string[] = [
      BILAN_MODEL_POLICY.primaryModel,
      ...BILAN_MODEL_POLICY.fallbackModels,
    ];
    if (!approvedModels.includes(requestedModel)) {
      throw new OpenRouterError('OPENROUTER_POLICY_REJECTED');
    }
    const snapshot = input.preflightProof.snapshots.find(
      ({ requestedModelId }) => requestedModelId === requestedModel,
    );
    if (!snapshot) throw new OpenRouterError('OPENROUTER_POLICY_REJECTED');
    if (
      routing.providerOnly !== undefined
      && (
        routing.providerOnly.length !== 1
        || !/^[a-z0-9][a-z0-9._-]{1,79}(?:\/[a-z0-9][a-z0-9._-]{0,79})?$/
          .test(routing.providerOnly[0])
      )
    ) {
      throw new OpenRouterError('OPENROUTER_POLICY_REJECTED');
    }
    return this.requestModel(input, snapshot, 1, undefined, routing);
  }

  async diagnosePreflightVariant<T>(
    input: OpenRouterCompletionInput<T>,
    requestedModel: 'openai/gpt-5.6-terra',
    variant: OpenRouterDiagnosticVariant,
  ): Promise<OpenRouterDiagnosticResult<T>> {
    this.assertConfigured();
    assertStrictSchema(input.jsonSchema);
    this.assertProof(input);
    assertTerraDiagnosticVariant(variant);
    if (requestedModel !== 'openai/gpt-5.6-terra') {
      throw new OpenRouterError('OPENROUTER_POLICY_REJECTED');
    }
    const snapshot = input.preflightProof.snapshots.find(
      ({ requestedModelId }) => requestedModelId === requestedModel,
    );
    if (!snapshot) throw new OpenRouterError('OPENROUTER_POLICY_REJECTED');
    try {
      const completion = await this.requestModel(input, snapshot, 1, variant);
      return Object.freeze({
        status: 'PASS',
        variantId: variant.id,
        completion,
        diagnosticError: null,
      });
    } catch (caught) {
      const error = caught instanceof OpenRouterError
        ? caught
        : new OpenRouterError('OPENROUTER_PROVIDER_UNAVAILABLE', {
          retryable: true,
        });
      const attempt = error.attempts.at(-1) ?? null;
      return Object.freeze({
        status: 'FAIL',
        variantId: variant.id,
        completion: null,
        diagnosticError: normalizeOpenRouterDiagnosticError({
          httpStatus: error.status,
          rawErrorType: error.providerErrorType
            ?? safeDiagnosticCodeForError(error.code),
          rawErrorCode: error.providerErrorCode
            ?? safeDiagnosticCodeForError(error.code),
          retryable: error.retryable,
          requestVariantId: variant.id,
        }),
        attempt,
      });
    }
  }

  private assertConfigured(): void {
    if (
      this.config.mode !== 'OPENROUTER_REQUIRED'
      || this.config.apiKey === null
    ) {
      throw new OpenRouterError('OPENROUTER_NOT_CONFIGURED');
    }
  }

  private assertProof<T>(input: OpenRouterCompletionInput<T>): void {
    if (this.config.apiKey === null) {
      throw new OpenRouterError('OPENROUTER_NOT_CONFIGURED');
    }
    assertOpenRouterPreflightProof(input.preflightProof, {
      apiKey: this.config.apiKey,
      preflightSoftwareSha: this.preflightSoftwareSha,
      currentTime: this.now(),
    });
  }

  private async requestModel<T>(
    input: OpenRouterCompletionInput<T>,
    snapshot: OpenRouterModelCapabilitySnapshot,
    attemptNumber: number,
    diagnosticVariant?: OpenRouterDiagnosticVariant,
    preflightRouting: OpenRouterPreflightRoutingOptions = {},
  ): Promise<OpenRouterCompletion<T>> {
    const requestedMaxOutputTokens = diagnosticVariant?.maxOutputTokens
      ?? this.config.maxOutputTokens;
    if (requestedMaxOutputTokens > snapshot.maxCompletionTokens) {
      throw new OpenRouterError('OPENROUTER_POLICY_REJECTED');
    }
    const baseBody = {
      model: snapshot.requestedModelId,
      messages: input.messages,
      reasoning: {
        effort: diagnosticVariant?.reasoningEffort
          ?? BILAN_MODEL_POLICY.reasoning.effort,
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
        ...(preflightRouting.providerOnly === undefined
          ? {}
          : { only: [...preflightRouting.providerOnly] }),
      },
      stream: false,
    };
    const outputTokenParameter = diagnosticVariant?.outputTokenParameter
      ?? snapshot.outputTokenParameter;
    const body: OpenRouterRequestBody | OpenRouterDiagnosticRequestBody = {
      ...baseBody,
      ...(diagnosticVariant === undefined
        ? {}
        : { model: 'openai/gpt-5.6-terra' as const }),
      [outputTokenParameter]: requestedMaxOutputTokens,
    } as OpenRouterRequestBody | OpenRouterDiagnosticRequestBody;

    const startedAtMs = this.now();
    let generationId: string | null = null;
    let returnedModel: string | null = null;
    let provider: string | null = null;
    let promptTokens: number | null = null;
    let completionTokens: number | null = null;
    let reasoningTokens: number | null = null;
    let totalTokens: number | null = null;
    let costMicrosUsd: number | null = null;
    let finishReason: string | null = null;
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
            'X-Title': 'Nexus Réussite - Bilans pédagogiques',
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        },
      );
      generationId = response.headers.get('x-generation-id')?.trim() || null;
      if (!response.ok) {
        const retryAfterMs = retryAfterMilliseconds(response, this.now());
        const descriptor = await readProviderErrorDescriptor(response);
        throw errorForStatus(response.status, retryAfterMs, descriptor);
      }

      const payload = safeJson(
        await readBoundedResponseText(
          response,
          MAX_COMPLETION_RESPONSE_BYTES,
        ),
      );
      const embeddedError = embeddedErrorStatus(payload);
      if (embeddedError !== null) {
        throw errorForStatus(
          embeddedError.status,
          retryAfterMilliseconds(response, this.now()),
          embeddedError.descriptor,
        );
      }

      const parsed = ResponseEnvelopeSchema.safeParse(payload);
      if (!parsed.success) {
        throw new OpenRouterError('OPENROUTER_INVALID_RESPONSE');
      }
      returnedModel = parsed.data.model;
      provider = parsed.data.provider?.trim() || null;
      const choice = parsed.data.choices[0];
      finishReason = choice.finish_reason;
      promptTokens = parsed.data.usage.prompt_tokens;
      completionTokens = parsed.data.usage.completion_tokens;
      reasoningTokens =
        parsed.data.usage.completion_tokens_details?.reasoning_tokens ?? null;
      totalTokens = parsed.data.usage.total_tokens;
      costMicrosUsd = usdCostToMicros(parsed.data.usage.cost);

      if (finishReason !== 'stop') {
        throw new OpenRouterError('OPENROUTER_INCOMPLETE_RESPONSE');
      }
      if (generationId === null) {
        throw new OpenRouterError('OPENROUTER_INVALID_RESPONSE');
      }
      if (
        returnedModel !== snapshot.requestedModelId
        && returnedModel !== snapshot.canonicalSlug
      ) {
        throw new OpenRouterError('OPENROUTER_POLICY_REJECTED');
      }
      if (totalTokens !== promptTokens + completionTokens) {
        throw new OpenRouterError('OPENROUTER_INVALID_RESPONSE');
      }
      if (
        this.config.maxCostMicrosUsdPerAudienceReport !== null
        && costMicrosUsd > this.config.maxCostMicrosUsdPerAudienceReport
      ) {
        throw new OpenRouterError('OPENROUTER_BUDGET_EXCEEDED');
      }

      const decoded = safeJson(choice.message.content);
      const validated = input.validator.safeParse(decoded);
      if (!validated.success) {
        throw new OpenRouterError('OPENROUTER_SCHEMA_FAILURE');
      }

      const completedAtMs = Math.max(startedAtMs, this.now());
      const successfulAttempt = this.attempt({
        attemptNumber,
        requestedModel: snapshot.requestedModelId,
        startedAtMs,
        completedAtMs,
        outcome: 'SUCCEEDED',
        errorCode: null,
        retryable: false,
        generationId,
        returnedModel,
        provider,
        promptTokens,
        completionTokens,
        reasoningTokens,
        totalTokens,
        costMicrosUsd,
        finishReason,
      });
      return Object.freeze({
        data: validated.data,
        provenance: Object.freeze({
          requestedModel: snapshot.requestedModelId,
          returnedModel,
          provider,
          canonicalSlug: snapshot.canonicalSlug,
          outputTokenParameter: snapshot.outputTokenParameter,
          generationId,
          finishReason,
          promptTokens,
          completionTokens,
          reasoningTokens,
          totalTokens,
          costMicrosUsd,
          latencyMs: successfulAttempt.latencyMs,
          attemptNumber,
          capabilityChecksum: snapshot.capabilityChecksum,
          policyId: BILAN_MODEL_POLICY.id,
          policyVersion: BILAN_MODEL_POLICY.version,
          policyChecksum: BILAN_MODEL_POLICY_CHECKSUM,
          responseSchemaVersion: input.schemaVersion,
        }),
        attempts: Object.freeze([successfulAttempt]),
      });
    } catch (caught) {
      let error: OpenRouterError;
      if (caught instanceof OpenRouterError) {
        error = caught;
      } else if (isAbortError(caught)) {
        error = new OpenRouterError('OPENROUTER_TIMEOUT', { retryable: true });
      } else {
        error = new OpenRouterError('OPENROUTER_PROVIDER_UNAVAILABLE', {
          retryable: true,
        });
      }
      const completedAtMs = Math.max(startedAtMs, this.now());
      const failedAttempt = this.attempt({
        attemptNumber,
        requestedModel: snapshot.requestedModelId,
        startedAtMs,
        completedAtMs,
        outcome: 'FAILED',
        errorCode: error.code,
        retryable: error.retryable,
        generationId,
        returnedModel,
        provider,
        promptTokens,
        completionTokens,
        reasoningTokens,
        totalTokens,
        costMicrosUsd,
        finishReason,
      });
      throw cloneErrorWithAttempts(error, [failedAttempt]);
    } finally {
      clearTimeout(timeout);
    }
  }

  private attempt(input: Readonly<{
    attemptNumber: number;
    requestedModel: string;
    startedAtMs: number;
    completedAtMs: number;
    outcome: 'SUCCEEDED' | 'FAILED';
    errorCode: OpenRouterErrorCode | null;
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
  }>): OpenRouterInvocationAttempt {
    return Object.freeze({
      attemptNumber: input.attemptNumber,
      requestedModel: input.requestedModel,
      startedAt: new Date(input.startedAtMs).toISOString(),
      completedAt: new Date(input.completedAtMs).toISOString(),
      latencyMs: Math.max(0, input.completedAtMs - input.startedAtMs),
      outcome: input.outcome,
      normalizedErrorCode: input.errorCode,
      retryable: input.retryable,
      generationId: input.generationId,
      returnedModel: input.returnedModel,
      provider: input.provider,
      promptTokens: input.promptTokens,
      completionTokens: input.completionTokens,
      reasoningTokens: input.reasoningTokens,
      totalTokens: input.totalTokens,
      costMicrosUsd: input.costMicrosUsd,
      finishReason: input.finishReason,
    });
  }
}
