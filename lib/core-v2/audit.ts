/**
 * Append-only business audit (go-live mission §Z). Written INSIDE the same
 * transaction as the mutation it describes, so a rolled-back mutation
 * leaves no audit row and a committed one always has exactly its rows.
 * Immutability is enforced at the DB level (trigger audit_events_immutable,
 * migration 0006) — there is deliberately no update/delete function here.
 */
import type { Prisma } from '@/core-v2/generated/client';

export const AUDIT_ACTIONS = [
  'academic_year.created',
  'academic_year.status_changed',
  'household.created',
  'household.parent_attached',
  'household.primary_contact_changed',
  'parent.created',
  'parent.contact_corrected',
  'student.created',
  'student.identity_corrected',
  'enrollment.created',
  'enrollment.approved',
  'enrollment.withdrawn',
  'enrollment.academic_map_changed',
  'enrollment.courses_changed',
  'coach.capability_granted',
  'coach.capability_revoked',
  'coach.assigned',
  'coach.assignment_ended',
  'planning.series_created',
  'planning.series_changed',
  'planning.series_cancelled',
  'planning.occurrences_materialized',
  'planning.occurrence_cancelled',
  'planning.occurrence_rescheduled',
  'account.invited',
  'account.invitation_resent',
  'account.activated',
  'account.password_changed',
  'account.password_reset_requested',
  'account.password_reset',
  'account.suspended',
  'account.reactivated',
  'account.disabled',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export type AuditSubjectType =
  | 'AcademicYear'
  | 'Household'
  | 'User'
  | 'Student'
  | 'StudentAcademicYearEnrollment'
  | 'CoachProfile'
  | 'CoachStudentCourseAssignment'
  | 'PlanningSeries'
  | 'SessionBooking'
  | 'Invitation';

export interface AuditEventInput {
  readonly actorUserId: string | null;
  readonly action: AuditAction;
  readonly subjectType: AuditSubjectType;
  readonly subjectId: string;
  readonly correlationId: string;
  /** Minimal structured context (ids, before/after status). Never secrets, tokens, hashes, or free-text PII. */
  readonly metadata?: Prisma.InputJsonValue;
}

type AuditWriter = Pick<Prisma.TransactionClient, 'auditEvent'>;

export async function appendAuditEvent(tx: AuditWriter, input: AuditEventInput): Promise<void> {
  await tx.auditEvent.create({
    data: {
      actorUserId: input.actorUserId,
      action: input.action,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      correlationId: input.correlationId,
      metadata: input.metadata,
    },
  });
}
