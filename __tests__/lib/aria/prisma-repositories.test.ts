import { resolveStudentCourses } from '@/lib/curriculum/enrollment';
import { makePrismaAriaFeedbackRepository } from '@/lib/aria/infrastructure/prisma/feedback-repository';
import { makePrismaAriaProfileRepository } from '@/lib/aria/infrastructure/prisma/profile-repository';

jest.mock('@/lib/curriculum/enrollment', () => ({ resolveStudentCourses: jest.fn() }));

describe('ARIA Prisma port adapters', () => {
  it('fails feedback ownership closed before the canonical upsert', async () => {
    const client = {
      ariaMessage: { findFirst: jest.fn().mockResolvedValue(null) },
      ariaFeedback: { upsert: jest.fn() },
    };
    const repository = makePrismaAriaFeedbackRepository(client as never);

    await expect(repository.upsertOwnedFeedback({
      actorUserId: 'user-1',
      messageId: 'message-1',
      useful: false,
      reason: null,
    })).rejects.toMatchObject({ code: 'NOT_ENTITLED' });
    expect(client.ariaFeedback.upsert).not.toHaveBeenCalled();
  });

  it('performs one ownership-scoped feedback upsert with the persisted student identity', async () => {
    const record = {
      id: 'feedback-1', studentId: 'student-1', messageId: 'message-1',
      useful: true, reason: 'Clair', updatedAt: new Date('2026-08-31T02:00:00Z'),
    };
    const client = {
      ariaMessage: { findFirst: jest.fn().mockResolvedValue({
        id: 'message-1', conversation: { studentId: 'student-1' },
      }) },
      ariaFeedback: { upsert: jest.fn().mockResolvedValue(record) },
    };
    const repository = makePrismaAriaFeedbackRepository(client as never);

    await expect(repository.upsertOwnedFeedback({
      actorUserId: 'user-1', messageId: 'message-1', useful: true, reason: 'Clair',
    })).resolves.toBe(record);
    expect(client.ariaFeedback.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { messageId_studentId: { messageId: 'message-1', studentId: 'student-1' } },
      create: expect.objectContaining({ messageId: 'message-1', studentId: 'student-1' }),
      update: { useful: true, reason: 'Clair' },
    }));
  });

  it('returns null for an actor without a Student row', async () => {
    const client = { student: { findUnique: jest.fn().mockResolvedValue(null) } };
    const repository = makePrismaAriaProfileRepository(client as never);

    await expect(repository.loadByActorUserId('missing-user')).resolves.toBeNull();
  });

  it('projects only academically followed courses and the stored profile', async () => {
    const profile = { studentId: 'student-1', preferencesVersion: 1 };
    const client = { student: { findUnique: jest.fn().mockResolvedValue({
      id: 'student-1',
      gradeLevel: 'TERMINALE',
      academicTrack: 'GENERALE',
      stmgPathway: null,
      academicEnrollments: [],
      ariaProfile: profile,
    }) } };
    (resolveStudentCourses as jest.Mock).mockReturnValue([
      { academicStatus: 'FOLLOWED', course: { courseKey: 'eds-nsi-terminale' } },
      { academicStatus: 'NOT_ENROLLED', course: { courseKey: 'eds-maths-terminale' } },
    ]);
    const repository = makePrismaAriaProfileRepository(client as never);

    await expect(repository.loadByActorUserId('user-1')).resolves.toEqual({
      studentId: 'student-1',
      academicCourseKeys: ['eds-nsi-terminale'],
      profile,
    });
  });

  it('creates neutral defaults and replaces every explicit preference through atomic upserts', async () => {
    const stored = { studentId: 'student-1', preferencesVersion: 1 };
    const upsert = jest.fn().mockResolvedValue(stored);
    const repository = makePrismaAriaProfileRepository({
      ariaLearningProfile: { upsert },
    } as never);

    await expect(repository.createDefault('student-1')).resolves.toBe(stored);
    expect(upsert).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: { studentId: 'student-1' },
      create: expect.objectContaining({
        studentId: 'student-1', pinnedCourseKeys: [], focusedCourseKey: null,
        courseOrder: [], showCitations: true,
      }),
      update: {},
    }));

    await expect(repository.replacePreferences('student-1', {
      version: 1,
      pinnedCourseKeys: ['eds-nsi-terminale'],
      focusedCourseKey: 'eds-nsi-terminale',
      courseOrder: ['eds-nsi-terminale'],
      showCitations: false,
    })).resolves.toBe(stored);
    expect(upsert).toHaveBeenNthCalledWith(2, expect.objectContaining({
      create: {
        studentId: 'student-1', preferencesVersion: 1,
        pinnedCourseKeys: ['eds-nsi-terminale'], focusedCourseKey: 'eds-nsi-terminale',
        courseOrder: ['eds-nsi-terminale'], showCitations: false,
      },
      update: {
        preferencesVersion: 1,
        pinnedCourseKeys: ['eds-nsi-terminale'], focusedCourseKey: 'eds-nsi-terminale',
        courseOrder: ['eds-nsi-terminale'], showCitations: false,
      },
    }));
  });
});
