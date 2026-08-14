import { randomBytes } from 'node:crypto';
import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

type SeedEnvironment = Readonly<Record<string, string | undefined>>;

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', 'postgres-e2e']);
const DISPOSABLE_DATABASE = /^nexus_(?:disposable_.+_test|e2e)$/;

/**
 * Fail closed before a seed opens a database connection.
 *
 * A seed is allowed only on an explicitly marked, local disposable database.
 * Merely setting NODE_ENV to development is intentionally insufficient.
 */
export function assertSafeSeedTarget(env: SeedEnvironment = process.env): void {
  const explicitlyDisposable = env.NEXUS_DISPOSABLE_POSTGRES === '1'
    || env.E2E_DISPOSABLE_STACK === '1';
  if (!explicitlyDisposable) {
    throw new Error('SEED_TARGET_FORBIDDEN');
  }

  try {
    const parsed = new URL(env.DATABASE_URL ?? '');
    const database = parsed.pathname.replace(/^\//, '').split('?')[0];
    if (
      parsed.protocol !== 'postgresql:'
      || !LOCAL_HOSTS.has(parsed.hostname)
      || !DISPOSABLE_DATABASE.test(database)
    ) {
      throw new Error('SEED_TARGET_FORBIDDEN');
    }
  } catch {
    throw new Error('SEED_TARGET_FORBIDDEN');
  }
}

/** Generate a URL-safe 384-bit credential. It is never logged by this module. */
export function generateRuntimePassword(): string {
  return randomBytes(48).toString('base64url');
}

/** Persist disposable credentials locally without ever sending them to stdout. */
export function writeRuntimeCredentialsManifest(
  path: string,
  payload: Readonly<Record<string, unknown>>,
): string {
  const absolutePath = resolve(path);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, JSON.stringify(payload, null, 2), {
    encoding: 'utf8',
    mode: 0o600,
  });
  chmodSync(absolutePath, 0o600);
  return absolutePath;
}
