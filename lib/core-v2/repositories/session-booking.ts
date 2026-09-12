/**
 * No legacy User.id identity fields (studentId/coachId/parentId as USER ids)
 * — identity is derived through assignmentId (ADR item 5). The coachId /
 * studentId columns are PROFILE ids projected from that assignment so the
 * database exclusion constraints can range over them (migration 0007); a
 * trigger refuses any row whose projection disagrees with the assignment.
 * Notification targeting is resolved at read/notify time via
 * assignment.academicYearEnrollment.student.household.parents.
 */
import type {
  PrismaClient,
  SessionBooking,
  SessionModality,
} from '@/core-v2/generated/client';

export interface CreateSessionBookingInput {
  readonly assignmentId: string;
  readonly coachId: string;
  readonly studentId: string;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly planningSeriesId?: string;
  readonly occurrenceKey?: string;
  readonly modality?: SessionModality;
  readonly location?: string;
}

export async function createSessionBooking(
  client: Pick<PrismaClient, 'sessionBooking'>,
  input: CreateSessionBookingInput,
): Promise<SessionBooking> {
  return client.sessionBooking.create({ data: input });
}
