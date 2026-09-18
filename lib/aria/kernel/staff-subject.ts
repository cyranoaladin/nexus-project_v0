// Sibling kernel import, not the top-level `../errors` (which also wires in
// `next/server` for its unrelated HTTP-response helpers) — mirrors
// `actor-subject.ts`/`parent-subject.ts`'s own reasoning exactly.
import { AriaError } from './errors';

/**
 * A distinct actor kind (ASSISTANTE, staff-only) — P7d's collective
 * workshops are the first real ARIA capability an ASSISTANTE actually
 * administers (schedules a session, marks attendance), never a widened
 * role check on the student or parent ones.
 */
export interface AriaStaffActor {
  readonly userId: string;
  readonly role: 'ASSISTANTE';
  readonly principalKind: 'INTERACTIVE';
}

export function resolveInteractiveStaffActor(principal: {
  readonly userId: string;
  readonly role: string;
}): AriaStaffActor {
  if (!principal.userId || principal.role !== 'ASSISTANTE') {
    throw new AriaError(
      'NOT_ENROLLED',
      403,
      'Ce point d’accès ARIA est réservé au profil assistante authentifié.',
    );
  }
  return Object.freeze({
    userId: principal.userId,
    role: 'ASSISTANTE' as const,
    principalKind: 'INTERACTIVE' as const,
  });
}
