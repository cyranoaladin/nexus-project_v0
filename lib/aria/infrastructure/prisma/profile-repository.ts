import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { resolveStudentCourses } from '@/lib/curriculum/enrollment';
import type {
  AriaLearningPreferencesV1,
} from '../../domain/profile/preferences';
import type {
  AriaProfileRepository,
  AriaStoredProfile,
} from '../../application/profile/public';

const profileSelect = {
  studentId: true,
  preferencesVersion: true,
  pinnedCourseKeys: true,
  focusedCourseKey: true,
  courseOrder: true,
  showCitations: true,
  updatedAt: true,
} satisfies Prisma.AriaLearningProfileSelect;

class PrismaAriaProfileRepository implements AriaProfileRepository {
  constructor(private readonly client: PrismaClient) {}

  async loadByActorUserId(actorUserId: string) {
    const student = await this.client.student.findUnique({
      where: { userId: actorUserId },
      select: {
        id: true,
        gradeLevel: true,
        academicTrack: true,
        stmgPathway: true,
        academicEnrollments: {
          select: { courseKey: true, kind: true, source: true },
        },
        ariaProfile: { select: profileSelect },
      },
    });
    if (!student) return null;
    const academicCourseKeys = resolveStudentCourses(
      {
        gradeLevel: student.gradeLevel,
        academicTrack: student.academicTrack,
        stmgPathway: student.stmgPathway,
      },
      student.academicEnrollments,
    ).filter(({ academicStatus }) => academicStatus !== 'NOT_ENROLLED')
      .map(({ course }) => course.courseKey);
    return {
      studentId: student.id,
      academicCourseKeys,
      profile: student.ariaProfile as AriaStoredProfile | null,
    };
  }

  async createDefault(studentId: string): Promise<AriaStoredProfile> {
    return this.client.ariaLearningProfile.upsert({
      where: { studentId },
      create: {
        studentId,
        preferencesVersion: 1,
        pinnedCourseKeys: [],
        focusedCourseKey: null,
        courseOrder: [],
        showCitations: true,
      },
      update: {},
      select: profileSelect,
    }) as Promise<AriaStoredProfile>;
  }

  async replacePreferences(
    studentId: string,
    preferences: AriaLearningPreferencesV1,
  ): Promise<AriaStoredProfile> {
    const values = {
      preferencesVersion: 1,
      pinnedCourseKeys: [...preferences.pinnedCourseKeys],
      focusedCourseKey: preferences.focusedCourseKey,
      courseOrder: [...preferences.courseOrder],
      showCitations: preferences.showCitations,
    };
    return this.client.ariaLearningProfile.upsert({
      where: { studentId },
      create: { studentId, ...values },
      update: values,
      select: profileSelect,
    }) as Promise<AriaStoredProfile>;
  }
}

export function makePrismaAriaProfileRepository(
  client: PrismaClient,
): AriaProfileRepository {
  return new PrismaAriaProfileRepository(client);
}

export const prismaAriaProfileRepository = makePrismaAriaProfileRepository(prisma);
