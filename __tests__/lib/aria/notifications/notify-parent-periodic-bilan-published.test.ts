/**
 * Unit coverage for lib/aria/notifications/notify-parent-periodic-bilan-published.ts.
 * The real-DB suite (__tests__/db/aria-periodic-bilan.real.test.ts) proves
 * this against a genuine Postgres, but that suite is excluded from the
 * ARIA coverage gate (testPathIgnorePatterns: ['\\.real\\.test']) — this
 * file exists so the gate's own branch-coverage threshold actually
 * reflects this module's real branches (missing NEXTAUTH_URL, the
 * scoped P2002 dedupe-key check, the parentReporting tier gate) instead
 * of counting them as entirely unexercised.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  resolvePeriodicBilanNotificationIntent,
  enqueuePeriodicBilanNotification,
  isDuplicateNotificationError,
} from '@/lib/aria/notifications/notify-parent-periodic-bilan-published';

const ACTIVE_SUIVI_ENTITLEMENT = {
  id: 'entitlement-1',
  productCode: 'ARIA_ACCESS',
  status: 'ACTIVE' as const,
  startsAt: new Date('2020-01-01'),
  endsAt: null,
  ariaTier: 'ARIA_SUIVI' as const,
  ariaScopes: [{ kind: 'GLOBAL' as const, courseKey: null }],
};

const ACTIVE_AUTONOMIE_ENTITLEMENT = {
  ...ACTIVE_SUIVI_ENTITLEMENT,
  id: 'entitlement-2',
  ariaTier: 'ARIA_AUTONOMIE' as const,
};

function mockStudent(overrides: Partial<{
  entitlements: unknown[];
  parentUser: { id: string; email: string | null; firstName: string | null; lastName: string | null } | null;
  studentFirstName: string | null;
}> = {}) {
  const parentUser = overrides.parentUser !== undefined
    ? overrides.parentUser
    : { id: 'parent-1', email: 'parent@test.local', firstName: 'Marie', lastName: 'Dupont' };
  (prisma.student.findUnique as jest.Mock).mockResolvedValue({
    user: {
      firstName: overrides.studentFirstName !== undefined ? overrides.studentFirstName : 'Yasmine',
      entitlements: overrides.entitlements ?? [ACTIVE_SUIVI_ENTITLEMENT],
    },
    parent: { user: parentUser },
  });
}

describe('resolvePeriodicBilanNotificationIntent', () => {
  const previousNextAuthUrl = process.env.NEXTAUTH_URL;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXTAUTH_URL = 'https://app.test.local';
  });

  afterAll(() => {
    if (previousNextAuthUrl === undefined) delete process.env.NEXTAUTH_URL;
    else process.env.NEXTAUTH_URL = previousNextAuthUrl;
  });

  it('builds a notification intent for a real, eligible family', async () => {
    mockStudent();

    const intent = await resolvePeriodicBilanNotificationIntent({
      bilanId: 'bilan-1',
      studentId: 'student-1',
      subject: 'MATHEMATIQUES',
    });

    expect(intent).not.toBeNull();
    expect(intent?.parentUserId).toBe('parent-1');
    expect(intent?.parentEmail).toBe('parent@test.local');
    expect(intent?.dedupeKey).toBe('aria-periodic-bilan-published:bilan-1');
    expect(intent?.html).toContain('Yasmine');
  });

  it('returns null when the child ARIA tier does not include parentReporting (ARIA_AUTONOMIE)', async () => {
    mockStudent({ entitlements: [ACTIVE_AUTONOMIE_ENTITLEMENT] });

    const intent = await resolvePeriodicBilanNotificationIntent({
      bilanId: 'bilan-1',
      studentId: 'student-1',
      subject: 'MATHEMATIQUES',
    });

    expect(intent).toBeNull();
  });

  it('returns null when there is no real parent contact (defensive — should not happen for an activated family)', async () => {
    mockStudent({ parentUser: null });

    const intent = await resolvePeriodicBilanNotificationIntent({
      bilanId: 'bilan-1',
      studentId: 'student-1',
      subject: 'MATHEMATIQUES',
    });

    expect(intent).toBeNull();
  });

  it('returns null when the parent has no usable email', async () => {
    mockStudent({ parentUser: { id: 'parent-1', email: null, firstName: 'Marie', lastName: 'Dupont' } });

    const intent = await resolvePeriodicBilanNotificationIntent({
      bilanId: 'bilan-1',
      studentId: 'student-1',
      subject: 'MATHEMATIQUES',
    });

    expect(intent).toBeNull();
  });

  it('fails loudly instead of falling back to a hardcoded domain when NEXTAUTH_URL is absent', async () => {
    delete process.env.NEXTAUTH_URL;
    mockStudent();

    await expect(resolvePeriodicBilanNotificationIntent({
      bilanId: 'bilan-1',
      studentId: 'student-1',
      subject: 'MATHEMATIQUES',
    })).rejects.toThrow('NEXTAUTH_URL_REQUIRED_FOR_PARENT_NOTIFICATION_EMAIL');
  });

  it('reads the entitlement snapshot through the caller-provided transaction client, not only the global prisma client', async () => {
    const txStudentFindUnique = jest.fn().mockResolvedValue({
      user: { firstName: 'Karim', entitlements: [ACTIVE_SUIVI_ENTITLEMENT] },
      parent: { user: { id: 'parent-2', email: 'parent2@test.local', firstName: 'Ali', lastName: 'Ben' } },
    });
    const fakeTransaction = { student: { findUnique: txStudentFindUnique } } as unknown as Prisma.TransactionClient;

    const intent = await resolvePeriodicBilanNotificationIntent(
      { bilanId: 'bilan-2', studentId: 'student-2', subject: 'NSI' },
      fakeTransaction,
    );

    expect(txStudentFindUnique).toHaveBeenCalledTimes(1);
    expect(prisma.student.findUnique).not.toHaveBeenCalled();
    expect(intent?.parentUserId).toBe('parent-2');
  });
});

describe('enqueuePeriodicBilanNotification', () => {
  it('enqueues an email intent with the dedupeKey as the message identity', async () => {
    const jobOutboxCreate = jest.fn().mockResolvedValue({ id: 'job-1', sourceEventKey: 'evt-1' });
    const fakeTransaction = { jobOutbox: { create: jobOutboxCreate } } as unknown as Prisma.TransactionClient;

    await enqueuePeriodicBilanNotification(fakeTransaction, {
      parentUserId: 'parent-1',
      parentEmail: 'parent@test.local',
      dedupeKey: 'aria-periodic-bilan-published:bilan-1',
      subject: 'Bilan publié',
      html: '<p>Bilan</p>',
      text: 'Bilan',
    });

    expect(jobOutboxCreate).toHaveBeenCalledTimes(1);
    expect(jobOutboxCreate.mock.calls[0][0].data.aggregateId).toBe('parent-1');
  });
});

describe('isDuplicateNotificationError', () => {
  it('is false for a non-Prisma error', () => {
    expect(isDuplicateNotificationError(new Error('boom'))).toBe(false);
  });

  it('is false for a Prisma error that is not P2002', () => {
    const error = new Prisma.PrismaClientKnownRequestError('Foreign key constraint violated', {
      code: 'P2003',
      clientVersion: 'test',
    });
    expect(isDuplicateNotificationError(error)).toBe(false);
  });

  it('is false for a P2002 on an unrelated constraint — never swallows an unrelated unique-constraint failure', () => {
    const error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: 'test',
      meta: { modelName: 'SomeOtherModel', target: ['someOtherColumn'] },
    });
    expect(isDuplicateNotificationError(error)).toBe(false);
  });

  it('is true for the exact outbox dedupe-key collision (array target)', () => {
    const error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: 'test',
      meta: { modelName: 'JobOutbox', target: ['idempotencyKey'] },
    });
    expect(isDuplicateNotificationError(error)).toBe(true);
  });

  it('is true for the exact outbox dedupe-key collision (string target)', () => {
    const error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: 'test',
      meta: { modelName: 'JobOutbox', target: 'idempotencyKey' },
    });
    expect(isDuplicateNotificationError(error)).toBe(true);
  });

  it('is false for a P2002 with no meta.target at all', () => {
    const error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: 'test',
    });
    expect(isDuplicateNotificationError(error)).toBe(false);
  });
});
