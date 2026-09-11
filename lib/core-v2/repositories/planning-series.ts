/**
 * assignmentId is the sole identity authority (ADR item 5) — student/coach/
 * courseKey are never stored redundantly here, only derivable via
 * assignment.academicYearEnrollment.student / assignment.coach /
 * assignment.courseKey.
 */
import type {
  PlanningSeries,
  PrismaClient,
  SessionModality,
} from '@/core-v2/generated/client';

export interface CreatePlanningSeriesInput {
  readonly assignmentId: string;
  readonly startDate: Date;
  readonly localStartTime: string;
  readonly localEndTime: string;
  readonly recurrenceRule: string;
  readonly modality: SessionModality;
  readonly createdById: string;
  /** IANA zone, resolved from organization configuration by the service layer — never defaulted here. */
  readonly timezone: string;
  readonly location?: string;
}

export async function createPlanningSeries(
  client: Pick<PrismaClient, 'planningSeries'>,
  input: CreatePlanningSeriesInput,
): Promise<PlanningSeries> {
  return client.planningSeries.create({
    data: {
      assignmentId: input.assignmentId,
      startDate: input.startDate,
      localStartTime: input.localStartTime,
      localEndTime: input.localEndTime,
      recurrenceRule: input.recurrenceRule,
      modality: input.modality,
      createdById: input.createdById,
      timezone: input.timezone,
      location: input.location,
    },
  });
}
