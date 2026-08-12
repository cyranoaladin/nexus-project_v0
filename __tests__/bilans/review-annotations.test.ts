import {
  REPORT_ANNOTATION_SECTIONS,
  requestReportCorrection,
  resumeReportReview,
} from '@/lib/bilans/core/report-service';

/**
 * « Correction demandée » — invariants :
 * - la revue CHANGES_REQUESTED et ses annotations naissent dans la même
 *   transaction que le changement d'état ;
 * - annotations = métadonnées de revue : AUCUNE écriture sur le snapshot de
 *   score, les banques ou le contenu de la révision ;
 * - la reprise trace son motif dans l'historique, jamais par écrasement.
 */

type WriteLog = string[];

function harness(revisionStatus = 'PENDING_REVIEW') {
  const writes: WriteLog = [];
  const transaction = {
    reportRevision: {
      findUnique: jest.fn(async () => ({
        id: 'revision-1',
        status: revisionStatus,
        validationFailures: [],
        reportArtifact: { id: 'artifact-1', assessmentAttemptId: 'attempt-1', status: 'PENDING_REVIEW' },
        reviews: [{ id: 'review-cr' }],
      })),
      updateMany: jest.fn(async (args: { where: { status: string } }) => {
        writes.push(`reportRevision.updateMany:${args.where.status}`);
        return { count: 1 };
      }),
    },
    reportReview: {
      create: jest.fn(async (args: { data: { decision: string } }) => {
        writes.push(`reportReview.create:${args.data.decision}`);
        return { id: 'review-1' };
      }),
    },
    reportReviewAnnotation: {
      create: jest.fn(async () => {
        writes.push('reportReviewAnnotation.create');
        return { id: 'annotation-1' };
      }),
    },
    scoreSnapshot: {
      update: jest.fn(async () => { writes.push('scoreSnapshot.update'); }),
      updateMany: jest.fn(async () => { writes.push('scoreSnapshot.updateMany'); }),
    },
  };
  const prisma = {
    $transaction: jest.fn(async (callback: (t: typeof transaction) => Promise<unknown>) => callback(transaction)),
  };
  return { prisma, transaction, writes };
}

const baseInput = {
  revisionId: 'revision-1',
  reviewerId: 'assistante-1',
  motif: 'Reformuler la deuxième priorité du bilan élève.',
  reviewedAt: new Date('2026-08-12T10:00:00Z'),
};

const annotation = {
  audience: 'ELEVE' as const,
  section: 'priorites' as const,
  remark: 'La formulation de la priorité no 2 est trop abrupte pour cet élève.',
};

describe('requestReportCorrection', () => {
  it('crée la revue CHANGES_REQUESTED, ses annotations et le nouvel état, en une transaction', async () => {
    const { prisma, transaction } = harness();
    const result = await requestReportCorrection({
      prisma: prisma as never,
      ...baseInput,
      annotations: [annotation],
    });
    expect(result).toEqual({ revisionId: 'revision-1', reviewId: 'review-1', status: 'CORRECTION_REQUESTED' });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    const createArgs = (transaction.reportReview.create as jest.Mock).mock.calls[0][0];
    expect(createArgs.data.decision).toBe('CHANGES_REQUESTED');
    expect(createArgs.data.annotations.create).toEqual([
      { audience: 'ELEVE', section: 'priorites', remark: annotation.remark },
    ]);
    const updateArgs = (transaction.reportRevision.updateMany as jest.Mock).mock.calls[0][0];
    expect(updateArgs.where).toEqual({ id: 'revision-1', status: 'PENDING_REVIEW' });
    expect(updateArgs.data).toEqual({ status: 'CORRECTION_REQUESTED' });
  });

  it('ne touche jamais au snapshot de score ni au contenu de la révision', async () => {
    const { prisma, transaction, writes } = harness();
    await requestReportCorrection({ prisma: prisma as never, ...baseInput, annotations: [annotation] });
    expect(writes).not.toContain('scoreSnapshot.update');
    expect(writes).not.toContain('scoreSnapshot.updateMany');
    const updateArgs = (transaction.reportRevision.updateMany as jest.Mock).mock.calls[0][0];
    expect(Object.keys(updateArgs.data)).toEqual(['status']);
  });

  it('refuse une demande sans annotation', async () => {
    const { prisma } = harness();
    await expect(requestReportCorrection({ prisma: prisma as never, ...baseInput, annotations: [] }))
      .rejects.toMatchObject({ code: 'REPORT_ANNOTATION_REQUIRED' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('refuse une section hors vocabulaire et une remarque vide', async () => {
    const { prisma } = harness();
    await expect(requestReportCorrection({
      prisma: prisma as never,
      ...baseInput,
      annotations: [{ ...annotation, section: 'section-inventee' as never }],
    })).rejects.toMatchObject({ code: 'REPORT_ANNOTATION_SECTION_UNKNOWN' });
    await expect(requestReportCorrection({
      prisma: prisma as never,
      ...baseInput,
      annotations: [{ ...annotation, remark: '   ' }],
    })).rejects.toMatchObject({ code: 'REPORT_ANNOTATION_REMARK_INVALID' });
  });

  it('refuse une révision qui n’est pas en attente de revue', async () => {
    const { prisma } = harness('COACH_VALIDATED');
    await expect(requestReportCorrection({ prisma: prisma as never, ...baseInput, annotations: [annotation] }))
      .rejects.toMatchObject({ code: 'REPORT_NOT_PENDING_REVIEW' });
  });

  it('le vocabulaire des sections couvre les sections réelles du bilan', () => {
    for (const section of ['forces', 'priorites', 'plan-action', 'detail-reponses', 'calibration']) {
      expect(REPORT_ANNOTATION_SECTIONS).toContain(section);
    }
  });
});

describe('resumeReportReview', () => {
  it('revient en revue en traçant la reprise comme annotation, jamais par écrasement', async () => {
    const { prisma, transaction } = harness('CORRECTION_REQUESTED');
    const result = await resumeReportReview({ prisma: prisma as never, ...baseInput, motif: 'Correction apportée : priorité reformulée.' });
    expect(result).toEqual({ revisionId: 'revision-1', status: 'PENDING_REVIEW' });
    const annotationArgs = (transaction.reportReviewAnnotation.create as jest.Mock).mock.calls[0][0];
    expect(annotationArgs.data).toMatchObject({
      reportReviewId: 'review-cr',
      audience: 'NEXUS',
      section: 'reprise-de-revue',
    });
    const updateArgs = (transaction.reportRevision.updateMany as jest.Mock).mock.calls[0][0];
    expect(updateArgs.where).toEqual({ id: 'revision-1', status: 'CORRECTION_REQUESTED' });
    expect(updateArgs.data).toEqual({ status: 'PENDING_REVIEW' });
  });

  it('refuse la reprise d’une révision qui n’est pas en correction demandée', async () => {
    const { prisma } = harness('PENDING_REVIEW');
    await expect(resumeReportReview({ prisma: prisma as never, ...baseInput }))
      .rejects.toMatchObject({ code: 'REPORT_NOT_CORRECTION_REQUESTED' });
  });
});
