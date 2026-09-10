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
  readonly status: 'IN_PROGRESS' | 'SUBMITTED' | 'CORRECTED';
  readonly startedAt: Date;
  readonly submittedAt: Date | null;
}

export interface ActivityResponseRecord {
  readonly id: string;
  readonly attemptId: string;
  readonly payload: unknown;
  readonly submittedAt: Date;
}

export interface ActivityResultRecord {
  readonly id: string;
  readonly attemptId: string;
  readonly outcome: 'CORRECT' | 'PARTIALLY_CORRECT' | 'INCORRECT';
  readonly feedback: unknown;
  readonly correctedAt: Date;
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
   * The EXACT version an attempt/response was created against — never the
   * activity's current active version, which may differ if a new version
   * was published between the attempt being started and being corrected.
   * Correction must grade against what the student actually saw.
   */
  getVersionById(activityVersionId: string): Promise<ActivityVersionRecord | null>;

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

  getResponseByAttemptId(attemptId: string): Promise<ActivityResponseRecord | null>;

  /**
   * Phase 1 of correction (see `correct-attempt.ts`): a short, lock-guarded
   * check, deliberately BEFORE any model call — never holds the advisory
   * lock across the slow network round trip. Fails (throws) if the attempt
   * is not SUBMITTED/CORRECTED (e.g. still IN_PROGRESS). Returns the
   * existing result when one is already there, so the caller never re-calls
   * the model for an attempt that's already been graded.
   */
  beginCorrection(attemptId: string): Promise<
    | { readonly alreadyCorrected: true; readonly result: ActivityResultRecord }
    | { readonly alreadyCorrected: false }
  >;

  /**
   * Phase 2: called only after a real model response was obtained. Re-checks
   * for an existing result under the SAME lock scope (double-checked
   * locking, guards the race between two concurrent corrections of the same
   * attempt) — if one now exists, discards the just-computed result and
   * returns the existing one rather than writing a duplicate; the
   * `attemptId` `@unique` constraint on `ActivityResult` is the final,
   * independent guarantee even if this lock were ever bypassed, mirroring
   * `startOrResumeAttempt`'s own dual-guarantee precedent.
   */
  commitCorrectionResult(input: {
    readonly attemptId: string;
    readonly outcome: 'CORRECT' | 'PARTIALLY_CORRECT' | 'INCORRECT';
    readonly feedback: unknown;
  }): Promise<{ readonly result: ActivityResultRecord; readonly wasAlreadyCorrected: boolean }>;
}
