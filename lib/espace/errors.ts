/**
 * Erreurs métier de l'espace pédagogique, avec un code stable et le statut HTTP
 * correspondant. Les messages sont sobres : jamais de chemin, d'identifiant
 * interne d'un autre élève ni de contenu de travail.
 */
export type EspaceErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'NOT_ENROLLED'
  | 'INVALID_INPUT'
  | 'INVALID_TRANSITION'
  | 'WORK_LOCKED'
  | 'WORK_EMPTY'
  | 'REVISION_CONFLICT'
  | 'UPLOAD_REJECTED'
  | 'RATE_LIMITED';

const STATUS: Record<EspaceErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  NOT_ENROLLED: 403,
  INVALID_INPUT: 400,
  INVALID_TRANSITION: 409,
  WORK_LOCKED: 423,
  WORK_EMPTY: 409,
  REVISION_CONFLICT: 409,
  UPLOAD_REJECTED: 400,
  RATE_LIMITED: 429,
};

export class EspaceError extends Error {
  readonly status: number;
  constructor(
    readonly code: EspaceErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'EspaceError';
    this.status = STATUS[code];
  }
}
