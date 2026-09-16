/**
 * AcademicYear is the canonical school-year identity (ADR item 1b). The
 * "2026-2027" label is always derived from `startYear`, never entered or
 * stored as free text — see formatAcademicYearLabel below.
 *
 * `startsAt`/`endsAt` are configured by the business per year — this
 * repository stores what it is given and never derives dates from a
 * hardcoded calendar. Validation (dates consistent with startYear,
 * endsAt > startsAt) lives in the service layer; the SQL CHECK in migration
 * 0002 remains the race-safe backstop for endsAt > startsAt.
 */
import type { AcademicYear, PrismaClient } from '@/core-v2/generated/client';

export interface CreateAcademicYearInput {
  readonly startYear: number;
  readonly startsAt: Date;
  readonly endsAt: Date;
}

export async function createAcademicYear(
  client: Pick<PrismaClient, 'academicYear'>,
  input: CreateAcademicYearInput,
): Promise<AcademicYear> {
  return client.academicYear.create({
    data: { startYear: input.startYear, startsAt: input.startsAt, endsAt: input.endsAt },
  });
}

export async function getAcademicYearByStartYear(
  client: Pick<PrismaClient, 'academicYear'>,
  startYear: number,
): Promise<AcademicYear | null> {
  return client.academicYear.findUnique({ where: { startYear } });
}

/** Derives the display label ("2026-2027") — never stored, always computed. */
export function formatAcademicYearLabel(academicYear: Pick<AcademicYear, 'startYear'>): string {
  return `${academicYear.startYear}-${academicYear.startYear + 1}`;
}
