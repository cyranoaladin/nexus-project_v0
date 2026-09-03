/**
 * Track A, Section 3 — candidat-individuel must NEVER bypass ARIA sale
 * suspension. Static analysis + explicit forged-payload proof.
 *
 * This file's exact claim: CANDIDATE_ARIA_SALE_BYPASS=NO.
 */
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';

const read = (relativePath: string): string => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

const CANDIDATE_DOMAIN_FILES = [
  'lib/quotes/candidate-profile-persistence.server.ts',
  'lib/quotes/candidate-profile-flag.ts',
  'lib/quotes/candidate-quote-context.ts',
  'lib/quotes/pdf-adapter.server.ts',
  'app/api/assistante/candidate-profiles/route.ts',
  'app/api/assistante/candidate-profiles/[id]/route.ts',
  'app/api/assistante/candidate-profiles/[id]/quotes/route.ts',
  'app/api/assistante/candidate-profiles/[id]/quotes/[quoteId]/pdf/route.ts',
];

describe('candidat individuel — no ARIA entitlement reachability', () => {
  test('no candidate-domain file imports the ARIA entitlement engine or references ARIA_ACCESS/activateCanonicalAriaGrant', () => {
    for (const file of CANDIDATE_DOMAIN_FILES) {
      const source = read(file);
      expect(source).not.toMatch(/lib\/entitlement/);
      expect(source).not.toMatch(/activateCanonicalAriaGrant/);
      expect(source).not.toMatch(/ARIA_ACCESS/);
      expect(source).not.toMatch(/prisma\.entitlement\b/i);
    }
  });

  test('the extended createQuote (persistence.server.ts) never writes an Entitlement row, and its candidat-individuel fields never touch productCode/entitlement', () => {
    const source = read('lib/quotes/persistence.server.ts');
    expect(source).not.toMatch(/entitlement/i);
    expect(source).not.toMatch(/ARIA/);
  });

  test('the profile/quote-creation request schemas accept no productCode/entitlement/ariaAccess field — a forged payload with one is rejected by .strict(), never silently accepted', async () => {
    jest.resetModules();
    jest.doMock('@/lib/guards', () => ({
      requireAnyRole: jest.fn().mockResolvedValue({ user: { id: 'staff-1', role: 'ASSISTANTE' } }),
      isErrorResponse: (v: unknown) => v instanceof Response,
    }));
    jest.doMock('@/lib/rate-limit/sensitive', () => ({ guardSensitiveRateLimit: jest.fn().mockResolvedValue(null) }));
    jest.doMock('@/lib/quotes/candidate-profile-flag', () => ({ getCandidateProfileWorkflowStatus: jest.fn().mockResolvedValue('ACTIVE_INTERNAL') }));
    const mockCreate = jest.fn();
    jest.doMock('@/lib/quotes/candidate-profile-persistence.server', () => ({ createProfilCandidat: mockCreate }));

    const { POST } = await import('@/app/api/assistante/candidate-profiles/route');
    const forgedBody = {
      contactLeadId: 'lead-1',
      level: 'TERMINALE',
      examSession: 2027,
      modalite: 'A',
      specialite1: 'MATHEMATIQUES',
      specialite2: 'NSI',
      // Forged attempt to smuggle a commercial/entitlement truth through the request body:
      productCode: 'ARIA_ACCESS',
      ariaAccess: true,
      entitled: true,
    };
    const req = new NextRequest('http://localhost:3000/api/assistante/candidate-profiles', {
      method: 'POST',
      body: JSON.stringify(forgedBody),
    });
    const res = await POST(req);
    expect(res.status).toBe(400); // .strict() schema rejects the unknown fields outright
    expect(mockCreate).not.toHaveBeenCalled();

    jest.dontMock('@/lib/guards');
    jest.dontMock('@/lib/rate-limit/sensitive');
    jest.dontMock('@/lib/quotes/candidate-profile-flag');
    jest.dontMock('@/lib/quotes/candidate-profile-persistence.server');
  });

  test('the quote-creation request schema accepts no productCode/entitlement/ariaAccess field either', async () => {
    jest.resetModules();
    jest.doMock('@/lib/guards', () => ({
      requireAnyRole: jest.fn().mockResolvedValue({ user: { id: 'staff-1', role: 'ASSISTANTE' } }),
      isErrorResponse: (v: unknown) => v instanceof Response,
    }));
    jest.doMock('@/lib/rate-limit/sensitive', () => ({ guardSensitiveRateLimit: jest.fn().mockResolvedValue(null) }));
    jest.doMock('@/lib/quotes/candidate-profile-flag', () => ({ getCandidateProfileWorkflowStatus: jest.fn().mockResolvedValue('ACTIVE_INTERNAL') }));
    jest.doMock('@/lib/quotes/candidate-profile-persistence.server', () => ({
      getProfilCandidatById: jest.fn().mockResolvedValue({ id: 'profil-1', contactLeadId: 'lead-1', studentId: null, level: 'TERMINALE', examSession: 2027, modalite: 'A', specialite1: 'MATHEMATIQUES', specialite2: 'NSI' }),
    }));
    const mockCreateQuote = jest.fn();
    jest.doMock('@/lib/quotes/persistence.server', () => ({ createQuote: mockCreateQuote }));

    const { POST } = await import('@/app/api/assistante/candidate-profiles/[id]/quotes/route');
    const forgedBody = {
      idempotencyKey: 'idem-1234567890',
      budget: 700,
      strategy: 'BEST_BALANCE',
      scenarioTier: 'RECOMMANDE',
      productCode: 'ARIA_ACCESS',
      entitled: true,
    };
    const req = new NextRequest('http://localhost:3000/api/assistante/candidate-profiles/profil-1/quotes', {
      method: 'POST',
      body: JSON.stringify(forgedBody),
    });
    const res = await POST(req, { params: Promise.resolve({ id: 'profil-1' }) });
    expect(res.status).toBe(400);
    expect(mockCreateQuote).not.toHaveBeenCalled();

    jest.dontMock('@/lib/guards');
    jest.dontMock('@/lib/rate-limit/sensitive');
    jest.dontMock('@/lib/quotes/candidate-profile-flag');
    jest.dontMock('@/lib/quotes/candidate-profile-persistence.server');
    jest.dontMock('@/lib/quotes/persistence.server');
  });

  test('quote acceptance (the only client-triggerable Quote status transition) never creates an Invoice, Payment, or Entitlement', () => {
    const source = read('app/api/quotes/[id]/accept/route.ts');
    expect(source).not.toMatch(/invoice/i);
    expect(source).not.toMatch(/payment/i);
    expect(source).not.toMatch(/entitlement/i);
    // Confirms the actual, current behavior: acceptance is a pure CRM status
    // transition (transitionQuoteStatus), nothing else — there is no
    // automated Quote -> Invoice -> Payment -> Entitlement bridge to bypass
    // at all today, for ANY quote (candidat-individuel or otherwise).
    expect(source).toContain('transitionQuoteStatus');
  });
});
