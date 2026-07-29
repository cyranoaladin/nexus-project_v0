import { execFileSync } from 'child_process';
import { randomUUID } from 'crypto';
import path from 'path';

import { PrismaClient } from '@prisma/client';

import { consumeBilanMagicLink } from '@/lib/bilans/auth/consume-magic-link';
import { attachChildToVerifiedRequest } from '@/lib/bilans/requests/attach-child';
import { createBilanRequestIntake } from '@/lib/bilans/requests/create-request';
import { getDisposablePostgresRootUrl } from '../helpers/disposable-postgres-guard';

const prismaBinaryPath = path.resolve(process.cwd(), 'node_modules/.bin/prisma');
const schemaPath = path.resolve(process.cwd(), 'prisma/schema.prisma');
const databaseName = `nexus_bilan_magic_${randomUUID().replaceAll('-', '')}`;
const NOW = new Date('2026-07-29T12:00:00.000Z');

let adminPrisma: PrismaClient;
let prisma: PrismaClient;

function guardedRootUrl(): URL {
  const raw = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  const url = getDisposablePostgresRootUrl(raw, 'Magic auth');
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

async function createVerifiedExistingParentRequest(key: string) {
  const parent = await prisma.user.create({
    data: {
      email: admission.parent.email,
      role: 'PARENT',
      activatedAt: new Date('2026-07-29T11:00:00.000Z'),
      parentProfile: { create: {} },
    },
    select: { id: true, parentProfile: { select: { id: true } } },
  });
  const intake = await createPendingRequest(key);
  await consumeBilanMagicLink({
    prisma,
    rawToken: intake.internal.magicLinkToken!.rawToken,
    now: new Date('2026-07-29T12:05:00.000Z'),
  });
  return { parent, intake };
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

  it('creates and attaches exactly one inactive child for a verified existing parent', async () => {
    const { parent, intake } = await createVerifiedExistingParentRequest(
      'magic_real_child_create_0123',
    );

    const attached = await attachChildToVerifiedRequest({
      prisma,
      requestId: intake.internal.requestId,
      parentUserId: parent.id,
      command: {
        action: 'CREATE_NEW',
        child: {
          firstName: 'Nour',
          lastName: 'Ben Salah',
          schoolName: 'Lycée test',
        },
      },
      now: new Date('2026-07-29T12:06:00.000Z'),
    });

    const [request, student, link, events] = await Promise.all([
      prisma.bilanRequest.findUniqueOrThrow({
        where: { id: intake.internal.requestId },
      }),
      prisma.student.findUniqueOrThrow({
        where: { id: attached.studentId },
        include: { user: true },
      }),
      prisma.parentStudentLink.findFirstOrThrow({
        where: { parentUserId: parent.id, studentId: attached.studentId },
      }),
      prisma.bilanRequestEvent.findMany({
        where: { requestId: intake.internal.requestId, type: 'CHILD_CREATED' },
      }),
    ]);
    expect(request).toMatchObject({
      studentId: attached.studentId,
      status: 'READY_FOR_ASSESSMENT',
      provisionalChildFirstName: null,
      provisionalChildLastName: null,
      provisionalChildSchoolName: null,
    });
    expect(student.user).toMatchObject({
      role: 'ELEVE',
      activatedAt: null,
      password: null,
    });
    expect(student.user.email).toMatch(
      /^child\+[a-f0-9]{24}@nexus-student\.local$/,
    );
    expect(link).toMatchObject({
      state: 'VERIFIED',
      revokedAt: null,
    });
    expect(events).toHaveLength(1);
    expect(events[0].payload).toEqual({ studentId: attached.studentId });
  });

  it('selects an existing child only through the authenticated parent verified link', async () => {
    const { parent, intake } = await createVerifiedExistingParentRequest(
      'magic_real_child_select_0123',
    );
    const studentUser = await prisma.user.create({
      data: {
        email: 'existing.child@nexus-student.local',
        role: 'ELEVE',
      },
      select: { id: true },
    });
    const student = await prisma.student.create({
      data: {
        parentId: parent.parentProfile!.id,
        userId: studentUser.id,
        gradeLevel: 'TERMINALE',
      },
      select: { id: true },
    });
    await prisma.parentStudentLink.create({
      data: {
        parentUserId: parent.id,
        studentId: student.id,
        state: 'VERIFIED',
        verifiedAt: new Date('2026-07-29T11:30:00.000Z'),
      },
    });

    await expect(attachChildToVerifiedRequest({
      prisma,
      requestId: intake.internal.requestId,
      parentUserId: parent.id,
      command: { action: 'SELECT_EXISTING', studentId: student.id },
      now: new Date('2026-07-29T12:06:00.000Z'),
    })).resolves.toEqual({ attached: true, studentId: student.id });

    const foreignParent = await prisma.user.create({
      data: {
        email: 'foreign.parent@example.com',
        role: 'PARENT',
        activatedAt: NOW,
        parentProfile: { create: {} },
      },
      select: { id: true },
    });
    await expect(attachChildToVerifiedRequest({
      prisma,
      requestId: intake.internal.requestId,
      parentUserId: foreignParent.id,
      command: { action: 'SELECT_EXISTING', studentId: student.id },
      now: new Date('2026-07-29T12:07:00.000Z'),
    })).rejects.toMatchObject({ code: 'BILAN_CHILD_ACCESS_DENIED' });
  });

  it('rolls back losing concurrent child creation without orphan records', async () => {
    const { parent, intake } = await createVerifiedExistingParentRequest(
      'magic_real_child_race_012345',
    );
    const command = {
      action: 'CREATE_NEW' as const,
      child: { firstName: 'Nour' },
    };

    const results = await Promise.allSettled([
      attachChildToVerifiedRequest({
        prisma,
        requestId: intake.internal.requestId,
        parentUserId: parent.id,
        command,
      }),
      attachChildToVerifiedRequest({
        prisma,
        requestId: intake.internal.requestId,
        parentUserId: parent.id,
        command,
      }),
    ]);
    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);

    const [request, students, events] = await Promise.all([
      prisma.bilanRequest.findUniqueOrThrow({
        where: { id: intake.internal.requestId },
      }),
      prisma.student.count({ where: { parentId: parent.parentProfile!.id } }),
      prisma.bilanRequestEvent.count({
        where: { requestId: intake.internal.requestId, type: 'CHILD_CREATED' },
      }),
    ]);
    expect(request.status).toBe('READY_FOR_ASSESSMENT');
    expect(students).toBe(1);
    expect(events).toBe(1);
  });

  it('uses a verified password session to verify and attach its exact pending request atomically', async () => {
    const parent = await prisma.user.create({
      data: {
        email: admission.parent.email,
        role: 'PARENT',
        activatedAt: new Date('2026-07-29T11:00:00.000Z'),
        parentProfile: { create: {} },
      },
      select: { id: true, parentProfile: { select: { id: true } } },
    });
    const studentUser = await prisma.user.create({
      data: { email: 'password.child@nexus-student.local', role: 'ELEVE' },
      select: { id: true },
    });
    const student = await prisma.student.create({
      data: {
        parentId: parent.parentProfile!.id,
        userId: studentUser.id,
        gradeLevel: 'TERMINALE',
      },
      select: { id: true },
    });
    await prisma.parentStudentLink.create({
      data: {
        parentUserId: parent.id,
        studentId: student.id,
        state: 'VERIFIED',
        verifiedAt: new Date('2026-07-29T11:30:00.000Z'),
      },
    });
    const intake = await createPendingRequest('password_session_child_0123');

    await attachChildToVerifiedRequest({
      prisma,
      requestId: intake.internal.requestId,
      parentUserId: parent.id,
      command: { action: 'SELECT_EXISTING', studentId: student.id },
      existingSessionFlowTokenHash: intake.internal.flowSessionToken!.tokenHash,
      now: new Date('2026-07-29T12:06:00.000Z'),
    });

    const [request, events] = await Promise.all([
      prisma.bilanRequest.findUniqueOrThrow({
        where: { id: intake.internal.requestId },
      }),
      prisma.bilanRequestEvent.findMany({
        where: {
          requestId: intake.internal.requestId,
          type: { in: ['ACCOUNT_VERIFIED', 'CHILD_SELECTED'] },
        },
        orderBy: { occurredAt: 'asc' },
      }),
    ]);
    expect(request).toMatchObject({
      parentUserId: parent.id,
      studentId: student.id,
      accountVerificationState: 'VERIFIED',
      status: 'READY_FOR_ASSESSMENT',
    });
    expect(events.map(({ type, payload }) => ({ type, payload }))).toEqual([
      {
        type: 'ACCOUNT_VERIFIED',
        payload: { methodCode: 'EXISTING_SESSION' },
      },
      {
        type: 'CHILD_SELECTED',
        payload: { studentId: student.id },
      },
    ]);
  });

  it('refuses a revoked flow token inside the existing-parent attachment transaction', async () => {
    const parent = await prisma.user.create({
      data: {
        email: admission.parent.email,
        role: 'PARENT',
        activatedAt: NOW,
        parentProfile: { create: {} },
      },
      select: { id: true },
    });
    const intake = await createPendingRequest('revoked_password_flow_01234');
    await prisma.bilanFlowSession.updateMany({
      where: { requestId: intake.internal.requestId },
      data: { revokedAt: new Date('2026-07-29T12:05:00.000Z') },
    });

    await expect(attachChildToVerifiedRequest({
      prisma,
      requestId: intake.internal.requestId,
      parentUserId: parent.id,
      command: {
        action: 'CREATE_NEW',
        child: { firstName: 'Nour' },
      },
      existingSessionFlowTokenHash: intake.internal.flowSessionToken!.tokenHash,
      now: new Date('2026-07-29T12:06:00.000Z'),
    })).rejects.toMatchObject({ code: 'BILAN_CHILD_ACCESS_DENIED' });

    const request = await prisma.bilanRequest.findUniqueOrThrow({
      where: { id: intake.internal.requestId },
    });
    expect(request).toMatchObject({
      accountVerificationState: 'VERIFICATION_PENDING',
      studentId: null,
      status: 'NEW',
    });
  });
});
