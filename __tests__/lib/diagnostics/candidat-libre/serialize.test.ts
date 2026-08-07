jest.mock('server-only', () => ({}));

import { serializeCandidateDiagnostic } from '@/lib/diagnostics/candidat-libre/serialize.server';

function buildDiagnostic() {
  return {
    id: 'diag-1',
    diagnosticKey: 'BAC_GENERAL_CANDIDAT_INDIVIDUEL_2027',
    definitionVersion: '2026.08.05-v1',
    status: 'ACTIVE',
    targetSession: 2027,
    student: {
      id: 'student-1',
      school: 'Lycée Test',
      gradeLevel: 'TERMINALE',
      user: { firstName: 'A', lastName: 'B', email: 'a@b.test' },
    },
    modules: [
      {
        moduleKey: 'mathematiques',
        audience: 'ELEVE',
        status: 'AUTO_SCORED',
        currentQuestionIndex: 28,
        elapsedMs: 1000,
        definitionSnapshot: { questions: new Array(28) },
        submittedAt: new Date('2026-08-06T10:00:00Z'),
        startedAt: new Date('2026-08-06T09:00:00Z'),
        availableAt: null,
        autoScore: { points: 20, maxPoints: 28, percentage: 71.4, evidence: [{ questionId: 'math-01', status: 'CORRECT' }] },
        reviewSummary: 'Bon niveau global.',
      },
      {
        moduleKey: 'questionnaire-parent',
        audience: 'PARENT',
        status: 'AUTO_SCORED',
        currentQuestionIndex: 22,
        elapsedMs: 500,
        definitionSnapshot: { questions: new Array(22) },
        submittedAt: new Date('2026-08-06T11:00:00Z'),
        startedAt: new Date('2026-08-06T10:30:00Z'),
        availableAt: null,
        autoScore: { points: 15, maxPoints: 22, percentage: 68.2, evidence: [{ questionId: 'parent-01', status: 'CORRECT' }] },
        reviewSummary: 'Contexte familial favorable.',
      },
    ],
    documents: [],
    studentConsentAt: null,
    parentConsentAt: null,
    submittedAt: null,
    retentionDueAt: null,
    createdAt: new Date('2026-08-06T08:00:00Z'),
    updatedAt: new Date('2026-08-06T08:00:00Z'),
  };
}

describe('serializeCandidateDiagnostic — audience redaction', () => {
  it('hides the parent module score/review from an ELEVE viewer but keeps status visible', () => {
    const view = serializeCandidateDiagnostic(buildDiagnostic(), 'ELEVE');
    const parentModule = view.modules.find((m) => m.key === 'questionnaire-parent')!;
    const ownModule = view.modules.find((m) => m.key === 'mathematiques')!;

    expect(parentModule.autoScore).toBeNull();
    expect(parentModule.reviewSummary).toBeNull();
    expect(parentModule.status).toBe('AUTO_SCORED');
    expect(parentModule.submittedAt).not.toBeNull();

    expect(ownModule.autoScore).not.toBeNull();
    expect(ownModule.reviewSummary).not.toBeNull();
  });

  it('hides the student module score/review from a PARENT viewer but keeps status visible', () => {
    const view = serializeCandidateDiagnostic(buildDiagnostic(), 'PARENT');
    const studentModule = view.modules.find((m) => m.key === 'mathematiques')!;
    const ownModule = view.modules.find((m) => m.key === 'questionnaire-parent')!;

    expect(studentModule.autoScore).toBeNull();
    expect(studentModule.reviewSummary).toBeNull();
    expect(studentModule.status).toBe('AUTO_SCORED');

    expect(ownModule.autoScore).not.toBeNull();
    expect(ownModule.reviewSummary).not.toBeNull();
  });

  it('keeps full detail for staff viewers (COACH/ADMIN) and when no role is passed', () => {
    const staffView = serializeCandidateDiagnostic(buildDiagnostic(), 'COACH');
    expect(staffView.modules.every((m) => m.autoScore !== null)).toBe(true);

    const internalView = serializeCandidateDiagnostic(buildDiagnostic());
    expect(internalView.modules.every((m) => m.autoScore !== null)).toBe(true);
  });
});
