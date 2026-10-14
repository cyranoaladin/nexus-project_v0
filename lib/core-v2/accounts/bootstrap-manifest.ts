import { createHash } from 'node:crypto';
import { readFileSync, openSync, fstatSync, closeSync, constants } from 'node:fs';
import { z } from 'zod';
import { InvalidStateError } from '../errors';

export const bootstrapManifestSchema = z.object({
  finalSha: z.string().regex(/^[0-9a-f]{40}$/),
  databaseIdentity: z.string().min(1).max(128),
  migrationHead: z.string().regex(/^[0-9]{4}_[a-z0-9_]+$/),
  v1UserId: z.string().regex(/^[A-Za-z0-9_-]{8,128}$/),
  expectedV1State: z.object({ role: z.literal('ADMIN'), activated: z.literal(true),
    disabled: z.literal(false), merged: z.literal(false) }).strict(),
  capability: z.literal('ADMIN'),
  nonce: z.string().regex(/^[A-Za-z0-9_-]{16,128}$/),
  expiresAt: z.string().datetime(),
  // A controlled reason code avoids placing nominative free text in audit metadata.
  reason: z.string().regex(/^[A-Z][A-Z0-9_]{4,79}$/),
  fingerprint: z.string().regex(/^[0-9a-f]{64}$/),
}).strict();

export type BootstrapManifest = z.infer<typeof bootstrapManifestSchema>;

export function canonicalBootstrapJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalBootstrapJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalBootstrapJson(v)}`).join(',')}}`;
}

export function fingerprintOfBootstrapManifest(raw: Omit<BootstrapManifest, 'fingerprint'> | BootstrapManifest): string {
  const body: Record<string, unknown> = { ...raw };
  delete body.fingerprint;
  return createHash('sha256').update(canonicalBootstrapJson(body)).digest('hex');
}

export function parseBootstrapManifest(raw: unknown): BootstrapManifest {
  const parsed = bootstrapManifestSchema.safeParse(raw);
  if (!parsed.success) throw new InvalidStateError('MANIFEST_INVALID');
  if (fingerprintOfBootstrapManifest(parsed.data) !== parsed.data.fingerprint) {
    throw new InvalidStateError('MANIFEST_FINGERPRINT_MISMATCH');
  }
  return parsed.data;
}

export function loadBootstrapManifest(path: string): BootstrapManifest {
  let descriptor: number;
  try { descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK); }
  catch { throw new InvalidStateError('MANIFEST_PERMISSIONS'); }
  try {
    const stat = fstatSync(descriptor);
    if (!stat.isFile() || (stat.mode & 0o777) !== 0o400 || stat.uid !== process.geteuid?.() || stat.nlink !== 1)
      throw new InvalidStateError('MANIFEST_PERMISSIONS');
    if (stat.size < 1 || stat.size > 16_384) throw new InvalidStateError('MANIFEST_FILE_INVALID');
    let raw: unknown;
    try { raw = JSON.parse(readFileSync(descriptor, 'utf8')); }
    catch { throw new InvalidStateError('MANIFEST_FILE_INVALID'); }
    return parseBootstrapManifest(raw);
  } finally { closeSync(descriptor); }
}
