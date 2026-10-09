import { NextRequest } from 'next/server';

const mockAuth = jest.fn();
const mockAuthority = jest.fn();
const mockPaymentCreate = jest.fn();
const mockPending = jest.fn();
const mockLegacyParent = jest.fn();
const mockLegacyStudent = jest.fn();
const mockNotifications = jest.fn();
jest.mock('@/auth', () => ({ auth: () => mockAuth() }));
jest.mock('@/lib/families/student-access-authority', () => ({
  resolveParentStudentAccess: (...args: unknown[]) => mockAuthority(...args),
}));
jest.mock('@/lib/prisma', () => {
  const database = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: 'synthetic-parent' }]),
    parentProfile: { findUnique: (...args: unknown[]) => mockLegacyParent(...args) },
    student: { findFirst: (...args: unknown[]) => mockLegacyStudent(...args) },
    payment: { findFirst: (...args: unknown[]) => mockPending(...args), create: (...args: unknown[]) => mockPaymentCreate(...args) },
    user: { findMany: jest.fn().mockResolvedValue([]) },
    notification: { createMany: (...args: unknown[]) => mockNotifications(...args) },
  };
  return { prisma: { ...database, $transaction: jest.fn((fn: (tx: typeof database) => unknown) => fn(database)) } };
});
import { POST } from '@/app/api/payments/bank-transfer/confirm/route';

function request(studentId = 'synthetic-student') {
  return new NextRequest('http://localhost/api/payments/bank-transfer/confirm', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'pack', key: 'GRAND_ORAL', studentId, termsAccepted: true, termsVersion: '2026-09' }),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.mockResolvedValue({ user: { id: 'synthetic-parent', role: 'PARENT' } });
  mockLegacyParent.mockResolvedValue({ id: 'synthetic-parent-profile' });
  mockLegacyStudent.mockResolvedValue({ id: 'synthetic-student' });
  mockPending.mockResolvedValue(null);
  mockPaymentCreate.mockResolvedValue({ id: 'synthetic-payment' });
});

test.each(['DENIED', 'CORE_VERIFIED_READ'])('does not turn %s into a legacy financial mutation', async status => {
  mockAuthority.mockResolvedValue({ id: 'synthetic-student', status });
  const response = await POST(request());
  expect(response.status).toBe(404);
  expect(mockAuthority).toHaveBeenCalledWith('synthetic-parent', 'synthetic-student', 'mutation');
  expect(mockLegacyParent).not.toHaveBeenCalled();
  expect(mockLegacyStudent).not.toHaveBeenCalled();
  expect(mockPending).not.toHaveBeenCalled();
  expect(mockPaymentCreate).not.toHaveBeenCalled();
  expect(mockNotifications).not.toHaveBeenCalled();
});

test('authority outage returns private 503 before legacy financial lookup or mutation', async () => {
  mockAuthority.mockResolvedValue({ id: 'synthetic-student', status: 'AUTHORITY_UNAVAILABLE' });
  const response = await POST(request());
  expect(response.status).toBe(503);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(mockPending).not.toHaveBeenCalled();
  expect(mockPaymentCreate).not.toHaveBeenCalled();
  expect(mockNotifications).not.toHaveBeenCalled();
});

test('an explicitly unmigrated legacy family can still declare its canonical-price pending transfer', async () => {
  mockAuthority.mockResolvedValue({ id: 'synthetic-student', status: 'LEGACY_ALLOWED' });
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect(mockPaymentCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ amount: 750, status: 'PENDING' }) }));
});
