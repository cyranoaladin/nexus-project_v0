/**
 * Core v2 error taxonomy — the ONLY error shapes a domain service may throw
 * for a business outcome. Infrastructure failures (connection loss, unknown
 * Prisma errors) propagate untouched so they are never mistaken for a
 * business refusal.
 */
export type CoreV2ErrorCode = 'VALIDATION' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' | 'INVALID_STATE';

export class CoreV2DomainError extends Error {
  readonly code: CoreV2ErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: CoreV2ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = `CoreV2${code}Error`;
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends CoreV2DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('VALIDATION', message, details);
  }
}

export class ForbiddenError extends CoreV2DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('FORBIDDEN', message, details);
  }
}

export class NotFoundError extends CoreV2DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('NOT_FOUND', message, details);
  }
}

/** A uniqueness/identity collision (duplicate email, duplicate enrollment, …). */
export class ConflictError extends CoreV2DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('CONFLICT', message, details);
  }
}

/** The subject exists but is not in a state that admits this transition. */
export class InvalidStateError extends CoreV2DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('INVALID_STATE', message, details);
  }
}

export function isCoreV2DomainError(error: unknown): error is CoreV2DomainError {
  return error instanceof CoreV2DomainError;
}

/** Prisma "unique constraint failed" — the shape every race-safe invariant surfaces as. */
export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === 'P2002'
  );
}
