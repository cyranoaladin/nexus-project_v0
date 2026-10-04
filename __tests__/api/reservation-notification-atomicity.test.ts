/** @jest-environment node */
const mockCreate = jest.fn();
const mockTransaction = jest.fn();
const mockFind = jest.fn();
const mockEnqueue = jest.fn();
const mockDrain = jest.fn();
const mockLockedStage = jest.fn();
const mockCatalogLock = jest.fn();
const transaction = { stageReservation: { create: mockCreate }, jobOutbox: {},
  stage: { findUnique: mockLockedStage }, $queryRaw: mockCatalogLock };
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/prisma', () => ({ prisma: {
  stage: { findUnique: jest.fn(async () => ({ id: 'synthetic-stage', slug: 'synthetic-atomic', title: 'Synthetic Stage', priceAmount: 42 })) },
  stageReservation: { findUnique: (...args: unknown[]) => mockFind(...args), create: (...args: unknown[]) => mockCreate(...args) },
  $transaction: (...args: unknown[]) => mockTransaction(...args),
} }));
jest.mock('@/lib/email', () => ({ buildStageBankTransferAcknowledgment: jest.fn(() => ({
  subject: 'Synthetic bank acknowledgment', html: '<p>Synthetic acknowledgment</p>',
})) }));
jest.mock('@/lib/email/outbox', () => ({ enqueueEmailIntent: (...args: unknown[]) => mockEnqueue(...args) }));
jest.mock('@/lib/email/outbox-scheduler', () => ({ kickEmailOutboxDrain: () => mockDrain() }));
jest.mock('@/lib/rate-limit/sensitive', () => ({ guardSensitiveRateLimit: jest.fn(async () => null) }));
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/reservation/route';
const request = (paymentMethod?: string) => new NextRequest('http://localhost:3000/api/reservation', { method: 'POST', body: JSON.stringify({
  parent: 'Synthetic Parent', email: 'synthetic-atomic@example.test', phone: '55000003', classe: 'Terminale',
  academyId: 'synthetic-atomic', academyTitle: 'Untrusted title', price: 1, paymentMethod,
}) });
beforeEach(() => {
  jest.clearAllMocks();
  mockFind.mockResolvedValue(null);
  mockCreate.mockResolvedValue({ id: 'synthetic-lead' });
  mockTransaction.mockImplementation(async (callback: (tx: typeof transaction) => Promise<unknown>) => callback(transaction));
  mockEnqueue.mockResolvedValue({ id: 'synthetic-intent' });
  mockCatalogLock.mockReset().mockResolvedValue([{ id: 'synthetic-stage' }]);
  mockLockedStage.mockReset().mockResolvedValue({ id: 'synthetic-stage', slug: 'synthetic-atomic', title: 'Synthetic Stage', priceAmount: 42 });
});

test('persists the internal intent in the lead transaction before draining', async () => {
  mockEnqueue.mockImplementation(async (tx: unknown) => {
    expect(tx === transaction).toBe(true);
    expect(mockDrain).not.toHaveBeenCalled();
    return { id: 'synthetic-intent' };
  });
  expect((await POST(request())).status).toBe(201);
  expect(mockTransaction).toHaveBeenCalledTimes(1);
  expect(mockEnqueue.mock.calls[0][1].dedupeKey).toBe('reservation-internal:synthetic-lead:created:v1');
  expect(mockDrain).toHaveBeenCalledTimes(1);
});

test('does not acknowledge creation when the required intent cannot persist', async () => {
  mockEnqueue.mockRejectedValueOnce(new Error('synthetic-intent-unavailable'));
  expect((await POST(request())).status).toBe(500);
  expect(mockDrain).not.toHaveBeenCalled();
});

test('an outbox unique conflict is not proof of an existing reservation', async () => {
  mockEnqueue.mockRejectedValueOnce({ code: 'P2002' });
  expect((await POST(request())).status).toBe(500);
  expect(mockDrain).not.toHaveBeenCalled();
});

test('bank-transfer intents share the transaction and both persist before draining', async () => {
  expect((await POST(request('bank_transfer'))).status).toBe(201);
  expect(mockEnqueue).toHaveBeenCalledTimes(2);
  expect(mockEnqueue.mock.calls.every(([tx]) => tx === transaction)).toBe(true);
  expect(mockEnqueue.mock.calls[1][1].dedupeKey).toBe('reservation-bank-transfer:synthetic-lead:created:v1');
  expect(mockCreate.mock.calls[0][0].data.status).toBe('PENDING_BANK_TRANSFER');
  expect(mockDrain).toHaveBeenCalledTimes(1);
});

test('failure of the second required intent refuses success and does not drain', async () => {
  mockEnqueue.mockResolvedValueOnce({ id: 'synthetic-internal' }).mockRejectedValueOnce(new Error('synthetic-bank-intent-unavailable'));
  expect((await POST(request('bank_transfer'))).status).toBe(500);
  expect(mockEnqueue).toHaveBeenCalledTimes(2);
  expect(mockDrain).not.toHaveBeenCalled();
});

test('reads canonical title and price after locking the catalog at commit', async () => {
  mockLockedStage.mockResolvedValueOnce({ id: 'synthetic-stage', slug: 'synthetic-atomic', title: 'New canonical title', priceAmount: 84 });
  expect((await POST(request())).status).toBe(201);
  expect(mockCatalogLock).toHaveBeenCalledTimes(1);
  expect(mockCreate.mock.calls[0][0].data).toMatchObject({ academyTitle: 'New canonical title', price: 84 });
  expect(mockEnqueue.mock.calls[0][1].text.includes('New canonical title')).toBe(true);
});

test('a stage closed before commit cannot create a lead or notification', async () => {
  mockLockedStage.mockResolvedValueOnce(null);
  expect((await POST(request())).status).toBe(404);
  expect(mockCreate).not.toHaveBeenCalled();
  expect(mockEnqueue).not.toHaveBeenCalled();
  expect(mockDrain).not.toHaveBeenCalled();
});

test('a stage removed before its lock cannot create a lead', async () => {
  mockCatalogLock.mockResolvedValueOnce([]);
  expect((await POST(request())).status).toBe(404);
  expect(mockLockedStage).not.toHaveBeenCalled();
  expect(mockCreate).not.toHaveBeenCalled();
});
