/**
 * API tests for /api/assistante/candidat-individuel/** (mission recâblage
 * §5) — role gate (ADMIN/ASSISTANTE) AND feature-flag gate
 * (pricing.candidatIndividuelPipeline.state >= ACTIVE_INTERNAL) on every
 * route, request-body validation, and the happy path through the mocked
 * persistence layer. The simulate route calls the real
 * buildCandidateQuoteRecommendation (pure, no DB) rather than mocking it —
 * a genuine wiring check, not just a mock-returns-what-I-told-it check.
 */
import { NextRequest, NextResponse } from 'next/server';
import { _resetForTest, _setForTest } from '@/lib/config/snapshot';

let authResult: { user: { id: string; role: string; email: string } } | 'FORBIDDEN' = {
  user: { id: 'staff-1', role: 'ASSISTANTE', email: 'staff@test.com' },
};
const mockRequireAnyRole = jest.fn(async (allowedRoles: string[]) => {
  if (authResult === 'FORBIDDEN' || !allowedRoles.includes(authResult.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return authResult;
});

jest.mock('@/lib/guards', () => {
  return {
    requireAnyRole: (...args: [string[]]) => mockRequireAnyRole(...args),
    isErrorResponse: (r: unknown) => {
      if (typeof r !== 'object' || r === null) return false;
      const x = r as { json?: unknown; status?: unknown };
      return typeof x.json === 'function' && 'status' in (r as object);
    },
  };
});

const mockCreate = jest.fn();
const mockUpdate = jest.fn();
const mockGet = jest.fn();
const mockList = jest.fn();
const mockReview = jest.fn();
const mockRevision = jest.fn();
const mockStaffProfile = jest.fn();
const mockStaffProfileList = jest.fn();
const mockStaffQuote = jest.fn();
const mockStaffQuoteByKey = jest.fn();

jest.mock('@/lib/quotes/profil-candidat.server', () => ({
  createProfilCandidat: (...args: unknown[]) => mockCreate(...args),
  updateProfilCandidat: (...args: unknown[]) => mockUpdate(...args),
  getProfilCandidat: (...args: unknown[]) => mockGet(...args),
  // T5R5 §FINDING_11 — GET /profils/:id now reads through this identity-
  // enriched variant instead; same mock backs both.
  getProfilCandidatWithIdentity: (...args: unknown[]) => mockGet(...args),
  listProfilsCandidats: (...args: unknown[]) => mockList(...args),
  requestProfilCandidatReview: (...args: unknown[]) => mockReview(...args),
  createProfilCandidatRevision: (...args: unknown[]) => mockRevision(...args),
}));

jest.mock('@/lib/quotes/candidat-individuel-staff-view.server', () => ({
  getCandidatIndividuelStaffProfileView: (...args: unknown[]) => mockStaffProfile(...args),
  listCandidatIndividuelStaffProfileViews: (...args: unknown[]) => mockStaffProfileList(...args),
  getCandidatIndividuelStaffQuoteView: (...args: unknown[]) => mockStaffQuote(...args),
  getCandidatIndividuelStaffQuoteViewByIdempotencyKey: (...args: unknown[]) => mockStaffQuoteByKey(...args),
}));

import { POST as createProfilPOST, GET as listProfilsGET } from '@/app/api/assistante/candidat-individuel/profils/route';
import { GET as getProfilGET, PATCH as updateProfilPATCH } from '@/app/api/assistante/candidat-individuel/profils/[id]/route';
import { POST as reviewPOST } from '@/app/api/assistante/candidat-individuel/profils/[id]/review/route';
import { POST as revisionPOST } from '@/app/api/assistante/candidat-individuel/profils/[id]/revision/route';
import { POST as createQuotePOST } from '@/app/api/assistante/candidat-individuel/profils/[id]/quote/route';
import { POST as reconcileQuotePOST } from '@/app/api/assistante/candidat-individuel/profils/[id]/quote/reconcile/route';
import { POST as simulatePOST } from '@/app/api/assistante/candidat-individuel/simulate/route';
import { POST as publishQuotePOST } from '@/app/api/assistante/candidat-individuel/quotes/[quoteId]/publish/route';
import { POST as createFamilyLinkPOST } from '@/app/api/assistante/candidat-individuel/quotes/[quoteId]/family-link/route';
import { GET as quotePdfGET } from '@/app/api/assistante/candidat-individuel/quotes/[quoteId]/pdf/route';

const VALID_PUBLIC_INPUT = {
  level: 'TERMINALE',
  examSession: 2027,
  modalite: 'A',
  specialite1: 'MATHEMATIQUES',
  specialite2: 'PHYSIQUE_CHIMIE',
};

function req(body: unknown, url = 'http://localhost/api/assistante/candidat-individuel/profils', method = 'POST') {
  return new NextRequest(url, { method, body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
}

function candidateStaffEndpointCalls() {
  const profilParams = { params: Promise.resolve({ id: 'profil-1' }) };
  const quoteParams = { params: Promise.resolve({ quoteId: 'quote-1' }) };

  return [
    { label: 'POST /profils', invoke: () => createProfilPOST(req({ publicInput: VALID_PUBLIC_INPUT })) },
    { label: 'GET /profils', invoke: () => listProfilsGET(new NextRequest('http://localhost/api/assistante/candidat-individuel/profils')) },
    { label: 'GET /profils/:id', invoke: () => getProfilGET(new NextRequest('http://localhost/api/assistante/candidat-individuel/profils/profil-1'), profilParams) },
    { label: 'PATCH /profils/:id', invoke: () => updateProfilPATCH(req({ publicInput: VALID_PUBLIC_INPUT }, 'http://localhost/api/assistante/candidat-individuel/profils/profil-1', 'PATCH'), profilParams) },
    { label: 'POST /profils/:id/review', invoke: () => reviewPOST(req({ note: 'review' }, 'http://localhost/api/assistante/candidat-individuel/profils/profil-1/review'), profilParams) },
    { label: 'POST /profils/:id/revision', invoke: () => revisionPOST(new NextRequest('http://localhost/api/assistante/candidat-individuel/profils/profil-1/revision', { method: 'POST' }), profilParams) },
    { label: 'POST /profils/:id/quote', invoke: () => createQuotePOST(req({}, 'http://localhost/api/assistante/candidat-individuel/profils/profil-1/quote'), profilParams) },
    { label: 'POST /profils/:id/quote/reconcile', invoke: () => reconcileQuotePOST(req({ idempotencyKey: 'attempt-key' }, 'http://localhost/api/assistante/candidat-individuel/profils/profil-1/quote/reconcile'), profilParams) },
    { label: 'POST /simulate', invoke: () => simulatePOST(req({ publicInput: VALID_PUBLIC_INPUT, budget: { monthlyBudgetTnd: 2000, strategy: 'MOST_COMPLETE' } }, 'http://localhost/api/assistante/candidat-individuel/simulate')) },
    { label: 'POST /quotes/:quoteId/publish', invoke: () => publishQuotePOST(new NextRequest('http://localhost/api/assistante/candidat-individuel/quotes/quote-1/publish', { method: 'POST' }), quoteParams) },
    { label: 'POST /quotes/:quoteId/family-link', invoke: () => createFamilyLinkPOST(new NextRequest('http://localhost/api/assistante/candidat-individuel/quotes/quote-1/family-link', { method: 'POST' }), quoteParams) },
    { label: 'GET /quotes/:quoteId/pdf', invoke: () => quotePdfGET(new NextRequest('http://localhost/api/assistante/candidat-individuel/quotes/quote-1/pdf'), quoteParams) },
  ];
}

function activatePipeline() {
  _setForTest([
    { namespace: 'pricing.candidatIndividuelPipeline', key: 'state', value: 'ACTIVE_INTERNAL', schemaVersion: '1.0', version: 1, updatedBy: 'test', updatedAt: new Date() },
  ]);
}

function expectExactStaffAllowlist() {
  expect(mockRequireAnyRole).toHaveBeenCalledTimes(1);
  expect(mockRequireAnyRole).toHaveBeenCalledWith(['ADMIN', 'ASSISTANTE']);
}

beforeEach(() => {
  _resetForTest(); // flag defaults OFF
  authResult = { user: { id: 'staff-1', role: 'ASSISTANTE', email: 'staff@test.com' } };
  jest.clearAllMocks();
});

describe('every route — flag OFF (default) blocks even a valid ADMIN/ASSISTANTE session', () => {
  test.each(candidateStaffEndpointCalls())('$label -> 403', async ({ invoke }) => {
    const res = await invoke();
    expect(res.status).toBe(403);
    expectExactStaffAllowlist();
  });
});

describe('every route — non ADMIN/ASSISTANTE role is rejected even with the flag active', () => {
  beforeEach(() => {
    activatePipeline();
    authResult = 'FORBIDDEN';
  });

  test.each(candidateStaffEndpointCalls())('$label -> 403', async ({ invoke }) => {
    const res = await invoke();
    expect(res.status).toBe(403);
    expectExactStaffAllowlist();
  });
});

describe.each(['ADMIN', 'ASSISTANTE'] as const)('allowed staff role — %s', (role) => {
  beforeEach(() => {
    activatePipeline();
    authResult = { user: { id: `staff-${role.toLowerCase()}`, role, email: `${role.toLowerCase()}@test.com` } };
  });

  test('GET /profils passes the exact role gate', async () => {
    mockStaffProfileList.mockResolvedValue([]);

    const res = await listProfilsGET(new NextRequest('http://localhost/api/assistante/candidat-individuel/profils'));

    expect(res.status).toBe(200);
    expectExactStaffAllowlist();
  });
});

describe('POST /profils — create a draft', () => {
  beforeEach(() => activatePipeline());

  test('400 on malformed body', async () => {
    const res = await createProfilPOST(req({ publicInput: { level: 123 } }));
    expect(res.status).toBe(400);
  });

  test('201 on success, forwards session.user.id as createdByUserId', async () => {
    mockCreate.mockResolvedValue({ ok: true, profil: { id: 'p1' } });
    const res = await createProfilPOST(req({ publicInput: VALID_PUBLIC_INPUT }));
    expect(res.status).toBe(201);
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ publicInput: expect.objectContaining(VALID_PUBLIC_INPUT) }), 'staff-1');
  });

  test('accepts the responsible and student IDs returned by the staff searches', async () => {
    mockCreate.mockResolvedValue({ ok: true, profil: { id: 'p-with-identity' } });
    const res = await createProfilPOST(req({
      contactLeadId: 'lead-from-search',
      studentId: 'student-from-search',
      publicInput: VALID_PUBLIC_INPUT,
    }));

    expect(res.status).toBe(201);
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      contactLeadId: 'lead-from-search',
      studentId: 'student-from-search',
    }), 'staff-1');
  });

  test('422 when the service reports an incomplete profil', async () => {
    mockCreate.mockResolvedValue({ ok: false, unresolvedFields: ['specialite1'], missingRequiredFields: [] });
    const res = await createProfilPOST(req({ publicInput: VALID_PUBLIC_INPUT }));
    expect(res.status).toBe(422);
  });

  test.each([
    ['MISSING_IDENTITY', 'Sélectionnez un responsable et un élève.'],
    ['CONTACT_LEAD_NOT_FOUND', 'Le responsable sélectionné est introuvable.'],
    ['STUDENT_NOT_FOUND', "L'élève sélectionné est introuvable."],
    ['RESPONSIBLE_UNAVAILABLE', "Le rattachement responsable de cet élève doit être vérifié dans son dossier."],
    ['IDENTITY_MISMATCH', 'Cet élève est rattaché à un autre responsable. Vérifiez le dossier avant de continuer.'],
  ])('409 with stable %s identity error and a human message', async (identityError, message) => {
    mockCreate.mockResolvedValue({ ok: false, identityError });

    const res = await createProfilPOST(req({
      contactLeadId: 'lead-1', studentId: 'student-1', publicInput: VALID_PUBLIC_INPUT,
    }));

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({ error: identityError, message });
  });
});

describe('GET /profils — resume, list drafts', () => {
  beforeEach(() => activatePipeline());

  test('200, forwards query filters', async () => {
    mockStaffProfileList.mockResolvedValue([{ id: 'p1', contactLead: null, student: null, lastQuote: null }]);
    const res = await listProfilsGET(new NextRequest('http://localhost/api/assistante/candidat-individuel/profils?studentId=s1&limit=5'));
    expect(res.status).toBe(200);
    expect(mockStaffProfileList).toHaveBeenCalledWith(expect.objectContaining({ studentId: 's1', limit: 5 }));
  });
});

describe('GET/PATCH /profils/:id', () => {
  beforeEach(() => activatePipeline());

  test('GET 404 when not found', async () => {
    mockStaffProfile.mockResolvedValue(null);
    const res = await getProfilGET(new NextRequest('http://localhost/x'), { params: Promise.resolve({ id: 'missing' }) });
    expect(res.status).toBe(404);
  });

  test('PATCH 404 when not found', async () => {
    mockUpdate.mockResolvedValue({ ok: false, notFound: true });
    const res = await updateProfilPATCH(req({ publicInput: VALID_PUBLIC_INPUT }), { params: Promise.resolve({ id: 'missing' }) });
    expect(res.status).toBe(404);
  });

  test('PATCH 409 when an existing Quote makes the profil immutable', async () => {
    mockUpdate.mockResolvedValue({ ok: false, quoteExists: true });
    const res = await updateProfilPATCH(req({ publicInput: VALID_PUBLIC_INPUT }), { params: Promise.resolve({ id: 'p1' }) });

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({
      error: 'Ce profil est lié à un devis. Créez une révision pour le modifier.',
    });
  });

  test('PATCH 200 on success', async () => {
    mockUpdate.mockResolvedValue({ ok: true, profil: { id: 'p1' } });
    const res = await updateProfilPATCH(req({ publicInput: VALID_PUBLIC_INPUT }), { params: Promise.resolve({ id: 'p1' }) });
    expect(res.status).toBe(200);
  });

  test('PATCH fails closed on a changed incompatible identity pair', async () => {
    mockUpdate.mockResolvedValue({ ok: false, identityError: 'IDENTITY_MISMATCH' });

    const res = await updateProfilPATCH(req({
      contactLeadId: 'lead-other', studentId: 'student-1', publicInput: VALID_PUBLIC_INPUT,
    }), { params: Promise.resolve({ id: 'p1' }) });

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({
      error: 'IDENTITY_MISMATCH',
      message: 'Cet élève est rattaché à un autre responsable. Vérifiez le dossier avant de continuer.',
    });
  });
});

describe('POST /profils/:id/review — staff-set marker only', () => {
  beforeEach(() => activatePipeline());

  test('404 when profil missing', async () => {
    mockReview.mockResolvedValue(null);
    const res = await reviewPOST(req({ note: 'x' }), { params: Promise.resolve({ id: 'missing' }) });
    expect(res.status).toBe(404);
  });

  test('200, forwards requesting staff id and note', async () => {
    mockReview.mockResolvedValue({ id: 'p1', reviewRequestedByUserId: 'staff-1' });
    const res = await reviewPOST(req({ note: 'vérifier P3' }), { params: Promise.resolve({ id: 'p1' }) });
    expect(res.status).toBe(200);
    expect(mockReview).toHaveBeenCalledWith('p1', 'staff-1', 'vérifier P3');
  });
});

describe('POST /profils/:id/revision — never mutates the original', () => {
  beforeEach(() => activatePipeline());

  test('404 when profil missing', async () => {
    mockRevision.mockResolvedValue(null);
    const res = await revisionPOST(new NextRequest('http://localhost/x', { method: 'POST' }), { params: Promise.resolve({ id: 'missing' }) });
    expect(res.status).toBe(404);
  });

  test('201 on success', async () => {
    mockRevision.mockResolvedValue({ id: 'p2', previousProfilId: 'p1', revisionNumber: 2 });
    mockStaffProfile.mockResolvedValue({
      id: 'p2',
      contactLead: { id: 'lead-1', name: 'Sonia' },
      student: { id: 'student-1', user: { firstName: 'Yasmine', lastName: 'Ben Salah' } },
      lastQuote: null,
    });
    const res = await revisionPOST(new NextRequest('http://localhost/x', { method: 'POST' }), { params: Promise.resolve({ id: 'p1' }) });
    expect(res.status).toBe(201);
    expect(mockRevision).toHaveBeenCalledWith('p1', 'staff-1');
    expect(mockStaffProfile).toHaveBeenCalledWith('p2');
    expect(await res.json()).toMatchObject({ profil: { id: 'p2', contactLead: { id: 'lead-1' }, student: { id: 'student-1' }, lastQuote: null } });
  });
});

describe('POST /profils/:id/quote/reconcile — exact idempotency boundary', () => {
  beforeEach(() => activatePipeline());

  test('404 définitif lorsqu’aucun devis ne correspond exactement au profil et à la clé', async () => {
    mockStaffQuoteByKey.mockResolvedValue(null);

    const res = await reconcileQuotePOST(
      req({ idempotencyKey: 'attempt-key' }, 'http://localhost/api/assistante/candidat-individuel/profils/profil-1/quote/reconcile'),
      { params: Promise.resolve({ id: 'profil-1' }) },
    );

    expect(res.status).toBe(404);
    expect(mockStaffQuoteByKey).toHaveBeenCalledWith('profil-1', 'attempt-key');
    expect(await res.json()).toEqual({ error: 'Aucun devis ne correspond à cette tentative.' });
  });

  test('retourne uniquement le devis staff curaté correspondant, sans token, hash, reason ni lastQuote', async () => {
    mockStaffQuoteByKey.mockResolvedValue({
      id: 'quote-exacte',
      statusLabel: 'Brouillon interne',
      updatedAt: '2026-08-29T10:00:00.000Z',
      totals: { annualTnd: 9600, depositTnd: 2400, installmentTnd: 720, installmentCount: 10 },
      lines: [{ subject: 'Mathématiques', modality: 'Individuel', hoursPerMonth: 4, monthlyAmountTnd: 720 }],
      margin: { percentage: 45, statusLabel: 'Marge conforme' },
      actions: { canPublish: true, canIssueFamilyLink: false, canRotateFamilyLink: false, canDownloadPdf: true, canCreateRevision: true, hasFamilyLink: false },
    });

    const res = await reconcileQuotePOST(
      req({ idempotencyKey: 'attempt-key' }, 'http://localhost/api/assistante/candidat-individuel/profils/profil-1/quote/reconcile'),
      { params: Promise.resolve({ id: 'profil-1' }) },
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ quote: { id: 'quote-exacte', lines: [{ subject: 'Mathématiques' }] } });
    expect(JSON.stringify(body)).not.toMatch(/token|hash|reason|lastQuote|actor/i);
  });

  test('400 sur une clé absente ou mal formée', async () => {
    const res = await reconcileQuotePOST(
      req({ idempotencyKey: '' }, 'http://localhost/api/assistante/candidat-individuel/profils/profil-1/quote/reconcile'),
      { params: Promise.resolve({ id: 'profil-1' }) },
    );

    expect(res.status).toBe(400);
    expect(mockStaffQuoteByKey).not.toHaveBeenCalled();
  });
});

describe('POST /simulate — real pipeline call, no persistence', () => {
  beforeEach(() => activatePipeline());

  test('400 on malformed body (missing budget)', async () => {
    const res = await simulatePOST(req({ publicInput: VALID_PUBLIC_INPUT }, 'http://localhost/api/assistante/candidat-individuel/simulate'));
    expect(res.status).toBe(400);
  });

  test('200, returns a real discriminated pipeline result (DIRECTION_APPROVAL_REQUIRED for the nominal terminale profile — HG/ES/EMC/LVA/LVB are structurally DIRECTION_A_VALIDER today)', async () => {
    const res = await simulatePOST(
      req({ publicInput: VALID_PUBLIC_INPUT, budget: { monthlyBudgetTnd: 2000, strategy: 'MOST_COMPLETE' } }, 'http://localhost/api/assistante/candidat-individuel/simulate'),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result.status).toBe('DIRECTION_APPROVAL_REQUIRED');
    expect(body.result.pendingModuleIds.length).toBeGreaterThan(0);
  });
});
