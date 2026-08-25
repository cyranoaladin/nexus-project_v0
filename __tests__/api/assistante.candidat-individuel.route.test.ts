/**
 * API tests for /api/assistante/candidat-individuel/** (mission recâblage
 * §5) — role gate (ADMIN/ASSISTANTE) AND feature-flag gate
 * (pricing.candidatIndividuelPipeline.state >= ACTIVE_INTERNAL) on every
 * route, request-body validation, and the happy path through the mocked
 * persistence layer. The simulate route calls the real
 * buildCandidateQuoteRecommendation (pure, no DB) rather than mocking it —
 * a genuine wiring check, not just a mock-returns-what-I-told-it check.
 */
import { NextRequest } from 'next/server';
import { _resetForTest, _setForTest } from '@/lib/config/snapshot';

let authResult: { user: { id: string; role: string; email: string } } | 'FORBIDDEN' = {
  user: { id: 'staff-1', role: 'ASSISTANTE', email: 'staff@test.com' },
};

jest.mock('@/lib/guards', () => {
  const { NextResponse } = require('next/server');
  return {
    requireAnyRole: jest.fn(async () => {
      if (authResult === 'FORBIDDEN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      return authResult;
    }),
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

jest.mock('@/lib/quotes/profil-candidat.server', () => ({
  createProfilCandidat: (...args: unknown[]) => mockCreate(...args),
  updateProfilCandidat: (...args: unknown[]) => mockUpdate(...args),
  getProfilCandidat: (...args: unknown[]) => mockGet(...args),
  listProfilsCandidats: (...args: unknown[]) => mockList(...args),
  requestProfilCandidatReview: (...args: unknown[]) => mockReview(...args),
  createProfilCandidatRevision: (...args: unknown[]) => mockRevision(...args),
}));

import { POST as createProfilPOST, GET as listProfilsGET } from '@/app/api/assistante/candidat-individuel/profils/route';
import { GET as getProfilGET, PATCH as updateProfilPATCH } from '@/app/api/assistante/candidat-individuel/profils/[id]/route';
import { POST as reviewPOST } from '@/app/api/assistante/candidat-individuel/profils/[id]/review/route';
import { POST as revisionPOST } from '@/app/api/assistante/candidat-individuel/profils/[id]/revision/route';
import { POST as simulatePOST } from '@/app/api/assistante/candidat-individuel/simulate/route';

const VALID_PUBLIC_INPUT = {
  level: 'TERMINALE',
  examSession: 2027,
  modalite: 'A',
  specialite1: 'MATHEMATIQUES',
  specialite2: 'PHYSIQUE_CHIMIE',
};

function req(body: unknown, url = 'http://localhost/api/assistante/candidat-individuel/profils') {
  return new NextRequest(url, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
}

function activatePipeline() {
  _setForTest([
    { namespace: 'pricing.candidatIndividuelPipeline', key: 'state', value: 'ACTIVE_INTERNAL', schemaVersion: '1.0', version: 1, updatedBy: 'test', updatedAt: new Date() },
  ]);
}

beforeEach(() => {
  _resetForTest(); // flag defaults OFF
  authResult = { user: { id: 'staff-1', role: 'ASSISTANTE', email: 'staff@test.com' } };
  jest.clearAllMocks();
});

describe('every route — flag OFF (default) blocks even a valid ADMIN/ASSISTANTE session', () => {
  test('POST /profils -> 403', async () => {
    const res = await createProfilPOST(req({ publicInput: VALID_PUBLIC_INPUT }));
    expect(res.status).toBe(403);
  });

  test('POST /simulate -> 403', async () => {
    const res = await simulatePOST(req({ publicInput: VALID_PUBLIC_INPUT, budget: { monthlyBudgetTnd: 2000, strategy: 'MOST_COMPLETE' } }, 'http://localhost/api/assistante/candidat-individuel/simulate'));
    expect(res.status).toBe(403);
  });
});

describe('every route — non ADMIN/ASSISTANTE role is rejected even with the flag active', () => {
  beforeEach(() => {
    activatePipeline();
    authResult = 'FORBIDDEN';
  });

  test('POST /profils -> 403', async () => {
    const res = await createProfilPOST(req({ publicInput: VALID_PUBLIC_INPUT }));
    expect(res.status).toBe(403);
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

  test('422 when the service reports an incomplete profil', async () => {
    mockCreate.mockResolvedValue({ ok: false, unresolvedFields: ['specialite1'], missingRequiredFields: [] });
    const res = await createProfilPOST(req({ publicInput: VALID_PUBLIC_INPUT }));
    expect(res.status).toBe(422);
  });
});

describe('GET /profils — resume, list drafts', () => {
  beforeEach(() => activatePipeline());

  test('200, forwards query filters', async () => {
    mockList.mockResolvedValue([{ id: 'p1' }]);
    const res = await listProfilsGET(new NextRequest('http://localhost/api/assistante/candidat-individuel/profils?studentId=s1&limit=5'));
    expect(res.status).toBe(200);
    expect(mockList).toHaveBeenCalledWith(expect.objectContaining({ studentId: 's1', limit: 5 }));
  });
});

describe('GET/PATCH /profils/:id', () => {
  beforeEach(() => activatePipeline());

  test('GET 404 when not found', async () => {
    mockGet.mockResolvedValue(null);
    const res = await getProfilGET(new NextRequest('http://localhost/x'), { params: Promise.resolve({ id: 'missing' }) });
    expect(res.status).toBe(404);
  });

  test('PATCH 404 when not found', async () => {
    mockUpdate.mockResolvedValue({ ok: false, notFound: true });
    const res = await updateProfilPATCH(req({ publicInput: VALID_PUBLIC_INPUT }), { params: Promise.resolve({ id: 'missing' }) });
    expect(res.status).toBe(404);
  });

  test('PATCH 200 on success', async () => {
    mockUpdate.mockResolvedValue({ ok: true, profil: { id: 'p1' } });
    const res = await updateProfilPATCH(req({ publicInput: VALID_PUBLIC_INPUT }), { params: Promise.resolve({ id: 'p1' }) });
    expect(res.status).toBe(200);
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
    const res = await revisionPOST(new NextRequest('http://localhost/x', { method: 'POST' }), { params: Promise.resolve({ id: 'p1' }) });
    expect(res.status).toBe(201);
    expect(mockRevision).toHaveBeenCalledWith('p1', 'staff-1');
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
