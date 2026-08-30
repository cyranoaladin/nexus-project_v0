import { prisma } from '@/lib/prisma';
import { buildAriaConversationContext } from '@/lib/aria/application/conversation/public';
import { assertAriaResourceAuthorization } from '@/lib/aria/application/conversation/build-context';
import { AriaError } from '@/lib/aria/errors';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    student: { findUnique: jest.fn() },
  },
}));
jest.mock('@/lib/aria/infrastructure/rag/manifest', () => ({
  getAriaRagCorpusCapability: jest.fn((courseKey: string) => {
    const corpusByCourse: Record<string, string> = {
      'eds-maths-premiere': 'aria-maths-premiere',
      'eds-nsi-premiere': 'aria-nsi-premiere',
    };
    const corpusId = corpusByCourse[courseKey];
    return corpusId ? {
      status: 'AVAILABLE',
      corpus: {
        corpusId, corpusVersionId: 'fixture-v1',
        physicalCollection: 'fixture_collection', manifestSha256: 'a'.repeat(64),
        resourceRegistrySha256: 'b'.repeat(64), academicYear: '2026-2027',
        curriculumVersion: 'fixture-v1', resourceBindings: [],
      },
    } : { status: 'NOT_CONFIGURED', reasonCode: 'TEST_NO_CORPUS' };
  }),
}));

const now = new Date('2026-08-30T12:00:00.000Z');
const activeEntitlement = (scopes: Array<{ kind: 'GLOBAL' | 'COURSE'; courseKey: string | null }>) => ({
  id: 'entitlement-1',
  productCode: 'ARIA_ACCESS',
  status: 'ACTIVE',
  startsAt: new Date('2026-08-01T00:00:00.000Z'),
  endsAt: new Date('2026-09-30T00:00:00.000Z'),
  ariaScopes: scopes,
});

function studentFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'student-1',
    userId: 'student-user-1',
    gradeLevel: 'PREMIERE',
    academicTrack: 'EDS_GENERALE',
    stmgPathway: null,
    academicEnrollments: [
      { courseKey: 'eds-maths-premiere', kind: 'SPECIALTY', source: 'ADMIN' },
    ],
    user: {
      entitlements: [activeEntitlement([
        { kind: 'COURSE', courseKey: 'eds-maths-premiere' },
      ])],
    },
    ariaConversations: [],
    ...overrides,
  };
}

describe('buildAriaConversationContext authorization boundary', () => {
  const findStudent = prisma.student.findUnique as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    findStudent.mockResolvedValue(studentFixture());
  });

  it('resolves subject=self and accepts explicit course or global canonical scopes', async () => {
    const courseContext = await buildAriaConversationContext({
      actor: { userId: 'student-user-1', role: 'ELEVE' },
      courseKey: 'eds-maths-premiere',
      now,
    });
    expect(courseContext.actor.userId).toBe('student-user-1');
    expect(courseContext.subject.studentId).toBe('student-1');
    expect(courseContext.courseKey).toBe('eds-maths-premiere');

    findStudent.mockResolvedValueOnce(studentFixture({
      user: { entitlements: [activeEntitlement([{ kind: 'GLOBAL', courseKey: null }])] },
    }));
    await expect(buildAriaConversationContext({
      actor: { userId: 'student-user-1', role: 'ELEVE' },
      courseKey: 'eds-maths-premiere',
      now,
    })).resolves.toMatchObject({ courseKey: 'eds-maths-premiere' });
  });

  it('returns a deeply immutable authorized context', async () => {
    const context = await buildAriaConversationContext({
      actor: { userId: 'student-user-1', role: 'ELEVE' },
      courseKey: 'eds-maths-premiere',
      now,
    });

    expect(Object.isFrozen(context)).toBe(true);
    expect(Object.isFrozen(context.student)).toBe(true);
    expect(Object.isFrozen(context.student.academicEnrollments)).toBe(true);
    expect(Object.isFrozen(context.capabilities)).toBe(true);
    expect(Object.isFrozen(context.access)).toBe(true);
  });

  it.each(['PARENT', 'COACH', 'ADMIN', 'ASSISTANTE'])('rejects non-student actor role %s', async (role) => {
    await expect(buildAriaConversationContext({
      actor: { userId: 'other-user', role },
      courseKey: 'eds-maths-premiere',
      now,
    } as never)).rejects.toMatchObject({ code: 'NOT_ENROLLED', status: 403 });
    expect(findStudent).not.toHaveBeenCalled();
  });

  it('rejects client-controlled subject identity and academic/commercial overrides', async () => {
    await expect(buildAriaConversationContext({
      actor: { userId: 'student-user-1', role: 'ELEVE' },
      courseKey: 'eds-maths-premiere',
      now,
      studentId: 'forged-student',
      gradeLevel: 'TERMINALE',
      entitlement: { globalAccess: true },
    } as never)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(findStudent).not.toHaveBeenCalled();
  });

  it('rejects absent, stale and malformed academic or entitlement context', async () => {
    findStudent.mockResolvedValueOnce(null);
    await expect(buildAriaConversationContext({
      actor: { userId: 'student-user-1', role: 'ELEVE' },
      courseKey: 'eds-maths-premiere',
      now,
    })).rejects.toMatchObject({ code: 'NOT_ENROLLED' });

    findStudent.mockResolvedValueOnce(studentFixture({ gradeLevel: null }));
    await expect(buildAriaConversationContext({
      actor: { userId: 'student-user-1', role: 'ELEVE' },
      courseKey: 'eds-maths-premiere',
      now,
    })).rejects.toMatchObject({ code: 'NOT_ENROLLED' });

    findStudent.mockResolvedValueOnce(studentFixture({
      user: {
        entitlements: [{
          ...activeEntitlement([{ kind: 'COURSE', courseKey: 'eds-maths-premiere' }]),
          endsAt: new Date('2026-08-29T00:00:00.000Z'),
        }],
      },
    }));
    await expect(buildAriaConversationContext({
      actor: { userId: 'student-user-1', role: 'ELEVE' },
      courseKey: 'eds-maths-premiere',
      now,
    })).rejects.toMatchObject({ code: 'NOT_ENTITLED' });
  });

  it('rejects unknown, academically irrelevant and no-chat courses before model execution', async () => {
    await expect(buildAriaConversationContext({
      actor: { userId: 'student-user-1', role: 'ELEVE' },
      courseKey: 'unknown-course',
      now,
    })).rejects.toMatchObject({ code: 'COURSE_NOT_FOUND' });

    await expect(buildAriaConversationContext({
      actor: { userId: 'student-user-1', role: 'ELEVE' },
      courseKey: 'eds-maths-terminale',
      now,
    })).rejects.toMatchObject({ code: 'NOT_ENROLLED' });

    findStudent.mockResolvedValueOnce(studentFixture({
      academicTrack: 'STMG',
      academicEnrollments: [],
      user: { entitlements: [activeEntitlement([
        { kind: 'COURSE', courseKey: 'stmg-sgn-premiere' },
      ])] },
    }));
    await expect(buildAriaConversationContext({
      actor: { userId: 'student-user-1', role: 'ELEVE' },
      courseKey: 'stmg-sgn-premiere',
      now,
    })).rejects.toMatchObject({ code: 'UNSUPPORTED' });
  });

  it('validates requested skill and resource against the exact course', async () => {
    findStudent.mockResolvedValueOnce(studentFixture({
      academicEnrollments: [
        { courseKey: 'eds-nsi-premiere', kind: 'SPECIALTY', source: 'ADMIN' },
      ],
      user: { entitlements: [activeEntitlement([
        { kind: 'COURSE', courseKey: 'eds-nsi-premiere' },
      ])] },
    }));
    await expect(buildAriaConversationContext({
      actor: { userId: 'student-user-1', role: 'ELEVE' },
      courseKey: 'eds-nsi-premiere',
      skillId: 'eds-nsi-premiere:NSI_TYPES',
      resourceId: '0af21d67-1c3b-5a8a-8eed-38d23ecb1600',
      now,
    })).resolves.toMatchObject({
      skillId: 'eds-nsi-premiere:NSI_TYPES',
      resourceId: '0af21d67-1c3b-5a8a-8eed-38d23ecb1600',
    });

    await expect(buildAriaConversationContext({
      actor: { userId: 'student-user-1', role: 'ELEVE' },
      courseKey: 'eds-maths-premiere',
      skillId: 'eds-nsi-premiere:PROGRAMMATION',
      now,
    })).rejects.toBeInstanceOf(AriaError);
    await expect(buildAriaConversationContext({
      actor: { userId: 'student-user-1', role: 'ELEVE' },
      courseKey: 'eds-maths-premiere',
      resourceId: '0af21d67-1c3b-5a8a-8eed-38d23ecb1600',
      now,
    })).rejects.toMatchObject({ code: 'RESOURCE_MISMATCH' });
  });

  it('rejects a future personal resource owned by another student', () => {
    expect(() => assertAriaResourceAuthorization({
      courseKey: 'eds-maths-premiere',
      ownerStudentId: 'other-student',
      visibility: 'STUDENT_PRIVATE',
    }, 'eds-maths-premiere', 'student-1')).toThrow(
      expect.objectContaining({ code: 'RESOURCE_MISMATCH' }),
    );
  });

  it('rejects personal resources without self ownership and SYSTEM_ONLY resources', () => {
    for (const resource of [
      {
        courseKey: 'eds-maths-premiere',
        visibility: 'STUDENT_PRIVATE' as const,
      },
      {
        courseKey: 'eds-maths-premiere',
        ownerStudentId: 'student-1',
        visibility: 'SYSTEM_ONLY' as const,
      },
    ]) {
      expect(() => assertAriaResourceAuthorization(
        resource,
        'eds-maths-premiere',
        'student-1',
      )).toThrow(expect.objectContaining({ code: 'RESOURCE_MISMATCH' }));
    }
  });

  it('rejects a conversation row whose stored student identity disagrees', async () => {
    findStudent.mockResolvedValueOnce(studentFixture({
      ariaConversations: [{
        id: 'conversation-forged-owner',
        studentId: 'other-student',
        courseKey: 'eds-maths-premiere',
        contextState: 'ACTIVE',
        skillId: null,
        resourceId: null,
      }],
    }));

    await expect(buildAriaConversationContext({
      actor: { userId: 'student-user-1', role: 'ELEVE' },
      courseKey: 'eds-maths-premiere',
      conversationId: 'conversation-forged-owner',
      now,
    })).rejects.toMatchObject({ code: 'CONVERSATION_NOT_FOUND' });
  });

  it('does not add a new skill or resource context while resuming a contextless conversation', async () => {
    findStudent.mockResolvedValue(studentFixture({
      ariaConversations: [{
        id: 'conversation-contextless',
        studentId: 'student-1',
        courseKey: 'eds-maths-premiere',
        contextState: 'ACTIVE',
        skillId: null,
        resourceId: null,
      }],
    }));

    await expect(buildAriaConversationContext({
      actor: { userId: 'student-user-1', role: 'ELEVE' },
      courseKey: 'eds-maths-premiere',
      conversationId: 'conversation-contextless',
      skillId: 'ALG_SUITE_ARITH',
      now,
    })).rejects.toMatchObject({ code: 'SKILL_MISMATCH' });
    await expect(buildAriaConversationContext({
      actor: { userId: 'student-user-1', role: 'ELEVE' },
      courseKey: 'eds-maths-premiere',
      conversationId: 'conversation-contextless',
      resourceId: '0af21d67-1c3b-5a8a-8eed-38d23ecb1600',
      now,
    })).rejects.toMatchObject({ code: 'RESOURCE_MISMATCH' });
  });

  it('fails closed for unknown, cross-course and stored-context-mismatched conversations', async () => {
    await expect(buildAriaConversationContext({
      actor: { userId: 'student-user-1', role: 'ELEVE' },
      courseKey: 'eds-maths-premiere',
      conversationId: 'missing-conversation',
      now,
    })).rejects.toMatchObject({ code: 'CONVERSATION_NOT_FOUND' });

    findStudent.mockResolvedValueOnce(studentFixture({
      ariaConversations: [{
        id: 'conversation-1',
        studentId: 'student-1',
        courseKey: 'eds-maths-terminale',
        contextState: 'ACTIVE',
        skillId: null,
        resourceId: null,
      }],
    }));
    await expect(buildAriaConversationContext({
      actor: { userId: 'student-user-1', role: 'ELEVE' },
      courseKey: 'eds-maths-premiere',
      conversationId: 'conversation-1',
      now,
    })).rejects.toMatchObject({ code: 'CROSS_COURSE_MISMATCH' });

    findStudent.mockResolvedValueOnce(studentFixture({
      ariaConversations: [{
        id: 'conversation-2',
        studentId: 'student-1',
        courseKey: 'eds-maths-premiere',
        contextState: 'ACTIVE',
        skillId: 'wrong-course-skill',
        resourceId: null,
      }],
    }));
    await expect(buildAriaConversationContext({
      actor: { userId: 'student-user-1', role: 'ELEVE' },
      courseKey: 'eds-maths-premiere',
      conversationId: 'conversation-2',
      now,
    })).rejects.toMatchObject({ code: 'SKILL_MISMATCH' });
  });
});
