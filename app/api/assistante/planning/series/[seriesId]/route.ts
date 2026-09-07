export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

import { isErrorResponse, requireAnyRole } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import { can } from '@/lib/rbac';
import { planningSeriesCancelSchema, planningSeriesEditSchema } from '@/lib/validation';
import { ACTIVE_BOOKING_STATUSES, type PlanningInvariantRequester } from '@/lib/planning/invariants';
import {
  PlanningCourseWithoutLegacySubjectError,
  PlanningInvariantViolationError,
  PlanningParticipantNotFoundError,
  PlanningTooManyOccurrencesError,
  buildRecurrenceRule,
  invariantFailuresIncludeConflict,
  isPlanningConflictDatabaseError,
  parseCalendarDate,
  rematerializeFutureOccurrences,
  tunisTodayUtcMidnight,
} from '@/lib/planning/series';

interface RouteParams {
  readonly params: Promise<{ seriesId: string }>;
}

/**
 * Frontière « futur » réutilisée par l'annulation ET l'édition : toute
 * occurrence dont `scheduledDate >= aujourd'hui` (minuit UTC Africa/Tunis —
 * `tunisTodayUtcMidnight`, lib/planning/series.ts) ET dont le statut est
 * encore ACTIF (`ACTIVE_BOOKING_STATUSES`, Tâche 10) est considérée future et
 * modifiable. Une occurrence `COMPLETED`/`CANCELLED`, ou dont la date est
 * déjà passée, n'est JAMAIS touchée par les deux opérations ci-dessous.
 */
const todayUtcMidnight = tunisTodayUtcMidnight;

class PlanningSeriesNotFoundError extends Error {
  constructor() {
    super('Série de planning introuvable');
    this.name = 'PlanningSeriesNotFoundError';
  }
}

/**
 * Conflit de révision optimiste sur `PlanningSeries.revision` — même idiome
 * CAS que `AcademicRevisionConflictError`
 * (lib/curriculum/student-academic-profile.ts, Tâche 6).
 */
class PlanningSeriesRevisionConflictError extends Error {
  readonly code = 'PLANNING_SERIES_REVISION_CONFLICT' as const;
  constructor() {
    super('La série a été modifiée entre-temps : relisez la révision courante avant de réessayer.');
    this.name = 'PlanningSeriesRevisionConflictError';
  }
}

function mapPlanningErrorToResponse(error: unknown, routeLabel: string): NextResponse | null {
  if (error instanceof PlanningSeriesNotFoundError) {
    return NextResponse.json({ error: 'Not Found', message: error.message }, { status: 404 });
  }
  if (error instanceof PlanningSeriesRevisionConflictError) {
    return NextResponse.json({ error: error.code, message: error.message }, { status: 409 });
  }
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

  console.error(routeLabel, error instanceof Error ? error.message : 'unknown');
  if (isPlanningConflictDatabaseError(error)) {
    return NextResponse.json(
      { error: 'Conflict', message: 'Conflit détecté : créneau déjà occupé ou sérialisation concurrente. Réessayez.' },
      { status: 409 },
    );
  }
  return null;
}

/**
 * DELETE /api/assistante/planning/series/[seriesId] — annulation future-only.
 *
 * Annule TOUTES les occurrences futures actives de la série ; les occurrences
 * passées ou déjà terminées/annulées ne sont jamais touchées (checklist
 * Tâche 11 : « Keep unrelated historical bookings at planningSeriesId = null »
 * et « future-only cancellation »). La série elle-même passe à `CANCELLED`
 * puisqu'il n'existe plus aucun planning futur qu'elle gouverne.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { seriesId } = await params;

  const sessionOrError = await requireAnyRole(['ADMIN', 'ASSISTANTE']);
  if (isErrorResponse(sessionOrError)) return sessionOrError;
  const session = sessionOrError;

  if (!can(session.user.role, 'UPDATE', 'SESSION')) {
    return NextResponse.json({ error: 'Forbidden', message: 'Permission insuffisante' }, { status: 403 });
  }

  let reason: string | undefined;
  try {
    const rawBody = await request.text();
    if (rawBody) {
      const parsedBody = planningSeriesCancelSchema.safeParse(JSON.parse(rawBody));
      reason = parsedBody.success ? parsedBody.data.reason : undefined;
    }
  } catch {
    reason = undefined;
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const series = await tx.planningSeries.findUnique({ where: { id: seriesId }, select: { id: true } });
      if (!series) throw new PlanningSeriesNotFoundError();

      const boundary = todayUtcMidnight();
      const cancelled = await tx.sessionBooking.updateMany({
        where: {
          planningSeriesId: seriesId,
          scheduledDate: { gte: boundary },
          status: { in: [...ACTIVE_BOOKING_STATUSES] },
        },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          coachNotes: reason ? `Cancelled: ${reason}` : 'Cancelled',
        },
      });

      await tx.planningSeries.update({ where: { id: seriesId }, data: { status: 'CANCELLED' } });

      return { cancelledCount: cancelled.count };
    });

    return NextResponse.json({ success: true, cancelledCount: result.cancelledCount });
  } catch (error) {
    const mapped = mapPlanningErrorToResponse(error, '[DELETE /api/assistante/planning/series/[seriesId]]');
    if (mapped) return mapped;
    return NextResponse.json({ error: 'Internal Server Error', message: 'Erreur interne du serveur' }, { status: 500 });
  }
}

/**
 * PUT /api/assistante/planning/series/[seriesId] — édition future-only avec
 * rematérialisation idempotente.
 *
 * CAS optimiste sur `revision` (même idiome que Tâche 6) : une révision
 * périmée échoue en 409 `PLANNING_SERIES_REVISION_CONFLICT` plutôt que
 * d'écraser silencieusement une édition concurrente. En cas de succès :
 * annule les occurrences futures existantes puis rematérialise le planning
 * révisé (`rematerializeFutureOccurrences`, lib/planning/series.ts), qui
 * réapplique intégralement les invariants de la Tâche 10. Le planning révisé
 * ne démarre jamais avant aujourd'hui (clamp `boundary`), même si le client
 * fournit une `startDate` passée — cohérent avec « future-only ».
 *
 * Idempotence : une fois la révision incrémentée par un premier appel
 * réussi, un rejeu de la MÊME requête (même `expectedRevision`) échoue en
 * 409 plutôt que de rematérialiser une seconde fois — la rematérialisation
 * ne peut donc jamais être dupliquée par une requête rejouée.
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { seriesId } = await params;

  const sessionOrError = await requireAnyRole(['ADMIN', 'ASSISTANTE']);
  if (isErrorResponse(sessionOrError)) return sessionOrError;
  const session = sessionOrError;

  if (!can(session.user.role, 'UPDATE', 'SESSION')) {
    return NextResponse.json({ error: 'Forbidden', message: 'Permission insuffisante' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Bad Request', message: 'Corps de requête invalide' }, { status: 400 });
  }

  const parsed = planningSeriesEditSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.errors[0];
    return NextResponse.json(
      { error: 'Bad Request', message: first?.message ?? 'Données invalides', details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;

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

  let requestedStartDate: Date;
  let until: Date | undefined;
  try {
    requestedStartDate = parseCalendarDate(input.startDate);
    until = input.recurrence?.until ? parseCalendarDate(input.recurrence.until) : undefined;
  } catch {
    return NextResponse.json({ error: 'Bad Request', message: 'Date invalide' }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const series = await tx.planningSeries.findUnique({
          where: { id: seriesId },
          select: {
            id: true,
            studentProfileId: true,
            coachProfileId: true,
            assignmentId: true,
            academicCourseKey: true,
          },
        });
        if (!series) throw new PlanningSeriesNotFoundError();

        const intervalWeeks = input.recurrence?.intervalWeeks ?? 1;
        const count = input.recurrence ? input.recurrence.count : 1;

        const cas = await tx.planningSeries.updateMany({
          where: { id: seriesId, revision: input.expectedRevision },
          data: {
            revision: input.expectedRevision + 1,
            startDate: requestedStartDate,
            localStartTime: input.localStartTime,
            localEndTime: input.localEndTime,
            recurrenceRule: buildRecurrenceRule(intervalWeeks, count, until),
            recurrenceCount: count ?? null,
            recurrenceUntil: until ?? null,
            modality: input.modality,
            location: input.location ?? null,
          },
        });
        if (cas.count === 0) throw new PlanningSeriesRevisionConflictError();

        // Future-only : le planning révisé ne remonte jamais avant aujourd'hui,
        // même si le client fournit une startDate passée.
        const boundary = todayUtcMidnight();
        const rematerializationStart = requestedStartDate > boundary ? requestedStartDate : boundary;

        await tx.sessionBooking.updateMany({
          where: {
            planningSeriesId: seriesId,
            scheduledDate: { gte: boundary },
            status: { in: [...ACTIVE_BOOKING_STATUSES] },
          },
          data: { status: 'CANCELLED', cancelledAt: new Date(), coachNotes: 'Cancelled: série révisée' },
        });

        const occurrences = await rematerializeFutureOccurrences(
          tx,
          {
            seriesId: series.id,
            studentProfileId: series.studentProfileId,
            coachProfileId: series.coachProfileId,
            assignmentId: series.assignmentId,
            academicCourseKey: series.academicCourseKey,
            modality: input.modality,
            location: input.location ?? null,
            localStartTime: input.localStartTime,
            localEndTime: input.localEndTime,
            durationMinutes: input.duration,
            title: input.title,
            description: input.description ?? null,
            type: input.type,
            startDate: rematerializationStart,
            intervalWeeks,
            count,
            until,
          },
          requester,
        );

        return { revision: input.expectedRevision + 1, occurrences };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 },
    );

    return NextResponse.json({
      success: true,
      seriesId,
      revision: result.revision,
      sessions: result.occurrences.map((occurrence) => ({
        id: occurrence.id,
        scheduledDate: occurrence.scheduledDate.toISOString(),
        startTime: occurrence.startTime,
        endTime: occurrence.endTime,
        occurrenceKey: occurrence.occurrenceKey,
      })),
    });
  } catch (error) {
    const mapped = mapPlanningErrorToResponse(error, '[PUT /api/assistante/planning/series/[seriesId]]');
    if (mapped) return mapped;
    return NextResponse.json({ error: 'Internal Server Error', message: 'Erreur interne du serveur' }, { status: 500 });
  }
}
