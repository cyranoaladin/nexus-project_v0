import { AriaError, type AriaErrorCode } from '../kernel/errors';

export type AriaPublicErrorCode =
  | 'BAD_REQUEST'
  | 'COURSE_NOT_FOUND'
  | 'NOT_ENROLLED'
  | 'NOT_ENTITLED'
  | 'UNSUPPORTED'
  | 'CONVERSATION_NOT_FOUND'
  | 'CONVERSATION_BUSY'
  | 'IDEMPOTENCY_CONFLICT'
  | 'RAG_UNAVAILABLE'
  | 'MODEL_UNAVAILABLE'
  | 'INTERNAL_ERROR';

export interface AriaPublicErrorLogger {
  error(message: string, error?: unknown, metadata?: Record<string, unknown>): void;
}

export interface AriaPublicErrorResult {
  readonly status: number;
  readonly body: {
    readonly error: {
      readonly code: AriaPublicErrorCode;
      readonly requestId: string;
      readonly retryable: boolean;
    };
  };
}

const PUBLIC_ERRORS: Readonly<Record<AriaPublicErrorCode, {
  readonly status: number;
  readonly retryable: boolean;
}>> = Object.freeze({
  BAD_REQUEST: { status: 400, retryable: false },
  COURSE_NOT_FOUND: { status: 404, retryable: false },
  NOT_ENROLLED: { status: 403, retryable: false },
  NOT_ENTITLED: { status: 403, retryable: false },
  UNSUPPORTED: { status: 422, retryable: false },
  CONVERSATION_NOT_FOUND: { status: 404, retryable: false },
  CONVERSATION_BUSY: { status: 409, retryable: true },
  IDEMPOTENCY_CONFLICT: { status: 409, retryable: false },
  RAG_UNAVAILABLE: { status: 503, retryable: true },
  MODEL_UNAVAILABLE: { status: 503, retryable: true },
  INTERNAL_ERROR: { status: 500, retryable: false },
});

const INTERNAL_TO_PUBLIC: Readonly<Record<AriaErrorCode, AriaPublicErrorCode>> = Object.freeze({
  BAD_REQUEST: 'BAD_REQUEST',
  COURSE_NOT_FOUND: 'COURSE_NOT_FOUND',
  NOT_ENROLLED: 'NOT_ENROLLED',
  NOT_ENTITLED: 'NOT_ENTITLED',
  UNSUPPORTED: 'UNSUPPORTED',
  CONVERSATION_NOT_FOUND: 'CONVERSATION_NOT_FOUND',
  CONVERSATION_BUSY: 'CONVERSATION_BUSY',
  IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',
  CROSS_COURSE_MISMATCH: 'BAD_REQUEST',
  SKILL_MISMATCH: 'BAD_REQUEST',
  RESOURCE_MISMATCH: 'BAD_REQUEST',
  RAG_UNAVAILABLE: 'RAG_UNAVAILABLE',
  MODEL_TIMEOUT: 'MODEL_UNAVAILABLE',
  MODEL_UNAVAILABLE: 'MODEL_UNAVAILABLE',
  USER_CANCELLED: 'INTERNAL_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
});

const POST_START_CODES = new Set<AriaPublicErrorCode>([
  'RAG_UNAVAILABLE',
  'MODEL_UNAVAILABLE',
  'INTERNAL_ERROR',
]);

function readReasonCode(error: AriaError): string | undefined {
  if (!error.internalDetails || typeof error.internalDetails !== 'object') return undefined;
  const reasonCode = (error.internalDetails as Record<string, unknown>).reasonCode;
  return typeof reasonCode === 'string' && /^[A-Z0-9_]{1,80}$/.test(reasonCode)
    ? reasonCode
    : undefined;
}

export function serializeAriaPublicError(
  error: unknown,
  context: {
    readonly requestId: string;
    readonly phase: 'PRE_STREAM' | 'POST_START';
    readonly logger?: AriaPublicErrorLogger;
  },
): AriaPublicErrorResult {
  const internalCode = error instanceof AriaError ? error.code : 'INTERNAL_ERROR';
  const mappedCode = INTERNAL_TO_PUBLIC[internalCode];
  const code = context.phase === 'POST_START' && !POST_START_CODES.has(mappedCode)
    ? 'INTERNAL_ERROR'
    : mappedCode;
  const definition = PUBLIC_ERRORS[code];

  if (definition.status >= 500 && context.logger) {
    context.logger.error('ARIA request failed', undefined, {
      requestId: context.requestId,
      code,
      phase: context.phase,
      reasonCode: error instanceof AriaError ? readReasonCode(error) : undefined,
    });
  }

  return Object.freeze({
    status: definition.status,
    body: Object.freeze({
      error: Object.freeze({
        code,
        requestId: context.requestId,
        retryable: definition.retryable,
      }),
    }),
  });
}
