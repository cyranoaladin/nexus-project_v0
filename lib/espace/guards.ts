/**
 * Garde d'accès de l'espace pédagogique.
 *
 * Différence volontaire avec `lib/guards.ts` : ici une session valide n'a pas
 * besoin d'email (les élèves n'en ont pas). L'acteur est relu en base à chaque
 * requête (rôle et `disabledAt` actuels), jamais déduit du seul jeton.
 */
import { NextResponse } from 'next/server';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

import { EspaceError } from './errors';

export type EspaceRole = 'ELEVE' | 'COACH' | 'ADMIN';

export interface EspaceActor {
  id: string;
  role: EspaceRole;
  firstName: string | null;
  lastName: string | null;
}

export function isTeacherRole(role: string): role is 'COACH' | 'ADMIN' {
  return role === 'COACH' || role === 'ADMIN';
}

/** Acteur courant ou `null` (anonyme, compte désactivé, rôle étranger à l'espace). */
export async function getEspaceActor(): Promise<EspaceActor | null> {
  let session;
  try {
    session = await auth();
  } catch {
    return null;
  }
  const id = session?.user?.id;
  if (!id) return null;

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, firstName: true, lastName: true, disabledAt: true, mergedIntoUserId: true },
  });
  if (!user || user.disabledAt || user.mergedIntoUserId) return null;
  if (user.role !== 'ELEVE' && user.role !== 'COACH' && user.role !== 'ADMIN') return null;
  return { id: user.id, role: user.role, firstName: user.firstName, lastName: user.lastName };
}

export async function requireEspaceActor(allowed: readonly EspaceRole[]): Promise<EspaceActor | NextResponse> {
  const actor = await getEspaceActor();
  if (!actor) return errorResponse(new EspaceError('UNAUTHENTICATED', 'Connexion requise'));
  if (!allowed.includes(actor.role)) return errorResponse(new EspaceError('FORBIDDEN', 'Accès refusé'));
  return actor;
}

export function isResponse(value: EspaceActor | NextResponse): value is NextResponse {
  return value instanceof NextResponse;
}

export function errorResponse(error: unknown): NextResponse {
  if (error instanceof EspaceError) {
    return NextResponse.json(
      { error: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) },
      { status: error.status, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  // Jamais le message brut ni la pile côté client (peut contenir contenu d'élève ou chemins).
  logger.error({ errorName: error instanceof Error ? error.name : 'unknown' }, '[ESPACE] Unhandled error');
  return NextResponse.json(
    { error: 'INTERNAL', message: 'Une erreur est survenue' },
    { status: 500, headers: { 'Cache-Control': 'no-store' } },
  );
}
