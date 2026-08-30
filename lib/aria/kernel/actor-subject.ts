import { AriaError } from '../errors';

export interface AriaActor {
  readonly userId: string;
  readonly role: 'ELEVE';
  readonly principalKind: 'INTERACTIVE';
}

export interface AriaSubject {
  readonly studentId: string;
  readonly userId: string;
}

export function resolveInteractiveStudentActor(principal: {
  readonly userId: string;
  readonly role: string;
}): AriaActor {
  if (!principal.userId || principal.role !== 'ELEVE') {
    throw new AriaError(
      'NOT_ENROLLED',
      403,
      'Ce point d’accès ARIA est réservé au profil élève authentifié.',
    );
  }
  return Object.freeze({
    userId: principal.userId,
    role: 'ELEVE' as const,
    principalKind: 'INTERACTIVE' as const,
  });
}

export function resolveStudentSelfSubject(
  actor: AriaActor,
  student: { readonly id: string; readonly userId: string },
): AriaSubject {
  if (student.userId !== actor.userId) {
    throw new AriaError('NOT_ENROLLED', 403, 'Profil élève non autorisé.');
  }
  return Object.freeze({ studentId: student.id, userId: student.userId });
}
