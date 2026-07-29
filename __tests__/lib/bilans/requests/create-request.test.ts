import { createHash } from 'crypto';

import {
  GENERIC_SUCCESS_MESSAGE,
  createBilanRequestIntake,
} from '@/lib/bilans/requests/create-request';

const FLOW_RAW = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const MAGIC_RAW = 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';

jest.mock('@/lib/bilans/requests/tokens', () => ({
  createBilanFlowSessionToken: () => ({
    rawToken: FLOW_RAW,
    tokenHash: createHash('sha256').update(FLOW_RAW).digest('hex'),
    expiresAt: new Date('2026-07-29T10:30:00.000Z'),
    cookie: {
      name: 'nr_bf_s',
      value: FLOW_RAW,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        secure: false,
        path: '/bilan-gratuit',
        maxAge: 1_800,
      },
    },
  }),
  createBilanMagicLinkToken: () => ({
    rawToken: MAGIC_RAW,
    tokenHash: createHash('sha256').update(MAGIC_RAW).digest('hex'),
    expiresAt: new Date('2026-07-29T10:15:00.000Z'),
  }),
}));

const admission = {
  parent: {
    firstName: '  Amina ',
    lastName: ' Ben Salah ',
    email: '  Parent@Example.COM ',
    phone: '99 19 28 29',
  },
  child: {
    firstName: ' Lina ',
    lastName: ' Ben Salah ',
    schoolName: ' Lycée test ',
  },
  schoolYear: '2026-2027',
  level: 'TERMINALE',
  subject: 'MATHEMATIQUES',
  mainNeed: ' Consolider les automatismes. ',
  message: ' Préparer un plan de travail. ',
  consent: true,
  consentVersion: 'bilan-public-v1',
} as const;

const parentId = 'cparent000000000000000001';
const parentProfileId = 'cprofile0000000000000001';
const childUserId = 'cchilduser000000000000001';
const studentId = 'cstudent0000000000000001';
const requestId = 'crequest0000000000000001';

type FakeOptions = Readonly<{
  existingParent?: boolean;
  existingRequest?: boolean;
  failAt?: 'notification';
}>;

function fakePrisma(options: FakeOptions = {}) {
  const writes: Array<{ model: string; data: Record<string, unknown> }> = [];
  const createdRequest = {
    id: requestId,
    parentUserId: parentId,
  };

  const record = (model: string, value: unknown) => {
    const data = (value as { data: Record<string, unknown> }).data;
    writes.push({ model, data });
    return data;
  };

  const tx = {
    bilanRequest: {
      findUnique: jest.fn(async () => options.existingRequest ? createdRequest : null),
      create: jest.fn(async (value) => {
        record('bilanRequest', value);
        return createdRequest;
      }),
    },
    user: {
      findFirst: jest.fn(async () => options.existingParent ? {
        id: parentId,
        email: 'Parent@Example.COM',
        role: 'PARENT',
      } : null),
      create: jest.fn(async (value) => {
        const data = record('user', value);
        return data.role === 'PARENT'
          ? { id: parentId, ...data }
          : { id: childUserId, ...data };
      }),
    },
    parentProfile: {
      create: jest.fn(async (value) => {
        const data = record('parentProfile', value);
        return { id: parentProfileId, ...data };
      }),
    },
    student: {
      create: jest.fn(async (value) => {
        const data = record('student', value);
        return { id: studentId, ...data };
      }),
    },
    parentStudentLink: {
      create: jest.fn(async (value) => {
        const data = record('parentStudentLink', value);
        return { id: 'clink00000000000000000001', ...data };
      }),
    },
    bilanFlowSession: {
      create: jest.fn(async (value) => record('bilanFlowSession', value)),
    },
    bilanMagicLink: {
      create: jest.fn(async (value) => record('bilanMagicLink', value)),
    },
    bilanRequestEvent: {
      create: jest.fn(async (value) => record('bilanRequestEvent', value)),
    },
    notificationOutbox: {
      create: jest.fn(async (value) => {
        if (options.failAt === 'notification') {
          throw new Error('forced outbox failure');
        }
        return record('notificationOutbox', value);
      }),
    },
  };

  return {
    writes,
    tx,
    client: {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
      bilanRequest: {
        findUnique: tx.bilanRequest.findUnique,
      },
    },
  };
}

describe('createBilanRequestIntake', () => {
  it('creates a traceable inactive parent, opaque child and minimized request transaction', async () => {
    const repository = fakePrisma();

    const result = await createBilanRequestIntake({
      prisma: repository.client as never,
      admission,
      idempotencyKey: 'intake_0123456789abcdef',
      now: new Date('2026-07-29T10:00:00.000Z'),
      production: false,
    });

    expect(result.public).toEqual({
      success: true,
      message: GENERIC_SUCCESS_MESSAGE,
      next: 'ASSESSMENT_OR_EMAIL',
    });
    expect(result.internal).toMatchObject({
      requestId,
      replayed: false,
      flowSessionToken: { rawToken: FLOW_RAW },
      magicLinkToken: { rawToken: MAGIC_RAW },
    });

    const parent = repository.writes.find(({ model, data }) =>
      model === 'user' && data.role === 'PARENT')?.data;
    expect(parent).toMatchObject({
      email: 'parent@example.com',
      password: null,
      activatedAt: null,
    });

    const child = repository.writes.find(({ model, data }) =>
      model === 'user' && data.role === 'ELEVE')?.data;
    expect(child?.email).toMatch(/^child\+[a-z0-9-]{8,64}@nexus-student\.local$/);
    expect(child?.email).not.toContain('lina');
    expect(child?.email).not.toContain('salah');

    expect(repository.writes.map(({ model }) => model)).toEqual([
      'user',
      'parentProfile',
      'user',
      'student',
      'parentStudentLink',
      'bilanRequest',
      'bilanRequestEvent',
      'bilanFlowSession',
      'bilanMagicLink',
      'notificationOutbox',
    ]);
  });

  it('uses a case-insensitive existing parent without creating a duplicate user or child', async () => {
    const repository = fakePrisma({ existingParent: true });

    const result = await createBilanRequestIntake({
      prisma: repository.client as never,
      admission,
      idempotencyKey: 'intake_existing_012345',
      now: new Date('2026-07-29T10:00:00.000Z'),
      production: false,
    });

    expect(repository.tx.user.findFirst).toHaveBeenCalledWith({
      where: {
        email: {
          equals: 'parent@example.com',
          mode: 'insensitive',
        },
      },
      select: { id: true, role: true },
    });
    expect(repository.tx.user.create).not.toHaveBeenCalled();
    expect(repository.tx.student.create).not.toHaveBeenCalled();
    expect(repository.tx.parentStudentLink.create).not.toHaveBeenCalled();

    const request = repository.writes.find(({ model }) => model === 'bilanRequest')?.data;
    expect(request).toMatchObject({
      parentUserId: parentId,
      studentId: null,
      provisionalChildFirstName: 'Lina',
      provisionalChildLastName: 'Ben Salah',
      provisionalChildSchoolName: 'Lycée test',
    });
    expect(result.public).toEqual({
      success: true,
      message: GENERIC_SUCCESS_MESSAGE,
      next: 'ASSESSMENT_OR_EMAIL',
    });
    expect(result.internal.flowSessionToken?.cookie).toEqual(expect.objectContaining({
      name: 'nr_bf_s',
      options: expect.objectContaining({
        httpOnly: true,
        sameSite: 'lax',
        path: '/bilan-gratuit',
      }),
    }));
  });

  it('hashes a strictly validated idempotency key and never persists raw tokens or free text in event/outbox', async () => {
    const repository = fakePrisma();
    const idempotencyKey = 'intake_secure_0123456789';

    const result = await createBilanRequestIntake({
      prisma: repository.client as never,
      admission,
      idempotencyKey,
      now: new Date('2026-07-29T10:00:00.000Z'),
      production: false,
    });

    const request = repository.writes.find(({ model }) => model === 'bilanRequest')?.data;
    expect(request?.submissionHash).toBe(
      `sha256:${createHash('sha256').update(idempotencyKey).digest('hex')}`,
    );
    expect(request).toMatchObject({
      mainNeed: 'Consolider les automatismes.',
      message: 'Préparer un plan de travail.',
    });

    const event = repository.writes.find(({ model }) => model === 'bilanRequestEvent')?.data;
    const outbox = repository.writes.find(({ model }) => model === 'notificationOutbox')?.data;
    const minimized = JSON.stringify({ event, outbox });
    expect(minimized).not.toContain('Consolider');
    expect(minimized).not.toContain('Préparer');
    expect(minimized).not.toContain('parent@example.com');
    expect(minimized).not.toContain('Lina');

    const persisted = JSON.stringify(repository.writes);
    expect(persisted).not.toContain(idempotencyKey);
    expect(persisted).not.toContain(result.internal.flowSessionToken?.rawToken);
    expect(persisted).not.toContain(result.internal.magicLinkToken?.rawToken);
  });

  it.each([
    'short',
    'contains spaces 012345',
    'x'.repeat(129),
  ])('rejects invalid client idempotency key %p before opening a transaction', async (idempotencyKey) => {
    const repository = fakePrisma();

    await expect(createBilanRequestIntake({
      prisma: repository.client as never,
      admission,
      idempotencyKey,
    })).rejects.toThrow('Invalid bilan request idempotency key');

    expect(repository.client.$transaction).not.toHaveBeenCalled();
  });

  it('returns the same request without duplicating event, outbox, session or magic link on replay', async () => {
    const repository = fakePrisma({ existingRequest: true });

    const result = await createBilanRequestIntake({
      prisma: repository.client as never,
      admission,
      idempotencyKey: 'intake_replay_0123456789',
    });

    expect(result.public).toEqual({
      success: true,
      message: GENERIC_SUCCESS_MESSAGE,
      next: 'ASSESSMENT_OR_EMAIL',
    });
    expect(result.internal).toEqual({
      requestId,
      replayed: true,
      flowSessionToken: null,
      magicLinkToken: null,
    });
    expect(repository.writes).toEqual([]);
  });

  it('does not expose path-specific data in the public DTO', async () => {
    const freshRepository = fakePrisma();
    const existingRepository = fakePrisma({ existingParent: true });

    const [fresh, existing] = await Promise.all([
      createBilanRequestIntake({
        prisma: freshRepository.client as never,
        admission,
        idempotencyKey: 'intake_public_fresh_01',
        production: true,
      }),
      createBilanRequestIntake({
        prisma: existingRepository.client as never,
        admission,
        idempotencyKey: 'intake_public_existing_1',
        production: true,
      }),
    ]);

    expect(fresh.public).toEqual(existing.public);
    expect(fresh.internal.flowSessionToken?.cookie.options)
      .toEqual(existing.internal.flowSessionToken?.cookie.options);
    expect(Object.keys(fresh.public)).toEqual(['success', 'message', 'next']);
    expect(JSON.stringify(fresh.public)).not.toContain(requestId);
    expect(JSON.stringify(fresh.public)).not.toContain('parent');
  });

  it('propagates a transaction failure', async () => {
    const repository = fakePrisma({ failAt: 'notification' });

    await expect(createBilanRequestIntake({
      prisma: repository.client as never,
      admission,
      idempotencyKey: 'intake_failure_01234567',
    })).rejects.toThrow('forced outbox failure');
  });
});
