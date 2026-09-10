/**
 * Core v2 Prisma Client factory — the ONLY supported way to obtain a Core v2
 * database connection anywhere in this codebase.
 *
 * Isolation guarantees (foundation §6-7):
 * - Imports the Core v2-generated client from `core-v2/generated/client`
 *   (see core-v2/prisma/schema.prisma's generator block), never the Core v1
 *   client from `@prisma/client` / `@/lib/prisma`. The two are structurally
 *   different modules — there is no path by which they could be confused.
 * - Reads exclusively `CORE_V2_DATABASE_URL`. Never falls back to
 *   `DATABASE_URL`. Fails closed (throws before any connection attempt) if
 *   `CORE_V2_DATABASE_URL` is unset, empty, or identical to `DATABASE_URL`.
 *
 * Nothing outside `lib/core-v2/**`, `scripts/core-v2/**`, `__tests__/core-v2/**`,
 * and `core-v2/**` itself may import this file — enforced by
 * __tests__/architecture/core-v2-legacy-guards.test.ts
 * (CORE_V2_MUST_NOT_BE_IMPORTED_BY_LIVE_RUNTIME).
 */
import { PrismaClient as CoreV2PrismaClient } from '@/core-v2/generated/client';

export class CoreV2DatabaseUrlError extends Error {}

export function resolveCoreV2DatabaseUrl(
  env: Record<string, string | undefined> = process.env,
): string {
  const coreV2Url = env.CORE_V2_DATABASE_URL;
  if (!coreV2Url || coreV2Url.trim() === '') {
    throw new CoreV2DatabaseUrlError(
      'CORE_V2_DATABASE_URL is required for any Core v2 database access and was not set. ' +
        'Core v2 code must never fall back to DATABASE_URL — set CORE_V2_DATABASE_URL explicitly.',
    );
  }

  const coreV1Url = env.DATABASE_URL;
  if (coreV1Url && coreV1Url.trim() !== '' && coreV1Url === coreV2Url) {
    throw new CoreV2DatabaseUrlError(
      'CORE_V2_DATABASE_URL is identical to DATABASE_URL. Refusing to connect: this would point ' +
        'Core v2 tooling at the Core v1 (legacy) database, which is exactly the collision this ' +
        'guard exists to prevent. Point CORE_V2_DATABASE_URL at a distinct Core v2 database.',
    );
  }

  return coreV2Url;
}

let cachedClient: CoreV2PrismaClient | null = null;

/**
 * Returns a process-wide singleton Core v2 client, created lazily on first
 * call. Throws CoreV2DatabaseUrlError (without ever attempting a connection)
 * if CORE_V2_DATABASE_URL is missing or collides with DATABASE_URL.
 */
export function getCoreV2Client(): CoreV2PrismaClient {
  if (!cachedClient) {
    const datasourceUrl = resolveCoreV2DatabaseUrl();
    cachedClient = new CoreV2PrismaClient({ datasourceUrl });
  }
  return cachedClient;
}

/** Disconnects and clears the cached singleton, if one was created. */
export async function disconnectCoreV2Client(): Promise<void> {
  if (cachedClient) {
    const client = cachedClient;
    cachedClient = null;
    await client.$disconnect();
  }
}
