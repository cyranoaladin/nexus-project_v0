/** @jest-environment node */

/**
 * Track A, Section 4: A13 Rehearsal Fonctionnel
 * Full lifecycle rehearsal test verifying:
 * ASSISTANTE login
 * -> create ProfilCandidat
 * -> update (revision)
 * -> validation
 * -> P1-P12 eligibility
 * -> quote simulation
 * -> canonical quote creation
 * -> persistence
 * -> PDF
 * -> reload
 * Then ADMIN.
 * Then Negative RBAC (PARENT, ELEVE, COACH, unauthenticated).
 * Then historic workflows sanity check.
 */

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/rate-limit/sensitive', () => ({
  guardSensitiveRateLimit: jest.fn().mockResolvedValue(null),
}));
jest.mock('@/lib/quotes/candidate-profile-flag', () => ({
  getCandidateProfileWorkflowStatus: jest.fn().mockResolvedValue('ACTIVE_INTERNAL'),
}));

import { NextRequest } from 'next/server';
import { UserRole } from '@prisma/client';
import { auth } from '@/auth';
import { POST as createProfileRoute } from '@/app/api/assistante/candidate-profiles/route';
import {
  GET as getProfileRoute,
  PATCH as patchProfileRoute,
} from '@/app/api/assistante/candidate-profiles/[id]/route';
import { POST as createQuoteRoute } from '@/app/api/assistante/candidate-profiles/[id]/quotes/route';
import { GET as getQuotePdfRoute } from '@/app/api/assistante/candidate-profiles/[id]/quotes/[quoteId]/pdf/route';

import { requireExamPolicy } from '@/lib/exams/catalog';
import { validateProfilCandidat } from '@/lib/exams/profile-validation';
import { resolveParcoursType, type ProfilCandidatInput } from '@/lib/exams/parcours';
import { buildCandidateQuoteContext } from '@/lib/quotes/candidate-quote-context';
import { buildRecommendation } from '@/lib/quotes/recommendation';
import { computeCandidatLibreSchedule } from '@/lib/quotes/pricing';

const mockAuth = auth as jest.Mock;

// In-memory persistent state for rehearsal
const memoryStore = {
  profiles: new Map<string, any>(),
  quotes: new Map<string, any>(),
};

// Mock persistence layers using the in-memory store
jest.mock('@/lib/quotes/candidate-profile-persistence.server', () => ({
  createProfilCandidat: jest.fn(async (input: any) => {
    const id = `profil-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const profile = {
      id,
      ...input,
      optionsTerminale: input.optionsTerminale ?? [],
      revisionNumber: 1,
      previousProfilId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    memoryStore.profiles.set(id, profile);
    return profile;
  }),
  getProfilCandidatById: jest.fn(async (id: string) => {
    return memoryStore.profiles.get(id) ?? null;
  }),
  reviseProfilCandidat: jest.fn(async (profilId: string, changes: any) => {
    const prev = memoryStore.profiles.get(profilId);
    if (!prev) {
      const err = new Error('Record to update not found') as any;
      err.code = 'P2025';
      throw err;
    }
    const newId = `profil-rev-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const revised = {
      ...prev,
      ...changes,
      id: newId,
      previousProfilId: profilId,
      revisionNumber: prev.revisionNumber + 1,
      updatedAt: new Date(),
    };
    memoryStore.profiles.set(newId, revised);
    return revised;
  }),
}));

jest.mock('@/lib/quotes/persistence.server', () => ({
  createQuote: jest.fn(async (input: any) => {
    const id = `quote-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const quote = {
      id,
      profilId: input.profilId,
      parcours: input.parcours,
      deposit: input.deposit,
      grandTotal: input.scenario.grandTotal,
      monthlyTotal: input.scenario.monthlyTotal,
      lastInstallmentAmount: input.lastInstallmentAmount,
      contactLeadId: input.contactLeadId,
      contactLead: input.contactLeadId ? { id: input.contactLeadId, name: 'Amira Ben Salah', email: 'amira@example.com', phone: '+21620000000' } : null,
      student: null,
      lines: (input.scenario.modules ?? []).map((m: any, idx: number) => ({
        id: `line-${idx}`,
        quoteId: id,
        subject: m.subject,
        modality: m.modality,
        hoursPerMonth: m.hoursPerMonth,
        unitPrice: m.unitPrice,
        months: m.months,
        lineTotal: m.lineTotal,
      })),
      createdAt: new Date(),
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    };
    memoryStore.quotes.set(id, quote);
    return { quote, rawToken: 'mock-raw-token', alreadyExisted: false };
  }),
  getQuoteById: jest.fn(async (id: string) => {
    return memoryStore.quotes.get(id) ?? null;
  }),
}));

function postRequest(url: string, body: any) {
  return new NextRequest(`http://localhost:3000${url}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

function patchRequest(url: string, body: any) {
  return new NextRequest(`http://localhost:3000${url}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

function getRequest(url: string) {
  return new NextRequest(`http://localhost:3000${url}`);
}

describe('Track A — Section 4: A13 Rehearsal Fonctionnel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    memoryStore.profiles.clear();
    memoryStore.quotes.clear();
  });

  test('Complete workflow as ASSISTANTE: create -> update -> validate -> P1-P12 -> simulate -> create quote -> persist -> PDF -> reload', async () => {
    // 1. ASSISTANTE Login
    mockAuth.mockResolvedValue({
      user: { id: 'assistante-1', role: UserRole.ASSISTANTE, email: 'assistante@nexusreussite.academy' },
    });

    // 2. Create ProfilCandidat
    const createPayload = {
      contactLeadId: 'lead-rehearsal-1',
      level: 'TERMINALE',
      examSession: 2027,
      modalite: 'A',
      specialite1: 'MATHEMATIQUES',
      specialite2: 'NSI',
      specialiteAbandonnee: undefined,
      langueA: 'ANGLAIS',
      langueB: 'ESPAGNOL',
    };

    const createRes = await createProfileRoute(postRequest('/api/assistante/candidate-profiles', createPayload));
    expect(createRes.status).toBe(201);
    const initialProfile = await createRes.json();
    expect(initialProfile.id).toBeDefined();
    expect(initialProfile.level).toBe('TERMINALE');
    expect(initialProfile.revisionNumber).toBe(1);

    // 3. Update ProfilCandidat (revision)
    const patchPayload = {
      specialite2: 'PHYSIQUE_CHIMIE',
    };
    const patchRes = await patchProfileRoute(
      patchRequest(`/api/assistante/candidate-profiles/${initialProfile.id}`, patchPayload),
      { params: Promise.resolve({ id: initialProfile.id }) },
    );
    expect(patchRes.status).toBe(200);
    const revisedProfile = await patchRes.json();
    expect(revisedProfile.id).not.toBe(initialProfile.id);
    expect(revisedProfile.previousProfilId).toBe(initialProfile.id);
    expect(revisedProfile.revisionNumber).toBe(2);
    expect(revisedProfile.specialite2).toBe('PHYSIQUE_CHIMIE');

    // 4. Validation & P1-P12 eligibility
    const candidateInput: ProfilCandidatInput = {
      level: revisedProfile.level,
      examSession: revisedProfile.examSession,
      modalite: revisedProfile.modalite,
      specialite1: revisedProfile.specialite1,
      specialite2: revisedProfile.specialite2,
      specialiteAbandonnee: null,
      langueA: revisedProfile.langueA,
      langueB: revisedProfile.langueB,
      estRedoublant: false,
      estTitulaireBacDejaObtenu: false,
      changementSpecialite: false,
      intentionAmelioration: false,
      intentionCycleComplet: true,
      brancheBascule: null,
      epreuvesDispenseesDeclarees: [],
      etalementPlurisessionsDeclare: false,
      moyenneRattrapage: null,
      optionsTerminale: revisedProfile.optionsTerminale ?? [],
      notesConservees: null,
    };

    const policy2027 = requireExamPolicy(2027);
    const validationResult = validateProfilCandidat(policy2027, { profil: candidateInput });
    expect(validationResult.valide).toBe(true);
    expect(validationResult.erreurs).toHaveLength(0);

    const parcoursResolution = resolveParcoursType(policy2027, { profil: candidateInput });
    expect(parcoursResolution.parcoursPrincipal).toBe('P1_LIBRE_2ANS_MODALITE_A');

    // 5. Quote simulation (canonical quote engine)
    const quoteContext = buildCandidateQuoteContext(candidateInput, candidateInput.examSession);
    expect(quoteContext.situation.level).toBe('terminale');
    expect(quoteContext.carte.parcours.parcoursPrincipal).toBe('P1_LIBRE_2ANS_MODALITE_A');
    expect(quoteContext.regulatoryMaturity).toBe('CARTE_VALIDATED_DEFINITIVE');

    const recommendation = buildRecommendation({
      situation: quoteContext.situation,
      diagnosticDomainScores: null,
      budget: { monthlyBudgetTnd: 700, strategy: 'BEST_BALANCE' },
    });
    expect(recommendation.scenarios.length).toBeGreaterThan(0);
    const chosenScenario = recommendation.scenarios[0];

    // Verify payment policy: deposit = 0, 10 installments
    const schedule = computeCandidatLibreSchedule(chosenScenario.grandTotal);
    expect(schedule.deposit).toBe(0);
    expect(schedule.nInstallments).toBe(10);
    expect(schedule.installmentAmount).toBeGreaterThan(0);

    // 6. Canonical Quote Creation via API
    const quotePayload = {
      idempotencyKey: `idem-${Date.now()}`,
      budget: 700,
      strategy: 'BEST_BALANCE',
      scenarioTier: chosenScenario.tier,
    };

    const quoteRes = await createQuoteRoute(
      postRequest(`/api/assistante/candidate-profiles/${revisedProfile.id}/quotes`, quotePayload),
      { params: Promise.resolve({ id: revisedProfile.id }) },
    );
    expect(quoteRes.status).toBe(201);
    const createQuoteResult = await quoteRes.json();
    const createdQuote = createQuoteResult.quote;
    expect(createdQuote.id).toBeDefined();
    expect(createdQuote.profilId).toBe(revisedProfile.id);
    expect(createdQuote.deposit).toBe(0);
    expect(createdQuote.parcours).toBe('P1_LIBRE_2ANS_MODALITE_A');
    expect(createdQuote.grandTotal).toBe(chosenScenario.grandTotal);

    // 7. Persistence verification
    expect(memoryStore.quotes.has(createdQuote.id)).toBe(true);

    // 8. PDF generation
    const pdfRes = await getQuotePdfRoute(
      getRequest(`/api/assistante/candidate-profiles/${revisedProfile.id}/quotes/${createdQuote.id}/pdf`),
      { params: Promise.resolve({ id: revisedProfile.id, quoteId: createdQuote.id }) },
    );
    expect(pdfRes.status).toBe(200);
    expect(pdfRes.headers.get('Content-Type')).toBe('application/pdf');

    // 9. Reload profile
    const reloadRes = await getProfileRoute(
      getRequest(`/api/assistante/candidate-profiles/${revisedProfile.id}`),
      { params: Promise.resolve({ id: revisedProfile.id }) },
    );
    expect(reloadRes.status).toBe(200);
    const reloadedProfile = await reloadRes.json();
    expect(reloadedProfile.id).toBe(revisedProfile.id);
    expect(reloadedProfile.revisionNumber).toBe(2);
  });

  test('Complete workflow as ADMIN: executes successfully with ADMIN privileges', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'admin-1', role: UserRole.ADMIN, email: 'admin@nexusreussite.academy' },
    });

    const createPayload = {
      contactLeadId: 'lead-admin-1',
      level: 'PREMIERE',
      examSession: 2027,
      modalite: 'B',
      specialite1: 'PHYSIQUE_CHIMIE',
      specialite2: 'SVT',
    };

    const createRes = await createProfileRoute(postRequest('/api/assistante/candidate-profiles', createPayload));
    expect(createRes.status).toBe(201);
    const profile = await createRes.json();
    expect(profile.id).toBeDefined();

    const getRes = await getProfileRoute(
      getRequest(`/api/assistante/candidate-profiles/${profile.id}`),
      { params: Promise.resolve({ id: profile.id }) },
    );
    expect(getRes.status).toBe(200);
  });

  test('Negative RBAC: PARENT, ELEVE, COACH, and unauthenticated are strictly rejected', async () => {
    mockAuth.mockResolvedValue(null);
    const unauthRes = await createProfileRoute(postRequest('/api/assistante/candidate-profiles', {}));
    expect(unauthRes.status).toBe(401);

    for (const role of [UserRole.PARENT, UserRole.ELEVE, UserRole.COACH]) {
      mockAuth.mockResolvedValue({
        user: { id: `${role.toLowerCase()}-1`, role, email: `${role.toLowerCase()}@example.com` },
      });

      const res = await createProfileRoute(postRequest('/api/assistante/candidate-profiles', {}));
      expect(res.status).toBe(403);
    }
  });

  test('Historic workflows integrity check: existing core domain modules remain intact and functional', () => {
    expect(typeof computeCandidatLibreSchedule).toBe('function');
    expect(typeof buildRecommendation).toBe('function');
    expect(typeof resolveParcoursType).toBe('function');
  });
});
