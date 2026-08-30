import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { loginAsUser, type UserType } from '../helpers/auth';

const fixtureBaseUrl = process.env.ARIA_E2E_FIXTURE_BASE_URL ?? '';
const fixtureAdminToken = process.env.ARIA_E2E_FIXTURE_ADMIN_TOKEN ?? '';

export interface FixtureState {
  readonly modelInvocations: number;
  readonly ragInvocations: number;
  readonly rejectedIdentityRequests: number;
  readonly cancelledModelStreams: number;
  readonly activeModelStreams: number;
  readonly handlerErrors: number;
  readonly lastHandlerError: string | null;
}

export interface ConversationResult {
  readonly conversation: { readonly id: string; readonly courseKey: string };
  readonly message: { readonly id: string; readonly content: string; readonly status: string };
  readonly metadata: { readonly turnId: string; readonly disposition: string; readonly ragStatus?: string };
}

function fixtureHeaders() {
  if (!fixtureBaseUrl || fixtureAdminToken.length < 32) {
    throw new Error('ARIA_E2E_FIXTURE_CLIENT_CONFIGURATION_INVALID');
  }
  return { authorization: `Bearer ${fixtureAdminToken}` };
}

export async function resetFixture(request: APIRequestContext): Promise<void> {
  const response = await request.post(`${fixtureBaseUrl}/__e2e/reset`, {
    headers: fixtureHeaders(),
  });
  expect(response.status()).toBe(200);
}

export async function fixtureState(request: APIRequestContext): Promise<FixtureState> {
  const response = await request.get(`${fixtureBaseUrl}/__e2e/state`, {
    headers: fixtureHeaders(),
  });
  expect(response.status()).toBe(200);
  return response.json() as Promise<FixtureState>;
}

export async function loginAndOpenAria(page: Page, persona: UserType): Promise<void> {
  await loginAsUser(page, persona);
  await expect(page.getByTestId('aria-chat-trigger')).toBeVisible();
  await page.getByTestId('aria-chat-trigger').click();
  await expect(page.getByRole('dialog', { name: 'Assistant pédagogique ARIA' })).toBeVisible();
  await expect(page.getByLabel('Cours ARIA')).toBeVisible();
}

export async function chooseCourse(page: Page, courseKey: string): Promise<void> {
  await page.getByLabel('Cours ARIA').selectOption(courseKey);
  await expect(page.getByLabel('Cours ARIA')).toHaveValue(courseKey);
  await expect(page.getByLabel('Message à ARIA')).toBeEnabled();
}

export async function sendFromComposer(page: Page, content: string): Promise<void> {
  await page.getByLabel('Message à ARIA').fill(content);
  await page.getByRole('button', { name: 'Envoyer à ARIA' }).click();
}

export async function postConversation(
  page: Page,
  input: Readonly<{
    courseKey: string;
    content: string;
    conversationId?: string;
    clientRequestId?: string;
    resourceId?: string;
    skillId?: string;
  }>,
): Promise<{ readonly response: Awaited<ReturnType<Page['request']['post']>>; readonly clientRequestId: string }> {
  const clientRequestId = input.clientRequestId ?? randomUUID();
  const response = await page.request.post('/api/aria/chat', {
    data: {
      courseKey: input.courseKey,
      content: input.content,
      clientRequestId,
      ...(input.conversationId ? { conversationId: input.conversationId } : {}),
      ...(input.resourceId ? { resourceId: input.resourceId } : {}),
      ...(input.skillId ? { skillId: input.skillId } : {}),
    },
    headers: { accept: 'application/json' },
    failOnStatusCode: false,
  });
  return { response, clientRequestId };
}

export async function completeConversation(
  page: Page,
  input: Parameters<typeof postConversation>[1],
): Promise<ConversationResult> {
  const request = { ...input, clientRequestId: input.clientRequestId ?? randomUUID() };
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const { response } = await postConversation(page, request);
    if (response.status() === 200) return response.json() as Promise<ConversationResult>;
    if (response.status() !== 202) {
      throw new Error(`ARIA_E2E_CONVERSATION_FAILED:${response.status()}:${await response.text()}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('ARIA_E2E_CONVERSATION_REPLAY_TIMEOUT');
}

export async function latestConversationId(page: Page, courseKey: string): Promise<string> {
  const response = await page.request.get(
    `/api/aria/conversations?courseKey=${encodeURIComponent(courseKey)}&limit=1`,
  );
  expect(response.status()).toBe(200);
  const body = await response.json() as { conversations?: Array<{ id?: string }> };
  const id = body.conversations?.[0]?.id;
  if (!id) throw new Error('ARIA_E2E_CONVERSATION_NOT_FOUND');
  return id;
}

export async function conversationMessages(page: Page, conversationId: string) {
  const response = await page.request.get(
    `/api/aria/conversations/${encodeURIComponent(conversationId)}/messages?limit=50`,
    { failOnStatusCode: false },
  );
  return {
    response,
    body: await response.json() as {
      messages?: Array<{
        messageId: string;
        turnId: string | null;
        role: string;
        content: string;
        status: string;
        feedback: boolean | null;
        citations: Array<Record<string, unknown>>;
      }>;
    },
  };
}

export function captureBrowserFailures(page: Page) {
  const failures: string[] = [];
  page.on('console', (message) => {
    const text = message.text();
    if (message.type() === 'error'
      || (message.type() === 'warning' && /hydration|did not match|server rendered html/i.test(text))) {
      failures.push(`console:${message.type()}:${text}`);
    }
  });
  page.on('pageerror', (error) => failures.push(`pageerror:${error.message}`));
  page.on('requestfailed', (request) => {
    const url = new URL(request.url());
    const errorText = request.failure()?.errorText ?? 'UNKNOWN';
    failures.push(`requestfailed:${request.method()}:${url.pathname}:${errorText}`);
  });
  page.on('response', (response) => {
    const url = new URL(response.url());
    const pageOrigin = new URL(page.url()).origin;
    if (url.origin === pageOrigin && response.status() >= 500) {
      failures.push(`response:${response.status()}:${url.pathname}`);
    }
  });
  return failures;
}
