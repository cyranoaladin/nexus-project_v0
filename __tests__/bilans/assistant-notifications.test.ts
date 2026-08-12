import {
  buildAssistantDigestEmail,
  digestIntervalHours,
  maybeSendAssistantDigest,
  parentEmailReminderDays,
  transmissionReminderDays,
  type AssistantWorkQueue,
} from '@/lib/bilans/staff/notification-service';
import { buildParentReportAvailableEmail } from '@/lib/bilans/staff/parent-notification';
import { NBSP } from '@/lib/bilans/render/typography';

jest.mock('@/lib/email/outbox-scheduler', () => ({ kickEmailOutboxDrain: jest.fn() }));
jest.mock('@/lib/email/outbox', () => ({ enqueueEmailIntent: jest.fn(async () => ({ id: 'job-1' })) }));

import { enqueueEmailIntent } from '@/lib/email/outbox';

const NOW = new Date('2026-08-12T10:00:00Z');

const emptyQueue: AssistantWorkQueue = {
  pendingReview: 0,
  correctionRequested: 0,
  missingParentEmail: 0,
  missingParentEmailStale: 0,
  publishedNotTransmitted: 0,
  publishedNotTransmittedStale: 0,
  recentParentActivations: 0,
};

describe('buildAssistantDigestEmail — synthèse groupée', () => {
  it('reste muet quand il n’y a rien à traiter', () => {
    expect(buildAssistantDigestEmail(emptyQueue, 'https://x/dashboard')).toBeNull();
  });

  it('regroupe les événements clés dans UN e-mail français', () => {
    const email = buildAssistantDigestEmail({
      ...emptyQueue,
      pendingReview: 3,
      correctionRequested: 1,
      missingParentEmailStale: 2,
      publishedNotTransmittedStale: 4,
      recentParentActivations: 1,
    }, 'https://x/dashboard/assistante/bilans');
    expect(email).not.toBeNull();
    if (email === null) return;
    expect(email.text).toContain('3 bilans en attente de revue.');
    expect(email.text).toContain('1 bilan en correction demandée.');
    expect(email.text).toContain('2 foyers sans e-mail parent');
    expect(email.text).toContain('4 bilans diffusés mais non transmis par WhatsApp');
    expect(email.text).toContain('1 parent a activé son espace');
    expect(email.text).not.toContain("'");
    expect(email.text).toContain(`${NBSP}:`);
    expect(email.html).toContain('Ouvrir la file des bilans');
  });

  it('accorde le singulier et le pluriel', () => {
    const singular = buildAssistantDigestEmail({ ...emptyQueue, pendingReview: 1 }, 'https://x');
    expect(singular?.text).toContain('1 bilan en attente de revue.');
    const plural = buildAssistantDigestEmail({ ...emptyQueue, pendingReview: 2 }, 'https://x');
    expect(plural?.text).toContain('2 bilans en attente de revue.');
  });
});

describe('maybeSendAssistantDigest — cadence et regroupement', () => {
  function harness(lastDigestAgoHours: number | null, queueOverrides: Partial<AssistantWorkQueue> = {}) {
    const notifications: unknown[] = [];
    const database = {
      notification: {
        findFirst: jest.fn(async () => (lastDigestAgoHours === null
          ? null
          : { createdAt: new Date(NOW.getTime() - lastDigestAgoHours * 3_600_000) })),
        create: jest.fn(async (args: unknown) => { notifications.push(args); return { id: 'n1' }; }),
      },
      user: {
        count: jest.fn(async () => queueOverrides.recentParentActivations ?? 0),
        findMany: jest.fn(async () => [{ id: 'assistante-1', email: 'assistante@nexus.tn' }]),
      },
      reportRevision: {
        count: jest.fn()
          .mockResolvedValueOnce(queueOverrides.pendingReview ?? 0)
          .mockResolvedValueOnce(queueOverrides.correctionRequested ?? 0)
          .mockResolvedValueOnce(queueOverrides.missingParentEmail ?? 0)
          .mockResolvedValueOnce(queueOverrides.missingParentEmailStale ?? 0),
      },
      reportArtifact: {
        count: jest.fn()
          .mockResolvedValueOnce(queueOverrides.publishedNotTransmitted ?? 0)
          .mockResolvedValueOnce(queueOverrides.publishedNotTransmittedStale ?? 0),
      },
      parentProfile: {},
      jobOutbox: {},
      $transaction: jest.fn(),
    };
    (database.$transaction as jest.Mock).mockImplementation(
      async (callback: (t: unknown) => Promise<unknown>) => callback(database),
    );
    return { database, notifications };
  }

  it('n’envoie rien si l’intervalle n’est pas écoulé', async () => {
    const { database } = harness(2, { pendingReview: 5 });
    const result = await maybeSendAssistantDigest({ prisma: database as never, now: () => NOW });
    expect(result).toEqual({ sent: false, reason: 'INTERVAL_NOT_ELAPSED' });
    expect(enqueueEmailIntent).not.toHaveBeenCalled();
  });

  it('n’envoie rien quand la file est vide — jamais de bruit', async () => {
    const { database } = harness(30);
    const result = await maybeSendAssistantDigest({ prisma: database as never, now: () => NOW });
    expect(result).toEqual({ sent: false, reason: 'NOTHING_TO_REPORT' });
  });

  it('envoie UN e-mail groupé par assistante et trace l’envoi en notification', async () => {
    const { database, notifications } = harness(30, { pendingReview: 2, publishedNotTransmittedStale: 1 });
    const result = await maybeSendAssistantDigest({ prisma: database as never, now: () => NOW, origin: 'https://x' });
    expect(result).toEqual({ sent: true, reason: 'SENT' });
    expect(enqueueEmailIntent).toHaveBeenCalledTimes(1);
    const intent = (enqueueEmailIntent as jest.Mock).mock.calls[0][1];
    expect(intent.messageType).toBe('TRANSACTIONAL_NOTIFICATION');
    expect(intent.to).toBe('assistante@nexus.tn');
    expect(notifications).toHaveLength(1);
  });
});

describe('configuration des seuils', () => {
  it('valeurs par défaut sûres et surcharge par environnement', () => {
    expect(parentEmailReminderDays({})).toBe(3);
    expect(parentEmailReminderDays({ BILAN_PARENT_EMAIL_REMINDER_DAYS: '5' })).toBe(5);
    expect(transmissionReminderDays({})).toBe(2);
    expect(digestIntervalHours({})).toBe(24);
    expect(digestIntervalHours({ BILAN_ASSISTANT_DIGEST_INTERVAL_HOURS: 'n’importe quoi' })).toBe(24);
  });
});

describe('e-mail parent « bilan disponible »', () => {
  const email = buildParentReportAvailableEmail({
    parentDisplayName: 'Sonia Ben Rhouma',
    studentFirstName: 'Kamel',
    subjectLabel: 'Mathématiques',
    dashboardUrl: 'https://x/dashboard/parent',
  });

  it('annonce la disponibilité sans jamais joindre le contenu du bilan', () => {
    expect(email.subject).toContain('Kamel');
    expect(email.text).toContain('disponible dès maintenant sur votre espace parent');
    expect(email.text).not.toMatch(/score|profil|MAITRISE|ERREUR/i);
    expect(email.html).toContain('https://x/dashboard/parent');
  });

  it('français irréprochable : apostrophes typographiques, insécables', () => {
    for (const part of [email.subject, email.text]) {
      expect(part).not.toContain("'");
      expect(part).not.toMatch(/\S [:;!?]/);
    }
  });
});
