import { Prisma } from '@prisma/client';

const constraint = 'stage_sessions_coach_no_overlap';
/** Classify only the named database scheduling constraint; never echo database text. */
export function isStageSessionScheduleConflict(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2004') {
    const detail = error.meta?.database_error;
    return typeof detail === 'string' && detail.includes(constraint);
  }
  return error instanceof Prisma.PrismaClientUnknownRequestError && error.message.includes(constraint);
}
