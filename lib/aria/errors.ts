/**
 * ARIA Typed Domain & Public Errors.
 *
 * Invariant : RAW_SERVER_ERROR_TO_CLIENT=0.
 * Aucun chemin interne, secret, payload tiers ou trace système n'est exposé au client.
 */

import { NextResponse } from 'next/server';

export type AriaErrorCode =
  | 'BAD_REQUEST'
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

export function toAriaErrorResponse(
  error: unknown,
  logger?: { error: (msg: string, meta?: Record<string, unknown>) => void }
): NextResponse {
  if (error instanceof AriaError) {
    if (logger && error.status >= 500) {
      logger.error('ARIA Domain Error', {
        code: error.code,
        status: error.status,
        internalDetails: error.internalDetails,
      });
    }
    return NextResponse.json(
      { error: error.publicMessage, code: error.code },
      { status: error.status }
    );
  }

  // Erreur inattendue : masquer les détails système
  const safeMessage = 'Une difficulté technique temporaire est survenue. Veuillez réessayer.';
  if (logger) {
    logger.error('Unhandled ARIA Exception', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  }

  return NextResponse.json(
    { error: safeMessage, code: 'INTERNAL_ERROR' },
    { status: 500 }
  );
}
