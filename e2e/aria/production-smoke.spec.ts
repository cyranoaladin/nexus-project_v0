import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import manifest from '../../data/aria/testing/rag/debbfb31c0a95e3e16ff33772f0626856e8dc01c52faab8270820b7f4374608a.json';
import { ARIA_E2E_SCENARIOS } from '../../scripts/e2e/aria-scenarios';
import {
  disconnectPrisma,
  getAriaConversationCounts,
  getAriaTurnByClientRequestId,
  resetAriaE2eConversations,
  waitForAriaTurnTerminal,
} from '../helpers/db';
import { loginAsUser } from '../helpers/auth';
import {
  captureBrowserFailures,
  chooseCourse,
  completeConversation,
  conversationMessages,
  fixtureState,
  loginAndOpenAria,
  postConversation,
  resetFixture,
  sendFromComposer,
} from './helpers';

const nsiCorpus = manifest.corpora.find(({ corpus_id }) => corpus_id === 'aria-nsi-premiere')!;
const nsiResource = nsiCorpus.resources[0]!;

test.describe.serial('ARIA-B production standalone qualification smoke', () => {
  test.afterAll(async () => disconnectPrisma());

  test.beforeEach(async ({ request, page }) => {
    await resetAriaE2eConversations();
    await resetFixture(request);
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('S001 production artifact serves the single authenticated chat transport', async ({ page }) => {
    await loginAndOpenAria(page, 'ariaNsi');
    await chooseCourse(page, 'eds-nsi-premiere');
    await sendFromComposer(page, 'Smoke conversation depuis le build standalone.');
    await expect(page.getByText(/Une pile fonctionne/)).toBeVisible();
    await expect(page.getByRole('status')).toHaveText('Réponse ARIA terminée.');
    expect(await fixtureState(page.request)).toMatchObject({ modelInvocations: 1, ragInvocations: 1 });
  });

  test('S002 curriculum and selector are derived from the academic capability overlay', async ({ page }) => {
    await loginAsUser(page, 'ariaTerminaleMaths');
    const curriculum = await page.request.get('/api/aria/curriculum');
    expect(curriculum.status()).toBe(200);
    const body = await curriculum.json() as {
      courses: Array<{
        courseKey: string;
        capabilities: { hasChat: boolean };
        access: { status: string };
      }>;
    };
    const academicCourseKeys = body.courses.map(({ courseKey }) => courseKey);
    expect(academicCourseKeys).toEqual(expect.arrayContaining([
      'tc-philosophie-terminale', 'eds-maths-terminale', 'eds-nsi-terminale',
    ]));
    expect(new Set(academicCourseKeys).size).toBe(academicCourseKeys.length);
    await page.goto('/dashboard/eleve', { waitUntil: 'domcontentloaded' });
    await page.getByTestId('aria-chat-trigger').click();
    const courseKeys = await page.getByLabel('Cours ARIA').locator('option').evaluateAll((options) =>
      options.map((option) => (option as HTMLOptionElement).value).filter(Boolean));
    expect(courseKeys).toEqual(academicCourseKeys);
    const enabledCourseKeys = await page.getByLabel('Cours ARIA').locator('option:enabled').evaluateAll((options) =>
      options.map((option) => (option as HTMLOptionElement).value).filter(Boolean));
    expect(enabledCourseKeys).toEqual(body.courses
      .filter(({ capabilities, access }) => capabilities.hasChat && access.status === 'AVAILABLE')
      .map(({ courseKey }) => courseKey));
  });

  test('S003 actor subject and entitlement boundaries fail closed on client identity injection', async ({ page }) => {
    await loginAsUser(page, 'ariaNsi');
    const response = await page.request.post('/api/aria/chat', {
      data: {
        clientRequestId: randomUUID(),
        courseKey: 'eds-nsi-premiere',
        content: 'Tentative de cible forgée',
        studentId: 'forged-student-id',
      },
      headers: { accept: 'application/json' },
      failOnStatusCode: false,
    });
    expect(response.status()).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: 'BAD_REQUEST' } });
    expect(await fixtureState(page.request)).toMatchObject({ modelInvocations: 0, ragInvocations: 0 });
  });

  test('S004 citation preserves ResourceVersion, corpus and manifest identities', async ({ page }) => {
    await loginAsUser(page, 'ariaNsi');
    const result = await completeConversation(page, {
      courseKey: 'eds-nsi-premiere',
      content: 'Question factuelle avec source immuable.',
      resourceId: nsiResource.resource_id,
    });
    const { body } = await conversationMessages(page, result.conversation.id);
    expect(body.messages?.find(({ role }) => role === 'assistant')?.citations[0]).toMatchObject({
      resourceId: nsiResource.resource_id,
      resourceVersionId: nsiResource.resource_version_id,
      contentSha256: nsiResource.content_sha256,
      corpusId: nsiCorpus.corpus_id,
      corpusVersionId: nsiCorpus.corpus_version_id,
      manifestSha256: manifest.manifest_sha256,
    });
  });

  test('S005 Turn reservation and terminal state own one user and assistant message pair', async ({ page }) => {
    await loginAsUser(page, 'ariaNsi');
    const clientRequestId = randomUUID();
    const result = await completeConversation(page, {
      courseKey: 'eds-nsi-premiere',
      content: 'Vérifie le lifecycle persistant.',
      clientRequestId,
    });
    const turn = await getAriaTurnByClientRequestId(clientRequestId);
    expect(turn.status).toBe('COMPLETED');
    expect(turn.messages.map(({ turnRole, status }) => ({ turnRole, status }))).toEqual([
      { turnRole: 'USER', status: 'COMPLETED' },
      { turnRole: 'ASSISTANT', status: 'COMPLETED' },
    ]);
    expect(await getAriaConversationCounts(result.conversation.id)).toEqual({ turns: 1, messages: 2 });
  });

  test('S006 timeout is observable, terminal and retains retrieval provenance', async ({ page }) => {
    await loginAsUser(page, 'ariaNsi');
    const clientRequestId = randomUUID();
    const { response } = await postConversation(page, {
      courseKey: 'eds-nsi-premiere',
      content: ARIA_E2E_SCENARIOS.modelTimeout,
      clientRequestId,
    });
    expect(response.status()).toBe(503);
    expect(await response.json()).toMatchObject({ error: { code: 'MODEL_UNAVAILABLE', retryable: true } });
    const turn = await waitForAriaTurnTerminal(clientRequestId);
    expect(turn).toMatchObject({
      status: 'ERROR',
      ragStatus: 'SUCCESS',
      executionMetadata: { failureCode: 'MODEL_TIMEOUT' },
      retrievalEvidence: { manifestSha256: manifest.manifest_sha256 },
    });
  });

  test('S007 history pagination is bounded and returns the newest message page chronologically', async ({ page }) => {
    await loginAsUser(page, 'ariaNsi');
    const first = await completeConversation(page, {
      courseKey: 'eds-nsi-premiere', content: 'Première question smoke.',
    });
    await completeConversation(page, {
      courseKey: 'eds-nsi-premiere', conversationId: first.conversation.id,
      content: 'Deuxième question smoke.',
    });
    const response = await page.request.get(`/api/aria/conversations/${first.conversation.id}/messages?limit=2`);
    expect(response.status()).toBe(200);
    const body = await response.json() as { messages: Array<{ role: string; content: string }>; nextCursor: string | null };
    expect(body.messages).toHaveLength(2);
    expect(body.messages.map(({ role }) => role)).toEqual(['user', 'assistant']);
    expect(body.messages[0]?.content).toBe('Deuxième question smoke.');
    expect(body.nextCursor).toEqual(expect.any(String));
  });

  test('S008 public errors redact attacker-controlled paths, accounts and secret fragments', async ({ page }) => {
    await loginAsUser(page, 'ariaNsi');
    const response = await page.request.post('/api/aria/chat', {
      data: {
        clientRequestId: randomUUID(),
        courseKey: 'eds-nsi-premiere',
        content: 'Erreur publique sûre',
        unknownField: '/srv/private account@example.test sk-secret-fragment',
      },
      headers: { accept: 'application/json' },
      failOnStatusCode: false,
    });
    const body = await response.text();
    expect(response.status()).toBe(400);
    expect(body).toContain('BAD_REQUEST');
    expect(body).not.toMatch(/\/srv\/private|example\.test|sk-secret/i);
  });

  test('S009 profile and feedback persist through their canonical application APIs', async ({ page }) => {
    await loginAsUser(page, 'ariaNsi');
    const preferences = {
      version: 1,
      pinnedCourseKeys: ['eds-nsi-premiere'],
      focusedCourseKey: 'eds-nsi-premiere',
      courseOrder: ['eds-nsi-premiere'],
      showCitations: true,
    };
    const profileWrite = await page.request.put('/api/aria/profile', { data: preferences });
    expect(profileWrite.status()).toBe(200);
    const profileRead = await page.request.get('/api/aria/profile');
    expect(await profileRead.json()).toMatchObject({ profile: { preferences } });

    const result = await completeConversation(page, {
      courseKey: 'eds-nsi-premiere', content: 'Réponse à noter dans le smoke.',
    });
    const feedback = await page.request.post('/api/aria/feedback', {
      data: { messageId: result.message.id, useful: true },
    });
    expect(feedback.status()).toBe(200);
    expect(await feedback.json()).toMatchObject({ success: true, feedback: { useful: true } });
    const { body } = await conversationMessages(page, result.conversation.id);
    expect(body.messages?.find(({ messageId }) => messageId === result.message.id)?.feedback).toBe(true);
  });

  test('S010 production UI passes four viewport overflow checks, axe and browser diagnostics', async ({ page }) => {
    await loginAndOpenAria(page, 'ariaNsi');
    await chooseCourse(page, 'eds-nsi-premiere');
    await page.waitForLoadState('networkidle');
    const failures = captureBrowserFailures(page);
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
      { width: 1366, height: 768 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      const metrics = await page.evaluate(() => ({
        viewportWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        composerBottom: document.querySelector('textarea[aria-label="Message à ARIA"]')
          ?.getBoundingClientRect().bottom ?? Number.POSITIVE_INFINITY,
        viewportHeight: document.documentElement.clientHeight,
      }));
      expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.viewportWidth);
      expect(metrics.composerBottom).toBeLessThanOrEqual(metrics.viewportHeight + 1);
      await expect(page.getByLabel('Message à ARIA')).toBeInViewport();
    }
    const a11y = await new AxeBuilder({ page }).analyze();
    expect(a11y.violations.filter(({ impact }) => impact === 'serious' || impact === 'critical')).toEqual([]);
    expect(failures).toEqual([]);
  });
});
