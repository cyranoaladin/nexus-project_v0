/**
 * Route de pré-commande des manuels.
 *
 * Deux exigences gouvernent ces tests :
 *  — le prix est RECALCULÉ côté serveur ; le total envoyé par le navigateur
 *    n'est jamais cru, sans quoi n'importe qui commande à n'importe quel prix ;
 *  — une sélection partiellement comprise est refusée, jamais rabotée en
 *    silence : un panier amputé produirait une commande que le client n'a pas
 *    passée.
 */
import { POST } from '@/app/api/manuels/commande/route';
import { prisma } from '@/lib/prisma';
import { enqueueEmailIntent } from '@/lib/email/outbox';
import { sendWhatsAppTemplate } from '@/lib/whatsapp/cloud-api';

jest.mock('@/lib/rate-limit/sensitive', () => ({
  guardRateLimitAsync: jest.fn().mockResolvedValue(null),
  guardSensitiveRateLimit: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/lib/email/outbox', () => ({
  enqueueEmailIntent: jest.fn().mockResolvedValue({ id: 'job-1' }),
}));

jest.mock('@/lib/email/outbox-scheduler', () => ({
  kickEmailOutboxDrain: jest.fn(),
}));

jest.mock('@/lib/whatsapp/cloud-api', () => ({
  ...jest.requireActual('@/lib/whatsapp/cloud-api'),
  sendWhatsAppTemplate: jest.fn().mockResolvedValue({ status: 'sent', messageId: 'wamid.T' }),
}));

const mockCreate = prisma.contactLead.create as jest.Mock;
const mockEnqueue = enqueueEmailIntent as jest.Mock;
const mockWhatsApp = sendWhatsAppTemplate as jest.Mock;

function commande(body: unknown) {
  return new Request('http://localhost:3000/api/manuels/commande', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const VALIDE = {
  items: ['pc-t', 'es-p'],
  format: 'papier-couleur',
  delivery: { mode: 'retrait' },
  contact: { name: 'Nour B.', email: 'nour@example.com', phone: '+21620000000' },
  consent: true,
};

describe('POST /api/manuels/commande', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreate.mockResolvedValue({
      id: 'lead_manuels_1',
      name: 'Nour B.',
      email: 'nour@example.com',
      phone: '+21620000000',
      createdAt: new Date('2026-10-16T09:00:00.000Z'),
    });
    mockEnqueue.mockResolvedValue({ id: 'job-1' });
    mockWhatsApp.mockResolvedValue({ status: 'sent', messageId: 'wamid.T' });
  });

  describe('refus', () => {
    it('corps illisible', async () => {
      const res = await POST(commande('{nope'));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('invalid_json');
    });

    it('panier vide', async () => {
      const res = await POST(commande({ ...VALIDE, items: [] }));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('invalid_payload');
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('volume inconnu au catalogue', async () => {
      const res = await POST(commande({ ...VALIDE, items: ['pc-t', 'neant-x'] }));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('unknown_volume');
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('format inconnu', async () => {
      const res = await POST(commande({ ...VALIDE, format: 'papier-dore' }));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('invalid_payload');
    });

    it('adresse électronique invalide', async () => {
      const res = await POST(
        commande({ ...VALIDE, contact: { ...VALIDE.contact, email: 'pas-une-adresse' } }),
      );
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('invalid_payload');
    });

    it('téléphone absent', async () => {
      const res = await POST(
        commande({ ...VALIDE, contact: { name: 'Nour B.', email: 'nour@example.com' } }),
      );
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('invalid_payload');
    });

    it('livraison demandée sans adresse postale', async () => {
      const res = await POST(commande({ ...VALIDE, delivery: { mode: 'livraison' } }));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('invalid_payload');
    });

    it('consentement non donné', async () => {
      const res = await POST(commande({ ...VALIDE, consent: false }));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('invalid_payload');
    });

    it('un format papier pour une sélection entièrement offerte est refusé', async () => {
      const res = await POST(
        commande({ ...VALIDE, items: ['philosophie-epicure'], format: 'pdf' }),
      );
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('empty_order');
    });
  });

  describe('acceptation', () => {
    it('recalcule le prix côté serveur et ignore celui du navigateur', async () => {
      const res = await POST(commande({ ...VALIDE, total: 1, quote: { color: 1 } }));
      expect(res.status).toBe(200);
      const json = await res.json();
      // PC/T 675 p. + ES/P 643 p. = 1 318 p. → barème v2
      expect(json.quote.pages).toBe(1318);
      expect(json.quote.volumes).toBe(2);
      expect(json.quote.total).toBe(json.quote.color);
      expect(json.quote.total).toBeGreaterThan(400);
    });

    it('enregistre la demande et renvoie sa référence', async () => {
      const res = await POST(commande(VALIDE));
      expect(res.status).toBe(200);
      expect((await res.json()).reference).toBe('lead_manuels_1');
      expect(mockCreate).toHaveBeenCalledTimes(1);
      const enregistre = mockCreate.mock.calls[0][0].data;
      expect(enregistre.email).toBe('nour@example.com');
      expect(enregistre.source).toBe('manuels-precommande');
      expect(enregistre.notes.length).toBeLessThanOrEqual(500);
    });

    it('prévient la maison et accuse réception au client', async () => {
      await POST(commande(VALIDE));
      expect(mockEnqueue).toHaveBeenCalledTimes(2);
      const destinataires = mockEnqueue.mock.calls.map((c) => c[1].to);
      expect(destinataires).toContain('nour@example.com');
      const cles = mockEnqueue.mock.calls.map((c) => c[1].dedupeKey);
      expect(new Set(cles).size).toBe(2);
    });

    it('le détail des volumes part dans l’e-mail de la maison', async () => {
      await POST(commande(VALIDE));
      const maison = mockEnqueue.mock.calls.find((c) => c[1].to !== 'nour@example.com');
      expect(maison).toBeDefined();
      expect(maison![1].html).toContain('Physique-chimie');
      expect(maison![1].html).toContain('675');
    });

    it('la livraison est acceptée avec une adresse postale', async () => {
      const res = await POST(
        commande({
          ...VALIDE,
          delivery: { mode: 'livraison', address: '12 avenue de la République', city: 'Tunis' },
        }),
      );
      expect(res.status).toBe(200);
      const maison = mockEnqueue.mock.calls.find((c) => c[1].to !== 'nour@example.com');
      expect(maison![1].html).toContain('12 avenue de la R');
    });

    it('la livraison est offerte : aucun frais n’est ajouté au total', async () => {
      const retrait = await (
        await POST(commande(VALIDE))
      ).json();
      const livre = await (
        await POST(
          commande({ ...VALIDE, delivery: { mode: 'livraison', address: 'x', city: 'Tunis' } }),
        )
      ).json();
      expect(livre.quote.total).toBe(retrait.quote.total);
    });
  });
});

describe('la réservation part sur le WhatsApp de la maison', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreate.mockResolvedValue({
      id: 'lead_manuels_1',
      name: 'Nour B.',
      email: 'nour@example.com',
      phone: '+21620000000',
      createdAt: new Date('2026-10-16T09:00:00.000Z'),
    });
    mockEnqueue.mockResolvedValue({ id: 'job-1' });
    mockWhatsApp.mockResolvedValue({ status: 'sent', messageId: 'wamid.T' });
  });

  it('un message à modèle est envoyé, avec la commande dedans', async () => {
    const res = await POST(commande(VALIDE));
    expect(res.status).toBe(200);
    expect(mockWhatsApp).toHaveBeenCalledTimes(1);

    const envoi = mockWhatsApp.mock.calls[0][0];
    expect(envoi.template.length).toBeGreaterThan(0);
    expect(envoi.language).toBeTruthy();
    // la référence, le client, son téléphone, le format, le panier et le total
    const tout = envoi.parameters.join(' | ');
    expect(tout).toContain('lead_manuels_1');
    expect(tout).toContain('Nour B.');
    expect(tout).toContain('+21620000000');
    expect(tout).toMatch(/couleur/i);
    expect(tout).toMatch(/2 volumes/);
    expect(tout).toMatch(/\d+ DT/);
    expect(tout).toMatch(/retrait/i);
  });

  it('la livraison et son adresse figurent dans le message', async () => {
    await POST(
      commande({
        ...VALIDE,
        delivery: { mode: 'livraison', address: '12 avenue de la République', city: 'Tunis' },
      }),
    );
    const tout = mockWhatsApp.mock.calls[0][0].parameters.join(' | ');
    expect(tout).toContain('12 avenue de la R');
    expect(tout).toContain('Tunis');
  });

  it('le résultat de l’envoi est rendu à l’appelant', async () => {
    const res = await POST(commande(VALIDE));
    expect((await res.json()).whatsapp).toBe('sent');
  });

  it('un WhatsApp en échec ne fait PAS perdre la commande', async () => {
    mockWhatsApp.mockResolvedValue({ status: 'failed', reason: 'Meta a refusé', retryable: false });
    const res = await POST(commande(VALIDE));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.reference).toBe('lead_manuels_1');
    expect(json.whatsapp).toBe('failed');
    // la commande reste enregistrée et notifiée par e-mail
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockEnqueue).toHaveBeenCalledTimes(2);
  });

  it('un WhatsApp qui lève ne fait pas tomber la route', async () => {
    mockWhatsApp.mockRejectedValue(new Error('réseau'));
    const res = await POST(commande(VALIDE));
    expect(res.status).toBe(200);
    expect((await res.json()).whatsapp).toBe('failed');
  });

  it('sans identifiants, le canal est écarté sans bruit', async () => {
    mockWhatsApp.mockResolvedValue({ status: 'skipped', reason: 'not_configured' });
    const res = await POST(commande(VALIDE));
    expect(res.status).toBe(200);
    expect((await res.json()).whatsapp).toBe('skipped');
  });
});

describe('le destinataire par défaut est le WhatsApp de la maison', () => {
  const regle = process.env.WHATSAPP_ORDER_RECIPIENT;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.WHATSAPP_ORDER_RECIPIENT;
    mockCreate.mockResolvedValue({
      id: 'lead_manuels_1',
      name: 'Nour B.',
      email: 'nour@example.com',
      phone: '+21620000000',
      createdAt: new Date('2026-10-16T09:00:00.000Z'),
    });
    mockEnqueue.mockResolvedValue({ id: 'job-1' });
    mockWhatsApp.mockResolvedValue({ status: 'sent', messageId: 'wamid.T' });
  });

  afterAll(() => {
    if (regle === undefined) delete process.env.WHATSAPP_ORDER_RECIPIENT;
    else process.env.WHATSAPP_ORDER_RECIPIENT = regle;
  });

  it('sans réglage, la notification part sur le 99 19 28 29', async () => {
    await POST(commande(VALIDE));
    expect(mockWhatsApp.mock.calls[0][0].to).toBe('21699192829');
  });

  it('un réglage explicite a la priorité', async () => {
    process.env.WHATSAPP_ORDER_RECIPIENT = '21655000111';
    await POST(commande(VALIDE));
    expect(mockWhatsApp.mock.calls[0][0].to).toBe('21655000111');
  });
});
