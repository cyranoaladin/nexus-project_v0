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
import { createScratchDatabase, runRawSql, type ScratchDatabase } from './helpers/scratch-database';

if (!process.env.CORE_V2_DATABASE_URL) {
  throw new Error(
    'CORE_V2_DATABASE_URL must be set to a disposable PostgreSQL database to run this suite.',
  );
}

const REAL_CORE_V2_URL = process.env.CORE_V2_DATABASE_URL;
const scratches: ScratchDatabase[] = [];

function applyCoreV2Baseline(url: string): void {
  execFileSync(
    'npx',
    ['prisma', 'migrate', 'deploy', '--schema=core-v2/prisma/schema.prisma'],
    { stdio: 'inherit', env: { ...process.env, CORE_V2_DATABASE_URL: url } },
  );
}

afterEach(async () => {
  await disconnectCoreV2Client();
  process.env.CORE_V2_DATABASE_URL = REAL_CORE_V2_URL;
});

afterAll(async () => {
  for (const scratch of scratches) {
    await scratch.drop();
  }
});

describe('lib/core-v2/client.ts exports only the verified async accessor', () => {
  test('requireCoreV2Client returns a Promise, not a synchronous unverified client', async () => {
    expect(typeof CoreV2Client.requireCoreV2Client).toBe('function');
    const result = CoreV2Client.requireCoreV2Client();
    expect(result).toBeInstanceOf(Promise);
    // A synchronous client (the pre-hardening shape) would be usable
    // immediately, with no identity check ever having run — asserting this
    // resolves (or rejects) as a Promise proves callers are forced through
    // the async validation path.
    await result.catch(() => undefined);
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
    const invalidScratch = await createScratchDatabase(REAL_CORE_V2_URL, 'core_v2_p1_invalid');
    scratches.push(invalidScratch);
    const validScratch = await createScratchDatabase(REAL_CORE_V2_URL, 'core_v2_p1_valid');
    scratches.push(validScratch);
    applyCoreV2Baseline(validScratch.url);
    // invalidScratch deliberately has NO baseline applied — its identity
    // check is guaranteed to fail.

    process.env.CORE_V2_DATABASE_URL = invalidScratch.url;
    const aPromise = requireCoreV2Client(); // A: will eventually reject

    const dPromise = disconnectCoreV2Client(); // captures & detaches A

    process.env.CORE_V2_DATABASE_URL = validScratch.url;
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
    const savedUrl = process.env.CORE_V2_DATABASE_URL;
    try {
      delete process.env.CORE_V2_DATABASE_URL;
      await expect(requireCoreV2Client()).rejects.toThrow(CoreV2Client.CoreV2DatabaseUrlError);

      // No disconnectCoreV2Client() call here — this is the point of the
      // test: a URL-level failure must not pin the internal cache to a
      // rejected promise the way a real bug in requireCoreV2Client's error
      // handling would (only resetting the cache on identity-check
      // failures, not on the earlier URL-guard failure).
      process.env.CORE_V2_DATABASE_URL = savedUrl;
      await expect(requireCoreV2Client()).resolves.toBeDefined();
    } finally {
      process.env.CORE_V2_DATABASE_URL = savedUrl;
    }
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
    const scratch = await createScratchDatabase(REAL_CORE_V2_URL, 'core_v2_misroute_no_schema');
    scratches.push(scratch);
    process.env.CORE_V2_DATABASE_URL = scratch.url;

    await expect(requireCoreV2Client()).rejects.toThrow(CoreV2DatabaseIdentityError);
  });

  test('recovery: applying the Core v2 baseline to that same database makes access allowed', async () => {
    const scratch = await createScratchDatabase(REAL_CORE_V2_URL, 'core_v2_misroute_recovery');
    scratches.push(scratch);
    process.env.CORE_V2_DATABASE_URL = scratch.url;

    await expect(requireCoreV2Client()).rejects.toThrow(CoreV2DatabaseIdentityError);
    await disconnectCoreV2Client();

    applyCoreV2Baseline(scratch.url);

    const client = await requireCoreV2Client();
    const marker = await client.coreV2DatabaseIdentity.findUnique({ where: { id: 1 } });
    expect(marker?.schemaIdentity).toBe('nexus-core-v2');
    expect(marker?.schemaGeneration).toBe(5);
  });

  test('missing marker: Core v2 tables exist but the identity row was deleted is refused', async () => {
    const scratch = await createScratchDatabase(REAL_CORE_V2_URL, 'core_v2_missing_marker');
    scratches.push(scratch);
    applyCoreV2Baseline(scratch.url);
    await runRawSql(scratch.url, 'DELETE FROM "core_v2_database_identity";');

    process.env.CORE_V2_DATABASE_URL = scratch.url;
    await expect(requireCoreV2Client()).rejects.toThrow(CoreV2DatabaseIdentityError);
  });

  test('corrupted marker: wrong schemaGeneration is refused', async () => {
    const scratch = await createScratchDatabase(REAL_CORE_V2_URL, 'core_v2_corrupted_marker');
    scratches.push(scratch);
    applyCoreV2Baseline(scratch.url);
    await runRawSql(
      scratch.url,
      'UPDATE "core_v2_database_identity" SET "schemaGeneration" = 999 WHERE "id" = 1;',
    );

    process.env.CORE_V2_DATABASE_URL = scratch.url;
    await expect(requireCoreV2Client()).rejects.toThrow(CoreV2DatabaseIdentityError);
  });

  test('corrupted marker: wrong schemaIdentity string is refused', async () => {
    const scratch = await createScratchDatabase(REAL_CORE_V2_URL, 'core_v2_wrong_identity');
    scratches.push(scratch);
    applyCoreV2Baseline(scratch.url);
    await runRawSql(
      scratch.url,
      `UPDATE "core_v2_database_identity" SET "schemaIdentity" = 'not-nexus-core-v2' WHERE "id" = 1;`,
    );

    process.env.CORE_V2_DATABASE_URL = scratch.url;
    await expect(requireCoreV2Client()).rejects.toThrow(CoreV2DatabaseIdentityError);
  });
});
