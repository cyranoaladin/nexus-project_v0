import { publishReportRevision } from '@/lib/bilans/core/report-service';
import { BILAN_PDF_ENGINE_VERSION } from '@/lib/bilans/render/pdf';
import type { RenderIdentity } from '@/lib/bilans/render/render-identity';
import { renderDeterministicBilanHtml } from '@/lib/bilans/render/html';
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
  const renderAudience = jest.fn(async (...args: Parameters<typeof renderDeterministicBilanHtml>) => {
    events.push(`render:${args[1]}`);
    return {
      status: 'AVAILABLE' as const,
      html: renderDeterministicBilanHtml(...args),
      pdf: Buffer.from(`%PDF-1.4 ${args[1]}`),
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
      coachId: 'coach-1',
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
      coachId: 'coach-1',
      publishedAt: new Date('2026-08-03T12:00:00.000Z'),
      renderAudience: async () => { throw new Error('HTML_FAILED'); },
    })).rejects.toMatchObject({ code: 'REPORT_HTML_RENDER_FAILED' });
    expect(value.prisma.$transaction).not.toHaveBeenCalled();
    expect(value.reportMaterializationCreate).not.toHaveBeenCalled();
  });

  test('concurrent rejection after rendering inserts no artifact and does not publish', async () => {
    const value = harness(revision('REJECTED'));
    await expect(publishReportRevision({
      prisma: value.prisma as never,
      revisionId: 'revision-1',
      coachId: 'coach-1',
      publishedAt: new Date('2026-08-03T12:00:00.000Z'),
      renderAudience: value.renderAudience,
    })).rejects.toThrow('REPORT_NOT_COACH_VALIDATED');
    expect(value.reportMaterializationCreate).not.toHaveBeenCalled();
    expect(value.transaction.reportArtifact.updateMany).not.toHaveBeenCalled();
  });
});
