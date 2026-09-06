import { prisma } from '@/lib/prisma';
import { Readable } from 'node:stream';
import {
  authorizeAriaResourceForActor,
  listAriaResourcesForActor,
  openAriaResourceContentForActor,
} from '@/lib/aria/application/resources/public';
import {
  getActiveResourcePlacements,
  getResourceForCourse,
  listResourcesForCourse,
} from '@/lib/aria/resources';
import { openVerifiedAriaResourceFile } from '@/lib/aria/infrastructure/resources/secure-open-linux';

jest.mock('@/lib/prisma', () => ({
  prisma: { student: { findUnique: jest.fn() } },
}));

jest.mock('@/lib/aria/resources', () => {
  const actual = jest.requireActual('@/lib/aria/resources');
  return {
    ...actual,
    getActiveResourcePlacements: jest.fn(actual.getActiveResourcePlacements),
    getResourceForCourse: jest.fn(actual.getResourceForCourse),
    listResourcesForCourse: jest.fn(actual.listResourcesForCourse),
  };
});

jest.mock('@/lib/aria/infrastructure/resources/secure-open-linux', () => ({
  openVerifiedAriaResourceFile: jest.fn(),
}));

const now = new Date('2026-08-30T12:00:00.000Z');
const CANONICAL_RESOURCE_ID = '202269df-9b59-5c61-aa20-1f13a7558910';
const CANONICAL_VERSION_ID = 'f69965ee-0e3a-51d9-ab4d-55f58a003beb';
const CANONICAL_COURSE_KEY = 'eds-maths-terminale';

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
  const placementsMock = getActiveResourcePlacements as jest.Mock;
  const resourceForCourseMock = getResourceForCourse as jest.Mock;
  const listResourcesMock = listResourcesForCourse as jest.Mock;
  const actual = jest.requireActual('@/lib/aria/resources') as {
    getActiveResourcePlacements: typeof getActiveResourcePlacements;
    getResourceForCourse: typeof getResourceForCourse;
    listResourcesForCourse: typeof listResourcesForCourse;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    findStudent.mockResolvedValue(studentFixture());
    placementsMock.mockImplementation(actual.getActiveResourcePlacements);
    resourceForCourseMock.mockImplementation(actual.getResourceForCourse);
    listResourcesMock.mockImplementation(actual.listResourcesForCourse);
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
      resourceId: CANONICAL_RESOURCE_ID,
      resourceVersionId: CANONICAL_VERSION_ID,
    });
    expect(result.resources[0]).not.toHaveProperty('filename');
    expect(result.resources[0]).not.toHaveProperty('contentSha256');
  });

  it('lists only resources visible to the current student without revealing filtered metadata', async () => {
    const canonical = actual.getResourceForCourse(CANONICAL_RESOURCE_ID, CANONICAL_COURSE_KEY);
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
    findStudent.mockClear();
    await expect(listAriaResourcesForActor({
      actor: { userId: 'student-user-1', role: 'ELEVE' },
      courseKey: 'course-inconnu',
      now,
    })).rejects.toMatchObject({ code: 'COURSE_NOT_FOUND' });
    // Deterministic on an unknown course BEFORE any student lookup — a
    // missing student or DB outage must never precede a 404 for a course
    // that was never going to resolve either way.
    expect(findStudent).not.toHaveBeenCalled();

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
      resourceId: CANONICAL_RESOURCE_ID,
      resourceVersionId: CANONICAL_VERSION_ID,
      now,
    })).resolves.toMatchObject({
      resource: {
        id: CANONICAL_RESOURCE_ID,
        resourceVersionId: CANONICAL_VERSION_ID,
        courseKey: CANONICAL_COURSE_KEY,
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
      resourceId: CANONICAL_RESOURCE_ID,
      resourceVersionId: '00000000-0000-4000-8000-000000000000',
      now,
    })).rejects.toMatchObject({ code: 'RESOURCE_MISMATCH' });
  });

  it('opens only the authorized immutable resource version and returns a safe filename', async () => {
    const content = await openAriaResourceContentForActor({
      actor: { userId: 'student-user-1', role: 'ELEVE' },
      resourceId: CANONICAL_RESOURCE_ID,
      resourceVersionId: CANONICAL_VERSION_ID,
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
    const canonical = actual.getResourceForCourse(CANONICAL_RESOURCE_ID, CANONICAL_COURSE_KEY);
    expect(canonical).not.toBeNull();
    resourceForCourseMock.mockReturnValue({
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
      resourceId: CANONICAL_RESOURCE_ID,
      resourceVersionId: CANONICAL_VERSION_ID,
      now,
    })).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('rejects canonical resource metadata that cannot bind immutable content', async () => {
    const canonical = actual.getResourceForCourse(CANONICAL_RESOURCE_ID, CANONICAL_COURSE_KEY);
    expect(canonical).not.toBeNull();
    resourceForCourseMock.mockReturnValue({
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

  it('fails closed for a RAG_GOVERNED resource instead of opening a local file', async () => {
    const canonical = actual.getResourceForCourse(CANONICAL_RESOURCE_ID, CANONICAL_COURSE_KEY);
    expect(canonical).not.toBeNull();
    resourceForCourseMock.mockReturnValue({
      ...canonical!,
      storageProvider: 'RAG_GOVERNED',
      filename: undefined,
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

describe('ARIA content authorization — a resource placed in several courses (Section 5C)', () => {
  const SHARED_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const SHARED_VERSION = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const SOLO_A_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const SOLO_A_VERSION = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  const COURSE_A = 'eds-nsi-premiere';
  const COURSE_B = 'eds-nsi-terminale';

  const findStudent = prisma.student.findUnique as jest.Mock;
  const placementsMock = getActiveResourcePlacements as jest.Mock;
  const resourceForCourseMock = getResourceForCourse as jest.Mock;

  function projection(courseKey: string, resourceId: string, resourceVersionId: string) {
    return {
      id: resourceId,
      resourceVersionId,
      courseKey,
      title: 'Ressource partagée',
      type: 'PDF' as const,
      provenance: 'OFFICIEL_MEN' as const,
      sourceLabel: 'fixture',
      sourceReference: 'fixture',
      visibility: 'PUBLIC' as const,
      ownerStudentId: null,
      storageProvider: 'NEXUS_REPOSITORY' as const,
      filename: `${resourceId}.pdf`,
      sizeBytes: 42,
      contentSha256: 'a'.repeat(64),
      mimeType: 'application/pdf' as const,
    };
  }

  function studentEntitledTo(courseKey: string | null) {
    return {
      id: 'student-1',
      userId: 'student-user-1',
      gradeLevel: courseKey?.includes('terminale') ? 'TERMINALE' : 'PREMIERE',
      academicTrack: 'EDS_GENERALE',
      stmgPathway: null,
      academicEnrollments: courseKey
        ? [{ courseKey, kind: 'SPECIALTY', source: 'ADMIN' }]
        : [],
      user: {
        entitlements: courseKey ? [{
          id: 'entitlement-1',
          productCode: 'ARIA_ACCESS',
          status: 'ACTIVE',
          startsAt: new Date('2026-08-01T00:00:00.000Z'),
          endsAt: null,
          ariaScopes: [{ kind: 'COURSE', courseKey }],
        }] : [],
      },
      ariaConversations: [],
      ariaProfile: null,
    };
  }

  beforeEach(() => {
    placementsMock.mockImplementation((resourceId: string) => {
      if (resourceId === SHARED_ID) return [COURSE_A, COURSE_B];
      if (resourceId === SOLO_A_ID) return [COURSE_A];
      return null;
    });
    resourceForCourseMock.mockImplementation((resourceId: string, courseKey: string) => {
      if (resourceId === SHARED_ID && (courseKey === COURSE_A || courseKey === COURSE_B)) {
        return projection(courseKey, SHARED_ID, SHARED_VERSION);
      }
      if (resourceId === SOLO_A_ID && courseKey === COURSE_A) {
        return projection(courseKey, SOLO_A_ID, SOLO_A_VERSION);
      }
      return null;
    });
  });

  it('a resource placed in A+B authorizes a student entitled to A only, THROUGH A, never claiming B', async () => {
    findStudent.mockResolvedValue(studentEntitledTo(COURSE_A));
    const { resource } = await authorizeAriaResourceForActor({
      actor: { userId: 'student-user-1', role: 'ELEVE' },
      resourceId: SHARED_ID,
      resourceVersionId: SHARED_VERSION,
      now,
    });
    expect(resource.courseKey).toBe(COURSE_A);
  });

  it('a resource placed in A+B also authorizes a student entitled to B only, THROUGH B', async () => {
    findStudent.mockResolvedValue(studentEntitledTo(COURSE_B));
    const { resource } = await authorizeAriaResourceForActor({
      actor: { userId: 'student-user-1', role: 'ELEVE' },
      resourceId: SHARED_ID,
      resourceVersionId: SHARED_VERSION,
      now,
    });
    expect(resource.courseKey).toBe(COURSE_B);
  });

  it('a student entitled to neither A nor B is refused', async () => {
    findStudent.mockResolvedValue(studentEntitledTo(null));
    await expect(authorizeAriaResourceForActor({
      actor: { userId: 'student-user-1', role: 'ELEVE' },
      resourceId: SHARED_ID,
      resourceVersionId: SHARED_VERSION,
      now,
    })).rejects.toMatchObject({ code: 'RESOURCE_MISMATCH' });
  });

  it('a resource placed only in A is refused for a student entitled only to B', async () => {
    findStudent.mockResolvedValue(studentEntitledTo(COURSE_B));
    await expect(authorizeAriaResourceForActor({
      actor: { userId: 'student-user-1', role: 'ELEVE' },
      resourceId: SOLO_A_ID,
      resourceVersionId: SOLO_A_VERSION,
      now,
    })).rejects.toMatchObject({ code: 'RESOURCE_MISMATCH' });
  });

  it('an unknown resource is refused', async () => {
    findStudent.mockResolvedValue(studentEntitledTo(COURSE_A));
    await expect(authorizeAriaResourceForActor({
      actor: { userId: 'student-user-1', role: 'ELEVE' },
      resourceId: 'unknown-resource',
      resourceVersionId: SHARED_VERSION,
      now,
    })).rejects.toMatchObject({ code: 'RESOURCE_MISMATCH' });
  });

  it('an infrastructure failure while checking one placement propagates immediately, never swallowed into a misleading RESOURCE_MISMATCH', async () => {
    findStudent.mockRejectedValue(new Error('db unreachable'));
    await expect(authorizeAriaResourceForActor({
      actor: { userId: 'student-user-1', role: 'ELEVE' },
      resourceId: SHARED_ID,
      resourceVersionId: SHARED_VERSION,
      now,
    })).rejects.toThrow('db unreachable');
  });

  it('an AriaError INTERNAL_ERROR from inconsistent enrollment data propagates instead of being treated as a per-course refusal', async () => {
    // gradeLevel PREMIERE with an enrollment in a TERMINALE-only course is
    // outside the current academic map — resolveAriaCourseAccess raises
    // INTERNAL_ERROR, not a refusal, for every placement it's asked about.
    findStudent.mockResolvedValue({
      id: 'student-1',
      userId: 'student-user-1',
      gradeLevel: 'PREMIERE',
      academicTrack: 'EDS_GENERALE',
      stmgPathway: null,
      academicEnrollments: [{ courseKey: COURSE_B, kind: 'SPECIALTY', source: 'ADMIN' }],
      user: {
        entitlements: [{
          id: 'entitlement-1',
          productCode: 'ARIA_ACCESS',
          status: 'ACTIVE',
          startsAt: new Date('2026-08-01T00:00:00.000Z'),
          endsAt: null,
          ariaScopes: [{ kind: 'COURSE', courseKey: COURSE_B }],
        }],
      },
      ariaConversations: [],
      ariaProfile: null,
    });

    await expect(authorizeAriaResourceForActor({
      actor: { userId: 'student-user-1', role: 'ELEVE' },
      resourceId: SHARED_ID,
      resourceVersionId: SHARED_VERSION,
      now,
    })).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });
  });
});
