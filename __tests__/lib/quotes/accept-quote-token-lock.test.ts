jest.mock('server-only', () => ({}));

const mockTransaction = jest.fn();
const mockQueryRaw = jest.fn();
const mockQuoteFindUnique = jest.fn();
const mockQuoteUpdate = jest.fn();
const mockAuditCreate = jest.fn();

const tx = {
  $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
  quote: {
    findUnique: (...args: unknown[]) => mockQuoteFindUnique(...args),
    update: (...args: unknown[]) => mockQuoteUpdate(...args),
  },
  quoteAuditLog: { create: (...args: unknown[]) => mockAuditCreate(...args) },
};

jest.mock('@/lib/prisma', () => ({
  prisma: { $transaction: (...args: unknown[]) => mockTransaction(...args) },
}));

jest.mock('@/lib/quotes/emission-guard', () => ({
  assertQuoteCanBeAccepted: jest.fn(),
  assertQuoteCanBeSent: jest.fn(),
  collectFamilyLinkIssuanceBlockers: jest.fn(() => []),
  collectQuotePromotionBlockers: jest.fn(() => []),
}));

jest.mock('@/lib/quotes/snapshot.server', () => ({
  buildQuoteContextSnapshot: jest.fn(),
  generateQuotePublicToken: jest.fn(),
}));

jest.mock('@/lib/crm/contact-leads', () => ({
  captureContactLeadInTransaction: jest.fn(),
  notifyContactLeadCaptureCommitted: jest.fn(),
}));

import { acceptQuoteByPublicToken } from '@/lib/quotes/persistence.server';

const RAW_TOKEN = ['accept', 'boundary', 'sentinel'].join('-');
const current = {
  id: 'quote-1',
  publicTokenHash: 'placeholder',
  publicTokenExpiresAt: new Date(Date.now() + 60_000),
  status: 'DEVIS_CONSULTE',
  profilId: 'profil-1',
};

function lockedHash(): string | undefined {
  const query = mockQueryRaw.mock.calls[0]?.[0] as { values?: unknown[] } | undefined;
  return query?.values?.[0] as string | undefined;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockTransaction.mockImplementation(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx));
  mockQueryRaw.mockResolvedValue([{ id: 'quote-1' }]);
  mockQuoteFindUnique.mockImplementation(async () => ({ ...current, publicTokenHash: lockedHash() }));
  mockQuoteUpdate.mockResolvedValue({ ...current, status: 'ACCEPTE' });
  mockAuditCreate.mockResolvedValue({ id: 'audit-1' });
});

test('hashes and locks by the current token before accepting and auditing once', async () => {
  const result = await acceptQuoteByPublicToken(RAW_TOKEN);

  expect(result).toMatchObject({ ok: true, alreadyAccepted: false, quote: { status: 'ACCEPTE' } });
  const query = mockQueryRaw.mock.calls[0]?.[0] as { strings?: readonly string[]; values?: unknown[] };
  expect(query.strings?.join('?')).toContain('FOR UPDATE');
  expect(query.strings?.join('?')).toContain('"publicTokenHash"');
  expect(query.values).not.toContain(RAW_TOKEN);
  expect(mockQuoteUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'ACCEPTE' } }));
  expect(mockAuditCreate).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(mockAuditCreate.mock.calls)).not.toContain(RAW_TOKEN);
});

test('a second acceptance with the still-current token is idempotent without a duplicate write or audit', async () => {
  mockQuoteFindUnique.mockImplementation(async () => ({
    ...current,
    publicTokenHash: lockedHash(),
    status: 'ACCEPTE',
  }));

  await expect(acceptQuoteByPublicToken(RAW_TOKEN)).resolves.toMatchObject({
    ok: true,
    alreadyAccepted: true,
    quote: { status: 'ACCEPTE' },
  });
  expect(mockQuoteUpdate).not.toHaveBeenCalled();
  expect(mockAuditCreate).not.toHaveBeenCalled();
});

test.each([
  ['missing or rotated token', null, 'NOT_FOUND'],
  ['expired token', { ...current, publicTokenHash: 'HASH', publicTokenExpiresAt: new Date(0) }, 'EXPIRED'],
  ['refused quote', { ...current, publicTokenHash: 'HASH', status: 'REFUSE' }, 'NOT_ACCEPTABLE'],
] as const)('fails closed for %s', async (_label, quote, reason) => {
  if (quote === null) {
    mockQueryRaw.mockResolvedValue([]);
  } else {
    mockQuoteFindUnique.mockImplementation(async () => ({ ...quote, publicTokenHash: lockedHash() }));
  }

  await expect(acceptQuoteByPublicToken(RAW_TOKEN)).resolves.toEqual({ ok: false, reason });
  expect(mockQuoteUpdate).not.toHaveBeenCalled();
  expect(mockAuditCreate).not.toHaveBeenCalled();
});

test('the legacy id route quote id is checked under the token lock', async () => {
  await expect(acceptQuoteByPublicToken(RAW_TOKEN, 'different-quote')).resolves.toEqual({
    ok: false,
    reason: 'NOT_FOUND',
  });
  expect(mockQuoteUpdate).not.toHaveBeenCalled();
});
