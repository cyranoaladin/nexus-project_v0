import { completePaperEntryParentEmail } from '@/lib/bilans/staff/parent-contact-service';

jest.mock('@/lib/email/outbox', () => ({ enqueueEmailIntent: jest.fn(async () => undefined) }));
jest.mock('@/lib/email/outbox-scheduler', () => ({ kickEmailOutboxDrain: jest.fn() }));

import { enqueueEmailIntent } from '@/lib/email/outbox';

const enqueue = enqueueEmailIntent as jest.MockedFunction<typeof enqueueEmailIntent>;
const NOW = new Date('2026-08-09T10:00:00.000Z');

beforeEach(() => enqueue.mockClear());

function household() {
  return {
    id: 'revision-1',
    checksum: 'snapshot-checksum',
    contentJson: { immutable: true },
    reportArtifact: {
      student: {
        id: 'student-1',
        parent: {
          id: 'source-profile',
          children: [{ id: 'student-1' }, { id: 'student-2' }],
          user: {
            id: 'source-parent',
            role: 'PARENT',
            email: null,
            firstName: 'Claire',
            lastName: 'Bernard',
            activatedAt: null,
          },
        },
      },
    },
  };
}

function memoryDatabase(existingByEmail: Record<string, unknown> | null = null) {
  const revision = household();
  const beforeSnapshot = JSON.stringify({ checksum: revision.checksum, contentJson: revision.contentJson });
  const transaction = {
    reportRevision: {
      findUnique: jest.fn(async () => revision),
    },
    user: {
      findUnique: jest.fn(async () => existingByEmail),
      update: jest.fn(async ({ where, data }: { where: object; data: object }) => ({ ...where, ...data })),
      create: jest.fn(),
    },
    parentProfile: {
      create: jest.fn(async ({ data }: { data: { userId: string } }) => ({ id: 'target-profile-new', ...data })),
    },
    student: {
      updateMany: jest.fn(async () => ({ count: 2 })),
    },
  };
  const database = {
    $transaction: jest.fn(async (action: (tx: unknown) => Promise<unknown>) => action(transaction)),
  };
  return { database, transaction, revision, beforeSnapshot };
}

const actor = { userId: 'assistante-1', role: 'ASSISTANTE' } as const;

describe('complétion différée de l’e-mail parent', () => {
  it('complète le compte courant, met l’activation en file et ne touche pas au snapshot', async () => {
    const { database, transaction, revision, beforeSnapshot } = memoryDatabase();
    const synchronizeConsent = jest.fn();

    await expect(completePaperEntryParentEmail({
      ...actor,
      revisionId: 'revision-1',
      email: ' Parent.Test@example.test ',
    }, {
      prisma: database as never,
      now: () => NOW,
      synchronizeConsent,
    })).resolves.toEqual({
      parentUserId: 'source-parent',
      attachedExisting: false,
      activationQueued: true,
    });

    expect(transaction.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'source-parent' },
      data: expect.objectContaining({
        email: 'parent.test@example.test',
        activationToken: expect.any(String),
        activationExpiry: expect.any(Date),
        sessionVersion: { increment: 1 },
      }),
    }));
    expect(enqueue).toHaveBeenCalledWith(transaction, expect.objectContaining({
      aggregateId: 'source-parent',
      messageType: 'PARENT_ACTIVATION',
      to: 'parent.test@example.test',
    }));
    expect(transaction.student.updateMany).not.toHaveBeenCalled();
    expect(synchronizeConsent).not.toHaveBeenCalled();
    expect(JSON.stringify({ checksum: revision.checksum, contentJson: revision.contentJson })).toBe(beforeSnapshot);
  });

  it('rattache tous les élèves à un parent existant sans créer de doublon', async () => {
    const existing = {
      id: 'target-parent',
      role: 'PARENT',
      email: 'parent.test@example.test',
      activatedAt: NOW,
      parentProfile: { id: 'target-profile' },
    };
    const { database, transaction } = memoryDatabase(existing);
    const synchronizeConsent = jest.fn(async () => undefined);

    await expect(completePaperEntryParentEmail({
      ...actor,
      revisionId: 'revision-1',
      email: 'parent.test@example.test',
    }, {
      prisma: database as never,
      now: () => NOW,
      synchronizeConsent,
    })).resolves.toEqual({
      parentUserId: 'target-parent',
      attachedExisting: true,
      activationQueued: false,
    });

    expect(transaction.user.create).not.toHaveBeenCalled();
    expect(transaction.student.updateMany).toHaveBeenCalledWith({
      where: { parentId: 'source-profile' },
      data: { parentId: 'target-profile' },
    });
    expect(synchronizeConsent).toHaveBeenCalledTimes(2);
    expect(synchronizeConsent).toHaveBeenNthCalledWith(1, transaction, {
      parentUserId: 'target-parent',
      studentId: 'student-1',
      now: NOW,
    });
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('refuse un rôle non assistante avant toute lecture', async () => {
    const { database, transaction } = memoryDatabase();
    await expect(completePaperEntryParentEmail({
      userId: 'parent-1',
      role: 'PARENT',
      revisionId: 'revision-1',
      email: 'parent.test@example.test',
    }, { prisma: database as never, now: () => NOW, synchronizeConsent: jest.fn() }))
      .rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(transaction.reportRevision.findUnique).not.toHaveBeenCalled();
  });
});
