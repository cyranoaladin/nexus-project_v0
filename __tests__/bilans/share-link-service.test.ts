import { createHash } from 'node:crypto';

import {
  createReportShareLinks,
  verifyAndConsumeShareToken,
} from '@/lib/bilans/staff/share-link-service';

/**
 * Liens signés : impossibles à deviner, expirants, révocables, journalisés,
 * jamais le bilan Nexus. Preuves exigées : lien expiré refusé, lien altéré
 * refusé, aucun lien sans diffusion.
 */

const NOW = new Date('2026-08-12T10:00:00Z');

function creationHarness(artifact: Record<string, unknown> | null) {
  const created: Array<{ audience: string; tokenHash: string; expiresAt: Date }> = [];
  let sequence = 0;
  const transaction = {
    reportArtifact: { findUnique: jest.fn(async () => artifact) },
    reportShareLink: {
      updateMany: jest.fn(async () => ({ count: 0 })),
      create: jest.fn(async (args: { data: { audience: string; tokenHash: string; expiresAt: Date } }) => {
        created.push(args.data);
        sequence += 1;
        return { id: `link-${sequence}` };
      }),
    },
  };
  const prisma = {
    $transaction: jest.fn(async (callback: (t: typeof transaction) => Promise<unknown>) => callback(transaction)),
  };
  return { prisma, transaction, created };
}

const publishedArtifact = {
  id: 'artifact-1',
  status: 'PUBLISHED',
  currentPublishedRevisionId: 'revision-1',
  student: { parent: { userId: 'parent-1' } },
};

describe('createReportShareLinks', () => {
  const input = {
    reportArtifactId: 'artifact-1',
    recipientUserId: 'parent-1',
    createdById: 'assistante-1',
    now: () => NOW,
  } as const;

  it('produit exactement deux liens — élève et parents, jamais Nexus', async () => {
    const { prisma, created } = creationHarness(publishedArtifact);
    const links = await createReportShareLinks({ prisma: prisma as never, ...input });
    expect(links.map(({ audience }) => audience).sort()).toEqual(['ELEVE', 'PARENTS']);
    expect(created.map(({ audience }) => audience)).not.toContain('NEXUS');
  });

  it('stocke une empreinte SHA-256, jamais le secret', async () => {
    const { prisma, created } = creationHarness(publishedArtifact);
    const links = await createReportShareLinks({ prisma: prisma as never, ...input });
    for (const [index, link] of links.entries()) {
      const secret = link.token.slice(link.token.indexOf('.') + 1);
      expect(created[index].tokenHash).toBe(createHash('sha256').update(secret, 'utf8').digest('hex'));
      expect(created[index].tokenHash).not.toContain(secret);
      expect(secret.length).toBeGreaterThanOrEqual(43);
    }
  });

  it('applique la durée de validité (30 jours par défaut)', async () => {
    const { prisma, created } = creationHarness(publishedArtifact);
    await createReportShareLinks({ prisma: prisma as never, ...input });
    expect(created[0].expiresAt.getTime()).toBe(NOW.getTime() + 30 * 86_400_000);
  });

  it('révoque les liens précédents du même destinataire avant d’en créer', async () => {
    const { prisma, transaction } = creationHarness(publishedArtifact);
    await createReportShareLinks({ prisma: prisma as never, ...input });
    expect((transaction.reportShareLink.updateMany as jest.Mock).mock.calls[0][0]).toEqual({
      where: { reportArtifactId: 'artifact-1', recipientUserId: 'parent-1', revokedAt: null },
      data: { revokedAt: NOW },
    });
  });

  it('GARDE : refuse tout lien pour un bilan non diffusé', async () => {
    for (const status of ['DRAFT', 'PENDING_REVIEW', 'ARCHIVED']) {
      const { prisma } = creationHarness({ ...publishedArtifact, status });
      await expect(createReportShareLinks({ prisma: prisma as never, ...input }))
        .rejects.toMatchObject({ code: 'SHARE_LINK_REPORT_NOT_PUBLISHED' });
    }
    const { prisma } = creationHarness({ ...publishedArtifact, currentPublishedRevisionId: null });
    await expect(createReportShareLinks({ prisma: prisma as never, ...input }))
      .rejects.toMatchObject({ code: 'SHARE_LINK_REPORT_NOT_PUBLISHED' });
  });

  it('refuse un destinataire qui n’est pas le parent de l’élève', async () => {
    const { prisma } = creationHarness(publishedArtifact);
    await expect(createReportShareLinks({ prisma: prisma as never, ...input, recipientUserId: 'intrus' }))
      .rejects.toMatchObject({ code: 'SHARE_LINK_RECIPIENT_MISMATCH' });
  });
});

function verificationHarness(linkOverrides: Record<string, unknown> = {}) {
  const secret = 'a'.repeat(43);
  const accesses: unknown[] = [];
  const link = {
    id: 'link-1',
    audience: 'PARENTS',
    tokenHash: createHash('sha256').update(secret, 'utf8').digest('hex'),
    expiresAt: new Date(NOW.getTime() + 86_400_000),
    revokedAt: null,
    reportArtifact: {
      status: 'PUBLISHED',
      student: { user: { firstName: 'Kamel' } },
      currentPublishedRevision: {
        materialization: {
          audienceArtifacts: [
            { audience: 'ELEVE', html: '<html>eleve</html>' },
            { audience: 'PARENTS', html: '<html>parents</html>' },
            { audience: 'NEXUS', html: '<html>nexus</html>' },
          ],
        },
      },
    },
    ...linkOverrides,
  };
  const database = {
    reportShareLink: { findUnique: jest.fn(async () => link) },
    shareLinkAccess: { create: jest.fn(async (args: unknown) => { accesses.push(args); return { id: 'access-1' }; }) },
  };
  return { database, accesses, token: `link-1.${secret}`, secret };
}

describe('verifyAndConsumeShareToken', () => {
  it('sert le document de la bonne audience et journalise la consultation', async () => {
    const { database, accesses, token } = verificationHarness();
    const verified = await verifyAndConsumeShareToken(token, { prisma: database as never, now: () => NOW });
    expect(verified).toMatchObject({ audience: 'PARENTS', html: '<html>parents</html>' });
    expect(accesses).toHaveLength(1);
    expect(JSON.stringify(accesses[0])).not.toMatch(/ip|userAgent/i);
  });

  it('PREUVE : un jeton altéré est refusé, sans journalisation', async () => {
    const { database, accesses, token } = verificationHarness();
    const altered = token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a');
    expect(await verifyAndConsumeShareToken(altered, { prisma: database as never, now: () => NOW })).toBeNull();
    expect(accesses).toHaveLength(0);
  });

  it('PREUVE : un lien expiré est refusé', async () => {
    const { database, token } = verificationHarness({ expiresAt: new Date(NOW.getTime() - 1000) });
    expect(await verifyAndConsumeShareToken(token, { prisma: database as never, now: () => NOW })).toBeNull();
  });

  it('un lien révoqué est refusé', async () => {
    const { database, token } = verificationHarness({ revokedAt: NOW });
    expect(await verifyAndConsumeShareToken(token, { prisma: database as never, now: () => NOW })).toBeNull();
  });

  it('un bilan retiré de la diffusion redevient inaccessible', async () => {
    const { database, token } = verificationHarness({
      reportArtifact: {
        status: 'ARCHIVED',
        student: { user: { firstName: 'Kamel' } },
        currentPublishedRevision: null,
      },
    });
    expect(await verifyAndConsumeShareToken(token, { prisma: database as never, now: () => NOW })).toBeNull();
  });

  it('défense en profondeur : une audience NEXUS ne sort jamais', async () => {
    const { database, token } = verificationHarness({ audience: 'NEXUS' });
    expect(await verifyAndConsumeShareToken(token, { prisma: database as never, now: () => NOW })).toBeNull();
  });

  it('rejette les formes dégénérées sans requête inutile', async () => {
    const { database } = verificationHarness();
    for (const malformed of ['', '.', 'seul', '.secret', 'id.', 'x'.repeat(300)]) {
      expect(await verifyAndConsumeShareToken(malformed, { prisma: database as never, now: () => NOW })).toBeNull();
    }
    expect(database.reportShareLink.findUnique).not.toHaveBeenCalled();
  });
});
