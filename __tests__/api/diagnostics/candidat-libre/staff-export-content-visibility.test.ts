/**
 * Read-visibility matrix for staff-export, arbitrated 2026-08-07: COACH is
 * not the audience of questionnaire-parent (a confidential family
 * instrument) but IS the audience of the student's own ELEVE-audience
 * modules (their working material for coaching) — canEditAudience
 * (modules/[moduleKey]) governs WRITE only and was previously
 * mis-generalized to READ, producing a false parallel. ASSISTANTE gets no
 * academic detail anywhere (logistics role, least privilege on a minor's
 * data) — a stricter default than the original "staff sees everything"
 * this route shipped with. ADMIN keeps full access, including
 * questionnaire-parent (pedagogical direction, where the confidential
 * family instrument is meant to land) and gets the full synthesis;
 * ASSISTANTE gets none.
 */

import { NextResponse } from 'next/server';

process.env.CANDIDATE_DIAGNOSTIC_ENABLED = 'true';

const mockRequireDiagnosticActor = jest.fn();
const mockGetDiagnosticForActor = jest.fn();

jest.mock('@/lib/diagnostics/candidat-libre/access.server', () => ({
  requireDiagnosticActor: (...args: unknown[]) => mockRequireDiagnosticActor(...args),
  getDiagnosticForActor: (...args: unknown[]) => mockGetDiagnosticForActor(...args),
  isDocumentVisibleToViewer: jest.requireActual('@/lib/diagnostics/candidat-libre/access.server').isDocumentVisibleToViewer,
  canViewModuleDetail: jest.requireActual('@/lib/diagnostics/candidat-libre/access.server').canViewModuleDetail,
}));

jest.mock('@/lib/guards', () => ({
  isErrorResponse: (value: unknown) => value instanceof NextResponse,
}));

import { GET as staffExportGet } from '@/app/api/diagnostics/candidat-libre/[diagnosticId]/staff-export/route';

const params = () => ({ params: Promise.resolve({ diagnosticId: 'diag-1' }) });
const req = () => new Request('http://localhost/api/diagnostics/candidat-libre/diag-1/staff-export');

const ELEVE_MODULE = {
  moduleKey: 'mathematiques',
  audience: 'ELEVE',
  status: 'REVIEWED',
  answers: { q1: 'réponse élève' },
  autoScore: { percentage: 70 },
  manualScore: null,
  integrity: {},
  elapsedMs: 500,
  submittedAt: new Date('2026-08-01'),
  reviewSummary: { note: 'bon niveau' },
  definitionSnapshot: { questions: [] },
};

const PARENT_MODULE = {
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

const WRITTEN_COPY_DOC = {
  id: 'doc-1',
  category: 'WRITTEN_COPY',
  title: 'Copie maths',
  originalName: 'copie.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 1000,
  sha256: 'abc',
  status: 'ACCEPTED',
  reviewNote: null,
  createdAt: new Date('2026-08-01'),
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
  modules: [{ ...ELEVE_MODULE }, { ...PARENT_MODULE }],
  documents: [{ ...WRITTEN_COPY_DOC }],
  studentConsentAt: null,
  parentConsentAt: null,
  parentSubmittedAt: new Date('2026-08-01'),
  submittedAt: null,
});

async function getAs(role: string) {
  mockRequireDiagnosticActor.mockResolvedValue({ user: { id: `${role}-1`, role } });
  mockGetDiagnosticForActor.mockResolvedValue(diagnosticFixture());
  const response = await staffExportGet(req(), params());
  return { response, body: await response.json() };
}

function moduleByKey(body: any, key: string) {
  return body.diagnostic.modules.find((m: any) => m.moduleKey === key);
}

describe('GET staff-export — read-visibility matrix (arbitrated 2026-08-07)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('COACH sees content on the ELEVE-audience module but not on questionnaire-parent', async () => {
    const { response, body } = await getAs('COACH');
    expect(response.status).toBe(200);

    const eleveModule = moduleByKey(body, 'mathematiques');
    expect(eleveModule.answers).toEqual(ELEVE_MODULE.answers);
    expect(eleveModule.autoScore).toEqual(ELEVE_MODULE.autoScore);
    expect(eleveModule.reviewSummary).toEqual(ELEVE_MODULE.reviewSummary);

    const parentModule = moduleByKey(body, 'questionnaire-parent');
    expect(parentModule.status).toBe('REVIEWED');
    expect(parentModule.answers).toBeUndefined();
    expect(parentModule.autoScore).toBeUndefined();
    expect(parentModule.manualScore).toBeUndefined();
    expect(parentModule.reviewSummary).toBeUndefined();

    expect(body.diagnostic.documents).toHaveLength(1);
    expect(body.synthesis).not.toBeNull();
  });

  it('ADMIN sees full content on both modules, including questionnaire-parent', async () => {
    const { body } = await getAs('ADMIN');
    expect(moduleByKey(body, 'mathematiques').answers).toEqual(ELEVE_MODULE.answers);
    expect(moduleByKey(body, 'questionnaire-parent').answers).toEqual(PARENT_MODULE.answers);
    expect(body.diagnostic.documents).toHaveLength(1);
    expect(body.synthesis).not.toBeNull();
  });

  it('ASSISTANTE sees no academic detail on any module, no student productions, and no synthesis', async () => {
    const { response, body } = await getAs('ASSISTANTE');
    expect(response.status).toBe(200);

    const eleveModule = moduleByKey(body, 'mathematiques');
    expect(eleveModule.answers).toBeUndefined();
    expect(eleveModule.autoScore).toBeUndefined();
    expect(eleveModule.reviewSummary).toBeUndefined();

    const parentModule = moduleByKey(body, 'questionnaire-parent');
    expect(parentModule.answers).toBeUndefined();
    expect(parentModule.autoScore).toBeUndefined();
    expect(parentModule.reviewSummary).toBeUndefined();

    expect(body.diagnostic.documents).toHaveLength(0);
    expect(body.synthesis).toBeNull();
  });
});
