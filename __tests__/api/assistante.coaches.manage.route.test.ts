/**
 * P0 — a concurrent assistant edit must not let a coach's email change without
 * revoking sessions. The "did the email change" decision must be based on the
 * row actually being mutated (read atomically inside the same transaction),
 * not a before/after snapshot taken outside the transaction that a concurrent
 * request can race.
 */
jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

import { auth } from '@/auth';
import { NextRequest } from 'next/server';
import { PUT } from '@/app/api/assistante/coaches/manage/[id]/route';

const mockAuth = auth as jest.Mock;
let prisma: any;

beforeEach(async () => {
  const mod = await import('@/lib/prisma');
  prisma = (mod as any).prisma;
  jest.clearAllMocks();
  mockAuth.mockResolvedValue({
    user: { id: 'assistante-1', role: 'ASSISTANTE', email: 'assistante@nexus.test' },
  });
});

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    firstName: 'Coach',
    lastName: 'Test',
    email: 'new@example.com',
    pseudonym: 'CoachTest',
    tag: 'maths',
    description: 'Description suffisamment longue pour valider.',
    philosophy: 'Philosophie suffisamment longue pour valider.',
    expertise: 'Expertise suffisamment longue pour valider.',
    subjects: ['MATHEMATIQUES'],
    availableOnline: true,
    availableInPerson: false,
    ...overrides,
  };
}

function request(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/assistante/coaches/manage/coach-1', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

function params() {
  return { params: Promise.resolve({ id: 'coach-1' }) };
}

/**
 * @param outerSnapshotEmail email visible to the outer (pre-transaction) `existingCoach` read.
 * @param lockedRowEmail email returned by the atomic `SELECT ... FOR UPDATE` read inside the transaction.
 */
function setupCoach(outerSnapshotEmail: string, lockedRowEmail: string) {
  prisma.coachProfile.findUnique
    .mockResolvedValueOnce({
      userId: 'coach-1',
      pseudonym: 'OldPseudo',
      user: { id: 'coach-1', email: outerSnapshotEmail },
    })
    .mockResolvedValueOnce(null); // pseudonym-clash check: no clash
  prisma.user.findUnique.mockResolvedValue(null); // email-conflict pre-check: no clash
  prisma.$queryRaw.mockResolvedValue([{ email: lockedRowEmail }]);
  prisma.user.update.mockResolvedValue({ id: 'coach-1', firstName: 'Coach', lastName: 'Test', email: 'new@example.com' });
  prisma.coachProfile.update.mockResolvedValue({ pseudonym: 'CoachTest' });
}

describe('PUT /api/assistante/coaches/manage/[id] — atomic email-change session revocation', () => {
  it('revokes sessions on a normal (non-concurrent) email change', async () => {
    setupCoach('old@example.com', 'old@example.com');

    const response = await PUT(request(validBody({ email: 'new@example.com' })), params());

    expect(response.status).toBe(200);
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ sessionVersion: { increment: 1 } }),
    }));
  });

  it('does not revoke sessions when the target email equals the current (locked) row email', async () => {
    setupCoach('same@example.com', 'same@example.com');

    const response = await PUT(request(validBody({ email: 'same@example.com' })), params());

    expect(response.status).toBe(200);
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.not.objectContaining({ sessionVersion: expect.anything() }),
    }));
  });

  it('revokes sessions using the LOCKED read even when the stale outer snapshot already equals the target', async () => {
    // Outer read snapshot ("existingCoach.user.email") is stale and already
    // equals the target email, so a before/after comparison against that
    // stale snapshot alone would (wrongly) skip revocation. The atomic
    // locked read inside the transaction shows the row is still at a
    // DIFFERENT email — a concurrent request could have changed it back and
    // forth, or the outer snapshot could simply be stale by the time this
    // transaction runs. The target differs from the locked current value, so
    // sessions MUST be revoked.
    setupCoach('new@example.com', 'old@example.com');

    const response = await PUT(request(validBody({ email: 'new@example.com' })), params());

    expect(response.status).toBe(200);
    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ sessionVersion: { increment: 1 } }),
    }));
  });

  it('does not revoke sessions when the stale outer snapshot differs but the LOCKED row already matches the target', async () => {
    // Mirror image of the previous case: the outer snapshot looks like a
    // change happened ("old" -> "new"), but the atomic locked read shows the
    // row is already at the target email (e.g. a concurrent request already
    // applied — and revoked for — this exact change). Revoking twice for the
    // same transition is unnecessary; the decision must follow the locked
    // read, not the stale outer snapshot.
    setupCoach('old@example.com', 'new@example.com');

    const response = await PUT(request(validBody({ email: 'new@example.com' })), params());

    expect(response.status).toBe(200);
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.not.objectContaining({ sessionVersion: expect.anything() }),
    }));
  });

  it('always revokes sessions when a new password is provided, regardless of email', async () => {
    setupCoach('same@example.com', 'same@example.com');

    const response = await PUT(
      request(validBody({ email: 'same@example.com', password: 'NewPassw0rd!' })),
      params(),
    );

    expect(response.status).toBe(200);
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ sessionVersion: { increment: 1 } }),
    }));
  });

  it('locks the row (FOR UPDATE) before deciding whether to revoke sessions', async () => {
    setupCoach('old@example.com', 'old@example.com');

    await PUT(request(validBody({ email: 'new@example.com' })), params());

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    const sql = prisma.$queryRaw.mock.calls[0][0] as { strings?: readonly string[] };
    expect(sql.strings?.join('?')).toContain('FOR UPDATE');
    expect(sql.strings?.join('?')).toContain('users');

    const lockOrder = prisma.$queryRaw.mock.invocationCallOrder[0];
    const updateOrder = prisma.user.update.mock.invocationCallOrder[0];
    expect(lockOrder).toBeLessThan(updateOrder);
  });

  it('normalizes email before conflict checks, locking comparison and update', async () => {
    setupCoach('old@example.com', 'old@example.com');

    const response = await PUT(
      request(validBody({ email: '  NEW@EXAMPLE.COM  ' })),
      params(),
    );

    expect(response.status).toBe(200);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: 'new@example.com' } });
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ email: 'new@example.com' }),
    }));
  });
});
