/**
 * Session revocation for a Core-v2-owned (Core-only) identity, through the REAL
 * Auth.js pipeline: an encrypted session cookie -> jwt callback
 * (validateSessionToken) -> session -> auth() -> route handlers and the
 * dashboard layout. Nothing between the cookie and the data is mocked except
 * the request-scope accessor (next/headers) and the rate limiter.
 *
 * Intended environments (CORE_V2_AUTH_MODE, set per describe, never globally):
 *   - V2_ONLY : Core v1 credential and session authority is disabled.
 *   - HYBRID  : both stores exist; an identity with a Core v2 row is CORE_V2
 *               only. Same revocation contract.
 *   - V1_ONLY : what production runs today; a CORE_V2 cookie is simply refused
 *               (Core v2 is never consulted).
 *
 * Every Core-owned scenario plants a Core v1 "twin" that shares the same
 * e-mail, to prove that no revoked, suspended or replaced Core session ever
 * falls back to it.
 *
 * Prerequisites (same as CI job core-v2-foundation): CORE_V2_DATABASE_URL on a
 * migrated Core v2 database, and DATABASE_URL on a migrated, disposable Core v1
 * database named nexus_disposable_*_test with NEXUS_DISPOSABLE_POSTGRES=1.
 */
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { encode } from 'next-auth/jwt';
import type { User } from 'next-auth';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorizeCredentials } from '@/lib/auth/credentials-authorize';
import { issueSessionToken } from '@/lib/auth/session-claims';
import { revokeAllUserSessions, validateSessionToken } from '@/lib/auth/session-revocation';
import {
  activateAccount,
  createHousehold,
  disableAccount,
  inviteAccount,
  reactivateAccount,
  suspendAccount,
  verifyHouseholdParent,
} from '@/lib/core-v2/services';
import { setupServiceHarness } from '../helpers/service-harness';
import { seedInvitationFamilyScope } from '../helpers/invitation-family';
import { assertDisposablePostgresUrl } from '../../helpers/disposable-postgres';

jest.mock('next/headers', () => ({ headers: jest.fn(), cookies: jest.fn() }));
jest.mock('@/lib/rate-limit/sensitive', () => ({ guardSensitiveRateLimit: jest.fn().mockResolvedValue(null) }));

const ORIGIN = 'https://nexusreussite.academy'; // always an allowed CSRF origin
const COOKIE = '__Secure-authjs.session-token'; // https => secure cookie name (also the JWT salt)
const SECRET = randomBytes(32).toString('hex');
const ENV_KEYS = ['AUTH_SECRET', 'NEXTAUTH_SECRET', 'AUTH_URL', 'NEXTAUTH_URL', 'CORE_V2_AUTH_MODE'] as const;
const savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

const h = setupServiceHarness();

type RouteHandler = (request: NextRequest, context: { params: Promise<Record<string, string>> }) => Promise<Response>;
let nextAuthSession: (request: NextRequest) => Promise<Response>;
let householdGET: RouteHandler;
let revokePOST: (request: NextRequest) => Promise<Response>;
let passwordChangePOST: (request: NextRequest) => Promise<Response>;
let DashboardLayout: (props: { children: unknown }) => Promise<unknown>;
let requestHeaders: jest.Mock;

beforeAll(async () => {
  assertDisposablePostgresUrl(process.env.DATABASE_URL ?? '');
  process.env.AUTH_SECRET = SECRET;
  process.env.NEXTAUTH_SECRET = SECRET;
  process.env.AUTH_URL = `${ORIGIN}/api/auth`;
  process.env.NEXTAUTH_URL = `${ORIGIN}/api/auth`;
  requestHeaders = (await import('next/headers')).headers as unknown as jest.Mock;
  nextAuthSession = (await import('@/app/api/auth/[...nextauth]/route')).GET as typeof nextAuthSession;
  householdGET = (await import('@/app/api/v2/parent/household/route')).GET as RouteHandler;
  revokePOST = (await import('@/app/api/auth/sessions/revoke/route')).POST;
  passwordChangePOST = (await import('@/app/api/v2/auth/password-change/route')).POST;
  DashboardLayout = (await import('@/app/dashboard/layout')).default as unknown as typeof DashboardLayout;
});

afterAll(async () => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  await prisma.$disconnect();
});

const strongPassword = () => `${randomBytes(24).toString('base64url')}Aa1!`;
const noParams = { params: Promise.resolve({}) };

interface Fixture {
  readonly parentId: string;
  readonly email: string;
  readonly password: string;
  readonly twin: { readonly id: string; readonly password: string };
}

/** A fully activated Core v2 parent, plus a Core v1 twin that shares its e-mail. */
async function provision(label: string): Promise<Fixture> {
  const email = `${label}-${randomBytes(4).toString('hex')}@example.test`;
  const password = strongPassword();
  const { parent, household } = await createHousehold(h.client, h.ctx(), {
    parent: { firstName: 'Synthetic', lastName: 'Core-only', email },
  });
  // The household endpoint only answers 200 for a VERIFIED membership.
  await verifyHouseholdParent(h.client, h.ctx(), {
    householdId: household.id,
    parentUserId: parent.id,
    expectedRevision: 0,
    evidenceDigest: 'a'.repeat(64),
  });
  await seedInvitationFamilyScope(h.client, h.admin.userId, parent.id);
  const issued = await inviteAccount(h.client, h.ctx(), parent.id);
  await activateAccount(h.client, { rawToken: issued.rawToken, password });

  const twinPassword = strongPassword();
  const twin = await prisma.user.create({
    data: {
      email,
      role: 'PARENT',
      password: await bcrypt.hash(twinPassword, 4),
      activatedAt: new Date(),
    },
  });
  return { parentId: parent.id, email, password, twin: { id: twin.id, password: twinPassword } };
}

const createdTwins: string[] = [];
afterEach(async () => {
  const ids = createdTwins.splice(0);
  if (ids.length > 0) await prisma.user.deleteMany({ where: { id: { in: ids } } });
});

async function setUp(label: string): Promise<Fixture> {
  const fixture = await provision(label);
  createdTwins.push(fixture.twin.id);
  // Core-only: Core v1 holds no row for this identity, only an unrelated twin sharing the e-mail.
  expect(await prisma.user.count({ where: { id: fixture.parentId } })).toBe(0);
  expect(fixture.twin.id).not.toBe(fixture.parentId);
  return fixture;
}

/** A genuine sign-in (authorizeCredentials) turned into the browser's encrypted session cookie. */
async function signIn(email: string, password: string): Promise<string> {
  const user = await authorizeCredentials({ identifier: email, password });
  if (!user) throw new Error('SIGN_IN_REFUSED');
  // `role` est OBLIGATOIRE sur le JWT augmenté du projet (types/next-auth.d.ts:28) :
  // l'omettre rendait ce littéral non assignable à `JWT`, seule erreur relevée par
  // le check TypeScript de la CI.
  const token = issueSessionToken(
    { name: null, email: user.email, sub: user.id, role: user.role },
    user as unknown as User,
  );
  const jwt = await encode({ secret: SECRET, salt: COOKIE, maxAge: 3600, token });
  return `${COOKIE}=${jwt}`;
}

function aim(cookie: string): void {
  requestHeaders.mockResolvedValue(new Headers({ cookie, host: 'nexusreussite.academy', 'x-forwarded-proto': 'https' }));
}

function post(path: string, cookie: string, body?: unknown): NextRequest {
  return new NextRequest(`${ORIGIN}${path}`, {
    method: 'POST',
    headers: { cookie, origin: ORIGIN, 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

/** Direct API access with the cookie. */
async function apiStatus(cookie: string): Promise<{ status: number; code?: string }> {
  aim(cookie);
  const response = await householdGET(new NextRequest(`${ORIGIN}/api/v2/parent/household`, { headers: { cookie, origin: ORIGIN } }), noParams);
  const body = (await response.json()) as { error?: { code?: string } };
  return { status: response.status, code: body.error?.code };
}

/** UI access: the dashboard layout either renders for a session or redirects to sign-in. */
async function uiOutcome(cookie: string): Promise<'RENDERED' | string> {
  aim(cookie);
  try {
    await DashboardLayout({ children: null });
    return 'RENDERED';
  } catch (error) {
    const digest = (error as { digest?: unknown }).digest;
    if (typeof digest === 'string' && digest.startsWith('NEXT_REDIRECT')) return digest.split(';')[2] ?? digest;
    throw error;
  }
}

/** What the browser's session endpoint answers, and whether the stale cookie is retired. */
async function sessionEndpoint(cookie: string): Promise<{ status: number; user: { id?: string; authority?: string } | null; retiresCookie: boolean }> {
  const response = await nextAuthSession(new NextRequest(`${ORIGIN}/api/auth/session`, { headers: { cookie } }));
  const setCookie = response.headers.get('set-cookie') ?? '';
  const body = (await response.json()) as { user?: { id?: string; authority?: string } } | null;
  return {
    status: response.status,
    user: body?.user ?? null,
    retiresCookie: setCookie.includes(`${COOKIE}=`) && setCookie.includes('Max-Age=0'),
  };
}

async function expectAccepted(cookie: string, fixture: Fixture): Promise<void> {
  expect(await apiStatus(cookie)).toEqual({ status: 200, code: undefined });
  expect(await uiOutcome(cookie)).toBe('RENDERED');
  const session = await sessionEndpoint(cookie);
  expect(session).toMatchObject({ status: 200, retiresCookie: false });
  // The session identity is the Core v2 one, never the V1 twin sharing its e-mail.
  expect(session.user).toMatchObject({ id: fixture.parentId, authority: 'CORE_V2' });
}

/** A cookie that is still presented by the browser yet unusable on every channel. */
async function expectRefused(cookie: string): Promise<void> {
  expect(await apiStatus(cookie)).toEqual({ status: 401, code: 'UNAUTHENTICATED' });
  expect(await uiOutcome(cookie)).toBe('/auth/signin');
  expect(await sessionEndpoint(cookie)).toEqual({ status: 200, user: null, retiresCookie: true });
  // Presenting it again changes nothing: it never becomes usable and never degrades to another identity.
  expect(await apiStatus(cookie)).toEqual({ status: 401, code: 'UNAUTHENTICATED' });
}

async function expectTwinUntouched(fixture: Fixture): Promise<void> {
  const twin = await prisma.user.findUniqueOrThrow({ where: { id: fixture.twin.id } });
  expect(twin.sessionVersion).toBe(0);
  expect(await bcrypt.compare(fixture.twin.password, twin.password as string)).toBe(true);
  // Its credentials never open a session in a Core-owned world.
  expect(await authorizeCredentials({ identifier: fixture.email, password: fixture.twin.password })).toBeNull();
}

describe.each(['V2_ONLY', 'HYBRID'] as const)('Core-only identity session revocation in %s', (mode) => {
  beforeEach(() => {
    process.env.CORE_V2_AUTH_MODE = mode;
  });

  test('two simultaneous sessions are both accepted before any revocation', async () => {
    const fixture = await setUp('simultaneous');
    const a = await signIn(fixture.email, fixture.password);
    const b = await signIn(fixture.email, fixture.password);
    expect(a).not.toBe(b);

    await expectAccepted(a, fixture);
    await expectAccepted(b, fixture);
    await expectTwinUntouched(fixture);
  });

  test('self-service revocation from one session ends both, over API, UI and the session endpoint', async () => {
    const fixture = await setUp('self-revoke');
    const a = await signIn(fixture.email, fixture.password);
    const b = await signIn(fixture.email, fixture.password);
    const before = await h.client.user.findUniqueOrThrow({ where: { id: fixture.parentId } });

    aim(a);
    expect((await revokePOST(post('/api/auth/sessions/revoke', a))).status).toBe(200);

    expect((await h.client.user.findUniqueOrThrow({ where: { id: fixture.parentId } })).sessionVersion).toBe(before.sessionVersion + 1);
    await expectRefused(a);
    await expectRefused(b);
    aim(a);
    expect((await revokePOST(post('/api/auth/sessions/revoke', a))).status).toBe(401);
    await expectTwinUntouched(fixture);

    // Only a new sign-in recovers access, and it is again the Core identity.
    await expectAccepted(await signIn(fixture.email, fixture.password), fixture);
  });

  test('a password change from one session ends the other, and the old password is dead', async () => {
    const fixture = await setUp('password-change');
    const a = await signIn(fixture.email, fixture.password);
    const b = await signIn(fixture.email, fixture.password);
    const next = strongPassword();

    aim(a);
    const changed = await passwordChangePOST(post('/api/v2/auth/password-change', a, { currentPassword: fixture.password, newPassword: next }));
    expect(changed.status).toBe(200);

    await expectRefused(a);
    await expectRefused(b);
    expect(await authorizeCredentials({ identifier: fixture.email, password: fixture.password })).toBeNull();
    await expectTwinUntouched(fixture);
    await expectAccepted(await signIn(fixture.email, next), fixture);
  });

  test('suspension ends every session, blocks sign-in, and reactivation does not resurrect old cookies', async () => {
    const fixture = await setUp('suspension');
    const a = await signIn(fixture.email, fixture.password);
    const b = await signIn(fixture.email, fixture.password);

    await suspendAccount(h.client, h.ctx(), fixture.parentId);

    await expectRefused(a);
    await expectRefused(b);
    expect(await authorizeCredentials({ identifier: fixture.email, password: fixture.password })).toBeNull();
    await expectTwinUntouched(fixture);

    await reactivateAccount(h.client, h.ctx(), fixture.parentId);
    await expectRefused(a);
    await expectRefused(b);
    await expectAccepted(await signIn(fixture.email, fixture.password), fixture);
  });

  test('disabling the account ends every session for good', async () => {
    const fixture = await setUp('disabled');
    const a = await signIn(fixture.email, fixture.password);
    const b = await signIn(fixture.email, fixture.password);

    await disableAccount(h.client, h.ctx(), fixture.parentId);

    await expectRefused(a);
    await expectRefused(b);
    expect(await authorizeCredentials({ identifier: fixture.email, password: fixture.password })).toBeNull();
    await expectTwinUntouched(fixture);
  });

  test('administrative revocation of another identity ends its sessions and nobody else is touched', async () => {
    const target = await setUp('admin-revoke-target');
    const bystander = await setUp('admin-revoke-bystander');
    const t1 = await signIn(target.email, target.password);
    const t2 = await signIn(target.email, target.password);
    const other = await signIn(bystander.email, bystander.password);
    const before = (await h.client.user.findUniqueOrThrow({ where: { id: target.parentId } })).sessionVersion;

    const revoked = await revokeAllUserSessions(target.parentId);

    expect(revoked.sessionVersion).toBe(before + 1);
    await expectRefused(t1);
    await expectRefused(t2);
    await expectAccepted(other, bystander);
    await expectTwinUntouched(target);
    await expectTwinUntouched(bystander);
  });

  test('a token without the Core claim, or one minted for the V1 twin, never validates for a Core-owned identity', async () => {
    const fixture = await setUp('no-fallback');
    const live = (await h.client.user.findUniqueOrThrow({ where: { id: fixture.parentId } })).sessionVersion;

    // A legacy token (no authority claim) carrying the Core identity's own id and live version:
    // it would be validated against Core v1, which holds no such row, so it must not validate.
    expect(await validateSessionToken({ id: fixture.parentId, role: 'PARENT', sessionVersion: live })).toBeNull();
    expect(await validateSessionToken({ id: fixture.parentId, role: 'PARENT', sessionVersion: live, authority: 'V1' })).toBeNull();

    if (mode === 'V2_ONLY') {
      // Core v1 authenticates nobody: not even the twin's own, otherwise valid, V1 token.
      expect(await validateSessionToken({ id: fixture.twin.id, role: 'PARENT', sessionVersion: 0, authority: 'V1' })).toBeNull();
    }
    expect(await authorizeCredentials({ identifier: fixture.email, password: fixture.twin.password })).toBeNull();
  });
});

describe('V1_ONLY (what production runs): a Core v2 cookie is never honoured', () => {
  beforeEach(() => {
    process.env.CORE_V2_AUTH_MODE = 'V1_ONLY';
  });

  test('a cookie issued for a Core identity is refused on API, UI and the session endpoint', async () => {
    // The fixture needs a Core credential to exist at all, and under V1_ONLY
    // writing one is refused on purpose (assertCoreMayHoldCredentials). So the
    // identity is built in a mode that allows Core credentials, and only THEN
    // is production's mode applied to prove the cookie is no longer honoured.
    process.env.CORE_V2_AUTH_MODE = 'V2_ONLY';
    const fixture = await setUp('v1-only');
    const cookie = await signIn(fixture.email, fixture.password);
    await expectAccepted(cookie, fixture);

    process.env.CORE_V2_AUTH_MODE = 'V1_ONLY';
    expect(await apiStatus(cookie)).toMatchObject({ status: 401 });
    expect(await uiOutcome(cookie)).toBe('/auth/signin');
    expect(await sessionEndpoint(cookie)).toMatchObject({ user: null, retiresCookie: true });
    // The V1 twin sharing the e-mail is the only identity V1_ONLY can authenticate.
    expect(await authorizeCredentials({ identifier: fixture.email, password: fixture.password })).toBeNull();
    expect(await authorizeCredentials({ identifier: fixture.email, password: fixture.twin.password })).toMatchObject({ id: fixture.twin.id, authority: 'V1' });
  });
});
