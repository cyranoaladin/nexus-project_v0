/**
 * ARIA Model Provider Gateway.
 *
 * Point d'accès UNIQUE aux modèles LLM pour ARIA.
 * Invariants :
 * - DIRECT_OPENAI_CALLS_OUTSIDE_GATEWAY=0
 * - ARIA_MODEL_TIMEOUT_ENFORCED=PASS
 * - Configuration fail-closed (aucun repli silencieux vers fausses clés)
 */

import OpenAI from 'openai';
import { AriaError } from './errors';

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseURL = process.env.OPENAI_BASE_URL;

  // Fail closed : Si aucune clé ni endpoint configuré, refus immédiat sans fallback "ollama" silencieux
  if (!apiKey && !baseURL) {
    throw new AriaError(
      'MODEL_UNAVAILABLE',
      503,
      'Le service d\'intelligence pédagogique ARIA n\'est pas configuré sur ce serveur.'
    );
  }

  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: apiKey || 'local-provider-key',
      baseURL: baseURL || undefined,
    });
  }
  return openaiClient;
}

export interface ChatMessage {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
}

export interface StreamChatOptions {
  readonly model?: string;
  readonly maxTokens?: number;
  readonly temperature?: number;
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
}

export const ARIA_DEFAULT_TIMEOUT_MS = 30000;

export function getAriaDefaultModel(): string {
  return process.env.ARIA_MODEL || process.env.OPENAI_MODEL || 'gpt-4o';
}

/**
 * Combine un signal appelant et un timeout contrôlé.
 */
function createCombinedSignal(options?: StreamChatOptions): {
  signal: AbortSignal;
  cleanup: () => void;
  isTimedOut: () => boolean;
} {
  const timeoutMs = options?.timeoutMs ?? ARIA_DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort(new Error('MODEL_TIMEOUT'));
  }, timeoutMs);

  const onCallerAbort = () => {
    controller.abort(options?.signal?.reason);
  };

  if (options?.signal) {
    if (options.signal.aborted) {
      clearTimeout(timer);
      controller.abort(options.signal.reason);
    } else {
      options.signal.addEventListener('abort', onCallerAbort, { once: true });
    }
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      if (options?.signal) {
        options.signal.removeEventListener('abort', onCallerAbort);
      }
    },
    isTimedOut: () => timedOut,
  };
}

function sanitizeErrorString(str: string): string {
  return str
    .replace(/sk-[a-zA-Z0-9_-]+/g, '[REDACTED]')
    .replace(/(Bearer\s+)[a-zA-Z0-9_\-\.]+/gi, '$1[REDACTED]')
    .replace(/\/internal\/[^\s]+/g, '[REDACTED]');
}

/**
 * Diffuse les tokens d'un appel chat completion sous forme d'un générateur asynchrone.
 */
export async function* streamChatCompletion(
  messages: readonly ChatMessage[],
  options?: StreamChatOptions
): AsyncGenerator<string, void, unknown> {
  const client = getOpenAIClient();
  const model = options?.model || getAriaDefaultModel();
  const maxTokens = options?.maxTokens ?? 1500;
  const temperature = options?.temperature ?? 0.7;

  const { signal, cleanup, isTimedOut } = createCombinedSignal(options);

  try {
    const stream = await client.chat.completions.create(
      {
        model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        max_tokens: maxTokens,
        temperature,
        stream: true,
      },
      {
        signal,
      }
    );

    for await (const chunk of stream) {
      if (signal.aborted) {
        break;
      }
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        yield delta;
      }
    }
  } catch (error: unknown) {
    if (isTimedOut()) {
      throw new AriaError(
        'MODEL_TIMEOUT',
        504,
        'Le temps d\'attente de réponse du modèle a expiré.',
        error
      );
    }
    if (options?.signal?.aborted) {
      // Annulation normale par l'utilisateur
      throw new AriaError('USER_CANCELLED', 499, 'Génération annulée par l\'utilisateur.', error);
    }

    const internalMsg = error instanceof Error ? error.message : String(error);
    const sanitizedMsg = sanitizeErrorString(internalMsg);
    throw new AriaError(
      'MODEL_UNAVAILABLE',
      503,
      `Le service d'intelligence pédagogique est temporairement indisponible: ${sanitizedMsg}`,
      sanitizedMsg
    );
  } finally {
    cleanup();
  }
}

/**
 * Exécute un appel chat completion synchrone (non-streaming) via le gateway unique.
 */
export async function callChatCompletion(
  messages: readonly ChatMessage[],
  options?: StreamChatOptions
): Promise<string> {
  const client = getOpenAIClient();
  const model = options?.model || getAriaDefaultModel();
  const maxTokens = options?.maxTokens ?? 1500;
  const temperature = options?.temperature ?? 0.7;

  const { signal, cleanup, isTimedOut } = createCombinedSignal(options);

  try {
    const response = await client.chat.completions.create(
      {
        model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        max_tokens: maxTokens,
        temperature,
        stream: false,
      },
      {
        signal,
      }
    );

    return response.choices[0]?.message?.content || '';
  } catch (error: unknown) {
    if (isTimedOut()) {
      throw new AriaError(
        'MODEL_TIMEOUT',
        504,
        'Le temps d\'attente de réponse du modèle a expiré.',
        error
      );
    }
    if (options?.signal?.aborted) {
      throw new AriaError('USER_CANCELLED', 499, 'Génération annulée par l\'utilisateur.', error);
    }

    const internalMsg = error instanceof Error ? error.message : String(error);
    const sanitizedMsg = sanitizeErrorString(internalMsg);
    throw new AriaError(
      'MODEL_UNAVAILABLE',
      503,
      `Le service d'intelligence pédagogique est temporairement indisponible: ${sanitizedMsg}`,
      sanitizedMsg
    );
  } finally {
    cleanup();
  }
}
