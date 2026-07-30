import 'server-only';

export const OPENROUTER_ERROR_CODES = [
  'OPENROUTER_NOT_CONFIGURED',
  'OPENROUTER_INVALID_CREDENTIALS',
  'OPENROUTER_INSUFFICIENT_CREDITS',
  'OPENROUTER_POLICY_REJECTED',
  'OPENROUTER_TIMEOUT',
  'OPENROUTER_RATE_LIMITED',
  'OPENROUTER_PROVIDER_UNAVAILABLE',
  'OPENROUTER_NO_COMPLIANT_PROVIDER',
  'OPENROUTER_INVALID_RESPONSE',
  'OPENROUTER_SCHEMA_FAILURE',
  'OPENROUTER_BUDGET_EXCEEDED',
] as const;

export type OpenRouterErrorCode = (typeof OPENROUTER_ERROR_CODES)[number];

const SAFE_MESSAGES: Record<OpenRouterErrorCode, string> = {
  OPENROUTER_NOT_CONFIGURED: 'OpenRouter report generation is not configured.',
  OPENROUTER_INVALID_CREDENTIALS: 'OpenRouter credentials were rejected.',
  OPENROUTER_INSUFFICIENT_CREDITS: 'OpenRouter credits are insufficient.',
  OPENROUTER_POLICY_REJECTED: 'OpenRouter policy requirements were not met.',
  OPENROUTER_TIMEOUT: 'OpenRouter request timed out.',
  OPENROUTER_RATE_LIMITED: 'OpenRouter rate limit was reached.',
  OPENROUTER_PROVIDER_UNAVAILABLE: 'OpenRouter provider is temporarily unavailable.',
  OPENROUTER_NO_COMPLIANT_PROVIDER: 'No compliant OpenRouter provider is available.',
  OPENROUTER_INVALID_RESPONSE: 'OpenRouter returned an invalid response.',
  OPENROUTER_SCHEMA_FAILURE: 'OpenRouter structured output validation failed.',
  OPENROUTER_BUDGET_EXCEEDED: 'OpenRouter report budget was exceeded.',
};

export class OpenRouterError extends Error {
  readonly code: OpenRouterErrorCode;
  readonly retryable: boolean;
  readonly status: number | null;
  readonly retryAfterMs: number | null;

  constructor(
    code: OpenRouterErrorCode,
    options: Readonly<{
      retryable?: boolean;
      status?: number | null;
      retryAfterMs?: number | null;
    }> = {},
  ) {
    super(SAFE_MESSAGES[code]);
    this.name = 'OpenRouterError';
    this.code = code;
    this.retryable = options.retryable ?? false;
    this.status = options.status ?? null;
    this.retryAfterMs = options.retryAfterMs ?? null;
  }
}

export class OpenRouterModelCompatibilityError extends Error {
  readonly code = 'BLOCKED_BY_MODEL_PARAMETER_COMPATIBILITY';

  constructor() {
    super('The approved OpenRouter model policy is incompatible with the capability snapshot.');
    this.name = 'OpenRouterModelCompatibilityError';
  }
}
