import {
  reportSubmissionSchema,
  sessionReportSchema,
  sessionReportWithIdSchema,
} from '@/lib/validation/session-report';

describe('validation session report', () => {
  const base = {
    summary: 'Résumé assez long pour valider.',
    topicsCovered: 'Algebre et equations',
    performanceRating: 4,
    progressNotes: 'Notes de progression suffisantes.',
    recommendations: 'Recommandations suffisantes.',
    attendance: true,
  };

  it('validates sessionReportSchema', () => {
    const res = sessionReportSchema.safeParse(base);
    expect(res.success).toBe(true);
  });

  it('validates reportSubmissionSchema', () => {
    const res = reportSubmissionSchema.safeParse(base);
    expect(res.success).toBe(true);
  });

  it('validates sessionReportWithIdSchema', () => {
    const res = sessionReportWithIdSchema.safeParse({
      ...base,
      id: 'ckx1a2b3c4d5e6f7g8h9i0j1',
      sessionId: 'ckx1a2b3c4d5e6f7g8h9i0j2',
      studentId: 'ckx1a2b3c4d5e6f7g8h9i0j3',
      coachId: 'ckx1a2b3c4d5e6f7g8h9i0j4',
      createdAt: '2026-02-01',
      updatedAt: '2026-02-02',
    });
    expect(res.success).toBe(true);
  });
});
