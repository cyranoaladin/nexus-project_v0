import { publishReportRevision } from '@/lib/bilans/core/report-service';
import { BILAN_PDF_ENGINE_VERSION } from '@/lib/bilans/render/pdf';
import type { RenderIdentity } from '@/lib/bilans/render/render-identity';
import { renderDeterministicBilanHtml } from '@/lib/bilans/render/html';
import type { PublicationRenderer } from '@/lib/bilans/core/report-materialization';
import { ENTRY_RECIPE_FACT_SHEETS } from '@/__tests__/bilans/fixtures/recipe-fact-sheets';

const factSheet = ENTRY_RECIPE_FACT_SHEETS[0];
const identity: RenderIdentity = {
  displayName: factSheet.student.alias,
  level: factSheet.student.level,
  subject: 'MATHS',
  date: '2026-08-03',
  stageLabel: 'Stage de pré-rentrée — Entrée en Terminale, Mathématiques',
};

function revision(status = 'COACH_VALIDATED') {
  return {
    id: 'revision-1',
    status,
    validationFailures: [],
    content: { NEXUS: { identity } },
    materialization: null,
    scoreSnapshot: { result: factSheet },
    reviews: [{ id: 'review-1' }],
    reportArtifact: {
      id: 'artifact-1',
      status: 'PENDING_REVIEW',
      assessmentAttemptId: 'attempt-1',
      assessmentAttempt: { status: 'COACH_VALIDATED' },
      student: { user: { firstName: 'Élise', lastName: 'Ben Salah' } },
    },
  };
}

function harness(transactionRevision = revision()) {
  const events: string[] = [];
  const reportMaterializationCreate = jest.fn(async () => ({ id: 'materialization-1' }));
  const transaction = {
    reportRevision: { findUnique: jest.fn(async () => transactionRevision) },
    reportReview: { findFirst: jest.fn(async () => ({ id: 'review-1' })) },
    reportMaterialization: { create: reportMaterializationCreate },
    reportArtifact: { updateMany: jest.fn(async () => ({ count: 1 })) },
    canonicalAssessmentAttempt: { updateMany: jest.fn(async () => ({ count: 1 })) },
  };
  const prisma = {
    reportRevision: { findUnique: jest.fn(async () => revision()) },
    $transaction: jest.fn(async (operation: (tx: typeof transaction) => Promise<unknown>) => {
      events.push('transaction');
      return operation(transaction);
    }),
  };
  const renderAudience = jest.fn<ReturnType<PublicationRenderer>, Parameters<PublicationRenderer>>(async (
    sheet,
    audience,
    renderIdentity,
    options,
  ) => {
    events.push(`render:${audience}`);
    return {
      status: 'AVAILABLE' as const,
      html: renderDeterministicBilanHtml(sheet, audience, renderIdentity, options?.humanIdentity),
      pdf: Buffer.from(`%PDF-1.4 ${audience}`),
      engineVersion: BILAN_PDF_ENGINE_VERSION,
    };
  });
  return { events, prisma, transaction, reportMaterializationCreate, renderAudience };
}

describe('A90.3 atomic materialized publication', () => {
  test('renders all audiences before opening the short publication transaction', async () => {
    const value = harness();
    await publishReportRevision({
      prisma: value.prisma as never,
      revisionId: 'revision-1',
      reviewerId: 'reviewer-1',
      publishedAt: new Date('2026-08-03T12:00:00.000Z'),
      renderAudience: value.renderAudience,
    });
    expect(value.events).toEqual(['render:ELEVE', 'render:PARENTS', 'render:NEXUS', 'transaction']);
    expect(value.reportMaterializationCreate).toHaveBeenCalledTimes(1);
  });

  test('HTML failure opens no transaction and publishes nothing', async () => {
    const value = harness();
    await expect(publishReportRevision({
      prisma: value.prisma as never,
      revisionId: 'revision-1',
      reviewerId: 'reviewer-1',
      publishedAt: new Date('2026-08-03T12:00:00.000Z'),
      renderAudience: async () => { throw new Error('HTML_FAILED'); },
    })).rejects.toMatchObject({ code: 'REPORT_HTML_RENDER_FAILED' });
    expect(value.prisma.$transaction).not.toHaveBeenCalled();
    expect(value.reportMaterializationCreate).not.toHaveBeenCalled();
  });

  test('refuses a missing human identity before opening the publication transaction', async () => {
    const value = harness();
    (value.prisma.reportRevision.findUnique as jest.Mock).mockResolvedValue({
      ...revision(),
      reportArtifact: {
        ...revision().reportArtifact,
        student: { user: { firstName: null, lastName: null } },
      },
    });

    await expect(publishReportRevision({
      prisma: value.prisma as never,
      revisionId: 'revision-1',
      reviewerId: 'reviewer-1',
      publishedAt: new Date('2026-08-03T12:00:00.000Z'),
      renderAudience: value.renderAudience,
    })).rejects.toMatchObject({ code: 'REPORT_STUDENT_IDENTITY_REQUIRED' });

    expect(value.renderAudience).not.toHaveBeenCalled();
    expect(value.prisma.$transaction).not.toHaveBeenCalled();
  });

  test('accepts an existing approved review when another assistante retries publication', async () => {
    const value = harness();

    await publishReportRevision({
      prisma: value.prisma as never,
      revisionId: 'revision-1',
      reviewerId: 'second-assistante',
      publishedAt: new Date('2026-08-03T12:00:00.000Z'),
      renderAudience: value.renderAudience,
    });

    const candidateQuery = (value.prisma.reportRevision.findUnique as jest.Mock).mock.calls[0][0];
    expect(candidateQuery.select.reviews.where).toEqual({ decision: 'APPROVED' });
    expect(value.transaction.reportReview.findFirst).toHaveBeenCalledWith({
      where: { reportRevisionId: 'revision-1', decision: 'APPROVED' },
      select: { id: true },
    });
    expect(value.reportMaterializationCreate).toHaveBeenCalledTimes(1);
  });

  test('concurrent rejection after rendering inserts no artifact and does not publish', async () => {
    const value = harness(revision('REJECTED'));
    await expect(publishReportRevision({
      prisma: value.prisma as never,
      revisionId: 'revision-1',
      reviewerId: 'reviewer-1',
      publishedAt: new Date('2026-08-03T12:00:00.000Z'),
      renderAudience: value.renderAudience,
    })).rejects.toThrow('REPORT_NOT_COACH_VALIDATED');
    expect(value.reportMaterializationCreate).not.toHaveBeenCalled();
    expect(value.transaction.reportArtifact.updateMany).not.toHaveBeenCalled();
  });
});
