import { serializeError } from '@/lib/utils/serialize-error';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { parseSubjects } from '@/lib/utils/subjects';
import { parseCalendarDate } from '@/lib/planning/series';

interface SanitizedAvailabilityWindow {
  readonly dayOfWeek: number;
  readonly startTime: string;
  readonly endTime: string;
}

interface RawAvailabilityRow {
  readonly dayOfWeek: number;
  readonly startTime: string;
  readonly endTime: string;
  readonly isAvailable: boolean;
  readonly isRecurring: boolean;
  readonly specificDate: Date | null;
  readonly validFrom: Date;
  readonly validUntil: Date | null;
}

/** Tronque à minuit UTC — même convention que lib/planning/effective-availability.ts (Tâche 10). */
function startOfUTCDate(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/**
 * Résumé SANITIZÉ du motif hebdomadaire récurrent d'un coach — jamais les
 * lignes `CoachAvailability` brutes.
 *
 * Cet endpoint sert un ANNUAIRE de coachs (parcourir/choisir un coach par
 * matière), pas un calendrier de créneaux précis : la résolution complète
 * créneau-par-créneau (blackouts, dérogations datées — Task 10
 * `resolveEffectiveAvailability`) reste le rôle de
 * `/api/coaches/availability`, qui a un candidat précis à évaluer. Ici, il
 * n'existe aucun candidat unique — seul le motif RÉCURRENT, actuellement
 * valide et disponible, a un sens comme résumé de capacité générale :
 *   - une ligne `specificDate` (blackout OU dérogation ponctuelle) ne
 *     concerne qu'UN jour précis, jamais la capacité générale du coach ;
 *   - un blackout (`isAvailable: false`) n'a de toute façon rien à faire
 *     dans une projection destinée à un PARENT/ELEVE parcourant des coachs.
 * Un coach sans motif récurrent actuellement valide apparaît simplement avec
 * `availability: []` — jamais une ligne interne brute à charge du client de
 * réinterpréter.
 */
function sanitizeRecurringAvailability(rows: readonly RawAvailabilityRow[]): SanitizedAvailabilityWindow[] {
  const today = startOfUTCDate(new Date());
  return rows
    .filter((row) => row.isRecurring && row.isAvailable && row.specificDate === null)
    .filter(
      (row) =>
        startOfUTCDate(row.validFrom) <= today && (row.validUntil === null || startOfUTCDate(row.validUntil) >= today),
    )
    .map((row) => ({ dayOfWeek: row.dayOfWeek, startTime: row.startTime, endTime: row.endTime }));
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session || (session.user.role !== 'ELEVE' && session.user.role !== 'PARENT')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const subject = searchParams.get('subject');
    const date = searchParams.get('date');
    // Jour calendaire dérivé des accesseurs UTC d'une date UTC-minuit (convention
    // établie par lib/planning/series.ts, Tâche 11) — jamais `new Date(date).getDay()`,
    // qui convertit à l'heure murale du SERVEUR avant de lire le jour et peut décaler
    // la journée d'un cran selon le fuseau d'exécution (P3 Tâche 20 : ce filtre
    // facultatif d'annuaire de coachs ne doit dépendre d'aucun fuseau serveur ambiant).
    // Une valeur `date` invalide neutralise simplement le filtre facultatif (comportement
    // déjà permissif inchangé), plutôt que de transformer une entrée invalide en 500.
    let dayOfWeekFilter: number | null = null;
    if (date) {
      try {
        dayOfWeekFilter = parseCalendarDate(date).getUTCDay();
      } catch {
        dayOfWeekFilter = null;
      }
    }

    // Toutes les lignes sont chargées (jamais préfiltrées par jour côté
    // requête) : la sanitization a besoin de isAvailable/isRecurring/
    // specificDate/validFrom/validUntil pour décider ce qui est exposable,
    // avant tout filtre optionnel par jour demandé.
    const coaches = await prisma.coachProfile.findMany({
      include: {
        user: {
          include: {
            coachAvailabilities: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const formattedCoaches = coaches
      .filter((coach) => {
        if (!subject) return true;
        const subs = parseSubjects(coach.subjects);
        return subs.includes(subject);
      })
      .map((coach) => {
        let availability = sanitizeRecurringAvailability(coach.user.coachAvailabilities);
        if (dayOfWeekFilter !== null) {
          availability = availability.filter((window) => window.dayOfWeek === dayOfWeekFilter);
        }
        return {
          id: coach.id, // CoachProfile.id — identité canonique (Tâche 12), jamais coach.userId
          firstName: coach.user.firstName,
          lastName: coach.user.lastName,
          coachSubjects: parseSubjects(coach.subjects),
          availability,
          bio: coach.description,
          philosophy: coach.philosophy,
          expertise: coach.expertise
        };
      });

    return NextResponse.json({
      success: true,
      coaches: formattedCoaches
    });

  } catch (error) {
    console.error('Error fetching available coaches:', serializeError(error));
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error'
      },
      { status: 500 }
    );
  }
}
