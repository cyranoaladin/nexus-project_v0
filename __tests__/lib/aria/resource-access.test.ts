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
    expect(result.resources[0]).toMatchObject({
      resourceId: '202269df-9b59-5c61-aa20-1f13a7558910',
      resourceVersionId: 'f69965ee-0e3a-51d9-ab4d-55f58a003beb',
    });
    expect(result.resources[0]).not.toHaveProperty('filename');
    expect(result.resources[0]).not.toHaveProperty('contentSha256');
  });

  it('U014 fails closed when no active canonical scope covers the course', async () => {
    findStudent.mockResolvedValueOnce(studentFixture(false));
    await expect(listAriaResourcesForActor({
      actor: { userId: 'student-user-1', role: 'ELEVE' },
      courseKey: 'eds-maths-terminale',
      now,
    })).rejects.toMatchObject({ code: 'NOT_ENTITLED' });
  });

  it('U013 authorizes a resource by its canonical course and rejects an unknown resource', async () => {
    await expect(authorizeAriaResourceForActor({
      actor: { userId: 'student-user-1', role: 'ELEVE' },
      resourceId: '202269df-9b59-5c61-aa20-1f13a7558910',
      resourceVersionId: 'f69965ee-0e3a-51d9-ab4d-55f58a003beb',
      now,
    })).resolves.toMatchObject({
      resource: {
        id: '202269df-9b59-5c61-aa20-1f13a7558910',
        resourceVersionId: 'f69965ee-0e3a-51d9-ab4d-55f58a003beb',
        courseKey: 'eds-maths-terminale',
      },
    });

    await expect(authorizeAriaResourceForActor({
      actor: { userId: 'student-user-1', role: 'ELEVE' },
      resourceId: 'missing-resource',
      resourceVersionId: '00000000-0000-4000-8000-000000000000',
      now,
    })).rejects.toMatchObject({ code: 'RESOURCE_MISMATCH' });

    await expect(authorizeAriaResourceForActor({
      actor: { userId: 'student-user-1', role: 'ELEVE' },
      resourceId: '202269df-9b59-5c61-aa20-1f13a7558910',
      resourceVersionId: '00000000-0000-4000-8000-000000000000',
      now,
    })).rejects.toMatchObject({ code: 'RESOURCE_MISMATCH' });
  });
});
