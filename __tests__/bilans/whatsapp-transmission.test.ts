import { buildParentWhatsAppUrl } from '@/lib/whatsapp';
import { buildBilanWhatsAppMessage } from '@/lib/bilans/staff/whatsapp-message';
import { confirmWhatsAppTransmission } from '@/lib/bilans/staff/transmission-service';
import { prepareWhatsAppSend, shareLinkValidityDays } from '@/lib/bilans/staff/whatsapp-send-service';
import { NBSP } from '@/lib/bilans/render/typography';

const NOW = new Date('2026-08-12T10:00:00Z');

describe('buildParentWhatsAppUrl', () => {
  it('construit le lien international attendu par wa.me depuis phoneNormalized', () => {
    const url = buildParentWhatsAppUrl('98123456', 'Bonjour');
    expect(url).toBe('https://wa.me/21698123456?text=Bonjour');
  });

  it('encode le message', () => {
    const url = buildParentWhatsAppUrl('98123456', 'Bonjour, voici : élève');
    expect(url).toContain(encodeURIComponent('Bonjour, voici : élève').replace(/%20/g, '%20'));
  });

  it('refuse un téléphone hors forme normalisée tunisienne ou internationale', () => {
    for (const invalid of ['', '1234567', '021612345', '+21698123456', '9812345a']) {
      expect(() => buildParentWhatsAppUrl(invalid, 'x')).toThrow('WHATSAPP_PARENT_PHONE_INVALID');
    }
  });

  it('construit le lien depuis un phoneNormalized international (indicatif déjà inclus, non préfixé par 216)', () => {
    const url = buildParentWhatsAppUrl('97466298752', 'Bonjour');
    expect(url).toBe('https://wa.me/97466298752?text=Bonjour');
  });
});

describe('buildBilanWhatsAppMessage', () => {
  const message = buildBilanWhatsAppMessage({
    parentDisplayName: 'Sonia Ben Rhouma',
    studentFirstName: 'Kamel',
    subjectLabel: 'Mathématiques',
    levelLabel: '2de',
    parentLink: 'https://exemple.tn/p',
    studentLink: 'https://exemple.tn/e',
    validityDays: 30,
  });

  it('est personnalisé et français, typographie comprise', () => {
    expect(message).toContain('Bonjour Sonia Ben Rhouma,');
    expect(message).toContain('Kamel');
    expect(message).toContain('Mathématiques');
    expect(message).toContain('2de');
    expect(message).toContain('valables 30 jours');
    expect(message).not.toContain("'");
    expect(message).toContain(`${NBSP}:`);
  });

  it('contient les deux liens publics et jamais un lien Nexus', () => {
    expect(message).toContain('https://exemple.tn/p');
    expect(message).toContain('https://exemple.tn/e');
    expect(message.toLowerCase()).not.toContain('nexus/consultation');
    expect(message).not.toMatch(/NEXUS/);
  });
});

describe('shareLinkValidityDays', () => {
  it('30 jours par défaut, paramétrable par environnement', () => {
    expect(shareLinkValidityDays({})).toBe(30);
    expect(shareLinkValidityDays({ BILAN_SHARE_LINK_VALIDITY_DAYS: '14' })).toBe(14);
  });
  it('refuse une configuration aberrante', () => {
    for (const bad of ['0', '-3', '366', 'demain']) {
      expect(() => shareLinkValidityDays({ BILAN_SHARE_LINK_VALIDITY_DAYS: bad }))
        .toThrow('SHARE_LINK_VALIDITY_ENV_INVALID');
    }
  });
});

describe('prepareWhatsAppSend — gardes', () => {
  function database(artifact: Record<string, unknown> | null) {
    return {
      reportArtifact: { findUnique: jest.fn(async () => artifact) },
      $transaction: jest.fn(),
      reportShareLink: {},
      shareLinkAccess: {},
    };
  }
  const actor = { userId: 'assistante-1', role: 'ASSISTANTE' } as const;

  it('GARDE : indisponible si le bilan n’est pas diffusé', async () => {
    const db = database({ id: 'a1', status: 'PENDING_REVIEW', currentPublishedRevision: null, student: {}, assessmentAttempt: {} });
    await expect(prepareWhatsAppSend({ prisma: db as never, actor, reportArtifactId: 'a1', origin: 'https://x' }))
      .rejects.toMatchObject({ code: 'WHATSAPP_REPORT_NOT_PUBLISHED' });
  });

  it('GARDE : indisponible si le téléphone du parent est absent', async () => {
    const db = database({
      id: 'a1',
      status: 'PUBLISHED',
      currentPublishedRevision: { reportPackId: 'entree-seconde-maths-v1', reportPackVersion: '1' },
      assessmentAttempt: { assessmentPackId: 'entree-seconde-maths-v1' },
      student: {
        user: { firstName: 'Kamel', lastName: 'Ben Rhouma' },
        parent: { user: { id: 'parent-1', firstName: 'Sonia', lastName: 'Ben Rhouma', phoneNormalized: null } },
      },
    });
    await expect(prepareWhatsAppSend({ prisma: db as never, actor, reportArtifactId: 'a1', origin: 'https://x' }))
      .rejects.toMatchObject({ code: 'WHATSAPP_PARENT_PHONE_MISSING' });
  });

  it('refuse tout autre rôle que l’assistante', async () => {
    const db = database(null);
    await expect(prepareWhatsAppSend({
      prisma: db as never,
      actor: { userId: 'coach-1', role: 'COACH' },
      reportArtifactId: 'a1',
      origin: 'https://x',
    })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(db.reportArtifact.findUnique).not.toHaveBeenCalled();
  });
});

describe('confirmWhatsAppTransmission — gardes', () => {
  function harness(artifact: Record<string, unknown> | null, activeLinks = 2) {
    const transmissions: unknown[] = [];
    const transaction = {
      reportArtifact: { findUnique: jest.fn(async () => artifact) },
      reportShareLink: { count: jest.fn(async () => activeLinks) },
      reportTransmission: {
        create: jest.fn(async (args: { data: Record<string, unknown> }) => {
          transmissions.push(args.data);
          return { id: 'transmission-1', confirmedAt: NOW };
        }),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (t: typeof transaction) => Promise<unknown>) => callback(transaction)),
    };
    return { prisma, transaction, transmissions };
  }

  const published = {
    id: 'artifact-1',
    status: 'PUBLISHED',
    student: { parent: { userId: 'parent-1' } },
  };

  it('trace « transmis au parent par WhatsApp » avec auteur et date', async () => {
    const { prisma, transmissions } = harness(published);
    const result = await confirmWhatsAppTransmission({
      prisma: prisma as never,
      reportArtifactId: 'artifact-1',
      confirmedById: 'assistante-1',
      now: () => NOW,
    });
    expect(result).toEqual({ transmissionId: 'transmission-1', confirmedAt: NOW });
    expect(transmissions[0]).toMatchObject({
      channel: 'WHATSAPP',
      recipientUserId: 'parent-1',
      confirmedById: 'assistante-1',
      confirmedAt: NOW,
    });
  });

  it('PREUVE : aucun bilan transmis sans avoir été diffusé', async () => {
    for (const status of ['DRAFT', 'PENDING_REVIEW', 'ARCHIVED']) {
      const { prisma } = harness({ ...published, status });
      await expect(confirmWhatsAppTransmission({
        prisma: prisma as never,
        reportArtifactId: 'artifact-1',
        confirmedById: 'assistante-1',
        now: () => NOW,
      })).rejects.toMatchObject({ code: 'TRANSMISSION_REPORT_NOT_PUBLISHED' });
    }
  });

  it('refuse de confirmer sans lien actif préparé', async () => {
    const { prisma } = harness(published, 0);
    await expect(confirmWhatsAppTransmission({
      prisma: prisma as never,
      reportArtifactId: 'artifact-1',
      confirmedById: 'assistante-1',
      now: () => NOW,
    })).rejects.toMatchObject({ code: 'TRANSMISSION_LINKS_REQUIRED' });
  });
});
