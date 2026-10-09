import { Prisma } from '@prisma/client';
import { isStageSessionScheduleConflict } from '@/lib/stages/schedule-conflict';
const constraint = 'stage_sessions_coach_no_overlap';
test('recognizes only the named PostgreSQL constraint on a known Prisma constraint failure', () => {
  expect(isStageSessionScheduleConflict(new Prisma.PrismaClientKnownRequestError('Synthetic constraint', { code: 'P2004', clientVersion: 'synthetic', meta: { database_error: constraint } }))).toBe(true);
  expect(isStageSessionScheduleConflict(new Prisma.PrismaClientKnownRequestError('Synthetic different constraint', { code: 'P2004', clientVersion: 'synthetic', meta: { database_error: 'unrelated_constraint' } }))).toBe(false);
});
test('supports the Prisma PostgreSQL unknown-request wrapper without treating arbitrary errors as conflicts', () => {
  expect(isStageSessionScheduleConflict(new Prisma.PrismaClientUnknownRequestError(constraint, { clientVersion: 'synthetic' }))).toBe(true);
  expect(isStageSessionScheduleConflict(new Error(constraint))).toBe(false);
  expect(isStageSessionScheduleConflict(null)).toBe(false);
});
test('does not reinterpret other known Prisma codes as scheduling failures', () => {
  expect(isStageSessionScheduleConflict(new Prisma.PrismaClientKnownRequestError('Synthetic missing row', { code: 'P2025', clientVersion: 'synthetic', meta: { database_error: constraint } }))).toBe(false);
});
