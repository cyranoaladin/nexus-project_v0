import { prisma } from '@/lib/prisma';
import {
  authorizeAriaResourceForActor,
  listAriaResourcesForActor,
} from '@/lib/aria/application/resources/public';

jest.mock('@/lib/prisma', () => ({
  prisma: { student: { findUnique: jest.fn() } },
}));

const now = new Date('2026-08-30T12:00:00.000Z');

function studentFixture(entitled = true) {
  return {
    id: 'student-1',
    userId: 'student-user-1',
    gradeLevel: 'TERMINALE',
    academicTrack: 'EDS_GENERALE',
    stmgPathway: null,
    academicEnrollments: [
      { courseKey: 'eds-maths-terminale', kind: 'SPECIALTY', source: 'ADMIN' },
    ],
    user: {
      entitlements: entitled ? [{
        id: 'entitlement-1',
        productCode: 'ARIA_ACCESS',
        status: 'ACTIVE',
        startsAt: new Date('2026-08-01T00:00:00.000Z'),
        endsAt: null,
        ariaScopes: [{ kind: 'COURSE', courseKey: 'eds-maths-terminale' }],
      }] : [],
    },
    ariaConversations: [],
    ariaProfile: null,
  };
}

describe('ARIA resource application authorization', () => {
  const findStudent = prisma.student.findUnique as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    findStudent.mockResolvedValue(studentFixture());
  });

  it('lists resources only through academic and commercial authorization', async () => {
    const result = await listAriaResourcesForActor({
      actor: { userId: 'student-user-1', role: 'ELEVE' },
      courseKey: 'eds-maths-terminale',
      now,
    });

    expect(result.resources.length).toBeGreaterThan(0);
    expect(result.resources.every((resource) => resource.courseKey === 'eds-maths-terminale')).toBe(true);
  });

  it('fails closed when no active canonical scope covers the course', async () => {
    findStudent.mockResolvedValueOnce(studentFixture(false));
    await expect(listAriaResourcesForActor({
      actor: { userId: 'student-user-1', role: 'ELEVE' },
      courseKey: 'eds-maths-terminale',
      now,
    })).rejects.toMatchObject({ code: 'NOT_ENTITLED' });
  });

  it('authorizes a resource by its canonical course and rejects an unknown resource', async () => {
    await expect(authorizeAriaResourceForActor({
      actor: { userId: 'student-user-1', role: 'ELEVE' },
      resourceId: 'res-maths-tle-prog-bo',
      now,
    })).resolves.toMatchObject({
      resource: { id: 'res-maths-tle-prog-bo', courseKey: 'eds-maths-terminale' },
    });

    await expect(authorizeAriaResourceForActor({
      actor: { userId: 'student-user-1', role: 'ELEVE' },
      resourceId: 'missing-resource',
      now,
    })).rejects.toMatchObject({ code: 'RESOURCE_MISMATCH' });
  });
});
