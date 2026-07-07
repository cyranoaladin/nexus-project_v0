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
    eafPreparationReport: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('@/lib/reports/stage/maybeCreateGeneratedReportJob', () => ({
  maybeCreateGeneratedReportJob: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

import { POST } from '@/app/api/coach/students/[studentId]/eaf-preparation-report/validate/route';
import { requireRole } from '@/lib/guards';
import { assertCoachCanAccessStudent, getCoachProfileForUser } from '@/lib/rbac/coach-student-access';
import { prisma } from '@/lib/prisma';
import { maybeCreateGeneratedReportJob } from '@/lib/reports/stage/maybeCreateGeneratedReportJob';

function params(studentId = 'student-1') {
  return { params: Promise.resolve({ studentId }) };
}

const completeReport = {
  id: 'report-1',
  status: 'DRAFT',
  writingMethod: 'ok',
  languageMastery: 'ok',
  literaryCulture: 'ok',
  strengths: 'ok',
  areasToImprove: 'ok',
  nextSessionGoals: 'ok',
  coachFreeComment: 'ok',
};

describe('POST /api/coach/students/[studentId]/eaf-preparation-report/validate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireRole as jest.Mock).mockResolvedValue({ user: { id: 'coach-user-1', role: 'COACH' } });
    (assertCoachCanAccessStudent as jest.Mock).mockResolvedValue(undefined);
    (getCoachProfileForUser as jest.Mock).mockResolvedValue({ id: 'coach-1' });
  });

  it('rejects unsafe student ids before checking coach assignment', async () => {
    const res = await POST(new Request('http://localhost/', { method: 'POST' }), params('../student'));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('Données');
    expect(assertCoachCanAccessStudent).not.toHaveBeenCalled();
    expect(prisma.eafPreparationReport.findUnique).not.toHaveBeenCalled();
  });

  it('refuses incomplete coach reports', async () => {
    (prisma.eafPreparationReport.findUnique as jest.Mock).mockResolvedValue({
      ...completeReport,
      strengths: '',
    });

    const res = await POST(new Request('http://localhost/', { method: 'POST' }), params());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.missingFields).toContain('strengths');
    expect(prisma.eafPreparationReport.update).not.toHaveBeenCalled();
  });

  it('validates complete coach reports and tries job creation', async () => {
    (prisma.eafPreparationReport.findUnique as jest.Mock).mockResolvedValue(completeReport);
    (prisma.eafPreparationReport.update as jest.Mock).mockResolvedValue({
      ...completeReport,
      status: 'VALIDATED',
      completionRatio: 100,
    });
    (maybeCreateGeneratedReportJob as jest.Mock).mockResolvedValue({
      created: true,
      reportId: 'generated-report-1',
    });

    const res = await POST(new Request('http://localhost/', { method: 'POST' }), params());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.report.status).toBe('VALIDATED');
    expect(maybeCreateGeneratedReportJob).toHaveBeenCalledWith({
      studentId: 'student-1',
      subject: 'FRANCAIS',
      kind: 'EAF_STAGE_POST',
      stageSlug: 'stage-printemps-2026',
    });
  });
});
