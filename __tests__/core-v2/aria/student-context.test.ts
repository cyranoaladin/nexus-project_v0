import {
  CoreV2AriaStudentNotFoundError,
  loadCoreV2AriaStudentContext,
} from '@/lib/core-v2/aria/student-context';
import { failFromError } from '@/lib/core-v2/http/respond';
import type { ServiceContext } from '@/lib/core-v2/services/context';

const ctx: ServiceContext = {
  actor: { userId: 'user-core-v2-aria', role: 'ELEVE' },
  correlationId: 'corr-core-v2-aria',
  now: () => new Date('2026-09-23T08:00:00.000Z'),
};

describe('Core v2 ARIA student context minimization', () => {
  it('loads only the identity and current-schooling fields ARIA consumes', async () => {
    const findUnique = jest.fn().mockResolvedValue({
      id: 'student-core-v2-aria',
      user: { id: 'user-core-v2-aria', firstName: 'Léa', lastName: 'Martin' },
      academicYearEnrollments: [{
        status: 'ACTIVE',
        gradeLevel: 'TERMINALE',
        academicTrack: 'EDS_GENERALE',
        stmgPathway: null,
        schoolingStatus: 'SCOLARISE',
        school: 'Lycée test',
        academicYear: { status: 'CURRENT' },
        courseEnrollments: [{ courseKey: 'eds-maths-terminale', kind: 'SPECIALTY' }],
      }],
    });

    const result = await loadCoreV2AriaStudentContext({ student: { findUnique } } as never, ctx);

    expect(findUnique).toHaveBeenCalledWith({
      where: { userId: 'user-core-v2-aria' },
      select: {
        id: true,
        user: { select: { id: true, firstName: true, lastName: true } },
        academicYearEnrollments: {
          where: { status: 'ACTIVE', academicYear: { status: 'CURRENT' } },
          take: 2,
          select: {
            status: true,
            gradeLevel: true,
            academicTrack: true,
            stmgPathway: true,
            schoolingStatus: true,
            school: true,
            academicYear: { select: { status: true } },
            courseEnrollments: { select: { courseKey: true, kind: true } },
          },
        },
      },
    });
    expect(result).toEqual({
      studentId: 'student-core-v2-aria',
      userId: 'user-core-v2-aria',
      firstName: 'Léa',
      lastName: 'Martin',
      gradeLevel: 'TERMINALE',
      academicTrack: 'EDS_GENERALE',
      stmgPathway: null,
      schoolingStatus: 'SCOLARISE',
      school: 'Lycée test',
      specialties: ['MATHEMATIQUES'],
      academicEnrollments: [{ courseKey: 'eds-maths-terminale', kind: 'SPECIALTY' }],
    });
    expect(JSON.stringify(findUnique.mock.calls[0])).not.toMatch(
      /email|phone|birthDate|household|parents|accountStatus|activatedAt|createdAt|updatedAt/,
    );
  });

  it('serializes a generic 404 without exposing the actor user id or details', async () => {
    const findUnique = jest.fn().mockResolvedValue(null);

    let caught: unknown;
    try {
      await loadCoreV2AriaStudentContext({ student: { findUnique } } as never, ctx);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(CoreV2AriaStudentNotFoundError);
    const response = failFromError(caught, ctx.correlationId);
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: {
        code: 'NOT_FOUND',
        message: 'No active Core v2 student enrollment was found.',
      },
      correlationId: 'corr-core-v2-aria',
    });
  });
});
