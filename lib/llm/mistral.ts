import { logger } from '@/lib/logger';

// Stable error codes for Mistral API operations
export const MISTRAL_ERROR_CODES = {
  MISTRAL_API_KEY_MISSING: 'MISTRAL_API_KEY_MISSING',
  MISTRAL_TIMEOUT: 'MISTRAL_TIMEOUT',
  MISTRAL_HTTP_ERROR: 'MISTRAL_HTTP_ERROR',
  MISTRAL_INVALID_JSON: 'MISTRAL_INVALID_JSON',
  MISTRAL_EMPTY_RESPONSE: 'MISTRAL_EMPTY_RESPONSE',
} as const;

export type MistralErrorCode = typeof MISTRAL_ERROR_CODES[keyof typeof MISTRAL_ERROR_CODES];

export class MistralConfigurationError extends Error {
  code = MISTRAL_ERROR_CODES.MISTRAL_API_KEY_MISSING;

  constructor() {
    super('MISTRAL_API_KEY is missing');
    this.name = 'MistralConfigurationError';
  }
}

export class MistralGenerationError extends Error {
  code: MistralErrorCode;

  constructor(code: MistralErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'MistralGenerationError';
  }
}

export type MistralChatMessage = {
  role: 'system' | 'user';
  content: string;
};

export type MistralJsonCompletion = {
  json: unknown;
  model: string;
};

/**
 * Get the configured timeout for Mistral API calls.
 * Uses MISTRAL_TIMEOUT_MS env var, defaults to 60000ms (1 minute).
 */
function getMistralTimeoutMs(): number {
  const envTimeout = process.env.MISTRAL_TIMEOUT_MS;
  if (envTimeout) {
    const parsed = parseInt(envTimeout, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return 60000; // Default: 60 seconds
}

/**
 * Create a JSON completion using Mistral API with timeout and error handling.
 *
 * Security features:
 * - AbortController with configurable timeout (MISTRAL_TIMEOUT_MS, default 60s)
 * - Stable error codes for different failure modes
 * - Never logs prompt content, context, or generated responses
 * - Returns structured JSON only
 *
 * @param messages - Chat messages for the completion
 * @param options - Optional model and temperature settings
 * @returns MistralJsonCompletion with parsed JSON and model name
 * @throws MistralConfigurationError if API key is missing
 * @throws MistralGenerationError with specific error codes for other failures
 */
export async function createMistralJsonCompletion(
  messages: MistralChatMessage[],
  options: { model?: string; temperature?: number } = {},
): Promise<MistralJsonCompletion> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    logger.error({ error: 'MISTRAL_API_KEY not configured' }, '[Mistral] API key missing');
    throw new MistralConfigurationError();
  }

  const model = options.model || process.env.MISTRAL_MODEL || 'mistral-large-latest';
  const timeoutMs = getMistralTimeoutMs();

  // Create AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    logger.debug({ model, timeoutMs }, '[Mistral] Starting API call');

    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options.temperature ?? 0.2,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      logger.error({ status: response.status, statusText: response.statusText }, '[Mistral] HTTP error');
      throw new MistralGenerationError(
        MISTRAL_ERROR_CODES.MISTRAL_HTTP_ERROR,
        `Mistral API returned HTTP ${response.status}`
      );
    }

    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;

    if (typeof content !== 'string' || content.trim().length === 0) {
      logger.error({ responseShape: Object.keys(payload) }, '[Mistral] Empty response');
      throw new MistralGenerationError(
        MISTRAL_ERROR_CODES.MISTRAL_EMPTY_RESPONSE,
        'Mistral API returned an empty response'
      );
    }

    try {
      const json = JSON.parse(content);
      logger.info({ model, jsonLength: content.length }, '[Mistral] JSON completion successful');
      return { json, model };
    } catch (parseError) {
      logger.error(
        { error: (parseError as Error).message, contentSnippet: content.slice(0, 100) },
        '[Mistral] Invalid JSON response'
      );
      throw new MistralGenerationError(
        MISTRAL_ERROR_CODES.MISTRAL_INVALID_JSON,
        'Mistral API returned invalid JSON'
      );
    }
  } catch (error) {
    clearTimeout(timeoutId);

    // Handle timeout specifically
    if (error instanceof Error && error.name === 'AbortError') {
      logger.error({ timeoutMs }, '[Mistral] Request timeout');
      throw new MistralGenerationError(
        MISTRAL_ERROR_CODES.MISTRAL_TIMEOUT,
        `Mistral API request timed out after ${timeoutMs}ms`
      );
    }

    // Re-throw known errors
    if (error instanceof MistralConfigurationError || error instanceof MistralGenerationError) {
      throw error;
    }

    // Unknown error
    logger.error({ error: (error as Error).message }, '[Mistral] Unexpected error');
    throw new MistralGenerationError(
      MISTRAL_ERROR_CODES.MISTRAL_HTTP_ERROR,
      'Unexpected error calling Mistral API'
    );
  }
}
