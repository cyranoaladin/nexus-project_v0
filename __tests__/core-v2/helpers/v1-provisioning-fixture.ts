/**
 * Shared fixture for the V1-authority invitation campaign: two real PostgreSQL
 * databases (Core v2 through the service harness, Core v1 through the live
 * Prisma client), the real activation route, the real Auth.js handlers, and a
 * captured (never delivered) SMTP seam.
 */
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { NextRequest } from 'next/server';
import type { PrismaClient, User as CoreUser } from '@/core-v2/generated/client';
import { prisma } from '@/lib/prisma';
import { drainEmailOutbox, type EmailOutboxWorkerDependencies } from '@/lib/email/outbox-worker';
import { drainV1Provisioning, defaultV1Gateway, type V1Gateway, type V1ProvisioningMetrics } from '@/lib/core-v2/accounts/v1-provisioning-worker';
import { accountInvitationDeliveryAuthority } from '@/lib/core-v2/accounts/invitation-delivery-authority';
import { assertDisposablePostgresUrl } from '../../helpers/disposable-postgres';
import { setupServiceHarness, type Harness } from './service-harness';

export const TEST_DOMAIN = '@d2.example.test';
export type Role = CoreUser['role'];

process.env.RATE_LIMIT_BACKEND ??= 'memory';
process.env.RATE_LIMIT_KEY_NAMESPACE ??= 'synthetic-d2-campaign';
process.env.RATE_LIMIT_KEY_SECRET ??= 'synthetic_d2_rate_limit_key_not_a_credential_32';
process.env.RATE_LIMIT_TRUST_PROXY_HOPS ??= '1';
process.env.NEXTAUTH_URL ??= 'http://localhost:3000';
process.env.AUTH_SECRET ??= randomBytes(32).toString('base64url');
process.env.AUTH_TRUST_HOST ??= 'true';
process.env.PASSWORD_RESET_SECRET ??= randomBytes(32).toString('base64url');

export function newPassword(): string {
  return `${randomBytes(24).toString('base64url')}Aa1!`;
}

export interface CapturedMail {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html: string;
  readonly messageId?: string;
}

export interface Clock {
  now(): Date;
  advance(ms: number): void;
  reset(): void;
}

/** Wall clock plus a controllable offset: jobs stamped by the services stay due, and tests can jump forward. */
export function createClock(): Clock {
  let offset = 0;
  return { now: () => new Date(Date.now() + offset), advance: (ms) => { offset += ms; }, reset: () => { offset = 0; } };
}

/** The activation link as a recipient would see it. */
export function activationLink(mail: CapturedMail): { token: string; purpose: string; url: string } {
  const url = /https?:\/\/\S+/.exec(mail.text)?.[0];
  if (!url) throw new Error('no activation link in captured mail');
  const parsed = new URL(url);
  return { token: parsed.searchParams.get('token') ?? '', purpose: parsed.searchParams.get('purpose') ?? '', url };
}

export interface V1Fixture {
  readonly h: Harness;
  readonly clock: Clock;
  readonly mailbox: CapturedMail[];
  /** Makes the next N SMTP attempts fail (transient: 4xx-like), then succeed. */
  failSmtp(times: number, kind: 'transient' | 'permanent'): void;
  /** One worker pass (pollMs 0 so SENT sagas are re-inspected every pass). */
  run(options?: { gateway?: V1Gateway; limit?: number }): Promise<V1ProvisioningMetrics>;
  /** Worker passes until a pass makes no state progress, bounded. */
  settle(options?: { gateway?: V1Gateway }): Promise<void>;
  /** Drain the real v1 e-mail outbox into the captured mailbox. */
  deliverMail(): Promise<{ completed: number; retried: number; finalFailed: number }>;
  coreUser(role: Role, label: string, overrides?: { id?: string; email?: string }): Promise<CoreUser>;
  v1User(role: Role, label: string, shape: 'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'MERGED', overrides?: { id?: string; email?: string }): Promise<{ id: string; email: string; password: string | null }>;
  activate(link: { token: string; purpose: string }, password: string): Promise<{ status: number; body: Record<string, unknown> }>;
  verifyLink(link: { token: string; purpose: string }): Promise<{ status: number; body: Record<string, unknown> }>;
  /** Every scalar column of a v1 user row, for strict before/after equality. */
  snapshotV1(id: string): Promise<Record<string, unknown> | null>;
  /** Number of invitation e-mails queued in the v1 outbox (any status). */
  v1InvitationMailCount(): Promise<number>;
  saga(userId: string): Promise<{ state: string; generation: number; lastErrorCode: string | null; v1UserId: string | null }>;
  /** The real Auth.js handlers. Needs the ESM-transforming lane (jest.core-v2-authjs.config.js). */
  login(email: string, password: string): Promise<{ ok: boolean; session: { user?: { id?: string; role?: string } } | null }>;
  /** The real v1 credential chain Auth.js calls (authorize -> JWT claims -> revocation check), without importing next-auth. */
  loginChain(email: string, password: string): Promise<{ ok: boolean; session: { user?: { id?: string; role?: string } } | null }>;
}

let sequence = 0;
let clientAddress = 0;
/** A fresh client address per call: the real limiter stays on, but unrelated attempts do not share one bucket. */
function nextAddress(): string {
  clientAddress += 1;
  return `10.${(clientAddress >> 16) & 255}.${(clientAddress >> 8) & 255}.${clientAddress & 255}`;
}

export function setupV1Fixture(): V1Fixture {
  const h = setupServiceHarness();
  const clock = createClock();
  const mailbox: CapturedMail[] = [];
  const smtp = { failures: 0, kind: 'transient' as 'transient' | 'permanent' };
  const previousMode = process.env.CORE_V2_AUTH_MODE;

  async function cleanV1() {
    await prisma.$transaction(async tx => {
      // Disposable superuser cleanup only: production receipts are immutable.
      await tx.$executeRawUnsafe('ALTER TABLE public.v1_account_invitation_issuances DISABLE TRIGGER v1_invitation_receipt_immutable');
      await tx.v1AccountInvitationIssuance.deleteMany({ where: { user: { email: { endsWith: TEST_DOMAIN } } } });
      await tx.$executeRawUnsafe('ALTER TABLE public.v1_account_invitation_issuances ENABLE TRIGGER v1_invitation_receipt_immutable');
    });
    await prisma.jobOutbox.deleteMany({ where: { aggregateType: 'account-invitation' } });
    await prisma.user.deleteMany({ where: { email: { endsWith: TEST_DOMAIN } } });
  }

  beforeAll(() => { assertDisposablePostgresUrl(process.env.DATABASE_URL ?? ''); });
  beforeEach(async () => {
    process.env.CORE_V2_AUTH_MODE = 'V1_ONLY';
    mailbox.length = 0;
    smtp.failures = 0;
    clock.reset();
    await cleanV1();
    await fixture.v1User('ADMIN', 'issuer-admin', 'ACTIVE', { id: h.admin.userId });
    await fixture.v1User('ASSISTANTE', 'issuer-assistante', 'ACTIVE', { id: h.assistante.userId });
  });
  afterEach(() => {
    if (previousMode === undefined) delete process.env.CORE_V2_AUTH_MODE; else process.env.CORE_V2_AUTH_MODE = previousMode;
  });
  afterAll(async () => { await cleanV1(); await prisma.$disconnect(); });

  const fixture: V1Fixture = {
    h, clock, mailbox,
    failSmtp(times, kind) { smtp.failures = times; smtp.kind = kind; },
    run: (options = {}) => drainV1Provisioning(h.client as PrismaClient, {
      now: clock.now, pollMs: 0, gateway: options.gateway ?? defaultV1Gateway, limit: options.limit ?? 50,
    }),
    async settle(options = {}) {
      for (let pass = 0; pass < 12; pass += 1) {
        const before = await h.client.accountV1Provisioning.findMany({ select: { id: true, state: true, generation: true }, orderBy: { id: 'asc' } });
        await fixture.run(options);
        const after = await h.client.accountV1Provisioning.findMany({ select: { id: true, state: true, generation: true }, orderBy: { id: 'asc' } });
        if (JSON.stringify(before) === JSON.stringify(after)) return;
      }
    },
    async deliverMail() {
      return drainEmailOutbox({ limit: 50 }, {
        now: clock.now,
        accountInvitationAuthority: accountInvitationDeliveryAuthority(h.client),
        deliver: (async (options) => {
          if (smtp.failures > 0) {
            smtp.failures -= 1;
            throw Object.assign(new Error('SMTP_SYNTHETIC'), smtp.kind === 'permanent'
              ? { code: 'EENVELOPE', responseCode: 550, command: 'RCPT TO' }
              : { code: 'ESOCKET', responseCode: 421, command: 'CONN' });
          }
          mailbox.push({ to: options.to, subject: options.subject, text: options.text ?? '', html: options.html, messageId: options.messageId });
          return { ok: true, messageId: options.messageId };
        }) as EmailOutboxWorkerDependencies['deliver'],
      });
    },
    async coreUser(role, label, overrides = {}) {
      sequence += 1;
      const user = await h.client.user.create({
        data: {
          ...(overrides.id ? { id: overrides.id } : {}),
          role, email: overrides.email ?? `${label}-${sequence}${TEST_DOMAIN}`,
          firstName: 'Synthetic', lastName: label, accountStatus: 'PENDING_ACTIVATION',
        },
      });
      if (role === 'COACH') await h.client.coachProfile.create({ data: { userId: user.id } });
      if (role === 'PARENT' || role === 'ELEVE') {
        const household = await h.client.household.create({ data: {} });
        const parent = role === 'PARENT' ? user : await h.client.user.create({ data: { role: 'PARENT', accountStatus: 'ACTIVE' } });
        await h.client.householdParent.create({ data: { householdId: household.id, userId: parent.id,
          verificationStatus: 'VERIFIED', verifiedAt: new Date(), verifiedById: h.admin.userId,
          verificationEvidenceDigest: 'b'.repeat(64), revision: 1 } });
        const child = role === 'ELEVE' ? user : await h.client.user.create({ data: { role: 'ELEVE', accountStatus: 'ACTIVE' } });
        const student = await h.client.student.create({ data: { householdId: household.id, userId: child.id } });
        const year = await h.client.academicYear.upsert({ where: { startYear: 2026 }, update: {},
          create: { startYear: 2026, startsAt: new Date('2026-09-01'), endsAt: new Date('2027-08-01'), status: 'CURRENT' } });
        await h.client.studentAcademicYearEnrollment.create({ data: { studentId: student.id, academicYearId: year.id,
          gradeLevel: 'PREMIERE', status: 'ACTIVE', approvedAt: new Date(), approvedById: h.admin.userId } });
      }
      return user;
    },
    async v1User(role, label, shape, overrides = {}) {
      sequence += 1;
      const password = shape === 'ACTIVE' || shape === 'SUSPENDED' ? newPassword() : null;
      const email = overrides.email ?? `${label}-${sequence}${TEST_DOMAIN}`;
      const user = await prisma.user.create({
        data: {
          ...(overrides.id ? { id: overrides.id } : {}),
          email, role, firstName: 'Synthetic', lastName: label,
          password: password ? await bcrypt.hash(password, 4) : null,
          activatedAt: shape === 'ACTIVE' || shape === 'SUSPENDED' ? new Date() : null,
          disabledAt: shape === 'SUSPENDED' ? new Date() : null,
          ...(role === 'PARENT' ? { parentProfile: { create: {} } } : {}),
        },
        select: { id: true, email: true },
      });
      if (shape === 'MERGED') {
        const target = await prisma.user.create({ data: { email: `merge-target-${sequence}${TEST_DOMAIN}`, role: 'PARENT' } });
        await prisma.user.update({ where: { id: user.id }, data: { mergedIntoUserId: target.id, mergedAt: new Date() } });
      }
      return { id: user.id, email: user.email as string, password };
    },
    async activate(link, password) {
      const { POST } = await import('@/app/api/auth/activate/route');
      const response = await POST(new NextRequest('http://localhost:3000/api/auth/activate', {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': nextAddress() },
        body: JSON.stringify({ token: link.token, password, purpose: link.purpose }),
      }));
      return { status: response.status, body: await response.json() };
    },
    async verifyLink(link) {
      const { GET } = await import('@/app/api/auth/activate/route');
      const response = await GET(new NextRequest(
        `http://localhost:3000/api/auth/activate?purpose=${link.purpose}&token=${encodeURIComponent(link.token)}`,
        { headers: { 'x-forwarded-for': nextAddress() } },
      ));
      return { status: response.status, body: await response.json() };
    },
    async snapshotV1(id) {
      return prisma.user.findUnique({ where: { id } }) as Promise<Record<string, unknown> | null>;
    },
    v1InvitationMailCount: () => prisma.jobOutbox.count({ where: { aggregateType: 'account-invitation' } }),
    async saga(userId) {
      const row = await h.client.accountV1Provisioning.findUniqueOrThrow({ where: { userId } });
      return { state: row.state, generation: row.generation, lastErrorCode: row.lastErrorCode, v1UserId: row.v1UserId };
    },
    async loginChain(email, password) {
      const { authorizeCredentials } = await import('@/lib/auth/credentials-authorize');
      const { issueSessionToken } = await import('@/lib/auth/session-claims');
      const { validateSessionToken } = await import('@/lib/auth/session-revocation');
      let user: Awaited<ReturnType<typeof authorizeCredentials>>;
      try { user = await authorizeCredentials({ identifier: email, password }); } catch { return { ok: false, session: null }; }
      if (!user) return { ok: false, session: null };
      const token = issueSessionToken({} as never, user as unknown as Parameters<typeof issueSessionToken>[1]);
      const validated = await validateSessionToken(token);
      return validated ? { ok: true, session: { user: { id: token.id as string, role: token.role as string } } } : { ok: false, session: null };
    },
    async login(email, password) {
      const { handlers } = await import('@/auth');
      const base = 'http://localhost:3000/api/auth';
      const csrfResponse = await handlers.GET(new NextRequest(`${base}/csrf`));
      const csrfCookies = csrfResponse.headers.getSetCookie().map((cookie) => cookie.split(';')[0]).join('; ');
      const { csrfToken } = await csrfResponse.json() as { csrfToken: string };
      const form = new URLSearchParams({ csrfToken, identifier: email, email, password, json: 'true' });
      const callback = await handlers.POST(new NextRequest(`${base}/callback/credentials`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: csrfCookies, 'x-forwarded-for': nextAddress() },
        body: form.toString(),
      }));
      const sessionCookie = callback.headers.getSetCookie().map((cookie) => cookie.split(';')[0]).find((cookie) => /session-token=/.test(cookie));
      if (!sessionCookie) return { ok: false, session: null };
      const sessionResponse = await handlers.GET(new NextRequest(`${base}/session`, { headers: { cookie: sessionCookie } }));
      const session = await sessionResponse.json() as { user?: { id?: string; role?: string } } | null;
      return { ok: Boolean(session?.user?.id), session };
    },
  };
  return fixture;
}
