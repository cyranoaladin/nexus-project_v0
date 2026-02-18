/**
 * Telegram Bot API client for Nexus Réussite.
 *
 * Reads TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID from environment.
 * When TELEGRAM_DISABLED=true (or NODE_ENV=test), all operations are skipped.
 *
 * Security:
 * - Token is never logged.
 * - Message content is never logged (only success/failure + chat_id).
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
  skipped?: boolean;
  messageId?: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Returns true when Telegram operations are disabled.
 */
export function isTelegramDisabled(): boolean {
  const explicit = process.env.TELEGRAM_DISABLED;
  if (explicit === 'true') return true;
  if (explicit === 'false') return false;
  return process.env.NODE_ENV === 'test';
}

/**
 * Build the base URL for Bot API calls.
 * @throws Error if TELEGRAM_BOT_TOKEN is not set.
 */
function baseUrl(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error('[telegram] TELEGRAM_BOT_TOKEN is not set');
  }
  return `https://api.telegram.org/bot${token}`;
}

/**
 * Generic Bot API call with timeout.
 */
async function apiCall<T>(method: string, body?: Record<string, unknown>): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);

  try {
    const url = `${baseUrl()}/${method}`;
    const response = await fetch(url, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Telegram API ${method} failed: ${response.status} ${text}`);
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
  return apiCall<TelegramBotInfo>('getMe');
}

/**
 * Get recent updates (messages sent to the bot).
 * Useful for discovering chat_id values.
 * Returns raw updates array (caller should extract chat.id).
 */
export async function telegramGetUpdates(limit = 10): Promise<unknown[]> {
  return apiCall<unknown[]>('getUpdates', { limit, timeout: 0 });
}

/**
 * Get chat info by chat_id.
 * Validates that the bot has access to the chat.
 */
export async function telegramGetChat(chatId: string | number): Promise<TelegramChat> {
  return apiCall<TelegramChat>('getChat', { chat_id: chatId });
}

/**
 * Send a text message to a chat.
 *
 * When TELEGRAM_DISABLED=true, returns { ok: true, skipped: true }.
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
  if (isTelegramDisabled()) {
    console.log('[telegram] Skipped (TELEGRAM_DISABLED)');
    return { ok: true, skipped: true };
  }

  const resolvedChatId = chatId || process.env.TELEGRAM_CHAT_ID;
  if (!resolvedChatId) {
    console.error('[telegram] No chat_id provided and TELEGRAM_CHAT_ID not set');
    return { ok: false };
  }

  try {
    const result = await apiCall<{ message_id: number }>('sendMessage', {
      chat_id: resolvedChatId,
      text,
      parse_mode: opts?.parseMode ?? 'Markdown',
      disable_notification: opts?.disableNotification ?? false,
    });

    console.log(`[telegram] Sent: message_id=${result.message_id}`);
    return { ok: true, messageId: result.message_id };
  } catch (error) {
    console.error('[telegram] Send failed:', error instanceof Error ? error.message : 'unknown');
    return { ok: false };
  }
}
