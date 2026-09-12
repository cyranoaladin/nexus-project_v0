/**
 * Core v2 Prisma Client factory — the ONLY supported way to obtain a Core v2
 * database connection anywhere in this codebase.
 *
 * Isolation guarantees (foundation §6-7, hardened for DATABASE_COLLISION_GUARD_WEAKNESS):
 * - Imports the Core v2-generated client from `core-v2/generated/client`
 *   (see core-v2/prisma/schema.prisma's generator block), never the Core v1
 *   client from `@prisma/client` / `@/lib/prisma`. The two are structurally
 *   different modules — there is no path by which they could be confused.
 * - Reads exclusively `CORE_V2_DATABASE_URL`. Never falls back to
 *   `DATABASE_URL`.
 * - Two independent, complementary safety layers, both fail-closed:
 *   1. CORE_V1_V2_URL_TARGET_COLLISION_GUARD (database-target.ts) — before
 *      any connection attempt, rejects a CORE_V2_DATABASE_URL that resolves
 *      to the same PostgreSQL target (host+port+database) as DATABASE_URL,
 *      by real target comparison rather than raw string equality.
 *   2. CORE_V2_IDENTITY_VALIDATION — after connecting, rejects a target that
 *      does not carry the Core v2 database identity marker (see
 *      requireCoreV2Client()). URL normalization cannot see DNS/network
 *      aliases; the marker cannot prevent a connection being attempted at
 *      all. Neither layer replaces the other.
 *
 * Nothing outside `lib/core-v2/**`, `scripts/core-v2/**`, `__tests__/core-v2/**`,
 * and `core-v2/**` itself may import this file — enforced by
 * __tests__/architecture/core-v2-legacy-guards.test.ts
 * (CORE_V2_MUST_NOT_BE_IMPORTED_BY_LIVE_RUNTIME).
 */
import { PrismaClient as CoreV2PrismaClient } from '@/core-v2/generated/client';
import { assertNoCoreV1V2TargetCollision, CoreV2DatabaseUrlError } from './database-target';

export { CoreV2DatabaseUrlError };

export class CoreV2DatabaseIdentityError extends Error {}

const EXPECTED_SCHEMA_IDENTITY = 'nexus-core-v2';
const EXPECTED_SCHEMA_GENERATION = 3;

export function resolveCoreV2DatabaseUrl(
  env: Record<string, string | undefined> = process.env,
): string {
  const coreV2Url = env.CORE_V2_DATABASE_URL;
  assertNoCoreV1V2TargetCollision(coreV2Url, env.DATABASE_URL);
  // assertNoCoreV1V2TargetCollision throws before this point whenever
  // coreV2Url is missing/empty, so the non-null assertion below is safe.
  return coreV2Url as string;
}

/**
 * Connects with `client` and verifies the Core v2 database identity marker
 * (foundation hardening §6). Throws CoreV2DatabaseIdentityError, and always
 * disconnects first, if the marker is absent or does not match the expected
 * schema identity/generation. Never creates the marker — it is seeded only
 * by the Core v2 baseline migrations.
 */
async function assertCoreV2DatabaseIdentity(client: CoreV2PrismaClient): Promise<void> {
  let marker: { schemaIdentity: string; schemaGeneration: number } | null;
  try {
    marker = await client.coreV2DatabaseIdentity.findUnique({
      where: { id: 1 },
      select: { schemaIdentity: true, schemaGeneration: true },
    });
  } catch (error) {
    await client.$disconnect();
    throw new CoreV2DatabaseIdentityError(
      'Could not read the Core v2 database identity marker (core_v2_database_identity). ' +
        'This could mean the target is not a Core v2 database, its baseline migrations have ' +
        'not been applied, OR a plain connectivity/authentication failure unrelated to database ' +
        `identity — see the underlying error below to tell which. Refusing all Core v2 access ` +
        `before any mutation either way. Underlying error: ${
          error instanceof Error ? error.message : String(error)
        }`,
    );
  }

  if (
    !marker ||
    marker.schemaIdentity !== EXPECTED_SCHEMA_IDENTITY ||
    marker.schemaGeneration !== EXPECTED_SCHEMA_GENERATION
  ) {
    await client.$disconnect();
    throw new CoreV2DatabaseIdentityError(
      'CORE_V2_DATABASE_URL points at a database without the expected Core v2 database identity ' +
        `marker (expected schemaIdentity="${EXPECTED_SCHEMA_IDENTITY}", schemaGeneration=${EXPECTED_SCHEMA_GENERATION}). ` +
        'This is exactly the catastrophic-misroute case the marker exists to catch. Refusing all ' +
        'Core v2 access before any mutation. Core v2 never falls back to Core v1 and never creates ' +
        'the marker itself — apply the Core v2 baseline migrations to the intended database.',
    );
  }
}

// The single source of truth for "the current Core v2 client, once
// validated" — deliberately no separate `cachedClient` variable. An earlier
// version tracked both and only had disconnectCoreV2Client() act on
// cachedClient, which is assigned only after validation *succeeds*; calling
// disconnectCoreV2Client() while a validation was still in flight then did
// nothing (cachedClient was still null) and reset the cache, leaving the
// client that validation went on to produce connected and unreferenced —
// a real, orphaned PostgreSQL connection (caught independently by two
// reviewers). Tracking only this one promise, and having
// disconnectCoreV2Client() await and disconnect exactly what it resolves
// to, closes that race.
//
// A second, narrower race remained even after that fix: a validation that
// had already been detached by disconnectCoreV2Client() could still reject
// later and unconditionally null out whatever DIFFERENT, newer validation
// had since been cached in the meantime — orphaning that one instead (a
// second reviewer pass reproduced this against real Postgres). See
// requireCoreV2Client()'s `.catch` handler: it only clears cachedValidation
// when the variable still points at that exact call's own chain.
let cachedValidation: Promise<CoreV2PrismaClient> | null = null;

/**
 * Returns a process-wide singleton Core v2 client, created lazily on first
 * call, ONLY after both safety layers pass: the URL target-collision guard
 * (synchronous, no connection attempt) and the database identity marker
 * check (requires connecting). Fails closed — never falls back to Core v1,
 * never creates the marker — and is the only sanctioned way to obtain a
 * usable Core v2 client for any repository call.
 */
export function requireCoreV2Client(): Promise<CoreV2PrismaClient> {
  if (!cachedValidation) {
    // Captured in a local before being assigned to the shared module
    // variable, so the `.catch` handler below can tell whether
    // cachedValidation still refers to THIS specific chain before clearing
    // it. Without that check, a validation that was already detached by a
    // concurrent disconnectCoreV2Client() call (see that function) could
    // still reject later and null out whatever DIFFERENT, newer validation
    // has since been cached — orphaning its live, connected client (Review
    // A, final pass P1: reproduced against real Postgres).
    const thisValidation: Promise<CoreV2PrismaClient> = (async () => {
      const datasourceUrl = resolveCoreV2DatabaseUrl();
      const client = new CoreV2PrismaClient({ datasourceUrl });
      await assertCoreV2DatabaseIdentity(client);
      return client;
    })().catch((error) => {
      // A failure at ANY stage — the synchronous URL/target-collision guard
      // included, not only the identity-marker check — must not pin
      // cachedValidation to a permanently-rejected promise. Otherwise a
      // transient/fixable failure (e.g. CORE_V2_DATABASE_URL unset when
      // this was first called) would poison every later call for the rest
      // of the process, even once the environment is corrected, unless
      // disconnectCoreV2Client() happened to be called in between.
      if (cachedValidation === thisValidation) {
        cachedValidation = null;
      }
      throw error;
    });
    cachedValidation = thisValidation;
  }
  return cachedValidation;
}

/**
 * Disconnects the cached singleton, if one exists or is still being
 * validated. Captures and clears the shared reference FIRST (so a
 * concurrent requireCoreV2Client() call starts a fresh validation instead
 * of racing this one), then awaits whatever it pointed to and disconnects
 * the client it resolves to, if any — including a validation that was still
 * in flight when this was called.
 */
export async function disconnectCoreV2Client(): Promise<void> {
  const pending = cachedValidation;
  cachedValidation = null;
  if (!pending) return;
  try {
    const client = await pending;
    await client.$disconnect();
  } catch {
    // Validation failed (already disconnected itself before throwing, per
    // assertCoreV2DatabaseIdentity) or never produced a client — nothing to
    // close.
  }
}
