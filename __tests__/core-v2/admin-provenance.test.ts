import { syntheticSecret } from './helpers/synthetic-secret';
import { PrismaClient } from '@/core-v2/generated/client';
import { limitedRoleUrl } from './helpers/limited-role-url';
import { requireCoreV2Client, disconnectCoreV2Client } from '@/lib/core-v2/client';
import { resetCoreV2Database } from './helpers/reset-db';
import { bootstrapTestAdmin } from './helpers/bootstrap';
import { upsertStaffActors } from '@/scripts/core-v2/sync-staff-actors';
import { prisma } from '@/lib/prisma';
import { encode } from 'next-auth/jwt';
import { NextRequest } from 'next/server';
import { promoteCoreAdministrator } from '@/lib/core-v2/services/admin-promotion';
import { disconnectCoreV2AdminAuthorizer } from '@/lib/core-v2/client';
import { installTestAdminPromotionRoles } from './helpers/admin-promotion';
jest.mock('@/lib/deployment/release-identity', () => ({ readRunningReleaseSha: async () => 'a'.repeat(40) }));

const firstId = 'authoritative-test-admin';
const targetId = 'authoritative-next-admin';
const record = { id: targetId, role: 'ASSISTANTE' as const, email: null, firstName: null,
  lastName: null, phone: null, accountStatus: 'ACTIVE' as const, coachProfileId: null };
const command = '997333bd-cf62-4d1f-9ee9-3855a4065178';
const secret = syntheticSecret();
const environment = { AUTH_SECRET: process.env.AUTH_SECRET, AUTH_URL: process.env.AUTH_URL,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL, CORE_V2_ADMIN_AUTHORIZER_DATABASE_URL: process.env.CORE_V2_ADMIN_AUTHORIZER_DATABASE_URL,
  CORE_V2_AUTH_MODE: process.env.CORE_V2_AUTH_MODE };

describe('ADMIN provenance under the actual limited PostgreSQL role', () => {
  let client: PrismaClient;
  let runtime: PrismaClient;
  let promoter: PrismaClient;
  beforeAll(async () => {
    client = await requireCoreV2Client();
    await client.$executeRawUnsafe(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'nexus_core_runtime') THEN CREATE ROLE nexus_core_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'nexus_core_bootstrap') THEN CREATE ROLE nexus_core_bootstrap NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'nexus_core_admin_promoter_owner') THEN CREATE ROLE nexus_core_admin_promoter_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'nexus_core_admin_promotion') THEN CREATE ROLE nexus_core_admin_promotion LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT; END IF;
    END $$`);
    await client.$executeRawUnsafe('GRANT USAGE ON SCHEMA public TO nexus_core_runtime, nexus_core_admin_promoter_owner, nexus_core_admin_promotion');
    await client.$executeRawUnsafe('GRANT SELECT ON ALL TABLES IN SCHEMA public TO nexus_core_runtime, nexus_core_admin_promoter_owner, nexus_core_admin_promotion');
    await client.$executeRawUnsafe('GRANT INSERT, UPDATE, DELETE ON public.users, public.audit_events, public.coach_profiles_v2 TO nexus_core_runtime');
    await client.$executeRawUnsafe('GRANT UPDATE (role, "sessionVersion", "updatedAt") ON public.users TO nexus_core_admin_promoter_owner');
    // The future promotion primitive is installed by migrations, then its
    // object ownership/grants are narrowed by the privileged provisioner.
    const [installed] = await client.$queryRaw<Array<{ ready: boolean }>>`SELECT to_regprocedure('public.core_promote_admin(text,text,uuid,text)') IS NOT NULL AS ready`;
    expect(installed.ready).toBe(true);
    await installTestAdminPromotionRoles(client);
    runtime = new PrismaClient({ datasources: { db: { url: await limitedRoleUrl(client, 'nexus_core_runtime') } } });
    const authorizerUrl = await limitedRoleUrl(client, 'nexus_core_admin_authorizer');
    promoter = new PrismaClient({ datasources: { db: { url: authorizerUrl } } });
    process.env.CORE_V2_ADMIN_AUTHORIZER_DATABASE_URL = authorizerUrl;
    process.env.AUTH_SECRET = secret; process.env.AUTH_URL = 'http://localhost:3000'; process.env.NEXTAUTH_URL = 'http://localhost:3000';
    process.env.CORE_V2_AUTH_MODE = 'V1_ONLY';
  });
  beforeEach(async () => { await resetCoreV2Database(client); });
  afterEach(async () => { await prisma.user.deleteMany({ where: { id: { in: [firstId, targetId] } } }); });
  afterAll(async () => { await runtime?.$disconnect(); await promoter?.$disconnect(); await disconnectCoreV2AdminAuthorizer();
    await disconnectCoreV2Client(); await prisma.$disconnect();
    for (const [key, value] of Object.entries(environment)) if (value === undefined) delete process.env[key]; else process.env[key] = value;
  });

  test('an ADMIN without its attestation is refused even with a forged pg_temp.pg_roles', async () => {
    await expect(runtime.$transaction(async tx => {
      await tx.$executeRawUnsafe('CREATE TEMP TABLE pg_roles (rolname TEXT, rolsuper BOOLEAN)');
      await tx.$executeRawUnsafe("INSERT INTO pg_temp.pg_roles VALUES ('nexus_core_runtime', true)");
      await tx.user.create({ data: { id: 'unattested-admin', role: 'ADMIN', accountStatus: 'ACTIVE' } });
    })).rejects.toThrow();
    expect(await client.user.count()).toBe(0);
    expect(await client.auditEvent.count()).toBe(0);
  });

  test('after bootstrap runtime cannot insert a second ADMIN or forge its reserved receipt', async () => {
    await bootstrapTestAdmin(client);
    await expect(runtime.user.create({ data: { id: targetId, role: 'ADMIN', accountStatus: 'ACTIVE' } })).rejects.toThrow();
    await expect(runtime.auditEvent.create({ data: { action: 'account.admin_promoted', subjectType: 'User',
      subjectId: targetId, actorUserId: firstId, correlationId: command } })).rejects.toThrow();
    expect(await client.user.count({ where: { role: 'ADMIN' } })).toBe(1);
    expect(await client.auditEvent.count()).toBe(1);
  });

  test('runtime cannot execute promotion, SET ROLE its owner, or change the bootstrap attestation', async () => {
    await bootstrapTestAdmin(client);
    await expect(runtime.$queryRaw`SELECT public.core_promote_admin(${firstId}, ${targetId}, ${command}::uuid, 'ISOLATED_TEST')`).rejects.toThrow();
    await expect(runtime.$executeRawUnsafe('SET ROLE nexus_core_admin_promoter_owner')).rejects.toThrow();
    await expect(runtime.$executeRawUnsafe('DELETE FROM public.core_admin_bootstrap')).rejects.toThrow();
    await expect(runtime.$executeRawUnsafe('UPDATE public.core_admin_bootstrap SET nonce = nonce')).rejects.toThrow();
    await expect(runtime.$executeRawUnsafe('TRUNCATE public.core_admin_bootstrap CASCADE')).rejects.toThrow();
    expect(await client.coreAdminBootstrap.count()).toBe(1);
    expect(await client.user.count()).toBe(1);
  });

  async function promote(actorId = firstId, id = targetId, reason = 'STAFF_AUTHORIZATION') {
    for (const [userId, role] of [[actorId, 'ADMIN'], [id, 'ASSISTANTE']] as const)
      await prisma.user.upsert({ where: { id: userId }, update: {}, create: { id: userId, role,
        email: `${userId}@synthetic.example.test`, activatedAt: new Date(), password: syntheticSecret() } });
    const identity = await prisma.user.findUniqueOrThrow({ where: { id: actorId } });
    const jwt = await encode({ secret, salt: 'authjs.session-token', token: { id: actorId, role: identity.role,
      authority: 'V1', sessionVersion: identity.sessionVersion }, maxAge: 300 });
    return promoteCoreAdministrator(client, { actor: { userId: actorId, role: 'ADMIN' }, correlationId: command, now: () => new Date() },
      { user: { id: actorId, role: identity.role, email: identity.email!, authority: 'V1' }, expires: new Date(Date.now() + 300_000).toISOString() },
      new NextRequest('http://localhost:3000/api/v2/staff/accounts/target/promote-admin', { headers: { cookie: `authjs.session-token=${jwt}` } }),
      { targetId: id, commandId: command, reason });
  }
  test('a SQL caller cannot impersonate an ADMIN without a session-authorized command', async () => {
    await bootstrapTestAdmin(client);
    await upsertStaffActors(client, [record], { execute: true });
    const users = await client.user.findMany({ orderBy: { id: 'asc' } });
    const audits = await client.auditEvent.findMany({ orderBy: { id: 'asc' } });
    await expect(promoter.$queryRaw`SELECT public.core_promote_admin(${firstId}, ${targetId}, ${command}::uuid, 'STAFF_AUTHORIZATION')`).rejects.toThrow();
    await expect(client.$queryRaw`SELECT public.core_promote_admin(${firstId}, ${targetId}, ${command}::uuid, 'STAFF_AUTHORIZATION')`)
      .rejects.toThrow('SESSION_AUTHORIZED_PROMOTION_REQUIRED');
    expect(await client.user.findMany({ orderBy: { id: 'asc' } })).toEqual(users);
    expect(await client.auditEvent.findMany({ orderBy: { id: 'asc' } })).toEqual(audits);
  });
  test.each([null, ''])('promotion rejects missing/empty reason %p without mutation', async reason => {
    await bootstrapTestAdmin(client);
    await upsertStaffActors(client, [record], { execute: true });
    const users = await client.user.findMany({ orderBy: { id: 'asc' } });
    const audits = await client.auditEvent.findMany({ orderBy: { id: 'asc' } });
    await expect(promoter.$queryRaw`SELECT public.core_promote_admin(${firstId}, ${targetId}, ${command}::uuid, ${reason}::text)`)
      .rejects.toThrow();
    expect(await client.user.findMany({ orderBy: { id: 'asc' } })).toEqual(users);
    expect(await client.auditEvent.findMany({ orderBy: { id: 'asc' } })).toEqual(audits);
  });

  test('a promoted ADMIN cannot be deleted and its receipt remains linked', async () => {
    await bootstrapTestAdmin(client);
    await upsertStaffActors(client, [record], { execute: true });
    await promote();
    await expect(runtime.user.delete({ where: { id: targetId } })).rejects.toThrow();
    expect((await client.user.findUnique({ where: { id: targetId } }))?.role).toBe('ADMIN');
    expect(await client.auditEvent.count({ where: { action: 'account.admin_promoted', subjectId: targetId } })).toBe(1);
  });

  test('bootstrap and promotion receipts are append-only under runtime', async () => {
    await bootstrapTestAdmin(client);
    await upsertStaffActors(client, [record], { execute: true });
    await promote();
    for (const action of ['account.bootstrap_v1_admin', 'account.admin_promoted']) {
      const receipt = await client.auditEvent.findFirstOrThrow({ where: { action } });
      await expect(runtime.auditEvent.update({ where: { id: receipt.id }, data: { action: 'forged.action' } })).rejects.toThrow();
      await expect(runtime.auditEvent.delete({ where: { id: receipt.id } })).rejects.toThrow();
      expect(await client.auditEvent.findUnique({ where: { id: receipt.id } })).toEqual(receipt);
    }
  });
  test('a legitimate promotion is atomic, idempotent, and allows later sync without modifying either ADMIN', async () => {
    await bootstrapTestAdmin(client);
    await upsertStaffActors(client, [record], { execute: true });
    const receipt = await promote();
    expect(await client.user.count({ where: { role: 'ADMIN' } })).toBe(2);
    const audit = await client.auditEvent.findMany({ orderBy: { id: 'asc' } });
    expect(await promote()).toMatchObject({ outcome: 'ALREADY_PROMOTED', receiptId: receipt.receiptId });
    expect(await client.auditEvent.findMany({ orderBy: { id: 'asc' } })).toEqual(audit);
    await client.user.update({ where: { id: firstId }, data: { accountStatus: 'SUSPENDED' } });
    const admins = await client.user.findMany({ where: { role: 'ADMIN' }, orderBy: { id: 'asc' } });
    expect((await upsertStaffActors(client, [record], { execute: true })).users).toEqual({ created: 0, updated: 0, unchanged: 1 });
    expect(await client.user.findMany({ where: { role: 'ADMIN' }, orderBy: { id: 'asc' } })).toEqual(admins);
  });

  test('promotion by a suspended ADMIN and a divergent command replay refuse without any effect', async () => {
    await bootstrapTestAdmin(client);
    await upsertStaffActors(client, [record], { execute: true });
    await promote();
    const audit = await client.auditEvent.findMany({ orderBy: { id: 'asc' } });
    await expect(promote(firstId, targetId, 'DIFFERENT_REASON')).rejects.toThrow();
    await client.user.update({ where: { id: firstId }, data: { accountStatus: 'SUSPENDED' } });
    await expect(promote()).rejects.toThrow();
    expect(await client.auditEvent.findMany({ orderBy: { id: 'asc' } })).toEqual(audit);
  });
});
