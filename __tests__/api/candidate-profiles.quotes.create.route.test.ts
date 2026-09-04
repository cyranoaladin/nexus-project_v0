jest.mock('@/lib/rate-limit/sensitive', () => ({
  guardSensitiveRateLimit: jest.fn().mockResolvedValue(null),
}));
jest.mock('@/lib/guards', () => ({
  requireAnyRole: jest.fn(),
  isErrorResponse: (v: unknown) => v instanceof Response,
}));
jest.mock('@/lib/quotes/candidate-profile-flag', () => ({
  getCandidateProfileWorkflowStatus: jest.fn(),
}));
jest.mock('@/lib/quotes/candidate-profile-persistence.server', () => ({
  getProfilCandidatById: jest.fn(),
}));
jest.mock('@/lib/quotes/candidate-quote-context', () => ({
  buildCandidateQuoteContext: jest.fn(),
}));
jest.mock('@/lib/quotes/recommendation', () => ({
  buildRecommendation: jest.fn(),
}));
jest.mock('@/lib/quotes/pricing', () => ({
  computeCandidatLibreSchedule: jest.fn(),
}));
jest.mock('@/lib/quotes/persistence.server', () => ({
  createQuote: jest.fn(),
}));

import { NextRequest } from 'next/server';
import { UserRole } from '@prisma/client';
import { POST } from '@/app/api/assistante/candidate-profiles/[id]/quotes/route';
import { requireAnyRole } from '@/lib/guards';
import { getCandidateProfileWorkflowStatus } from '@/lib/quotes/candidate-profile-flag';
import { getProfilCandidatById } from '@/lib/quotes/candidate-profile-persistence.server';
import { buildCandidateQuoteContext } from '@/lib/quotes/candidate-quote-context';
import { buildRecommendation } from '@/lib/quotes/recommendation';
import { computeCandidatLibreSchedule } from '@/lib/quotes/pricing';
import { createQuote } from '@/lib/quotes/persistence.server';

const mockRequireAnyRole = requireAnyRole as jest.Mock;
const mockGetFlag = getCandidateProfileWorkflowStatus as jest.Mock;
const mockGetProfil = getProfilCandidatById as jest.Mock;
const mockBuildContext = buildCandidateQuoteContext as jest.Mock;
const mockBuildRecommendation = buildRecommendation as jest.Mock;
const mockComputeSchedule = computeCandidatLibreSchedule as jest.Mock;
const mockCreateQuote = createQuote as jest.Mock;

const staffSession = { user: { id: 'staff-1', role: UserRole.ASSISTANTE } };

const fakeProfil = {
  id: 'profil-1',
  contactLeadId: 'lead-1',
  studentId: null,
  level: 'TERMINALE',
  examSession: 2027,
  modalite: 'A',
  specialite1: 'MATHEMATIQUES',
  specialite2: 'NSI',
  specialiteAbandonnee: null,
  langueA: null,
  langueB: null,
};

const scenario = { tier: 'RECOMMANDE', grandTotal: 6200, monthlyTotal: 620, lines: [], notRecommended: [], months: 10, matchedOfferId: null };

const fakeContext = {
  situation: { level: 'terminale', examSession: 2027, specialites: ['MATHEMATIQUES', 'NSI'] },
  validation: { valide: true, erreurs: [], avertissements: [], informations: [], necessiteVerificationHumaine: false, emissionAutomatiqueAutorisee: true },
  carte: { parcours: { parcoursPrincipal: 'P1_LIBRE_2ANS_MODALITE_A' }, emissionAutomatiqueAutorisee: true },
  emissionAutomatiqueAutorisee: true,
  regulatoryMaturity: 'CARTE_VALIDATED_DEFINITIVE',
};

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost:3000/api/assistante/candidate-profiles/profil-1/quotes', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

const validBody = { idempotencyKey: 'idem-1234567890', budget: 700, strategy: 'BEST_BALANCE', scenarioTier: 'RECOMMANDE' };

beforeEach(() => {
  jest.clearAllMocks();
  mockRequireAnyRole.mockResolvedValue(staffSession);
  mockGetFlag.mockResolvedValue('ACTIVE_INTERNAL');
  mockGetProfil.mockResolvedValue(fakeProfil);
  mockBuildContext.mockReturnValue(fakeContext);
  mockBuildRecommendation.mockReturnValue({ scenarios: [scenario] });
  mockComputeSchedule.mockReturnValue({ deposit: 0, installmentAmount: 620, lastInstallmentAmount: 620, nInstallments: 10 });
  mockCreateQuote.mockResolvedValue({ quote: { id: 'quote-1' }, rawToken: 'raw-token', alreadyExisted: false });
});

describe('POST /api/assistante/candidate-profiles/[id]/quotes', () => {
  test('requires ADMIN/ASSISTANTE', async () => {
    await POST(makeRequest(validBody), { params: Promise.resolve({ id: 'profil-1' }) });
    expect(mockRequireAnyRole).toHaveBeenCalledWith([UserRole.ADMIN, UserRole.ASSISTANTE]);
  });

  test('404 when the profile does not exist', async () => {
    mockGetProfil.mockResolvedValueOnce(null);
    const res = await POST(makeRequest(validBody), { params: Promise.resolve({ id: 'nonexistent' }) });
    expect(res.status).toBe(404);
    expect(mockCreateQuote).not.toHaveBeenCalled();
  });

  test('403 when the workflow flag is DISABLED', async () => {
    mockGetFlag.mockResolvedValueOnce('DISABLED');
    const res = await POST(makeRequest(validBody), { params: Promise.resolve({ id: 'profil-1' }) });
    expect(res.status).toBe(403);
    expect(mockCreateQuote).not.toHaveBeenCalled();
  });

  test('400 when the requested scenarioTier is not in buildRecommendation\'s scenarios', async () => {
    const res = await POST(makeRequest({ ...validBody, scenarioTier: 'ESSENTIEL' }), { params: Promise.resolve({ id: 'profil-1' }) });
    expect(res.status).toBe(400);
    expect(mockCreateQuote).not.toHaveBeenCalled();
  });

  test('wires ProfilCandidat -> adapter -> buildRecommendation -> createQuote through the EXISTING engine only, never a second one', async () => {
    await POST(makeRequest(validBody), { params: Promise.resolve({ id: 'profil-1' }) });

    expect(mockBuildContext).toHaveBeenCalledWith(expect.objectContaining({ level: 'TERMINALE', specialite1: 'MATHEMATIQUES' }), 2027);
    expect(mockBuildRecommendation).toHaveBeenCalledWith(
      expect.objectContaining({ situation: fakeContext.situation, budget: { monthlyBudgetTnd: 700, strategy: 'BEST_BALANCE' } }),
    );
    expect(mockComputeSchedule).toHaveBeenCalledWith(scenario.grandTotal);
    expect(mockCreateQuote).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'STAFF_WORKSPACE',
        contactLeadId: 'lead-1',
        scenario,
        profilId: 'profil-1',
        parcours: 'P1_LIBRE_2ANS_MODALITE_A',
        deposit: 0,
        lastInstallmentAmount: 620,
        regulatoryMaturity: 'CARTE_VALIDATED_DEFINITIVE',
        createdByUserId: 'staff-1',
      }),
    );
  });

  test('on success, returns 201 with the created quote id', async () => {
    const res = await POST(makeRequest(validBody), { params: Promise.resolve({ id: 'profil-1' }) });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.quote.id).toBe('quote-1');
  });
});
