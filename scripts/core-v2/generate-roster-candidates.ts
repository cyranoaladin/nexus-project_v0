/**
 * Générateur de candidats roster 2026-2027 (mission "Core v2 Canonical
 * Architecture", §12-14).
 *
 * Remplace le signal rejeté par le propriétaire (`createdAt` < 90 jours,
 * ancienne assignment) par des signaux CONTRACTUELS réels : abonnement
 * recouvrant l'année scolaire visée, paiement/facture réglé dans cette
 * fenêtre, devis/contrat candidat-individuel lié, planning ou séance future
 * confirmée. Un signal seul ne devient `ROSTER_2026_2027_CANDIDATE` que s'il
 * est de nature contractuelle — la simple ancienneté du compte ou l'existence
 * d'une ancienne assignment ne suffisent jamais.
 *
 * Les affectations `coach_student_assignments` héritées sont VOLONTAIREMENT
 * ignorées comme signal roster (mission §14) : ce générateur ne les lit même
 * pas pour ce calcul, afin qu'aucune régression ne les réintroduise plus
 * tard par erreur.
 *
 * Ce script est un CANDIDAT, jamais une approbation : `recommendedDisposition`
 * n'écrit rien en base et ne crée aucune `StudentAcademicYearEnrollment`.
 * L'approbation reste un acte séparé et explicite du propriétaire.
 *
 * Usage :
 *   tsx scripts/core-v2/generate-roster-candidates.ts [--school-year=2026-2027] [--out=path.json]
 */

import { prisma } from '@/lib/prisma';

const DEFAULT_SCHOOL_YEAR = '2026-2027';

export type RosterDisposition =
  | 'ROSTER_2026_2027_CANDIDATE'
  | 'NOT_MIGRATED_CANDIDATE'
  | 'NEEDS_OWNER_REVIEW';

export interface RosterSignals {
  readonly current_subscription: boolean;
  readonly payment_2026_2027: boolean;
  readonly current_quote_contract: boolean;
  readonly future_planning: boolean;
  readonly explicit_2026_2027_registration: boolean;
  readonly recent_enrollment_workflow: boolean;
  readonly legacy_assignment_ignored_for_roster: true;
}

export interface RosterCandidateRow {
  readonly studentId: string;
  readonly displayLabel: string;
  readonly signals: RosterSignals;
  readonly recommendedDisposition: RosterDisposition;
}

export interface RosterCandidateReport {
  readonly generatedAt: string;
  readonly schoolYear: string;
  readonly totalStudents: number;
  readonly counts: Record<RosterDisposition, number>;
  readonly students: readonly RosterCandidateRow[];
}

export function schoolYearWindow(schoolYear: string): { start: Date; end: Date } {
  const [startYear] = schoolYear.split('-').map((s) => Number.parseInt(s, 10));
  return {
    start: new Date(Date.UTC(startYear, 8, 1)), // 1 Sept
    end: new Date(Date.UTC(startYear + 1, 7, 31, 23, 59, 59)), // 31 Aug
  };
}

function overlaps(aStart: Date, aEnd: Date | null, bStart: Date, bEnd: Date): boolean {
  const effectiveAEnd = aEnd ?? bEnd;
  return aStart <= bEnd && effectiveAEnd >= bStart;
}

export function classify(signals: RosterSignals): RosterDisposition {
  const contractual =
    signals.current_subscription ||
    signals.payment_2026_2027 ||
    signals.current_quote_contract ||
    signals.future_planning;
  return contractual ? 'ROSTER_2026_2027_CANDIDATE' : 'NOT_MIGRATED_CANDIDATE';
}

export async function generateRosterCandidates(
  schoolYear: string = DEFAULT_SCHOOL_YEAR,
): Promise<RosterCandidateReport> {
  const { start, end } = schoolYearWindow(schoolYear);
  const now = new Date();

  const students = await prisma.student.findMany({
    select: {
      id: true,
      gradeLevel: true,
      academicTrack: true,
      // Payment.userId is the PAYING PARENT's account, never the student's
      // own — a student has no payments of their own. To match a completed
      // payment to a student we must go through the student's parent, not
      // through a (nonexistent) direct student payment relation.
      parent: { select: { userId: true } },
      user: { select: { firstName: true, lastName: true, registrationCompletedAt: true, activatedAt: true } },
      subscriptions: { select: { status: true, startDate: true, endDate: true } },
      // createdAt is required to scope a quote to THIS school year: an
      // ACCEPTE/INSCRIT quote from a past, already-completed exam session
      // must not count as a current 2026-2027 signal just because its
      // terminal status was never cleaned up.
      quotes: { select: { status: true, createdAt: true } },
      planningSeries: { select: { status: true } },
      canonicalSessionBookings: { select: { scheduledDate: true } },
    },
  });

  // A quote is only a "current" contractual signal if it was actually
  // created reasonably close to the school year in question — not simply
  // ever accepted. Lookback covers a family contracting up to 6 months
  // ahead of the year starting; anything older is stale history, not a
  // 2026-2027 commitment.
  const quoteLookbackStart = new Date(start);
  quoteLookbackStart.setUTCMonth(quoteLookbackStart.getUTCMonth() - 6);

  const paidByParentUserId = new Set(
    (
      await prisma.payment.findMany({
        where: { status: 'COMPLETED', createdAt: { gte: start, lte: end } },
        select: { userId: true },
      })
    )
      .map((p) => p.userId)
      .filter((id): id is string => Boolean(id)),
  );

  const rows: RosterCandidateRow[] = students.map((s) => {
    const currentSubscription = s.subscriptions.some(
      (sub) => sub.status === 'ACTIVE' && overlaps(sub.startDate, sub.endDate, start, end),
    );
    // Only a genuinely contractual quote state counts — an in-progress
    // simulation (ESTIMATION/BILAN_*/DEVIS_*) is not yet a commitment — AND
    // only if it was created close enough to this school year to plausibly
    // be about it, not an old accepted quote from a past exam session.
    const currentQuote = s.quotes.some(
      (q) =>
        (q.status === 'ACCEPTE' || q.status === 'INSCRIT') &&
        q.createdAt >= quoteLookbackStart &&
        q.createdAt <= end,
    );
    const futurePlanning =
      s.planningSeries.some((p) => p.status === 'ACTIVE') ||
      s.canonicalSessionBookings.some((b) => b.scheduledDate > now);
    const explicitRegistration = Boolean(
      s.user.registrationCompletedAt && s.user.registrationCompletedAt >= start,
    );

    const signals: RosterSignals = {
      current_subscription: currentSubscription,
      payment_2026_2027: paidByParentUserId.has(s.parent.userId),
      current_quote_contract: currentQuote,
      future_planning: futurePlanning,
      explicit_2026_2027_registration: explicitRegistration,
      // No FamilyRequest→Student link exists pre-creation; treated as a
      // structurally weak/unavailable signal for an already-existing
      // Student row, kept false here (never sufficient alone regardless).
      recent_enrollment_workflow: false,
      legacy_assignment_ignored_for_roster: true,
    };

    return {
      studentId: s.id,
      displayLabel: `${s.user.firstName ?? '?'} ${(s.user.lastName ?? '?').charAt(0)}. (${s.gradeLevel}/${s.academicTrack})`,
      signals,
      recommendedDisposition: classify(signals),
    };
  });

  const counts: Record<RosterDisposition, number> = {
    ROSTER_2026_2027_CANDIDATE: 0,
    NOT_MIGRATED_CANDIDATE: 0,
    NEEDS_OWNER_REVIEW: 0,
  };
  for (const row of rows) counts[row.recommendedDisposition] += 1;

  return {
    generatedAt: new Date().toISOString(),
    schoolYear,
    totalStudents: rows.length,
    counts,
    students: rows,
  };
}

async function main(argv: readonly string[]): Promise<void> {
  const schoolYearArg = argv.find((a) => a.startsWith('--school-year='))?.split('=')[1];
  const outArg = argv.find((a) => a.startsWith('--out='))?.split('=')[1];

  const report = await generateRosterCandidates(schoolYearArg ?? DEFAULT_SCHOOL_YEAR);
  const json = JSON.stringify(report, null, 2);

  if (outArg) {
    const { writeFileSync } = await import('node:fs');
    writeFileSync(outArg, json, { mode: 0o600 });
    console.log(JSON.stringify({ event: 'ROSTER_CANDIDATES_WRITTEN', out: outArg, ...report.counts }));
  } else {
    console.log(json);
  }
}

if (require.main === module) {
  void main(process.argv.slice(2))
    .then(() => prisma.$disconnect())
    .catch(async (error) => {
      console.error(JSON.stringify({ event: 'ROSTER_CANDIDATES_FAILED', message: String(error) }));
      await prisma.$disconnect();
      process.exitCode = 1;
    });
}
