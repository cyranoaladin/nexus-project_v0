import type { Session } from 'next-auth';

import { CanonicalApiError } from '../api/errors';

/**
 * Rôle strict pour la saisie papier.
 *
 * Recopier une copie, c'est écrire des réponses au nom d'un élève. Ce geste
 * n'appartient qu'au staff : ni un parent ni un élève ne doit pouvoir
 * l'atteindre, fût-ce en devinant l'URL. Le refus est un 404, comme partout
 * ailleurs dans les routes canoniques — l'existence même de la surface ne se
 * révèle pas à qui n'y a pas droit.
 */

const STAFF_ROLES: ReadonlySet<string> = new Set(['ASSISTANTE', 'ADMIN']);

export type StaffActor = Readonly<{ userId: string; role: 'ASSISTANTE' | 'ADMIN' }>;

export function isStaffRole(role: unknown): role is StaffActor['role'] {
  return typeof role === 'string' && STAFF_ROLES.has(role);
}

export function assertStaffActor(session: Session | null): StaffActor {
  if (session?.user === undefined) throw CanonicalApiError.unauthenticated();
  const { id, role } = session.user;
  if (typeof id !== 'string' || id.trim().length === 0) throw CanonicalApiError.notFound();
  if (!isStaffRole(role)) throw CanonicalApiError.notFound();
  return Object.freeze({ userId: id, role });
}
