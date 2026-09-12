import type { Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { resetBrowserSession } from './auth';
import { assertDisposableE2eDatabase } from './disposable-database';
import { resetDisposableE2ERateLimits } from './rate-limit';
import { sameOriginHeaders } from './same-origin';

/**
 * Task 17 — thin, scenario-specific helper for the golden-family E2E
 * (`e2e/auth/core-golden-family.spec.ts`). Built ON TOP of the existing
 * disposable-database/auth/same-origin helpers (never a parallel
 * reimplementation): `assertDisposableE2eDatabase` still gates every write,
 * `sameOriginHeaders` still supplies the Origin header the app's `checkCsrf`
 * / `getTrustedApplicationOrigin` checks require.
 *
 * All synthetic rows created by this scenario are tracked by id (never a
 * broad namespace query) so `cleanupGoldenFamily` can remove exactly what
 * the run created and nothing else, in FK-safe order, regardless of a given
 * row's cascade configuration.
 */

const databaseUrl =
  process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '';
assertDisposableE2eDatabase(databaseUrl);

export const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

export const BASE_URL = process.env.BASE_URL || 'http://localhost:3002';

/** Standard headers for a same-origin mutating `page.request` call. */
export function mutationHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return { 'Content-Type': 'application/json', ...sameOriginHeaders(BASE_URL), ...extra };
}

/** Bag of every id this scenario has created, populated incrementally so a
 * mid-run failure can still be cleaned up with whatever was captured. */
export interface GoldenFamilyIds {
  parent1UserId?: string;
  parent2UserId?: string;
  childAStudentId?: string;
  childAUserId?: string;
  childBStudentId?: string;
  childBUserId?: string;
  child2StudentId?: string;
  child2UserId?: string;
  coach1UserId?: string;
  coach1ProfileId?: string;
  coach2UserId?: string;
  coach2ProfileId?: string;
  assignmentAId?: string;
  assignmentBId?: string;
  seriesAId?: string;
  seriesBId?: string;
  idempotencyOwners?: string[]; // userIds whose idempotency keys must be purged
}

function compact<T>(values: readonly (T | undefined)[]): T[] {
  return values.filter((value): value is T => value !== undefined);
}

/** Direct-DB fixture: a synthetic coach, ready to log in (never the subject
 * under test — coach account creation/activation belongs to other tasks). */
export async function createSyntheticCoach(input: {
  emailPrefix: string;
  pseudonym: string;
  password: string;
  subjects: string[];
}): Promise<{ userId: string; coachProfileId: string; email: string }> {
  const email = `${input.emailPrefix}@e2e-golden-family.test.local`;
  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await prisma.user.create({
    data: {
      email,
      role: 'COACH',
      firstName: input.pseudonym,
      lastName: 'GoldenCoach',
      password: passwordHash,
      activatedAt: new Date(),
      coachProfile: {
        create: {
          pseudonym: input.pseudonym,
          subjects: input.subjects,
          availableOnline: true,
          availableInPerson: true,
        },
      },
    },
    include: { coachProfile: true },
  });
  return { userId: user.id, coachProfileId: user.coachProfile!.id, email };
}

/** FK-safe, explicit cleanup — never relies on cascade configuration. */
export async function cleanupGoldenFamily(ids: GoldenFamilyIds): Promise<void> {
  const studentIds = compact([ids.childAStudentId, ids.childBStudentId, ids.child2StudentId]);
  const childUserIds = compact([ids.childAUserId, ids.childBUserId, ids.child2UserId]);
  const coachUserIds = compact([ids.coach1UserId, ids.coach2UserId]);
  const parentUserIds = compact([ids.parent1UserId, ids.parent2UserId]);
  const assignmentIds = compact([ids.assignmentAId, ids.assignmentBId]);
  const seriesIds = compact([ids.seriesAId, ids.seriesBId]);

  if (studentIds.length > 0 || coachUserIds.length > 0) {
    await prisma.sessionBooking.deleteMany({
      where: {
        OR: [
          ...(studentIds.length ? [{ studentProfileId: { in: studentIds } }] : []),
          ...(coachUserIds.length ? [{ coachId: { in: coachUserIds } }] : []),
        ],
      },
    });
  }
  if (seriesIds.length > 0) {
    await prisma.planningSeries.deleteMany({ where: { id: { in: seriesIds } } });
  }
  if (assignmentIds.length > 0) {
    await prisma.coachStudentAssignment.deleteMany({ where: { id: { in: assignmentIds } } });
  }
  if (studentIds.length > 0) {
    await prisma.studentAcademicEnrollment.deleteMany({ where: { studentId: { in: studentIds } } });
  }
  if (parentUserIds.length > 0 || studentIds.length > 0) {
    await prisma.parentStudentLink.deleteMany({
      where: {
        OR: [
          ...(parentUserIds.length ? [{ parentUserId: { in: parentUserIds } }] : []),
          ...(studentIds.length ? [{ studentId: { in: studentIds } }] : []),
        ],
      },
    });
  }
  if (ids.idempotencyOwners && ids.idempotencyOwners.length > 0) {
    await prisma.canonicalApiIdempotencyKey.deleteMany({
      where: { userId: { in: ids.idempotencyOwners } },
    });
  }
  if (parentUserIds.length > 0) {
    // Parent-phone challenges (issue/consume flow, lib/auth/parent-phone.ts)
    // reference the parent User row directly — must go before the User delete.
    await prisma.parentPhoneChallenge.deleteMany({ where: { userId: { in: parentUserIds } } });
  }
  if (studentIds.length > 0) {
    await prisma.student.deleteMany({ where: { id: { in: studentIds } } });
  }
  if (parentUserIds.length > 0) {
    await prisma.parentProfile.deleteMany({ where: { userId: { in: parentUserIds } } });
  }
  if (coachUserIds.length > 0) {
    await prisma.coachProfile.deleteMany({ where: { userId: { in: coachUserIds } } });
  }
  const allUserIds = [...childUserIds, ...parentUserIds, ...coachUserIds];
  if (allUserIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: allUserIds } } });
  }
}

/** Poll /api/auth/session until it belongs to the expected user id — the
 * phone-login parent has no `email` to key on (`User.email` stays null for a
 * WhatsApp-only account), unlike the email/password roles `waitForAuthenticatedSession`
 * (helpers/auth.ts) already covers. */
export async function waitForSessionUserId(page: Page, expectedUserId: string, attempts = 20): Promise<void> {
  for (let i = 0; i < attempts; i += 1) {
    const res = await page.request.get(`${BASE_URL}/api/auth/session`, {
      timeout: 10_000,
      failOnStatusCode: false,
    });
    if (res.ok()) {
      try {
        const session = (await res.json()) as { user?: { id?: string } };
        if (session?.user?.id === expectedUserId) return;
      } catch {
        // retry
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`GOLDEN_FAMILY_SESSION_NOT_ESTABLISHED:${expectedUserId}`);
}

/**
 * Real UI credentials sign-in for a synthetic identity not present in
 * `e2e/.credentials.json` (`e2e/helpers/credentials.ts` — CREDS covers only
 * the fixed seed roles). Same production form other specs already drive
 * (e.g. `e2e/auth/parent-email-onboarding.spec.ts`'s local `signIn()`).
 */
export async function signInAs(page: Page, identifier: string, password: string, expectedUserId: string): Promise<void> {
  await resetDisposableE2ERateLimits();
  await resetBrowserSession(page);
  await page.goto('/auth/signin', { waitUntil: 'domcontentloaded' });
  await page.getByRole('textbox', { name: 'Téléphone WhatsApp ou email', exact: true }).fill(identifier);
  await page.getByLabel(/^mot de passe$/i).fill(password);
  await page.getByRole('button', { name: /accéder à mon espace/i }).click();
  // SignInForm.tsx calls `signIn(..., { redirect: false })` then does its own
  // client-side `router.push(...)` to the role's default dashboard. Without
  // waiting for THAT navigation to actually land, a caller's next `page.goto`
  // races it — harmless on Chromium but a real "navigation interrupted by
  // another navigation" / NS_BINDING_ABORTED on Firefox/WebKit, which are
  // stricter about in-flight navigations. Wait it out here, once, so every
  // caller's subsequent `page.goto` is race-free on every engine.
  try {
    await page.waitForURL((url) => url.pathname !== '/auth/signin', { timeout: 15_000 });
  } catch (cause) {
    // Say WHY the form did not leave /auth/signin: a rejected credential (rate
    // limit, inactive account) renders role="alert"; a silent stall does not.
    const alert = await page.getByRole('alert').allInnerTexts().catch(() => [] as string[]);
    const sessionProbe = await page.request.get(`${BASE_URL}/api/auth/session`, { failOnStatusCode: false }).then(async (r) => `${r.status()} ${(await r.text()).slice(0, 200)}`).catch((e: unknown) => `probe failed: ${String(e)}`);
    throw new Error(
      `GOLDEN_FAMILY_SIGNIN_STALLED url=${page.url()} alert=${JSON.stringify(alert)} session=${JSON.stringify(sessionProbe)} cause=${cause instanceof Error ? cause.message.split('\n')[0] : String(cause)}`,
    );
  }
  await page.waitForLoadState('domcontentloaded');
  await waitForSessionUserId(page, expectedUserId);
}

/**
 * WebKit is occasionally stricter about a `page.goto` fired right after
 * `clearCookies()`/a prior navigation than Chromium/Firefox, and aborts with
 * "Frame load interrupted" / `NS_BINDING_ABORTED` even though the target URL
 * is otherwise fine — a real, observed cross-engine flake in this scenario's
 * many role-switch navigations, not a product bug. One retry absorbs it
 * without weakening what's actually asserted after the navigation.
 */
export async function gotoStable(page: Page, url: string): Promise<void> {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
  } catch {
    await page.waitForTimeout(300);
    await page.goto(url, { waitUntil: 'domcontentloaded' });
  }
}

export async function disconnectGoldenFamilyPrisma(): Promise<void> {
  await prisma.$disconnect();
}
