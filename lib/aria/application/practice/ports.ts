import type { ActivityType } from '../../domain/practice/activity-content';

export interface ActivityVersionRecord {
  readonly id: string;
  readonly activityId: string;
  readonly versionLabel: string;
  readonly prompt: unknown;
  readonly expectedAnswerShape: unknown;
  readonly correctionRubric: unknown;
  readonly status: 'ACTIVE' | 'RETIRED';
}

export interface ActivityRecord {
  readonly id: string;
  readonly courseKey: string;
  readonly skillId: string | null;
  readonly curriculumVersion: string;
  readonly activityType: ActivityType;
  readonly activeVersion: ActivityVersionRecord | null;
}

export interface ActivityAttemptRecord {
  readonly id: string;
  readonly studentId: string;
  readonly activityId: string;
  readonly activityVersionId: string;
  readonly courseKey: string;
  readonly status: 'IN_PROGRESS' | 'SUBMITTED';
  readonly startedAt: Date;
  readonly submittedAt: Date | null;
}

export interface ActivityResponseRecord {
  readonly id: string;
  readonly attemptId: string;
  readonly payload: unknown;
  readonly submittedAt: Date;
}

export interface CreateActivityInput {
  readonly courseKey: string;
  readonly skillId: string | null;
  readonly curriculumVersion: string;
  readonly activityType: ActivityType;
  readonly versionLabel: string;
  readonly prompt: unknown;
  readonly expectedAnswerShape: unknown;
  readonly correctionRubric: unknown;
}

/**
 * Persistence port for ARIA Practice — implemented by
 * `infrastructure/prisma/activity-repository.ts`, matching the established
 * pattern in `application/evidence/ports.ts` /
 * `infrastructure/prisma/learning-evidence-repository.ts`.
 */
export interface ActivityRepository {
  /** Real internal `Student.id` for a given `User.id`, or null if none. */
  resolveStudentIdByUserId(userId: string): Promise<string | null>;

  /** Internal authoring only — never reachable from a client route (see author.ts). */
  createActivityWithVersion(input: CreateActivityInput): Promise<ActivityRecord>;

  /** ACTIVE activities for a course, each with its current ACTIVE version (or null if none published). */
  listActivitiesForCourse(courseKey: string): Promise<readonly ActivityRecord[]>;

  getActivityById(activityId: string): Promise<ActivityRecord | null>;

  /**
   * Returns the existing IN_PROGRESS attempt for (studentId, activityVersionId)
   * if one exists, otherwise creates and returns a new one — atomic via the
   * DB's own partial unique index (`aria_activity_attempts_open_student_version_key`),
   * never a check-then-insert race in application code.
   */
  startOrResumeAttempt(input: {
    readonly studentId: string;
    readonly activityId: string;
    readonly activityVersionId: string;
    readonly courseKey: string;
  }): Promise<ActivityAttemptRecord>;

  getAttemptById(attemptId: string): Promise<ActivityAttemptRecord | null>;

  /** Fails (throws from the repository implementation) if the attempt is not IN_PROGRESS. */
  submitAttempt(input: {
    readonly attemptId: string;
    readonly payload: unknown;
  }): Promise<{ readonly attempt: ActivityAttemptRecord; readonly response: ActivityResponseRecord }>;
}
