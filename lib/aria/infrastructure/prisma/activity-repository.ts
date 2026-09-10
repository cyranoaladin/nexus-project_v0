import { Prisma, type PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { AriaError } from '../../kernel/errors';
import type { ActivityType } from '../../domain/practice/activity-content';
import type {
  ActivityAttemptRecord,
  ActivityRecord,
  ActivityRepository,
  ActivityResponseRecord,
  ActivityVersionRecord,
  CreateActivityInput,
} from '../../application/practice/ports';

const activityVersionSelect = {
  id: true,
  activityId: true,
  versionLabel: true,
  prompt: true,
  expectedAnswerShape: true,
  correctionRubric: true,
  status: true,
} satisfies Prisma.ActivityVersionSelect;

const activitySelect = {
  id: true,
  courseKey: true,
  skillId: true,
  curriculumVersion: true,
  activityType: true,
  versions: {
    where: { status: 'ACTIVE' as const },
    select: activityVersionSelect,
    orderBy: { publishedAt: 'desc' as const },
    take: 1,
  },
} satisfies Prisma.ActivitySelect;

type SelectedActivityRow = Prisma.ActivityGetPayload<{ select: typeof activitySelect }>;
type SelectedVersionRow = Prisma.ActivityVersionGetPayload<{ select: typeof activityVersionSelect }>;

const attemptSelect = {
  id: true,
  studentId: true,
  activityId: true,
  activityVersionId: true,
  courseKey: true,
  status: true,
  startedAt: true,
  submittedAt: true,
} satisfies Prisma.ActivityAttemptSelect;

type SelectedAttemptRow = Prisma.ActivityAttemptGetPayload<{ select: typeof attemptSelect }>;

function toVersionRecord(row: SelectedVersionRow): ActivityVersionRecord {
  return Object.freeze({
    id: row.id,
    activityId: row.activityId,
    versionLabel: row.versionLabel,
    prompt: row.prompt,
    expectedAnswerShape: row.expectedAnswerShape,
    correctionRubric: row.correctionRubric,
    status: row.status,
  });
}

function toActivityRecord(row: SelectedActivityRow): ActivityRecord {
  return Object.freeze({
    id: row.id,
    courseKey: row.courseKey,
    skillId: row.skillId,
    curriculumVersion: row.curriculumVersion,
    activityType: row.activityType as ActivityType,
    activeVersion: row.versions[0] ? toVersionRecord(row.versions[0]) : null,
  });
}

function toAttemptRecord(row: SelectedAttemptRow): ActivityAttemptRecord {
  return Object.freeze({
    id: row.id,
    studentId: row.studentId,
    activityId: row.activityId,
    activityVersionId: row.activityVersionId,
    courseKey: row.courseKey,
    status: row.status,
    startedAt: row.startedAt,
    submittedAt: row.submittedAt,
  });
}

class PrismaActivityRepository implements ActivityRepository {
  constructor(private readonly client: PrismaClient) {}

  async resolveStudentIdByUserId(userId: string): Promise<string | null> {
    const student = await this.client.student.findUnique({
      where: { userId },
      select: { id: true },
    });
    return student?.id ?? null;
  }

  async createActivityWithVersion(input: CreateActivityInput): Promise<ActivityRecord> {
    const row = await this.client.activity.create({
      data: {
        courseKey: input.courseKey,
        skillId: input.skillId,
        curriculumVersion: input.curriculumVersion,
        activityType: input.activityType,
        versions: {
          create: {
            versionLabel: input.versionLabel,
            prompt: input.prompt as Prisma.InputJsonValue,
            expectedAnswerShape: input.expectedAnswerShape as Prisma.InputJsonValue,
            correctionRubric: input.correctionRubric as Prisma.InputJsonValue,
          },
        },
      },
      select: activitySelect,
    });
    return toActivityRecord(row);
  }

  async listActivitiesForCourse(courseKey: string): Promise<readonly ActivityRecord[]> {
    const rows = await this.client.activity.findMany({
      where: { courseKey },
      select: activitySelect,
      orderBy: { createdAt: 'asc' },
    });
    return Object.freeze(rows.map(toActivityRecord));
  }

  async getActivityById(activityId: string): Promise<ActivityRecord | null> {
    const row = await this.client.activity.findUnique({
      where: { id: activityId },
      select: activitySelect,
    });
    return row ? toActivityRecord(row) : null;
  }

  async startOrResumeAttempt(input: {
    readonly studentId: string;
    readonly activityId: string;
    readonly activityVersionId: string;
    readonly courseKey: string;
  }): Promise<ActivityAttemptRecord> {
    const row = await this.client.$transaction(async (tx) => {
      // Advisory transaction lock, same pattern as conversation turn
      // reservation (`conversation-repository.ts`): serializes concurrent
      // "start" calls for this exact (student, version) pair so the
      // find-then-create below can never race. The DB's own partial unique
      // index (`aria_activity_attempts_open_student_version_key`) remains a
      // second, independent guarantee even if this lock were ever bypassed.
      const lockScope = `activity-attempt:${input.studentId}:${input.activityVersionId}`;
      await tx.$executeRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${lockScope}, 0))`,
      );

      const existing = await tx.activityAttempt.findFirst({
        where: {
          studentId: input.studentId,
          activityVersionId: input.activityVersionId,
          status: 'IN_PROGRESS',
        },
        select: attemptSelect,
      });
      if (existing) return existing;

      return tx.activityAttempt.create({
        data: {
          studentId: input.studentId,
          activityId: input.activityId,
          activityVersionId: input.activityVersionId,
          courseKey: input.courseKey,
        },
        select: attemptSelect,
      });
    });
    return toAttemptRecord(row);
  }

  async getAttemptById(attemptId: string): Promise<ActivityAttemptRecord | null> {
    const row = await this.client.activityAttempt.findUnique({
      where: { id: attemptId },
      select: attemptSelect,
    });
    return row ? toAttemptRecord(row) : null;
  }

  async submitAttempt(input: {
    readonly attemptId: string;
    readonly payload: unknown;
  }): Promise<{ readonly attempt: ActivityAttemptRecord; readonly response: ActivityResponseRecord }> {
    return this.client.$transaction(async (tx) => {
      const attempt = await tx.activityAttempt.findUnique({
        where: { id: input.attemptId },
        select: attemptSelect,
      });
      if (!attempt) {
        throw new AriaError('BAD_REQUEST', 404, 'Tentative introuvable.');
      }
      if (attempt.status !== 'IN_PROGRESS') {
        throw new AriaError(
          'IDEMPOTENCY_CONFLICT',
          409,
          'Cette tentative a déjà été soumise.',
        );
      }
      const now = new Date();
      const response = await tx.activityResponse.create({
        data: {
          attemptId: input.attemptId,
          payload: input.payload as Prisma.InputJsonValue,
          submittedAt: now,
        },
        select: { id: true, attemptId: true, payload: true, submittedAt: true },
      });
      const updatedAttempt = await tx.activityAttempt.update({
        where: { id: input.attemptId },
        data: { status: 'SUBMITTED', submittedAt: now },
        select: attemptSelect,
      });
      return {
        attempt: toAttemptRecord(updatedAttempt),
        response: Object.freeze(response),
      };
    });
  }
}

export function makePrismaActivityRepository(client: PrismaClient): ActivityRepository {
  return new PrismaActivityRepository(client);
}

export const prismaActivityRepository = makePrismaActivityRepository(prisma);
