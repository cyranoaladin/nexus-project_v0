import { execFileSync } from 'child_process';
import { createHash, randomUUID } from 'crypto';
import path from 'path';

import { PrismaClient } from '@prisma/client';

import {
  GENERIC_SUCCESS_MESSAGE,
  createBilanRequestIntake,
} from '@/lib/bilans/requests/create-request';
import { getDisposablePostgresRootUrl } from '../helpers/disposable-postgres-guard';

const prismaBinaryPath = path.resolve(process.cwd(), 'node_modules/.bin/prisma');
const schemaPath = path.resolve(process.cwd(), 'prisma/schema.prisma');
const databaseName = `nexus_bilan_intake_${randomUUID().replaceAll('-', '')}`;

let adminPrisma: PrismaClient;
let prisma: PrismaClient;

function guardedRootUrl(): URL {
  const raw = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  const url = getDisposablePostgresRootUrl(raw, 'Intake');
  if (!/^nexus_bilan_intake_[a-f0-9]{32}$/.test(databaseName)) {
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
  if (!/^nexus_bilan_intake_[a-f0-9]{32}$/.test(value)) {
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
    email: 'Parent.Intake@Example.COM',
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
  message: 'Préparer un plan de travail.',
  consent: true,
  consentVersion: 'bilan-public-v1',
} as const;

describe('canonical bilan request intake — real PostgreSQL', () => {
  beforeAll(async () => {
    const rootUrl = guardedRootUrl().toString();
    adminPrisma = new PrismaClient({ datasources: { db: { url: rootUrl } } });
    await adminPrisma.$executeRawUnsafe(
      `CREATE DATABASE ${quoteDatabase(databaseName)} TEMPLATE template0`,
    );
    execFileSync(
      prismaBinaryPath,
      ['migrate', 'deploy', '--schema', schemaPath],
      {
        cwd: process.cwd(),
        env: { ...process.env, DATABASE_URL: disposableUrl() },
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 120_000,
      },
    );
    prisma = new PrismaClient({ datasources: { db: { url: disposableUrl() } } });
    await prisma.$connect();
  }, 150_000);

  beforeEach(async () => {
    await cleanDatabase();
  }, 30_000);

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
    if (adminPrisma) {
      await adminPrisma.$executeRawUnsafe(
        `DROP DATABASE IF EXISTS ${quoteDatabase(databaseName)} WITH (FORCE)`,
      );
      await adminPrisma.$disconnect();
    }
  }, 30_000);

  it('atomically creates the inactive family, request, audit, secure tokens and team outbox', async () => {
    const result = await createBilanRequestIntake({
      prisma,
      admission,
      idempotencyKey: 'intake_real_new_0123456789',
      now: new Date('2026-07-29T10:00:00.000Z'),
      production: false,
    });

    expect(result.public).toEqual({
      success: true,
      message: GENERIC_SUCCESS_MESSAGE,
      next: 'ASSESSMENT_OR_EMAIL',
    });

    const [users, profiles, students, links, requests, events, sessions, magicLinks, outbox] =
      await Promise.all([
        prisma.user.findMany({ orderBy: { role: 'asc' } }),
        prisma.parentProfile.findMany(),
        prisma.student.findMany(),
        prisma.parentStudentLink.findMany(),
        prisma.bilanRequest.findMany(),
        prisma.bilanRequestEvent.findMany(),
        prisma.bilanFlowSession.findMany(),
        prisma.bilanMagicLink.findMany(),
        prisma.notificationOutbox.findMany(),
      ]);

    expect(users).toHaveLength(2);
    expect(users.every((user) => user.activatedAt === null && user.password === null)).toBe(true);
    const childUser = users.find((user) => user.role === 'ELEVE');
    expect(childUser?.email).toMatch(/^child\+[a-z0-9]{24}@nexus-student\.local$/);
    expect(childUser?.email).not.toMatch(/lina|salah/i);
    expect(profiles).toHaveLength(1);
    expect(students).toHaveLength(1);
    expect(links).toEqual([
      expect.objectContaining({ state: 'PENDING_PARENT_CONSENT' }),
    ]);
    expect(requests).toEqual([
      expect.objectContaining({
        parentUserId: profiles[0].userId,
        studentId: students[0].id,
        mainNeed: admission.mainNeed,
        message: admission.message,
      }),
    ]);
    expect(events).toEqual([
      expect.objectContaining({
        requestId: requests[0].id,
        type: 'REQUEST_CREATED',
        actor: 'SYSTEM',
        payload: {
          acquisitionChannelCode: 'WEBSITE',
          gradeCode: 'TERMINALE',
          subjectCode: 'MATHEMATIQUES',
        },
      }),
    ]);
    expect(sessions).toHaveLength(1);
    expect(magicLinks).toHaveLength(1);
    expect(outbox).toEqual([
      expect.objectContaining({
        eventType: 'BILAN_REQUEST_CREATED',
        channel: 'EMAIL',
        recipientAddress: 'pedagogie@nexusreussite.academy',
        payload: {
          requestId: requests[0].id,
          templateKey: 'bilan-team-request-created-v1',
          gradeCode: 'TERMINALE',
          subjectCode: 'MATHEMATIQUES',
        },
      }),
    ]);

    const persisted = JSON.stringify({
      users, profiles, students, links, requests, events, sessions, magicLinks, outbox,
    });
    expect(persisted).not.toContain(result.internal.flowSessionToken?.rawToken);
    expect(persisted).not.toContain(result.internal.magicLinkToken?.rawToken);
    expect(sessions[0].tokenHash).toBe(
      createHash('sha256').update(result.internal.flowSessionToken!.rawToken).digest('hex'),
    );
    expect(magicLinks[0].tokenHash).toBe(
      createHash('sha256').update(result.internal.magicLinkToken!.rawToken).digest('hex'),
    );
    expect(JSON.stringify({ events, outbox })).not.toMatch(
      /Consolider|Préparer|Parent\.Intake|Amina|Lina|Ben Salah|\+21699192829/i,
    );
  });

  it('resolves an existing parent case-insensitively and retains only provisional child data', async () => {
    const parent = await prisma.user.create({
      data: {
        email: 'Parent.Intake@Example.COM',
        role: 'PARENT',
        activatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    });
    await prisma.parentProfile.create({ data: { userId: parent.id } });
    const countsBefore = {
      users: await prisma.user.count(),
      students: await prisma.student.count(),
    };

    const result = await createBilanRequestIntake({
      prisma,
      admission: {
        ...admission,
        parent: { ...admission.parent, email: ' parent.intake@example.com ' },
      },
      idempotencyKey: 'intake_real_existing_12345',
      production: false,
    });

    expect(await prisma.user.count()).toBe(countsBefore.users);
    expect(await prisma.student.count()).toBe(countsBefore.students);
    expect(await prisma.parentStudentLink.count()).toBe(0);
    await expect(prisma.bilanRequest.findUniqueOrThrow({
      where: { id: result.internal.requestId },
    })).resolves.toMatchObject({
      parentUserId: parent.id,
      studentId: null,
      provisionalChildFirstName: 'Lina',
      provisionalChildLastName: 'Ben Salah',
      provisionalChildSchoolName: 'Lycée test',
    });
    expect(result.public).toEqual({
      success: true,
      message: GENERIC_SUCCESS_MESSAGE,
      next: 'ASSESSMENT_OR_EMAIL',
    });
    expect(result.internal.flowSessionToken?.cookie.options).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      path: '/api/bilan-gratuit',
      maxAge: 1_800,
    });
  });

  it('returns the same request and creates no duplicate side effect for the same key', async () => {
    const input = {
      prisma,
      admission,
      idempotencyKey: 'intake_real_replay_0123456',
      production: false,
    } as const;

    const first = await createBilanRequestIntake(input);
    const replay = await createBilanRequestIntake(input);

    expect(replay.public).toEqual(first.public);
    expect(replay.internal).toEqual({
      requestId: first.internal.requestId,
      replayed: true,
      flowSessionToken: null,
      magicLinkToken: null,
    });
    await expect(Promise.all([
      prisma.bilanRequest.count(),
      prisma.bilanRequestEvent.count(),
      prisma.bilanFlowSession.count(),
      prisma.bilanMagicLink.count(),
      prisma.notificationOutbox.count(),
    ])).resolves.toEqual([1, 1, 1, 1, 1]);
  });

  it('converges concurrent submissions with the same key on one durable request', async () => {
    const input = {
      prisma,
      admission,
      idempotencyKey: 'intake_real_concurrent_0123',
      production: false,
    } as const;

    const results = await Promise.all(
      Array.from({ length: 8 }, () => createBilanRequestIntake(input)),
    );

    expect(new Set(results.map(({ internal }) => internal.requestId)).size).toBe(1);
    expect(results.filter(({ internal }) => !internal.replayed)).toHaveLength(1);
    await expect(Promise.all([
      prisma.user.count(),
      prisma.student.count(),
      prisma.bilanRequest.count(),
      prisma.bilanRequestEvent.count(),
      prisma.bilanFlowSession.count(),
      prisma.bilanMagicLink.count(),
      prisma.notificationOutbox.count(),
    ])).resolves.toEqual([2, 1, 1, 1, 1, 1, 1]);
  });

  it('does not choose between duplicate case-insensitive parent accounts', async () => {
    const first = await prisma.user.create({
      data: { email: 'Case.Parent@example.com', role: 'PARENT' },
    });
    const second = await prisma.user.create({
      data: { email: 'case.parent@example.com', role: 'PARENT' },
    });
    await prisma.parentProfile.createMany({
      data: [{ userId: first.id }, { userId: second.id }],
    });

    const result = await createBilanRequestIntake({
      prisma,
      admission: {
        ...admission,
        parent: { ...admission.parent, email: 'CASE.PARENT@example.com' },
      },
      idempotencyKey: 'intake_real_ambiguous_0123',
    });

    await expect(prisma.bilanRequest.findUniqueOrThrow({
      where: { id: result.internal.requestId },
    })).resolves.toMatchObject({
      parentUserId: null,
      studentId: null,
      status: 'HUMAN_FOLLOWUP_REQUIRED',
      accountVerificationState: 'UNVERIFIED',
    });
    await expect(prisma.bilanRequestEvent.findMany({
      where: { requestId: result.internal.requestId },
      orderBy: { occurredAt: 'asc' },
    })).resolves.toEqual([
      expect.objectContaining({ type: 'REQUEST_CREATED' }),
      expect.objectContaining({
        type: 'HUMAN_FOLLOWUP_REQUIRED',
        payload: { reasonCode: 'OPERATIONAL_FOLLOWUP' },
      }),
    ]);
    expect(result.internal.flowSessionToken).not.toBeNull();
    expect(result.internal.magicLinkToken).toBeNull();
    expect(await prisma.bilanMagicLink.count()).toBe(0);
    expect(await prisma.user.count()).toBe(2);
    expect(await prisma.student.count()).toBe(0);
  });

  it('keeps a unique non-parent account unlinked and requests human follow-up', async () => {
    await prisma.user.create({
      data: { email: 'parent.intake@example.com', role: 'COACH' },
    });

    const result = await createBilanRequestIntake({
      prisma,
      admission,
      idempotencyKey: 'intake_real_non_parent_0123',
    });

    await expect(prisma.bilanRequest.findUniqueOrThrow({
      where: { id: result.internal.requestId },
    })).resolves.toMatchObject({
      parentUserId: null,
      studentId: null,
      status: 'HUMAN_FOLLOWUP_REQUIRED',
      accountVerificationState: 'UNVERIFIED',
    });
    expect(result.internal.flowSessionToken).not.toBeNull();
    expect(result.internal.magicLinkToken).toBeNull();
    expect(await prisma.bilanMagicLink.count()).toBe(0);
    expect(await prisma.bilanRequestEvent.count({
      where: {
        requestId: result.internal.requestId,
        type: 'HUMAN_FOLLOWUP_REQUIRED',
      },
    })).toBe(1);
  });

  it('converges concurrent differently-cased submissions on one parent and two coherent requests', async () => {
    const [first, second] = await Promise.all([
      createBilanRequestIntake({
        prisma,
        admission: {
          ...admission,
          parent: { ...admission.parent, email: 'Race.Parent@Example.com' },
        },
        idempotencyKey: 'intake_real_email_race_first',
      }),
      createBilanRequestIntake({
        prisma,
        admission: {
          ...admission,
          parent: { ...admission.parent, email: 'race.parent@example.COM' },
        },
        idempotencyKey: 'intake_real_email_race_second',
      }),
    ]);

    const requests = await prisma.bilanRequest.findMany({
      orderBy: { createdAt: 'asc' },
    });
    const parentUsers = await prisma.user.findMany({ where: { role: 'PARENT' } });
    expect(new Set([first.internal.requestId, second.internal.requestId]).size).toBe(2);
    expect(parentUsers).toHaveLength(1);
    expect(requests).toHaveLength(2);
    expect(requests.every(({ parentUserId }) => parentUserId === parentUsers[0].id)).toBe(true);
    expect(requests.filter(({ studentId }) => studentId !== null)).toHaveLength(1);
    expect(await prisma.student.count()).toBe(1);
    expect(await prisma.parentStudentLink.count()).toBe(1);
    expect(await prisma.bilanRequestEvent.count()).toBe(2);
    expect(await prisma.notificationOutbox.count()).toBe(2);
  });

  it('rolls every write back when the notification outbox insert fails', async () => {
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION reject_intake_outbox() RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'forced outbox failure';
      END;
      $$ LANGUAGE plpgsql
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER reject_intake_outbox_trigger
      BEFORE INSERT ON "canonical_notification_outbox"
      FOR EACH ROW EXECUTE FUNCTION reject_intake_outbox()
    `);

    await expect(createBilanRequestIntake({
      prisma,
      admission,
      idempotencyKey: 'intake_real_rollback_012345',
    })).rejects.toThrow(/forced outbox failure/i);

    await expect(Promise.all([
      prisma.user.count(),
      prisma.parentProfile.count(),
      prisma.student.count(),
      prisma.parentStudentLink.count(),
      prisma.bilanRequest.count(),
      prisma.bilanRequestEvent.count(),
      prisma.bilanFlowSession.count(),
      prisma.bilanMagicLink.count(),
      prisma.notificationOutbox.count(),
    ])).resolves.toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });
});
