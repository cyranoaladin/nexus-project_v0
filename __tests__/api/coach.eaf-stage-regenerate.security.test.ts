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
    getCoachProfileForUser: jest.fn(),
    CoachNotAssignedError,
  };
});

jest.mock('@/lib/prisma', () => ({
  prisma: {
    bilan: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('@/lib/coach/eaf-stage-printemps/llm-report', () => ({
  generateLLMParentEafReport: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

import { POST } from '@/app/api/coach/eaf-stage-printemps/students/[studentId]/report/regenerate/route';
import { requireRole } from '@/lib/guards';
import { assertCoachCanAccessStudent } from '@/lib/rbac/coach-student-access';
import { prisma } from '@/lib/prisma';

describe('POST /api/coach/eaf-stage-printemps/students/[studentId]/report/regenerate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireRole as jest.Mock).mockResolvedValue({ user: { id: 'coach-user-1', role: 'COACH' } });
  });

  it('rejects unsafe student ids before checking coach assignment or loading bilans', async () => {
    const res = await POST(new Request('http://localhost/', { method: 'POST' }), {
      params: Promise.resolve({ studentId: '../student' }),
    });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('Données');
    expect(assertCoachCanAccessStudent).not.toHaveBeenCalled();
    expect(prisma.bilan.findFirst).not.toHaveBeenCalled();
  });
});
