import { prisma } from '@/lib/prisma';
import { Readable } from 'node:stream';
import {
  authorizeAriaResourceForActor,
  listAriaResourcesForActor,
  openAriaResourceContentForActor,
} from '@/lib/aria/application/resources/public';
import { getResource, listResourcesForCourse } from '@/lib/aria/resources';
import { openVerifiedAriaResourceFile } from '@/lib/aria/infrastructure/resources/secure-open-linux';

jest.mock('@/lib/prisma', () => ({
  prisma: { student: { findUnique: jest.fn() } },
}));

jest.mock('@/lib/aria/resources', () => {
  const actual = jest.requireActual('@/lib/aria/resources');
  return {
    ...actual,
    getResource: jest.fn(actual.getResource),
    listResourcesForCourse: jest.fn(actual.listResourcesForCourse),
  };
});

jest.mock('@/lib/aria/infrastructure/resources/secure-open-linux', () => ({
  openVerifiedAriaResourceFile: jest.fn(),
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
  const openVerified = openVerifiedAriaResourceFile as jest.Mock;
  const getResourceMock = getResource as jest.Mock;
  const listResourcesMock = listResourcesForCourse as jest.Mock;
  const actualGetResource = (jest.requireActual('@/lib/aria/resources') as {
    getResource: typeof getResource;
  }).getResource;

  beforeEach(() => {
    jest.clearAllMocks();
    findStudent.mockResolvedValue(studentFixture());
    getResourceMock.mockImplementation(actualGetResource);
    listResourcesMock.mockImplementation(
      (jest.requireActual('@/lib/aria/resources') as {
        listResourcesForCourse: typeof listResourcesForCourse;
      }).listResourcesForCourse,
    );
    openVerified.mockResolvedValue({
      mimeType: 'application/pdf',
      sizeBytes: 12,
      createReadStream: () => Readable.from([Buffer.from('%PDF-content')]),
      close: jest.fn().mockResolvedValue(undefined),
    });
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

  it('lists only resources visible to the current student without revealing filtered metadata', async () => {
    const canonical = actualGetResource('202269df-9b59-5c61-aa20-1f13a7558910');
    expect(canonical).not.toBeNull();
    listResourcesMock.mockReturnValue([
      { ...canonical!, id: 'public-resource', visibility: 'PUBLIC', ownerStudentId: null },
      {
        ...canonical!, id: 'private-self', visibility: 'STUDENT_PRIVATE',
        ownerStudentId: 'student-1',
      },
      {
        ...canonical!, id: 'private-other', visibility: 'STUDENT_PRIVATE',
        ownerStudentId: 'student-other', title: 'Private other title',
      },
      {
        ...canonical!, id: 'system-only', visibility: 'SYSTEM_ONLY',
        ownerStudentId: null, title: 'System-only title',
      },
    ]);

    const result = await listAriaResourcesForActor({
      actor: { userId: 'student-user-1', role: 'ELEVE' },
      courseKey: 'eds-maths-terminale',
      now,
    });
    expect(result.resources.map(({ resourceId }) => resourceId)).toEqual([
      'public-resource', 'private-self',
    ]);
    expect(JSON.stringify(result)).not.toMatch(/Private other title|System-only title/);
  });

  it('U014 fails closed when no active canonical scope covers the course', async () => {
    findStudent.mockResolvedValueOnce(studentFixture(false));
    await expect(listAriaResourcesForActor({
      actor: { userId: 'student-user-1', role: 'ELEVE' },
      courseKey: 'eds-maths-terminale',
      now,
    })).rejects.toMatchObject({ code: 'NOT_ENTITLED' });
  });

  it('fails closed for unknown, non-enrolled and unsupported course contexts', async () => {
    await expect(listAriaResourcesForActor({
      actor: { userId: 'student-user-1', role: 'ELEVE' },
      courseKey: 'course-inconnu',
      now,
    })).rejects.toMatchObject({ code: 'COURSE_NOT_FOUND' });

    await expect(listAriaResourcesForActor({
      actor: { userId: 'student-user-1', role: 'ELEVE' },
      courseKey: 'eds-nsi-terminale',
      now,
    })).rejects.toMatchObject({ code: 'NOT_ENROLLED' });

    findStudent.mockResolvedValueOnce({
      ...studentFixture(),
      academicEnrollments: [
        { courseKey: 'tc-grand-oral-terminale', kind: 'MANDATORY', source: 'ADMIN' },
      ],
      user: {
        entitlements: [{
          id: 'entitlement-francais',
          productCode: 'ARIA_ACCESS',
          status: 'ACTIVE',
          startsAt: new Date('2026-08-01T00:00:00.000Z'),
          endsAt: null,
          ariaScopes: [{ kind: 'COURSE', courseKey: 'tc-grand-oral-terminale' }],
        }],
      },
    });
    await expect(listAriaResourcesForActor({
      actor: { userId: 'student-user-1', role: 'ELEVE' },
      courseKey: 'tc-grand-oral-terminale',
      now,
    })).rejects.toMatchObject({ code: 'UNSUPPORTED' });
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

  it('opens only the authorized immutable resource version and returns a safe filename', async () => {
    const content = await openAriaResourceContentForActor({
      actor: { userId: 'student-user-1', role: 'ELEVE' },
      resourceId: '202269df-9b59-5c61-aa20-1f13a7558910',
      resourceVersionId: 'f69965ee-0e3a-51d9-ab4d-55f58a003beb',
      now,
    });

    expect(openVerified).toHaveBeenCalledWith(expect.objectContaining({
      relativePath: expect.stringMatching(/\.pdf$/),
      expectedMimeType: 'application/pdf',
    }));
    expect(content).toMatchObject({
      filename: expect.stringMatching(/\.pdf$/),
      contentType: 'application/pdf',
      sizeBytes: 12,
    });
    expect(content.createReadStream()).toBeInstanceOf(Readable);
    await expect(content.close()).resolves.toBeUndefined();
  });

  it('fails closed and closes the descriptor when the canonical filename is unsafe', async () => {
    const canonical = getResource('202269df-9b59-5c61-aa20-1f13a7558910');
    expect(canonical).not.toBeNull();
    getResourceMock.mockReturnValue({
      ...canonical!,
      filename: 'programme/unsafe\n.pdf',
    });
    const close = jest.fn().mockResolvedValue(undefined);
    openVerified.mockResolvedValueOnce({
      mimeType: 'application/pdf',
      sizeBytes: 12,
      createReadStream: () => Readable.from([]),
      close,
    });

    await expect(openAriaResourceContentForActor({
      actor: { userId: 'student-user-1', role: 'ELEVE' },
      resourceId: canonical!.id,
      resourceVersionId: canonical!.resourceVersionId,
      now,
    })).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('rejects canonical resource metadata that cannot bind immutable content', async () => {
    const canonical = actualGetResource('202269df-9b59-5c61-aa20-1f13a7558910');
    expect(canonical).not.toBeNull();
    getResourceMock.mockReturnValue({
      ...canonical!,
      contentSha256: undefined,
    });

    await expect(openAriaResourceContentForActor({
      actor: { userId: 'student-user-1', role: 'ELEVE' },
      resourceId: canonical!.id,
      resourceVersionId: canonical!.resourceVersionId,
      now,
    })).rejects.toMatchObject({ code: 'UNSUPPORTED' });
    expect(openVerified).not.toHaveBeenCalled();
  });
});
