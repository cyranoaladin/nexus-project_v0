import { AriaError } from '../../kernel/errors';
import {
  getAriaModelCapabilities,
  type AriaConfiguredModel,
  type AriaModelProvider,
} from './policy';
import { ARIA_PERFORMANCE_BUDGETS } from '../../domain/observability/performance-budgets';

export interface AriaProviderCandidate extends AriaConfiguredModel {
  readonly apiKey: string;
  readonly baseURL?: string;
}

export interface AriaModelTimeoutConfiguration {
  readonly timeoutMs: number;
  readonly firstTokenTimeoutMs: number;
}

type AriaModelEnvironment = Readonly<Record<string, string | undefined>>;

function configurationError(reasonCode: string): never {
  throw new AriaError(
    'INTERNAL_ERROR',
    500,
    'Le service d’intelligence pédagogique ARIA est mal configuré.',
    { reasonCode },
  );
}

function isRealHostedKey(value: string | undefined): value is string {
  return Boolean(
    value
    && /^sk-(?:proj-)?[A-Za-z0-9_-]{24,}$/.test(value)
    && !/(fake|test|ollama|placeholder|your-)/i.test(value),
  );
}

function timeoutValue(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    return configurationError('MODEL_TIMEOUT_INVALID');
  }
  return parsed;
}

export function resolveAriaModelTimeoutConfiguration(
  environment: AriaModelEnvironment = process.env,
): AriaModelTimeoutConfiguration {
  const timeoutMs = timeoutValue(
    environment.ARIA_MODEL_TIMEOUT_MS,
    ARIA_PERFORMANCE_BUDGETS.totalModelTimeoutMs,
  );
  const firstTokenTimeoutMs = timeoutValue(
    environment.ARIA_MODEL_FIRST_TOKEN_TIMEOUT_MS,
    Math.min(ARIA_PERFORMANCE_BUDGETS.firstTokenTimeoutMs, timeoutMs),
  );
  if (firstTokenTimeoutMs > timeoutMs) return configurationError('MODEL_TIMEOUT_INVALID');
  return Object.freeze({ timeoutMs, firstTokenTimeoutMs });
}

function validateLocalBaseURL(value: string | undefined): string {
  if (!value) return configurationError('LOCAL_BASE_URL_REQUIRED');
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return configurationError('LOCAL_BASE_URL_INVALID');
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.hostname === 'api.openai.com') {
    return configurationError('LOCAL_BASE_URL_NOT_LOCAL_COMPATIBLE');
  }
  return parsed.toString().replace(/\/$/, '');
}

function buildCandidate(input: {
  readonly provider: string | undefined;
  readonly model: string | undefined;
  readonly profile: string | undefined;
  readonly baseURL: string | undefined;
  readonly apiKey: string | undefined;
  readonly prefix: 'PRIMARY' | 'FALLBACK';
}): AriaProviderCandidate {
  if (input.provider !== 'OPENAI_HOSTED' && input.provider !== 'OPENAI_COMPATIBLE_LOCAL') {
    return configurationError(`${input.prefix}_PROVIDER_REQUIRED`);
  }
  if (!input.model) return configurationError(`${input.prefix}_MODEL_REQUIRED`);
  if (!input.profile) return configurationError(`${input.prefix}_CAPABILITY_PROFILE_REQUIRED`);
  const capabilities = getAriaModelCapabilities(input.profile);
  if (!capabilities) return configurationError(`${input.prefix}_CAPABILITY_PROFILE_UNKNOWN`);

  const provider = input.provider as AriaModelProvider;
  if (provider === 'OPENAI_HOSTED') {
    if (input.baseURL) return configurationError(`${input.prefix}_HOSTED_BASE_URL_FORBIDDEN`);
    if (!isRealHostedKey(input.apiKey)) {
      return configurationError(`${input.prefix}_HOSTED_KEY_REQUIRED`);
    }
    return Object.freeze({
      provider,
      model: input.model,
      capabilityProfile: input.profile,
      capabilities,
      apiKey: input.apiKey,
    });
  }

  return Object.freeze({
    provider,
    model: input.model,
    capabilityProfile: input.profile,
    capabilities,
    baseURL: validateLocalBaseURL(input.baseURL),
    apiKey: input.apiKey || 'explicit-local-no-auth',
  });
}

export function resolveAriaProviderCandidates(
  environment: AriaModelEnvironment = process.env,
): readonly AriaProviderCandidate[] {
  const primary = buildCandidate({
    provider: environment.ARIA_MODEL_PROVIDER,
    model: environment.ARIA_MODEL,
    profile: environment.ARIA_MODEL_CAPABILITY_PROFILE,
    baseURL: environment.ARIA_MODEL_BASE_URL || environment.OPENAI_BASE_URL,
    apiKey: environment.ARIA_MODEL_API_KEY || environment.OPENAI_API_KEY,
    prefix: 'PRIMARY',
  });
  if (!environment.ARIA_MODEL_FALLBACK_PROVIDER) return Object.freeze([primary]);
  const fallback = buildCandidate({
    provider: environment.ARIA_MODEL_FALLBACK_PROVIDER,
    model: environment.ARIA_MODEL_FALLBACK_MODEL,
    profile: environment.ARIA_MODEL_FALLBACK_CAPABILITY_PROFILE,
    baseURL: environment.ARIA_MODEL_FALLBACK_BASE_URL,
    apiKey: environment.ARIA_MODEL_FALLBACK_API_KEY,
    prefix: 'FALLBACK',
  });
  return Object.freeze([primary, fallback]);
}

export function isAriaModelFallbackAuthorized(
  environment: AriaModelEnvironment = process.env,
): boolean {
  return environment.ARIA_MODEL_FALLBACK_AUTHORIZED === '1';
}
