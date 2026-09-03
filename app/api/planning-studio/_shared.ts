/**
 * Utilitaires partagés des routes /api/planning-studio (runtime Node).
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  createPlanningStudioService,
  PlanningConflictError,
  PlanningNotFoundError,
  PlanningValidationError,
  type PlanningDb,
} from '@/lib/planning-studio/service';

export const planningService = createPlanningStudioService(prisma as unknown as PlanningDb);

export function planningErrorResponse(err: unknown): NextResponse {
  if (err instanceof PlanningConflictError) {
    return NextResponse.json(
      {
        error: 'PLANNING_REVISION_CONFLICT',
        message: 'Le planning a été modifié par un autre utilisateur. Rechargez la version actuelle ou comparez les changements.',
        currentRevision: err.currentRevision,
        updatedAt: err.updatedAt,
        updatedBy: err.updatedBy,
      },
      { status: 409 },
    );
  }
  if (err instanceof PlanningValidationError) {
    return NextResponse.json(
      {
        error: 'PLANNING_PAYLOAD_INVALID',
        message: 'Le planning n\'a pas été enregistré : il ne respecte pas les règles du planificateur.',
        errors: err.errors,
        blocking: err.blocking.map((i) => ({ code: i.code, title: i.title, message: i.message, sessionIds: i.sessionIds })),
      },
      { status: 422 },
    );
  }
  if (err instanceof PlanningNotFoundError) {
    return NextResponse.json({ error: 'PLANNING_NOT_FOUND', message: err.message }, { status: 404 });
  }
  console.error('[planning-studio] erreur inattendue', err instanceof Error ? err.message : err);
  return NextResponse.json({ error: 'PLANNING_INTERNAL_ERROR', message: 'Erreur interne du planificateur.' }, { status: 500 });
}
