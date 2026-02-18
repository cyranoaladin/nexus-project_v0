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
  isTelegramDisabled,
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

// ─── isTelegramDisabled ─────────────────────────────────────────────────────

describe('isTelegramDisabled', () => {
  it('returns true when TELEGRAM_DISABLED=true', () => {
    process.env.TELEGRAM_DISABLED = 'true';
    expect(isTelegramDisabled()).toBe(true);
  });

  it('returns false when TELEGRAM_DISABLED=false', () => {
    process.env.TELEGRAM_DISABLED = 'false';
    expect(isTelegramDisabled()).toBe(false);
  });

  it('defaults to true in NODE_ENV=test', () => {
    delete process.env.TELEGRAM_DISABLED;
    (process.env as any).NODE_ENV = 'test';
    expect(isTelegramDisabled()).toBe(true);
  });

  it('defaults to false in NODE_ENV=production', () => {
    delete process.env.TELEGRAM_DISABLED;
    (process.env as any).NODE_ENV = 'production';
    expect(isTelegramDisabled()).toBe(false);
  });
});

// ─── telegramGetMe ──────────────────────────────────────────────────────────

describe('telegramGetMe', () => {
  it('returns bot info on success', async () => {
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
    mockApiError(401, 'Unauthorized');
    await expect(telegramGetMe()).rejects.toThrow('Telegram API getMe failed: 401');
  });

  it('throws when token is missing', async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    await expect(telegramGetMe()).rejects.toThrow('TELEGRAM_BOT_TOKEN is not set');
  });
});

// ─── telegramGetUpdates ─────────────────────────────────────────────────────

describe('telegramGetUpdates', () => {
  it('returns updates array', async () => {
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
    const chat = { id: -100123456, type: 'group', title: 'Test Group' };
    mockApiResponse(chat);

    const result = await telegramGetChat('-100123456');

    expect(result).toEqual(chat);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.chat_id).toBe('-100123456');
  });

  it('throws on invalid chat_id', async () => {
    mockApiError(400, 'Bad Request: chat not found');
    await expect(telegramGetChat('invalid')).rejects.toThrow('Telegram API getChat failed: 400');
  });
});

// ─── telegramSendMessage ────────────────────────────────────────────────────

describe('telegramSendMessage', () => {
  it('skips when TELEGRAM_DISABLED=true', async () => {
    process.env.TELEGRAM_DISABLED = 'true';

    const result = await telegramSendMessage(undefined, 'Hello');

    expect(result).toEqual({ ok: true, skipped: true });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('skips by default in NODE_ENV=test', async () => {
    delete process.env.TELEGRAM_DISABLED;
    (process.env as any).NODE_ENV = 'test';

    const result = await telegramSendMessage(undefined, 'Hello');

    expect(result).toEqual({ ok: true, skipped: true });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('sends message when enabled', async () => {
    process.env.TELEGRAM_DISABLED = 'false';
    mockApiResponse({ message_id: 42 });

    const result = await telegramSendMessage('-100123456', 'Test message');

    expect(result).toEqual({ ok: true, messageId: 42 });
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.chat_id).toBe('-100123456');
    expect(body.text).toBe('Test message');
    expect(body.parse_mode).toBe('Markdown');
  });

  it('uses TELEGRAM_CHAT_ID when chatId is undefined', async () => {
    process.env.TELEGRAM_DISABLED = 'false';
    process.env.TELEGRAM_CHAT_ID = '-999';
    mockApiResponse({ message_id: 43 });

    await telegramSendMessage(undefined, 'Hello');

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.chat_id).toBe('-999');
  });

  it('returns ok:false when no chat_id available', async () => {
    process.env.TELEGRAM_DISABLED = 'false';
    delete process.env.TELEGRAM_CHAT_ID;

    const result = await telegramSendMessage(undefined, 'Hello');

    expect(result).toEqual({ ok: false });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns ok:false on API error (does not throw)', async () => {
    process.env.TELEGRAM_DISABLED = 'false';
    mockApiError(403, 'Forbidden');

    const result = await telegramSendMessage('-100', 'Hello');

    expect(result).toEqual({ ok: false });
  });

  it('respects custom parseMode and disableNotification', async () => {
    process.env.TELEGRAM_DISABLED = 'false';
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
