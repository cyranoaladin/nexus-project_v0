import modelPolicy from '@/data/bilans/model-policy.json';

import { requireAllowedBilanModel } from './model-policy';
import type { OpenRouterConfig } from './openrouter-transport';

export const BILAN_MODEL_POLICY = modelPolicy;

export class BilanLlmConfigError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'BilanLlmConfigError';
  }
}

function positiveNumber(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/**
 * Builds OpenRouter config from the environment. Throws a typed, non-secret
 * error code if misconfigured — never includes the key value in the error.
 */
export function resolveOpenRouterConfig(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): OpenRouterConfig {
  const apiKey = environment.OPENROUTER_API_KEY?.trim();
  if (!apiKey) throw new BilanLlmConfigError('OPENROUTER_API_KEY_MISSING');

  const requestedModel = environment.OPENROUTER_MODEL?.trim() || BILAN_MODEL_POLICY.allowedModels[0];
  const model = requireAllowedBilanModel(BILAN_MODEL_POLICY, requestedModel);

  return Object.freeze({
    apiKey,
    model,
    baseUrl: environment.OPENROUTER_BASE_URL?.trim() || undefined,
    maxTokens: positiveNumber(environment.OPENROUTER_MAX_TOKENS, 2_000),
    temperature: (() => {
      const raw = environment.OPENROUTER_TEMPERATURE;
      const value = raw === undefined || raw.trim() === '' ? 0.2 : Number(raw);
      return Number.isFinite(value) && value >= 0 && value <= 2 ? value : 0.2;
    })(),
    timeoutMs: positiveNumber(environment.OPENROUTER_TIMEOUT_MS, 20_000),
    maxRetries: positiveNumber(environment.OPENROUTER_MAX_RETRIES, 2),
    referer: environment.OPENROUTER_HTTP_REFERER?.trim() || undefined,
    appTitle: environment.OPENROUTER_APP_TITLE?.trim() || 'Nexus Reussite Bilan',
  });
}
