/**
 * Unit tests for lib/telegram/client.ts
 *
 * All tests mock global fetch — zero network calls.
 */

import {
  telegramGetMe,
  telegramGetUpdates,
  telegramGetChat,
  telegramSendMessage,
  areTelegramNotificationsEnabled,
} from '@/lib/telegram/client';

// ─── Setup ──────────────────────────────────────────────────────────────────

const originalEnv = { ...process.env };
const mockFetch = jest.fn();

beforeAll(() => {
  global.fetch = mockFetch as unknown as typeof fetch;
});

beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...originalEnv };
  (process.env as any).NODE_ENV = 'test';
  delete process.env.TELEGRAM_NOTIFICATIONS_ENABLED;
  process.env.TELEGRAM_BOT_TOKEN = 'test-token-123';
  process.env.TELEGRAM_CHAT_ID = '-100123456';
});

afterAll(() => {
  process.env = originalEnv;
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function mockApiResponse(result: unknown, ok = true) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ ok, result }),
    text: async () => JSON.stringify({ ok, result }),
  });
}

function mockApiError(status: number, description: string) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    text: async () => JSON.stringify({ ok: false, description }),
  });
}

// ─── areTelegramNotificationsEnabled ────────────────────────────────────────

describe('areTelegramNotificationsEnabled', () => {
  it('returns true only for an explicit true value', () => {
    process.env.TELEGRAM_NOTIFICATIONS_ENABLED = 'true';
    expect(areTelegramNotificationsEnabled()).toBe(true);
  });

  it('returns false for an explicit false value', () => {
    process.env.TELEGRAM_NOTIFICATIONS_ENABLED = 'false';
    expect(areTelegramNotificationsEnabled()).toBe(false);
  });

  it('defaults to false in production', () => {
    (process.env as any).NODE_ENV = 'production';
    expect(areTelegramNotificationsEnabled()).toBe(false);
  });
});

// ─── telegramGetMe ──────────────────────────────────────────────────────────

describe('telegramGetMe', () => {
  it('returns bot info on success', async () => {
    process.env.TELEGRAM_NOTIFICATIONS_ENABLED = 'true';
    const botInfo = { id: 123, is_bot: true, first_name: 'TestBot', username: 'test_bot' };
    mockApiResponse(botInfo);

    const result = await telegramGetMe();

    expect(result).toEqual(botInfo);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toContain('/getMe');
    // Token must NOT appear in logs but IS in the URL (expected for Bot API)
    expect(mockFetch.mock.calls[0][0]).toContain('test-token-123');
  });

  it('throws on API error', async () => {
    process.env.TELEGRAM_NOTIFICATIONS_ENABLED = 'true';
    mockApiError(401, 'Unauthorized');
    await expect(telegramGetMe()).rejects.toThrow('Telegram API getMe failed: 401');
  });

  it('throws when token is missing', async () => {
    process.env.TELEGRAM_NOTIFICATIONS_ENABLED = 'true';
    delete process.env.TELEGRAM_BOT_TOKEN;
    await expect(telegramGetMe()).rejects.toThrow('TELEGRAM_BOT_TOKEN is not set');
  });

  it('makes no request while notifications are disabled', async () => {
    process.env.TELEGRAM_NOTIFICATIONS_ENABLED = 'false';

    await expect(telegramGetMe()).rejects.toThrow('Telegram notifications are disabled');

    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ─── telegramGetUpdates ─────────────────────────────────────────────────────

describe('telegramGetUpdates', () => {
  it('returns updates array', async () => {
    process.env.TELEGRAM_NOTIFICATIONS_ENABLED = 'true';
    const updates = [{ update_id: 1, message: { chat: { id: -100 } } }];
    mockApiResponse(updates);

    const result = await telegramGetUpdates(5);

    expect(result).toEqual(updates);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.limit).toBe(5);
  });
});

// ─── telegramGetChat ────────────────────────────────────────────────────────

describe('telegramGetChat', () => {
  it('returns chat info', async () => {
    process.env.TELEGRAM_NOTIFICATIONS_ENABLED = 'true';
    const chat = { id: -100123456, type: 'group', title: 'Test Group' };
    mockApiResponse(chat);

    const result = await telegramGetChat('-100123456');

    expect(result).toEqual(chat);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.chat_id).toBe('-100123456');
  });

  it('throws on invalid chat_id', async () => {
    process.env.TELEGRAM_NOTIFICATIONS_ENABLED = 'true';
    mockApiError(400, 'Bad Request: chat not found');
    await expect(telegramGetChat('invalid')).rejects.toThrow('Telegram API getChat failed: 400');
  });
});

// ─── telegramSendMessage ────────────────────────────────────────────────────

describe('telegramSendMessage', () => {
  it('returns disabled and makes no request when the flag is false and token is absent', async () => {
    process.env.TELEGRAM_NOTIFICATIONS_ENABLED = 'false';
    delete process.env.TELEGRAM_BOT_TOKEN;

    const result = await telegramSendMessage(undefined, 'Hello');

    expect(result).toEqual({ ok: true, skipped: true, status: 'disabled' });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('does not use a residual token when the flag is false', async () => {
    process.env.TELEGRAM_NOTIFICATIONS_ENABLED = 'false';
    process.env.TELEGRAM_BOT_TOKEN = 'residual-placeholder';

    const result = await telegramSendMessage(undefined, 'Hello');

    expect(result.status).toBe('disabled');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('sends message when enabled', async () => {
    process.env.TELEGRAM_NOTIFICATIONS_ENABLED = 'true';
    mockApiResponse({ message_id: 42 });

    const result = await telegramSendMessage('-100123456', 'Test message');

    expect(result).toEqual({ ok: true, messageId: 42, status: 'sent' });
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.chat_id).toBe('-100123456');
    expect(body.text).toBe('Test message');
    expect(body.parse_mode).toBe('Markdown');
  });

  it('uses TELEGRAM_CHAT_ID when chatId is undefined', async () => {
    process.env.TELEGRAM_NOTIFICATIONS_ENABLED = 'true';
    process.env.TELEGRAM_CHAT_ID = '-999';
    mockApiResponse({ message_id: 43 });

    await telegramSendMessage(undefined, 'Hello');

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.chat_id).toBe('-999');
  });

  it('returns ok:false when no chat_id available', async () => {
    process.env.TELEGRAM_NOTIFICATIONS_ENABLED = 'true';
    delete process.env.TELEGRAM_CHAT_ID;

    const result = await telegramSendMessage(undefined, 'Hello');

    expect(result.ok).toBe(false);
    expect(result.error).toBe('configuration_unavailable');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns a redacted configuration error when enabled without a token', async () => {
    process.env.TELEGRAM_NOTIFICATIONS_ENABLED = 'true';
    delete process.env.TELEGRAM_BOT_TOKEN;

    const result = await telegramSendMessage('-100', 'Hello');

    expect(result).toEqual({
      ok: false,
      status: 'unavailable',
      error: 'configuration_unavailable',
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns ok:false on API error (does not throw)', async () => {
    process.env.TELEGRAM_NOTIFICATIONS_ENABLED = 'true';
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockApiError(403, 'Forbidden');

    const result = await telegramSendMessage('-100', 'Hello');

    expect(result.ok).toBe(false);
    expect(result).toEqual({ ok: false, status: 'failed', error: 'request_failed' });
    consoleError.mockRestore();
  });

  it('never returns or logs the raw Telegram response', async () => {
    process.env.TELEGRAM_NOTIFICATIONS_ENABLED = 'true';
    const syntheticToken = `${'12345678'}:${'A'.repeat(35)}`;
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockApiError(401, `Unauthorized ${syntheticToken} parent@example.test`);

    const result = await telegramSendMessage('-100', 'Hello');
    const logOutput = JSON.stringify(consoleError.mock.calls);

    expect(JSON.stringify(result)).not.toContain(syntheticToken);
    expect(logOutput).not.toContain(syntheticToken);
    expect(logOutput).not.toContain('parent@example.test');
    consoleError.mockRestore();
  });

  it('respects custom parseMode and disableNotification', async () => {
    process.env.TELEGRAM_NOTIFICATIONS_ENABLED = 'true';
    mockApiResponse({ message_id: 44 });

    await telegramSendMessage('-100', '<b>Bold</b>', {
      parseMode: 'HTML',
      disableNotification: true,
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.parse_mode).toBe('HTML');
    expect(body.disable_notification).toBe(true);
  });
});
