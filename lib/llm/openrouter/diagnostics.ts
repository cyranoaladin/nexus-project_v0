import 'server-only';

import type {
  OpenRouterDiagnosticVariant,
  OpenRouterSafeDiagnosticCode,
  OpenRouterSafeDiagnosticError,
} from './types';

export type { OpenRouterDiagnosticVariant } from './types';

export type TerraDiagnosticRootCause =
  | 'PREFLIGHT_OUTPUT_LIMIT_TOO_LOW'
  | 'OPENAI_OUTPUT_TOKEN_PARAMETER_ALIAS'
  | 'TERRA_REASONING_POLICY_INCOMPATIBLE'
  | 'INCONCLUSIVE_TRANSIENT_FAILURE'
  | 'INCONCLUSIVE_PREVIOUS_FAILURE_UNVERIFIED'
  | 'NOT_OUTPUT_LIMIT_ONLY';

export type TerraDiagnosticOutcome = Readonly<{
  variantId: OpenRouterDiagnosticVariant['id'];
  status: 'PASS' | 'FAIL';
  httpStatus?: number | null;
  errorCode?: OpenRouterSafeDiagnosticCode | null;
  retryable?: boolean;
}>;

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

function isTransientDiagnosticFailure(
  outcome: TerraDiagnosticOutcome,
): boolean {
  if (outcome.status !== 'FAIL') return false;
  return outcome.retryable === true
    || outcome.httpStatus === 408
    || outcome.httpStatus === 429
    || (outcome.httpStatus !== null
      && outcome.httpStatus !== undefined
      && outcome.httpStatus >= 500)
    || outcome.errorCode === 'rate_limit_exceeded'
    || outcome.errorCode === 'provider_unavailable';
}

function isCompatibleTokenContractFailure(
  outcome: TerraDiagnosticOutcome | undefined,
): boolean {
  return outcome?.status === 'FAIL'
    && !isTransientDiagnosticFailure(outcome)
    && outcome.httpStatus === 400
    && [
      'max_tokens_exceeded',
      'token_limit_exceeded',
    ].includes(outcome.errorCode ?? '');
}

export function classifyTerraDiagnosticRootCause(
  outcomes: readonly TerraDiagnosticOutcome[],
): TerraDiagnosticRootCause {
  const winnerIndex = outcomes.findIndex(({ status }) => status === 'PASS');
  if (winnerIndex === -1) return 'NOT_OUTPUT_LIMIT_ONLY';
  const preceding = outcomes.slice(0, winnerIndex);
  if (preceding.some(isTransientDiagnosticFailure)) {
    return 'INCONCLUSIVE_TRANSIENT_FAILURE';
  }
  const winner = outcomes[winnerIndex];
  if (winner.variantId === 'D1') {
    return 'INCONCLUSIVE_PREVIOUS_FAILURE_UNVERIFIED';
  }
  if (
    winner.variantId === 'D2'
    && isCompatibleTokenContractFailure(preceding[0])
  ) {
    return 'OPENAI_OUTPUT_TOKEN_PARAMETER_ALIAS';
  }
  if (
    winner.variantId === 'D3'
    && isCompatibleTokenContractFailure(preceding[0])
    && isCompatibleTokenContractFailure(preceding[1])
  ) {
    return 'TERRA_REASONING_POLICY_INCOMPATIBLE';
  }
  return 'NOT_OUTPUT_LIMIT_ONLY';
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
