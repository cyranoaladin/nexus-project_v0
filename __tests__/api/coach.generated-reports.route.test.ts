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
    generatedPedagogicalReport: { findMany: jest.fn(), findUnique: jest.fn() },
    bilan: { findFirst: jest.fn() },
    eafPreparationReport: { findFirst: jest.fn() },
  },
}));

jest.mock('@/lib/reports/stage/processGeneratedReportJob', () => ({
  processGeneratedReportJob: jest.fn(),
}));

jest.mock('@/lib/reports/stage/reportStorage', () => ({
  readGeneratedReportPdf: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

import { GET } from '@/app/api/coach/students/[studentId]/generated-reports/route';
import { POST as REGENERATE } from '@/app/api/coach/students/[studentId]/generated-reports/[reportId]/regenerate/route';
import { GET as DOWNLOAD } from '@/app/api/coach/students/[studentId]/generated-reports/[reportId]/download/route';
import { requireRole } from '@/lib/guards';
import { assertCoachCanAccessStudent, CoachNotAssignedError } from '@/lib/rbac/coach-student-access';
import { prisma } from '@/lib/prisma';
import { processGeneratedReportJob } from '@/lib/reports/stage/processGeneratedReportJob';
import { readGeneratedReportPdf } from '@/lib/reports/stage/reportStorage';

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
    (prisma.generatedPedagogicalReport.findMany as jest.Mock).mockResolvedValue([
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

  it('does not expose internal generated report payloads in list responses', async () => {
    (requireRole as jest.Mock).mockResolvedValue({ user: { id: 'coach-user-1', role: 'COACH' } });
    (assertCoachCanAccessStudent as jest.Mock).mockResolvedValue(undefined);
    (prisma.generatedPedagogicalReport.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'report-1',
        kind: 'EAF_STAGE_POST',
        status: 'PDF_READY',
        contextJson: { private: true },
        llmJson: { raw: true },
        validatedJson: { internal: true },
        latexSource: '\\\\secret',
        pdfUrl: '/api/coach/students/student-1/generated-reports/report-1/download',
      },
    ]);
    (prisma.bilan.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.eafPreparationReport.findFirst as jest.Mock).mockResolvedValue(null);

    const res = await GET(new Request('http://localhost/'), params());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.reports[0]).not.toHaveProperty('contextJson');
    expect(body.reports[0]).not.toHaveProperty('llmJson');
    expect(body.reports[0]).not.toHaveProperty('validatedJson');
    expect(body.reports[0]).not.toHaveProperty('latexSource');
  });
});

describe('POST /api/coach/students/[studentId]/generated-reports/[reportId]/regenerate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects unsafe route params before checking coach assignment', async () => {
    (requireRole as jest.Mock).mockResolvedValue({ user: { id: 'coach-user-1', role: 'COACH' } });

    const res = await REGENERATE(new Request('http://localhost/', { method: 'POST' }), {
      params: Promise.resolve({ studentId: '../student', reportId: '../report' }),
    });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('Données');
    expect(assertCoachCanAccessStudent).not.toHaveBeenCalled();
    expect(processGeneratedReportJob).not.toHaveBeenCalled();
  });

  it('does not expose internal generated report payloads after regeneration', async () => {
    (requireRole as jest.Mock).mockResolvedValue({ user: { id: 'coach-user-1', role: 'COACH' } });
    (assertCoachCanAccessStudent as jest.Mock).mockResolvedValue(undefined);
    (processGeneratedReportJob as jest.Mock).mockResolvedValue({
      ok: true,
      report: {
        id: 'report-1',
        studentId: 'student-1',
        status: 'PDF_READY',
        contextJson: { private: true },
        llmJson: { raw: true },
        validatedJson: { internal: true },
        latexSource: '\\\\secret',
      },
    });

    const res = await REGENERATE(new Request('http://localhost/', { method: 'POST' }), {
      params: Promise.resolve({ studentId: 'student-1', reportId: 'report-1' }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.report).not.toHaveProperty('contextJson');
    expect(body.report).not.toHaveProperty('llmJson');
    expect(body.report).not.toHaveProperty('validatedJson');
    expect(body.report).not.toHaveProperty('latexSource');
  });
});

describe('GET /api/coach/students/[studentId]/generated-reports/[reportId]/download', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not read a PDF when reportId belongs to another student', async () => {
    (requireRole as jest.Mock).mockResolvedValue({ user: { id: 'coach-user-1', role: 'COACH' } });
    (assertCoachCanAccessStudent as jest.Mock).mockResolvedValue(undefined);
    (prisma.generatedPedagogicalReport.findUnique as jest.Mock).mockResolvedValue({
      id: 'report-1',
      studentId: 'other-student',
      status: 'PDF_READY',
    });

    const res = await DOWNLOAD(new Request('http://localhost/'), {
      params: Promise.resolve({ studentId: 'student-1', reportId: 'report-1' }),
    });

    expect(res.status).toBe(404);
    expect(readGeneratedReportPdf).not.toHaveBeenCalled();
  });
});
