/**
 * Pré-commande de manuels — validation, chiffrage et enregistrement.
 *
 * Le prix est TOUJOURS recalculé ici, à partir des seuls identifiants de
 * volumes reçus. Rien de ce que le navigateur envoie sur les montants n'est
 * lu : un total venu du client serait un prix choisi par le client.
 *
 * Aucune table dédiée : la demande est enregistrée comme fiche de contact
 * (source `manuels-precommande`) et son détail complet part par e-mail. Tant
 * que le catalogue n'est pas livrable, une table de commandes serait un
 * registre de promesses que la maison ne peut pas tenir.
 */
import { z } from 'zod';

import { normalizeUserEmail } from '@/lib/contact/user-email';
import { getLeadNotificationRecipient } from '@/lib/crm/contact-leads';
import { enqueueEmailIntent } from '@/lib/email/outbox';
import { kickEmailOutboxDrain } from '@/lib/email/outbox-scheduler';
import {
  manuelsOrderAcknowledgement,
  manuelsOrderNotification,
  type ManuelsOrderData,
} from '@/lib/email/templates';
import { prisma } from '@/lib/prisma';
import { WHATSAPP_CONTACT_NUMBER } from '@/lib/whatsapp';
import {
  sendWhatsAppTemplate,
  type WhatsAppSendResult,
} from '@/lib/whatsapp/cloud-api';

import type { ManuelVolume } from './types';

import { getManuelsBaremeClient } from './catalogue-client';
import {
  MANUEL_FORMATS,
  quote,
  resolveVolumes,
  savingForFormat,
  totalForFormat,
  unitTotalForFormat,
  type ManuelFormat,
} from './pricing';

export const MANUEL_FORMAT_LABELS: Record<ManuelFormat, string> = {
  pdf: 'PDF seul',
  'papier-nb': 'PDF + papier noir et blanc',
  'papier-couleur': 'PDF + papier couleur',
};

/**
 * Message à modèle envoyé au WhatsApp de la maison à chaque réservation.
 *
 * Meta n'accepte pas de texte libre à l'initiative de l'entreprise : le modèle
 * doit être créé et approuvé dans Meta Business Manager. Corps attendu, sept
 * paramètres, dans cet ordre :
 *
 *   Nouvelle réservation de manuels.
 *   Référence : {{1}}
 *   Client : {{2}} — {{3}}
 *   Format : {{4}}
 *   Panier : {{5}}
 *   Total : {{6}}
 *   Remise : {{7}}
 *
 * Réglages, par variables d'environnement :
 *   WHATSAPP_ORDER_RECIPIENT       téléphone qui reçoit les commandes
 *   WHATSAPP_ORDER_TEMPLATE        nom du modèle, défaut commande_manuels
 *   WHATSAPP_ORDER_TEMPLATE_LANG   langue du modèle, défaut fr
 */
const WHATSAPP_TEMPLATE_DEFAULT = 'commande_manuels';
const WHATSAPP_LANGUAGE_DEFAULT = 'fr';

const DELIVERY_LABELS = {
  retrait: 'Retrait au centre Nexus',
  livraison: 'Livraison à domicile (offerte)',
} as const;

export type ManuelOrderErrorCode = 'invalid_payload' | 'unknown_volume' | 'empty_order';

export class ManuelOrderValidationError extends Error {
  code: ManuelOrderErrorCode;

  constructor(code: ManuelOrderErrorCode) {
    super('MANUEL_ORDER_VALIDATION_FAILED');
    this.code = code;
  }
}

const orderSchema = z.object({
  items: z.array(z.string().trim().min(1).max(80)).min(1).max(60),
  format: z.enum(MANUEL_FORMATS as unknown as [ManuelFormat, ...ManuelFormat[]]),
  delivery: z.discriminatedUnion('mode', [
    z.object({ mode: z.literal('retrait') }),
    z.object({
      mode: z.literal('livraison'),
      address: z.string().trim().min(1).max(300),
      city: z.string().trim().min(1).max(120),
    }),
  ]),
  contact: z.object({
    name: z.string().trim().min(1).max(200),
    email: z.string().trim().email().max(320).transform(normalizeUserEmail),
    phone: z.string().trim().min(6).max(40),
  }),
  message: z.string().trim().max(1000).optional(),
  consent: z.literal(true),
});

export type ManuelOrderInput = z.input<typeof orderSchema>;

export interface ManuelOrderQuote {
  volumes: number;
  pages: number;
  pdf: number;
  bw: number;
  color: number;
  /** Ce que la même sélection coûterait volume par volume, dans ce format. */
  unitTotal: number;
  savingTnd: number;
  savingPct: number;
  format: ManuelFormat;
  total: number;
}

/** Résout la sélection, en refusant tout identifiant que le catalogue ignore. */
function resolveOrderVolumes(items: string[]): ManuelVolume[] {
  try {
    return resolveVolumes(items);
  } catch {
    throw new ManuelOrderValidationError('unknown_volume');
  }
}

function priceResolved(volumes: ManuelVolume[], format: ManuelFormat): ManuelOrderQuote {
  const devis = quote(volumes.map((v) => v.pages), getManuelsBaremeClient());
  const total = totalForFormat(devis, format);
  if (total <= 0) throw new ManuelOrderValidationError('empty_order');
  const economie = savingForFormat(devis, format);
  return {
    volumes: devis.volumes,
    pages: devis.pages,
    pdf: devis.pdf,
    bw: devis.bw,
    color: devis.color,
    unitTotal: unitTotalForFormat(devis, format),
    savingTnd: economie.tnd,
    savingPct: economie.pct,
    format,
    total,
  };
}

/** Le devis d'une sélection, recalculé de bout en bout. */
export function priceOrder(items: string[], format: ManuelFormat): ManuelOrderQuote {
  return priceResolved(resolveOrderVolumes(items), format);
}

function buildNotes(
  devis: ManuelOrderQuote,
  deliveryLabel: string,
  ids: string[],
): string {
  const entete =
    `Pré-commande manuels — ${devis.volumes} vol., ${devis.pages} p., ` +
    `${MANUEL_FORMAT_LABELS[devis.format]}, ${deliveryLabel}. Total ${devis.total} DT. `;
  // ContactLead.notes est borné à 500 caractères par son schéma : l'en-tête
  // passe toujours, la liste des volumes est tronquée si besoin. Le détail
  // intégral part dans l'e-mail interne, qui n'est pas borné.
  const reste = 500 - entete.length;
  const liste = ids.join(' ');
  return entete + (liste.length <= reste ? liste : `${liste.slice(0, Math.max(0, reste - 1))}…`);
}

/**
 * Téléphone qui reçoit les réservations. À défaut de réglage, c'est le numéro
 * WhatsApp de la maison (99 19 28 29) : la notification part, sans dépendre
 * d'une variable d'environnement oubliée.
 */
function orderRecipient(): string {
  return process.env.WHATSAPP_ORDER_RECIPIENT?.trim() || WHATSAPP_CONTACT_NUMBER;
}

/**
 * Prévient la maison sur WhatsApp. Ne lève jamais : une réservation est déjà
 * enregistrée et notifiée par e-mail quand on arrive ici, et aucune panne de
 * messagerie ne doit la faire perdre.
 */
async function notifyOrderOnWhatsApp(courrier: ManuelsOrderData): Promise<WhatsAppSendResult> {
  try {
    return await sendWhatsAppTemplate({
      to: orderRecipient(),
      template: process.env.WHATSAPP_ORDER_TEMPLATE?.trim() || WHATSAPP_TEMPLATE_DEFAULT,
      language: process.env.WHATSAPP_ORDER_TEMPLATE_LANG?.trim() || WHATSAPP_LANGUAGE_DEFAULT,
      parameters: [
        courrier.reference,
        courrier.name,
        courrier.phone,
        courrier.formatLabel,
        `${courrier.volumes} volume${courrier.volumes > 1 ? 's' : ''}, ${courrier.pages} pages`,
        `${courrier.total} DT`,
        courrier.address ? `${courrier.deliveryLabel} — ${courrier.address}` : courrier.deliveryLabel,
      ],
    });
  } catch {
    return { status: 'failed', reason: 'Le canal WhatsApp a échoué.', retryable: true };
  }
}

export async function captureManuelOrder(payload: unknown) {
  const parsed = orderSchema.safeParse(payload);
  if (!parsed.success) throw new ManuelOrderValidationError('invalid_payload');
  const data = parsed.data;

  const volumes = resolveOrderVolumes(data.items);
  const devis = priceResolved(volumes, data.format);

  const deliveryLabel = DELIVERY_LABELS[data.delivery.mode];
  const address =
    data.delivery.mode === 'livraison'
      ? `${data.delivery.address}, ${data.delivery.city}`
      : undefined;

  const lead = await prisma.$transaction(async (transaction) => {
    const created = await transaction.contactLead.create({
      data: {
        name: data.contact.name,
        email: data.contact.email,
        phone: data.contact.phone,
        profile: 'Candidat individuel',
        interest: `Manuels — ${MANUEL_FORMAT_LABELS[data.format]}`,
        urgency: null,
        source: 'manuels-precommande',
        status: 'NEW',
        notes: buildNotes(devis, deliveryLabel, volumes.map((v) => v.id)),
      },
    });

    const courrier: ManuelsOrderData = {
      reference: created.id,
      name: data.contact.name,
      email: data.contact.email,
      phone: data.contact.phone,
      formatLabel: MANUEL_FORMAT_LABELS[data.format],
      deliveryLabel,
      address,
      lines: volumes.map((v) => ({
        title: v.title,
        disciplineLabel: v.disciplineLabel,
        pages: v.pages,
      })),
      volumes: devis.volumes,
      pages: devis.pages,
      total: devis.total,
      message: data.message,
      createdAt: created.createdAt ?? new Date(),
    };

    const interne = manuelsOrderNotification(courrier);
    await enqueueEmailIntent(transaction, {
      aggregateType: 'MANUEL_ORDER',
      aggregateId: created.id,
      messageType: 'TRANSACTIONAL_NOTIFICATION',
      dedupeKey: `${created.id}:interne`,
      to: getLeadNotificationRecipient(),
      subject: interne.subject,
      html: interne.html,
      text: interne.text,
      replyTo: data.contact.email,
    });

    const accuse = manuelsOrderAcknowledgement(courrier);
    await enqueueEmailIntent(transaction, {
      aggregateType: 'MANUEL_ORDER',
      aggregateId: created.id,
      messageType: 'TRANSACTIONAL_NOTIFICATION',
      dedupeKey: `${created.id}:accuse`,
      to: data.contact.email,
      subject: accuse.subject,
      html: accuse.html,
      text: accuse.text,
    });

    return created;
  });

  kickEmailOutboxDrain();

  const whatsapp = await notifyOrderOnWhatsApp({
    reference: lead.id,
    name: data.contact.name,
    email: data.contact.email,
    phone: data.contact.phone,
    formatLabel: MANUEL_FORMAT_LABELS[data.format],
    deliveryLabel,
    address,
    lines: [],
    volumes: devis.volumes,
    pages: devis.pages,
    total: devis.total,
    createdAt: lead.createdAt ?? new Date(),
  });

  if (whatsapp.status === 'failed') {
    // Aucune donnée nominative au journal : la référence suffit à retrouver la
    // réservation, qui est enregistrée et déjà partie par e-mail.
    console.error(`[manuels/whatsapp] ${lead.id} non remis — ${whatsapp.reason}`);
  }

  return { reference: lead.id, quote: devis, whatsapp: whatsapp.status };
}
