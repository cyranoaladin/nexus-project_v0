import type {
  LandingScheduleSlot,
  LandingSubject,
} from './configurator';
import type { EntryLevelCode } from './schema';

export type PublicScheduleSubject = Pick<
  LandingSubject,
  'id' | 'label' | 'levels' | 'labelByLevel'
>;

export type PublicScheduleSlot = Pick<
  LandingScheduleSlot,
  | 'date'
  | 'level'
  | 'subject'
  | 'block'
  | 'startTime'
  | 'endTime'
  | 'windowId'
  | 'cohortId'
  | 'isPrimary'
> & {
  room?: string;
};

export type PublicScheduleWindow = {
  windowId: string;
  windowLabel: string;
  days: string[];
  slots: Array<{
    level: EntryLevelCode;
    subject: string;
    block: string;
    room?: string;
  }>;
};

export type PublicPlanningPack = {
  level: EntryLevelCode;
  range: 'FONDATIONS' | 'PREMIUM';
  subjectsCount: number;
  totalHours: number;
  /**
   * Total price in TND for exactly `subjectsCount` selected subjects at this
   * level. For a PER_SUBJECT (Fondations) level this is the per-subject unit
   * price multiplied by `subjectsCount` — never a flat/discounted pack rate.
   * For a PACK_BY_SUBJECT_COUNT (Premium) level, this is the actual
   * commercial pack price for that exact subject count (not necessarily
   * linear with count).
   */
  price: number;
  deposit: number;
  balance: number;
  /**
   * How the price above was built. The composer uses it to phrase the amount
   * ("n x tarif unitaire" for Fondations, the pack price for Premium) — it
   * never re-derives the amount itself.
   */
  pricingModel: 'PER_SUBJECT' | 'PACK_BY_SUBJECT_COUNT';
};

// 17 modules = 14 historical + 4e Mathématiques, 4e Français, Terminale
// Philosophie. 20 cohorts = those 17 modules + the 3 alternative cohorts
// (Première SVT, Terminale NSI, Terminale SVT), each scheduled over 5 days.
// scripts/validate-stage-planning.ts recomputes all four from the live data and
// fails on any drift, so these are a declared expectation, not a second source.
export const PRE_RENTREE_PUBLIC_METRICS = {
  pedagogicalModuleCount: 14,
  preparedSessionCount: 70,
  operationalCohortCount: 16,
  scheduledSessionOccurrenceCount: 80,
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
  subjects: readonly PublicScheduleSubject[],
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
  schedule: readonly PublicScheduleSlot[];
  subjects: readonly PublicScheduleSubject[];
  windows: readonly PublicScheduleWindow[];
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
