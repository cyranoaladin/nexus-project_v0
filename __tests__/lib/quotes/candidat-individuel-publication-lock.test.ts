jest.mock('server-only', () => ({}));

const mockTransaction = jest.fn();
const mockQueryRaw = jest.fn();
const mockQuoteFindUnique = jest.fn();
const mockQuoteUpdate = jest.fn();
const mockAuditCount = jest.fn();
const mockAuditCreate = jest.fn();
const mockGenerateToken = jest.fn();
const mockLeadFindUnique = jest.fn();
const mockStudentFindUnique = jest.fn();

const tx = {
  $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
  $executeRawUnsafe: jest.fn().mockResolvedValue(0),
  quote: {
    findUnique: (...args: unknown[]) => mockQuoteFindUnique(...args),
    update: (...args: unknown[]) => mockQuoteUpdate(...args),
  },
  quoteAuditLog: {
    count: (...args: unknown[]) => mockAuditCount(...args),
    create: (...args: unknown[]) => mockAuditCreate(...args),
  },
  contactLead: { findUnique: (...args: unknown[]) => mockLeadFindUnique(...args) },
  student: { findUnique: (...args: unknown[]) => mockStudentFindUnique(...args) },
};

jest.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

jest.mock('@/lib/quotes/emission-guard', () => ({
  assertQuoteCanBeAccepted: jest.fn(),
  assertQuoteCanBeSent: jest.fn(),
  collectQuotePromotionBlockers: jest.fn(() => []),
  collectFamilyLinkIssuanceBlockers: jest.fn(() => []),
}));

jest.mock('@/lib/quotes/snapshot.server', () => ({
  buildQuoteContextSnapshot: jest.fn(),
  generateQuotePublicToken: () => mockGenerateToken(),
}));

jest.mock('@/lib/auth/parent-activation', () => ({
  getTrustedApplicationOrigin: () => 'https://nexus.test',
}));

jest.mock('@/lib/crm/contact-leads', () => ({
  captureContactLeadInTransaction: jest.fn(),
  notifyContactLeadCaptureCommitted: jest.fn(),
}));

import {
  issueOrRotateFamilyLink,
  promoteQuoteToFamilyVisible,
} from '@/lib/quotes/persistence.server';

const VERSION = new Date('2026-08-29T12:00:00.000Z');
const RAW_TOKEN = ['raw', 'token', 'never', 'persisted'].join('-');
const readyQuote = {
  id: 'quote-1',
  profilId: 'profil-1',
  contactLeadId: 'lead-1',
  studentId: 'student-1',
  status: 'ESTIMATION',
  regulatoryMaturity: 'LEGACY_ESTIMATE_UNVERIFIED',
  publicTokenHash: 'previous-hash',
  updatedAt: VERSION,
};

function lockSql(): string {
  const query = mockQueryRaw.mock.calls[0]?.[0] as { strings?: readonly string[] } | undefined;
  return query?.strings?.join('?') ?? '';
}

beforeEach(() => {
  jest.clearAllMocks();
  mockTransaction.mockImplementation(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx));
  mockQueryRaw.mockResolvedValue([{ id: 'quote-1' }]);
  mockQuoteFindUnique.mockResolvedValue(readyQuote);
  mockQuoteUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ ...readyQuote, ...data }));
  mockAuditCount.mockResolvedValue(0);
  mockAuditCreate.mockResolvedValue({ id: 'audit-1' });
  mockGenerateToken.mockReturnValue({
    rawToken: RAW_TOKEN,
    tokenHash: 'new-hash-only',
    expiresAt: new Date('2027-01-01T00:00:00.000Z'),
  });
  mockLeadFindUnique.mockResolvedValue({ id: 'lead-1', email: 'parent@example.test' });
  mockStudentFindUnique.mockResolvedValue({ id: 'student-1', user: { id: 'student-user-1', mergedIntoUserId: null }, parent: { user: { id: 'parent-user-1', email: 'parent@example.test', mergedIntoUserId: null } } });
});

describe('publication transaction protocol', () => {
  test('locks the Quote before atomically promoting maturity and commercial status', async () => {
    const result = await promoteQuoteToFamilyVisible('quote-1', 'staff-1');

    expect(result).toMatchObject({ ok: true, alreadyPromoted: false });
    expect(lockSql()).toContain('FROM "quotes"');
    expect(lockSql()).toContain('FOR UPDATE');
    expect(mockQueryRaw.mock.invocationCallOrder[0]).toBeLessThan(mockQuoteUpdate.mock.invocationCallOrder[0]);
    expect(mockQuoteUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        regulatoryMaturity: 'CARTE_VALIDATED_DEFINITIVE',
        status: 'DEVIS_ENVOYE',
        sentAt: expect.any(Date),
      }),
    }));
    expect(mockAuditCreate).toHaveBeenCalledTimes(1);
    expect(mockAuditCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: 'PROMOTED_TO_FAMILY_VISIBLE',
        beforeSnapshot: expect.objectContaining({ status: 'ESTIMATION' }),
        afterSnapshot: expect.objectContaining({ status: 'DEVIS_ENVOYE' }),
      }),
    }));
  });

  test('a retry after the locked transition is idempotent and creates no second audit', async () => {
    mockQuoteFindUnique.mockResolvedValue({
      ...readyQuote,
      status: 'DEVIS_ENVOYE',
      regulatoryMaturity: 'CARTE_VALIDATED_DEFINITIVE',
    });

    await expect(promoteQuoteToFamilyVisible('quote-1', 'staff-1')).resolves.toMatchObject({
      ok: true,
      alreadyPromoted: true,
    });
    expect(mockQuoteUpdate).not.toHaveBeenCalled();
    expect(mockAuditCreate).not.toHaveBeenCalled();
  });

  test('a retry after family consultation preserves DEVIS_CONSULTE without a write or duplicate audit', async () => {
    const consultedQuote = {
      ...readyQuote,
      status: 'DEVIS_CONSULTE',
      regulatoryMaturity: 'CARTE_VALIDATED_DEFINITIVE',
    };
    mockQuoteFindUnique.mockResolvedValue(consultedQuote);

    await expect(promoteQuoteToFamilyVisible('quote-1', 'staff-1')).resolves.toEqual({
      ok: true,
      quote: consultedQuote,
      alreadyPromoted: true,
    });
    expect(mockQuoteUpdate).not.toHaveBeenCalled();
    expect(mockAuditCreate).not.toHaveBeenCalled();
  });

  test('blocks publication before mutation when the canonical family pair no longer matches', async () => {
    mockStudentFindUnique.mockResolvedValue({ id: 'student-1', user: { id: 'student-user-1', mergedIntoUserId: null }, parent: { user: { id: 'parent-user-1', email: 'other@example.test', mergedIntoUserId: null } } });

    await expect(promoteQuoteToFamilyVisible('quote-1', 'staff-1')).resolves.toEqual({
      ok: false,
      reasons: ['Le rattachement responsable-élève doit être vérifié.'],
    });
    expect(mockQuoteUpdate).not.toHaveBeenCalled();
    expect(mockAuditCreate).not.toHaveBeenCalled();
  });
});

describe('family-link version protocol', () => {
  test('rejects a stale expected version under lock before generating or persisting a token', async () => {
    mockQuoteFindUnique.mockResolvedValue({
      ...readyQuote,
      status: 'DEVIS_ENVOYE',
      regulatoryMaturity: 'CARTE_VALIDATED_DEFINITIVE',
      updatedAt: new Date(VERSION.getTime() + 1),
      publicTokenHash: 'already-rotated-hash',
    });

    const result = await issueOrRotateFamilyLink('quote-1', 'staff-1', {
      updatedAt: VERSION,
      publicTokenHash: 'previous-hash',
    });

    expect(result).toEqual({ ok: false, conflict: true });
    expect(mockGenerateToken).not.toHaveBeenCalled();
    expect(mockQuoteUpdate).not.toHaveBeenCalled();
    expect(mockAuditCreate).not.toHaveBeenCalled();
  });

  test('persists only the token hash and never writes the raw token to audit', async () => {
    mockQuoteFindUnique.mockResolvedValue({
      ...readyQuote,
      status: 'DEVIS_ENVOYE',
      regulatoryMaturity: 'CARTE_VALIDATED_DEFINITIVE',
    });

    const result = await issueOrRotateFamilyLink('quote-1', 'staff-1', {
      updatedAt: VERSION,
      publicTokenHash: 'previous-hash',
    });

    expect(result).toMatchObject({ ok: true, action: 'LINK_ISSUED' });
    expect(mockQuoteUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ publicTokenHash: 'new-hash-only' }),
    }));
    expect(JSON.stringify(mockQuoteUpdate.mock.calls)).not.toContain(RAW_TOKEN);
    expect(JSON.stringify(mockAuditCreate.mock.calls)).not.toContain(RAW_TOKEN);
  });

  test.each(['DEVIS_CONSULTE', 'A_RAPPELER'] as const)(
    'rotates an existing family link while the quote is %s',
    async (status) => {
      mockQuoteFindUnique.mockResolvedValue({
        ...readyQuote,
        status,
        regulatoryMaturity: 'CARTE_VALIDATED_DEFINITIVE',
      });
      mockAuditCount.mockResolvedValue(1);

      await expect(issueOrRotateFamilyLink('quote-1', 'staff-1', {
        updatedAt: VERSION,
        publicTokenHash: 'previous-hash',
      })).resolves.toMatchObject({ ok: true, action: 'LINK_ROTATED' });

      expect(mockQuoteUpdate).toHaveBeenCalledTimes(1);
      expect(mockAuditCreate).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ action: 'LINK_ROTATED' }),
      }));
    },
  );

  test('blocks token rotation before generation when the canonical family pair no longer matches', async () => {
    mockQuoteFindUnique.mockResolvedValue({ ...readyQuote, status: 'DEVIS_ENVOYE', regulatoryMaturity: 'CARTE_VALIDATED_DEFINITIVE' });
    mockStudentFindUnique.mockResolvedValue({ id: 'student-1', user: { id: 'student-user-1', mergedIntoUserId: null }, parent: { user: { id: 'parent-user-1', email: 'other@example.test', mergedIntoUserId: null } } });

    await expect(issueOrRotateFamilyLink('quote-1', 'staff-1', {
      updatedAt: VERSION, publicTokenHash: 'previous-hash',
    })).resolves.toEqual({ ok: false, reasons: ['Le rattachement responsable-élève doit être vérifié.'] });
    expect(mockGenerateToken).not.toHaveBeenCalled();
    expect(mockQuoteUpdate).not.toHaveBeenCalled();
  });
});
