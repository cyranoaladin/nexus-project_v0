import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import resourceRegistry from '../../data/aria/resources.v1.json';
import manifest from '../../data/aria/testing/rag/debbfb31c0a95e3e16ff33772f0626856e8dc01c52faab8270820b7f4374608a.json';
import { ARIA_E2E_SCENARIOS } from '../../scripts/e2e/aria-scenarios';
import {
  disconnectPrisma,
  getAriaConversationCounts,
  getOnlyAriaTurnClientRequestId,
  resetAriaE2eConversations,
  waitForAriaTurnTerminal,
} from '../helpers/db';
import { loginAsUser, logoutUser } from '../helpers/auth';
import {
  captureBrowserFailures,
  chooseCourse,
  completeConversation,
  conversationMessages,
  fixtureState,
  latestConversationId,
  loginAndOpenAria,
  postConversation,
  resetFixture,
  sendFromComposer,
} from './helpers';

const nsiPremiereCorpus = manifest.corpora.find(({ corpus_id }) => corpus_id === 'aria-nsi-premiere')!;
const nsiPremiereResource = nsiPremiereCorpus.resources[0]!;
const nsiPremiereChunk = nsiPremiereResource.chunks[0]!;
const canonicalNsiPremiereResource = resourceRegistry.resources.find(
  ({ resourceId }) => resourceId === nsiPremiereResource.resource_id,
)!;
const nsiPremiereLocator = Object.fromEntries(
  Object.entries(nsiPremiereChunk.locator).filter((entry): entry is [string, string | number] =>
    typeof entry[1] === 'string' || typeof entry[1] === 'number'),
);

test.describe.serial('ARIA-B real disposable conversation foundation', () => {
  test.afterAll(async () => disconnectPrisma());

  test.beforeEach(async ({ request, page }) => {
    await resetAriaE2eConversations();
    await resetFixture(request);
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('E001 E2E_ARIA_COMPLETE_CONVERSATION_FLOW — Terminale Maths login to grounded completion', async ({ page }) => {
    await loginAndOpenAria(page, 'ariaTerminaleMaths');
    await chooseCourse(page, 'eds-maths-terminale');
    await sendFromComposer(page, 'Explique le lien entre le signe de la dérivée et les variations.');

    await expect(page.getByText(/Une dérivée positive.*fonction.*croissante/)).toBeVisible();
    await expect(page.getByText('1 source')).toBeVisible();
    expect(await fixtureState(page.request)).toMatchObject({ modelInvocations: 1, ragInvocations: 1 });
  });

  test('E002 Première Maths without an active corpus fails closed before model invocation', async ({ page }) => {
    await loginAndOpenAria(page, 'ariaPremiereMaths');
    await chooseCourse(page, 'eds-maths-premiere');
    await sendFromComposer(page, 'Explique les variations d’une fonction en Première.');
    await expect(page.getByRole('dialog').getByRole('alert'))
      .toHaveText('Les sources pédagogiques sont temporairement indisponibles.');
    expect(await fixtureState(page.request)).toMatchObject({
      modelInvocations: 0,
      ragInvocations: 0,
    });
  });

  test('E003 NSI keeps the exact course context', async ({ page }) => {
    await loginAndOpenAria(page, 'ariaNsi');
    await chooseCourse(page, 'eds-nsi-premiere');
    await sendFromComposer(page, 'Explique une pile en NSI.');
    await expect(page.getByText(/premier sorti/)).toBeVisible();
    const conversationId = await latestConversationId(page, 'eds-nsi-premiere');
    const history = await page.request.get(`/api/aria/conversations?courseKey=eds-nsi-premiere&limit=1`);
    expect(await history.json()).toMatchObject({ conversations: [{ id: conversationId, courseKey: 'eds-nsi-premiere' }] });
  });

  test('E004 THREAD_NO_CHAT_REACHES_MODEL — STMG no-chat never invokes the model or approximates SES', async ({ page }) => {
    await loginAndOpenAria(page, 'ariaStmgNoChat');
    await expect(page.getByRole('main', { name: 'Conversation ARIA' })
      .getByText('Aucun cours ARIA avec chat n’est disponible.')).toBeVisible();
    await expect(page.getByRole('option', { name: /Sciences de gestion.*chat indisponible/i })).toBeDisabled();
    await expect(page.getByRole('dialog')).not.toContainText('SES');
    expect(await fixtureState(page.request)).toMatchObject({ modelInvocations: 0, ragInvocations: 0 });
  });

  test('E005 incomplete profile exposes setup state without inventing a course', async ({ page }) => {
    await loginAndOpenAria(page, 'ariaIncompleteProfile');
    await expect(page.getByRole('main', { name: 'Conversation ARIA' })
      .getByText('Aucun cours ARIA avec chat n’est disponible.')).toBeVisible();
    await expect(page.getByLabel('Cours ARIA')).toHaveValue('');
    expect(await fixtureState(page.request)).toMatchObject({ modelInvocations: 0 });
  });

  test('E006 not-entitled course remains locked and never invokes the model', async ({ page }) => {
    await loginAndOpenAria(page, 'ariaNotEntitled');
    await expect(page.getByRole('option', { name: /NSI.*non inclus/i })).toBeDisabled();
    await expect(page.getByLabel('Message à ARIA')).toBeDisabled();
    expect(await fixtureState(page.request)).toMatchObject({ modelInvocations: 0 });
  });

  test('E007 course switching uses only academic-map courses and detaches the previous history', async ({ page }) => {
    await loginAndOpenAria(page, 'ariaTerminaleMaths');
    await chooseCourse(page, 'eds-maths-terminale');
    await sendFromComposer(page, ARIA_E2E_SCENARIOS.retryAfterFirstDelta);
    await expect(page.getByText('Une dérivée positive', { exact: false })).toBeVisible();
    await chooseCourse(page, 'eds-nsi-terminale');
    await expect(page.getByLabel('Cours ARIA')).toHaveValue('eds-nsi-terminale');
    await expect(page.getByText('Une dérivée positive', { exact: false })).toHaveCount(0);
    await page.waitForTimeout(400);
    await expect(page.getByText('la fonction y est croissante.', { exact: false })).toHaveCount(0);
    const enabledCourseKeys = await page.getByLabel('Cours ARIA').locator('option:enabled').evaluateAll(
      (options) => options.map((option) => (option as HTMLOptionElement).value).filter(Boolean),
    );
    expect(enabledCourseKeys).toEqual(['eds-maths-terminale', 'eds-nsi-terminale']);
  });

  test('E008 citation exposes immutable resource and manifest identity through history', async ({ page }) => {
    await loginAsUser(page, 'ariaNsi');
    const result = await completeConversation(page, {
      courseKey: 'eds-nsi-premiere',
      content: 'Question factuelle du programme NSI.',
      resourceId: nsiPremiereResource.resource_id,
    });
    const { body } = await conversationMessages(page, result.conversation.id);
    const citation = body.messages?.find(({ role }) => role === 'assistant')?.citations[0];
    expect(citation).toMatchObject({
      sourceTitle: canonicalNsiPremiereResource.title,
      resourceId: nsiPremiereResource.resource_id,
      resourceVersionId: nsiPremiereResource.resource_version_id,
      contentSha256: nsiPremiereResource.content_sha256,
      chunkId: nsiPremiereChunk.chunk_id,
      locator: nsiPremiereLocator,
      corpusId: nsiPremiereCorpus.corpus_id,
      corpusVersionId: nsiPremiereCorpus.corpus_version_id,
      manifestSha256: manifest.manifest_sha256,
    });
    await page.goto('/dashboard/eleve', { waitUntil: 'domcontentloaded' });
    await page.getByTestId('aria-chat-trigger').click();
    await chooseCourse(page, 'eds-nsi-premiere');
    await expect(page.getByText('1 source')).toBeVisible();
    await page.getByText('1 source').click();
    await expect(page.getByText(canonicalNsiPremiereResource.title)).toBeVisible();
  });

  test('E009 history survives a full browser reload', async ({ page }) => {
    await loginAndOpenAria(page, 'ariaNsi');
    await chooseCourse(page, 'eds-nsi-premiere');
    await sendFromComposer(page, 'Conserve cette question dans mon historique.');
    await expect(page.getByText(/Une pile fonctionne/)).toBeVisible();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByTestId('aria-chat-trigger').click();
    await page.getByLabel('Cours ARIA').selectOption('eds-nsi-premiere');
    await expect(page.getByText('Conserve cette question dans mon historique.')).toBeVisible();
    await expect(page.getByText(/Une pile fonctionne/)).toBeVisible();
  });

  test('E010 disconnect retry resumes the same Turn with one provider invocation', async ({ page }) => {
    await loginAsUser(page, 'ariaNsi');
    const clientRequestId = randomUUID();
    const content = ARIA_E2E_SCENARIOS.retryAfterFirstDelta;
    const firstAttempt = await page.evaluate(async (body) => {
      const response = await fetch('/api/aria/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
        body: JSON.stringify(body),
      });
      const reader = response.body?.getReader();
      if (!reader) throw new Error('ARIA_E2E_STREAM_READER_MISSING');
      const decoder = new TextDecoder();
      let wire = '';
      while (!wire.includes('event: delta')) {
        const chunk = await reader.read();
        if (chunk.done) throw new Error('ARIA_E2E_FIRST_DELTA_MISSING');
        wire += decoder.decode(chunk.value, { stream: true });
      }
      await reader.cancel('ARIA_E2E_TRANSPORT_DISCONNECT');
      return { status: response.status, receivedDelta: wire.includes('event: delta') };
    }, { courseKey: 'eds-nsi-premiere', content, clientRequestId });
    expect(firstAttempt).toEqual({ status: 200, receivedDelta: true });

    const replay = await completeConversation(page, {
      courseKey: 'eds-nsi-premiere', content, clientRequestId,
    });
    expect(replay.metadata.disposition).toBe('REPLAY');
    const terminal = await waitForAriaTurnTerminal(clientRequestId);
    expect(terminal.status).toBe('COMPLETED');
    expect(await fixtureState(page.request)).toMatchObject({ modelInvocations: 1, handlerErrors: 0 });
    expect(await getAriaConversationCounts(terminal.conversationId)).toEqual({ turns: 1, messages: 2 });
  });

  test('E011 concurrent distinct request is rejected while one Turn is RUNNING', async ({ page }) => {
    await loginAsUser(page, 'ariaNsi');
    const clientRequestId = randomUUID();
    const started = await page.evaluate(async (body) => {
      const response = await fetch('/api/aria/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
        body: JSON.stringify(body),
      });
      const reader = response.body?.getReader();
      const first = await reader?.read();
      const wire = new TextDecoder().decode(first?.value);
      const match = /event: start\s+data: (\{[^\n]+\})/.exec(wire);
      if (!match) throw new Error('ARIA_E2E_START_EVENT_MISSING');
      return JSON.parse(match[1]) as { turnId: string; conversationId: string };
    }, { courseKey: 'eds-nsi-premiere', content: ARIA_E2E_SCENARIOS.cancelAfterFirstDelta, clientRequestId });
    const second = await postConversation(page, {
      courseKey: 'eds-nsi-premiere',
      conversationId: started.conversationId,
      content: 'Une réponse concurrente interdite',
    });
    expect(second.response.status()).toBe(409);
    expect(await second.response.json()).toMatchObject({ error: { code: 'CONVERSATION_BUSY' } });
    const cancellation = await page.request.post(`/api/aria/turns/${started.turnId}/cancel`, {
      data: { clientRequestId }, failOnStatusCode: false,
    });
    expect(cancellation.status()).toBe(202);
    const cancelled = await waitForAriaTurnTerminal(clientRequestId);
    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.messages.find(({ turnRole }) => turnRole === 'USER')?.status).toBe('COMPLETED');
    expect(await getAriaConversationCounts(started.conversationId)).toEqual({ turns: 1, messages: 2 });
    expect(await fixtureState(page.request)).toMatchObject({ modelInvocations: 1, cancelledModelStreams: 1 });
  });

  test('E012 cancellation is terminal only after persisted CANCELLED and retains retrieval audit', async ({ page }) => {
    await loginAndOpenAria(page, 'ariaNsi');
    await chooseCourse(page, 'eds-nsi-premiere');
    await sendFromComposer(page, ARIA_E2E_SCENARIOS.cancelAfterFirstDelta);
    await expect(page.getByRole('button', { name: 'Arrêter la réponse ARIA' })).toBeVisible();
    await expect(page.getByText('Une pile', { exact: false })).toBeVisible();
    await expect.poll(async () => fixtureState(page.request)).toMatchObject({
      ragInvocations: 1,
      modelInvocations: 1,
      activeModelStreams: 1,
    });
    const clientRequestId = await getOnlyAriaTurnClientRequestId();
    await page.getByRole('button', { name: 'Arrêter la réponse ARIA' }).click();
    await expect(page.getByRole('status')).toHaveText('Réponse ARIA arrêtée.');
    const turn = await waitForAriaTurnTerminal(clientRequestId);
    expect(turn).toMatchObject({
      status: 'CANCELLED',
      ragStatus: 'SUCCESS',
      retrievalEvidence: {
        schemaVersion: 1,
        manifestSha256: manifest.manifest_sha256,
        corpusId: nsiPremiereCorpus.corpus_id,
        corpusVersionId: nsiPremiereCorpus.corpus_version_id,
        hits: [{
          resourceId: nsiPremiereResource.resource_id,
          resourceVersionId: nsiPremiereResource.resource_version_id,
          contentSha256: nsiPremiereResource.content_sha256,
          chunkId: nsiPremiereChunk.chunk_id,
          locator: nsiPremiereLocator,
        }],
      },
    });
    expect(turn.messages.find(({ turnRole }) => turnRole === 'USER')?.status).toBe('COMPLETED');
    const id = await latestConversationId(page, 'eds-nsi-premiere');
    const { body } = await conversationMessages(page, id);
    const assistant = body.messages?.findLast(({ role }) => role === 'assistant');
    expect(assistant).toMatchObject({ status: 'CANCELLED' });
    expect(assistant?.citations[0]).toMatchObject({
      manifestSha256: manifest.manifest_sha256,
      resourceVersionId: nsiPremiereResource.resource_version_id,
    });
    expect(await fixtureState(page.request)).toMatchObject({ cancelledModelStreams: 1, activeModelStreams: 0 });
  });

  test('E013 feedback persists one canonical value and returns it after reload', async ({ page }) => {
    await loginAndOpenAria(page, 'ariaNsi');
    await chooseCourse(page, 'eds-nsi-premiere');
    await sendFromComposer(page, 'Réponse à évaluer.');
    await expect(page.getByText(/Une pile fonctionne/)).toBeVisible();
    await page.getByRole('button', { name: 'Réponse utile' }).last().click();
    await expect(page.getByRole('button', { name: 'Réponse utile' }).last()).toHaveAttribute('aria-pressed', 'true');
    const id = await latestConversationId(page, 'eds-nsi-premiere');
    const { body } = await conversationMessages(page, id);
    expect(body.messages?.findLast(({ role }) => role === 'assistant')?.feedback).toBe(true);
  });

  test('E014 RAG runtime unavailable is explicit and never silently reaches the model', async ({ page }) => {
    await loginAndOpenAria(page, 'ariaNsi');
    await chooseCourse(page, 'eds-nsi-premiere');
    await sendFromComposer(page, ARIA_E2E_SCENARIOS.ragUnavailable);
    await expect(page.getByRole('dialog').getByRole('alert'))
      .toHaveText('Les sources pédagogiques sont temporairement indisponibles.');
    expect(await fixtureState(page.request)).toMatchObject({ modelInvocations: 0, ragInvocations: 1 });
  });

  test('E015 provider timeout becomes one safe observable terminal error', async ({ page }) => {
    await loginAndOpenAria(page, 'ariaNsi');
    await chooseCourse(page, 'eds-nsi-premiere');
    await sendFromComposer(page, ARIA_E2E_SCENARIOS.modelTimeout);
    await expect(page.getByRole('dialog').getByRole('alert'))
      .toHaveText('ARIA met trop de temps à répondre. Réessayez dans un instant.');
    expect(await fixtureState(page.request)).toMatchObject({ modelInvocations: 1, ragInvocations: 1 });
    const clientRequestId = await getOnlyAriaTurnClientRequestId();
    const turn = await waitForAriaTurnTerminal(clientRequestId);
    expect(turn).toMatchObject({
      status: 'ERROR',
      ragStatus: 'SUCCESS',
      executionMetadata: {
        failureCode: 'MODEL_TIMEOUT',
        reasonCode: 'MODEL_FIRST_TOKEN_TIMEOUT',
      },
      retrievalEvidence: {
        manifestSha256: manifest.manifest_sha256,
        corpusId: nsiPremiereCorpus.corpus_id,
        corpusVersionId: nsiPremiereCorpus.corpus_version_id,
      },
    });
    expect(turn.messages.find(({ turnRole }) => turnRole === 'ASSISTANT')?.status).toBe('ERROR');
    expect(turn.messages.find(({ turnRole }) => turnRole === 'USER')?.status).toBe('COMPLETED');
  });

  test('E016 another student cannot read a private raw conversation', async ({ page }) => {
    await loginAsUser(page, 'ariaNsi');
    const created = await completeConversation(page, {
      courseKey: 'eds-nsi-premiere', content: 'Conversation strictement privée',
    });
    await logoutUser(page);
    await loginAsUser(page, 'ariaNsiPeer', { navigate: false });
    const foreign = await page.request.get(
      `/api/aria/conversations/${created.conversation.id}/messages?limit=50`,
      { failOnStatusCode: false },
    );
    expect(foreign.status()).toBe(404);
    expect(await foreign.text()).not.toContain('Conversation strictement privée');
    const providerBeforeResume = await fixtureState(page.request);
    const resume = await postConversation(page, {
      courseKey: 'eds-nsi-premiere',
      conversationId: created.conversation.id,
      content: 'Tentative de reprise de la conversation privée',
    });
    expect(resume.response.status()).toBe(404);
    expect(await resume.response.text()).not.toContain('Conversation strictement privée');
    expect(await fixtureState(page.request)).toMatchObject({
      modelInvocations: providerBeforeResume.modelInvocations,
      ragInvocations: providerBeforeResume.ragInvocations,
    });
  });

  test('E017 one course conversation cannot resume under another enrolled course', async ({ page }) => {
    await loginAsUser(page, 'ariaTerminaleMaths');
    const maths = await completeConversation(page, {
      courseKey: 'eds-maths-terminale', content: 'Conversation de mathématiques',
    });
    const mismatch = await postConversation(page, {
      courseKey: 'eds-nsi-terminale',
      conversationId: maths.conversation.id,
      content: 'Tentative de reprise en NSI',
    });
    expect(mismatch.response.status()).toBe(400);
    expect(await mismatch.response.json()).toMatchObject({ error: { code: 'BAD_REQUEST' } });
    expect(await fixtureState(page.request)).toMatchObject({ modelInvocations: 1 });
  });

  test('E023 rendered content treats markup as text and never executes it', async ({ page }) => {
    await loginAndOpenAria(page, 'ariaNsi');
    await chooseCourse(page, 'eds-nsi-premiere');
    const browserRequests: string[] = [];
    page.on('request', (request) => browserRequests.push(request.url()));
    await sendFromComposer(page, ARIA_E2E_SCENARIOS.hostileAssistantOutput);
    await expect(page.getByText('<script>window.__ariaXss=1</script>', { exact: false })).toBeVisible();
    await expect(page.getByText(/javascript:alert\(1\) data:text\/html,unsafe/)).toBeVisible();
    await expect(page.getByText(/vbscript:msgbox\(1\)/)).toBeVisible();
    expect(await page.evaluate(() => (window as Window & { __ariaXss?: number }).__ariaXss ?? 0)).toBe(0);
    await expect(page.getByRole('dialog').locator('script, img, iframe, object, embed')).toHaveCount(0);
    expect(browserRequests.every((url) => {
      const { protocol } = new URL(url);
      return protocol === 'http:' || protocol === 'https:';
    })).toBe(true);
  });

  test('E024 500-delta stress stays responsive and persists one message pair, not one row per token', async ({ page }) => {
    await loginAndOpenAria(page, 'ariaNsi');
    await chooseCourse(page, 'eds-nsi-premiere');
    await sendFromComposer(page, ARIA_E2E_SCENARIOS.longStream);
    await expect(page.getByRole('button', { name: 'Arrêter la réponse ARIA' })).toBeVisible();
    await expect(page.getByText(/499/)).toBeVisible();
    const id = await latestConversationId(page, 'eds-nsi-premiere');
    const { body } = await conversationMessages(page, id);
    expect(body.messages).toHaveLength(2);

    await sendFromComposer(page, ARIA_E2E_SCENARIOS.cancelAfterFirstDelta);
    await expect(page.getByText('Une pile', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'Arrêter la réponse ARIA' }).click();
    await expect(page.getByRole('status')).toHaveText('Réponse ARIA arrêtée.');
    await expect.poll(async () => (await conversationMessages(page, id)).body.messages?.length).toBe(4);
  });

  test('E025 ARIA_NO_BROWSER_ERRORS — ordinary grounded flow has no console, page or network failures', async ({ page }) => {
    await loginAndOpenAria(page, 'ariaNsi');
    await chooseCourse(page, 'eds-nsi-premiere');
    const failures = captureBrowserFailures(page);
    await sendFromComposer(page, 'Flux de qualité runtime.');
    await expect(page.getByText(/Une pile fonctionne/)).toBeVisible();
    expect(failures).toEqual([]);
  });

  test('E026 public ARIA marketing demo remains static and never opens the product API', async ({ page }) => {
    const ariaRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/aria')) ariaRequests.push(request.url());
    });
    await page.goto('/plateforme-aria', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByTestId('aria-chat-trigger')).toHaveCount(0);
    expect(ariaRequests).toEqual([]);
  });
});
