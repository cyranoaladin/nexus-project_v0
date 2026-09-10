/**
 * No legacy User.id identity fields (studentId/coachId/parentId) — identity
 * is derived exclusively through assignmentId (ADR item 5). Notification
 * targeting is resolved at read/notify time via
 * assignment.academicYearEnrollment.student.household.parents, never stored
 * redundantly on the booking row.
 */
import type {
  PrismaClient,
  SessionBooking,
  SessionModality,
} from '@/core-v2/generated/client';

export interface CreateSessionBookingInput {
  readonly assignmentId: string;
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
