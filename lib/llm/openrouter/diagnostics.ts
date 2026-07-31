import 'server-only';

import type {
  OpenRouterDiagnosticVariant,
  OpenRouterSafeDiagnosticCode,
  OpenRouterSafeDiagnosticError,
} from './types';

export type { OpenRouterDiagnosticVariant } from './types';

const SAFE_DIAGNOSTIC_CODES = new Set<OpenRouterSafeDiagnosticCode>([
  'max_tokens_exceeded',
  'token_limit_exceeded',
  'context_length_exceeded',
  'permission_denied',
  'authentication',
  'payment_required',
  'rate_limit_exceeded',
  'invalid_request',
  'provider_unavailable',
  'unknown_safe_code',
]);

export const TERRA_DIAGNOSTIC_VARIANTS = Object.freeze([
  Object.freeze({
    id: 'D1',
    outputTokenParameter: 'max_tokens',
    maxOutputTokens: 2_048,
    reasoningEffort: 'low',
  }),
  Object.freeze({
    id: 'D2',
    outputTokenParameter: 'max_completion_tokens',
    maxOutputTokens: 2_048,
    reasoningEffort: 'low',
  }),
  Object.freeze({
    id: 'D3',
    outputTokenParameter: 'max_tokens',
    maxOutputTokens: 2_048,
    reasoningEffort: 'none',
  }),
] as const satisfies readonly OpenRouterDiagnosticVariant[]);

function normalizeSafeValue(value: unknown): OpenRouterSafeDiagnosticCode {
  if (typeof value !== 'string') return 'unknown_safe_code';
  const normalized = value.trim().toLowerCase().replace(/[-\s]+/g, '_');
  return SAFE_DIAGNOSTIC_CODES.has(normalized as OpenRouterSafeDiagnosticCode)
    ? normalized as OpenRouterSafeDiagnosticCode
    : 'unknown_safe_code';
}

export function normalizeOpenRouterDiagnosticError(input: Readonly<{
  httpStatus: number | null;
  rawErrorType: unknown;
  rawErrorCode: unknown;
  retryable: boolean;
  requestVariantId: OpenRouterDiagnosticVariant['id'];
}>): OpenRouterSafeDiagnosticError {
  return Object.freeze({
    httpStatus: Number.isInteger(input.httpStatus) ? input.httpStatus : null,
    errorType: normalizeSafeValue(input.rawErrorType),
    errorCode: normalizeSafeValue(input.rawErrorCode),
    retryable: input.retryable,
    requestVariantId: input.requestVariantId,
  });
}

export function assertTerraDiagnosticVariant(
  variant: OpenRouterDiagnosticVariant,
): void {
  const expected = TERRA_DIAGNOSTIC_VARIANTS.find(({ id }) => id === variant.id);
  if (
    expected === undefined
    || expected.outputTokenParameter !== variant.outputTokenParameter
    || expected.maxOutputTokens !== variant.maxOutputTokens
    || expected.reasoningEffort !== variant.reasoningEffort
  ) {
    throw new TypeError('Invalid bounded Terra diagnostic variant.');
  }
}
