/**
 * GET .../modules/[moduleKey] previously conflated canEditAudience (WRITE
 * permission) with READ visibility of `answers` — a COACH who can never
 * edit was wrongly assumed to never read either, even on the student's own
 * ELEVE-audience modules (their actual working material). Arbitrated
 * 2026-08-07: `answers` visibility now uses canViewModuleDetail, the same
 * single source of truth as staff-export and the root serializer.
 */

import { NextResponse } from 'next/server';

process.env.CANDIDATE_DIAGNOSTIC_ENABLED = 'true';

const mockRequireDiagnosticActor = jest.fn();
const mockGetDiagnosticForActor = jest.fn();

jest.mock('@/lib/diagnostics/candidat-libre/access.server', () => ({
  requireDiagnosticActor: (...args: unknown[]) => mockRequireDiagnosticActor(...args),
  getDiagnosticForActor: (...args: unknown[]) => mockGetDiagnosticForActor(...args),
  canViewModuleDetail: jest.requireActual('@/lib/diagnostics/candidat-libre/access.server').canViewModuleDetail,
}));

jest.mock('@/lib/guards', () => ({
  isErrorResponse: (value: unknown) => value instanceof NextResponse,
}));

import { GET as moduleGet } from '@/app/api/diagnostics/candidat-libre/[diagnosticId]/modules/[moduleKey]/route';

const paramsFor = (moduleKey: string) => ({ params: Promise.resolve({ diagnosticId: 'diag-1', moduleKey }) });
const req = () => new Request('http://localhost/api/diagnostics/candidat-libre/diag-1/modules/mathematiques');

const moduleRecord = (moduleKey: string, answers: Record<string, unknown>) => ({
  moduleKey,
  status: 'AUTO_SCORED',
  answers,
  currentQuestionIndex: 5,
  elapsedMs: 100,
  integrity: {},
  submittedAt: null,
  availableAt: null,
});

function diagnosticFixture() {
  return {
    modules: [
      moduleRecord('mathematiques', { q1: 'réponse élève' }),
      moduleRecord('questionnaire-parent', { q1: 'réponse confidentielle du parent' }),
    ],
  };
}

async function getModuleAs(role: string, moduleKey: string) {
  mockRequireDiagnosticActor.mockResolvedValue({ user: { id: `${role}-1`, role } });
  mockGetDiagnosticForActor.mockResolvedValue(diagnosticFixture());
  const response = await moduleGet(req(), paramsFor(moduleKey));
  return { response, body: await response.json() };
}

describe('GET modules/[moduleKey] — answers visibility uses canViewModuleDetail, not canEditAudience', () => {
  beforeEach(() => jest.clearAllMocks());

  it('COACH reads answers on the ELEVE-audience module (mathematiques) despite never being able to edit it', async () => {
    const { response, body } = await getModuleAs('COACH', 'mathematiques');
    expect(response.status).toBe(200);
    expect(body.module.answers).toEqual({ q1: 'réponse élève' });
  });

  it('COACH does not read answers on questionnaire-parent', async () => {
    const { response, body } = await getModuleAs('COACH', 'questionnaire-parent');
    expect(response.status).toBe(200);
    expect(body.module.answers).toBeUndefined();
  });

  it('ASSISTANTE does not read answers even though she can still edit (canEditAudience unchanged — flagged inconsistency, not fixed here)', async () => {
    const { response, body } = await getModuleAs('ASSISTANTE', 'mathematiques');
    expect(response.status).toBe(200);
    expect(body.module.answers).toBeUndefined();
  });

  it('ADMIN reads answers on both audiences', async () => {
    expect((await getModuleAs('ADMIN', 'mathematiques')).body.module.answers).toEqual({ q1: 'réponse élève' });
    expect((await getModuleAs('ADMIN', 'questionnaire-parent')).body.module.answers).toEqual({ q1: 'réponse confidentielle du parent' });
  });

  it('ELEVE reads their own module, not questionnaire-parent (403, unchanged cross-audience block)', async () => {
    expect((await getModuleAs('ELEVE', 'mathematiques')).body.module.answers).toEqual({ q1: 'réponse élève' });
    expect((await getModuleAs('ELEVE', 'questionnaire-parent')).response.status).toBe(403);
  });

  it('PARENT reads questionnaire-parent, not mathematiques (403, unchanged cross-audience block)', async () => {
    expect((await getModuleAs('PARENT', 'questionnaire-parent')).body.module.answers).toEqual({ q1: 'réponse confidentielle du parent' });
    expect((await getModuleAs('PARENT', 'mathematiques')).response.status).toBe(403);
  });
});
