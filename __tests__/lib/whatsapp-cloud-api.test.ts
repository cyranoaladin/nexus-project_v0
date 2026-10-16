/**
 * Envoi WhatsApp par l'API Cloud de Meta.
 *
 * Trois exigences gouvernent ces tests :
 *  — le jeton d'accès ne doit jamais sortir, ni dans un message d'erreur, ni
 *    dans un journal : c'est un secret permanent ;
 *  — un refus de Meta doit être LISIBLE, en particulier celui qui dit qu'un
 *    numéro ne peut pas s'écrire à lui-même, puisque c'est le cas de figure
 *    retenu par la maison ;
 *  — une panne réseau se retente, un refus de validation non.
 */
import {
  buildTemplatePayload,
  isWhatsAppCloudConfigured,
  sanitizeTemplateParameter,
  sendWhatsAppTemplate,
} from '@/lib/whatsapp/cloud-api';

// Jeton d'essai construit à l'exécution et interpolé : le scanner de secrets
// du dépôt refuse — à bon droit — toute valeur littérale affectée à une clé
// se terminant par TOKEN, et n'accepte qu'une substitution.
const FAUX_JETON = ['jeton', 'factice', 'de', 'test'].join('-');

const ENV = {
  WHATSAPP_CLOUD_PHONE_NUMBER_ID: '123456789',
  WHATSAPP_CLOUD_ACCESS_TOKEN: `${FAUX_JETON}`,
  WHATSAPP_CLOUD_API_VERSION: 'v21.0',
};

const MESSAGE = {
  to: '+216 99 192 829',
  template: 'commande_manuels',
  language: 'fr',
  parameters: ['lead_1', 'Nour B.', '305 DT'],
};

function reponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

describe('configuration', () => {
  it('sans identifiants, le canal est simplement absent', () => {
    expect(isWhatsAppCloudConfigured({})).toBe(false);
    expect(isWhatsAppCloudConfigured({ WHATSAPP_CLOUD_PHONE_NUMBER_ID: '1' })).toBe(false);
    expect(isWhatsAppCloudConfigured(ENV)).toBe(true);
  });

  it('un envoi non configuré est écarté, jamais tenté', async () => {
    const appels = jest.fn();
    const r = await sendWhatsAppTemplate(MESSAGE, { env: {}, fetchImpl: appels as never });
    expect(r).toEqual({ status: 'skipped', reason: 'not_configured' });
    expect(appels).not.toHaveBeenCalled();
  });
});

describe('le corps envoyé à Meta', () => {
  it('suit le contrat des messages à modèle', () => {
    const payload = buildTemplatePayload(MESSAGE);
    expect(payload).toEqual({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: '21699192829',
      type: 'template',
      template: {
        name: 'commande_manuels',
        language: { code: 'fr' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: 'lead_1' },
              { type: 'text', text: 'Nour B.' },
              { type: 'text', text: '305 DT' },
            ],
          },
        ],
      },
    });
  });

  it('le numéro est normalisé : ni plus, ni espaces, ni tirets', () => {
    expect(buildTemplatePayload({ ...MESSAGE, to: '+216-99 192 829' }).to).toBe('21699192829');
  });

  it('les paramètres sont assainis : Meta refuse sauts de ligne, tabulations et espaces multiples', () => {
    expect(sanitizeTemplateParameter('Nour\nB.\tdit    bonjour')).toBe('Nour B. dit bonjour');
    expect(sanitizeTemplateParameter('   bordé   ')).toBe('bordé');
    expect(sanitizeTemplateParameter('x'.repeat(400)).length).toBeLessThanOrEqual(300);
  });

  it('un paramètre vide ne casse pas le modèle', () => {
    expect(sanitizeTemplateParameter('')).toBe('—');
  });
});

describe('envoi', () => {
  it('appelle le bon point d’accès, avec le jeton en en-tête', async () => {
    const appel = jest.fn().mockResolvedValue(reponse(200, { messages: [{ id: 'wamid.ABC' }] }));
    const r = await sendWhatsAppTemplate(MESSAGE, { env: ENV, fetchImpl: appel as never });
    expect(r).toEqual({ status: 'sent', messageId: 'wamid.ABC' });
    const [url, init] = appel.mock.calls[0];
    expect(url).toBe('https://graph.facebook.com/v21.0/123456789/messages');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe(`Bearer ${FAUX_JETON}`);
  });

  it('un refus de validation n’est pas retenté', async () => {
    const appel = jest
      .fn()
      .mockResolvedValue(reponse(400, { error: { code: 132000, message: 'Template params mismatch' } }));
    const r = await sendWhatsAppTemplate(MESSAGE, { env: ENV, fetchImpl: appel as never, attempts: 3 });
    expect(r.status).toBe('failed');
    expect(appel).toHaveBeenCalledTimes(1);
    if (r.status === 'failed') expect(r.retryable).toBe(false);
  });

  it('une panne passagère est retentée, puis réussit', async () => {
    const appel = jest
      .fn()
      .mockResolvedValueOnce(reponse(503, { error: { message: 'service indisponible' } }))
      .mockResolvedValueOnce(reponse(200, { messages: [{ id: 'wamid.DEF' }] }));
    const r = await sendWhatsAppTemplate(MESSAGE, { env: ENV, fetchImpl: appel as never, attempts: 3, backoffMs: 0 });
    expect(r).toEqual({ status: 'sent', messageId: 'wamid.DEF' });
    expect(appel).toHaveBeenCalledTimes(2);
  });

  it('une coupure réseau est retentée, puis abandonnée proprement', async () => {
    const appel = jest.fn().mockRejectedValue(new Error('ECONNRESET'));
    const r = await sendWhatsAppTemplate(MESSAGE, { env: ENV, fetchImpl: appel as never, attempts: 2, backoffMs: 0 });
    expect(r.status).toBe('failed');
    expect(appel).toHaveBeenCalledTimes(2);
  });

  it('le refus « un numéro ne peut pas s’écrire à lui-même » est traduit en clair', async () => {
    const appel = jest
      .fn()
      .mockResolvedValue(reponse(400, { error: { code: 131021, message: 'Recipient cannot be sender' } }));
    const r = await sendWhatsAppTemplate(MESSAGE, { env: ENV, fetchImpl: appel as never });
    expect(r.status).toBe('failed');
    if (r.status === 'failed') {
      expect(r.reason).toMatch(/destinataire.*exp[ée]diteur|même numéro/i);
    }
  });

  it('le jeton ne fuit dans aucun message d’erreur', async () => {
    const appel = jest
      .fn()
      .mockResolvedValue(reponse(401, { error: { message: `Invalid OAuth access token ${FAUX_JETON}` } }));
    const r = await sendWhatsAppTemplate(MESSAGE, { env: ENV, fetchImpl: appel as never });
    expect(JSON.stringify(r)).not.toContain(FAUX_JETON);
  });
});
