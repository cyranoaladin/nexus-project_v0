import { execFileSync } from 'child_process';
import { randomUUID } from 'crypto';
import path from 'path';

import { PrismaClient } from '@prisma/client';

import { consumeBilanMagicLink } from '@/lib/bilans/auth/consume-magic-link';
import { createBilanRequestIntake } from '@/lib/bilans/requests/create-request';

const prismaBinaryPath = path.resolve(process.cwd(), 'node_modules/.bin/prisma');
const schemaPath = path.resolve(process.cwd(), 'prisma/schema.prisma');
const databaseName = `nexus_bilan_magic_${randomUUID().replaceAll('-', '')}`;
const NOW = new Date('2026-07-29T12:00:00.000Z');

let adminPrisma: PrismaClient;
let prisma: PrismaClient;

function guardedRootUrl(): URL {
  const raw = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  if (!raw) throw new Error('An explicit disposable TEST_DATABASE_URL is required');
  const url = new URL(raw);
  if (url.hostname !== '127.0.0.1' || url.port !== '5434' || url.pathname !== '/nexus_test') {
    throw new Error('Magic auth harness is restricted to 127.0.0.1:5434/nexus_test');
  }
  if (!/^nexus_bilan_magic_[a-f0-9]{32}$/.test(databaseName)) {
    throw new Error(`Unsafe disposable database name: ${databaseName}`);
  }
  return url;
}

function disposableUrl(): string {
  const url = guardedRootUrl();
  url.pathname = `/${databaseName}`;
  url.searchParams.set('schema', 'public');
  return url.toString();
}

function quoteDatabase(value: string): string {
  if (!/^nexus_bilan_magic_[a-f0-9]{32}$/.test(value)) {
    throw new Error(`Unsafe disposable database name: ${value}`);
  }
  return `"${value}"`;
}

async function cleanDatabase() {
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> '_prisma_migrations'
  `;
  if (tables.length === 0) return;
  const names = tables.map(({ tablename }) => `"${tablename.replaceAll('"', '""')}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE`);
}

const admission = {
  parent: {
    firstName: 'Amina',
    lastName: 'Ben Salah',
    email: 'parent.magic@example.com',
    phone: '+21699192829',
  },
  child: {
    firstName: 'Lina',
    lastName: 'Ben Salah',
    schoolName: 'Lycée test',
  },
  schoolYear: '2026-2027',
  level: 'TERMINALE',
  subject: 'MATHEMATIQUES',
  mainNeed: 'Consolider les automatismes.',
  consent: true,
  consentVersion: 'bilan-public-v1',
} as const;

async function createPendingRequest(key: string) {
  return createBilanRequestIntake({
    prisma,
    admission,
    idempotencyKey: key,
    now: NOW,
    production: false,
  });
}

describe('bilan magic auth — real PostgreSQL', () => {
  beforeAll(async () => {
    const rootUrl = guardedRootUrl().toString();
    adminPrisma = new PrismaClient({ datasources: { db: { url: rootUrl } } });
    await adminPrisma.$executeRawUnsafe(
      `CREATE DATABASE ${quoteDatabase(databaseName)} TEMPLATE template0`,
    );
    execFileSync(prismaBinaryPath, ['migrate', 'deploy', '--schema', schemaPath], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: disposableUrl() },
      encoding: 'utf8',
      stdio: 'pipe',
      timeout: 120_000,
    });
    prisma = new PrismaClient({ datasources: { db: { url: disposableUrl() } } });
    await prisma.$connect();
  }, 150_000);

  beforeEach(cleanDatabase);

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
    if (adminPrisma) {
      await adminPrisma.$executeRawUnsafe(
        `DROP DATABASE IF EXISTS ${quoteDatabase(databaseName)} WITH (FORCE)`,
      );
      const residue = await adminPrisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS count
        FROM pg_database
        WHERE datname LIKE 'nexus_bilan_magic_%'
      `;
      expect(Number(residue[0]?.count ?? 0)).toBe(0);
      await adminPrisma.$disconnect();
    }
  }, 30_000);

  it('atomically activates the parent, verifies ownership and appends a minimized event', async () => {
    const intake = await createPendingRequest('magic_real_success_012345');
    const rawToken = intake.internal.magicLinkToken!.rawToken;

    await expect(consumeBilanMagicLink({
      prisma,
      rawToken,
      now: new Date('2026-07-29T12:05:00.000Z'),
    })).resolves.toMatchObject({ role: 'PARENT' });

    const request = await prisma.bilanRequest.findUniqueOrThrow({
      where: { id: intake.internal.requestId },
    });
    const [magic, parent, familyLink, events] = await Promise.all([
      prisma.bilanMagicLink.findFirstOrThrow({ where: { requestId: request.id } }),
      prisma.user.findUniqueOrThrow({ where: { id: request.parentUserId! } }),
      prisma.parentStudentLink.findFirstOrThrow({
        where: { parentUserId: request.parentUserId!, studentId: request.studentId! },
      }),
      prisma.bilanRequestEvent.findMany({ where: { requestId: request.id }, orderBy: { occurredAt: 'asc' } }),
    ]);
    expect(magic.consumedAt).toEqual(new Date('2026-07-29T12:05:00.000Z'));
    expect(parent.activatedAt).toEqual(new Date('2026-07-29T12:05:00.000Z'));
    expect(request.accountVerificationState).toBe('VERIFIED');
    expect(familyLink).toMatchObject({
      state: 'VERIFIED',
      consentedAt: new Date('2026-07-29T12:05:00.000Z'),
      verifiedAt: new Date('2026-07-29T12:05:00.000Z'),
    });
    expect(events.at(-1)).toMatchObject({
      type: 'ACCOUNT_VERIFIED',
      actor: 'PARENT_FLOW',
      payload: { methodCode: 'MAGIC_LINK' },
    });
  });

  it('allows exactly one success under concurrent replay', async () => {
    const intake = await createPendingRequest('magic_real_concurrent_0123');
    const rawToken = intake.internal.magicLinkToken!.rawToken;

    const results = await Promise.all(
      Array.from({ length: 8 }, () => consumeBilanMagicLink({
        prisma,
        rawToken,
        now: new Date('2026-07-29T12:05:00.000Z'),
      }).catch(() => null)),
    );

    expect(results.filter(Boolean)).toHaveLength(1);
    await expect(prisma.bilanRequestEvent.count({
      where: { requestId: intake.internal.requestId, type: 'ACCOUNT_VERIFIED' },
    })).resolves.toBe(1);
  });

  it('refuses a cancelled request without consuming or mutating its family', async () => {
    const intake = await createPendingRequest('magic_real_cancelled_01234');
    const rawToken = intake.internal.magicLinkToken!.rawToken;
    const before = await prisma.bilanRequest.findUniqueOrThrow({
      where: { id: intake.internal.requestId },
    });
    await prisma.bilanRequest.update({
      where: { id: before.id },
      data: { status: 'CANCELLED' },
    });

    await expect(consumeBilanMagicLink({
      prisma,
      rawToken,
      now: new Date('2026-07-29T12:05:00.000Z'),
    })).resolves.toBeNull();

    const [request, magic, parent, familyLink, verifiedEvents] = await Promise.all([
      prisma.bilanRequest.findUniqueOrThrow({ where: { id: before.id } }),
      prisma.bilanMagicLink.findFirstOrThrow({ where: { requestId: before.id } }),
      prisma.user.findUniqueOrThrow({ where: { id: before.parentUserId! } }),
      prisma.parentStudentLink.findFirstOrThrow({
        where: { parentUserId: before.parentUserId!, studentId: before.studentId! },
      }),
      prisma.bilanRequestEvent.count({
        where: { requestId: before.id, type: 'ACCOUNT_VERIFIED' },
      }),
    ]);
    expect(request).toMatchObject({
      status: 'CANCELLED',
      accountVerificationState: 'VERIFICATION_PENDING',
    });
    expect(magic.consumedAt).toBeNull();
    expect(parent.activatedAt).toBeNull();
    expect(familyLink.state).toBe('PENDING_PARENT_CONSENT');
    expect(verifiedEvents).toBe(0);
  });

  it('rolls back token consumption and every verification mutation when event append fails', async () => {
    const intake = await createPendingRequest('magic_real_rollback_012345');
    const rawToken = intake.internal.magicLinkToken!.rawToken;
    const failingPrisma = {
      $transaction: (
        callback: (transaction: unknown) => Promise<unknown>,
        options: unknown,
      ) => prisma.$transaction(async (transaction) => {
        const wrapped = new Proxy(transaction, {
          get(target, property, receiver) {
            if (property === 'bilanRequestEvent') {
              return {
                create: async () => {
                  throw new Error('forced verification event failure');
                },
              };
            }
            return Reflect.get(target, property, receiver);
          },
        });
        return callback(wrapped);
      }, options as never),
    };

    await expect(consumeBilanMagicLink({
      prisma: failingPrisma as never,
      rawToken,
      now: new Date('2026-07-29T12:05:00.000Z'),
    })).rejects.toThrow('forced verification event failure');

    const request = await prisma.bilanRequest.findUniqueOrThrow({
      where: { id: intake.internal.requestId },
    });
    const [magic, parent, familyLink] = await Promise.all([
      prisma.bilanMagicLink.findFirstOrThrow({ where: { requestId: request.id } }),
      prisma.user.findUniqueOrThrow({ where: { id: request.parentUserId! } }),
      prisma.parentStudentLink.findFirstOrThrow({
        where: { parentUserId: request.parentUserId!, studentId: request.studentId! },
      }),
    ]);
    expect(magic.consumedAt).toBeNull();
    expect(parent.activatedAt).toBeNull();
    expect(request.accountVerificationState).toBe('VERIFICATION_PENDING');
    expect(familyLink.state).toBe('PENDING_PARENT_CONSENT');

    await expect(consumeBilanMagicLink({
      prisma,
      rawToken,
      now: new Date('2026-07-29T12:06:00.000Z'),
    })).resolves.toMatchObject({ role: 'PARENT' });
  });
});
