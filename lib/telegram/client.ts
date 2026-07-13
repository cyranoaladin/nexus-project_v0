/**
 * Telegram Bot API client for Nexus Réussite.
 *
 * Reads TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID from environment.
 * Network operations are enabled only when TELEGRAM_NOTIFICATIONS_ENABLED=true.
 *
 * Security:
 * - Token is never logged.
 * - Message content and destination are never logged.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TelegramBotInfo {
  id: number;
  is_bot: boolean;
  first_name: string;
  username: string;
}

export interface TelegramChat {
  id: number;
  type: string;
  title?: string;
  username?: string;
}

export interface TelegramSendResult {
  ok: boolean;
  status: 'disabled' | 'sent' | 'unavailable' | 'failed';
  skipped?: boolean;
  messageId?: number;
  error?: 'configuration_unavailable' | 'request_failed';
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Telegram is opt-in. Missing, malformed, or false values disable all requests.
 */
export function areTelegramNotificationsEnabled(): boolean {
  return process.env.TELEGRAM_NOTIFICATIONS_ENABLED === 'true';
}

function requireToken(): string {
  if (!areTelegramNotificationsEnabled()) {
    throw new Error('Telegram notifications are disabled');
  }
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error('[telegram] TELEGRAM_BOT_TOKEN is not set');
  }
  return token;
}

/**
 * Generic Bot API call with timeout.
 */
async function apiCall<T>(
  token: string,
  method: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);

  try {
    const url = `https://api.telegram.org/bot${token}/${method}`;
    const response = await fetch(url, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Telegram API ${method} failed: ${response.status}`);
    }

    const json = (await response.json()) as { ok: boolean; result: T };
    if (!json.ok) {
      throw new Error(`Telegram API ${method} returned ok=false`);
    }

    return json.result;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Verify the bot token by calling getMe.
 * Returns bot info if valid.
 */
export async function telegramGetMe(): Promise<TelegramBotInfo> {
  return apiCall<TelegramBotInfo>(requireToken(), 'getMe');
}

/**
 * Get recent updates (messages sent to the bot).
 * Useful for discovering chat_id values.
 * Returns raw updates array (caller should extract chat.id).
 */
export async function telegramGetUpdates(limit = 10): Promise<unknown[]> {
  return apiCall<unknown[]>(requireToken(), 'getUpdates', { limit, timeout: 0 });
}

/**
 * Get chat info by chat_id.
 * Validates that the bot has access to the chat.
 */
export async function telegramGetChat(chatId: string | number): Promise<TelegramChat> {
  return apiCall<TelegramChat>(requireToken(), 'getChat', { chat_id: chatId });
}

/**
 * Send a text message to a chat.
 *
 * When notifications are not explicitly enabled, returns a disabled result.
 *
 * @param chatId - Target chat ID (defaults to TELEGRAM_CHAT_ID env var)
 * @param text - Message text (Markdown supported)
 * @param opts - Optional: parse_mode, disable_notification
 */
export async function telegramSendMessage(
  chatId: string | number | undefined,
  text: string,
  opts?: { parseMode?: 'Markdown' | 'MarkdownV2' | 'HTML'; disableNotification?: boolean }
): Promise<TelegramSendResult> {
  if (!areTelegramNotificationsEnabled()) {
    return { ok: true, skipped: true, status: 'disabled' };
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const resolvedChatId = chatId || process.env.TELEGRAM_CHAT_ID;
  if (!token || !resolvedChatId) {
    return {
      ok: false,
      status: 'unavailable',
      error: 'configuration_unavailable',
    };
  }

  try {
    const result = await apiCall<{ message_id: number }>(token, 'sendMessage', {
      chat_id: resolvedChatId,
      text,
      parse_mode: opts?.parseMode ?? 'Markdown',
      disable_notification: opts?.disableNotification ?? false,
    });

    return { ok: true, messageId: result.message_id, status: 'sent' };
  } catch {
    console.error('[telegram] notification failed', { code: 'request_failed' });
    return { ok: false, status: 'failed', error: 'request_failed' };
  }
}
