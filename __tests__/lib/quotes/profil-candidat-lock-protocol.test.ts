jest.mock('server-only', () => ({}));

const mockTransaction = jest.fn();
const mockQueryRaw = jest.fn();
const mockProfilFindUnique = jest.fn();
const mockProfilUpdate = jest.fn();
const mockQuoteFindFirst = jest.fn();
const mockQuoteFindUnique = jest.fn();
const mockQuoteCreate = jest.fn();
const mockAuditCreate = jest.fn();

const mockTx = {
  $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
  profilCandidat: {
    findUnique: (...args: unknown[]) => mockProfilFindUnique(...args),
    update: (...args: unknown[]) => mockProfilUpdate(...args),
  },
  quote: {
    findFirst: (...args: unknown[]) => mockQuoteFindFirst(...args),
    findUnique: (...args: unknown[]) => mockQuoteFindUnique(...args),
    create: (...args: unknown[]) => mockQuoteCreate(...args),
  },
  quoteAuditLog: {
    create: (...args: unknown[]) => mockAuditCreate(...args),
  },
};

jest.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: (...args: unknown[]) => mockTransaction(...args),
    profilCandidat: {
      findUnique: (...args: unknown[]) => mockProfilFindUnique(...args),
      update: (...args: unknown[]) => mockProfilUpdate(...args),
    },
    quote: {
      findFirst: (...args: unknown[]) => mockQuoteFindFirst(...args),
      findUnique: (...args: unknown[]) => mockQuoteFindUnique(...args),
    },
  },
}));

jest.mock('@/lib/quotes/snapshot.server', () => ({
  buildQuoteContextSnapshot: () => ({ pricingVersion: 'pricing-test', examPolicyVersion: 'exam-test' }),
  generateQuotePublicToken: () => ({ rawToken: 'raw-test-token', tokenHash: 'hash-test-token', expiresAt: new Date('2027-01-01T00:00:00.000Z') }),
}));

jest.mock('@/lib/crm/contact-leads', () => ({
  captureContactLeadInTransaction: jest.fn(),
  notifyContactLeadCaptureCommitted: jest.fn(),
}));

import { updateProfilCandidat } from '@/lib/quotes/profil-candidat.server';
import { createQuote } from '@/lib/quotes/persistence.server';
import type { QuoteScenario } from '@/lib/quotes/schemas';

const PROFIL_ID = 'profil-lock-test';
const PROFILE_VERSION = new Date('2026-08-29T08:00:00.000Z');

const VALID_DRAFT = {
  publicInput: {
    level: 'TERMINALE',
    examSession: 2027,
    modalite: 'A',
    specialite1: 'MATHEMATIQUES',
    specialite2: 'PHYSIQUE_CHIMIE',
  },
};

const SCENARIO: QuoteScenario = {
  tier: 'RECOMMANDE',
  lines: [{
    subject: 'pilotage',
    label: 'Pilotage Nexus',
    modality: 'PILOTAGE',
    hoursPerMonth: 0,
    unitPriceMonthly: 150,
    priorityScore: Number.MAX_SAFE_INTEGER,
    priorityLabel: 'haute',
    reason: 'Socle',
  }],
  notRecommended: [],
  monthlyTotal: 112,
  grandTotal: 1500,
  months: 10,
  matchedOfferId: null,
  paymentPolicy: 'ANNUAL_DEPOSIT_25_THEN_10_INSTALLMENTS',
  deposit: 380,
  lastInstallmentAmount: 112,
};

function quoteInput() {
  return {
    idempotencyKey: 'quote-lock-test',
    source: 'STAFF_WORKSPACE' as const,
    examSession: 2027,
    budget: 150,
    strategy: 'MOST_COMPLETE' as const,
    scenario: SCENARIO,
    profilId: PROFIL_ID,
    expectedProfilUpdatedAt: PROFILE_VERSION,
  };
}

function sqlText(callIndex: number): string {
  const sql = mockQueryRaw.mock.calls[callIndex]?.[0] as { strings?: readonly string[] } | undefined;
  return sql?.strings?.join('?') ?? '';
}

beforeEach(() => {
  jest.clearAllMocks();
  mockTransaction.mockImplementation(async (callback: (tx: typeof mockTx) => Promise<unknown>) => callback(mockTx));
  mockQueryRaw.mockResolvedValue([{ id: PROFIL_ID, updatedAt: PROFILE_VERSION }]);
  mockProfilFindUnique.mockResolvedValue({ id: PROFIL_ID, updatedAt: PROFILE_VERSION });
  mockProfilUpdate.mockResolvedValue({ id: PROFIL_ID, updatedAt: new Date(PROFILE_VERSION.getTime() + 1) });
  mockQuoteFindFirst.mockResolvedValue(null);
  mockQuoteFindUnique.mockResolvedValue(null);
  mockQuoteCreate.mockResolvedValue({ id: 'quote-1', status: 'ESTIMATION', lines: [] });
  mockAuditCreate.mockResolvedValue({ id: 'audit-1' });
});

describe('ProfilCandidat/Quote atomic lock protocol', () => {
  test.todo('prove the PATCH-versus-Quote race with two real PostgreSQL connections after Task 3 installs the ProfilCandidat schema');

  test('PATCH and Quote creation acquire the same profile row lock before their first write', async () => {
    await updateProfilCandidat(PROFIL_ID, VALID_DRAFT);
    await createQuote(quoteInput());

    expect(mockQueryRaw).toHaveBeenCalledTimes(2);
    expect(sqlText(0)).toContain('FROM "profils_candidats"');
    expect(sqlText(0)).toContain('FOR UPDATE');
    expect(sqlText(1)).toBe(sqlText(0));
    expect(mockQueryRaw.mock.invocationCallOrder[0]).toBeLessThan(mockProfilUpdate.mock.invocationCallOrder[0]);
    expect(mockQueryRaw.mock.invocationCallOrder[1]).toBeLessThan(mockQuoteCreate.mock.invocationCallOrder[0]);
  });

  test('Quote creation re-reads the profile version under lock and rejects a stale simulation before persistence', async () => {
    mockQueryRaw.mockResolvedValue([{
      id: PROFIL_ID,
      updatedAt: new Date(PROFILE_VERSION.getTime() + 1),
    }]);

    await expect(createQuote(quoteInput())).rejects.toThrow(/profil candidat modifié/i);

    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
    expect(mockQuoteCreate).not.toHaveBeenCalled();
    expect(mockAuditCreate).not.toHaveBeenCalled();
  });
});
