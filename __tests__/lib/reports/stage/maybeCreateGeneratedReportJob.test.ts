jest.mock('@/lib/prisma', () => ({
  prisma: {
    bilan: { findFirst: jest.fn() },
    eafPreparationReport: { findFirst: jest.fn() },
    generatedPedagogicalReport: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';
import { maybeCreateGeneratedReportJob } from '@/lib/reports/stage/maybeCreateGeneratedReportJob';

const completedStudentBilan = {
  id: 'bilan-1',
  type: 'STAGE_POST',
  status: 'COMPLETED',
  subject: 'FRANCAIS',
  updatedAt: new Date('2026-05-01T10:00:00.000Z'),
  sourceData: {
    answers: {
      profile: {},
      beforeStage: {},
      examMethod: {},
      commentary: {},
      dissertation: {},
      writing: {},
      support: {},
      finalReview: {},
    },
  },
};

const validatedCoachReport = {
  id: 'coach-report-1',
  coachId: 'coach-1',
  status: 'VALIDATED',
  updatedAt: new Date('2026-05-01T11:00:00.000Z'),
  writingMethod: 'ok',
  languageMastery: 'ok',
  literaryCulture: 'ok',
  strengths: 'ok',
  areasToImprove: 'ok',
  nextSessionGoals: 'ok',
  coachFreeComment: 'ok',
};

describe('maybeCreateGeneratedReportJob', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('waits for a completed student bilan', async () => {
    (prisma.bilan.findFirst as jest.Mock).mockResolvedValue(null);

    const result = await maybeCreateGeneratedReportJob({
      studentId: 'student-1',
      subject: 'FRANCAIS',
      kind: 'EAF_STAGE_POST',
      stageSlug: 'stage-printemps-2026',
    });

    expect(result).toEqual({ created: false, reason: 'WAITING_FOR_STUDENT_BILAN' });
  });

  it('waits for a validated complete coach report', async () => {
    (prisma.bilan.findFirst as jest.Mock).mockResolvedValue(completedStudentBilan);
    (prisma.eafPreparationReport.findFirst as jest.Mock).mockResolvedValue(null);

    const result = await maybeCreateGeneratedReportJob({
      studentId: 'student-1',
      subject: 'FRANCAIS',
      kind: 'EAF_STAGE_POST',
      stageSlug: 'stage-printemps-2026',
    });

    expect(result).toEqual({ created: false, reason: 'WAITING_FOR_COACH_REPORT' });
  });

  it('creates a job when both inputs are ready', async () => {
    (prisma.bilan.findFirst as jest.Mock).mockResolvedValue(completedStudentBilan);
    (prisma.eafPreparationReport.findFirst as jest.Mock).mockResolvedValue(validatedCoachReport);
    (prisma.generatedPedagogicalReport.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.generatedPedagogicalReport.create as jest.Mock).mockResolvedValue({ id: 'report-1' });

    const result = await maybeCreateGeneratedReportJob({
      studentId: 'student-1',
      subject: 'FRANCAIS',
      kind: 'EAF_STAGE_POST',
      stageSlug: 'stage-printemps-2026',
    });

    expect(result).toEqual({ created: true, reportId: 'report-1' });
    expect(prisma.generatedPedagogicalReport.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          studentId: 'student-1',
          coachId: 'coach-1',
          kind: 'EAF_STAGE_POST',
          status: 'PENDING',
        }),
      }),
    );
  });

  it('does not create a duplicate for the same checksum', async () => {
    (prisma.bilan.findFirst as jest.Mock).mockResolvedValue(completedStudentBilan);
    (prisma.eafPreparationReport.findFirst as jest.Mock).mockResolvedValue(validatedCoachReport);
    (prisma.generatedPedagogicalReport.findUnique as jest.Mock).mockResolvedValue({ id: 'existing-report' });

    const result = await maybeCreateGeneratedReportJob({
      studentId: 'student-1',
      subject: 'FRANCAIS',
      kind: 'EAF_STAGE_POST',
      stageSlug: 'stage-printemps-2026',
    });

    expect(result).toEqual({ created: false, reason: 'ALREADY_EXISTS', reportId: 'existing-report' });
    expect(prisma.generatedPedagogicalReport.create).not.toHaveBeenCalled();
  });
});
