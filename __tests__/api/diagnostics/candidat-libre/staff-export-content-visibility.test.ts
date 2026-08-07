/**
 * A COACH is not the audience of the parent questionnaire (or of any
 * module's raw answers) — same rule GET .../modules/[moduleKey] already
 * enforces via canEditAudience. staff-export previously bypassed that rule
 * by treating COACH/ADMIN/ASSISTANTE as an undifferentiated "staff" block,
 * exposing every module's answers/autoScore/manualScore/reviewSummary
 * (including questionnaire-parent) to any assigned coach. This suite locks
 * the aligned behavior: ADMIN/ASSISTANTE keep full content, COACH gets
 * structure/status only, never content — for every module regardless of
 * audience.
 */

import { NextResponse } from 'next/server';

process.env.CANDIDATE_DIAGNOSTIC_ENABLED = 'true';

const mockRequireDiagnosticActor = jest.fn();
const mockGetDiagnosticForActor = jest.fn();

jest.mock('@/lib/diagnostics/candidat-libre/access.server', () => ({
  requireDiagnosticActor: (...args: unknown[]) => mockRequireDiagnosticActor(...args),
  getDiagnosticForActor: (...args: unknown[]) => mockGetDiagnosticForActor(...args),
  isDocumentVisibleToViewer: jest.requireActual('@/lib/diagnostics/candidat-libre/access.server').isDocumentVisibleToViewer,
  actorRole: jest.requireActual('@/lib/diagnostics/candidat-libre/access.server').actorRole,
}));

jest.mock('@/lib/guards', () => ({
  isErrorResponse: (value: unknown) => value instanceof NextResponse,
}));

import { GET as staffExportGet } from '@/app/api/diagnostics/candidat-libre/[diagnosticId]/staff-export/route';

const params = () => ({ params: Promise.resolve({ diagnosticId: 'diag-1' }) });
const req = () => new Request('http://localhost/api/diagnostics/candidat-libre/diag-1/staff-export');

const MODULE = {
  moduleKey: 'questionnaire-parent',
  audience: 'PARENT',
  status: 'REVIEWED',
  answers: { q1: 'réponse confidentielle du parent' },
  autoScore: { percentage: 80 },
  manualScore: null,
  integrity: {},
  elapsedMs: 1000,
  submittedAt: new Date('2026-08-01'),
  reviewSummary: { note: 'commentaire de relecture' },
  definitionSnapshot: { questions: [] },
};

const diagnosticFixture = () => ({
  id: 'diag-1',
  diagnosticKey: 'candidat-libre-2027',
  definitionVersion: 1,
  targetSession: 2027,
  status: 'IN_PROGRESS',
  student: {
    id: 'student-1',
    user: { firstName: 'A', lastName: 'B', email: 'a@b.test' },
    school: 'X',
    gradeLevel: 'TERMINALE',
  },
  modules: [{ ...MODULE }],
  documents: [],
  studentConsentAt: null,
  parentConsentAt: null,
  parentSubmittedAt: new Date('2026-08-01'),
  submittedAt: null,
});

describe('GET staff-export — content visibility aligned with modules/[moduleKey]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDiagnosticForActor.mockResolvedValue(diagnosticFixture());
  });

  it('withholds answers/autoScore/manualScore/reviewSummary from COACH on every module, including questionnaire-parent', async () => {
    mockRequireDiagnosticActor.mockResolvedValue({ user: { id: 'coach-1', role: 'COACH' } });

    const response = await staffExportGet(req(), params());
    const body = await response.json();

    expect(response.status).toBe(200);
    const module = body.diagnostic.modules[0];
    expect(module.moduleKey).toBe('questionnaire-parent');
    expect(module.status).toBe('REVIEWED');
    expect(module.answers).toBeUndefined();
    expect(module.autoScore).toBeUndefined();
    expect(module.manualScore).toBeUndefined();
    expect(module.reviewSummary).toBeUndefined();
  });

  it.each(['ADMIN', 'ASSISTANTE'])('keeps full content for %s', async (role) => {
    mockRequireDiagnosticActor.mockResolvedValue({ user: { id: 'staff-1', role } });

    const response = await staffExportGet(req(), params());
    const body = await response.json();

    const module = body.diagnostic.modules[0];
    expect(module.answers).toEqual(MODULE.answers);
    expect(module.autoScore).toEqual(MODULE.autoScore);
    expect(module.reviewSummary).toEqual(MODULE.reviewSummary);
  });
});
