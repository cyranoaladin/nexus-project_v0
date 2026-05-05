export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

import { isErrorResponse, requireAnyRole } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import { can } from '@/lib/rbac';
import { assistantCreateSessionBookingSchema } from '@/lib/validation';
import { parseSubjects } from '@/lib/utils/subjects';

function normalizeTime(time: string): string {
  const [h, m] = time.split(':').map((v) => parseInt(v, 10));
  const hh = String(Number.isNaN(h) ? 0 : h).padStart(2, '0');
  const mm = String(Number.isNaN(m) ? 0 : m).padStart(2, '0');
  return `${hh}:${mm}`;
}

function parseLocalDateOnly(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map((v) => parseInt(v, 10));
  if (!y || !m || !d) throw new Error('Invalid date format');
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) throw new Error('Invalid date value');
  date.setHours(0, 0, 0, 0);
  return date;
}

function combineDateAndTime(date: Date, time: string): Date {
  const [h, m] = time.split(':').map((v) => parseInt(v, 10));
  const dt = new Date(date);
  dt.setHours(Number.isNaN(h) ? 0 : h, Number.isNaN(m) ? 0 : m, 0, 0);
  return dt;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export async function POST(req: NextRequest) {
  const sessionOrError = await requireAnyRole(['ADMIN', 'ASSISTANTE']);
  if (isErrorResponse(sessionOrError)) return sessionOrError;
  const session = sessionOrError;

  if (!can(session.user.role, 'CREATE', 'SESSION')) {
    return NextResponse.json(
      { error: 'Forbidden', message: 'Permission insuffisante' },
      { status: 403 }
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
      { status: 400 }
    );
  }

  const input = parsed.data;

  const requestStartTime = normalizeTime(input.startTime);
  const requestEndTime = normalizeTime(input.endTime);
  const firstDate = parseLocalDateOnly(input.scheduledDate);

  const dates: Date[] = [];
  if (!input.recurrence) {
    dates.push(firstDate);
  } else {
    const { intervalWeeks } = input.recurrence;
    if (input.recurrence.count) {
      for (let i = 0; i < input.recurrence.count; i++) {
        dates.push(addDays(firstDate, 7 * intervalWeeks * i));
      }
    } else if (input.recurrence.until) {
      const until = parseLocalDateOnly(input.recurrence.until);
      let cursor = new Date(firstDate);
      // Hard safety limit to prevent runaway inserts
      const maxOccurrences = 104;
      while (cursor <= until && dates.length < maxOccurrences) {
        dates.push(new Date(cursor));
        cursor = addDays(cursor, 7 * intervalWeeks);
      }
      if (dates.length >= maxOccurrences && cursor <= until) {
        return NextResponse.json(
          { error: 'Bad Request', message: `Trop d’occurrences (max ${maxOccurrences})` },
          { status: 400 }
        );
      }
    }
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      // Load and validate core entities once
      const coachUser = await tx.user.findUnique({
        where: { id: input.coachId },
        select: { id: true, role: true, firstName: true, lastName: true },
      });
      if (!coachUser || coachUser.role !== 'COACH') {
        return { ok: false as const, status: 400, message: 'Coach introuvable' };
      }

      const studentUser = await tx.user.findUnique({
        where: { id: input.studentId },
        select: { id: true, role: true, firstName: true, lastName: true },
      });
      if (!studentUser || studentUser.role !== 'ELEVE') {
        return { ok: false as const, status: 400, message: 'Élève introuvable' };
      }

      const studentEntity = await tx.student.findUnique({
        where: { userId: input.studentId },
        select: {
          id: true,
          parent: { select: { userId: true } },
        },
      });
      if (!studentEntity) {
        return { ok: false as const, status: 400, message: 'Dossier élève introuvable' };
      }

      const coachProfile = await tx.coachProfile.findUnique({
        where: { userId: input.coachId },
        select: { id: true, subjects: true },
      });

      const createdBookings = [];

      for (const scheduledDate of dates) {
        const dayOfWeek = scheduledDate.getDay();
        const startAt = combineDateAndTime(scheduledDate, requestStartTime);
        const endAt = combineDateAndTime(scheduledDate, requestEndTime);

        // Conflicts are ALWAYS blocked (even when override=true)
        const coachConflict = await tx.sessionBooking.findFirst({
          where: {
            coachId: input.coachId,
            scheduledDate,
            status: { in: ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'] },
            AND: [{ startTime: { lt: requestEndTime } }, { endTime: { gt: requestStartTime } }],
          },
          select: { id: true },
        });
        if (coachConflict) {
          return { ok: false as const, status: 409, message: 'Conflit : le coach a déjà une séance sur ce créneau.' };
        }

        const studentConflict = await tx.sessionBooking.findFirst({
          where: {
            studentId: input.studentId,
            scheduledDate,
            status: { in: ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'] },
            AND: [{ startTime: { lt: requestEndTime } }, { endTime: { gt: requestStartTime } }],
          },
          select: { id: true },
        });
        if (studentConflict) {
          return { ok: false as const, status: 409, message: 'Conflit : l’élève a déjà une séance sur ce créneau.' };
        }

        if (coachProfile?.id) {
          const coachStageConflict = await tx.stageSession.findFirst({
            where: {
              coachId: coachProfile.id,
              startAt: { lt: endAt },
              endAt: { gt: startAt },
            },
            select: { id: true },
          });
          if (coachStageConflict) {
            return { ok: false as const, status: 409, message: 'Conflit : le coach est déjà en stage sur ce créneau.' };
          }
        }

        const studentStageConflict = await tx.stageSession.findFirst({
          where: {
            startAt: { lt: endAt },
            endAt: { gt: startAt },
            stage: {
              reservations: {
                some: {
                  studentId: studentEntity.id,
                  NOT: [{ richStatus: 'CANCELLED' }, { status: 'CANCELLED' }],
                },
              },
            },
          },
          select: { id: true },
        });
        if (studentStageConflict) {
          return { ok: false as const, status: 409, message: 'Conflit : l’élève est déjà en stage sur ce créneau.' };
        }

        // Non-conflict validations (bypassable with override)
        if (!input.override) {
          if (!coachProfile) {
            return { ok: false as const, status: 400, message: 'Coach non configuré (profil manquant). Utilisez “forcer” si nécessaire.' };
          }

          const coachSubjects = parseSubjects(coachProfile.subjects);
          if (!coachSubjects.includes(input.subject)) {
            return { ok: false as const, status: 400, message: 'Le coach n’enseigne pas cette matière. Utilisez “forcer” si nécessaire.' };
          }

          const dayStart = new Date(scheduledDate);
          dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(scheduledDate);
          dayEnd.setHours(23, 59, 59, 999);

          const availability = await tx.coachAvailability.findFirst({
            where: {
              coachId: input.coachId,
              isAvailable: true,
              OR: [
                {
                  dayOfWeek,
                  isRecurring: true,
                  startTime: { lte: requestStartTime },
                  endTime: { gte: requestEndTime },
                },
                {
                  isRecurring: false,
                  specificDate: { gte: dayStart, lte: dayEnd },
                  startTime: { lte: requestStartTime },
                  endTime: { gte: requestEndTime },
                },
              ],
            },
            select: { id: true },
          });

          if (!availability) {
            return { ok: false as const, status: 400, message: 'Le coach n’est pas disponible sur ce créneau. Utilisez “forcer” si nécessaire.' };
          }

          if (input.creditsUsed > 0) {
            const creditTxs = await tx.creditTransaction.findMany({
              where: {
                studentId: studentEntity.id,
                OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
              },
              select: { amount: true },
            });
            const creditBalance = creditTxs.reduce((sum, t) => sum + (t.amount ?? 0), 0);
            if (creditBalance < input.creditsUsed) {
              return { ok: false as const, status: 400, message: 'Crédits insuffisants. Utilisez “forcer” si nécessaire.' };
            }
          }
        }

        const booking = await tx.sessionBooking.create({
          data: {
            studentId: input.studentId,
            coachId: input.coachId,
            parentId: studentEntity.parent.userId,
            subject: input.subject,
            title: input.title,
            description: input.description,
            scheduledDate,
            startTime: requestStartTime,
            endTime: requestEndTime,
            duration: input.duration,
            type: input.type,
            modality: input.modality,
            location: input.location,
            creditsUsed: 0,
            status: 'SCHEDULED',
          },
          select: {
            id: true,
            scheduledDate: true,
            startTime: true,
            endTime: true,
          },
        });

        createdBookings.push(booking);
      }

      return { ok: true as const, createdBookings };
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 15000,
    });

    if (!created.ok) {
      return NextResponse.json({ error: 'Bad Request', message: created.message }, { status: created.status });
    }

    return NextResponse.json(
      {
        success: true,
        sessions: created.createdBookings.map((b) => ({
          id: b.id,
          scheduledDate: b.scheduledDate.toISOString(),
          startTime: b.startTime,
          endTime: b.endTime,
        })),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[POST /api/assistante/sessions]', error instanceof Error ? error.message : 'unknown');
    const prismaCode = (error as { code?: string })?.code;
    if (prismaCode === '23P01') {
      return NextResponse.json(
        { error: 'Conflict', message: 'Conflit détecté : créneau déjà occupé.' },
        { status: 409 }
      );
    }
    if (prismaCode === 'P2034') {
      return NextResponse.json(
        { error: 'Conflict', message: 'Conflit de sérialisation. Réessayez.' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: 'Internal Server Error', message: 'Erreur interne du serveur' }, { status: 500 });
  }
}

