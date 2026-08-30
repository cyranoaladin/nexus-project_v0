import { prisma } from '@/lib/prisma';
import { buildAriaCockpitPayload, type StudentForCockpit } from '@/lib/aria/cockpit/builder';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    ariaLearningProfile: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    ariaConversation: {
      findMany: jest.fn(),
    },
  },
}));

describe('ARIA Cockpit Payload Builder', () => {
  const mockPrisma = prisma as unknown as {
    ariaLearningProfile: { findUnique: jest.Mock; upsert: jest.Mock };
    ariaConversation: { findMany: jest.Mock };
  };

  const studentContext: StudentForCockpit = {
    id: 'student-cockpit-1',
    gradeLevel: 'TERMINALE',
    academicTrack: 'EDS_GENERALE',
    academicEnrollments: [
      { courseKey: 'eds-maths-terminale', kind: 'SPECIALTY', source: 'ADMIN' },
      { courseKey: 'eds-nsi-terminale', kind: 'SPECIALTY', source: 'ADMIN' },
    ],
    subscriptions: [
      { status: 'ACTIVE', ariaSubjects: ['MATHEMATIQUES', 'NSI'] },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('construit un payload cockpit complet avec cours résolus et données actives', async () => {
    mockPrisma.ariaLearningProfile.findUnique.mockResolvedValueOnce({
      studentId: 'student-cockpit-1',
      selectedCourseKeys: ['eds-maths-terminale'],
      uiPreferences: {},
      updatedAt: new Date('2026-08-30T00:00:00Z'),
    });

    mockPrisma.ariaConversation.findMany.mockResolvedValueOnce([
      {
        id: 'conv-1',
        title: 'Dérivation exponentielle',
        courseKey: 'eds-maths-terminale',
        updatedAt: new Date('2026-08-30T06:00:00Z'),
        messages: [{ id: 'm1' }, { id: 'm2' }],
      },
    ]);

    const payload = await buildAriaCockpitPayload({
      student: studentContext,
      requestedCourseKey: 'eds-maths-terminale',
    });

    expect(payload.student.id).toBe('student-cockpit-1');
    expect(payload.activeCourseKey).toBe('eds-maths-terminale');
    expect(payload.courses.length).toBeGreaterThanOrEqual(2);
    expect(payload.activeSkillGraph).not.toBeNull();
    expect(payload.activeResources.length).toBeGreaterThan(0);
    expect(payload.recentConversations).toHaveLength(1);
    expect(payload.recentConversations[0].title).toBe('Dérivation exponentielle');
  });

  it('bascule sur le premier cours disponible si aucun cours n est explicitement demandé', async () => {
    mockPrisma.ariaLearningProfile.findUnique.mockResolvedValueOnce(null);
    mockPrisma.ariaLearningProfile.upsert.mockResolvedValueOnce({
      studentId: 'student-cockpit-1',
      selectedCourseKeys: [],
      uiPreferences: {},
      updatedAt: new Date(),
    });
    mockPrisma.ariaConversation.findMany.mockResolvedValueOnce([]);

    const payload = await buildAriaCockpitPayload({
      student: studentContext,
    });

    expect(payload.activeCourseKey).not.toBeNull();
    expect([
      'tc-philosophie-terminale',
      'eds-maths-terminale',
      'eds-nsi-terminale',
    ]).toContain(payload.activeCourseKey);
  });
});
