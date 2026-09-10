/**
 * AcademicYear is the canonical school-year identity (ADR item 1b). The
 * "2026-2027" label is always derived from `startYear`, never entered or
 * stored as free text — see formatAcademicYearLabel below.
 */
import type { AcademicYear, PrismaClient } from '@/core-v2/generated/client';

export interface CreateAcademicYearInput {
  readonly startYear: number;
}

export async function createAcademicYear(
  client: Pick<PrismaClient, 'academicYear'>,
  input: CreateAcademicYearInput,
): Promise<AcademicYear> {
  const startsAt = new Date(Date.UTC(input.startYear, 8, 1)); // 1 Sept
  const endsAt = new Date(Date.UTC(input.startYear + 1, 7, 31, 23, 59, 59)); // 31 Aug
  return client.academicYear.create({
    data: { startYear: input.startYear, startsAt, endsAt },
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
