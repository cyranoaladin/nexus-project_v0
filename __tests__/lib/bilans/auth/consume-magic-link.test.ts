import { createHash } from 'crypto';

import { consumeBilanMagicLink } from '@/lib/bilans/auth/consume-magic-link';

const RAW_TOKEN = 'MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM';
const TOKEN_HASH = createHash('sha256').update(RAW_TOKEN).digest('hex');
const NOW = new Date('2026-07-29T12:00:00.000Z');
const PARENT_ID = 'cparent000000000000000001';
const STUDENT_ID = 'cstudent0000000000000001';
const REQUEST_ID = 'crequest0000000000000001';
const LINK_ID = 'cmagiclk0000000000000001';
const FAMILY_LINK_ID = 'cfamlink0000000000000001';

type FakeOptions = Readonly<{
  magic?: Partial<{
    parentUserId: string | null;
    expiresAt: Date;
    consumedAt: Date | null;
    revokedAt: Date | null;
    parentRole: string;
    requestParentUserId: string | null;
    studentId: string | null;
    verificationState: string;
    requestStatus: string;
  }>;
  familyLink?: Partial<{
    state: string;
    expiresAt: Date | null;
    revokedAt: Date | null;
  }> | null;
  consumeCounts?: number[];
  failEvent?: boolean;
}>;

function fakePrisma(options: FakeOptions = {}) {
  const magic = {
    id: LINK_ID,
    requestId: REQUEST_ID,
    parentUserId: PARENT_ID,
    expiresAt: new Date('2026-07-29T12:15:00.000Z'),
    consumedAt: null,
    revokedAt: null,
    parentUser: {
      id: PARENT_ID,
      email: 'registered.parent@example.com',
      role: options.magic?.parentRole ?? 'PARENT',
      firstName: 'Amina',
      lastName: 'Ben Salah',
      activatedAt: null,
    },
    request: {
      id: REQUEST_ID,
      parentUserId: options.magic?.requestParentUserId ?? PARENT_ID,
      studentId: options.magic?.studentId === undefined ? STUDENT_ID : options.magic.studentId,
      accountVerificationState: options.magic?.verificationState ?? 'VERIFICATION_PENDING',
      status: options.magic?.requestStatus ?? 'NEW',
    },
    ...options.magic,
  };
  const familyLink = options.familyLink === null ? null : {
    id: FAMILY_LINK_ID,
    state: options.familyLink?.state ?? 'PENDING_PARENT_CONSENT',
    expiresAt: options.familyLink?.expiresAt ?? null,
    revokedAt: options.familyLink?.revokedAt ?? null,
  };
  const consumeCounts = [...(options.consumeCounts ?? [1])];

  const tx = {
    bilanMagicLink: {
      findUnique: jest.fn(async (_arguments: unknown) => magic),
      updateMany: jest.fn(async () => ({ count: consumeCounts.shift() ?? 0 })),
    },
    parentStudentLink: {
      findFirst: jest.fn(async () => familyLink),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
    user: {
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
    bilanRequest: {
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
    bilanRequestEvent: {
      create: jest.fn(async () => {
        if (options.failEvent) throw new Error('forced event failure');
        return { id: 'cevent000000000000000001' };
      }),
    },
  };
  return {
    tx,
    client: {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    },
  };
}

describe('consumeBilanMagicLink', () => {
  it('hashes the raw token and returns only a safe parent user after the atomic transaction', async () => {
    const repository = fakePrisma();

    await expect(consumeBilanMagicLink({
      prisma: repository.client as never,
      rawToken: RAW_TOKEN,
      now: NOW,
    })).resolves.toEqual({
      id: PARENT_ID,
      email: 'registered.parent@example.com',
      role: 'PARENT',
      firstName: 'Amina',
      lastName: 'Ben Salah',
    });

    const lookup = repository.tx.bilanMagicLink.findUnique.mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
    expect(lookup.where).toEqual({ tokenHash: TOKEN_HASH });
    expect(JSON.stringify(lookup)).not.toContain(RAW_TOKEN);
    expect(repository.tx.bilanMagicLink.updateMany).toHaveBeenCalledWith({
      where: {
        id: LINK_ID,
        tokenHash: TOKEN_HASH,
        requestId: REQUEST_ID,
        parentUserId: PARENT_ID,
        consumedAt: null,
        revokedAt: null,
        expiresAt: { gt: NOW },
      },
      data: { consumedAt: NOW },
    });
    expect(repository.tx.user.updateMany).toHaveBeenCalledWith({
      where: { id: PARENT_ID, role: 'PARENT', activatedAt: null },
      data: { activatedAt: NOW },
    });
    expect(repository.tx.bilanRequest.updateMany).toHaveBeenCalledWith({
      where: {
        id: REQUEST_ID,
        parentUserId: PARENT_ID,
        accountVerificationState: 'VERIFICATION_PENDING',
        status: {
          notIn: ['CANCELLED', 'HUMAN_FOLLOWUP_REQUIRED'],
        },
      },
      data: {
        accountVerificationState: 'VERIFIED',
        lastActivityAt: NOW,
      },
    });
    expect(repository.tx.parentStudentLink.updateMany).toHaveBeenCalledWith({
      where: {
        id: FAMILY_LINK_ID,
        parentUserId: PARENT_ID,
        studentId: STUDENT_ID,
        state: 'PENDING_PARENT_CONSENT',
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: NOW } }],
      },
      data: {
        state: 'VERIFIED',
        consentedAt: NOW,
        verifiedAt: NOW,
      },
    });
    expect(repository.tx.bilanRequestEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        requestId: REQUEST_ID,
        type: 'ACCOUNT_VERIFIED',
        actor: 'PARENT_FLOW',
        payload: { methodCode: 'MAGIC_LINK' },
        occurredAt: NOW,
      }),
    });
  });

  it('rejects malformed tokens before any database lookup', async () => {
    const repository = fakePrisma();

    await expect(consumeBilanMagicLink({
      prisma: repository.client as never,
      rawToken: 'not-a-token',
      now: NOW,
    })).resolves.toBeNull();

    expect(repository.tx.bilanMagicLink.findUnique).not.toHaveBeenCalled();
    expect(repository.client.$transaction).not.toHaveBeenCalled();
  });

  it.each([
    ['expired', { expiresAt: NOW }],
    ['revoked', { revokedAt: new Date('2026-07-29T11:59:00.000Z') }],
    ['consumed', { consumedAt: new Date('2026-07-29T11:59:00.000Z') }],
    ['unbound', { parentUserId: null }],
    ['wrong role', { parentRole: 'ELEVE' }],
    ['different request parent', { requestParentUserId: 'cparent000000000000000002' }],
    ['already verified request', { verificationState: 'VERIFIED' }],
    ['cancelled request', { requestStatus: 'CANCELLED' }],
    ['human follow-up request', { requestStatus: 'HUMAN_FOLLOWUP_REQUIRED' }],
  ])('refuses an %s link without mutation', async (_label, magic) => {
    const repository = fakePrisma({ magic });

    await expect(consumeBilanMagicLink({
      prisma: repository.client as never,
      rawToken: RAW_TOKEN,
      now: NOW,
    })).resolves.toBeNull();

    expect(repository.tx.bilanMagicLink.updateMany).not.toHaveBeenCalled();
    expect(repository.tx.user.updateMany).not.toHaveBeenCalled();
    expect(repository.tx.bilanRequest.updateMany).not.toHaveBeenCalled();
    expect(repository.tx.parentStudentLink.updateMany).not.toHaveBeenCalled();
    expect(repository.tx.bilanRequestEvent.create).not.toHaveBeenCalled();
  });

  it.each([
    ['missing', null],
    ['revoked', { revokedAt: new Date('2026-07-29T11:59:00.000Z') }],
    ['expired', { expiresAt: NOW }],
    ['already verified', { state: 'VERIFIED' }],
  ])('fails closed when the student family link is %s', async (_label, familyLink) => {
    const repository = fakePrisma({ familyLink });

    await expect(consumeBilanMagicLink({
      prisma: repository.client as never,
      rawToken: RAW_TOKEN,
      now: NOW,
    })).resolves.toBeNull();

    expect(repository.tx.bilanMagicLink.updateMany).not.toHaveBeenCalled();
  });

  it('supports an existing parent request without inventing or mutating a child', async () => {
    const repository = fakePrisma({ magic: { studentId: null } });

    await expect(consumeBilanMagicLink({
      prisma: repository.client as never,
      rawToken: RAW_TOKEN,
      now: NOW,
    })).resolves.toEqual(expect.objectContaining({ id: PARENT_ID, role: 'PARENT' }));

    expect(repository.tx.parentStudentLink.findFirst).not.toHaveBeenCalled();
    expect(repository.tx.parentStudentLink.updateMany).not.toHaveBeenCalled();
  });

  it('allows only one concurrent replay to pass the conditional consumption', async () => {
    const repository = fakePrisma({ consumeCounts: [1, 0] });

    const results = await Promise.all([
      consumeBilanMagicLink({ prisma: repository.client as never, rawToken: RAW_TOKEN, now: NOW }),
      consumeBilanMagicLink({ prisma: repository.client as never, rawToken: RAW_TOKEN, now: NOW }),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);
    expect(results.filter((result) => result === null)).toHaveLength(1);
  });

  it('propagates downstream failures so the enclosing transaction can roll back consumption', async () => {
    const repository = fakePrisma({ failEvent: true });

    await expect(consumeBilanMagicLink({
      prisma: repository.client as never,
      rawToken: RAW_TOKEN,
      now: NOW,
    })).rejects.toThrow('forced event failure');

    expect(repository.tx.bilanMagicLink.updateMany).toHaveBeenCalledTimes(1);
  });
});
