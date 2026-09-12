/**
 * Shared harness for the Core v2 service suites: one validated client, a
 * full reset before each test, synthetic actors, and small fixture builders.
 * Organization configuration is a TEST_FIXTURE here (set only if the
 * environment did not already provide it).
 */
import { execFileSync } from 'node:child_process';
import type { PrismaClient, User } from '@/core-v2/generated/client';
import { disconnectCoreV2Client, requireCoreV2Client } from '@/lib/core-v2/client';
import { INVITATION_TTL_ENV, ORGANIZATION_TIMEZONE_ENV } from '@/lib/core-v2/config';
import type { Actor } from '@/lib/core-v2/rbac';
import { createServiceContext, type ServiceContext } from '@/lib/core-v2/services/context';
import { academicYearDates, TEST_ORGANIZATION_TIMEZONE } from './fixtures';
import { resetCoreV2Database } from './reset-db';

process.env[ORGANIZATION_TIMEZONE_ENV] ??= TEST_ORGANIZATION_TIMEZONE;
process.env[INVITATION_TTL_ENV] ??= '72';

export interface Harness {
  client: PrismaClient;
  admin: Actor;
  assistante: Actor;
  parentActor: Actor;
  ctx: (actor?: Actor) => ServiceContext;
}

export function setupServiceHarness(): Harness {
  const harness = {} as Harness;

  beforeAll(async () => {
    execFileSync('npx', ['prisma', 'migrate', 'deploy', '--schema=core-v2/prisma/schema.prisma'], {
      stdio: 'inherit',
      env: process.env,
    });
    harness.client = await requireCoreV2Client();
  });

  beforeEach(async () => {
    await resetCoreV2Database(harness.client);
    const adminUser = await harness.client.user.create({
      data: { role: 'ADMIN', email: 'admin@synthetic.test', accountStatus: 'ACTIVE' },
    });
    const assistanteUser = await harness.client.user.create({
      data: { role: 'ASSISTANTE', email: 'assistante@synthetic.test', accountStatus: 'ACTIVE' },
    });
    const parentUser = await harness.client.user.create({
      data: { role: 'PARENT', email: 'outsider-parent@synthetic.test', accountStatus: 'ACTIVE' },
    });
    harness.admin = { userId: adminUser.id, role: 'ADMIN' };
    harness.assistante = { userId: assistanteUser.id, role: 'ASSISTANTE' };
    harness.parentActor = { userId: parentUser.id, role: 'PARENT' };
    harness.ctx = (actor = harness.admin) => createServiceContext(actor);
  });

  afterAll(async () => {
    await disconnectCoreV2Client();
  });

  return harness;
}

export async function seedAcademicYear(client: PrismaClient, startYear: number, status: 'UPCOMING' | 'CURRENT' | 'CLOSED' = 'CURRENT') {
  return client.academicYear.create({ data: { startYear, ...academicYearDates(startYear), status } });
}

export async function seedCoach(client: PrismaClient, email: string): Promise<{ user: User; coachId: string }> {
  const user = await client.user.create({ data: { role: 'COACH', email, accountStatus: 'ACTIVE' } });
  const coach = await client.coachProfile.create({ data: { userId: user.id } });
  return { user, coachId: coach.id };
}

export async function auditTrail(client: PrismaClient, subjectId: string) {
  const rows = await client.auditEvent.findMany({ where: { subjectId }, orderBy: { createdAt: 'asc' } });
  return rows.map((r) => r.action);
}

/**
 * Deterministic race barrier: runs `work` inside a transaction and keeps it
 * OPEN (uncommitted) until `release()` is called. A competing statement that
 * needs a key this transaction holds will block on the DB, which
 * waitForLockWaiter() observes — so the contended path is exercised every
 * run, never left to scheduler luck.
 */
export async function holdOpenTransaction(
  client: PrismaClient,
  work: (tx: Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]) => Promise<void>,
): Promise<{ release: () => Promise<void> }> {
  let releaseNow!: () => void;
  const released = new Promise<void>((resolve) => {
    releaseNow = resolve;
  });
  let started!: () => void;
  const workDone = new Promise<void>((resolve) => {
    started = resolve;
  });
  const transaction = client.$transaction(
    async (tx) => {
      await work(tx);
      started();
      await released;
    },
    { maxWait: 5_000, timeout: 20_000 },
  );
  await workDone;
  return {
    async release() {
      releaseNow();
      await transaction;
    },
  };
}

/** Resolves once a backend on this database is blocked on a lock (bounded wait, fails loudly). */
export async function waitForLockWaiter(client: PrismaClient, timeoutMs = 5_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const rows = await client.$queryRawUnsafe<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock'`,
    );
    if ((rows[0]?.n ?? 0) >= 1) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('No backend became lock-blocked within the timeout — the race did not materialize.');
}

/** Runs the same operation twice concurrently and reports how many succeeded. */
export async function race<T>(
  a: () => Promise<T>,
  b: () => Promise<T>,
): Promise<{ fulfilled: Awaited<T>[]; rejected: unknown[] }> {
  const results: PromiseSettledResult<Awaited<T>>[] = await Promise.allSettled([a(), b()]);
  const fulfilled: Awaited<T>[] = [];
  const rejected: unknown[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') fulfilled.push(result.value);
    else rejected.push(result.reason);
  }
  return { fulfilled, rejected };
}
