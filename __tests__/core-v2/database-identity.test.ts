/**
 * CORE_V2_DATABASE_IDENTITY_MARKER + CORE_V2_IDENTITY_VALIDATION
 * (foundation hardening, DATABASE_COLLISION_GUARD_WEAKNESS, second
 * independent safety layer alongside database-target.test.ts).
 *
 * Includes the mandatory CATASTROPHIC_MISROUTE_TEST: CORE_V2_DATABASE_URL
 * pointing at a real PostgreSQL database that is NOT Core v2 must be
 * refused before any mutation is attempted — proven against a real,
 * disposable database, not a mock. The URL target-collision guard cannot
 * catch this case (the scratch database has an unrelated name/host from
 * DATABASE_URL, so no string/target collision exists) — only the identity
 * marker can.
 *
 * Isolation contract of this suite (enforced in helpers/scratch-database.ts):
 *
 * - It never connects to the shared Core v2 test database. The ambient
 *   CORE_V2_DATABASE_URL is removed for the whole file and restored in
 *   afterAll; the ONLY DSN that ever reaches a Core v2 client is the one a
 *   test sets explicitly for a database this file created itself.
 * - Every database used here is created by this file, named
 *   nexus_disposable_*_test, marked with a COMMENT ON DATABASE token, checked
 *   by assertDisposablePostgresUrl, and dropped in afterAll (only that
 *   database's own connections are ended; no global pg_terminate_backend).
 * - The server is reached through CORE_V2_IDENTITY_TEST_ADMIN_URL alone: a
 *   role allowed to CREATE DATABASE on a local disposable server, aimed at
 *   the "postgres" maintenance database, together with
 *   NEXUS_DISPOSABLE_POSTGRES=1.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import * as CoreV2Client from '@/lib/core-v2/client';
import {
  CoreV2DatabaseIdentityError,
  disconnectCoreV2Client,
  requireCoreV2Client,
} from '@/lib/core-v2/client';
import { PrismaClient as CoreV2GeneratedClient } from '@/core-v2/generated/client';
import {
  createScratchDatabaseRegistry,
  runRawSql,
  type ScratchDatabase,
} from './helpers/scratch-database';

const registry = createScratchDatabaseRegistry(process.env.CORE_V2_IDENTITY_TEST_ADMIN_URL);
const AMBIENT_CORE_V2_URL = process.env.CORE_V2_DATABASE_URL;
delete process.env.CORE_V2_DATABASE_URL;

function applyCoreV2Baseline(url: string): void {
  execFileSync('npx', ['prisma', 'migrate', 'deploy', '--schema=core-v2/prisma/schema.prisma'], {
    stdio: 'pipe',
    env: { ...process.env, CORE_V2_DATABASE_URL: url },
  });
}

/** A database created by this file, optionally carrying the Core v2 baseline. */
async function scratchDatabase(
  label: string,
  options: { baseline: boolean },
): Promise<ScratchDatabase> {
  const scratch = await registry.create(label);
  if (options.baseline) applyCoreV2Baseline(scratch.url);
  return scratch;
}

/** The single, explicit way a test aims the Core v2 client at a database. */
function pointCoreV2ClientAt(scratch: ScratchDatabase): void {
  process.env.CORE_V2_DATABASE_URL = scratch.url;
}

afterEach(async () => {
  await disconnectCoreV2Client();
  delete process.env.CORE_V2_DATABASE_URL;
});

afterAll(async () => {
  try {
    await registry.dropAll();
  } finally {
    if (AMBIENT_CORE_V2_URL === undefined) delete process.env.CORE_V2_DATABASE_URL;
    else process.env.CORE_V2_DATABASE_URL = AMBIENT_CORE_V2_URL;
  }
});

describe('lib/core-v2/client.ts exports only the verified async accessor', () => {
  test('requireCoreV2Client returns a Promise, not a synchronous unverified client', async () => {
    pointCoreV2ClientAt(await scratchDatabase('core_v2_async_accessor', { baseline: true }));

    expect(typeof CoreV2Client.requireCoreV2Client).toBe('function');
    const result = CoreV2Client.requireCoreV2Client();
    expect(result).toBeInstanceOf(Promise);
    // A synchronous client (the pre-hardening shape) would be usable
    // immediately, with no identity check ever having run — asserting this
    // resolves as a Promise proves callers are forced through the async
    // validation path.
    await expect(result).resolves.toBeDefined();
  });

  test('no synchronous "getCoreV2Client"-style unverified accessor is exported', () => {
    // Exact-name comparison, not a substring/regex heuristic (Review C
    // nit): a hypothetical future export merely containing "getClient" as
    // a substring (e.g. a differently-purposed helper) must not false-
    // positive this guard.
    const KNOWN_UNVERIFIED_ACCESSOR_NAMES = new Set([
      'getCoreV2Client',
      'getClient',
      'getCoreV2PrismaClient',
    ]);
    const exportNames = Object.keys(CoreV2Client);
    const unverifiedAccessorNames = exportNames.filter((name) =>
      KNOWN_UNVERIFIED_ACCESSOR_NAMES.has(name),
    );
    expect(unverifiedAccessorNames).toEqual([]);
  });
});

describe('disconnectCoreV2Client does not leak a connection racing an in-flight requireCoreV2Client', () => {
  // Independently flagged by both Review A (P3-4) and Review B (P2):
  // disconnectCoreV2Client() used to act only on the already-settled
  // `cachedClient`, so calling it while a requireCoreV2Client() validation
  // was still in flight (before that validation had assigned cachedClient)
  // would reset the cache and return immediately, leaving the client the
  // in-flight validation eventually produces connected and unreferenced —
  // a real, open PostgreSQL connection with the cache holding no pointer to
  // it, orphaned for the rest of the process.
  test('calling disconnectCoreV2Client() immediately after requireCoreV2Client(), without awaiting it first, still disconnects the client that validation produces', async () => {
    pointCoreV2ClientAt(await scratchDatabase('core_v2_disconnect_race', { baseline: true }));

    const disconnectSpy = jest.spyOn(CoreV2GeneratedClient.prototype, '$disconnect');
    try {
      const validationPromise = requireCoreV2Client(); // deliberately not awaited
      const disconnectPromise = disconnectCoreV2Client(); // races the in-flight validation

      await expect(validationPromise).resolves.toBeDefined();
      await disconnectPromise;

      expect(disconnectSpy).toHaveBeenCalledTimes(1);
    } finally {
      disconnectSpy.mockRestore();
    }
  });

  // Review A, final pass P1: the fix above (single cachedValidation, nulled
  // by disconnectCoreV2Client() BEFORE awaiting) closes the 2-step race, but
  // requireCoreV2Client()'s own `.catch` handler unconditionally did
  // `cachedValidation = null` on rejection — with no check that
  // cachedValidation still pointed at ITS OWN chain. A rejecting validation
  // (A) that was already disconnected-and-detached by an earlier
  // disconnectCoreV2Client() call can still fire its `.catch` handler later
  // and null out a completely different, newer validation (B) that was
  // cached in the meantime — orphaning B's live, connected client with
  // nothing left referencing it.
  test('a rejecting validation detached by an earlier disconnectCoreV2Client() must not clobber a different, newer validation cached afterward', async () => {
    // invalidScratch deliberately has NO baseline applied — its identity
    // check is guaranteed to fail.
    const invalidScratch = await scratchDatabase('core_v2_p1_invalid', { baseline: false });
    const validScratch = await scratchDatabase('core_v2_p1_valid', { baseline: true });

    pointCoreV2ClientAt(invalidScratch);
    const aPromise = requireCoreV2Client(); // A: will eventually reject

    const dPromise = disconnectCoreV2Client(); // captures & detaches A

    pointCoreV2ClientAt(validScratch);
    // Handled at creation: this can settle during the awaits below, before
    // `expect(...).rejects` attaches, and an unhandled rejection in that
    // window fails the run. Same idiom already used in
    // __tests__/auth/session-recovery-controller.test.ts.
    void aPromise.catch(() => {});
    const bPromise = requireCoreV2Client(); // B: fresh, independent of A

    const clientB = await bPromise;
    await expect(aPromise).rejects.toThrow(CoreV2DatabaseIdentityError);
    await dPromise;

    // If A's rejection handler wrongly cleared the cache out from under B,
    // this next call would silently mint a THIRD, orphaned client instead
    // of reusing B.
    const clientC = await requireCoreV2Client();
    expect(clientC).toBe(clientB);
  });
});

describe('requireCoreV2Client does not permanently cache a URL-level failure', () => {
  test('a missing/invalid CORE_V2_DATABASE_URL failure does not poison later calls with a valid URL, even without an explicit disconnectCoreV2Client() in between', async () => {
    const scratch = await scratchDatabase('core_v2_url_failure', { baseline: true });

    delete process.env.CORE_V2_DATABASE_URL;
    await expect(requireCoreV2Client()).rejects.toThrow(CoreV2Client.CoreV2DatabaseUrlError);

    // No disconnectCoreV2Client() call here — this is the point of the
    // test: a URL-level failure must not pin the internal cache to a
    // rejected promise the way a real bug in requireCoreV2Client's error
    // handling would (only resetting the cache on identity-check
    // failures, not on the earlier URL-guard failure).
    pointCoreV2ClientAt(scratch);
    await expect(requireCoreV2Client()).resolves.toBeDefined();
  });
});

describe('the identity marker table is excluded from the per-test truncate list', () => {
  test('helpers/reset-db.ts never truncates core_v2_database_identity', () => {
    const resetDbSource = readFileSync(
      require.resolve('./helpers/reset-db'),
      'utf8',
    );
    expect(resetDbSource).not.toMatch(/core_v2_database_identity/);
  });
});

describe('DATABASE_TARGET_SAFETY_TESTS — CORE_V2_IDENTITY_VALIDATION', () => {
  test('CATASTROPHIC_MISROUTE_TEST: CORE_V2_DATABASE_URL pointing at a database with no Core v2 schema at all is refused before any mutation', async () => {
    pointCoreV2ClientAt(await scratchDatabase('core_v2_misroute_no_schema', { baseline: false }));

    await expect(requireCoreV2Client()).rejects.toThrow(CoreV2DatabaseIdentityError);
  });

  test('recovery: applying the Core v2 baseline to that same database makes access allowed', async () => {
    const scratch = await scratchDatabase('core_v2_misroute_recovery', { baseline: false });
    pointCoreV2ClientAt(scratch);

    await expect(requireCoreV2Client()).rejects.toThrow(CoreV2DatabaseIdentityError);
    await disconnectCoreV2Client();

    applyCoreV2Baseline(scratch.url);

    const client = await requireCoreV2Client();
    const marker = await client.coreV2DatabaseIdentity.findUnique({ where: { id: 1 } });
    expect(marker?.schemaIdentity).toBe('nexus-core-v2');
    expect(marker?.schemaGeneration).toBe(5);
  });

  test('missing marker: Core v2 tables exist but the identity row was deleted is refused', async () => {
    const scratch = await scratchDatabase('core_v2_missing_marker', { baseline: true });
    await runRawSql(scratch, 'DELETE FROM "core_v2_database_identity";');

    pointCoreV2ClientAt(scratch);
    await expect(requireCoreV2Client()).rejects.toThrow(CoreV2DatabaseIdentityError);
  });

  test('corrupted marker: wrong schemaGeneration is refused', async () => {
    const scratch = await scratchDatabase('core_v2_corrupted_marker', { baseline: true });
    await runRawSql(
      scratch,
      'UPDATE "core_v2_database_identity" SET "schemaGeneration" = 999 WHERE "id" = 1;',
    );

    pointCoreV2ClientAt(scratch);
    await expect(requireCoreV2Client()).rejects.toThrow(CoreV2DatabaseIdentityError);
  });

  test('corrupted marker: wrong schemaIdentity string is refused', async () => {
    const scratch = await scratchDatabase('core_v2_wrong_identity', { baseline: true });
    await runRawSql(
      scratch,
      `UPDATE "core_v2_database_identity" SET "schemaIdentity" = 'not-nexus-core-v2' WHERE "id" = 1;`,
    );

    pointCoreV2ClientAt(scratch);
    await expect(requireCoreV2Client()).rejects.toThrow(CoreV2DatabaseIdentityError);
  });
});
