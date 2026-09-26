import { expect, test } from '@playwright/test';
import { loginAsUser } from '../helpers/auth';
import { resetCoreV2AriaFoundationProfile } from '../helpers/core-v2-aria-foundation';
import { fixtureState, resetFixture } from '../aria/helpers';
import { PrismaClient as LegacyPrismaClient } from '@prisma/client';
import { PrismaClient as CoreV2PrismaClient } from '../../core-v2/generated/client';
import { assertDisposableE2eDatabase } from '../helpers/disposable-database';
import { assertCoreV2E2eSeedTarget } from '../../scripts/core-v2/e2e-seed-target';
import { CORE_V2_ARIA_FOUNDATION_EMAIL } from '../../scripts/core-v2/aria-foundation-e2e-persona';
import { ARIA_E2E_SCENARIOS } from '../../scripts/e2e/aria-scenarios';
import { sameOriginHeaders } from '../helpers/same-origin';

const CORE_V2_STUDENT = 'coreV2AriaFoundation' as const;
const PINNED_COURSE_KEY = 'maths-terminale-eds';
const UNAVAILABLE_COPY = 'Fonction non encore disponible pour ce profil';

const FORBIDDEN_CORE_V2_LEGACY_ARIA_PATH = /^\/api\/aria(?:\/|$)/;

function pathname(rawUrl: string): string {
  return new URL(rawUrl).pathname;
}

test.describe('Core v2 ARIA foundation', () => {
  test('has a Core v2 student, enrollment, and chat grant with no V1 User or Student', async () => {
    assertDisposableE2eDatabase(process.env.DATABASE_URL ?? '');
    assertCoreV2E2eSeedTarget(process.env);
    const legacy = new LegacyPrismaClient();
    const core = new CoreV2PrismaClient({ datasources: { db: { url: process.env.CORE_V2_DATABASE_URL } } });
    try {
      expect(await legacy.user.findUnique({ where: { email: CORE_V2_ARIA_FOUNDATION_EMAIL } })).toBeNull();
      const identity = await core.user.findUnique({
        where: { email: CORE_V2_ARIA_FOUNDATION_EMAIL },
        include: { student: { include: { academicYearEnrollments: true, ariaAccessGrants: true } } },
      });
      expect(identity?.role).toBe('ELEVE');
      expect(identity?.student?.academicYearEnrollments.some(({ status }) => status === 'ACTIVE')).toBe(true);
      expect(identity?.student?.ariaAccessGrants).toContainEqual(expect.objectContaining({
        status: 'ACTIVE', ariaTier: 'ARIA_ACCOMPAGNEE', featureKey: 'aria_maths',
      }));
    } finally {
      await Promise.all([legacy.$disconnect(), core.$disconnect()]);
    }
  });

  test('uses only the native foundation, persists onboarding, and exposes no legacy ARIA runtime', async ({ page }) => {
    await resetCoreV2AriaFoundationProfile();
    const requestedPaths: string[] = [];
    let rejectLegacyRequest!: (error: Error) => void;
    const legacyRequestBarrier = new Promise<never>((_resolve, reject) => {
      rejectLegacyRequest = reject;
    });
    await page.route('**/api/aria/**', async (route) => {
      const legacyPath = pathname(route.request().url());
      requestedPaths.push(legacyPath);
      await route.abort('blockedbyclient');
      rejectLegacyRequest(new Error(`CORE_V2_LEGACY_ARIA_REQUEST_BLOCKED:${legacyPath}`));
    });
    page.on('request', (request) => requestedPaths.push(pathname(request.url())));

    await Promise.race([
      legacyRequestBarrier,
      (async () => {
        await loginAsUser(page, CORE_V2_STUDENT, { navigate: false });
        const sessionResponse = await page.request.get('/api/auth/session');
        expect(sessionResponse.status()).toBe(200);
        const session = (await sessionResponse.json()) as {
          user?: { role?: string; authority?: string };
        };
        expect(session.user).toMatchObject({ role: 'ELEVE', authority: 'CORE_V2' });

        await page.goto('/dashboard/eleve/aria', { waitUntil: 'domcontentloaded' });
        await expect(page.getByTestId('aria-setup-wizard')).toBeVisible();
        await expect(page.getByText('TERMINALE', { exact: true })).toBeVisible();
        await expect(page.getByText('EDS_GENERALE', { exact: true })).toBeVisible();
        await expect(page.getByText('MATHEMATIQUES', { exact: true })).toBeVisible();
        await expect(page.getByText('Lycée Pierre-Mendès-France', { exact: true })).toBeVisible();

        await page.getByTestId('aria-wizard-next').click();
        await expect(page.getByText('Mathématiques expertes — Terminale', { exact: true })).toBeVisible();
        await page.getByTestId('aria-wizard-next').click();
        const permittedCourse = page.getByTestId(`aria-wizard-course-${PINNED_COURSE_KEY}`);
        const scopedOutOption = page.getByTestId('aria-wizard-course-maths-expertes-terminale');
        await expect(permittedCourse).toBeEnabled();
        await expect(scopedOutOption).toBeVisible();
        await expect(scopedOutOption).toBeDisabled();
        await permittedCourse.click();
        await page.getByTestId('aria-wizard-next').click();
        await page.getByTestId('aria-wizard-next').click();
        await page.getByTestId('aria-wizard-submit').click();

        await expect(page.getByRole('heading', { name: 'Cockpit ARIA' })).toBeVisible();
        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(page.getByRole('heading', { name: 'Cockpit ARIA' })).toBeVisible();
        await page.getByTestId('aria-nav-CURRICULUM').click();
        await expect(page.getByTestId(`aria-course-card-${PINNED_COURSE_KEY}`)).toHaveClass(/border-brand-accent\/50/);
        await expect(
          page.getByTestId(`aria-course-card-${PINNED_COURSE_KEY}`).getByRole('button', { name: 'Ouvrir' }),
        ).toHaveCount(0);
        const scopedOutOptionCard = page.getByTestId('aria-course-card-maths-expertes-terminale');
        await expect(scopedOutOptionCard).toBeVisible();
        await expect(scopedOutOptionCard.getByText('Non inclus dans l’abonnement')).toBeVisible();
        await expect(scopedOutOptionCard.getByRole('button', { name: 'Ouvrir' })).toHaveCount(0);

        for (const panel of ['TODAY', 'TRAJECTORY', 'RESOURCES', 'ASSESSMENTS'] as const) {
          await page.getByTestId(`aria-nav-${panel}`).click();
          await expect(page.getByText(UNAVAILABLE_COPY).first()).toBeVisible();
        }
        await resetFixture(page.request);
        await page.getByTestId('aria-nav-ARIA').click();
        await expect(page.getByText('Démarrer une conversation')).toBeVisible();
        await page.getByRole('button', { name: 'Maths', exact: true }).click();
        await expect(page.getByRole('dialog', { name: 'Assistant pédagogique ARIA' })).toBeVisible();
        await page.getByLabel('Cours ARIA').selectOption(PINNED_COURSE_KEY);
        await expect(page.getByLabel('Cours ARIA')).toHaveValue(PINNED_COURSE_KEY);
        await page.getByLabel('Message à ARIA').fill('Explique le lien entre le signe de la dérivée et les variations.');
        const sendResponse = page.waitForResponse((response) =>
          new URL(response.url()).pathname === '/api/v2/aria/chat' && response.request().method() === 'POST');
        await page.getByRole('button', { name: 'Envoyer à ARIA' }).click();
        const sent = await sendResponse;
        expect(sent.status()).toBe(200);
        await expect(page.getByRole('main', { name: 'Conversation ARIA' }))
          .toContainText('Une dérivée positive sur un intervalle signifie que la fonction y est croissante.');
        await expect.poll(async () => (await fixtureState(page.request)).modelInvocations).toBe(1);
        await page.getByRole('button', { name: 'Réponse utile' }).click();
        await expect(page.getByRole('button', { name: 'Réponse utile' })).toHaveAttribute('aria-pressed', 'true');

        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(page.getByRole('heading', { name: 'Cockpit ARIA' })).toBeVisible();
        await page.getByTestId('aria-chat-trigger').click();
        await expect(page.getByRole('dialog', { name: 'Assistant pédagogique ARIA' })).toBeVisible();
        await expect(page.getByLabel('Cours ARIA')).toHaveValue(PINNED_COURSE_KEY);
        await expect(page.getByRole('main', { name: 'Conversation ARIA' }))
          .toContainText('Une dérivée positive sur un intervalle signifie que la fonction y est croissante.');
        await expect(page.getByRole('button', { name: 'Réponse utile' })).toHaveAttribute('aria-pressed', 'true');
        await expect.poll(async () => (await fixtureState(page.request)).modelInvocations).toBe(1);
        await page.waitForLoadState('networkidle');
      })(),
    ]);

    expect(requestedPaths).toContain('/api/v2/aria/cockpit');
    expect(requestedPaths).toContain('/api/v2/aria/cockpit/profile');
    expect(requestedPaths).not.toContain('/api/aria/cockpit');
    expect(requestedPaths).not.toContain('/api/aria/cockpit/profile');
    expect(requestedPaths.filter((path) => path.startsWith('/api/aria/'))).toEqual([]);
    expect(requestedPaths.filter((path) => FORBIDDEN_CORE_V2_LEGACY_ARIA_PATH.test(path))).toEqual([]);
  });

  test('reload reconnects one RUNNING Core v2 Turn and Stop persists CANCELLED without a second provider call', async ({ page }) => {
    await resetCoreV2AriaFoundationProfile();
    await resetFixture(page.request);
    await loginAsUser(page, CORE_V2_STUDENT, { navigate: false });
    const setup = await page.request.put('/api/v2/aria/cockpit/profile', {
      headers: sameOriginHeaders(),
      data: {
        pinnedCourseKeys: [PINNED_COURSE_KEY],
        weeklyGoalMinutes: 180,
        learningGoals: ['ENTRAINEMENT_REGULIER'],
        completeOnboarding: true,
      },
    });
    expect(setup.status(), await setup.text()).toBe(200);

    await page.goto('/dashboard/eleve/aria', { waitUntil: 'domcontentloaded' });
    await page.getByTestId('aria-chat-trigger').click();
    await expect(page.getByRole('dialog', { name: 'Assistant pédagogique ARIA' })).toBeVisible();
    await page.getByLabel('Cours ARIA').selectOption(PINNED_COURSE_KEY);
    await page.getByLabel('Message à ARIA').fill(ARIA_E2E_SCENARIOS.cancelAfterFirstDelta);
    await page.getByRole('button', { name: 'Envoyer à ARIA' }).click();
    await expect.poll(async () => fixtureState(page.request)).toMatchObject({
      modelInvocations: 1, activeModelStreams: 1,
    });

    const latest = await page.request.get(`/api/v2/aria/conversations?courseKey=${PINNED_COURSE_KEY}&limit=1`);
    expect(latest.status()).toBe(200);
    const conversationId = ((await latest.json()) as { data: { items: Array<{ id: string }> } }).data.items[0]?.id;
    expect(conversationId).toBeTruthy();
    const historyUrl = `/api/v2/aria/conversations/${conversationId}/messages`;
    const readHistory = async () => {
      const response = await page.request.get(historyUrl);
      expect(response.status()).toBe(200);
      return (await response.json()) as { data: {
        conversation: { activeTurn: { turnId: string; clientRequestId: string; status: string } | null };
        messages: Array<{ role: string; turnId: string; status: string }>;
      } };
    };
    const running = (await readHistory()).data;
    expect(running.conversation.activeTurn?.status).toBe('RUNNING');
    const active = running.conversation.activeTurn!;
    expect(running.messages.filter(({ turnId }) => turnId === active.turnId)
      .map(({ role, status }) => [role, status])).toEqual([
      ['USER', 'COMPLETED'], ['ASSISTANT', 'STREAMING'],
    ]);
    const resumedRequestIds: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname !== '/api/v2/aria/chat' || request.method() !== 'POST') return;
      const body = request.postDataJSON() as { clientRequestId?: string };
      if (body.clientRequestId) resumedRequestIds.push(body.clientRequestId);
    });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByTestId('aria-chat-trigger').click();
    await expect(page.getByLabel('Cours ARIA')).toHaveValue(PINNED_COURSE_KEY);
    await expect(page.getByRole('button', { name: 'Arrêter la réponse ARIA' })).toBeVisible();
    await expect.poll(() => resumedRequestIds.length).toBeGreaterThan(0);
    expect(resumedRequestIds.every((id) => id === active.clientRequestId)).toBe(true);
    expect((await readHistory()).data.conversation.activeTurn).toMatchObject({
      turnId: active.turnId, clientRequestId: active.clientRequestId, status: 'RUNNING',
    });
    expect(await fixtureState(page.request)).toMatchObject({ modelInvocations: 1 });

    const cancelResponse = page.waitForResponse((response) =>
      new URL(response.url()).pathname === `/api/v2/aria/turns/${active.turnId}/cancel`);
    await page.getByRole('button', { name: 'Arrêter la réponse ARIA' }).click();
    expect((await cancelResponse).status()).toBe(202);
    const core = new CoreV2PrismaClient({ datasources: { db: { url: process.env.CORE_V2_DATABASE_URL } } });
    try {
      await expect.poll(async () => (await core.ariaConversationTurnCoreV2.findUnique({
        where: { id: active.turnId }, select: { cancellationRequestedAt: true },
      }))?.cancellationRequestedAt).toBeTruthy();
      await expect.poll(async () => (await readHistory()).data.messages.find(({ turnId, role }) => (
        turnId === active.turnId && role === 'ASSISTANT'))?.status,
        { timeout: 20_000 })
        .toBe('CANCELLED');
      const finalHistory = (await readHistory()).data;
      expect(finalHistory.conversation.activeTurn).toBeNull();
      expect(await core.ariaConversationTurnCoreV2.count({ where: {
        conversationId: conversationId!, clientRequestId: active.clientRequestId,
      } })).toBe(1);
      expect(finalHistory.messages.find(({ turnId, role }) => (
        turnId === active.turnId && role === 'ASSISTANT'))?.status).toBe('CANCELLED');
    } finally {
      await core.$disconnect();
    }
    await expect(page.getByRole('status')).toHaveText('Réponse ARIA arrêtée.', { timeout: 20_000 });
    expect(await fixtureState(page.request)).toMatchObject({ modelInvocations: 1, activeModelStreams: 0 });
  });

  test('keeps the V1 launcher and conversation surface available', async ({ page }) => {
    await loginAsUser(page, 'ariaTerminaleMaths', { navigate: false });

    const profileResponse = await page.request.put('/api/aria/cockpit/profile', {
      data: {
        pinnedCourseKeys: ['maths-terminale-eds'],
        weeklyGoalMinutes: 180,
        learningGoals: ['ENTRAINEMENT_REGULIER'],
        completeOnboarding: true,
      },
    });
    expect(profileResponse.status()).toBe(200);
    expect(await profileResponse.json()).toMatchObject({ setupState: 'READY' });

    await page.goto('/dashboard/eleve/aria', { waitUntil: 'domcontentloaded' });

    const trigger = page.getByTestId('aria-chat-trigger');
    await expect(trigger).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Cockpit ARIA' })).toBeVisible();

    await page.getByTestId('aria-nav-CURRICULUM').click();
    await page.getByRole('button', { name: 'Ouvrir' }).first().click();
    const courseMapButtons = page.getByRole('button', { name: 'Ma carte scolaire' });
    await expect(courseMapButtons).toHaveCount(2);
    await expect(courseMapButtons.nth(1)).toBeVisible();

    await page.getByTestId('aria-nav-ARIA').click();
    await trigger.click();
    await expect(page.getByRole('main', { name: 'Conversation ARIA' })).toBeVisible();
  });
});
