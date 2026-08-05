/**
 * P0 — the "Bilans de stage" section links to GET /api/parent/bilans/[id]/pdf,
 * which requires a currently VERIFIED canonical ParentStudentLink
 * (resolveParentOwnedStudent). A legacy child (Student.parentId FK only, no
 * canonical link yet) must not surface a coachBilans entry here, otherwise the
 * dashboard renders a PDF button that 404s when clicked.
 */
jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

import { auth } from '@/auth';
import { GET } from '@/app/api/parent/stages/route';

const mockAuth = auth as jest.Mock;
let prisma: any;

beforeEach(async () => {
  const mod = await import('@/lib/prisma');
  prisma = (mod as any).prisma;
  jest.clearAllMocks();
  mockAuth.mockResolvedValue({
    user: { id: 'parent-user-1', role: 'PARENT', email: 'parent@example.com' },
    expires: new Date(Date.now() + 3600_000).toISOString(),
  });
});

function coachBilan(studentId: string) {
  return {
    id: `bilan-${studentId}`,
    type: 'STAGE_POST',
    subject: 'MATHEMATIQUES',
    studentId,
    studentName: 'Eleve',
    globalScore: 15,
    domainScores: {},
    parentsMarkdown: 'contenu',
    publishedAt: new Date('2026-05-01T10:00:00.000Z'),
    createdAt: new Date('2026-05-01T09:00:00.000Z'),
    stage: { title: 'Stage', slug: 'stage-1' },
    coach: { pseudonym: 'Coach A' },
    student: { user: { firstName: 'Eleve', lastName: 'Test' } },
  };
}

describe('GET /api/parent/stages — coachBilans scoped to verified canonical link', () => {
  it('hides coachBilans for a legacy child with no canonical ParentStudentLink at all', async () => {
    prisma.parentProfile.findUnique.mockResolvedValue({
      children: [{ id: 'student-legacy-1', user: { firstName: 'A', lastName: 'B', email: 'a@b.test' } }],
    });
    prisma.parentStudentLink.findMany.mockResolvedValue([]);
    prisma.stageReservation.findMany.mockResolvedValue([]);
    prisma.stageBilan.findMany.mockResolvedValue([]);
    prisma.bilan.findMany.mockResolvedValue([coachBilan('student-legacy-1')]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.coachBilans).toEqual([]);
    expect(prisma.bilan.findMany).not.toHaveBeenCalled();
  });

  it.each(['PENDING_PARENT_CONSENT', 'REVOKED', 'EXPIRED'])(
    'hides coachBilans when the latest link is %s',
    async (state) => {
      prisma.parentProfile.findUnique.mockResolvedValue({
        children: [{ id: 'student-1', user: { firstName: 'A', lastName: 'B', email: 'a@b.test' } }],
      });
      prisma.parentStudentLink.findMany.mockResolvedValue([{
        id: 'link-1',
        studentId: 'student-1',
        state,
        verifiedAt: state === 'VERIFIED' ? new Date() : null,
        revokedAt: state === 'REVOKED' ? new Date() : null,
        expiresAt: state === 'EXPIRED' ? new Date('2020-01-01T00:00:00.000Z') : null,
      }]);
      prisma.stageReservation.findMany.mockResolvedValue([]);
      prisma.stageBilan.findMany.mockResolvedValue([]);
      prisma.bilan.findMany.mockResolvedValue([coachBilan('student-1')]);

      const response = await GET();
      const body = await response.json();

      expect(body.coachBilans).toEqual([]);
      expect(prisma.bilan.findMany).not.toHaveBeenCalled();
    },
  );

  it('shows coachBilans for a child with a currently VERIFIED canonical link', async () => {
    prisma.parentProfile.findUnique.mockResolvedValue({
      children: [{ id: 'student-verified-1', user: { firstName: 'A', lastName: 'B', email: 'a@b.test' } }],
    });
    prisma.parentStudentLink.findMany.mockResolvedValue([{
      id: 'link-1',
      studentId: 'student-verified-1',
      state: 'VERIFIED',
      verifiedAt: new Date('2026-08-01T10:00:00.000Z'),
      revokedAt: null,
      expiresAt: null,
    }]);
    prisma.stageReservation.findMany.mockResolvedValue([]);
    prisma.stageBilan.findMany.mockResolvedValue([]);
    prisma.bilan.findMany.mockResolvedValue([coachBilan('student-verified-1')]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.coachBilans).toHaveLength(1);
    expect(prisma.bilan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ studentId: { in: ['student-verified-1'] } }),
      }),
    );
  });

  it('shows only the verified child among several, taking the most recently updated link per student', async () => {
    prisma.parentProfile.findUnique.mockResolvedValue({
      children: [
        { id: 'student-verified', user: { firstName: 'A', lastName: 'B', email: 'a@b.test' } },
        { id: 'student-pending', user: { firstName: 'C', lastName: 'D', email: 'c@d.test' } },
      ],
    });
    prisma.parentStudentLink.findMany.mockResolvedValue([
      {
        id: 'link-verified',
        studentId: 'student-verified',
        state: 'VERIFIED',
        verifiedAt: new Date('2026-08-01T10:00:00.000Z'),
        revokedAt: null,
        expiresAt: null,
      },
      {
        id: 'link-pending',
        studentId: 'student-pending',
        state: 'PENDING_PARENT_CONSENT',
        verifiedAt: null,
        revokedAt: null,
        expiresAt: null,
      },
    ]);
    prisma.stageReservation.findMany.mockResolvedValue([]);
    prisma.stageBilan.findMany.mockResolvedValue([]);
    prisma.bilan.findMany.mockResolvedValue([coachBilan('student-verified')]);

    const response = await GET();

    expect(prisma.bilan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ studentId: { in: ['student-verified'] } }),
      }),
    );
    const body = await response.json();
    expect(body.coachBilans).toHaveLength(1);
  });
});
