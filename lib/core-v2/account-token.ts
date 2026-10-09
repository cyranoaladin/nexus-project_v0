import { createHmac, randomBytes } from 'node:crypto';

export const ACCOUNT_TOKEN_CURRENT_KEY_ENV = 'CORE_V2_ACCOUNT_TOKEN_HMAC_CURRENT_KEY_ID';
export const ACCOUNT_TOKEN_KEYS_ENV = 'CORE_V2_ACCOUNT_TOKEN_HMAC_KEYS';
export type AccountTokenPurpose = 'ACTIVATION' | 'PASSWORD_RESET';
const keyIdPattern = /^[a-z][a-z0-9-]{0,23}$/;
const tokenPattern = /^v1:([a-z][a-z0-9-]{0,23}):([A-Za-z0-9_-]{43})$/;
const domain = 'nexus-core-v2-account-token';

function keyring(env: NodeJS.ProcessEnv = process.env): { currentId: string; keys: Map<string, Buffer> } {
  const currentId = env[ACCOUNT_TOKEN_CURRENT_KEY_ENV];
  const encoded = env[ACCOUNT_TOKEN_KEYS_ENV];
  if (!currentId || !encoded) throw new Error('CORE_V2_ACCOUNT_TOKEN_KEYS_REQUIRED');
  if (!keyIdPattern.test(currentId) || encoded.length > 4096) throw new Error('CORE_V2_ACCOUNT_TOKEN_KEYS_INVALID');
  let parsed: unknown;
  try { parsed = JSON.parse(encoded); } catch { throw new Error('CORE_V2_ACCOUNT_TOKEN_KEYS_INVALID'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('CORE_V2_ACCOUNT_TOKEN_KEYS_INVALID');
  const entries = Object.entries(parsed as Record<string, unknown>);
  if (entries.length < 1 || entries.length > 4) throw new Error('CORE_V2_ACCOUNT_TOKEN_KEYS_INVALID');
  const keys = new Map<string, Buffer>();
  for (const [id, value] of entries) {
    if (!keyIdPattern.test(id) || typeof value !== 'string' || !/^[a-fA-F0-9]{64,128}$/.test(value)
      || value.length % 2 !== 0) throw new Error('CORE_V2_ACCOUNT_TOKEN_KEYS_INVALID');
    const key = Buffer.from(value, 'hex');
    for (const prior of keys.values()) {
      if (prior.equals(key)) throw new Error('CORE_V2_ACCOUNT_TOKEN_KEY_REUSED');
    }
    for (const name of ['NEXTAUTH_SECRET', 'AUTH_SECRET', 'EMAIL_OUTBOX_ENCRYPTION_KEY', 'DOCUMENT_ENCRYPTION_KEY', 'RATE_LIMIT_KEY_SECRET', 'NEXUS_INTERNAL_TOKEN_SECRET']) {
      const other = env[name];
      if (other && (other === value || (/^[a-fA-F0-9]+$/.test(other) && other.length === value.length
        && Buffer.from(other, 'hex').equals(key)))) throw new Error('CORE_V2_ACCOUNT_TOKEN_KEY_NOT_DEDICATED');
    }
    keys.set(id, key);
  }
  if (!keys.has(currentId)) throw new Error('CORE_V2_ACCOUNT_TOKEN_CURRENT_KEY_ABSENT');
  return { currentId, keys };
}

export function assertAccountTokenConfiguration(env: NodeJS.ProcessEnv = process.env): void {
  keyring(env);
}

function digest(rawToken: string, purpose: AccountTokenPurpose, id: string, key: Buffer): string {
  return `v1:${id}:${createHmac('sha256', key).update(`${domain}\0v1\0${purpose}\0${rawToken}`).digest('hex')}`;
}

/** No default key and no legacy SHA fallback. The public key-id is not a secret. */
export function createAccountToken(purpose: AccountTokenPurpose): { rawToken: string; tokenHash: string } {
  const { currentId, keys } = keyring();
  const key = keys.get(currentId);
  if (!key) throw new Error('CORE_V2_ACCOUNT_TOKEN_CURRENT_KEY_ABSENT');
  const rawToken = `v1:${currentId}:${randomBytes(32).toString('base64url')}`;
  return { rawToken, tokenHash: digest(rawToken, purpose, currentId, key) };
}

/** Malformed/retired tokens are opaque refusals, before any database lookup. */
export function accountTokenDigest(rawToken: string, purpose: AccountTokenPurpose): string | null {
  const match = tokenPattern.exec(rawToken);
  if (!match) return null;
  const id = match[1];
  const entropy = match[2];
  if (!id || !entropy) return null;
  if (Buffer.from(entropy, 'base64url').toString('base64url') !== entropy) return null;
  const { keys } = keyring();
  const key = keys.get(id);
  return key ? digest(rawToken, purpose, id, key) : null;
}
