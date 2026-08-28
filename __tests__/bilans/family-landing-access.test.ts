import { createHash } from 'node:crypto';

jest.mock('@/lib/email/outbox', () => ({
  enqueueEmailIntent: jest.fn(async () => ({ enqueued: true })),
}));

import { enqueueEmailIntent } from '@/lib/email/outbox';
import {
  FamilyAccessError,
  attachParentEmailFromShareToken,
  readParentAccessState,
} from '@/lib/bilans/family-landing/access';

/**
 * Création d'accès parent depuis le lien signé.
 *
 * Preuves : l'adresse ne se rattache qu'à un compte SANS e-mail (jamais
 * d'écrasement), l'activation part par l'outbox existante (même messageType,
 * dedupeKey = empreinte du jeton), l'unicité d'adresse est respectée, et un
 * lien invalide ne touche jamais le compte.
 */

const NOW = new Date('2026-08-13T10:00:00Z');
const mockedEnqueue = enqueueEmailIntent as jest.Mock;

function harness(userOverrides: Record<string, unknown> = {}) {
  const secret = 'a'.repeat(43);
  const link = {
    id: 'link-1',
    audience: 'PARENTS',
    tokenHash: createHash('sha256').update(secret, 'utf8').digest('hex'),
    expiresAt: new Date(NOW.getTime() + 86_400_000),
    revokedAt: null,
    recipientUserId: 'parent-user-1',
    reportArtifact: {
      id: 'artifact-1',
      status: 'PUBLISHED',
      currentPublishedRevisionId: 'revision-1',
      studentId: 'student-1',
      student: { user: { firstName: 'Kamel' } },
    },
  };
  const user = {
    id: 'parent-user-1',
    email: null as string | null,
    firstName: 'Alaeddine',
    lastName: 'Ben Rhouma',
    activatedAt: null as Date | null,
    ...userOverrides,
  };
  const updates: unknown[] = [];
  const transaction = {
    user: {
      findUnique: jest.fn(async () => user),
      update: jest.fn(async (args: unknown) => { updates.push(args); return user; }),
    },
  };
  const database = {
    reportShareLink: { findUnique: jest.fn(async () => link) },
    user: { findUnique: jest.fn(async () => user) },
    $transaction: jest.fn(async (action: (t: typeof transaction) => Promise<unknown>) => action(transaction)),
  };
  return { database, transaction, updates, token: `link-1.${secret}` };
}

beforeEach(() => {
  mockedEnqueue.mockClear();
  process.env.NEXTAUTH_URL = 'https://nexusreussite.academy';
});

describe('attachParentEmailFromShareToken', () => {
  it('rattache l’adresse, pose le jeton d’activation et enfile l’e-mail PARENT_ACTIVATION', async () => {
    const { database, updates, token } = harness();
    const result = await attachParentEmailFromShareToken(token, 'Parent@Exemple.FR', {
      prisma: database as never,
      now: () => NOW,
    });

    expect(result).toEqual({ activationQueued: true });
    const update = updates[0] as { where: { id: string }; data: Record<string, unknown> };
    expect(update.where).toEqual({ id: 'parent-user-1' });
    expect(update.data.email).toBe('parent@exemple.fr');
    expect(typeof update.data.activationToken).toBe('string');
    expect(update.data.sessionVersion).toEqual({ increment: 1 });

    expect(mockedEnqueue).toHaveBeenCalledTimes(1);
    const intent = mockedEnqueue.mock.calls[0][1];
    expect(intent.messageType).toBe('PARENT_ACTIVATION');
    expect(intent.to).toBe('parent@exemple.fr');
    expect(intent.dedupeKey).toBe(update.data.activationToken);
    expect(intent.html).toContain('Kamel');
  });

  it('même adresse sur un compte ACTIVÉ : aucun renvoi', async () => {
    const { database, token } = harness({ email: 'parent@exemple.fr', activatedAt: NOW });
    const result = await attachParentEmailFromShareToken(token, 'parent@exemple.fr', {
      prisma: database as never,
      now: () => NOW,
    });
    expect(result).toEqual({ activationQueued: false });
    expect(mockedEnqueue).not.toHaveBeenCalled();
  });

  it('même adresse sur un compte NON activé : RENVOIE l’activation (fin du cul-de-sac)', async () => {
    const { database, token } = harness({ email: 'parent@exemple.fr' });
    const result = await attachParentEmailFromShareToken(token, 'parent@exemple.fr', {
      prisma: database as never,
      now: () => NOW,
    });
    expect(result).toEqual({ activationQueued: true });
    expect(mockedEnqueue).toHaveBeenCalledTimes(1);
    expect(mockedEnqueue.mock.calls[0][1].messageType).toBe('PARENT_ACTIVATION');
  });

  it('GARDE : refuse d’écraser une adresse différente déjà posée', async () => {
    const { database, updates, token } = harness({ email: 'autre@exemple.fr' });
    await expect(attachParentEmailFromShareToken(token, 'parent@exemple.fr', {
      prisma: database as never,
      now: () => NOW,
    })).rejects.toMatchObject({ code: 'PARENT_EMAIL_ALREADY_SET' });
    expect(updates).toHaveLength(0);
  });

  it('traduit la contrainte d’unicité (P2002) en EMAIL_ALREADY_USED', async () => {
    const { database, transaction, token } = harness();
    (transaction.user.update as jest.Mock).mockRejectedValue(Object.assign(new Error('unique'), { code: 'P2002' }));
    await expect(attachParentEmailFromShareToken(token, 'pris@exemple.fr', {
      prisma: database as never,
      now: () => NOW,
    })).rejects.toMatchObject({ code: 'EMAIL_ALREADY_USED' });
  });

  it('refuse une adresse malformée sans toucher la base', async () => {
    const { database, token } = harness();
    await expect(attachParentEmailFromShareToken(token, 'pas-une-adresse', {
      prisma: database as never,
      now: () => NOW,
    })).rejects.toMatchObject({ code: 'EMAIL_INVALID' });
    expect((database.$transaction as jest.Mock)).not.toHaveBeenCalled();
  });

  it('GARDE : un jeton invalide ne touche jamais le compte', async () => {
    const { database } = harness();
    await expect(attachParentEmailFromShareToken('link-1.' + 'b'.repeat(43), 'parent@exemple.fr', {
      prisma: database as never,
      now: () => NOW,
    })).rejects.toBeInstanceOf(FamilyAccessError);
    expect((database.$transaction as jest.Mock)).not.toHaveBeenCalled();
  });
});

describe('readParentAccessState', () => {
  it('signale un compte sans adresse (champ e-mail à proposer)', async () => {
    const { database, token } = harness();
    expect(await readParentAccessState(token, { prisma: database as never, now: () => NOW }))
      .toEqual({ parentHasEmail: false, parentActivated: false });
  });

  it('signale un compte déjà pourvu et activé', async () => {
    const { database, token } = harness({ email: 'parent@exemple.fr', activatedAt: NOW });
    expect(await readParentAccessState(token, { prisma: database as never, now: () => NOW }))
      .toEqual({ parentHasEmail: true, parentActivated: true });
  });
});
