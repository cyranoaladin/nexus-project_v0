/** @jest-environment node */
jest.mock('@/lib/guards', () => ({ requireAnyRole: jest.fn(async () => ({ user: { id: 'synthetic-staff', role: 'ASSISTANTE' } })) }));
jest.mock('@/lib/email/outbox', () => ({ enqueueEmailIntent: jest.fn(async () => ({ id: 'synthetic-job' })) }));
jest.mock('@/lib/rate-limit/sensitive', () => ({ guardSensitiveRateLimit: jest.fn(async () => null) }));
jest.mock('@/lib/email/outbox-scheduler', () => ({ kickEmailOutboxDrain: jest.fn() }));
jest.mock('@/lib/prisma', () => {
  const db = { stageReservation: { findFirst: jest.fn(), updateMany: jest.fn() }, student: { findUnique: jest.fn() }, user: { update: jest.fn() } };
  return { prisma: { ...db, $transaction: jest.fn(async (callback: (tx: typeof db) => Promise<unknown>) => callback(db)) } };
});
import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { enqueueEmailIntent } from '@/lib/email/outbox';
import { POST } from '@/app/api/stages/[stageSlug]/reservations/[reservationId]/confirm/route';
const student = { id: 'synthetic-student', userId: 'synthetic-student-user', user: {
  firstName: 'Synthetic', email: 'canonical@synthetic.test', activatedAt: null,
} };
const invoke = () => POST(new NextRequest('https://nexusreussite.academy/api/stages/synthetic-stage/reservations/synthetic-reservation/confirm',
  { method: 'POST', body: JSON.stringify({ studentId: 'synthetic-student' }) }),
  { params: Promise.resolve({ stageSlug: 'synthetic-stage', reservationId: 'synthetic-reservation' }) });
beforeEach(() => {
  jest.clearAllMocks();
  process.env.NEXTAUTH_URL = 'https://nexusreussite.academy';
  jest.mocked(prisma.stageReservation.updateMany).mockResolvedValue({ count: 1 });
  jest.mocked(prisma.student.findUnique).mockResolvedValue(student as never);
  jest.mocked(prisma.stageReservation.findFirst).mockResolvedValue({ id: 'synthetic-reservation', email: 'unrelated@synthetic.test',
    parentName: 'Synthetic', richStatus: 'PENDING', stage: { title: 'Synthetic stage' } } as never);
});
test('delivers account activation only to the stored student contact, never the reservation contact', async () => {
  expect((await invoke()).status).toBe(200);
  const recipient = jest.mocked(enqueueEmailIntent).mock.calls[0][1].to;
  expect(recipient).toBe('canonical@synthetic.test');
  expect(recipient).not.toBe('unrelated@synthetic.test');
});
test.each([null, '', 'invalid-contact'])('missing/invalid canonical contact %s cannot fall back to reservation email', async email => {
  jest.mocked(prisma.student.findUnique).mockResolvedValue({ ...student, user: { ...student.user, email } } as never);
  const response = await invoke();
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({ error: 'STUDENT_CONTACT_REQUIRED' });
  expect(prisma.$transaction).not.toHaveBeenCalled();
  expect(enqueueEmailIntent).not.toHaveBeenCalled();
});
test('does not claim delivery when an activation intent is only queued', async () => {
  const response = await invoke();
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.message).toContain('file');
  expect(body.message).not.toContain('envoyé');
});
test('escapes stored names and stage titles at the HTML mail sink', async () => {
  jest.mocked(prisma.student.findUnique).mockResolvedValue({ ...student, user: { ...student.user, firstName: '<img src=x>' } } as never);
  jest.mocked(prisma.stageReservation.findFirst).mockResolvedValue({ id: 'synthetic-reservation', email: 'unrelated@synthetic.test',
    parentName: 'Synthetic', richStatus: 'PENDING', stage: { title: '<svg onload=synthetic>' } } as never);
  expect((await invoke()).status).toBe(200);
  const input = jest.mocked(enqueueEmailIntent).mock.calls[0][1];
  expect(input.html?.includes('<img') ?? false).toBe(false);
  expect(input.html?.includes('<svg') ?? false).toBe(false);
  expect(input.html?.includes('&lt;img') ?? false).toBe(true);
  expect(input.html?.includes('&lt;svg') ?? false).toBe(true);
});


test('confirmation responses cannot be cached publicly', async () => {
  const response = await invoke();
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toContain('no-store');
});
test('throttles a staff mutation before issuing account credentials', async () => {
  jest.mocked(guardSensitiveRateLimit).mockResolvedValueOnce(NextResponse.json({ error: 'Limite atteinte' }, { status: 429 }));
  expect((await invoke()).status).toBe(429);
  expect(prisma.stageReservation.findFirst).not.toHaveBeenCalled();
  expect(enqueueEmailIntent).not.toHaveBeenCalled();
});
test('bounds the actual staff request body without trusting a length header', async () => {
  const request = new NextRequest('https://nexusreussite.academy/api/stages/synthetic-stage/reservations/synthetic-reservation/confirm',
    { method: 'POST', body: JSON.stringify({ studentId: 'synthetic-student', padding: 'x'.repeat(4096) }) });
  const response = await POST(request, { params: Promise.resolve({ stageSlug: 'synthetic-stage', reservationId: 'synthetic-reservation' }) });
  expect(response.status).toBe(413);
  expect(prisma.stageReservation.findFirst).not.toHaveBeenCalled();
});
test('rejects cross-origin production confirmation before reading private records', async () => {
  const previous = process.env.NODE_ENV;
  Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', configurable: true, writable: true });
  try {
    const response = await POST(new NextRequest('https://nexusreussite.academy/api/stages/synthetic-stage/reservations/synthetic-reservation/confirm',
      { method: 'POST', headers: { Origin: 'https://untrusted.invalid' }, body: JSON.stringify({ studentId: 'synthetic-student' }) }),
      { params: Promise.resolve({ stageSlug: 'synthetic-stage', reservationId: 'synthetic-reservation' }) });
    expect(response.status).toBe(403);
    expect(prisma.stageReservation.findFirst).not.toHaveBeenCalled();
    expect(enqueueEmailIntent).not.toHaveBeenCalled();
  } finally {
    Object.defineProperty(process.env, 'NODE_ENV', { value: previous, configurable: true, writable: true });
  }
});

 test('fails closed when the throttling backend is unavailable', async () => {
  jest.mocked(guardSensitiveRateLimit).mockRejectedValueOnce(new Error('synthetic unavailable'));
  const response = await invoke();
  expect(response.status).toBe(503);
  expect(response.headers.get('cache-control')).toContain('no-store');
  expect(prisma.stageReservation.findFirst).not.toHaveBeenCalled();
});
test('rejects a changed canonical contact instead of enqueueing credentials', async () => {
  jest.mocked(prisma.user.update).mockRejectedValueOnce({ code: 'P2025' });
  const response = await invoke();
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({ error: 'STUDENT_CONTACT_CHANGED' });
  expect(enqueueEmailIntent).not.toHaveBeenCalled();
});
