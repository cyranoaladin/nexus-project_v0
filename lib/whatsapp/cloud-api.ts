/**
 * Envoi WhatsApp par l'API Cloud de Meta.
 *
 * Un lien `wa.me` ne s'envoie pas tout seul : il attend un clic. Pour qu'une
 * réservation parte sans geste humain, il faut l'API Cloud, et donc un message
 * À MODÈLE — Meta n'autorise pas de texte libre à l'initiative de l'entreprise
 * hors de la fenêtre de 24 heures ouverte par le client.
 *
 * Trois règles tenues ici :
 *  — le jeton d'accès ne sort jamais, pas même dans un message d'erreur ;
 *  — un refus de validation n'est pas retenté, une panne passagère si ;
 *  — un canal non configuré est « écarté », pas « en échec » : une maison qui
 *    n'a pas encore ses identifiants ne doit pas voir ses journaux rougir.
 *
 * Configuration, par variables d'environnement, jamais dans le code :
 *   WHATSAPP_CLOUD_PHONE_NUMBER_ID   identifiant du numéro expéditeur
 *   WHATSAPP_CLOUD_ACCESS_TOKEN      jeton permanent
 *   WHATSAPP_CLOUD_API_VERSION       défaut v21.0
 */

export interface WhatsAppTemplateMessage {
  /** Destinataire, sous n'importe quelle écriture : il est normalisé ici. */
  to: string;
  template: string;
  language: string;
  parameters: string[];
}

export type WhatsAppSendResult =
  | { status: 'sent'; messageId: string }
  | { status: 'skipped'; reason: 'not_configured' | 'no_recipient' }
  | { status: 'failed'; reason: string; retryable: boolean };

type Env = Record<string, string | undefined>;

const DEFAULT_API_VERSION = 'v21.0';
const PARAMETER_MAX = 300;

export function isWhatsAppCloudConfigured(env: Env = process.env): boolean {
  return Boolean(
    env.WHATSAPP_CLOUD_PHONE_NUMBER_ID?.trim() && env.WHATSAPP_CLOUD_ACCESS_TOKEN?.trim(),
  );
}

/** Numéro au format attendu par Meta : chiffres seuls, indicatif compris. */
export function normalizeRecipient(value: string): string {
  return value.replace(/[^0-9]/g, '');
}

/**
 * Meta refuse les paramètres de modèle qui contiennent un saut de ligne, une
 * tabulation ou quatre espaces consécutifs. Un paramètre vide fait également
 * échouer le rendu : il est remplacé par un tiret.
 */
export function sanitizeTemplateParameter(value: string): string {
  const propre = String(value ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (!propre) return '—';
  return propre.length > PARAMETER_MAX ? `${propre.slice(0, PARAMETER_MAX - 1)}…` : propre;
}

export function buildTemplatePayload(message: WhatsAppTemplateMessage) {
  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: normalizeRecipient(message.to),
    type: 'template',
    template: {
      name: message.template,
      language: { code: message.language },
      components: [
        {
          type: 'body',
          parameters: message.parameters.map((p) => ({
            type: 'text',
            text: sanitizeTemplateParameter(p),
          })),
        },
      ],
    },
  };
}

/** Codes de Meta dont la cause mérite d'être dite en clair à l'exploitant. */
const DIAGNOSTICS: Record<number, string> = {
  131021:
    'Meta refuse l’envoi : le destinataire est le même numéro que l’expéditeur. ' +
    'Un numéro WhatsApp Business ne peut pas s’écrire à lui-même — renseignez ' +
    'WHATSAPP_ORDER_RECIPIENT avec un autre téléphone (celui de la permanence).',
  132000: 'Le modèle de message et les paramètres envoyés ne concordent pas.',
  132001: 'Le modèle de message n’existe pas, ou n’est pas approuvé dans cette langue.',
  131026: 'Le destinataire n’a pas de compte WhatsApp, ou ne peut pas recevoir de message.',
  190: 'Le jeton d’accès est invalide ou expiré.',
};

function diagnostiquer(code: number | undefined, status: number): string {
  if (code && DIAGNOSTICS[code]) return DIAGNOSTICS[code];
  return `Meta a refusé l’envoi (HTTP ${status}${code ? `, code ${code}` : ''}).`;
}

export async function sendWhatsAppTemplate(
  message: WhatsAppTemplateMessage,
  options: {
    env?: Env;
    fetchImpl?: typeof fetch;
    attempts?: number;
    backoffMs?: number;
    timeoutMs?: number;
  } = {},
): Promise<WhatsAppSendResult> {
  const env = options.env ?? process.env;
  if (!isWhatsAppCloudConfigured(env)) return { status: 'skipped', reason: 'not_configured' };

  const destinataire = normalizeRecipient(message.to);
  if (!destinataire) return { status: 'skipped', reason: 'no_recipient' };

  const appeler = options.fetchImpl ?? fetch;
  const attempts = Math.max(1, options.attempts ?? 3);
  const backoffMs = options.backoffMs ?? 400;
  const timeoutMs = options.timeoutMs ?? 8000;
  const version = env.WHATSAPP_CLOUD_API_VERSION?.trim() || DEFAULT_API_VERSION;
  const url = `https://graph.facebook.com/${version}/${env.WHATSAPP_CLOUD_PHONE_NUMBER_ID}/messages`;
  const corps = JSON.stringify(buildTemplatePayload({ ...message, to: destinataire }));

  let dernier: WhatsAppSendResult = {
    status: 'failed',
    reason: 'Aucune tentative n’a abouti.',
    retryable: true,
  };

  for (let essai = 1; essai <= attempts; essai += 1) {
    const minuteur = AbortSignal.timeout?.(timeoutMs);
    try {
      const reponse = await appeler(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.WHATSAPP_CLOUD_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: corps,
        ...(minuteur ? { signal: minuteur } : {}),
      });

      const charge = (await reponse.json().catch(() => ({}))) as {
        messages?: { id: string }[];
        error?: { code?: number; message?: string };
      };

      if (reponse.ok) {
        return { status: 'sent', messageId: charge.messages?.[0]?.id ?? '' };
      }

      // Le message renvoyé par Meta peut contenir le jeton : il n'est jamais
      // repris tel quel, seul un diagnostic maison sort d'ici.
      const retryable = reponse.status >= 500 || reponse.status === 429;
      dernier = {
        status: 'failed',
        reason: diagnostiquer(charge.error?.code, reponse.status),
        retryable,
      };
      if (!retryable) return dernier;
    } catch {
      dernier = {
        status: 'failed',
        reason: 'Le service WhatsApp n’a pas répondu.',
        retryable: true,
      };
    }

    if (essai < attempts && backoffMs > 0) {
      await new Promise((r) => setTimeout(r, backoffMs * essai));
    }
  }

  return dernier;
}
