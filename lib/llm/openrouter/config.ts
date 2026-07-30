import 'server-only';

import { OpenRouterError } from './errors';
import {
  BILAN_MODEL_POLICY,
  BILAN_MODEL_POLICY_CONFIG_VERSION,
} from './policy';
import type { BilanReportGenerationMode } from './types';

const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';
const DEFAULT_TIMEOUT_MS = 90_000;
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_MAX_OUTPUT_TOKENS = 2_048;

export type OpenRouterEnvironment = Partial<Record<
  | 'NODE_ENV'
  | 'BILAN_REPORT_GENERATION_MODE'
  | 'OPENROUTER_API_KEY'
  | 'OPENROUTER_BASE_URL'
  | 'BILAN_OPENROUTER_PRIMARY_MODEL'
  | 'BILAN_OPENROUTER_FALLBACK_MODELS'
  | 'BILAN_OPENROUTER_MODEL_POLICY_VERSION'
  | 'BILAN_OPENROUTER_TIMEOUT_MS'
  | 'BILAN_OPENROUTER_MAX_ATTEMPTS'
  | 'BILAN_OPENROUTER_MAX_OUTPUT_TOKENS'
  | 'BILAN_OPENROUTER_MAX_COST_USD_PER_REPORT'
  | 'BILAN_OPENROUTER_DAILY_BUDGET_USD'
  | 'BILAN_LLM_ENRICHMENT_ENABLED'
  | 'BILAN_OPENROUTER_TEMPERATURE'
  | 'OPENROUTER_TEMPERATURE'
  | 'BILAN_OPENROUTER_TOP_P'
  | 'OPENROUTER_TOP_P'
  | 'BILAN_OPENROUTER_SEED'
  | 'OPENROUTER_SEED'
  | 'BILAN_REPORT_MISTRAL_ENABLED'
  | 'BILAN_REPORT_GENERATION_PROVIDER',
  string | undefined
>>;

export type OpenRouterConfig = Readonly<{
  mode: BilanReportGenerationMode;
  apiKey: string | null;
  baseUrl: string;
  primaryModel: string;
  fallbackModels: readonly string[];
  modelPolicyVersion: string;
  timeoutMs: number;
  maxAttempts: number;
  maxOutputTokens: number;
  maxCostUsdPerReport: number | null;
  dailyBudgetUsd: number | null;
  redacted: Readonly<Record<string, unknown>>;
}>;

function policyError(): never {
  throw new OpenRouterError('OPENROUTER_POLICY_REJECTED');
}

function positiveInteger(
  value: string | undefined,
  fallback: number,
  maximum = Number.MAX_SAFE_INTEGER,
): number {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > maximum) policyError();
  return parsed;
}

function positiveBudget(value: string | undefined): number | null {
  if (value === undefined || value.trim() === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) policyError();
  return parsed;
}

function parseFallbackModels(value: string | undefined): readonly string[] {
  if (value === undefined) return BILAN_MODEL_POLICY.fallbackModels;
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      !Array.isArray(parsed)
      || parsed.length !== BILAN_MODEL_POLICY.fallbackModels.length
      || parsed.some((model, index) =>
        model !== BILAN_MODEL_POLICY.fallbackModels[index])
    ) {
      policyError();
    }
    return Object.freeze([...parsed]) as readonly string[];
  } catch (error) {
    if (error instanceof OpenRouterError) throw error;
    policyError();
  }
}

function assertApprovedModel(model: string): void {
  if (
    model === 'openrouter/auto'
    || /(?:^|[-/:])latest(?:$|[-/:])/i.test(model)
    || (
      model !== BILAN_MODEL_POLICY.primaryModel
      && !BILAN_MODEL_POLICY.fallbackModels.includes(
        model as (typeof BILAN_MODEL_POLICY.fallbackModels)[number],
      )
    )
  ) {
    policyError();
  }
}

export function parseOpenRouterConfig(
  environment: OpenRouterEnvironment = process.env,
): OpenRouterConfig {
  const forbiddenKeys: readonly (keyof OpenRouterEnvironment)[] = [
    'BILAN_LLM_ENRICHMENT_ENABLED',
    'BILAN_OPENROUTER_TEMPERATURE',
    'OPENROUTER_TEMPERATURE',
    'BILAN_OPENROUTER_TOP_P',
    'OPENROUTER_TOP_P',
    'BILAN_OPENROUTER_SEED',
    'OPENROUTER_SEED',
    'BILAN_REPORT_MISTRAL_ENABLED',
    'BILAN_REPORT_GENERATION_PROVIDER',
  ];
  if (forbiddenKeys.some((key) => environment[key] !== undefined)) policyError();

  const rawMode = environment.BILAN_REPORT_GENERATION_MODE ?? 'DISABLED';
  if (rawMode !== 'DISABLED' && rawMode !== 'OPENROUTER_REQUIRED') policyError();
  const mode: BilanReportGenerationMode = rawMode;

  const apiKey = environment.OPENROUTER_API_KEY?.trim() || null;
  if (mode === 'OPENROUTER_REQUIRED' && apiKey === null) {
    throw new OpenRouterError('OPENROUTER_NOT_CONFIGURED');
  }

  let baseUrl: URL;
  try {
    baseUrl = new URL(environment.OPENROUTER_BASE_URL ?? DEFAULT_BASE_URL);
  } catch {
    policyError();
  }
  if (
    baseUrl.username !== ''
    || baseUrl.password !== ''
    || baseUrl.search !== ''
    || baseUrl.hash !== ''
  ) {
    policyError();
  }
  if (
    baseUrl.protocol !== 'https:'
    && !(
      environment.NODE_ENV === 'test'
      && baseUrl.protocol === 'http:'
      && (baseUrl.hostname === '127.0.0.1' || baseUrl.hostname === 'localhost')
    )
  ) {
    policyError();
  }
  if (!baseUrl.pathname.endsWith('/')) baseUrl.pathname += '/';
  if (
    environment.NODE_ENV !== 'test'
    && (
      baseUrl.origin !== 'https://openrouter.ai'
      || baseUrl.pathname !== '/api/v1/'
    )
  ) {
    policyError();
  }

  const primaryModel =
    environment.BILAN_OPENROUTER_PRIMARY_MODEL
    ?? BILAN_MODEL_POLICY.primaryModel;
  const fallbackModels = parseFallbackModels(
    environment.BILAN_OPENROUTER_FALLBACK_MODELS,
  );
  assertApprovedModel(primaryModel);
  fallbackModels.forEach(assertApprovedModel);
  if (primaryModel !== BILAN_MODEL_POLICY.primaryModel) policyError();

  const modelPolicyVersion =
    environment.BILAN_OPENROUTER_MODEL_POLICY_VERSION
    ?? BILAN_MODEL_POLICY_CONFIG_VERSION;
  if (modelPolicyVersion !== BILAN_MODEL_POLICY_CONFIG_VERSION) policyError();

  const timeoutMs = positiveInteger(
    environment.BILAN_OPENROUTER_TIMEOUT_MS,
    DEFAULT_TIMEOUT_MS,
    300_000,
  );
  const maxAttempts = positiveInteger(
    environment.BILAN_OPENROUTER_MAX_ATTEMPTS,
    DEFAULT_MAX_ATTEMPTS,
    3,
  );
  const maxOutputTokens = positiveInteger(
    environment.BILAN_OPENROUTER_MAX_OUTPUT_TOKENS,
    DEFAULT_MAX_OUTPUT_TOKENS,
    128_000,
  );
  const maxCostUsdPerReport = positiveBudget(
    environment.BILAN_OPENROUTER_MAX_COST_USD_PER_REPORT,
  );
  const dailyBudgetUsd = positiveBudget(
    environment.BILAN_OPENROUTER_DAILY_BUDGET_USD,
  );
  if (
    environment.NODE_ENV === 'production'
    && mode === 'OPENROUTER_REQUIRED'
    && (maxCostUsdPerReport === null || dailyBudgetUsd === null)
  ) {
    throw new OpenRouterError('OPENROUTER_BUDGET_EXCEEDED');
  }
  if (
    maxCostUsdPerReport !== null
    && dailyBudgetUsd !== null
    && maxCostUsdPerReport > dailyBudgetUsd
  ) {
    throw new OpenRouterError('OPENROUTER_BUDGET_EXCEEDED');
  }

  const redacted = Object.freeze({
    mode,
    baseUrl: baseUrl.toString(),
    primaryModel,
    fallbackModels,
    modelPolicyVersion,
    timeoutMs,
    maxAttempts,
    maxOutputTokens,
    maxCostUsdPerReport,
    dailyBudgetUsd,
    apiKeyConfigured: apiKey !== null,
  });

  return Object.freeze({
    mode,
    apiKey,
    baseUrl: baseUrl.toString(),
    primaryModel,
    fallbackModels,
    modelPolicyVersion,
    timeoutMs,
    maxAttempts,
    maxOutputTokens,
    maxCostUsdPerReport,
    dailyBudgetUsd,
    redacted,
  });
}
