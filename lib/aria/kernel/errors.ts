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
  | 'RATE_LIMIT_EXCEEDED'
  | 'RATE_LIMIT_BACKEND_UNAVAILABLE'
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

/** A captured authority was lost. Never persist or return generated content. */
export class AriaAuthorityRevokedError extends AriaError {
  constructor() {
    super('NOT_ENTITLED', 403, 'ARIA n’est plus disponible pour cette session.', { reasonCode: 'ARIA_AUTHORITY_REVOKED' });
    this.message = 'ARIA_AUTHORITY_REVOKED';
  }
}

export class AriaAuthorityUnavailableError extends AriaError {
  constructor() {
    super('INTERNAL_ERROR', 503, 'La vérification ARIA est momentanément indisponible.', { reasonCode: 'ARIA_AUTHORITY_UNAVAILABLE' });
    this.message = 'ARIA_AUTHORITY_UNAVAILABLE';
  }
}
export function isAriaAuthorityLoss(error: unknown): error is AriaAuthorityRevokedError | AriaAuthorityUnavailableError {
  return error instanceof AriaAuthorityRevokedError || error instanceof AriaAuthorityUnavailableError;
}
