/**
 * `buildAriaConversationContext` already carries `courseKey` when it looks up
 * a requested resource (`validateSkillAndResource`) — it must thread that
 * context into a course-aware lookup, never the context-free primitive that
 * refuses every multi-placement resource before authorization even runs.
 *
 * The real registry has no multi-placement resource today, so this
 * substitutes one via a module mock, isolated from `context.test.ts`'s
 * real-registry test suite.
 */
import { prisma } from '@/lib/prisma';
import { buildAriaConversationContext } from '@/lib/aria/application/conversation/public';
import { AriaError } from '@/lib/aria/errors';

const SHARED_RESOURCE_ID = '77777777-7777-4777-8777-777777777777';
const SHARED_VERSION_ID = '88888888-8888-4888-8888-888888888888';
const SOLO_RESOURCE_ID = '99999999-9999-4999-8999-999999999999';
const SOLO_VERSION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function projection(courseKey: string, resourceId: string, resourceVersionId: string) {
  return {
    id: resourceId,
    resourceVersionId,
    courseKey,
    title: 'Ressource partagée NSI',
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

jest.mock('@/lib/prisma', () => ({
  prisma: { student: { findUnique: jest.fn() } },
}));
jest.mock('@/lib/aria/infrastructure/rag/manifest', () => ({
  getAriaRagCorpusCapability: jest.fn((courseKey: string) => {
    const corpusByCourse: Record<string, string> = {
      'eds-nsi-premiere': 'aria-nsi-premiere',
      'eds-nsi-terminale': 'aria-nsi-terminale',
      'eds-maths-terminale': 'aria-maths-terminale',
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
jest.mock('@/lib/aria/resources', () => {
  const actual = jest.requireActual('@/lib/aria/resources');
  return {
    ...actual,
    getResourceForCourse: (resourceId: string, courseKey: string) => {
      if (resourceId === SHARED_RESOURCE_ID
        && (courseKey === 'eds-nsi-premiere' || courseKey === 'eds-nsi-terminale')) {
        return projection(courseKey, SHARED_RESOURCE_ID, SHARED_VERSION_ID);
      }
      if (resourceId === SOLO_RESOURCE_ID && courseKey === 'eds-nsi-premiere') {
        return projection(courseKey, SOLO_RESOURCE_ID, SOLO_VERSION_ID);
      }
      return null;
    },
  };
});

const now = new Date('2026-08-30T12:00:00.000Z');
const activeEntitlement = (courseKey: string) => ({
  id: 'entitlement-1',
  productCode: 'ARIA_ACCESS',
  status: 'ACTIVE',
  startsAt: new Date('2026-08-01T00:00:00.000Z'),
  endsAt: null,
  ariaScopes: [{ kind: 'COURSE', courseKey }],
});
const studentFixture = (courseKey: string) => ({
  id: 'student-1',
  userId: 'student-user-1',
  gradeLevel: courseKey.includes('terminale') ? 'TERMINALE' : 'PREMIERE',
  academicTrack: 'EDS_GENERALE',
  stmgPathway: null,
  academicEnrollments: [{ courseKey, kind: 'SPECIALTY', source: 'ADMIN' }],
  user: { entitlements: [activeEntitlement(courseKey)] },
  ariaConversations: [],
  ariaProfile: null,
});

const identityEnvironmentKeys = [
  'E2E_DISPOSABLE_STACK',
  'NEXUS_INTERNAL_TOKEN_SECRET',
  'ARIA_E2E_RAG_CANDIDAT',
  'ARIA_E2E_RAG_AUDIENCE',
  'ARIA_E2E_RAG_ZONE',
  'ARIA_E2E_RAG_STATUS_DETAIL',
] as const;
const originalIdentityEnvironment = Object.fromEntries(
  identityEnvironmentKeys.map((key) => [key, process.env[key]]),
);

describe('buildAriaConversationContext — course-aware multi-placement resource lookup', () => {
  const findStudent = prisma.student.findUnique as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(process.env, {
      E2E_DISPOSABLE_STACK: '1',
      NEXUS_INTERNAL_TOKEN_SECRET: 'k'.repeat(32),
      ARIA_E2E_RAG_CANDIDAT: 'scolarise',
      ARIA_E2E_RAG_AUDIENCE: 'aefe',
      ARIA_E2E_RAG_ZONE: 'aefe',
      ARIA_E2E_RAG_STATUS_DETAIL: 'aefe',
    });
  });

  afterAll(() => {
    for (const key of identityEnvironmentKeys) {
      const value = originalIdentityEnvironment[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('CHAT_SHARED_RESOURCE_PREMIERE: a shared resource resolves in its Première context', async () => {
    findStudent.mockResolvedValue(studentFixture('eds-nsi-premiere'));
    await expect(buildAriaConversationContext({
      actor: { userId: 'student-user-1', role: 'ELEVE' },
      courseKey: 'eds-nsi-premiere',
      resourceId: SHARED_RESOURCE_ID,
      now,
    })).resolves.toMatchObject({
      resourceId: SHARED_RESOURCE_ID,
      resourceVersionId: SHARED_VERSION_ID,
    });
  });

  it('CHAT_SHARED_RESOURCE_TERMINALE: the SAME shared resource resolves in its Terminale context', async () => {
    findStudent.mockResolvedValue(studentFixture('eds-nsi-terminale'));
    await expect(buildAriaConversationContext({
      actor: { userId: 'student-user-1', role: 'ELEVE' },
      courseKey: 'eds-nsi-terminale',
      resourceId: SHARED_RESOURCE_ID,
      now,
    })).resolves.toMatchObject({
      resourceId: SHARED_RESOURCE_ID,
      resourceVersionId: SHARED_VERSION_ID,
    });
  });

  it('WRONG_COURSE_REFUSED: a course the shared resource is not placed in is refused', async () => {
    findStudent.mockResolvedValue(studentFixture('eds-maths-terminale'));
    await expect(buildAriaConversationContext({
      actor: { userId: 'student-user-1', role: 'ELEVE' },
      courseKey: 'eds-maths-terminale',
      resourceId: SHARED_RESOURCE_ID,
      now,
    })).rejects.toMatchObject({ code: 'RESOURCE_MISMATCH' });
  });

  it('a single-placement resource is refused through a course it is not placed in', async () => {
    findStudent.mockResolvedValue(studentFixture('eds-nsi-terminale'));
    await expect(buildAriaConversationContext({
      actor: { userId: 'student-user-1', role: 'ELEVE' },
      courseKey: 'eds-nsi-terminale',
      resourceId: SOLO_RESOURCE_ID,
      now,
    })).rejects.toBeInstanceOf(AriaError);
  });
});
