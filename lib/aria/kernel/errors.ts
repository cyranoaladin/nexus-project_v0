export type AriaErrorCode =
  | 'BAD_REQUEST'
  | 'PAYLOAD_TOO_LARGE'
  | 'COURSE_NOT_FOUND'
  | 'NOT_ENROLLED'
  | 'NOT_ENTITLED'
  | 'UNSUPPORTED'
  | 'CONVERSATION_NOT_FOUND'
  | 'CONVERSATION_BUSY'
  | 'IDEMPOTENCY_CONFLICT'
  | 'CROSS_COURSE_MISMATCH'
  | 'SKILL_MISMATCH'
  | 'RESOURCE_MISMATCH'
  | 'RAG_UNAVAILABLE'
  | 'MODEL_TIMEOUT'
  | 'MODEL_UNAVAILABLE'
  | 'USER_CANCELLED'
  | 'INTERNAL_ERROR';

/** Internal application error. Public transport mapping lives outside the kernel. */
export class AriaError extends Error {
  readonly code: AriaErrorCode;
  readonly status: number;
  readonly publicMessage: string;
  readonly internalDetails?: unknown;

  constructor(code: AriaErrorCode, status: number, publicMessage: string, internalDetails?: unknown) {
    super(publicMessage);
    this.name = 'AriaError';
    this.code = code;
    this.status = status;
    this.publicMessage = publicMessage;
    this.internalDetails = internalDetails;
  }
}
