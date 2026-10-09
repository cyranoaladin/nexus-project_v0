/** @jest-environment node */
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/rate-limit/sensitive', () => ({ guardSensitiveRateLimit: jest.fn().mockResolvedValue(null) }));
jest.mock('@/lib/guards', () => ({ ...jest.requireActual('@/lib/guards'), requireAuth: jest.fn() }));
jest.mock('@/lib/quotes/persistence.server', () => ({ createQuote: jest.fn() }));

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/quotes/route';
import { requireAuth } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import { createQuote } from '@/lib/quotes/persistence.server';

const ownStudentId = 'synthetic-own-student';
function request(studentId: string) {
  return new NextRequest('http://localhost:3000/api/quotes', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      idempotencyKey: 'synthetic-student-quote-key', studentId,
      situation: { level: 'terminale', examSession: 2027, specialites: ['MATHEMATIQUES', 'NSI'] },
      budget: { monthlyBudgetTnd: 1000, strategy: 'BEST_BALANCE' }, scenarioTier: 'RECOMMANDE',
      contact: { parentName: 'Parent Synthétique', studentFirstName: 'Élève Synthétique',
        whatsapp: '+21699000000', email: 'family@example.test', consent: true },
    }),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(requireAuth).mockResolvedValue({
    user: { id: 'synthetic-student-user', role: 'ELEVE', email: 'student@example.test' },
    expires: '2027-01-01T00:00:00Z',
  });
  jest.mocked(prisma.student.findUnique).mockResolvedValue({ id: ownStudentId } as never);
  jest.mocked(createQuote).mockResolvedValue({
    quote: { id: 'synthetic-quote', validUntil: new Date('2027-01-01T00:00:00Z'), lines: [] },
    rawToken: null, alreadyExisted: false,
  } as never);
});

test('an authenticated student cannot attach a quote to another student', async () => {
  expect((await POST(request('synthetic-foreign-student'))).status).toBe(403);
  expect(createQuote).not.toHaveBeenCalled();
});

test('an account without a student profile cannot attach an arbitrary student', async () => {
  jest.mocked(prisma.student.findUnique).mockResolvedValue(null);
  expect((await POST(request(ownStudentId))).status).toBe(403);
  expect(createQuote).not.toHaveBeenCalled();
});

test('the student profile is resolved by authenticated user identity, before quote persistence', async () => {
  expect((await POST(request(ownStudentId))).status).toBe(200);
  expect(prisma.student.findUnique).toHaveBeenCalledWith({
    where: { userId: 'synthetic-student-user' }, select: { id: true },
  });
  expect(createQuote).toHaveBeenCalledWith(expect.objectContaining({ studentId: ownStudentId }));
});

test('an unavailable identity store refuses persistence without exposing the driver error', async () => {
  jest.mocked(prisma.student.findUnique).mockRejectedValue(new Error('SYNTHETIC_PRIVATE_DRIVER_DETAIL'));
  const response = await POST(request(ownStudentId));
  expect(response.status).toBe(503);
  expect(JSON.stringify(await response.json())).not.toContain('SYNTHETIC_PRIVATE_DRIVER_DETAIL');
  expect(createQuote).not.toHaveBeenCalled();
});
