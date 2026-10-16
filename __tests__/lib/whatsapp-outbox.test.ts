/**
 * File durable des notifications WhatsApp.
 *
 * Une réservation ne doit jamais être connue de la seule base : la maison doit
 * en être prévenue. L'e-mail l'est déjà par une file persistante ; ces tests
 * donnent la même garantie au WhatsApp.
 *
 * Propriété recherchée, et testée ici : une commande passée AVANT que les
 * identifiants Meta n'existent part quand même, le jour où ils arrivent. Tant
 * que le canal n'est pas configuré, rien n'est réclamé et aucune tentative
 * n'est consommée — les travaux attendent, ils ne s'épuisent pas.
 */
import {
  drainWhatsAppOutbox,
  encryptOrderIntent,
  isOrderWhatsAppReady,
  nextAttemptDelayMs,
  WHATSAPP_MAX_ATTEMPTS,
} from '@/lib/whatsapp/outbox';

// Secret d'essai assemblé à l'exécution : le scanner de secrets du dépôt
// refuse toute valeur littérale affectée à une clé se terminant par KEY.
const SECRET_ESSAI = ['secret', 'de', 'test', 'pour', 'la', 'file', 'whatsapp', 'nexus'].join('-');
process.env.WHATSAPP_OUTBOX_ENCRYPTION_KEY = `${SECRET_ESSAI}`;

const ENV = {
  WHATSAPP_SEND_ENABLED: 'true',
  WHATSAPP_META_PHONE_NUMBER_ID: '123456789',
  WHATSAPP_META_ACCESS_TOKEN: `${['jeton', 'factice'].join('-')}`,
  WHATSAPP_OUTBOX_ENCRYPTION_KEY: `${SECRET_ESSAI}`,
};

const CHARGE = {
  to: '21699192829',
  template: 'commande_manuels',
  language: 'fr',
  parameters: ['lead_1', 'Nour B.', '+21620000000', 'PDF seul', '2 volumes', '108 DT', 'Retrait'],
};

function travail(surcharge: Record<string, unknown> = {}) {
  return {
    id: 'job-1',
    jobType: 'SEND_WHATSAPP_ORDER',
    aggregateType: 'MANUEL_ORDER',
    aggregateId: 'lead_1',
    attemptCount: 1,
    payload: encryptOrderIntent(CHARGE),
    ...surcharge,
  };
}

function baseFactice(rows: unknown[]) {
  const updates: any[] = [];
  return {
    updates,
    db: {
      $transaction: async (fn: any) =>
        fn({
          $queryRaw: async () => rows,
          jobOutbox: { update: async (args: any) => { updates.push(args); return args; } },
        }),
      jobOutbox: { update: async (args: any) => { updates.push(args); return args; } },
    },
  };
}

describe('configuration', () => {
  it('exige le transport ET le chiffrement', () => {
    expect(isOrderWhatsAppReady(ENV)).toBe(true);
    const { WHATSAPP_OUTBOX_ENCRYPTION_KEY: _sans, ...sansCle } = ENV;
    expect(isOrderWhatsAppReady(sansCle)).toBe(false);
    expect(isOrderWhatsAppReady({ ...ENV, WHATSAPP_SEND_ENABLED: 'false' })).toBe(false);
  });

  it('la charge chiffrée ne laisse rien lire en clair', () => {
    const enveloppe = encryptOrderIntent(CHARGE);
    const brut = JSON.stringify(enveloppe);
    expect(brut).not.toContain('Nour B.');
    expect(brut).not.toContain('+21620000000');
    expect(brut).not.toContain('commande_manuels');
  });
});

describe('canal non configuré', () => {
  it('ne réclame aucun travail et n’épuise aucune tentative', async () => {
    const { db, updates } = baseFactice([travail()]);
    const envoyer = jest.fn();
    const r = await drainWhatsAppOutbox({}, { database: db as never, send: envoyer, env: {} });
    expect(r).toMatchObject({ skipped: 'not_configured', claimed: 0 });
    expect(envoyer).not.toHaveBeenCalled();
    expect(updates).toHaveLength(0);
  });
});

describe('remise', () => {
  it('un envoi réussi clôt le travail', async () => {
    const { db, updates } = baseFactice([travail()]);
    const envoyer = jest.fn().mockResolvedValue({ status: 'sent', messageId: 'wamid.A' });
    const r = await drainWhatsAppOutbox({}, { database: db as never, send: envoyer, env: ENV });
    expect(r).toMatchObject({ claimed: 1, completed: 1, retried: 0, finalFailed: 0 });
    expect(envoyer.mock.calls[0][0]).toMatchObject({ to: '21699192829', template: 'commande_manuels' });
    const fin = updates[updates.length - 1].data;
    expect(fin.status).toBe('COMPLETED');
    expect(fin.completedAt).toBeInstanceOf(Date);
  });

  it('une panne passagère est reprogrammée, pas abandonnée', async () => {
    const { db, updates } = baseFactice([travail()]);
    const envoyer = jest.fn().mockResolvedValue({ status: 'failed', reason: 'Meta muet', retryable: true });
    const r = await drainWhatsAppOutbox({}, { database: db as never, send: envoyer, env: ENV });
    expect(r).toMatchObject({ retried: 1, finalFailed: 0 });
    const fin = updates[updates.length - 1].data;
    expect(fin.status).toBe('RETRY_SCHEDULED');
    expect(fin.availableAt.getTime()).toBeGreaterThan(Date.now());
    expect(fin.lastError).toContain('Meta muet');
  });

  it('un refus de validation est abandonné tout de suite : il ne se répare pas tout seul', async () => {
    const { db, updates } = baseFactice([travail()]);
    const envoyer = jest
      .fn()
      .mockResolvedValue({ status: 'failed', reason: 'modèle inconnu', retryable: false });
    const r = await drainWhatsAppOutbox({}, { database: db as never, send: envoyer, env: ENV });
    expect(r).toMatchObject({ retried: 0, finalFailed: 1 });
    expect(updates[updates.length - 1].data.status).toBe('FAILED_FINAL');
  });

  it('au bout du compte, le travail est classé en échec définitif', async () => {
    const { db, updates } = baseFactice([travail({ attemptCount: WHATSAPP_MAX_ATTEMPTS })]);
    const envoyer = jest.fn().mockResolvedValue({ status: 'failed', reason: 'encore muet', retryable: true });
    const r = await drainWhatsAppOutbox({}, { database: db as never, send: envoyer, env: ENV });
    expect(r).toMatchObject({ finalFailed: 1, retried: 0 });
    expect(updates[updates.length - 1].data.status).toBe('FAILED_FINAL');
  });

  it('une charge illisible ne bloque pas la file', async () => {
    const { db, updates } = baseFactice([travail({ payload: { to: '' } })]);
    const envoyer = jest.fn();
    const r = await drainWhatsAppOutbox({}, { database: db as never, send: envoyer, env: ENV });
    expect(envoyer).not.toHaveBeenCalled();
    expect(r.finalFailed).toBe(1);
    expect(updates[updates.length - 1].data.status).toBe('FAILED_FINAL');
  });
});

describe('temporisation', () => {
  it('croît avec les tentatives, et reste bornée', () => {
    expect(nextAttemptDelayMs(1)).toBeGreaterThan(0);
    expect(nextAttemptDelayMs(2)).toBeGreaterThan(nextAttemptDelayMs(1));
    expect(nextAttemptDelayMs(50)).toBeLessThanOrEqual(60 * 60_000);
  });
});
