// Sibling kernel import, not the top-level `../errors` (which also wires in
// `next/server` for its unrelated HTTP-response helpers) — mirrors
// `actor-subject.ts`'s own reasoning exactly.
import { AriaError } from './errors';

/**
 * A distinct actor kind from `AriaActor` (ELEVE, self-service only) —
 * deliberately its own type, never a widened role check on the existing
 * one. `evidence/list.ts`'s own docstring flagged parent access as
 * explicit future scope requiring its own authorization path; this is
 * that path, not a loosening of the student one.
 */
export interface AriaParentActor {
  readonly userId: string;
  readonly role: 'PARENT';
  readonly principalKind: 'INTERACTIVE';
}

export function resolveInteractiveParentActor(principal: {
  readonly userId: string;
  readonly role: string;
}): AriaParentActor {
  if (!principal.userId || principal.role !== 'PARENT') {
    throw new AriaError(
      'NOT_ENROLLED',
      403,
      'Ce point d’accès ARIA est réservé au profil parent authentifié.',
    );
  }
  return Object.freeze({
    userId: principal.userId,
    role: 'PARENT' as const,
    principalKind: 'INTERACTIVE' as const,
  });
}
