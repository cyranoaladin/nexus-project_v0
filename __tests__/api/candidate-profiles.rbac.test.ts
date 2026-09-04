/**
 * RBAC negative-path coverage for every candidat-individuel staff route
 * (Track A, Section 1). Exercises the REAL requireAnyRole/requireAuth
 * (lib/guards.ts) against a mocked @/auth session — never mocks the guard
 * itself, so this proves the actual server-side enforcement, not just
 * that a route passes through whatever the guard returns.
 *
 * CANDIDATE_STAFF_ROUTES_SERVER_RBAC=PASS / CLIENT_ROLE_TRUST=NO is this
 * file's exact claim.
 */
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/rate-limit/sensitive', () => ({
  guardSensitiveRateLimit: jest.fn().mockResolvedValue(null),
}));
jest.mock('@/lib/quotes/candidate-profile-flag', () => ({
  getCandidateProfileWorkflowStatus: jest.fn().mockResolvedValue('ACTIVE_INTERNAL'),
}));
jest.mock('@/lib/quotes/candidate-profile-persistence.server', () => ({
  createProfilCandidat: jest.fn(),
  getProfilCandidatById: jest.fn(),
  reviseProfilCandidat: jest.fn(),
}));
jest.mock('@/lib/quotes/candidate-quote-context', () => ({
  buildCandidateQuoteContext: jest.fn(),
}));
jest.mock('@/lib/quotes/recommendation', () => ({ buildRecommendation: jest.fn() }));
jest.mock('@/lib/quotes/pricing', () => ({ computeCandidatLibreSchedule: jest.fn() }));
jest.mock('@/lib/quotes/persistence.server', () => ({
  createQuote: jest.fn(),
  getQuoteById: jest.fn(),
}));
jest.mock('@/lib/quotes/pdf-adapter.server', () => ({
  buildQuotePdfDataFromPersistedQuote: jest.fn(),
}));
jest.mock('@/lib/quote/pdf', () => ({
  renderQuotePDF: jest.fn(),
}));

import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { POST as createProfile } from '@/app/api/assistante/candidate-profiles/route';
import { GET as getProfile, PATCH as patchProfile } from '@/app/api/assistante/candidate-profiles/[id]/route';
import { POST as createQuoteFromProfile } from '@/app/api/assistante/candidate-profiles/[id]/quotes/route';
import { GET as getQuotePdf } from '@/app/api/assistante/candidate-profiles/[id]/quotes/[quoteId]/pdf/route';
import {
  createProfilCandidat,
  getProfilCandidatById,
  reviseProfilCandidat,
} from '@/lib/quotes/candidate-profile-persistence.server';
import { getQuoteById } from '@/lib/quotes/persistence.server';
import { renderQuotePDF } from '@/lib/quote/pdf';

const mockAuth = auth as jest.Mock;
const mockCreate = createProfilCandidat as jest.Mock;
const mockGetById = getProfilCandidatById as jest.Mock;
const mockRevise = reviseProfilCandidat as jest.Mock;
const mockGetQuote = getQuoteById as jest.Mock;
const mockRenderPdf = renderQuotePDF as jest.Mock;

const FORBIDDEN_ROLES = ['PARENT', 'ELEVE', 'COACH'] as const;
const ALLOWED_ROLES = ['ADMIN', 'ASSISTANTE'] as const;

function sessionFor(role: string) {
  return { user: { id: `${role.toLowerCase()}-1`, role, email: `${role.toLowerCase()}@example.com` } };
}

const validCreateBody = {
  contactLeadId: 'lead-1',
  level: 'TERMINALE',
  examSession: 2027,
  modalite: 'A',
  specialite1: 'MATHEMATIQUES',
  specialite2: 'NSI',
};

const validPatchBody = {
  specialite2: 'PHYSIQUE_CHIMIE',
};

const fakeQuote = {
  id: 'quote-1',
  profilId: 'profil-1',
  contactLead: { id: 'lead-1', name: 'Amira Ben Salah', email: 'amira@example.com', phone: '+21620000000' },
  student: null,
  lines: [],
};

function postRequest(path: string, body: unknown) {
  return new NextRequest(`http://localhost:3000${path}`, { method: 'POST', body: JSON.stringify(body) });
}
function patchRequest(path: string, body: unknown) {
  return new NextRequest(`http://localhost:3000${path}`, { method: 'PATCH', body: JSON.stringify(body) });
}
function getRequest(path: string) {
  return new NextRequest(`http://localhost:3000${path}`);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCreate.mockResolvedValue({ id: 'profil-1', ...validCreateBody });
  mockGetById.mockResolvedValue({ id: 'profil-1', ...validCreateBody, contactLeadId: 'lead-1', studentId: null });
  mockRevise.mockResolvedValue({ id: 'profil-2', ...validCreateBody, ...validPatchBody, revisionNumber: 2 });
  mockGetQuote.mockResolvedValue(fakeQuote);
  mockRenderPdf.mockResolvedValue(Buffer.from('%PDF-mock'));
});

describe('candidat-individuel staff routes — server-side RBAC (real requireAnyRole/requireAuth)', () => {
  // CANDIDATE_STAFF_ROUTES_SERVER_RBAC=PASS
  // CLIENT_ROLE_TRUST=NO
  test('unauthenticated (no session) gets 401 on every route — never a client-visible hint of role requirements', async () => {
    mockAuth.mockResolvedValue(null);

    const createRes = await createProfile(postRequest('/api/assistante/candidate-profiles', validCreateBody));
    expect(createRes.status).toBe(401);

    const getRes = await getProfile(getRequest('/api/assistante/candidate-profiles/profil-1'), { params: Promise.resolve({ id: 'profil-1' }) });
    expect(getRes.status).toBe(401);

    const patchRes = await patchProfile(patchRequest('/api/assistante/candidate-profiles/profil-1', validPatchBody), { params: Promise.resolve({ id: 'profil-1' }) });
    expect(patchRes.status).toBe(401);

    const quoteRes = await createQuoteFromProfile(
      postRequest('/api/assistante/candidate-profiles/profil-1/quotes', { idempotencyKey: 'idem-1234567890', budget: 700, strategy: 'BEST_BALANCE', scenarioTier: 'RECOMMANDE' }),
      { params: Promise.resolve({ id: 'profil-1' }) },
    );
    expect(quoteRes.status).toBe(401);

    const pdfRes = await getQuotePdf(
      getRequest('/api/assistante/candidate-profiles/profil-1/quotes/quote-1/pdf'),
      { params: Promise.resolve({ id: 'profil-1', quoteId: 'quote-1' }) },
    );
    expect(pdfRes.status).toBe(401);

    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockRevise).not.toHaveBeenCalled();
    expect(mockRenderPdf).not.toHaveBeenCalled();
  });

  describe.each(FORBIDDEN_ROLES)('role=%s (forbidden)', (role) => {
    beforeEach(() => {
      mockAuth.mockResolvedValue(sessionFor(role));
    });

    test('POST /api/assistante/candidate-profiles -> 403, never creates a profile', async () => {
      const res = await createProfile(postRequest('/api/assistante/candidate-profiles', validCreateBody));
      expect(res.status).toBe(403);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    test('GET /api/assistante/candidate-profiles/[id] -> 403, never leaks the profile', async () => {
      const res = await getProfile(getRequest('/api/assistante/candidate-profiles/profil-1'), { params: Promise.resolve({ id: 'profil-1' }) });
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body).not.toHaveProperty('level');
    });

    test('PATCH /api/assistante/candidate-profiles/[id] -> 403, never revises the profile', async () => {
      const res = await patchProfile(patchRequest('/api/assistante/candidate-profiles/profil-1', validPatchBody), { params: Promise.resolve({ id: 'profil-1' }) });
      expect(res.status).toBe(403);
      expect(mockRevise).not.toHaveBeenCalled();
    });

    test('POST /api/assistante/candidate-profiles/[id]/quotes -> 403, never creates a quote', async () => {
      const res = await createQuoteFromProfile(
        postRequest('/api/assistante/candidate-profiles/profil-1/quotes', { idempotencyKey: 'idem-1234567890', budget: 700, strategy: 'BEST_BALANCE', scenarioTier: 'RECOMMANDE' }),
        { params: Promise.resolve({ id: 'profil-1' }) },
      );
      expect(res.status).toBe(403);
      expect(mockGetById).not.toHaveBeenCalled();
    });

    test('GET /api/assistante/candidate-profiles/[id]/quotes/[quoteId]/pdf -> 403, never renders the PDF', async () => {
      const res = await getQuotePdf(
        getRequest('/api/assistante/candidate-profiles/profil-1/quotes/quote-1/pdf'),
        { params: Promise.resolve({ id: 'profil-1', quoteId: 'quote-1' }) },
      );
      expect(res.status).toBe(403);
      expect(mockRenderPdf).not.toHaveBeenCalled();
    });
  });

  describe.each(ALLOWED_ROLES)('role=%s (allowed)', (role) => {
    beforeEach(() => {
      mockAuth.mockResolvedValue(sessionFor(role));
    });

    test('POST /api/assistante/candidate-profiles -> 201, reaches the persistence layer', async () => {
      const res = await createProfile(postRequest('/api/assistante/candidate-profiles', validCreateBody));
      expect(res.status).toBe(201);
      expect(mockCreate).toHaveBeenCalled();
    });

    test('GET /api/assistante/candidate-profiles/[id] -> 200, reaches the persistence layer', async () => {
      const res = await getProfile(getRequest('/api/assistante/candidate-profiles/profil-1'), { params: Promise.resolve({ id: 'profil-1' }) });
      expect(res.status).toBe(200);
      expect(mockGetById).toHaveBeenCalled();
    });

    test('PATCH /api/assistante/candidate-profiles/[id] -> 200, reaches the persistence layer', async () => {
      const res = await patchProfile(patchRequest('/api/assistante/candidate-profiles/profil-1', validPatchBody), { params: Promise.resolve({ id: 'profil-1' }) });
      expect(res.status).toBe(200);
      expect(mockRevise).toHaveBeenCalled();
    });

    test('GET /api/assistante/candidate-profiles/[id]/quotes/[quoteId]/pdf -> 200, reaches the PDF engine', async () => {
      const res = await getQuotePdf(
        getRequest('/api/assistante/candidate-profiles/profil-1/quotes/quote-1/pdf'),
        { params: Promise.resolve({ id: 'profil-1', quoteId: 'quote-1' }) },
      );
      expect(res.status).toBe(200);
      expect(mockRenderPdf).toHaveBeenCalled();
    });
  });
});
