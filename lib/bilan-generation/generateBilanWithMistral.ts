// ─────────────────────────────────────────────────────────────────────────────
// lib/bilan-generation/generateBilanWithMistral.ts
// Calls Mistral (text completion, not JSON mode) and returns raw markdown.
// ─────────────────────────────────────────────────────────────────────────────

import { logger } from '@/lib/logger';
import {
  MistralConfigurationError,
  MistralGenerationError,
  MISTRAL_ERROR_CODES,
} from '@/lib/llm/mistral';
import type { MistralChatMessage } from '@/lib/llm/mistral';

function getMistralModel(): string {
  return process.env.MISTRAL_MODEL ?? 'mistral-large-latest';
}

function getMistralBaseUrl(): string {
  const env = process.env.MISTRAL_BASE_URL;
  return env ? env.replace(/\/+$/, '') : 'https://api.mistral.ai';
}

function getMistralTimeoutMs(): number {
  const v = process.env.MISTRAL_TIMEOUT_MS;
  if (v) {
    const n = parseInt(v, 10);
    if (!isNaN(n) && n > 0) return n;
  }
  return 90_000;
}

/**
 * Call Mistral in text (non-JSON) mode to generate a Markdown bilan.
 * Never logs messages content or API key.
 */
export async function generateBilanMarkdownWithMistral(
  messages: MistralChatMessage[],
  temperature = 0.3,
): Promise<{ markdown: string; model: string; durationMs: number }> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    logger.error({}, '[bilan-generation] MISTRAL_API_KEY missing');
    throw new MistralConfigurationError();
  }

  const model = getMistralModel();
  const timeoutMs = getMistralTimeoutMs();
  const baseUrl = getMistralBaseUrl();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const startedAt = Date.now();

  try {
    logger.info({ model, timeoutMs }, '[bilan-generation] Starting Mistral call');

    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: 4096,
      }),
      signal: controller.signal,
    });

    const durationMs = Date.now() - startedAt;

    if (response.status === 429) {
      logger.warn({ status: 429, durationMs }, '[bilan-generation] Rate limited');
      throw new MistralGenerationError(
        MISTRAL_ERROR_CODES.MISTRAL_HTTP_ERROR,
        'RATE_LIMITED',
      );
    }

    if (!response.ok) {
      logger.error({ status: response.status, durationMs }, '[bilan-generation] HTTP error');
      throw new MistralGenerationError(
        MISTRAL_ERROR_CODES.MISTRAL_HTTP_ERROR,
        `Mistral returned HTTP ${response.status}`,
      );
    }

    const payload = await response.json();
    const content: unknown = payload?.choices?.[0]?.message?.content;

    if (typeof content !== 'string' || content.trim().length === 0) {
      logger.error({ durationMs }, '[bilan-generation] Empty response');
      throw new MistralGenerationError(
        MISTRAL_ERROR_CODES.MISTRAL_EMPTY_RESPONSE,
        'Empty response from Mistral',
      );
    }

    logger.info({ model, durationMs, length: content.length }, '[bilan-generation] Mistral call succeeded');

    return { markdown: content.trim(), model, durationMs };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      logger.error({ timeoutMs }, '[bilan-generation] Timeout');
      throw new MistralGenerationError(MISTRAL_ERROR_CODES.MISTRAL_TIMEOUT, 'Timeout');
    }
    if (error instanceof MistralConfigurationError || error instanceof MistralGenerationError) {
      throw error;
    }
    logger.error({ error: (error as Error).message }, '[bilan-generation] Unexpected error');
    throw new MistralGenerationError(
      MISTRAL_ERROR_CODES.MISTRAL_HTTP_ERROR,
      `Unexpected: ${(error as Error).message}`,
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
