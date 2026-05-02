jest.mock('@/lib/guards', () => ({
  requireRole: jest.fn(),
  isErrorResponse: jest.fn((result) => result && typeof result === 'object' && 'status' in result),
}));

jest.mock('@/lib/rbac/coach-student-access', () => {
  class CoachNotAssignedError extends Error {
    constructor(message = "Vous n'êtes pas assigné à cet élève") {
      super(message);
      this.name = 'CoachNotAssignedError';
    }
  }
  return {
    assertCoachCanAccessStudent: jest.fn(),
    CoachNotAssignedError,
  };
});

jest.mock('@/lib/prisma', () => ({
  prisma: {
    generatedPedagogicalReport: { findMany: jest.fn() },
    bilan: { findFirst: jest.fn() },
    eafPreparationReport: { findFirst: jest.fn() },
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

import { GET } from '@/app/api/coach/students/[studentId]/generated-reports/route';
import { requireRole } from '@/lib/guards';
import { assertCoachCanAccessStudent, CoachNotAssignedError } from '@/lib/rbac/coach-student-access';
import { prisma } from '@/lib/prisma';

function params(studentId = 'student-1') {
  return { params: Promise.resolve({ studentId }) };
}

describe('GET /api/coach/students/[studentId]/generated-reports', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requires COACH role', async () => {
    (requireRole as jest.Mock).mockResolvedValue(
      Response.json({ error: 'Forbidden' }, { status: 403 }),
    );

    const res = await GET(new Request('http://localhost/'), params());
    expect(res.status).toBe(403);
    expect(requireRole).toHaveBeenCalledWith('COACH');
  });

  it('prevents horizontal access for unassigned students', async () => {
    (requireRole as jest.Mock).mockResolvedValue({ user: { id: 'coach-user-1', role: 'COACH' } });
    (assertCoachCanAccessStudent as jest.Mock).mockRejectedValue(new CoachNotAssignedError());

    const res = await GET(new Request('http://localhost/'), params());
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe('Forbidden');
  });

  it('returns reports and EAF readiness for assigned coaches', async () => {
    (requireRole as jest.Mock).mockResolvedValue({ user: { id: 'coach-user-1', role: 'COACH' } });
    (assertCoachCanAccessStudent as jest.Mock).mockResolvedValue(undefined);
    (prisma.pedagogicalReport.findMany as jest.Mock).mockResolvedValue([
      { id: 'report-1', kind: 'EAF_STAGE_POST', status: 'PENDING' },
    ]);
    (prisma.bilan.findFirst as jest.Mock).mockResolvedValue({ id: 'student-bilan-1' });
    (prisma.eafPreparationReport.findFirst as jest.Mock).mockResolvedValue({
      status: 'VALIDATED',
      writingMethod: 'ok',
      languageMastery: 'ok',
      literaryCulture: 'ok',
      strengths: 'ok',
      areasToImprove: 'ok',
      nextSessionGoals: 'ok',
      coachFreeComment: 'ok',
    });

    const res = await GET(new Request('http://localhost/'), params());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.reports).toHaveLength(1);
    expect(body.readiness.eafStagePost.studentBilanReady).toBe(true);
    expect(body.readiness.eafStagePost.coachReportValidated).toBe(true);
  });
});
