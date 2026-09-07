export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

import { isErrorResponse, requireAnyRole } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import { can } from '@/lib/rbac';
import { assistantCreateSessionBookingSchema } from '@/lib/validation';
import type { PlanningInvariantRequester } from '@/lib/planning/invariants';
import {
  PlanningCourseWithoutLegacySubjectError,
  PlanningInvariantViolationError,
  PlanningParticipantNotFoundError,
  PlanningTooManyOccurrencesError,
  invariantFailuresIncludeConflict,
  isPlanningConflictDatabaseError,
  materializePlanningSeries,
  parseCalendarDate,
} from '@/lib/planning/series';

/**
 * POST /api/assistante/sessions — planification gouvernée (Tâche 11).
 *
 * Chemin UNIQUE de création de séance côté staff : une occurrence isolée est
 * une `PlanningSeries` avec `recurrenceCount: 1` (voir lib/planning/series.ts
 * pour la justification de ce choix). Tous les invariants (identité
 * pédagogique, disponibilité effective, conflits Élève/Coach/Stage) viennent
 * intégralement de la Tâche 10 (`lib/planning/invariants.ts`) — cette route
 * ne réimplémente plus AUCUN contrôle métier.
 */
export async function POST(req: NextRequest) {
  const sessionOrError = await requireAnyRole(['ADMIN', 'ASSISTANTE']);
  if (isErrorResponse(sessionOrError)) return sessionOrError;
  const session = sessionOrError;

  if (!can(session.user.role, 'CREATE', 'SESSION')) {
    return NextResponse.json(
      { error: 'Forbidden', message: 'Permission insuffisante' },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Bad Request', message: 'Corps de requête invalide' }, { status: 400 });
  }

  const parsed = assistantCreateSessionBookingSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.errors[0];
    return NextResponse.json(
      { error: 'Bad Request', message: first?.message ?? 'Données invalides', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const input = parsed.data;

  // ASSISTANTE n'a structurellement AUCUNE dérogation : `PlanningInvariantRequester`
  // ne lui expose même pas de champ `override` — un tel champ ne peut donc
  // JAMAIS être transmis à la construction du requester ci-dessous. Un
  // ASSISTANTE qui en fournit un dans le corps de la requête est rejeté
  // explicitement, plutôt que silencieusement ignoré.
  if (input.override && session.user.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'Forbidden', message: 'Seul ADMIN peut fournir une dérogation de planification' },
      { status: 403 },
    );
  }

  const requester: PlanningInvariantRequester =
    session.user.role === 'ADMIN'
      ? { role: 'ADMIN', actorId: session.user.id, override: input.override }
      : { role: 'ASSISTANTE', actorId: session.user.id };

  let startDate: Date;
  let until: Date | undefined;
  try {
    startDate = parseCalendarDate(input.scheduledDate);
    until = input.recurrence?.until ? parseCalendarDate(input.recurrence.until) : undefined;
  } catch {
    return NextResponse.json({ error: 'Bad Request', message: 'Date invalide' }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(
      (tx) =>
        materializePlanningSeries(
          tx,
          {
            studentProfileId: input.studentProfileId,
            coachProfileId: input.coachProfileId,
            assignmentId: input.assignmentId,
            academicCourseKey: input.academicCourseKey,
            startDate,
            localStartTime: input.startTime,
            localEndTime: input.endTime,
            durationMinutes: input.duration,
            intervalWeeks: input.recurrence?.intervalWeeks ?? 1,
            // Occurrence isolée (pas de récurrence demandée) = count: 1, jamais
            // un chemin de code séparé — voir lib/planning/series.ts.
            count: input.recurrence ? input.recurrence.count : 1,
            until,
            modality: input.modality,
            location: input.location ?? null,
            type: input.type,
            title: input.title,
            description: input.description ?? null,
            createdById: session.user.id,
          },
          requester,
        ),
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 15000,
      },
    );

    return NextResponse.json(
      {
        success: true,
        seriesId: result.seriesId,
        sessions: result.occurrences.map((occurrence) => ({
          id: occurrence.id,
          scheduledDate: occurrence.scheduledDate.toISOString(),
          startTime: occurrence.startTime,
          endTime: occurrence.endTime,
          occurrenceKey: occurrence.occurrenceKey,
        })),
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof PlanningTooManyOccurrencesError) {
      return NextResponse.json({ error: 'Bad Request', message: error.message }, { status: 400 });
    }
    if (error instanceof PlanningParticipantNotFoundError || error instanceof PlanningCourseWithoutLegacySubjectError) {
      return NextResponse.json({ error: 'Bad Request', message: error.message }, { status: 400 });
    }
    if (error instanceof PlanningInvariantViolationError) {
      const status = invariantFailuresIncludeConflict(error.failures) ? 409 : 400;
      return NextResponse.json(
        {
          error: status === 409 ? 'Conflict' : 'Bad Request',
          message: error.failures.map((f) => f.message).join('; '),
          failures: error.failures,
        },
        { status },
      );
    }

    console.error('[POST /api/assistante/sessions]', error instanceof Error ? error.message : 'unknown');
    if (isPlanningConflictDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Conflict', message: 'Conflit détecté : créneau déjà occupé ou sérialisation concurrente. Réessayez.' },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: 'Internal Server Error', message: 'Erreur interne du serveur' }, { status: 500 });
  }
}
