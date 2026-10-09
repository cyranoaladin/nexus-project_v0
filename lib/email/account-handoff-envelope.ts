/** Pure authenticated envelope; no database, provider or Core-runtime dependency. */
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';
import { z } from 'zod';

const VERSION = 'account-email-handoff/v1' as const;
const keyIdPattern = /^[A-Za-z0-9_.-]{1,32}$/;
const issuancePattern = /^[A-Za-z0-9_-]{1,128}$/;
const contentSchema = z.object({
  purpose: z.enum(['ACTIVATION', 'PASSWORD_RESET']),
  userId: z.string().min(1).max(128), issuanceId: z.string().regex(issuancePattern),
  role: z.enum(['ADMIN', 'ASSISTANTE', 'COACH', 'PARENT', 'ELEVE']),
  email: z.string().email().max(320), displayName: z.string().max(300),
  rawToken: z.string().min(16).max(128), expiresAt: z.string().datetime(),
}).strict();
export type AccountEmailHandoffContent = z.infer<typeof contentSchema>;

const encoded = (maximum: number) => z.string().min(1).max(maximum).regex(/^[A-Za-z0-9_-]+$/);
const envelopeSchema = z.object({
  schemaVersion: z.literal(VERSION), keyVersion: z.string().regex(keyIdPattern),
  iv: encoded(32), tag: encoded(32), ciphertext: encoded(16_384),
}).strict();
export type AccountEmailHandoffEnvelope = z.infer<typeof envelopeSchema>;

function invalidKey(): never { throw new Error('ACCOUNT_EMAIL_HANDOFF_KEY_INVALID'); }
function invalidEnvelope(): never { throw new Error('ACCOUNT_EMAIL_HANDOFF_INVALID'); }

function keyring(): Readonly<{ currentId: string; keys: ReadonlyMap<string, string> }> {
  const currentId = process.env.ACCOUNT_EMAIL_HANDOFF_ENCRYPTION_CURRENT_KEY_ID?.trim();
  const encodedKeys = process.env.ACCOUNT_EMAIL_HANDOFF_ENCRYPTION_KEYS?.trim();
  if (currentId !== undefined || encodedKeys !== undefined) {
    if (!currentId || !keyIdPattern.test(currentId) || !encodedKeys || encodedKeys.length > 16_384) invalidKey();
    let parsed: unknown;
    try { parsed = JSON.parse(encodedKeys); } catch { invalidKey(); }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) invalidKey();
    const entries = Object.entries(parsed);
    if (entries.length < 1 || entries.length > 20) invalidKey();
    const keys = new Map<string, string>();
    for (const [id, value] of entries) {
      if (!keyIdPattern.test(id) || typeof value !== 'string' || value.trim().length < 32 || value.length > 4_096) invalidKey();
      keys.set(id, value.trim());
    }
    if (!keys.has(currentId)) invalidKey();
    return { currentId, keys };
  }
  const legacy = process.env.EMAIL_OUTBOX_ENCRYPTION_KEY?.trim();
  if (!legacy || legacy.length < 32 || legacy.length > 4_096) invalidKey();
  return { currentId: 'v1', keys: new Map([['v1', legacy]]) };
}

export function assertAccountEmailHandoffConfiguration(): void { keyring(); }

function encryptionKey(secret: string, id: string): Buffer {
  return createHmac('sha256', secret).update(`${VERSION}\0${id}`).digest();
}
function authenticatedMetadata(issuanceId: string, keyId: string): Buffer {
  if (!issuancePattern.test(issuanceId)) invalidEnvelope();
  return Buffer.from(JSON.stringify([VERSION, keyId, issuanceId]));
}

export function sealAccountEmailHandoff(input: AccountEmailHandoffContent): AccountEmailHandoffEnvelope {
  const ring = keyring();
  const content = contentSchema.safeParse(input);
  if (!content.success) invalidEnvelope();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(ring.keys.get(ring.currentId)!, ring.currentId), iv, { authTagLength: 16 });
  cipher.setAAD(authenticatedMetadata(content.data.issuanceId, ring.currentId));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(content.data), 'utf8'), cipher.final()]);
  return Object.freeze({ schemaVersion: VERSION, keyVersion: ring.currentId,
    iv: iv.toString('base64url'), tag: cipher.getAuthTag().toString('base64url'), ciphertext: ciphertext.toString('base64url') });
}

export function openAccountEmailHandoff(payload: unknown, issuanceId: string): AccountEmailHandoffContent {
  const parsed = envelopeSchema.safeParse(payload);
  if (!parsed.success) invalidEnvelope();
  const ring = keyring();
  const secret = ring.keys.get(parsed.data.keyVersion);
  if (!secret) invalidEnvelope();
  let cleartext: string;
  try {
    const iv = Buffer.from(parsed.data.iv, 'base64url');
    const tag = Buffer.from(parsed.data.tag, 'base64url');
    if (iv.length !== 12 || tag.length !== 16) invalidEnvelope();
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(secret, parsed.data.keyVersion), iv, { authTagLength: 16 });
    decipher.setAAD(authenticatedMetadata(issuanceId, parsed.data.keyVersion));
    decipher.setAuthTag(tag);
    cleartext = Buffer.concat([decipher.update(Buffer.from(parsed.data.ciphertext, 'base64url')), decipher.final()]).toString('utf8');
  } catch { invalidEnvelope(); }
  let content: unknown;
  try { content = JSON.parse(cleartext); } catch { invalidEnvelope(); }
  const result = contentSchema.safeParse(content);
  if (!result.success || result.data.issuanceId !== issuanceId) invalidEnvelope();
  return Object.freeze(result.data);
}
