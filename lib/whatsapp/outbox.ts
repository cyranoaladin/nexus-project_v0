/**
 * File durable des notifications WhatsApp.
 *
 * Une réservation ne doit pas être connue de la seule base : la maison doit en
 * être prévenue. L'e-mail l'est déjà par une file persistante ; ce module donne
 * la même garantie au WhatsApp, sur la même table `canonical_job_outbox`.
 *
 * Pourquoi un ouvrier distinct de celui des e-mails : le sien porte une
 * sémantique propre au SMTP — remise incertaine après un 250 perdu, mise en
 * quarantaine des invitations. Rien de cela ne s'applique ici, et l'étendre
 * reviendrait à toucher un ouvrier critique pour un besoin plus simple.
 *
 * La charge est chiffrée AES-256-GCM avec `WHATSAPP_OUTBOX_ENCRYPTION_KEY`,
 * exactement comme les invitations parents : même dérivation de clé, même
 * enveloppe, même secret. La maison n'a donc rien de plus à configurer que ce
 * que le transport WhatsApp exige déjà.
 *
 * Propriété importante : tant que les identifiants Meta ne sont pas posés, la
 * file n'est pas réclamée du tout. Les travaux attendent sans consommer de
 * tentative, et partent le jour où la configuration arrive.
 */
import { createCipheriv, createDecipheriv, createHmac, randomBytes, randomUUID } from 'node:crypto';

import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';

import {
  isWhatsAppCloudConfigured,
  sendWhatsAppTemplate,
  type WhatsAppSendResult,
} from './cloud-api';

export const WHATSAPP_JOB_TYPE = 'SEND_WHATSAPP_ORDER';
export const WHATSAPP_MAX_ATTEMPTS = 8;

const BASE_DELAY_MS = 30_000;
const MAX_DELAY_MS = 60 * 60_000;
const SCHEMA_VERSION = 'manuel-order-whatsapp.v1';
const KEY_VERSION = 'v1';

function key(): Buffer {
  const secret = process.env.WHATSAPP_OUTBOX_ENCRYPTION_KEY?.trim();
  if (!secret || secret.length < 32) throw new Error('WHATSAPP_OUTBOX_ENCRYPTION_KEY_INVALID');
  return createHmac('sha256', secret).update(KEY_VERSION).digest();
}

function aad(correlationId: string): Buffer {
  return Buffer.from(`${SCHEMA_VERSION}\0${KEY_VERSION}\0${correlationId}`);
}

/** Vrai seulement si le transport ET le chiffrement sont configurés. */
export function isOrderWhatsAppReady(env: Record<string, string | undefined> = process.env): boolean {
  if (!isWhatsAppCloudConfigured(env)) return false;
  const secret = env.WHATSAPP_OUTBOX_ENCRYPTION_KEY?.trim();
  return Boolean(secret && secret.length >= 32);
}

export function encryptOrderIntent(content: WhatsAppIntentPayload, correlationId = randomUUID()) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv, { authTagLength: 16 });
  cipher.setAAD(aad(correlationId));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(content), 'utf8'), cipher.final()]);
  return {
    schemaVersion: SCHEMA_VERSION,
    keyVersion: KEY_VERSION,
    correlationId,
    iv: iv.toString('base64url'),
    tag: cipher.getAuthTag().toString('base64url'),
    ciphertext: ciphertext.toString('base64url'),
  };
}

export function decryptOrderIntent(payload: unknown): WhatsAppIntentPayload {
  const p = payload as Record<string, string> | null;
  if (!p || p.schemaVersion !== SCHEMA_VERSION) throw new Error('WHATSAPP_ORDER_ENVELOPE_INVALID');
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(p.iv, 'base64url'), { authTagLength: 16 });
  decipher.setAAD(aad(p.correlationId));
  decipher.setAuthTag(Buffer.from(p.tag, 'base64url'));
  const clair = Buffer.concat([decipher.update(Buffer.from(p.ciphertext, 'base64url')), decipher.final()]);
  return JSON.parse(clair.toString('utf8')) as WhatsAppIntentPayload;
}

export interface WhatsAppIntentPayload {
  to: string;
  template: string;
  language: string;
  parameters: string[];
}

export interface WhatsAppIntentInput extends WhatsAppIntentPayload {
  aggregateId: string;
  aggregateType?: string;
  /** Rend l'inscription idempotente : deux dépôts identiques n'en font qu'un. */
  dedupeKey: string;
  now?: Date;
}

// Même signature que enqueueParentWhatsAppInvitation : le client
// transactionnel de Prisma, restreint à la seule table qu'on écrit.
type OutboxTransaction = Pick<Prisma.TransactionClient, 'jobOutbox'>;

/** Attente avant la prochaine tentative : croissante, bornée à une heure. */
export function nextAttemptDelayMs(attempt: number): number {
  const exposant = Math.max(0, Math.min(attempt, 20));
  return Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** (exposant - 1 < 0 ? 0 : exposant - 1));
}

/**
 * Dépose l'intention DANS la transaction de l'appelant : si la commande n'est
 * pas écrite, la notification n'existe pas non plus, et réciproquement.
 */
export async function enqueueWhatsAppIntent(
  transaction: OutboxTransaction,
  input: WhatsAppIntentInput,
) {
  const payload = encryptOrderIntent({
    to: input.to,
    template: input.template,
    language: input.language,
    parameters: input.parameters,
  });
  return transaction.jobOutbox.create({
    data: {
      jobType: WHATSAPP_JOB_TYPE,
      aggregateType: input.aggregateType ?? 'MANUEL_ORDER',
      aggregateId: input.aggregateId,
      sourceEventKey: input.dedupeKey,
      idempotencyKey: `${WHATSAPP_JOB_TYPE}:${input.dedupeKey}`,
      status: 'PENDING',
      payload: payload as unknown as Prisma.InputJsonValue,
      availableAt: input.now ?? new Date(),
    },
    select: { id: true },
  });
}

function lisible(payload: unknown): WhatsAppIntentPayload | null {
  let p: Partial<WhatsAppIntentPayload>;
  try {
    p = decryptOrderIntent(payload);
  } catch {
    return null;
  }
  if (typeof p.to !== 'string' || !p.to.trim()) return null;
  if (typeof p.template !== 'string' || !p.template.trim()) return null;
  if (typeof p.language !== 'string' || !p.language.trim()) return null;
  if (!Array.isArray(p.parameters)) return null;
  return { to: p.to, template: p.template, language: p.language, parameters: p.parameters.map(String) };
}

interface DrainDependencies {
  database: typeof prisma;
  send: (message: WhatsAppIntentPayload) => Promise<WhatsAppSendResult>;
  env: Record<string, string | undefined>;
  now: () => Date;
}

export async function drainWhatsAppOutbox(
  options: Readonly<{ limit?: number; owner?: string; leaseDurationMs?: number }> = {},
  dependencies: Partial<DrainDependencies> = {},
) {
  const database = dependencies.database ?? prisma;
  const env = dependencies.env ?? process.env;
  const maintenant = dependencies.now ?? (() => new Date());
  const envoyer =
    dependencies.send ?? ((message: WhatsAppIntentPayload) => sendWhatsAppTemplate(message, { env, attempts: 1 }));

  // Canal non configuré : on ne réclame rien. Les travaux attendent sans
  // consommer de tentative, et partiront dès que les identifiants existeront.
  if (!isOrderWhatsAppReady(env)) {
    return { skipped: 'not_configured' as const, claimed: 0, completed: 0, retried: 0, finalFailed: 0 };
  }

  const limit = Math.max(1, Math.min(options.limit ?? 20, 100));
  const leaseDurationMs = Math.max(5_000, Math.min(options.leaseDurationMs ?? 60_000, 30 * 60_000));
  const owner = options.owner ?? `whatsapp-outbox-${process.pid}`;
  const now = maintenant();
  const leaseExpiresAt = new Date(now.getTime() + leaseDurationMs);

  const rows = (await database.$transaction(async (transaction) => {
    const t = transaction as unknown as {
      $queryRaw: (q: Prisma.Sql) => Promise<Record<string, unknown>[]>;
      jobOutbox: Pick<Prisma.TransactionClient['jobOutbox'], 'update'>;
    };
    const claimed = await t.$queryRaw(Prisma.sql`
      SELECT *
      FROM "canonical_job_outbox"
      WHERE "jobType" = 'SEND_WHATSAPP_ORDER'::"CanonicalJobType"
        AND "availableAt" <= ${now}
        AND (
          "status" IN (
            'PENDING'::"CanonicalOutboxStatus",
            'RETRY_SCHEDULED'::"CanonicalOutboxStatus"
          )
          OR (
            "status" = 'LEASED'::"CanonicalOutboxStatus"
            AND ("leaseExpiresAt" IS NULL OR "leaseExpiresAt" <= ${now})
          )
        )
      ORDER BY "availableAt" ASC, "createdAt" ASC, "id" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${limit}
    `);
    for (const row of claimed) {
      await t.jobOutbox.update({
        where: { id: row.id as string },
        data: { status: 'LEASED', leaseOwner: owner, leaseExpiresAt, attemptCount: { increment: 1 } },
      });
    }
    return claimed;
  })) as Record<string, unknown>[];

  let completed = 0;
  let retried = 0;
  let finalFailed = 0;

  for (const row of rows) {
    const id = row.id as string;
    const tentative = ((row.attemptCount as number) ?? 0) + 1;
    const charge = lisible(row.payload);

    if (!charge) {
      // Une charge illisible ne se réparera pas : elle est classée, et ne
      // bloque pas la file derrière elle.
      await database.jobOutbox.update({
        where: { id },
        data: { status: 'FAILED_FINAL', lastError: 'WHATSAPP_PAYLOAD_INVALID', leaseOwner: null, leaseExpiresAt: null },
      });
      finalFailed += 1;
      continue;
    }

    const resultat = await envoyer(charge);

    if (resultat.status === 'sent') {
      await database.jobOutbox.update({
        where: { id },
        data: { status: 'COMPLETED', completedAt: maintenant(), lastError: null, leaseOwner: null, leaseExpiresAt: null },
      });
      completed += 1;
      continue;
    }

    if (resultat.status === 'skipped') {
      await database.jobOutbox.update({
        where: { id },
        data: {
          status: 'RETRY_SCHEDULED',
          availableAt: new Date(maintenant().getTime() + MAX_DELAY_MS),
          lastError: `skipped:${resultat.reason}`,
          leaseOwner: null,
          leaseExpiresAt: null,
        },
      });
      retried += 1;
      continue;
    }

    const abandonner = !resultat.retryable || tentative >= WHATSAPP_MAX_ATTEMPTS;
    await database.jobOutbox.update({
      where: { id },
      data: abandonner
        ? { status: 'FAILED_FINAL', lastError: resultat.reason, leaseOwner: null, leaseExpiresAt: null }
        : {
            status: 'RETRY_SCHEDULED',
            availableAt: new Date(maintenant().getTime() + nextAttemptDelayMs(tentative)),
            lastError: resultat.reason,
            leaseOwner: null,
            leaseExpiresAt: null,
          },
    });
    if (abandonner) finalFailed += 1;
    else retried += 1;
  }

  return { claimed: rows.length, completed, retried, finalFailed };
}
