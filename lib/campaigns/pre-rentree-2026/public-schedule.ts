import type {
  LandingScheduleSlot,
  LandingScheduleWindow,
  LandingSubject,
} from './configurator';
import type { EntryLevelCode } from './schema';

export const PRE_RENTREE_PUBLIC_METRICS = {
  pedagogicalModuleCount: 14,
  pedagogicalSessionTemplateCount: 70,
  operationalCohortCount: 17,
  scheduledSessionOccurrenceCount: 85,
  studentSessionsPerSubject: 5,
  studentHoursPerSubject: 10,
} as const;

export type PublicSubjectScheduleRow = {
  subjectId: string;
  label: string;
  studentSessionCount: 5;
  studentHours: 10;
  cohorts: Array<{
    cohortId?: string;
    label: string;
    dates: string[];
    startTime: string;
    endTime: string;
    room?: string;
    isPrimary: boolean;
  }>;
};

function subjectLabel(
  subjects: readonly LandingSubject[],
  subjectId: string,
  level: EntryLevelCode,
): string {
  const subject = subjects.find((candidate) => candidate.id === subjectId);
  return subject?.labelByLevel?.[level] ?? subject?.label ?? subjectId;
}

/**
 * Build the parent-facing subject schedule. Alternative operational cohorts
 * remain choices for one pedagogical subject; they never add to the volume
 * followed by a pupil.
 */
export function buildPublicSubjectScheduleRows({
  schedule,
  subjects,
  windows,
  level,
  exposeRooms,
}: {
  schedule: readonly LandingScheduleSlot[];
  subjects: readonly LandingSubject[];
  windows: readonly LandingScheduleWindow[];
  level: EntryLevelCode;
  exposeRooms: boolean;
}): PublicSubjectScheduleRow[] {
  const levelSessions = schedule.filter((slot) => slot.level === level);
  const subjectIds = subjects
    .filter((subject) => subject.levels.includes(level))
    .map((subject) => subject.id)
    .filter((subjectId) => levelSessions.some((slot) => slot.subject === subjectId));

  return subjectIds.map((subjectId) => {
    const subjectSessions = levelSessions.filter((slot) => slot.subject === subjectId);
    const cohortIds = [...new Set(subjectSessions.map((slot) => slot.cohortId ?? 'primary'))];
    const cohorts = cohortIds.map((cohortKey) => {
      const cohortSessions = subjectSessions
        .filter((slot) => (slot.cohortId ?? 'primary') === cohortKey)
        .sort((left, right) => left.date.localeCompare(right.date));
      const first = cohortSessions[0];

      if (!first || cohortSessions.length !== PRE_RENTREE_PUBLIC_METRICS.studentSessionsPerSubject) {
        throw new Error(
          `Invalid public cohort volume for ${level}/${subjectId}/${cohortKey}: `
          + `${cohortSessions.length} sessions`,
        );
      }
      if (!windows.some((window) => window.windowId === first.windowId)) {
        throw new Error(`Unknown public schedule window: ${first.windowId}`);
      }

      return {
        ...(first.cohortId ? { cohortId: first.cohortId } : {}),
        label: `Créneau ${first.block}`,
        dates: [...new Set(cohortSessions.map((slot) => slot.date))],
        startTime: first.startTime,
        endTime: first.endTime,
        ...(exposeRooms ? { room: first.room } : {}),
        isPrimary: first.isPrimary ?? true,
      };
    }).sort((left, right) => (
      Number(right.isPrimary) - Number(left.isPrimary)
      || left.startTime.localeCompare(right.startTime)
    ));

    return {
      subjectId,
      label: subjectLabel(subjects, subjectId, level),
      studentSessionCount: PRE_RENTREE_PUBLIC_METRICS.studentSessionsPerSubject,
      studentHours: PRE_RENTREE_PUBLIC_METRICS.studentHoursPerSubject,
      cohorts,
    };
  });
}
