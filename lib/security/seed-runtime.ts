import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, constants, openSync, fstatSync, readFileSync, closeSync,
  lstatSync, fsyncSync, renameSync, unlinkSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

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

/** Credentials remain private, bounded, owner-controlled regular files. */
export function readRuntimeCredentialsManifest(path: string): Readonly<Record<string, unknown>> {
  let fd: number | undefined;
  try {
    fd = openSync(resolve(path), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const file = fstatSync(fd);
    if (!file.isFile() || file.nlink !== 1 || (file.mode & 0o777) !== 0o600
      || file.uid !== process.geteuid?.() || file.size < 2 || file.size > 65_536) throw new Error();
    const value: unknown = JSON.parse(readFileSync(fd, 'utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value as Readonly<Record<string, unknown>>;
  } catch { throw new Error('RUNTIME_CREDENTIALS_MANIFEST_INVALID'); }
  finally { if (fd !== undefined) closeSync(fd); }
}

/** Persist disposable credentials locally without ever sending them to stdout. */
export function writeRuntimeCredentialsManifest(
  path: string,
  payload: Readonly<Record<string, unknown>>,
): string {
  const absolutePath = resolve(path);
  const directory = dirname(absolutePath);
  let fd: number | undefined;
  let temporary: string | undefined;
  const privateTarget = () => {
    try {
      const file = lstatSync(absolutePath);
      if (!file.isFile() || file.nlink !== 1 || file.uid !== process.geteuid?.()
        || (file.mode & 0o777) !== 0o600) throw new Error();
      return file;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  };
  try {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const parent = lstatSync(directory);
    if (!parent.isDirectory() || parent.uid !== process.geteuid?.() || (parent.mode & 0o022) !== 0) throw new Error();
    const original = privateTarget();
    const content = JSON.stringify(payload, null, 2);
    if (Buffer.byteLength(content) > 65_536) throw new Error();
    const candidate = join(directory, `.${basename(absolutePath)}.${randomUUID()}.tmp`);
    fd = openSync(candidate, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    temporary = candidate;
    writeFileSync(fd, content, 'utf8'); fsyncSync(fd); closeSync(fd); fd = undefined;
    const current = privateTarget();
    if ((original === null) !== (current === null) || original && current
      && (original.ino !== current.ino || original.dev !== current.dev)) throw new Error();
    renameSync(temporary, absolutePath); temporary = undefined;
    return absolutePath;
  } catch { throw new Error('RUNTIME_CREDENTIALS_MANIFEST_WRITE_REFUSED'); }
  finally {
    if (fd !== undefined) closeSync(fd);
    if (temporary) unlinkSync(temporary);
  }
}
